begin;

-- ============================================================
-- Future application functions created by postgres should NOT
-- automatically become callable by browser roles.
--
-- Application RPC migrations must explicitly GRANT the role
-- that is supposed to invoke them.
-- ============================================================

alter default privileges
for role postgres
in schema public
revoke execute on functions
from public, anon, authenticated;


-- ============================================================
-- INTERNAL INVENTORY FUNCTIONS
-- These must never be directly callable by browser roles.
-- ============================================================

revoke execute
on function public.deduct_inventory_for_confirmed_order(uuid)
from public, anon, authenticated;

grant execute
on function public.deduct_inventory_for_confirmed_order(uuid)
to service_role;


revoke execute
on function public.deduct_inventory_on_confirmed_history()
from public, anon, authenticated;

grant execute
on function public.deduct_inventory_on_confirmed_history()
to service_role;


-- ============================================================
-- AUTH TRIGGER FUNCTIONS
-- Trigger infrastructure only; browser users should not invoke
-- these directly.
-- ============================================================

revoke execute
on function public.handle_new_auth_user()
from public, anon, authenticated;

revoke execute
on function public.handle_new_user()
from public, anon, authenticated;


-- ============================================================
-- AUTHENTICATED-ONLY APPLICATION RPCs
--
-- Their function bodies already enforce role/account checks.
-- This removes the unnecessary anonymous entry point while
-- preserving authenticated and service_role execution.
-- ============================================================

revoke execute
on function public.adjust_inventory_stock(uuid, numeric, text)
from public, anon;

revoke execute
on function public.receive_inventory_stock(uuid, numeric, text)
from public, anon;


revoke execute
on function public.get_cashier_online_payments()
from public, anon;

revoke execute
on function public.get_cashier_sale(uuid)
from public, anon;

revoke execute
on function public.get_current_shift_cashier_sales()
from public, anon;

revoke execute
on function public.get_current_shift_walk_in_sales()
from public, anon;

revoke execute
on function public.get_open_cashier_shift()
from public, anon;


revoke execute
on function public.get_customer_order_payment(uuid)
from public, anon;

revoke execute
on function public.submit_customer_payment(uuid, text, text)
from public, anon;


revoke execute
on function public.reject_customer_gcash_payment(uuid, text, text)
from public, anon;

revoke execute
on function public.verify_customer_gcash_payment(uuid, uuid)
from public, anon;


revoke execute
on function public.update_cashier_order_operational_details(
  uuid,
  text,
  text,
  text,
  text,
  text
)
from public, anon;


revoke execute
on function public.get_manager_customers()
from public, anon;

revoke execute
on function public.get_manager_dashboard()
from public, anon;

revoke execute
on function public.get_manager_inventory_transactions(integer)
from public, anon;

revoke execute
on function public.get_manager_inventory()
from public, anon;

revoke execute
on function public.get_manager_menu_items()
from public, anon;

revoke execute
on function public.get_manager_orders(integer)
from public, anon;

revoke execute
on function public.get_manager_riders()
from public, anon;

revoke execute
on function public.get_manager_sales_report(date, date)
from public, anon;

revoke execute
on function public.set_manager_menu_item_availability(uuid, boolean)
from public, anon;

commit;