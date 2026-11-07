\set ON_ERROR_STOP on
begin;

-- The clone omits ACLs; these grants exist only inside this rolled-back check.
grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function public.get_cashier_online_payments() to authenticated;
grant execute on function public.get_customer_order_payment(uuid) to authenticated;
grant execute on function public.reject_customer_gcash_payment(uuid,text,text) to authenticated;

select id as cashier_id from public.profiles where role = 'cashier' and is_active limit 1 \gset
select id as customer_id from public.profiles where role = 'customer' and is_active limit 1 \gset
select id as manager_id from public.profiles where role = 'manager' and is_active limit 1 \gset
select id as payment_id, order_id from public.payments limit 1 \gset
select set_config('qa.payment_id', :'payment_id', true);
select set_config('qa.order_id', :'order_id', true);

select count(*) as payment_rows, count(*) filter (where status='verified') as verified_rows,
       sum(amount) filter (where status='verified') as verified_amount
from public.payments;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'cashier_id', true);
do $$
begin
  perform 1 from public.get_cashier_online_payments();
  raise notice 'PASS: active Cashier payment queue callable';
end $$;

select set_config('request.jwt.claim.sub', :'customer_id', true);
do $$
begin
  perform 1 from public.get_customer_order_payment(current_setting('qa.order_id')::uuid);
  raise notice 'PASS: owning Customer payment read callable';
  begin
    perform 1 from public.reject_customer_gcash_payment(current_setting('qa.payment_id')::uuid, 'Other', 'Synthetic note');
    raise exception 'Customer rejection unexpectedly allowed';
  exception when insufficient_privilege then
    raise notice 'PASS: Customer rejection denied';
  end;
end $$;

select set_config('request.jwt.claim.sub', :'manager_id', true);
do $$
begin
  begin
    perform 1 from public.get_cashier_online_payments();
    raise exception 'Manager payment queue unexpectedly allowed';
  exception when insufficient_privilege then
    raise notice 'PASS: Manager Cashier queue denied';
  end;
end $$;

reset role;
select count(*) as payment_rows, count(*) filter (where status='verified') as verified_rows,
       sum(amount) filter (where status='verified') as verified_amount
from public.payments;
rollback;
