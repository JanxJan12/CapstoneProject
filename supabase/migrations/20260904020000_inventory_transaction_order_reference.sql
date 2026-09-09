-- RRJ'S FOOD-HOUSE
-- Inventory transaction order references for Manager history.

drop function public.get_manager_inventory_transactions(integer);

create function public.get_manager_inventory_transactions(
  p_limit integer default 100
)
returns table (
  id uuid,
  inventory_item_id uuid,
  item_name text,
  unit text,
  transaction_type public.inventory_transaction_type,
  quantity_change numeric,
  quantity_before numeric,
  quantity_after numeric,
  reason text,
  order_id uuid,
  order_number text,
  performed_by uuid,
  performed_by_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
      and p.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 100), 500));

  return query
  select
    t.id,
    t.inventory_item_id,
    i.item_name::text,
    i.unit::text,
    t.transaction_type,
    t.quantity_change,
    t.quantity_before,
    t.quantity_after,
    t.reason,
    t.order_id,
    o.order_number::text,
    t.performed_by,
    coalesce(
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(p.first_name), ''),
            nullif(btrim(p.last_name), '')
          )
        ),
        ''
      ),
      'System'
    )::text as performed_by_name,
    t.created_at
  from public.inventory_transactions t
  join public.inventory_items i
    on i.id = t.inventory_item_id
  left join public.orders o
    on o.id = t.order_id
  left join public.profiles p
    on p.id = t.performed_by
  order by t.created_at desc, t.id desc
  limit v_limit;
end;
$$;

revoke all on function public.get_manager_inventory_transactions(integer)
from public;

grant execute on function public.get_manager_inventory_transactions(integer)
to authenticated, service_role;
