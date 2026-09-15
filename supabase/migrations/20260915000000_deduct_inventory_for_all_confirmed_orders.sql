begin;

create or replace function public.deduct_inventory_on_confirmed_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.deduct_inventory_for_confirmed_order(
    new.order_id
  );

  return new;
end;
$$;

revoke execute
on function public.deduct_inventory_on_confirmed_history()
from public, anon, authenticated;

grant execute
on function public.deduct_inventory_on_confirmed_history()
to service_role;

commit;