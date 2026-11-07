begin;

-- Phase 6B.4B exposes a narrow Manager-only document-authoring API. Draft
-- operations never mutate inventory balances, batches, transactions, or PO
-- received quantities. post_receiving_report(uuid) remains the only posting
-- authority.

create function public.get_manager_receiving_workspace(
  p_receiving_report_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_selected_report jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_receiving_report_id is not null
     and not exists (
       select 1
       from public.receiving_reports report
       where report.id = p_receiving_report_id
     )
  then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if p_receiving_report_id is not null then
    select jsonb_build_object(
      'id', report.id,
      'rr_number', report.rr_number,
      'source_type', report.source_type,
      'source_reference', report.source_reference,
      'purchase_order_id', report.purchase_order_id,
      'purchase_order_number', purchase_order.po_number,
      'supplier_id', supplier.id,
      'supplier_name', supplier.name,
      'received_at', report.received_at,
      'received_by', report.received_by,
      'received_by_name', concat_ws(' ', receiver.first_name, receiver.last_name),
      'status', report.status,
      'supplier_delivery_reference', report.supplier_delivery_reference,
      'notes', report.notes,
      'posted_at', report.posted_at,
      'posted_by', report.posted_by,
      'posted_by_name', nullif(concat_ws(' ', poster.first_name, poster.last_name), ''),
      'created_at', report.created_at,
      'updated_at', report.updated_at,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', report_item.id,
            'inventory_item_id', inventory_item.id,
            'inventory_item_name', inventory_item.item_name,
            'unit', inventory_item.unit,
            'secondary_unit', inventory_item.secondary_unit,
            'expiry_required', inventory_item.expiry_required,
            'rotation_policy', inventory_item.rotation_policy,
            'purchase_order_item_id', report_item.purchase_order_item_id,
            'quantity_ordered', purchase_order_item.quantity_ordered,
            'quantity_received', purchase_order_item.quantity_received,
            'quantity_cancelled', purchase_order_item.quantity_cancelled,
            'quantity_remaining', purchase_order_item.quantity_remaining,
            'secondary_quantity_ordered', purchase_order_item.secondary_quantity_ordered,
            'secondary_quantity_received', purchase_order_item.secondary_quantity_received,
            'quantity_delivered', report_item.quantity_delivered,
            'quantity_accepted', report_item.quantity_accepted,
            'quantity_rejected', report_item.quantity_rejected,
            'secondary_quantity_delivered', report_item.secondary_quantity_delivered,
            'secondary_quantity_accepted', report_item.secondary_quantity_accepted,
            'secondary_quantity_rejected', report_item.secondary_quantity_rejected,
            'rejection_reason', report_item.rejection_reason,
            'source_lot_code', report_item.source_lot_code,
            'manufactured_on', report_item.manufactured_on,
            'use_by_date', report_item.use_by_date,
            'notes', report_item.notes,
            'batch_id', batch.id,
            'batch_code', batch.batch_code,
            'created_at', report_item.created_at,
            'updated_at', report_item.updated_at
          )
          order by report_item.created_at, report_item.id
        )
        from public.receiving_report_items report_item
        left join public.purchase_order_items purchase_order_item
          on purchase_order_item.id = report_item.purchase_order_item_id
        join public.inventory_items inventory_item
          on inventory_item.id = coalesce(
            report_item.inventory_item_id,
            purchase_order_item.inventory_item_id
          )
        left join public.inventory_batches batch
          on batch.receiving_report_item_id = report_item.id
        where report_item.receiving_report_id = report.id
      ), '[]'::jsonb)
    )
    into v_selected_report
    from public.receiving_reports report
    left join public.purchase_orders purchase_order
      on purchase_order.id = report.purchase_order_id
    left join public.suppliers supplier
      on supplier.id = purchase_order.supplier_id
    join public.profiles receiver
      on receiver.id = report.received_by
    left join public.profiles poster
      on poster.id = report.posted_by
    where report.id = p_receiving_report_id;
  end if;

  return jsonb_build_object(
    'reports', coalesce((
      select jsonb_agg(report_summary.payload order by report_summary.sort_draft desc, report_summary.sort_at desc)
      from (
        select
          report.status = 'draft' as sort_draft,
          report.received_at as sort_at,
          jsonb_build_object(
            'id', report.id,
            'rr_number', report.rr_number,
            'source_type', report.source_type,
            'source_reference', report.source_reference,
            'purchase_order_id', report.purchase_order_id,
            'purchase_order_number', purchase_order.po_number,
            'supplier_name', supplier.name,
            'received_at', report.received_at,
            'status', report.status,
            'posted_at', report.posted_at,
            'line_count', (
              select count(*)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ),
            'total_delivered', coalesce((
              select sum(report_item.quantity_delivered)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ), 0),
            'total_accepted', coalesce((
              select sum(report_item.quantity_accepted)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ), 0),
            'total_rejected', coalesce((
              select sum(report_item.quantity_rejected)
              from public.receiving_report_items report_item
              where report_item.receiving_report_id = report.id
            ), 0),
            'updated_at', report.updated_at
          ) as payload
        from public.receiving_reports report
        left join public.purchase_orders purchase_order
          on purchase_order.id = report.purchase_order_id
        left join public.suppliers supplier
          on supplier.id = purchase_order.supplier_id
        order by (report.status = 'draft') desc, report.received_at desc
        limit 100
      ) report_summary
    ), '[]'::jsonb),
    'selected_report', v_selected_report,
    'inventory_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', inventory_item.id,
          'item_name', inventory_item.item_name,
          'unit', inventory_item.unit,
          'secondary_unit', inventory_item.secondary_unit,
          'quantity_on_hand', inventory_item.quantity_on_hand,
          'quantity_scale', inventory_item.quantity_scale,
          'rotation_policy', inventory_item.rotation_policy,
          'expiry_required', inventory_item.expiry_required
        )
        order by inventory_item.item_name
      )
      from public.inventory_items inventory_item
      where inventory_item.is_active = true
    ), '[]'::jsonb),
    'purchase_orders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', purchase_order.id,
          'po_number', purchase_order.po_number,
          'supplier_id', supplier.id,
          'supplier_name', supplier.name,
          'status', purchase_order.status,
          'ordered_at', purchase_order.ordered_at,
          'total_amount', purchase_order.total_amount,
          'items', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', purchase_order_item.id,
                'inventory_item_id', inventory_item.id,
                'inventory_item_name', inventory_item.item_name,
                'unit', inventory_item.unit,
                'secondary_unit', inventory_item.secondary_unit,
                'quantity_on_hand', inventory_item.quantity_on_hand,
                'quantity_scale', inventory_item.quantity_scale,
                'expiry_required', inventory_item.expiry_required,
                'rotation_policy', inventory_item.rotation_policy,
                'quantity_ordered', purchase_order_item.quantity_ordered,
                'quantity_received', purchase_order_item.quantity_received,
                'quantity_cancelled', purchase_order_item.quantity_cancelled,
                'quantity_remaining', purchase_order_item.quantity_remaining,
                'secondary_quantity_ordered', purchase_order_item.secondary_quantity_ordered,
                'secondary_quantity_received', purchase_order_item.secondary_quantity_received,
                'expiration_date', purchase_order_item.expiration_date
              )
              order by inventory_item.item_name
            )
            from public.purchase_order_items purchase_order_item
            join public.inventory_items inventory_item
              on inventory_item.id = purchase_order_item.inventory_item_id
            where purchase_order_item.purchase_order_id = purchase_order.id
              and purchase_order_item.quantity_remaining > 0
              and inventory_item.is_active = true
          ), '[]'::jsonb)
        )
        order by purchase_order.ordered_at desc nulls last, purchase_order.po_number
      )
      from public.purchase_orders purchase_order
      join public.suppliers supplier
        on supplier.id = purchase_order.supplier_id
      where purchase_order.status in (
        'submitted'::public.purchase_order_status,
        'partially_received'::public.purchase_order_status
      )
        and supplier.is_active = true
    ), '[]'::jsonb)
  );
end;
$function$;

create function public.create_receiving_report_draft(
  p_request_id uuid,
  p_source_type text,
  p_source_reference text,
  p_purchase_order_id uuid,
  p_received_at timestamptz,
  p_supplier_delivery_reference text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_existing public.receiving_reports%rowtype;
  v_report public.receiving_reports%rowtype;
  v_source_reference text := nullif(btrim(p_source_reference), '');
  v_supplier_delivery_reference text := nullif(btrim(p_supplier_delivery_reference), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_po_status public.purchase_order_status;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'Draft request ID is required.' using errcode = '22023';
  end if;

  if p_received_at is null then
    raise exception 'Received date and time are required.' using errcode = '22023';
  end if;

  if p_source_type not in ('production_team', 'direct_supplier') then
    raise exception 'Unsupported receiving source type.' using errcode = '22023';
  end if;

  if p_source_type = 'production_team' then
    if p_purchase_order_id is not null or v_supplier_delivery_reference is not null then
      raise exception 'Production Team drafts cannot reference a purchase order or supplier delivery.'
        using errcode = '22023';
    end if;
  else
    if p_purchase_order_id is null then
      raise exception 'Direct supplier drafts require a purchase order.' using errcode = '22023';
    end if;

    select purchase_order.status into v_po_status
    from public.purchase_orders purchase_order
    join public.suppliers supplier on supplier.id = purchase_order.supplier_id
    where purchase_order.id = p_purchase_order_id
      and supplier.is_active = true;

    if not found then
      raise exception 'Selected purchase order was not found or its supplier is inactive.'
        using errcode = 'P0002';
    end if;

    if v_po_status not in (
      'submitted'::public.purchase_order_status,
      'partially_received'::public.purchase_order_status
    ) then
      raise exception 'Purchase order is no longer eligible for receiving.' using errcode = '22023';
    end if;
  end if;

  select report.* into v_existing
  from public.receiving_reports report
  where report.id = p_request_id
  for update;

  if found then
    if v_existing.status <> 'draft' or v_existing.received_by <> v_actor_id then
      raise exception 'Draft request ID has already been used.' using errcode = '23505';
    end if;

    if v_existing.source_type is distinct from p_source_type
       or v_existing.source_reference is distinct from v_source_reference
       or v_existing.purchase_order_id is distinct from p_purchase_order_id
       or v_existing.received_at is distinct from p_received_at
       or v_existing.supplier_delivery_reference is distinct from v_supplier_delivery_reference
       or v_existing.notes is distinct from v_notes
    then
      raise exception 'Draft request ID was reused with different details.' using errcode = '22023';
    end if;

    v_report := v_existing;
  else
    insert into public.receiving_reports (
      id,
      rr_number,
      source_type,
      source_reference,
      purchase_order_id,
      received_at,
      received_by,
      supplier_delivery_reference,
      notes
    )
    values (
      p_request_id,
      'RR-' || to_char(p_received_at at time zone 'Asia/Manila', 'YYYYMMDD') || '-' ||
        upper(substr(replace(p_request_id::text, '-', ''), 1, 8)),
      p_source_type,
      v_source_reference,
      p_purchase_order_id,
      p_received_at,
      v_actor_id,
      v_supplier_delivery_reference,
      v_notes
    )
    returning * into v_report;
  end if;

  return jsonb_build_object(
    'id', v_report.id,
    'rr_number', v_report.rr_number,
    'status', v_report.status,
    'source_type', v_report.source_type,
    'created_at', v_report.created_at
  );
end;
$function$;

create function public.update_receiving_report_draft(
  p_receiving_report_id uuid,
  p_source_type text,
  p_source_reference text,
  p_purchase_order_id uuid,
  p_received_at timestamptz,
  p_supplier_delivery_reference text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_source_reference text := nullif(btrim(p_source_reference), '');
  v_supplier_delivery_reference text := nullif(btrim(p_supplier_delivery_reference), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_po_status public.purchase_order_status;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  select report.* into v_report
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if v_report.status <> 'draft' then
    raise exception 'Only draft receiving reports can be edited.' using errcode = '22023';
  end if;

  if p_received_at is null then
    raise exception 'Received date and time are required.' using errcode = '22023';
  end if;

  if p_source_type not in ('production_team', 'direct_supplier') then
    raise exception 'Unsupported receiving source type.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.receiving_report_items report_item
    where report_item.receiving_report_id = v_report.id
  ) and (
    v_report.source_type is distinct from p_source_type
    or v_report.purchase_order_id is distinct from p_purchase_order_id
  ) then
    raise exception 'Remove existing lines before changing the draft source or purchase order.'
      using errcode = '22023';
  end if;

  if p_source_type = 'production_team' then
    if p_purchase_order_id is not null or v_supplier_delivery_reference is not null then
      raise exception 'Production Team drafts cannot reference a purchase order or supplier delivery.'
        using errcode = '22023';
    end if;
  else
    if p_purchase_order_id is null then
      raise exception 'Direct supplier drafts require a purchase order.' using errcode = '22023';
    end if;

    select purchase_order.status into v_po_status
    from public.purchase_orders purchase_order
    join public.suppliers supplier on supplier.id = purchase_order.supplier_id
    where purchase_order.id = p_purchase_order_id
      and supplier.is_active = true;

    if not found then
      raise exception 'Selected purchase order was not found or its supplier is inactive.'
        using errcode = 'P0002';
    end if;

    if v_po_status not in (
      'submitted'::public.purchase_order_status,
      'partially_received'::public.purchase_order_status
    ) then
      raise exception 'Purchase order is no longer eligible for receiving.' using errcode = '22023';
    end if;
  end if;

  update public.receiving_reports report
  set
    source_type = p_source_type,
    source_reference = v_source_reference,
    purchase_order_id = p_purchase_order_id,
    received_at = p_received_at,
    supplier_delivery_reference = v_supplier_delivery_reference,
    notes = v_notes
  where report.id = v_report.id
  returning * into v_report;

  return jsonb_build_object(
    'id', v_report.id,
    'rr_number', v_report.rr_number,
    'status', v_report.status,
    'source_type', v_report.source_type,
    'updated_at', v_report.updated_at
  );
end;
$function$;

create function public.save_receiving_report_item(
  p_receiving_report_id uuid,
  p_receiving_report_item_id uuid,
  p_inventory_item_id uuid,
  p_purchase_order_item_id uuid,
  p_quantity_delivered numeric,
  p_quantity_accepted numeric,
  p_secondary_quantity_delivered numeric,
  p_secondary_quantity_accepted numeric,
  p_rejection_reason text,
  p_source_lot_code text,
  p_manufactured_on date,
  p_use_by_date date,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_existing public.receiving_report_items%rowtype;
  v_item_id uuid;
  v_item_name text;
  v_secondary_unit text;
  v_expiry_required boolean;
  v_po_remaining numeric;
  v_po_expiration date;
  v_rejection_reason text := nullif(btrim(p_rejection_reason), '');
  v_source_lot_code text := nullif(btrim(p_source_lot_code), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_saved public.receiving_report_items%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  if p_receiving_report_item_id is null then
    raise exception 'Receiving line request ID is required.' using errcode = '22023';
  end if;

  select report.* into v_report
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if v_report.status <> 'draft' then
    raise exception 'Only draft receiving reports can be edited.' using errcode = '22023';
  end if;

  select report_item.* into v_existing
  from public.receiving_report_items report_item
  where report_item.id = p_receiving_report_item_id
  for update;

  if found and v_existing.receiving_report_id <> v_report.id then
    raise exception 'Receiving line request ID belongs to another report.' using errcode = '23505';
  end if;

  if p_quantity_delivered is null
     or p_quantity_delivered in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity_delivered <= 0
     or p_quantity_accepted is null
     or p_quantity_accepted in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_quantity_accepted < 0
     or p_quantity_accepted > p_quantity_delivered
  then
    raise exception 'Delivered and accepted quantities are invalid.' using errcode = '22023';
  end if;

  if v_report.source_type = 'production_team' then
    if p_inventory_item_id is null or p_purchase_order_item_id is not null then
      raise exception 'Production Team lines require an inventory item and cannot reference a PO item.'
        using errcode = '22023';
    end if;

    select
      inventory_item.id,
      inventory_item.item_name,
      inventory_item.secondary_unit,
      inventory_item.expiry_required
    into v_item_id, v_item_name, v_secondary_unit, v_expiry_required
    from public.inventory_items inventory_item
    where inventory_item.id = p_inventory_item_id
      and inventory_item.is_active = true;
  else
    if p_purchase_order_item_id is null or p_inventory_item_id is not null then
      raise exception 'Direct supplier lines require a PO item and cannot directly identify inventory.'
        using errcode = '22023';
    end if;

    select
      inventory_item.id,
      inventory_item.item_name,
      inventory_item.secondary_unit,
      inventory_item.expiry_required,
      purchase_order_item.quantity_remaining,
      purchase_order_item.expiration_date
    into
      v_item_id,
      v_item_name,
      v_secondary_unit,
      v_expiry_required,
      v_po_remaining,
      v_po_expiration
    from public.purchase_order_items purchase_order_item
    join public.inventory_items inventory_item
      on inventory_item.id = purchase_order_item.inventory_item_id
    where purchase_order_item.id = p_purchase_order_item_id
      and purchase_order_item.purchase_order_id = v_report.purchase_order_id
      and inventory_item.is_active = true
    for update of purchase_order_item;

  end if;

  if v_item_id is null then
    raise exception 'Receiving line inventory item was not found or is inactive.' using errcode = 'P0002';
  end if;

  if v_report.source_type = 'direct_supplier'
     and p_quantity_accepted > v_po_remaining
  then
    raise exception 'Accepted quantity exceeds the PO item remaining quantity.' using errcode = '22023';
  end if;

  if v_secondary_unit is null then
    if p_secondary_quantity_delivered is not null
       or p_secondary_quantity_accepted is not null
    then
      raise exception 'Secondary quantities are not allowed for this inventory item.' using errcode = '22023';
    end if;
  else
    if p_secondary_quantity_delivered is null
       or p_secondary_quantity_accepted is null
       or p_secondary_quantity_delivered in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or p_secondary_quantity_delivered <= 0
       or p_secondary_quantity_accepted in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
       or p_secondary_quantity_accepted < 0
       or p_secondary_quantity_accepted > p_secondary_quantity_delivered
       or ((p_quantity_accepted = 0) <> (p_secondary_quantity_accepted = 0))
    then
      raise exception 'Independent secondary receiving quantities are invalid.' using errcode = '22023';
    end if;
  end if;

  if (
    p_quantity_delivered - p_quantity_accepted > 0
    or coalesce(p_secondary_quantity_delivered - p_secondary_quantity_accepted, 0) > 0
  ) and v_rejection_reason is null then
    raise exception 'Rejection reason is required when any quantity is rejected.' using errcode = '22023';
  end if;

  if v_expiry_required and coalesce(p_use_by_date, v_po_expiration) is null then
    raise exception 'Expiry-required inventory must include a use-by date.' using errcode = '22023';
  end if;

  if p_manufactured_on is not null
     and coalesce(p_use_by_date, v_po_expiration) is not null
     and p_manufactured_on > coalesce(p_use_by_date, v_po_expiration)
  then
    raise exception 'Manufactured date cannot be after the use-by date.' using errcode = '22023';
  end if;

  insert into public.receiving_report_items (
    id,
    receiving_report_id,
    inventory_item_id,
    purchase_order_item_id,
    quantity_delivered,
    quantity_accepted,
    secondary_quantity_delivered,
    secondary_quantity_accepted,
    rejection_reason,
    source_lot_code,
    manufactured_on,
    use_by_date,
    notes
  )
  values (
    p_receiving_report_item_id,
    v_report.id,
    p_inventory_item_id,
    p_purchase_order_item_id,
    p_quantity_delivered,
    p_quantity_accepted,
    p_secondary_quantity_delivered,
    p_secondary_quantity_accepted,
    v_rejection_reason,
    v_source_lot_code,
    p_manufactured_on,
    p_use_by_date,
    v_notes
  )
  on conflict (id) do update
  set
    inventory_item_id = excluded.inventory_item_id,
    purchase_order_item_id = excluded.purchase_order_item_id,
    quantity_delivered = excluded.quantity_delivered,
    quantity_accepted = excluded.quantity_accepted,
    secondary_quantity_delivered = excluded.secondary_quantity_delivered,
    secondary_quantity_accepted = excluded.secondary_quantity_accepted,
    rejection_reason = excluded.rejection_reason,
    source_lot_code = excluded.source_lot_code,
    manufactured_on = excluded.manufactured_on,
    use_by_date = excluded.use_by_date,
    notes = excluded.notes
  returning * into v_saved;

  return jsonb_build_object(
    'id', v_saved.id,
    'receiving_report_id', v_saved.receiving_report_id,
    'inventory_item_id', v_item_id,
    'inventory_item_name', v_item_name,
    'quantity_delivered', v_saved.quantity_delivered,
    'quantity_accepted', v_saved.quantity_accepted,
    'quantity_rejected', v_saved.quantity_rejected,
    'updated_at', v_saved.updated_at
  );
end;
$function$;

create function public.remove_receiving_report_item(
  p_receiving_report_id uuid,
  p_receiving_report_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_report_status text;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  select report.status into v_report_status
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if v_report_status <> 'draft' then
    raise exception 'Only draft receiving reports can be edited.' using errcode = '22023';
  end if;

  delete from public.receiving_report_items report_item
  where report_item.id = p_receiving_report_item_id
    and report_item.receiving_report_id = p_receiving_report_id;

  if not found then
    raise exception 'Receiving report item not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'receiving_report_id', p_receiving_report_id,
    'removed_item_id', p_receiving_report_item_id
  );
end;
$function$;

create function public.delete_empty_receiving_report_draft(
  p_receiving_report_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor_id
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  select report.* into v_report
  from public.receiving_reports report
  where report.id = p_receiving_report_id
  for update;

  if not found then
    raise exception 'Receiving report not found.' using errcode = 'P0002';
  end if;

  if v_report.status <> 'draft' then
    raise exception 'Only draft receiving reports can be deleted.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.receiving_report_items report_item
    where report_item.receiving_report_id = v_report.id
  ) then
    raise exception 'Only an empty receiving draft can be deleted.' using errcode = '22023';
  end if;

  delete from public.receiving_reports report where report.id = v_report.id;

  return jsonb_build_object(
    'deleted_report_id', v_report.id,
    'rr_number', v_report.rr_number
  );
end;
$function$;

revoke all on function public.get_manager_receiving_workspace(uuid)
  from public, anon, authenticated;
revoke all on function public.create_receiving_report_draft(
  uuid, text, text, uuid, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.update_receiving_report_draft(
  uuid, text, text, uuid, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.save_receiving_report_item(
  uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric,
  text, text, date, date, text
) from public, anon, authenticated;
revoke all on function public.remove_receiving_report_item(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_empty_receiving_report_draft(uuid)
  from public, anon, authenticated;

grant execute on function public.get_manager_receiving_workspace(uuid)
  to authenticated, service_role;
grant execute on function public.create_receiving_report_draft(
  uuid, text, text, uuid, timestamptz, text, text
) to authenticated, service_role;
grant execute on function public.update_receiving_report_draft(
  uuid, text, text, uuid, timestamptz, text, text
) to authenticated, service_role;
grant execute on function public.save_receiving_report_item(
  uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric,
  text, text, date, date, text
) to authenticated, service_role;
grant execute on function public.remove_receiving_report_item(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.delete_empty_receiving_report_draft(uuid)
  to authenticated, service_role;

comment on function public.get_manager_receiving_workspace(uuid) is
  'Manager-only receiving workspace read model. Direct receiving-table SELECT remains unavailable to browser roles.';
comment on function public.create_receiving_report_draft(uuid, text, text, uuid, timestamptz, text, text) is
  'Creates one idempotent receiving draft document without moving inventory.';
comment on function public.update_receiving_report_draft(uuid, text, text, uuid, timestamptz, text, text) is
  'Updates draft-only receiving header metadata without moving inventory.';
comment on function public.save_receiving_report_item(uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric, text, text, date, date, text) is
  'Adds or updates one idempotent draft receiving line without moving inventory.';
comment on function public.remove_receiving_report_item(uuid, uuid) is
  'Removes a line from a draft receiving report without moving inventory.';
comment on function public.delete_empty_receiving_report_draft(uuid) is
  'Deletes an empty unposted receiving draft without moving inventory.';

commit;
