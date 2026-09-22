-- Keep browser/API roles at the narrow table privileges used by the application.
-- Business mutations on these tables are performed by SECURITY DEFINER RPCs.
-- The only repository-backed direct write is an authenticated customer updating
-- their own profiles.contact_number through the existing RLS policy.

revoke truncate, trigger, references, maintain on table
  public.delivery_assignments,
  public.inventory_items,
  public.inventory_transactions,
  public.menu_categories,
  public.menu_ingredients,
  public.menu_items,
  public.order_items,
  public.order_status_history,
  public.orders,
  public.payments,
  public.profiles,
  public.purchase_order_items,
  public.purchase_orders,
  public.supplier_items,
  public.suppliers
from anon, authenticated;

revoke insert, update, delete on table
  public.delivery_assignments,
  public.inventory_items,
  public.inventory_transactions,
  public.menu_categories,
  public.menu_ingredients,
  public.menu_items,
  public.order_items,
  public.order_status_history,
  public.orders,
  public.payments,
  public.profiles,
  public.purchase_order_items,
  public.purchase_orders,
  public.supplier_items,
  public.suppliers
from anon, authenticated;

-- Prevent new public tables (including later supply-chain tables) created by
-- postgres from inheriting browser-role privileges. Existing table SELECT grants
-- stay unchanged; future tables must grant application access explicitly.
alter default privileges
for role postgres
in schema public
revoke all on tables
from anon, authenticated;

-- No checked-in client updates these name columns directly. Keep only the
-- contact-number write used by the customer account screen.
revoke update (first_name, last_name)
on table public.profiles
from authenticated;

grant update (contact_number)
on table public.profiles
to authenticated;
