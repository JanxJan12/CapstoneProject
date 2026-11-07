-- Disposable PostgreSQL fixture only. Apply before the prepared migration.
create role authenticated;
create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create type public.user_role as enum ('cashier', 'manager');
create type public.cashier_transaction_status as enum ('completed', 'voided');
create type public.payment_method as enum ('cash', 'gcash');
create table public.profiles (id uuid primary key, role public.user_role, is_active boolean);
create table public.cashier_shifts (id uuid primary key, cashier_id uuid, terminal text, opening_cash numeric, started_at timestamptz, ended_at timestamptz, status text);
create table public.orders (id uuid primary key, order_number text, customer_name text, grand_total numeric,
  discount_amount numeric, subtotal numeric, delivery_fee numeric, tax_amount numeric);
create table public.payments (id uuid primary key, payment_method public.payment_method, gcash_reference_number text);
create table public.cashier_transactions (id uuid primary key, transaction_number text, receipt_number text,
  order_id uuid, payment_id uuid, shift_id uuid, cashier_id uuid, status public.cashier_transaction_status,
  void_reason text, created_at timestamptz);
insert into public.profiles values
  ('00000000-0000-0000-0000-000000000001','cashier',true),
  ('00000000-0000-0000-0000-000000000002','cashier',true),
  ('00000000-0000-0000-0000-000000000003','cashier',false);
insert into public.cashier_shifts values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Counter 1',0,'2026-10-01', '2026-10-01 08:00Z','closed'),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Counter 2',0,'2026-10-01',null,'open');
insert into public.orders values
  ('20000000-0000-0000-0000-000000000001','ORD-1','Alice',150,10,120,30,10),
  ('20000000-0000-0000-0000-000000000002','ORD-2','Bob',75,0,75,0,0),
  ('20000000-0000-0000-0000-000000000003','ORD-3','Other cashier',99,0,99,0,0);
insert into public.payments values
  ('30000000-0000-0000-0000-000000000001','gcash','REF-1'),
  ('30000000-0000-0000-0000-000000000002','cash',null),
  ('30000000-0000-0000-0000-000000000003','cash',null);
insert into public.cashier_transactions values
  ('40000000-0000-0000-0000-000000000001','TXN-1','RCP-1','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','completed',null,'2026-10-01 07:00Z'),
  ('40000000-0000-0000-0000-000000000002','TXN-2','RCP-2','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','voided','Manager cancellation','2026-10-01 07:10Z'),
  ('40000000-0000-0000-0000-000000000003','TXN-3','RCP-3','20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','completed',null,'2026-10-01 07:20Z');
grant usage on schema public, auth to authenticated, anon;
