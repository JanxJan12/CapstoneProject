-- Keep the existing three SELECT grants and predicates. The JWT subject is
-- constant for a statement, so an initPlan can evaluate it once per query.
alter policy customers_select_own_orders on public.orders
  using (customer_id = (select auth.uid()));

alter policy staff_select_orders on public.orders
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
        and p.role = any (array['cashier'::public.user_role, 'manager'::public.user_role])
    )
  );

alter policy rider_select_assigned_orders on public.orders
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
        and p.role = 'rider'::public.user_role
    )
    and exists (
      select 1 from public.delivery_assignments da
      where da.order_id = orders.id
        and da.rider_id = (select auth.uid())
        and da.status = any (array[
          'offered'::public.delivery_assignment_status,
          'accepted'::public.delivery_assignment_status,
          'picked_up'::public.delivery_assignment_status,
          'out_for_delivery'::public.delivery_assignment_status,
          'delivered'::public.delivery_assignment_status
        ])
    )
  );
