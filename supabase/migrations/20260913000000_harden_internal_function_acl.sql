begin;

-- Internal inventory mutation helper.
-- It must never be callable directly by browser roles.
revoke execute
on function public.deduct_inventory_for_confirmed_order(uuid)
from public, anon, authenticated;

-- Explicitly preserve trusted server-side access.
grant execute
on function public.deduct_inventory_for_confirmed_order(uuid)
to service_role;

commit;