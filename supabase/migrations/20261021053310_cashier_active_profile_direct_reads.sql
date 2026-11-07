-- Restrict direct financial reads using the current profile, not a stale JWT.
-- Replace the existing permissive policies: another permissive policy would OR
-- with the older owner rule and leave deactivated Cashiers authorized.
begin;

drop policy if exists cashier_shifts_select_staff on public.cashier_shifts;
create policy cashier_shifts_select_staff on public.cashier_shifts
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
        and (
          (p.role = 'cashier'::public.user_role and cashier_shifts.cashier_id = p.id)
          or p.role = 'manager'::public.user_role
        )
    )
  );

drop policy if exists cashier_transactions_select_staff on public.cashier_transactions;
create policy cashier_transactions_select_staff on public.cashier_transactions
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active = true
        and (
          (p.role = 'cashier'::public.user_role and cashier_transactions.cashier_id = p.id)
          or p.role = 'manager'::public.user_role
        )
    )
  );

commit;
