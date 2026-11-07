begin;

-- Phase 6B.9: Manager-only read surfaces. No business rows or mutation
-- authorities are changed by this migration.

create function public.get_manager_inventory_stock_summary()
returns table (
  id uuid,
  item_name text,
  inventory_category text,
  unit text,
  physical_quantity numeric,
  usable_quantity numeric,
  expired_quantity numeric,
  reorder_level numeric,
  is_active boolean,
  batch_consumption_enabled boolean,
  expiry_required boolean,
  rotation_policy text,
  nearest_use_by date,
  updated_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  return query
  select item.id, item.item_name::text, item.inventory_category::text,
         item.unit::text, item.quantity_on_hand,
         public.inventory_usable_quantity(item.id),
         case when item.batch_consumption_enabled and item.expiry_required
           then coalesce(batch_stock.expired_quantity, 0)
           else 0::numeric end,
         item.reorder_level, item.is_active,
         item.batch_consumption_enabled, item.expiry_required,
         item.rotation_policy::text,
         case when item.batch_consumption_enabled and item.expiry_required
           then batch_stock.nearest_use_by else null::date end,
         item.updated_at
  from public.inventory_items item
  left join lateral (
    select
      coalesce(sum(batch.quantity_on_hand) filter (
        where batch.use_by_date <
          (current_timestamp at time zone 'Asia/Manila')::date
      ), 0) as expired_quantity,
      min(batch.use_by_date) filter (
        where batch.quantity_on_hand > 0
          and batch.use_by_date >=
            (current_timestamp at time zone 'Asia/Manila')::date
      ) as nearest_use_by
    from public.inventory_batches batch
    where batch.inventory_item_id = item.id
      and batch.quantity_on_hand > 0
      and item.batch_consumption_enabled
      and item.expiry_required
  ) batch_stock on true
  order by item.is_active desc, item.inventory_category nulls last,
           item.item_name, item.id;
end;
$function$;

revoke all on function public.get_manager_inventory_stock_summary()
  from public, anon;
grant execute on function public.get_manager_inventory_stock_summary()
  to authenticated, service_role;

create function public.get_manager_inventory_item_detail(p_item_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
declare
  v_stock jsonb;
  v_batches jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.' using errcode = '42501';
  end if;

  select to_jsonb(stock) into v_stock
  from public.get_manager_inventory_stock_summary() stock
  where stock.id = p_item_id;
  if v_stock is null then
    raise exception 'Inventory item not found.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', batch.id,
    'batch_code', batch.batch_code,
    'quantity_on_hand', batch.quantity_on_hand,
    'received_at', batch.received_at,
    'use_by_date', batch.use_by_date,
    'status', case
      when item.expiry_required and batch.use_by_date <
        (current_timestamp at time zone 'Asia/Manila')::date
      then 'expired' else 'current' end
  ) order by
    case when item.rotation_policy::text = 'fefo'
      then batch.use_by_date end asc nulls last,
    batch.received_at, batch.id), '[]'::jsonb)
  into v_batches
  from public.inventory_batches batch
  join public.inventory_items item on item.id = batch.inventory_item_id
  where batch.inventory_item_id = p_item_id
    and item.batch_consumption_enabled
    and batch.quantity_on_hand > 0;

  return jsonb_build_object('stock', v_stock, 'batches', v_batches);
end;
$function$;

revoke all on function public.get_manager_inventory_item_detail(uuid)
  from public, anon;
grant execute on function public.get_manager_inventory_item_detail(uuid)
  to authenticated, service_role;

create function public.get_manager_inventory_movements(
  p_item_id uuid default null,
  p_type text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  inventory_item_id uuid,
  item_name text,
  unit text,
  transaction_type text,
  quantity_change numeric,
  quantity_before numeric,
  quantity_after numeric,
  reason text,
  order_number text,
  reference_label text,
  batches jsonb,
  performed_by_name text,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $function$
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
           when purchase_order.id is not null then purchase_order.po_number::text
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
  left join public.purchase_order_items purchase_line
    on purchase_line.id = transaction_record.purchase_order_item_id
  left join public.purchase_orders purchase_order
    on purchase_order.id = purchase_line.purchase_order_id
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

revoke all on function public.get_manager_inventory_movements(
  uuid, text, date, date, timestamptz, uuid, integer
) from public, anon;
grant execute on function public.get_manager_inventory_movements(
  uuid, text, date, date, timestamptz, uuid, integer
) to authenticated, service_role;

create function public.get_manager_receiving_documents(
  p_search text default null,
  p_status text default null,
  p_source_type text default null,
  p_from_date date default null,
  p_to_date date default null,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  rr_number text,
  source_type text,
  source_reference text,
  purchase_order_id uuid,
  purchase_order_number text,
  supplier_name text,
  received_at timestamptz,
  status text,
  posted_at timestamptz,
  line_count bigint,
  total_delivered numeric,
  total_accepted numeric,
  total_rejected numeric,
  updated_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $function$
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
         purchase_order.po_number::text, supplier.name::text,
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
  left join public.purchase_orders purchase_order
    on purchase_order.id = report.purchase_order_id
  left join public.suppliers supplier
    on supplier.id = purchase_order.supplier_id
  where (p_search is null or btrim(p_search) = '' or
    report.rr_number ilike '%' || btrim(p_search) || '%' or
    coalesce(report.source_reference, '') ilike '%' || btrim(p_search) || '%' or
    coalesce(purchase_order.po_number, '') ilike '%' || btrim(p_search) || '%' or
    coalesce(supplier.name, '') ilike '%' || btrim(p_search) || '%')
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

revoke all on function public.get_manager_receiving_documents(
  text, text, text, date, date, integer, integer
) from public, anon;
grant execute on function public.get_manager_receiving_documents(
  text, text, text, date, date, integer, integer
) to authenticated, service_role;

create index if not exists inventory_transactions_movement_page_idx
  on public.inventory_transactions (created_at desc, id desc);
create index if not exists inventory_transactions_item_movement_page_idx
  on public.inventory_transactions (inventory_item_id, created_at desc, id desc);

commit;
