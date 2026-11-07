-- Cashiers can read the latest assignment state for delivery orders they can
-- already manage, without gaining direct SELECT on delivery_assignments.
create or replace function public.get_cashier_delivery_assignment_statuses(
  p_order_ids uuid[]
)
returns table (
  order_id uuid,
  assignment_id uuid,
  assignment_status public.delivery_assignment_status,
  assigned_at timestamptz,
  assignment_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception 'Only an active cashier may read delivery assignments.'
      using errcode = '42501';
  end if;

  if p_order_ids is null or cardinality(p_order_ids) > 200 then
    raise exception 'Provide at most 200 order IDs.'
      using errcode = '22023';
  end if;

  return query
  select
    o.id,
    latest.id,
    latest.status,
    latest.assigned_at,
    latest.updated_at
  from public.orders o
  join lateral (
    select da.id, da.status, da.assigned_at, da.updated_at
    from public.delivery_assignments da
    where da.order_id = o.id
    order by da.assigned_at desc, da.id desc
    limit 1
  ) latest on true
  where o.id = any (p_order_ids)
    and o.fulfillment_type = 'delivery'::public.fulfillment_type;
end;
$function$;

revoke all on function public.get_cashier_delivery_assignment_statuses(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_cashier_delivery_assignment_statuses(uuid[])
  to authenticated;
