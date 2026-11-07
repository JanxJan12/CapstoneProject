-- Expect psql ON_ERROR_STOP exit 1 on a fresh disposable current-schema copy.
-- The outer transaction rolls back the fixture and any attempted DDL on exit.
begin;
insert into auth.users(id) values ('b0020000-0000-4000-8000-000000000001');
insert into public.profiles(id,first_name,role,is_active) values
  ('b0020000-0000-4000-8000-000000000001','Cashier','cashier',true);
insert into public.cashier_shifts(cashier_id,terminal,opening_cash,manager_approved_by)
values ('b0020000-0000-4000-8000-000000000001','Guard',0,'b0020000-0000-4000-8000-000000000001');
\i /tmp/cashier_retire_shift_approval.sql
