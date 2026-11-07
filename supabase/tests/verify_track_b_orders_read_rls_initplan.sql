\set ON_ERROR_STOP on
-- Run only against a disposable local database. All fixture rows and policy
-- edits are rolled back. Copy the migration to /tmp/track_b_orders_policy.sql.
begin;

select id as customer_id from public.profiles
where role = 'customer'::public.user_role limit 1 \gset
select id as cashier_id from public.profiles
where role = 'cashier'::public.user_role and is_active limit 1 \gset
select id as manager_id from public.profiles
where role = 'manager'::public.user_role and is_active limit 1 \gset

insert into public.orders (
  order_number, customer_id, order_channel, fulfillment_type,
  current_status, subtotal, grand_total, created_at
)
select 'PERF-20261027-' || g::text,
       case when g % 10 = 0 then :'customer_id'::uuid else null end,
       'online'::public.order_channel,
       'takeout'::public.fulfillment_type,
       'confirmed'::public.order_status,
       100, 100, now() - (g || ' seconds')::interval
from generate_series(1, 5000) g;
insert into auth.users (id) values ('a0000000-0000-4000-8000-0000000000c1');
insert into public.profiles (id, role, is_active)
values ('a0000000-0000-4000-8000-0000000000c1', 'rider', true)
on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;
insert into public.riders (id, approval_status)
values ('a0000000-0000-4000-8000-0000000000c1', 'approved');
insert into public.orders (
  id, order_number, order_channel, fulfillment_type, current_status,
  delivery_address
) values (
  'a0000000-0000-4000-8000-0000000000c2', 'PERF-20261027-RIDER',
  'online', 'delivery', 'confirmed', 'Disposable local address'
);
insert into public.delivery_assignments (id, order_id, rider_id, status)
values (
  'a0000000-0000-4000-8000-0000000000c3',
  'a0000000-0000-4000-8000-0000000000c2',
  'a0000000-0000-4000-8000-0000000000c1', 'accepted'
);
analyze public.orders;

select set_config('request.jwt.claim.sub', :'customer_id', true);
set local role authenticated;
\echo CUSTOMER_BEFORE
explain (analyze, buffers, timing off)
select id, order_number, current_status, created_at
from public.orders order by created_at desc;
select count(*) as customer_before from public.orders \gset
reset role;

select set_config('request.jwt.claim.sub', :'cashier_id', true);
set local role authenticated;
select count(*) as cashier_before from public.orders \gset
reset role;

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
select count(*) as rider_before from public.orders \gset
reset role;

\i /tmp/track_b_orders_policy.sql

select set_config('request.jwt.claim.sub', :'customer_id', true);
set local role authenticated;
\echo CUSTOMER_AFTER
explain (analyze, buffers, timing off)
select id, order_number, current_status, created_at
from public.orders order by created_at desc;
select count(*) as customer_after from public.orders \gset
reset role;

select set_config('request.jwt.claim.sub', :'cashier_id', true);
set local role authenticated;
select count(*) as cashier_after from public.orders \gset
reset role;

select set_config('request.jwt.claim.sub', :'manager_id', true);
set local role authenticated;
select count(*) as manager_after from public.orders \gset
reset role;

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
select count(*) as rider_after from public.orders \gset
reset role;

update public.profiles set is_active = false
where id = 'a0000000-0000-4000-8000-0000000000c1';
select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-0000000000c1', true);
set local role authenticated;
select count(*) as inactive_rider_after from public.orders \gset
reset role;

select 1 / ((
  :customer_before = :customer_after and :customer_after = 500
  and :cashier_before = :cashier_after and :cashier_after = 5001
  and :manager_after = 5001
  and :rider_before = :rider_after and :rider_after = 1
  and :inactive_rider_after = 0
)::int) as role_visibility_pass;

rollback;
