-- Disposable final-schema integration fixture. No writes survive the transaction.
begin;
insert into auth.users(id) values
 ('e0410000-0000-4000-8000-000000000001'),
 ('e0410000-0000-4000-8000-000000000002');
update public.profiles set role='cashier', is_active=true
 where id='e0410000-0000-4000-8000-000000000001';
update public.profiles set role='customer', is_active=true
 where id='e0410000-0000-4000-8000-000000000002';
insert into public.menu_categories(id,name) values
 ('e0410000-0000-4000-8000-000000000010','Consolidated sale fixture');
insert into public.menu_items(id,category_id,name,code,price) values
 ('e0410000-0000-4000-8000-000000000011',
  'e0410000-0000-4000-8000-000000000010','Fixture meal','FXMEAL',100);
insert into public.cashier_shifts(id,cashier_id,terminal,opening_cash) values
 ('e0410000-0000-4000-8000-000000000012',
  'e0410000-0000-4000-8000-000000000001','Fixture',50);
set local role authenticated;
select set_config('request.jwt.claim.sub','e0410000-0000-4000-8000-000000000001',true);
do $test$
declare v record; replay record; detail jsonb; history jsonb; closed record;
begin
 select * into v from public.create_walk_in_sale(
   'e0410000-0000-4000-8000-000000000020','takeout',
   'Fixture customer',null,'cash',150,null,
   '[{"menu_item_id":"e0410000-0000-4000-8000-000000000011","quantity":1,"note":"No onion"}]'::jsonb);
 if v.subtotal<>100 or v.tax_amount<>0 or v.grand_total<>100
    or v.cash_received<>150 or v.change_due<>50
    or v.receipt_number not like 'RCP-%' then
   raise exception 'Walk-in sale or money contract changed';
 end if;
 select * into replay from public.create_walk_in_sale(
   'e0410000-0000-4000-8000-000000000020','takeout',
   'Fixture customer',null,'cash',150,null,
   '[{"menu_item_id":"e0410000-0000-4000-8000-000000000011","quantity":1,"note":"No onion"}]'::jsonb);
 if replay.order_id<>v.order_id or replay.receipt_number<>v.receipt_number
    or (select count(*) from public.cashier_transactions where order_id=v.order_id)<>1
    or (select amount from public.payments where id=v.payment_id)<>100
    or (select special_instructions from public.order_items where order_id=v.order_id)<>'No onion' then
   raise exception 'Sale replay, payment, or item instruction changed';
 end if;
 detail:=public.get_cashier_sale(v.order_id);
 if detail->'transaction'->>'receipt_number'<>v.receipt_number
    or (detail->'payment'->>'amount')::numeric<>100 then
   raise exception 'Saved receipt contract changed';
 end if;
 history:=public.get_cashier_transaction_history(10,0,'{}'::jsonb);
 if history::text not like '%'||v.receipt_number||'%' then
   raise exception 'Cashier history lost receipt identity';
 end if;
 select * into closed from public.close_cashier_shift(150);
 if closed.expected_cash<>150 or closed.actual_cash<>150 or closed.variance<>0 then
   raise exception 'Cash settlement omitted verified cash receipt';
 end if;
end $test$;
select set_config('request.jwt.claim.sub','e0410000-0000-4000-8000-000000000002',true);
do $test$
declare denied boolean:=false;
begin
 begin
   perform public.create_walk_in_sale(gen_random_uuid(),'takeout',null,null,
     'cash',100,null,'[]'::jsonb);
 exception when raise_exception then
   denied:=sqlerrm='Only an active cashier account may create a walk-in sale.';
 end;
 if not denied then raise exception 'Customer performed cashier sale'; end if;
end $test$;
rollback;
