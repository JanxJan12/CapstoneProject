-- Local candidate only. Apply only after a fresh read-only hosted preflight and isolated acceptance.
-- Replaces target-dependent runtime code before six explicit drops; no CASCADE.
begin;
lock table public.production_replenishment_requests,
  public.production_replenishment_status_events, public.suppliers,
  public.supplier_items, public.purchase_orders, public.purchase_order_items,
  public.receiving_reports, public.receiving_report_items,
  public.inventory_transactions in access exclusive mode;
do $retirement_guard$
begin
  if (select count(*) from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r') <> 36
    or exists (select 1 from public.production_replenishment_requests)
    or exists (select 1 from public.production_replenishment_status_events)
    or exists (select 1 from public.suppliers)
    or exists (select 1 from public.supplier_items)
    or exists (select 1 from public.purchase_orders)
    or exists (select 1 from public.purchase_order_items)
    or exists (select 1 from public.receiving_reports
      where replenishment_request_id is not null or purchase_order_id is not null)
    or exists (select 1 from public.receiving_report_items
      where purchase_order_item_id is not null)
    or exists (select 1 from public.inventory_transactions
      where purchase_order_item_id is not null)
  then
    raise exception 'Six-table retirement preflight failed: schema, target rows, or downstream links changed.'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from (values
      ('advance_replenishment_request(uuid,text,text)', 'da0f63e405dc37317ef80f793f76fbe0'),
      ('close_replenishment_from_receiving()', '987bd438d19a7b5fd65715bcdf09fd5c'),
      ('create_receiving_report_draft(uuid,text,text,uuid,timestamp with time zone,text,text)', 'ffb9cfdf0d441899f26321948c5d56ad'),
      ('create_replenishment_request(uuid,uuid,numeric,timestamp with time zone,text,text)', 'd1694501f5679cfb066b96cf3f33b3fc'),
      ('enforce_inventory_item_quantity_policy()', 'c0750580557467a6452583e159ff3fc0'),
      ('enforce_inventory_related_quantity_scale()', '95fd4e4a7e11b0f7b3be2bfad1fc4db8'),
      ('enforce_receiving_item_shelf_life()', 'b8e51261bae6a829d9e0425bd76182fa'),
      ('get_inventory_request_proposal(timestamp with time zone)', '2539f9c2445dffc8776398b767ad69e4'),
      ('get_manager_inventory_movements(uuid,text,date,date,timestamp with time zone,uuid,integer)', 'befa57e2efd8ca05c27fe6a2ee04bffa'),
      ('get_manager_receiving_documents(text,text,text,date,date,integer,integer)', '964278753b430aa26977d4991c06131d'),
      ('get_manager_receiving_workspace(uuid)', '64caa149e8cba587568689a80b481dcf'),
      ('get_replenishment_requests()', 'fceb37f6faf9914d27b54ef34ac3bd34'),
      ('guard_linked_replenishment_line()', 'a3045cb9c34ede6c78a950a9d587e10f'),
      ('guard_linked_replenishment_report()', '837f878d1edd1b5102c7989b02b3dffb'),
      ('guard_open_replenishment_item_unit()', 'c868f736497433d40eb4ff9393ba299d'),
      ('guard_production_replenishment_request()', 'd404b364666099ebedef3877b2fb4acf'),
      ('post_receiving_report(uuid)', '458b6ca3fe9ad5b71a92728d9235b488'),
      ('refresh_receiving_item_shelf_life()', '5f5f05922512c4f0fe072312ec444a17'),
      ('save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date,text)', '2990541f66464310efec355c9ba2170b'),
      ('start_replenishment_receiving(uuid)', '6e2f96fbdd4803f0c09d8d1fc14c2a4b'),
      ('update_receiving_report_draft(uuid,text,text,uuid,timestamp with time zone,text,text)', 'a4b8221ccd860e2d93c3d9216ccb3138')
    ) as expected(signature, digest)
    where to_regprocedure(expected.signature) is null
       or md5(pg_get_functiondef(to_regprocedure(expected.signature))) <> expected.digest
  ) then
    raise exception 'Six-table retirement preflight failed: dependent function definition drifted.'
      using errcode = 'P0001';
  end if;
end;
$retirement_guard$;

-- These four triggers implement only the retired single-item request path.
drop trigger receiving_closes_replenishment on public.receiving_reports;
drop trigger receiving_link_guard on public.receiving_reports;
drop trigger receiving_linked_line_guard on public.receiving_report_items;
drop trigger inventory_open_replenishment_unit_guard on public.inventory_items;

-- Remove legacy-only RPCs and trigger functions. Formal request guards remain.
drop function public.advance_replenishment_request(uuid,text,text);
drop function public.close_replenishment_from_receiving();
drop function public.create_replenishment_request(uuid,uuid,numeric,timestamp with time zone,text,text);
drop function public.get_replenishment_requests();
drop function public.guard_linked_replenishment_line();
drop function public.guard_linked_replenishment_report();
drop function public.guard_open_replenishment_item_unit();
drop function public.start_replenishment_receiving(uuid);

-- Preserve active signatures, grants, security modes and response shapes.
CREATE OR REPLACE FUNCTION public.create_receiving_report_draft(p_request_id uuid, p_source_type text, p_source_reference text, p_purchase_order_id uuid, p_received_at timestamp with time zone, p_supplier_delivery_reference text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_existing public.receiving_reports%rowtype;
  v_report public.receiving_reports%rowtype;
  v_source_reference text := nullif(btrim(p_source_reference), '');
  v_supplier_delivery_reference text := nullif(btrim(p_supplier_delivery_reference), '');
  v_notes text := nullif(btrim(p_notes), '');
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

  if p_source_type <> 'production_team' or p_purchase_order_id is not null
     or v_supplier_delivery_reference is not null then
    raise exception 'Only Production Team receiving without a purchase order is supported.' using errcode = '22023';
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

CREATE OR REPLACE FUNCTION public.enforce_inventory_item_quantity_policy()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  if not public.inventory_quantity_matches_scale(new.quantity_on_hand, new.quantity_scale)
     or not public.inventory_quantity_matches_scale(new.reorder_level, new.quantity_scale)
  then
    raise exception 'Inventory item base quantities exceed quantity_scale %.', new.quantity_scale
      using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and new.quantity_scale is distinct from old.quantity_scale then
    if exists (
      select 1 from public.inventory_batches batch
      where batch.inventory_item_id = new.id
        and (
          not public.inventory_quantity_matches_scale(batch.quantity_initial, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(batch.quantity_on_hand, new.quantity_scale)
        )
    ) or exists (
      select 1 from public.inventory_transactions transaction_record
      where transaction_record.inventory_item_id = new.id
        and (
          not public.inventory_quantity_matches_scale(transaction_record.quantity_change, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(transaction_record.quantity_before, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(transaction_record.quantity_after, new.quantity_scale)
        )
    ) or exists (
      select 1 from public.receiving_report_items report_item
      where report_item.inventory_item_id = new.id
        and (
          not public.inventory_quantity_matches_scale(report_item.quantity_delivered, new.quantity_scale)
          or not public.inventory_quantity_matches_scale(report_item.quantity_accepted, new.quantity_scale)
        )
    ) or exists (
      select 1 from public.menu_ingredients ingredient
      where ingredient.inventory_item_id = new.id
        and not public.inventory_quantity_matches_scale(ingredient.quantity_required, new.quantity_scale)
    ) then
      raise exception 'quantity_scale % conflicts with stored base quantities for this inventory item.', new.quantity_scale
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_inventory_related_quantity_scale()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_inventory_item_id uuid;
  v_quantity_scale smallint;
begin
  if tg_table_name = 'inventory_batches' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'inventory_transactions' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'receiving_report_items' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'menu_ingredients' then
    v_inventory_item_id := new.inventory_item_id;
  elsif tg_table_name = 'inventory_opening_balances' then
    v_inventory_item_id := new.inventory_item_id;
  else
    raise exception 'Unsupported inventory quantity trigger table: %.', tg_table_name;
  end if;

  select inventory_item.quantity_scale
  into v_quantity_scale
  from public.inventory_items inventory_item
  where inventory_item.id = v_inventory_item_id;

  if v_quantity_scale is null then
    raise exception 'Inventory item was not found for quantity validation.' using errcode = '23503';
  end if;

  if tg_table_name = 'inventory_batches' then
    if not public.inventory_quantity_matches_scale(new.quantity_initial, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_on_hand, v_quantity_scale)
    then
      raise exception 'Inventory batch base quantities exceed quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'inventory_transactions' then
    if not public.inventory_quantity_matches_scale(new.quantity_change, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_before, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_after, v_quantity_scale)
    then
      raise exception 'Inventory transaction base quantities exceed quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'receiving_report_items' then
    if not public.inventory_quantity_matches_scale(new.quantity_delivered, v_quantity_scale)
       or not public.inventory_quantity_matches_scale(new.quantity_accepted, v_quantity_scale)
    then
      raise exception 'Receiving base quantities exceed quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'menu_ingredients' then
    if not public.inventory_quantity_matches_scale(new.quantity_required, v_quantity_scale) then
      raise exception 'Recipe base quantity exceeds quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  elsif tg_table_name = 'inventory_opening_balances' then
    if not public.inventory_quantity_matches_scale(new.quantity_total, v_quantity_scale) then
      raise exception 'Opening-balance total exceeds quantity_scale %.', v_quantity_scale
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_receiving_item_shelf_life()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_inventory_item_id uuid;
  v_received_at timestamptz;
  v_expiry_required boolean;
  v_shelf_life_days smallint;
  v_supplied_use_by date;
  v_derived_use_by date;
begin
  v_inventory_item_id := new.inventory_item_id;

  select report.received_at, inventory_item.expiry_required, inventory_item.shelf_life_days
  into v_received_at, v_expiry_required, v_shelf_life_days
  from public.receiving_reports report
  join public.inventory_items inventory_item on inventory_item.id = v_inventory_item_id
  where report.id = new.receiving_report_id;

  if not found then
    raise exception 'Receiving report or inventory item was not found.' using errcode = '23503';
  end if;

  v_supplied_use_by := new.use_by_date;

  if v_shelf_life_days is not null then
    v_derived_use_by := public.derive_inventory_use_by_date(v_received_at, v_shelf_life_days);
    if v_supplied_use_by is not null and v_supplied_use_by <> v_derived_use_by then
      raise exception 'Supplied use-by date conflicts with the inventory shelf-life policy.' using errcode = '22023';
    end if;
    new.use_by_date := v_derived_use_by;
  elsif v_expiry_required then
    if v_supplied_use_by is null then
      raise exception 'Expiry-required inventory must include a use-by date.' using errcode = '22023';
    end if;
    new.use_by_date := v_supplied_use_by;
  end if;

  if new.manufactured_on is not null
     and new.use_by_date is not null
     and new.manufactured_on > new.use_by_date
  then
    raise exception 'Manufactured date cannot be after the use-by date.' using errcode = '22023';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_inventory_request_proposal(p_needed_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
  perform public.inventory_request_manager_required();
  if p_needed_at is null or p_needed_at < now() then
    raise exception 'Future needed time required.' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'name', i.item_name, 'unit', i.unit, 'quantity_scale', i.quantity_scale,
    'reorder_level', i.reorder_level, 'usable_now', public.inventory_usable_quantity(i.id),
    'valid_at_need', case when i.batch_consumption_enabled and i.expiry_required then
      coalesce((select sum(b.quantity_on_hand) from public.inventory_batches b
        where b.inventory_item_id = i.id and b.quantity_on_hand > 0
          and b.use_by_date >= (p_needed_at at time zone 'Asia/Manila')::date), 0)
      else public.inventory_usable_quantity(i.id) end,
    'expiry_verified', i.batch_consumption_enabled and i.expiry_required,
    'outstanding', coalesce((select sum(greatest(l.requested_quantity - coalesce(r.accepted, 0), 0))
      from public.inventory_request_lines l
      join public.inventory_request_documents d on d.id = l.request_id
      left join lateral (
        select sum(ri.quantity_accepted) accepted from public.receiving_reports rr
        join public.receiving_report_items ri on ri.receiving_report_id = rr.id
        where rr.inventory_request_id = d.id and rr.status = 'posted'
          and ri.inventory_item_id = l.inventory_item_id
      ) r on true
      where l.inventory_item_id = i.id and d.status in ('issued', 'partially_received')), 0)

  ) order by i.item_name), '[]'::jsonb) into v_result
  from public.inventory_items i where i.is_active;
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_manager_inventory_movements(p_item_id uuid DEFAULT NULL::uuid, p_type text DEFAULT NULL::text, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, inventory_item_id uuid, item_name text, unit text, transaction_type text, quantity_change numeric, quantity_before numeric, quantity_after numeric, reason text, order_number text, reference_label text, batches jsonb, performed_by_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  if (p_cursor_created_at is null) <> (p_cursor_id is null)
     or (p_from_date is not null and p_to_date is not null
         and p_from_date > p_to_date)
     or (p_type is not null and p_type not in
         ('receiving', 'restock', 'issuance', 'waste', 'adjustment', 'opening_balance'))
  then
    raise exception 'Invalid movement filters.' using errcode = '22023';
  end if;

  return query
  select transaction_record.id, transaction_record.inventory_item_id,
         item.item_name::text, item.unit::text,
         transaction_record.transaction_type::text,
         transaction_record.quantity_change,
         transaction_record.quantity_before,
         transaction_record.quantity_after,
         transaction_record.reason,
         sale_order.order_number::text,
         case
           when sale_order.id is not null then sale_order.order_number::text
           when receiving_report.id is not null then receiving_report.rr_number::text
           when transaction_record.opening_balance_id is not null then 'Opening balance'
           else null::text
         end,
         case
           when transaction_record.inventory_batch_id is not null then
             jsonb_build_array(jsonb_build_object(
               'batch_code', direct_batch.batch_code,
               'quantity', abs(transaction_record.quantity_change)))
           else coalesce(allocations.batches, '[]'::jsonb)
         end,
         coalesce(nullif(btrim(concat_ws(' ', performer.first_name,
           performer.last_name)), ''), 'System')::text,
         transaction_record.created_at
  from public.inventory_transactions transaction_record
  join public.inventory_items item
    on item.id = transaction_record.inventory_item_id
  left join public.orders sale_order
    on sale_order.id = transaction_record.order_id
  left join public.profiles performer
    on performer.id = transaction_record.performed_by
  left join public.inventory_batches direct_batch
    on direct_batch.id = transaction_record.inventory_batch_id
  left join public.receiving_report_items receiving_line
    on receiving_line.id = direct_batch.receiving_report_item_id
  left join public.receiving_reports receiving_report
    on receiving_report.id = receiving_line.receiving_report_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'batch_code', allocated_batch.batch_code,
      'quantity', allocation.quantity
    ) order by allocated_batch.received_at, allocated_batch.id) as batches
    from public.inventory_transaction_batch_allocations allocation
    join public.inventory_batches allocated_batch
      on allocated_batch.id = allocation.inventory_batch_id
    where allocation.inventory_transaction_id = transaction_record.id
  ) allocations on true
  where (p_item_id is null or transaction_record.inventory_item_id = p_item_id)
    and (p_type is null or transaction_record.transaction_type::text = p_type)
    and (p_from_date is null or
      (transaction_record.created_at at time zone 'Asia/Manila')::date >= p_from_date)
    and (p_to_date is null or
      (transaction_record.created_at at time zone 'Asia/Manila')::date <= p_to_date)
    and (p_cursor_created_at is null or
      (transaction_record.created_at, transaction_record.id) <
      (p_cursor_created_at, p_cursor_id))
  order by transaction_record.created_at desc, transaction_record.id desc
  limit v_limit + 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_manager_receiving_documents(p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_source_type text DEFAULT NULL::text, p_from_date date DEFAULT NULL::date, p_to_date date DEFAULT NULL::date, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, rr_number text, source_type text, source_reference text, purchase_order_id uuid, purchase_order_number text, supplier_name text, received_at timestamp with time zone, status text, posted_at timestamp with time zone, line_count bigint, total_delivered numeric, total_accepted numeric, total_rejected numeric, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;
  if coalesce(p_offset, 0) < 0
     or char_length(coalesce(p_search, '')) > 100
     or (p_status is not null and p_status not in ('draft', 'posted'))
     or (p_source_type is not null and p_source_type not in
         ('production_team', 'direct_supplier'))
     or (p_from_date is not null and p_to_date is not null
         and p_from_date > p_to_date)
  then
    raise exception 'Invalid receiving filters.' using errcode = '22023';
  end if;

  return query
  select report.id, report.rr_number::text, report.source_type::text,
         report.source_reference::text, report.purchase_order_id,
         null::text, null::text,
         report.received_at, report.status::text, report.posted_at,
         (select count(*) from public.receiving_report_items line
          where line.receiving_report_id = report.id),
         coalesce((select sum(line.quantity_delivered)
           from public.receiving_report_items line
           where line.receiving_report_id = report.id), 0),
         coalesce((select sum(line.quantity_accepted)
           from public.receiving_report_items line
           where line.receiving_report_id = report.id), 0),
         coalesce((select sum(line.quantity_rejected)
           from public.receiving_report_items line
           where line.receiving_report_id = report.id), 0),
         report.updated_at
  from public.receiving_reports report
  where (p_search is null or btrim(p_search) = '' or
    report.rr_number ilike '%' || btrim(p_search) || '%' or
    coalesce(report.source_reference, '') ilike '%' || btrim(p_search) || '%' or
    false)
    and (p_status is null or report.status::text = p_status)
    and (p_source_type is null or report.source_type::text = p_source_type)
    and (p_from_date is null or
      (report.received_at at time zone 'Asia/Manila')::date >= p_from_date)
    and (p_to_date is null or
      (report.received_at at time zone 'Asia/Manila')::date <= p_to_date)
  order by (report.status = 'draft') desc,
           report.received_at desc, report.id desc
  limit v_limit + 1 offset coalesce(p_offset, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_manager_receiving_workspace(p_receiving_report_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
      'purchase_order_number', null,
      'supplier_id', null,
      'supplier_name', null,
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
            'quantity_ordered', null,
            'quantity_received', null,
            'quantity_cancelled', null,
            'quantity_remaining', null,
            'secondary_quantity_ordered', null,
            'secondary_quantity_received', null,
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
        join public.inventory_items inventory_item
          on inventory_item.id = report_item.inventory_item_id
        left join public.inventory_batches batch
          on batch.receiving_report_item_id = report_item.id
        where report_item.receiving_report_id = report.id
      ), '[]'::jsonb)
    )
    into v_selected_report
    from public.receiving_reports report
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
            'purchase_order_number', null,
            'supplier_name', null,
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
    'purchase_orders', '[]'::jsonb
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.post_receiving_report(p_receiving_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid;
  v_report public.receiving_reports%rowtype;
  v_line record;
  v_inventory_lock record;
  v_line_count integer := 0;
  v_batch_count integer := 0;
  v_transaction_count integer := 0;
  v_total_accepted numeric := 0;
  v_quantity_before numeric;
  v_quantity_after numeric;
  v_batch_id uuid;
  v_posted_at timestamptz := now();
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

  if v_report.source_type <> 'production_team'
     or v_report.purchase_order_id is not null
     or v_report.supplier_delivery_reference is not null then
    raise exception 'Only Production Team receiving without a purchase order is supported.' using errcode = '22023';
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

  -- Lock inventory items in stable UUID order.
  for v_inventory_lock in
    select inventory_item.id
    from public.inventory_items inventory_item
    where inventory_item.id in (
      select report_item.inventory_item_id
      from public.receiving_report_items report_item
      where report_item.receiving_report_id = v_report.id
    )
    order by inventory_item.id
    for update
  loop
    null;
  end loop;

  -- Validate every line before the first balance, batch, ledger, or PO update.
  for v_line in
    select report_item.*, inventory_item.id as resolved_inventory_item_id,
      inventory_item.item_name, inventory_item.unit, inventory_item.secondary_unit,
      inventory_item.is_active as inventory_item_is_active,
      inventory_item.expiry_required, inventory_item.quantity_on_hand as item_quantity_on_hand,
      report_item.use_by_date as effective_use_by_date
    from public.receiving_report_items report_item
    left join public.inventory_items inventory_item
      on inventory_item.id = report_item.inventory_item_id
    where report_item.receiving_report_id = v_report.id
    order by report_item.id
  loop
    if v_line.inventory_item_id is null or v_line.purchase_order_item_id is not null then
      raise exception 'Production Team receiving lines require inventory_item_id and cannot reference a PO item.' using errcode = '22023';
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
    select report_item.*, inventory_item.id as resolved_inventory_item_id,
      inventory_item.quantity_on_hand as item_quantity_on_hand,
      report_item.use_by_date as effective_use_by_date
    from public.receiving_report_items report_item
    join public.inventory_items inventory_item
      on inventory_item.id = report_item.inventory_item_id
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
        null,
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

  end loop;

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

CREATE OR REPLACE FUNCTION public.refresh_receiving_item_shelf_life()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
begin
  if new.received_at is distinct from old.received_at and new.status = 'draft' then
    update public.receiving_report_items report_item
    set use_by_date = public.derive_inventory_use_by_date(new.received_at, inventory_item.shelf_life_days)
    from public.inventory_items inventory_item
    where report_item.receiving_report_id = new.id
      and inventory_item.id = report_item.inventory_item_id
      and inventory_item.shelf_life_days is not null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_receiving_report_item(p_receiving_report_id uuid, p_receiving_report_item_id uuid, p_inventory_item_id uuid, p_purchase_order_item_id uuid, p_quantity_delivered numeric, p_quantity_accepted numeric, p_secondary_quantity_delivered numeric, p_secondary_quantity_accepted numeric, p_rejection_reason text, p_source_lot_code text, p_manufactured_on date, p_use_by_date date, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_existing public.receiving_report_items%rowtype;
  v_item_id uuid;
  v_item_name text;
  v_secondary_unit text;
  v_quantity_scale smallint;
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

  if v_report.source_type <> 'production_team' or p_purchase_order_item_id is not null
     or p_inventory_item_id is null then
    raise exception 'Production Team lines require an inventory item and cannot reference a PO item.' using errcode = '22023';
  end if;

  select inventory_item.id, inventory_item.item_name,
         inventory_item.secondary_unit, inventory_item.quantity_scale
  into v_item_id, v_item_name, v_secondary_unit, v_quantity_scale
  from public.inventory_items inventory_item
  where inventory_item.id = p_inventory_item_id and inventory_item.is_active = true;

  if v_item_id is null then
    raise exception 'Receiving line inventory item was not found or is inactive.' using errcode = 'P0002';
  end if;

  if not public.inventory_quantity_matches_scale(p_quantity_delivered, v_quantity_scale)
     or not public.inventory_quantity_matches_scale(p_quantity_accepted, v_quantity_scale)
  then
    raise exception 'Receiving base quantities exceed quantity_scale %.', v_quantity_scale using errcode = '22023';
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
  ) values (
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
    'use_by_date', v_saved.use_by_date,
    'updated_at', v_saved.updated_at
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_receiving_report_draft(p_receiving_report_id uuid, p_source_type text, p_source_reference text, p_purchase_order_id uuid, p_received_at timestamp with time zone, p_supplier_delivery_reference text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_report public.receiving_reports%rowtype;
  v_source_reference text := nullif(btrim(p_source_reference), '');
  v_supplier_delivery_reference text := nullif(btrim(p_supplier_delivery_reference), '');
  v_notes text := nullif(btrim(p_notes), '');
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

  if p_source_type <> 'production_team' or p_purchase_order_id is not null
     or v_supplier_delivery_reference is not null then
    raise exception 'Only Production Team receiving without a purchase order is supported.' using errcode = '22023';
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

-- The old columns remain nullable for a stable read contract and to make
-- accidental reuse fail explicitly after the foreign keys are retired.
alter table public.receiving_reports
  drop constraint receiving_reports_purchase_order_id_fkey,
  drop constraint receiving_reports_replenishment_request_id_fkey,
  add constraint receiving_reports_retired_links_null_chk
    check (purchase_order_id is null and replenishment_request_id is null
      and source_type = 'production_team');
alter table public.receiving_report_items
  drop constraint receiving_report_items_purchase_order_item_id_fkey,
  add constraint receiving_report_items_retired_po_link_null_chk
    check (purchase_order_item_id is null);
alter table public.inventory_transactions
  drop constraint inventory_transactions_purchase_order_item_id_fkey,
  add constraint inventory_transactions_retired_po_link_null_chk
    check (purchase_order_item_id is null);

drop table public.production_replenishment_status_events;
drop table public.production_replenishment_requests;
drop table public.supplier_items;
drop table public.purchase_order_items;
drop table public.purchase_orders;
drop table public.suppliers;
drop function public.guard_production_replenishment_request();

do $retirement_verify$
begin
  if (select count(*) from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r') <> 30
    or exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
      and pg_get_functiondef(p.oid) ~* 'public\.(production_replenishment_requests|production_replenishment_status_events|suppliers|supplier_items|purchase_orders|purchase_order_items)')
  then
    raise exception 'Six-table retirement postcondition failed: public tables %, referring functions %',
      (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'),
      (select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
       from pg_proc p where p.pronamespace = 'public'::regnamespace
         and pg_get_functiondef(p.oid) ~* 'public\.(production_replenishment_requests|production_replenishment_status_events|suppliers|supplier_items|purchase_orders|purchase_order_items)')
      using errcode = 'P0001';
  end if;
end;
$retirement_verify$;
commit;

