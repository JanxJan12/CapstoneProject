-- Run only against a disposable migrated database. Synthetic rows roll back.
begin;

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'cashier-p1-' || id || '@example.invalid', '',
  '{}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('c0010000-0000-4000-8000-000000000001'::uuid),
  ('c0010000-0000-4000-8000-000000000002'::uuid),
  ('c0010000-0000-4000-8000-000000000003'::uuid),
  ('c0010000-0000-4000-8000-000000000004'::uuid),
  ('c0010000-0000-4000-8000-000000000005'::uuid)
) ids(id);

insert into public.profiles (id, first_name, role, is_active) values
  ('c0010000-0000-4000-8000-000000000001', 'P1 Cashier A', 'cashier', true),
  ('c0010000-0000-4000-8000-000000000002', 'P1 Cashier B', 'cashier', true),
  ('c0010000-0000-4000-8000-000000000003', 'P1 Manager', 'manager', true),
  ('c0010000-0000-4000-8000-000000000004', 'P1 Customer', 'customer', true),
  ('c0010000-0000-4000-8000-000000000005', 'P1 Rider', 'rider', true)
on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

insert into public.cashier_shifts (id, cashier_id, terminal, opening_cash) values
  ('c0010000-0000-4000-8000-000000000011',
   'c0010000-0000-4000-8000-000000000001', 'P1 A', 100),
  ('c0010000-0000-4000-8000-000000000012',
   'c0010000-0000-4000-8000-000000000002', 'P1 B', 200);

insert into public.orders
  (id, order_number, customer_id, order_channel, fulfillment_type,
   current_status, subtotal, grand_total) values
  ('c0010000-0000-4000-8000-000000000021', 'P1-ONLINE-PENDING',
   'c0010000-0000-4000-8000-000000000004', 'online', 'takeout',
   'waiting_payment_verification', 25, 25),
  ('c0010000-0000-4000-8000-000000000022', 'P1-ONLINE-VERIFIED',
   'c0010000-0000-4000-8000-000000000004', 'online', 'takeout',
   'waiting_payment_verification', 30, 30);

insert into public.payments
  (id, order_id, payment_method, amount, gcash_reference_number, status)
values
  ('c0010000-0000-4000-8000-000000000031',
   'c0010000-0000-4000-8000-000000000021', 'gcash', 25, 'P1-REF-1', 'pending'),
  ('c0010000-0000-4000-8000-000000000032',
   'c0010000-0000-4000-8000-000000000022', 'gcash', 30, 'P1-REF-2', 'verified');

insert into public.cashier_transactions
  (id, receipt_number, order_id, payment_id, shift_id,
   cashier_id, request_id) values
  ('c0010000-0000-4000-8000-000000000041', 'P1-RC-1',
   'c0010000-0000-4000-8000-000000000022',
   'c0010000-0000-4000-8000-000000000032',
   'c0010000-0000-4000-8000-000000000011',
   'c0010000-0000-4000-8000-000000000001',
   'c0010000-0000-4000-8000-000000000051');

set local role authenticated;
select set_config('request.jwt.claim.sub',
  'c0010000-0000-4000-8000-000000000001', true);
do $test$
declare denied boolean := false;
begin
  if (select count(*) from public.cashier_shifts) <> 1
     or (select count(*) from public.cashier_transactions) <> 1 then
    raise exception 'Active Cashier direct reads failed';
  end if;
  begin
    perform public.close_cashier_shift(100);
  exception when sqlstate 'P0001' then
    denied := sqlerrm like 'Resolve pending online GCash payments%';
  end;
  if not denied then raise exception 'Pending GCash closure was allowed'; end if;
  if (select status from public.cashier_shifts
      where id = 'c0010000-0000-4000-8000-000000000011') <> 'open'
     or (select expected_cash from public.cashier_shifts
      where id = 'c0010000-0000-4000-8000-000000000011') is not null then
    raise exception 'Denied closure changed settlement snapshot';
  end if;
end;
$test$;

-- The same JWT identity is kept while the authoritative profile changes.
reset role;
update public.profiles set is_active = false
where id = 'c0010000-0000-4000-8000-000000000001';
set local role authenticated;
do $test$
begin
  if (select count(*) from public.cashier_shifts) <> 0
     or (select count(*) from public.cashier_transactions) <> 0 then
    raise exception 'Deactivated Cashier retained direct financial reads';
  end if;
end;
$test$;

reset role;
update public.profiles set is_active = true
where id = 'c0010000-0000-4000-8000-000000000001';
update public.payments set status = 'rejected'
where id = 'c0010000-0000-4000-8000-000000000031';
set local role authenticated;
do $test$
declare closed record;
        denied boolean := false;
begin
  select * into closed from public.close_cashier_shift(100);
  if closed.status <> 'closed' or closed.opening_cash <> 100
     or closed.expected_cash <> 100 or closed.actual_cash <> 100
     or closed.variance <> 0 or closed.gcash_sales <> 30
     or closed.transaction_count <> 1 then
    raise exception 'Eligible closure snapshot differs';
  end if;
  begin perform public.close_cashier_shift(100);
  exception when others then denied := true; end;
  if not denied or (select count(*) from public.cashier_shifts
      where cashier_id = 'c0010000-0000-4000-8000-000000000001'
        and status = 'closed') <> 1 then
    raise exception 'Duplicate closure was accepted';
  end if;
end;
$test$;

select set_config('request.jwt.claim.sub',
  'c0010000-0000-4000-8000-000000000002', true);
do $test$
declare closed record;
begin
  if (select count(*) from public.cashier_shifts) <> 1
     or (select count(*) from public.cashier_transactions) <> 0 then
    raise exception 'Cashier B read another Cashier financial row';
  end if;
  select * into closed from public.close_cashier_shift(100);
  if closed.status <> 'closed' or closed.expected_cash <> 200
     or closed.actual_cash <> 100 or closed.variance <> -100 then
    raise exception 'Shortage closure without explanation failed';
  end if;
end;
$test$;

select set_config('request.jwt.claim.sub',
  'c0010000-0000-4000-8000-000000000003', true);
do $test$
declare denied boolean := false;
begin
  if (select count(*) from public.cashier_shifts) <> 2
     or (select count(*) from public.cashier_transactions) <> 1
     or (select count(*) from public.get_closed_cashier_shifts(
          null, null, null, null, null, 25)) <> 2 then
    raise exception 'Active Manager visibility regressed';
  end if;
  begin perform public.close_cashier_shift(0);
  exception when others then denied := true; end;
  if not denied then raise exception 'Manager closed a Cashier shift'; end if;
end;
$test$;

reset role;
update public.profiles set is_active = false
where id = 'c0010000-0000-4000-8000-000000000003';
set local role authenticated;
do $test$
begin
  if (select count(*) from public.cashier_shifts) <> 0
     or (select count(*) from public.cashier_transactions) <> 0 then
    raise exception 'Deactivated Manager retained financial reads';
  end if;
end;
$test$;

select set_config('request.jwt.claim.sub',
  'c0010000-0000-4000-8000-000000000004', true);
do $test$
begin
  if (select count(*) from public.cashier_shifts) <> 0
     or (select count(*) from public.cashier_transactions) <> 0 then
    raise exception 'Customer read Cashier financial rows';
  end if;
end;
$test$;
select set_config('request.jwt.claim.sub',
  'c0010000-0000-4000-8000-000000000005', true);
do $test$
begin
  if (select count(*) from public.cashier_shifts) <> 0
     or (select count(*) from public.cashier_transactions) <> 0 then
    raise exception 'Rider read Cashier financial rows';
  end if;
end;
$test$;
rollback;

