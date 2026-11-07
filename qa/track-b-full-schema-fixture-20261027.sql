-- Disposable database only. Load after the read-only deployed schema export.
-- All identifiers and financial references here are synthetic.
begin;
insert into auth.users (id, aud, role, email)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'track-b-manager@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'track-b-rider@example.invalid'),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'track-b-cashier@example.invalid');
update public.profiles set role='manager', is_active=true where id='10000000-0000-0000-0000-000000000001';
update public.profiles set role='rider', is_active=true where id='10000000-0000-0000-0000-000000000002';
update public.profiles set role='cashier', is_active=true where id='10000000-0000-0000-0000-000000000003';
insert into public.riders (id, approval_status, availability_status)
values ('10000000-0000-0000-0000-000000000002', 'approved', 'on_delivery');
insert into public.orders
  (id, order_number, order_channel, fulfillment_type, delivery_address,
   current_status, subtotal, delivery_fee, grand_total)
values
  ('20000000-0000-0000-0000-000000000001', 'TRACK-B-FULL-SCHEMA',
   'online', 'delivery', 'Synthetic address', 'rider_accepted', 16, 0, 16);
insert into public.delivery_assignments (id, order_id, rider_id, status, accepted_at)
values
  ('30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002', 'accepted', now());
insert into public.payments
  (id, order_id, payment_method, amount, status, cash_received, verified_by, verified_at)
values
  ('40000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'cash', 16, 'verified', 16,
   '10000000-0000-0000-0000-000000000003', now());
insert into public.cashier_shifts (id, cashier_id, terminal, opening_cash)
values
  ('60000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003', 'TRACK-B-LOCAL', 0);
insert into public.cashier_transactions
  (id, transaction_number, receipt_number, order_id, payment_id, shift_id,
   cashier_id, request_id, status)
values
  ('50000000-0000-0000-0000-000000000001',
   'TRACK-B-TX-1', 'TRACK-B-RECEIPT-1',
   '20000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003',
   '70000000-0000-0000-0000-000000000001', 'completed');
commit;
