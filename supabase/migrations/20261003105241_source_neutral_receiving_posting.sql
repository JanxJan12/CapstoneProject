begin;

-- Make formal Foodhouse receiving source-neutral while preserving the existing
-- purchase-order path. Historical inventory, recipes, and aggregate balances
-- are deliberately untouched.

alter table public.receiving_reports
  add column source_type text not null default 'direct_supplier',
  add column source_reference text,
  alter column purchase_order_id drop not null,
  add constraint receiving_reports_source_type_chk
    check (source_type in ('production_team', 'direct_supplier')),
  add constraint receiving_reports_source_reference_chk
    check (
      source_reference is null
      or btrim(source_reference) <> ''
    ),
  add constraint receiving_reports_source_semantics_chk
    check (
      (
        source_type = 'production_team'
        and purchase_order_id is null
        and supplier_delivery_reference is null
      )
      or
      (
        source_type = 'direct_supplier'
        and purchase_order_id is not null
      )
    );

comment on column public.receiving_reports.source_type is
  'Foodhouse receipt source: production_team or direct_supplier.';
comment on column public.receiving_reports.source_reference is
  'Optional source-neutral delivery, dispatch, or handoff reference.';

alter table public.receiving_report_items
  add column inventory_item_id uuid,
  add column source_lot_code text,
  add column manufactured_on date,
  add column use_by_date date,
  alter column purchase_order_item_id drop not null,
  add constraint receiving_report_items_inventory_item_id_fkey
    foreign key (inventory_item_id)
    references public.inventory_items(id),
  add constraint receiving_report_items_source_reference_chk
    check (
      num_nonnulls(inventory_item_id, purchase_order_item_id) = 1
    ),
  add constraint receiving_report_items_source_lot_code_chk
    check (
      source_lot_code is null
      or btrim(source_lot_code) <> ''
    ),
  add constraint receiving_report_items_date_order_chk
    check (
      manufactured_on is null
      or use_by_date is null
      or manufactured_on <= use_by_date
    );

create index receiving_report_items_inventory_item_id_idx
  on public.receiving_report_items using btree (inventory_item_id);

create unique index receiving_report_items_report_inventory_item_uidx
  on public.receiving_report_items using btree (
    receiving_report_id,
    inventory_item_id
  )
  where inventory_item_id is not null;

-- A posted accepted line owns exactly one receiving-origin batch and that batch
-- owns exactly one receiving movement. Future issuance rows may still reference
-- the same batch, so only receiving movements are unique by batch.
create unique index inventory_batches_receiving_report_item_uidx
  on public.inventory_batches using btree (receiving_report_item_id)
  where receiving_report_item_id is not null;

create unique index inventory_transactions_receiving_batch_uidx
  on public.inventory_transactions using btree (inventory_batch_id)
  where transaction_type = 'receiving'
    and inventory_batch_id is not null;

comment on column public.receiving_report_items.inventory_item_id is
  'Direct Foodhouse inventory identity for production_team receipts; direct_supplier lines derive inventory from purchase_order_item_id.';
comment on column public.receiving_report_items.source_lot_code is
  'Optional source-neutral lot or preparation-batch reference copied to the posted inventory batch.';

create function public.post_receiving_report(
  p_receiving_report_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid;
  v_report public.receiving_reports%rowtype;
  v_line record;
  v_inventory_lock record;
  v_po_lock record;
  v_purchase_order_status public.purchase_order_status;
  v_line_count integer := 0;
  v_batch_count integer := 0;
  v_transaction_count integer := 0;
  v_total_accepted numeric := 0;
  v_quantity_before numeric;
  v_quantity_after numeric;
  v_batch_id uuid;
  v_posted_at timestamptz := now();
  v_all_po_lines_resolved boolean;
  v_any_po_quantity_received boolean;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_receiving_report_id is null then
    raise exception 'Receiving report ID is required.'
      using errcode = '22023';
  end if;

  select report.*
  into v_report
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.'
      using errcode = 'P0002';
  end if;

  if v_report.status = 'posted' then
    raise exception 'Receiving report is already posted.'
      using errcode = '22023';
  end if;

  if v_report.status <> 'draft' then
    raise exception 'Only a draft receiving report can be posted.'
      using errcode = '22023';
  end if;

  if v_report.source_type = 'production_team' then
    if v_report.purchase_order_id is not null
       or v_report.supplier_delivery_reference is not null
    then
      raise exception 'Production Team receiving cannot reference a purchase order or supplier delivery.'
        using errcode = '22023';
    end if;
  elsif v_report.source_type = 'direct_supplier' then
    if v_report.purchase_order_id is null then
      raise exception 'Direct supplier receiving requires a purchase order.'
        using errcode = '22023';
    end if;

    select purchase_order.status
    into v_purchase_order_status
    from public.purchase_orders purchase_order
    where purchase_order.id = v_report.purchase_order_id
    for update;

    if not found then
      raise exception 'Receiving report purchase order was not found.'
        using errcode = 'P0002';
    end if;

    if v_purchase_order_status not in (
      'submitted'::public.purchase_order_status,
      'partially_received'::public.purchase_order_status
    ) then
      raise exception 'Purchase order must be submitted or partially received before receiving.'
        using errcode = '22023';
    end if;
  else
    raise exception 'Unsupported receiving source type.'
      using errcode = '22023';
  end if;

  -- Lock every line before validating or mutating anything. A concurrent post
  -- waits on the report row and then observes the posted state.
  for v_line in
    select report_item.id
    from public.receiving_report_items report_item
    where report_item.receiving_report_id = v_report.id
    order by report_item.id
    for update
  loop
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count = 0 then
    raise exception 'Receiving report must contain at least one line.'
      using errcode = '22023';
  end if;

  -- Lock PO lines and inventory items in stable UUID order to avoid deadlocks
  -- between reports that touch overlapping records.
  if v_report.source_type = 'direct_supplier' then
    for v_po_lock in
      select purchase_order_item.id
      from public.purchase_order_items purchase_order_item
      where purchase_order_item.id in (
        select report_item.purchase_order_item_id
        from public.receiving_report_items report_item
        where report_item.receiving_report_id = v_report.id
      )
      order by purchase_order_item.id
      for update
    loop
      null;
    end loop;
  end if;

  for v_inventory_lock in
    select inventory_item.id
    from public.inventory_items inventory_item
    where inventory_item.id in (
      select case
        when v_report.source_type = 'production_team'
          then report_item.inventory_item_id
        else purchase_order_item.inventory_item_id
      end
      from public.receiving_report_items report_item
      left join public.purchase_order_items purchase_order_item
        on purchase_order_item.id = report_item.purchase_order_item_id
      where report_item.receiving_report_id = v_report.id
    )
    order by inventory_item.id
    for update
  loop
    null;
  end loop;

  -- Validate every line before the first balance, batch, ledger, or PO update.
  for v_line in
    select
      report_item.*,
      purchase_order_item.purchase_order_id as line_purchase_order_id,
      purchase_order_item.inventory_item_id as po_inventory_item_id,
      purchase_order_item.quantity_remaining as po_quantity_remaining,
      purchase_order_item.expiration_date as po_expiration_date,
      inventory_item.id as resolved_inventory_item_id,
      inventory_item.item_name,
      inventory_item.unit,
      inventory_item.secondary_unit,
      inventory_item.is_active as inventory_item_is_active,
      inventory_item.expiry_required,
      inventory_item.quantity_on_hand as item_quantity_on_hand,
      coalesce(
        report_item.use_by_date,
        purchase_order_item.expiration_date
      ) as effective_use_by_date
    from public.receiving_report_items report_item
    left join public.purchase_order_items purchase_order_item
      on purchase_order_item.id = report_item.purchase_order_item_id
    left join public.inventory_items inventory_item
      on inventory_item.id = case
        when v_report.source_type = 'production_team'
          then report_item.inventory_item_id
        else purchase_order_item.inventory_item_id
      end
    where report_item.receiving_report_id = v_report.id
    order by report_item.id
  loop
    if v_report.source_type = 'production_team' then
      if v_line.inventory_item_id is null
         or v_line.purchase_order_item_id is not null
      then
        raise exception 'Production Team receiving lines require inventory_item_id and cannot reference a PO item.'
          using errcode = '22023';
      end if;
    else
      if v_line.purchase_order_item_id is null
         or v_line.inventory_item_id is not null
      then
        raise exception 'Direct supplier receiving lines require a PO item and cannot directly identify inventory.'
          using errcode = '22023';
      end if;

      if v_line.line_purchase_order_id is null
         or v_line.line_purchase_order_id <> v_report.purchase_order_id
      then
        raise exception 'Receiving line PO item does not belong to the report purchase order.'
          using errcode = '22023';
      end if;

      if v_line.quantity_accepted > v_line.po_quantity_remaining then
        raise exception 'Accepted quantity exceeds the PO item remaining quantity.'
          using errcode = '22023';
      end if;
    end if;

    if v_line.resolved_inventory_item_id is null then
      raise exception 'Receiving line inventory item was not found.'
        using errcode = 'P0002';
    end if;

    if not v_line.inventory_item_is_active then
      raise exception 'Inactive inventory items cannot be received.'
        using errcode = '22023';
    end if;

    if v_line.quantity_delivered is null
       or v_line.quantity_delivered in (
         'NaN'::numeric,
         'Infinity'::numeric,
         '-Infinity'::numeric
       )
       or v_line.quantity_delivered <= 0
       or v_line.quantity_accepted is null
       or v_line.quantity_accepted in (
         'NaN'::numeric,
         'Infinity'::numeric,
         '-Infinity'::numeric
       )
       or v_line.quantity_accepted < 0
       or v_line.quantity_accepted > v_line.quantity_delivered
       or v_line.quantity_rejected
          <> v_line.quantity_delivered - v_line.quantity_accepted
    then
      raise exception 'Receiving line base quantities are inconsistent.'
        using errcode = '22023';
    end if;

    if v_line.secondary_unit is null then
      if v_line.secondary_quantity_delivered is not null
         or v_line.secondary_quantity_accepted is not null
      then
        raise exception 'Secondary quantities are not allowed when the inventory item has no secondary unit.'
          using errcode = '22023';
      end if;
    else
      if v_line.secondary_quantity_delivered is null
         or v_line.secondary_quantity_accepted is null
      then
        raise exception 'Inventory items with a secondary unit require independent secondary receiving quantities.'
          using errcode = '22023';
      end if;

      if v_line.secondary_quantity_delivered in (
           'NaN'::numeric,
           'Infinity'::numeric,
           '-Infinity'::numeric
         )
         or v_line.secondary_quantity_delivered <= 0
         or v_line.secondary_quantity_accepted in (
           'NaN'::numeric,
           'Infinity'::numeric,
           '-Infinity'::numeric
         )
         or v_line.secondary_quantity_accepted < 0
         or v_line.secondary_quantity_accepted
            > v_line.secondary_quantity_delivered
         or v_line.secondary_quantity_rejected
            <> v_line.secondary_quantity_delivered
               - v_line.secondary_quantity_accepted
         or (
           (v_line.quantity_accepted = 0)
           <> (v_line.secondary_quantity_accepted = 0)
         )
      then
        raise exception 'Receiving line secondary quantities are inconsistent.'
          using errcode = '22023';
      end if;
    end if;

    if (
      v_line.quantity_rejected > 0
      or coalesce(v_line.secondary_quantity_rejected, 0) > 0
    ) and nullif(btrim(v_line.rejection_reason), '') is null
    then
      raise exception 'Rejection reason is required when any quantity is rejected.'
        using errcode = '22023';
    end if;

    if v_line.expiry_required
       and v_line.effective_use_by_date is null
    then
      raise exception 'Expiry-required inventory must include a use-by date.'
        using errcode = '22023';
    end if;

    if v_line.manufactured_on is not null
       and v_line.effective_use_by_date is not null
       and v_line.manufactured_on > v_line.effective_use_by_date
    then
      raise exception 'Manufactured date cannot be after the use-by date.'
        using errcode = '22023';
    end if;
  end loop;

  for v_line in
    select
      report_item.*,
      purchase_order_item.inventory_item_id as po_inventory_item_id,
      purchase_order_item.expiration_date as po_expiration_date,
      inventory_item.id as resolved_inventory_item_id,
      inventory_item.quantity_on_hand as item_quantity_on_hand,
      coalesce(
        report_item.use_by_date,
        purchase_order_item.expiration_date
      ) as effective_use_by_date
    from public.receiving_report_items report_item
    left join public.purchase_order_items purchase_order_item
      on purchase_order_item.id = report_item.purchase_order_item_id
    join public.inventory_items inventory_item
      on inventory_item.id = case
        when v_report.source_type = 'production_team'
          then report_item.inventory_item_id
        else purchase_order_item.inventory_item_id
      end
    where report_item.receiving_report_id = v_report.id
    order by report_item.id
  loop
    if v_line.quantity_accepted > 0 then
      v_quantity_before := v_line.item_quantity_on_hand;

      insert into public.inventory_batches (
        batch_code,
        inventory_item_id,
        origin_type,
        receiving_report_item_id,
        supplier_lot_code,
        received_at,
        manufactured_on,
        use_by_date,
        quantity_initial,
        quantity_on_hand,
        secondary_quantity_initial,
        secondary_quantity_on_hand,
        created_at
      )
      values (
        'RRB-' || replace(v_line.id::text, '-', ''),
        v_line.resolved_inventory_item_id,
        'receiving',
        v_line.id,
        v_line.source_lot_code,
        v_report.received_at,
        v_line.manufactured_on,
        v_line.effective_use_by_date,
        v_line.quantity_accepted,
        v_line.quantity_accepted,
        v_line.secondary_quantity_accepted,
        v_line.secondary_quantity_accepted,
        v_posted_at
      )
      returning id into v_batch_id;

      update public.inventory_items inventory_item
      set quantity_on_hand =
        inventory_item.quantity_on_hand + v_line.quantity_accepted
      where inventory_item.id = v_line.resolved_inventory_item_id
      returning inventory_item.quantity_on_hand into v_quantity_after;

      if v_quantity_after
         is distinct from v_quantity_before + v_line.quantity_accepted
      then
        raise exception 'Inventory receiving arithmetic failed.'
          using errcode = 'P0001';
      end if;

      insert into public.inventory_transactions (
        inventory_item_id,
        purchase_order_item_id,
        order_id,
        performed_by,
        transaction_type,
        quantity_change,
        quantity_before,
        quantity_after,
        reason,
        mutation_request_id,
        inventory_batch_id,
        created_at
      )
      values (
        v_line.resolved_inventory_item_id,
        v_line.purchase_order_item_id,
        null,
        v_actor_id,
        'receiving'::public.inventory_transaction_type,
        v_line.quantity_accepted,
        v_quantity_before,
        v_quantity_after,
        'Formal receiving report ' || v_report.rr_number,
        v_line.id,
        v_batch_id,
        v_posted_at
      );

      v_batch_count := v_batch_count + 1;
      v_transaction_count := v_transaction_count + 1;
      v_total_accepted := v_total_accepted + v_line.quantity_accepted;
    end if;

    if v_report.source_type = 'direct_supplier'
       and v_line.quantity_accepted > 0
    then
      update public.purchase_order_items purchase_order_item
      set
        quantity_received =
          purchase_order_item.quantity_received
          + v_line.quantity_accepted,
        secondary_quantity_received =
          purchase_order_item.secondary_quantity_received
          + coalesce(v_line.secondary_quantity_accepted, 0),
        received_at = case
          when purchase_order_item.quantity_remaining
               = v_line.quantity_accepted
            then v_posted_at
          else purchase_order_item.received_at
        end
      where purchase_order_item.id = v_line.purchase_order_item_id;
    end if;
  end loop;

  if v_report.source_type = 'direct_supplier' then
    select
      bool_and(purchase_order_item.quantity_remaining = 0),
      bool_or(purchase_order_item.quantity_received > 0)
    into
      v_all_po_lines_resolved,
      v_any_po_quantity_received
    from public.purchase_order_items purchase_order_item
    where purchase_order_item.purchase_order_id = v_report.purchase_order_id;

    update public.purchase_orders purchase_order
    set
      status = case
        when v_all_po_lines_resolved
          then 'received'::public.purchase_order_status
        when v_any_po_quantity_received
          then 'partially_received'::public.purchase_order_status
        else purchase_order.status
      end,
      received_at = case
        when v_all_po_lines_resolved then v_posted_at
        else purchase_order.received_at
      end
    where purchase_order.id = v_report.purchase_order_id;
  end if;

  update public.receiving_reports report
  set
    status = 'posted',
    posted_at = v_posted_at,
    posted_by = v_actor_id
  where report.id = v_report.id;

  return jsonb_build_object(
    'receiving_report_id', v_report.id,
    'rr_number', v_report.rr_number,
    'source_type', v_report.source_type,
    'status', 'posted',
    'line_count', v_line_count,
    'batch_count', v_batch_count,
    'transaction_count', v_transaction_count,
    'total_accepted', v_total_accepted,
    'posted_at', v_posted_at,
    'posted_by', v_actor_id
  );
end;
$function$;

revoke all
on function public.post_receiving_report(uuid)
from public, anon, authenticated;

grant execute
on function public.post_receiving_report(uuid)
to authenticated, service_role;

comment on function public.post_receiving_report(uuid) is
  'Atomically posts one draft Foodhouse receiving report: accepted quantity only, one batch and linked receiving ledger row per accepted line, and PO updates only for direct_supplier receipts.';

comment on function public.receive_inventory_stock(uuid, numeric, text, uuid) is
  'Legacy/manual aggregate receiving retained for compatibility. It is not linked to formal receiving documents or batches and must be retired or gated during a later UI transition to avoid cross-path duplicate entry.';

comment on table public.receiving_reports is
  'Source-neutral Foodhouse receiving header. production_team receipts have no PO; direct_supplier receipts remain PO-backed. Only post_receiving_report authoritatively posts stock.';

comment on table public.receiving_report_items is
  'Foodhouse receiving line. Production Team lines identify inventory directly; direct supplier lines identify a PO item, which determines inventory. Accepted quantities create batches and linked ledger movements when posted.';

comment on column public.inventory_transactions.inventory_batch_id is
  'Nullable batch traceability link. Formal receiving writes one linked receiving transaction per accepted receiving batch; historical transactions remain NULL.';

commit;
