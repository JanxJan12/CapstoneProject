\set ON_ERROR_STOP on
begin;

-- Synthetic identities and records exist only inside this rolled-back transaction.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2'),
  ('00000000-0000-4000-8000-0000000000c3');
update public.profiles set role = 'cashier' where id in
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2');
update public.profiles set role = 'manager' where id = '00000000-0000-4000-8000-0000000000c3';

insert into public.cashier_shifts
  (id, cashier_id, terminal, opening_cash, status, ended_at, actual_cash, expected_cash, variance, closed_by)
values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'recon04-closed', 1000, 'closed', now(), 1000, 1000, 0, '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a1', 'recon04-open-a', 1000, 'open', null, null, null, null, null),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000b2', 'recon04-open-b', 1000, 'open', null, null, null, null, null);

insert into public.orders (id, order_number, order_channel, fulfillment_type, current_status, subtotal, grand_total)
values
  ('00000000-0000-4000-8000-000000000001', 'RECON04-HIST', 'walk_in', 'dine_in', 'ready', 120, 120),
  ('00000000-0000-4000-8000-000000000002', 'RECON04-CURRENT', 'walk_in', 'dine_in', 'ready', 45, 45),
  ('00000000-0000-4000-8000-000000000003', 'RECON04-OTHER', 'walk_in', 'takeout', 'ready', 35, 35),
  ('00000000-0000-4000-8000-000000000004', 'RECON04-MISSING', 'walk_in', 'dine_in', 'confirmed', 40, 40),
  ('00000000-0000-4000-8000-000000000005', 'RECON04-VOID', 'walk_in', 'dine_in', 'cancelled', 50, 50),
  ('00000000-0000-4000-8000-000000000006', 'RECON04-MISMATCH', 'walk_in', 'dine_in', 'ready', 60, 60),
  ('00000000-0000-4000-8000-000000000007', 'RECON04-CONFLICT', 'walk_in', 'dine_in', 'ready', 70, 70),
  ('00000000-0000-4000-8000-000000000008', 'RECON04-PENDING', 'online', 'takeout', 'waiting_payment_verification', 80, 80),
  ('00000000-0000-4000-8000-000000000009', 'RECON04-REJECTED', 'online', 'takeout', 'rejected', 90, 90);

insert into public.payments (id, order_id, payment_method, amount, status, cash_received, gcash_reference_number)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'cash', 120, 'verified', 120, null),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000002', 'cash', 45, 'verified', 45, null),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000003', 'cash', 35, 'verified', 35, null),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000005', 'cash', 50, 'voided', 50, null),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000006', 'cash', 55, 'verified', 55, null),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000007', 'cash', 70, 'verified', 70, null),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000008', 'gcash', 80, 'pending', null, 'RECON04-PENDING'),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000009', 'gcash', 90, 'rejected', null, 'RECON04-REJECTED');

insert into public.cashier_transactions
  (id, receipt_number, order_id, payment_id, shift_id, cashier_id, status, request_id, void_reason, voided_at)
values
  ('00000000-0000-4000-8000-000000000201', 'RECON04-R01', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'completed', '00000000-0000-4000-8000-000000000301', null, null),
  ('00000000-0000-4000-8000-000000000202', 'RECON04-R02', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a1', 'completed', '00000000-0000-4000-8000-000000000302', null, null),
  ('00000000-0000-4000-8000-000000000203', 'RECON04-R03', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000b2', 'completed', '00000000-0000-4000-8000-000000000303', null, null),
  ('00000000-0000-4000-8000-000000000205', 'RECON04-R05', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'voided', '00000000-0000-4000-8000-000000000305', 'Synthetic reversal', now()),
  ('00000000-0000-4000-8000-000000000206', 'RECON04-R06', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'completed', '00000000-0000-4000-8000-000000000306', null, null),
  ('00000000-0000-4000-8000-000000000207', 'RECON04-R07', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'voided', '00000000-0000-4000-8000-000000000307', 'Synthetic conflict', now());

select 'fixture counts', (select count(*) from public.orders), (select count(*) from public.payments), (select count(*) from public.cashier_transactions);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';
select 'cashier A', order_id, payment_method, payment_status
from public.get_cashier_order_payment_summaries(array[
 '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
 '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
 '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006',
 '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008',
 '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001']::uuid[])
order by order_id;
do $$
declare v_rows jsonb;
begin
  select jsonb_object_agg(right(order_id::text, 3), coalesce(payment_method::text || ':' || payment_status::text, 'unresolved'))
  into v_rows
  from public.get_cashier_order_payment_summaries(array[
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001']::uuid[]);
  if v_rows <> '{"001":"cash:verified","002":"cash:verified","005":"cash:voided","006":"unresolved","007":"unresolved"}'::jsonb then
    raise exception 'Cashier A results differ: %', v_rows;
  end if;
  raise notice 'PASS cashier A financial and mixed-ownership matrix';
end $$;
select 'direct payment rows', count(*) from public.payments;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000b2';
select 'cashier B', order_id, payment_method, payment_status
from public.get_cashier_order_payment_summaries(array[
 '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003']::uuid[]);
do $$ declare v_ids uuid[]; begin
  select array_agg(order_id) into v_ids from public.get_cashier_order_payment_summaries(array[
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003']::uuid[]);
  if v_ids <> array['00000000-0000-4000-8000-000000000003']::uuid[] then
    raise exception 'Cashier B ownership failure: %', v_ids;
  end if;
  raise notice 'PASS cashier B ownership isolation';
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000c3';
do $$ begin
  perform * from public.get_cashier_order_payment_summaries(array['00000000-0000-4000-8000-000000000001']::uuid[]);
  raise exception 'Manager unexpectedly authorized';
exception when insufficient_privilege then raise notice 'PASS manager denied';
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  perform * from public.get_cashier_order_payment_summaries(array[]::uuid[]);
  raise exception 'Empty batch unexpectedly accepted';
exception when invalid_parameter_value then raise notice 'PASS empty batch denied';
end $$;
do $$ begin
  perform * from public.get_cashier_order_payment_summaries(array[null]::uuid[]);
  raise exception 'Null order ID unexpectedly accepted';
exception when invalid_parameter_value then raise notice 'PASS null ID denied';
end $$;
do $$ begin
  perform * from public.get_cashier_order_payment_summaries(array_fill('00000000-0000-4000-8000-000000000001'::uuid, array[101]));
  raise exception 'Oversized batch unexpectedly accepted';
exception when invalid_parameter_value then raise notice 'PASS oversized batch denied';
end $$;
do $$ begin
  perform * from public.get_cashier_order_payment_summaries(array['not-a-uuid']::uuid[]);
  raise exception 'Malformed UUID unexpectedly accepted';
exception when invalid_text_representation then raise notice 'PASS malformed UUID denied by type';
end $$;
-- A caller-controlled cashier claim does not override the trusted subject ID.
set local request.jwt.claim.cashier_id = '00000000-0000-4000-8000-0000000000b2';
do $$ declare v_count integer; begin
  select count(*) into v_count from public.get_cashier_order_payment_summaries(array['00000000-0000-4000-8000-000000000003']::uuid[]);
  if v_count <> 0 then raise exception 'Forged cashier claim bypassed ownership'; end if;
  raise notice 'PASS forged cashier identifier ignored';
end $$;
reset role;
set local request.jwt.claim.sub = '';
set local role authenticated;
do $$ begin
  perform * from public.get_cashier_order_payment_summaries(array['00000000-0000-4000-8000-000000000001']::uuid[]);
  raise exception 'Authenticated role without subject unexpectedly authorized';
exception when insufficient_privilege then raise notice 'PASS missing subject denied';
end $$;
reset role;
set local role anon;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  perform * from public.get_cashier_order_payment_summaries(array['00000000-0000-4000-8000-000000000001']::uuid[]);
  raise exception 'Anon unexpectedly authorized';
exception when insufficient_privilege then raise notice 'PASS anon denied';
end $$;
reset role;
rollback;
