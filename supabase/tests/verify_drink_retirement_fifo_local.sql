\set ON_ERROR_STOP on
begin;
-- The disposable source schema lacks a hosted-only idempotency column.
alter table public.orders add column if not exists customer_request_id uuid;
create unique index if not exists orders_customer_request_id_key
  on public.orders(customer_id,customer_request_id) where customer_request_id is not null;

-- Synthetic batch fixture. Quantities below are test values, not restaurant recipes.
insert into auth.users(id,instance_id,aud,role,email) values
  ('41111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meal-fifo-manager@example.test'),
  ('42222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meal-fifo-customer@example.test');
insert into public.profiles(id,role,is_active) values
  ('41111111-1111-4111-8111-111111111111','manager',true),
  ('42222222-2222-4222-8222-222222222222','customer',true)
on conflict(id) do update set role=excluded.role,is_active=true;
insert into public.menu_categories(id,name)
values('43333333-3333-4333-8333-333333333333','Synthetic Batch Meals');
insert into public.menu_items(id,category_id,code,name,price) values
  ('44444444-4444-4444-8444-444444444444','43333333-3333-4333-8333-333333333333','BATCHMEAL','Synthetic Batch Meal',200),
  ('45555555-5555-4555-8555-555555555555','43333333-3333-4333-8333-333333333333','BATCHRICE','Synthetic Separate Rice',35);
insert into public.inventory_items(id,item_name,unit,quantity_on_hand,quantity_scale,batch_consumption_enabled) values
  ('11111111-1111-4111-8111-111111111111','Synthetic Batch Rice','kg',1,3,true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','Synthetic Batch Other','pcs',3,0,true);
insert into public.inventory_opening_balances
  (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload) values
  ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000011',
   '11111111-1111-4111-8111-111111111111','41111111-1111-4111-8111-111111111111',now(),1,2,
   '{"fixture":"synthetic rice opening"}'::jsonb),
  ('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000012',
   'ffffffff-ffff-4fff-8fff-ffffffffffff','41111111-1111-4111-8111-111111111111',now(),3,1,
   '{"fixture":"synthetic other opening"}'::jsonb);
insert into public.inventory_batches
  (id,batch_code,inventory_item_id,origin_type,opening_balance_id,received_at,quantity_initial,quantity_on_hand) values
  ('46666666-6666-4666-8666-666666666666','SYN-RICE-EARLY','11111111-1111-4111-8111-111111111111','legacy_opening','40000000-0000-4000-8000-000000000001',now()-interval '2 days',0.3,0.3),
  ('47777777-7777-4777-8777-777777777777','SYN-RICE-LATER','11111111-1111-4111-8111-111111111111','legacy_opening','40000000-0000-4000-8000-000000000001',now()-interval '1 day',0.7,0.7),
  ('48888888-8888-4888-8888-888888888888','SYN-OTHER','ffffffff-ffff-4fff-8fff-ffffffffffff','legacy_opening','40000000-0000-4000-8000-000000000002',now()-interval '1 day',3,3);
insert into public.menu_ingredients(menu_item_id,inventory_item_id,quantity_required) values
  ('44444444-4444-4444-8444-444444444444','ffffffff-ffff-4fff-8fff-ffffffffffff',1),
  ('45555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',0.15);

set local role authenticated;
select set_config('request.jwt.claim.sub','41111111-1111-4111-8111-111111111111',true);
select * from public.set_manager_fixed_meal_option(
  '44444444-4444-4444-8444-444444444444',200,170,
  '11111111-1111-4111-8111-111111111111',0.2);
select set_config('request.jwt.claim.sub','42222222-2222-4222-8222-222222222222',true);
create temp table meal_fifo_orders(kind text,id uuid,subtotal numeric);
insert into meal_fifo_orders
select 'without',order_id,subtotal from public.place_customer_order(
  'Synthetic Customer','09123456789','Synthetic address','',
  jsonb_build_array(jsonb_build_object('id','44444444-4444-4444-8444-444444444444','qty',1,'meal_option','without_rice')),
  '49999999-9999-4999-8999-999999999999');
reset role;
update public.orders set current_status='confirmed' where id=(select id from meal_fifo_orders where kind='without');
select public.deduct_inventory_for_confirmed_order((select id from meal_fifo_orders where kind='without'));
do $test$
begin
  if (select quantity_on_hand from public.inventory_items where id='11111111-1111-4111-8111-111111111111')<>1
    or (select quantity_on_hand from public.inventory_items where id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>2 then
    raise exception 'Without Rice batch issuance changed the wrong ingredients'; end if;
  if exists(select 1 from public.inventory_transactions where order_id=(select id from meal_fifo_orders where kind='without')
    and inventory_item_id='11111111-1111-4111-8111-111111111111') then
    raise exception 'Without Rice issued rice'; end if;
end;
$test$;

set local role authenticated;
select set_config('request.jwt.claim.sub','42222222-2222-4222-8222-222222222222',true);
insert into meal_fifo_orders
select 'with_and_extra',order_id,subtotal from public.place_customer_order(
  'Synthetic Customer','09123456789','Synthetic address','',
  jsonb_build_array(
    jsonb_build_object('id','44444444-4444-4444-8444-444444444444','qty',1,'meal_option','with_rice'),
    jsonb_build_object('id','45555555-5555-4555-8555-555555555555','qty',1)),
  '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
reset role;
update public.orders set current_status='confirmed' where id=(select id from meal_fifo_orders where kind='with_and_extra');
select public.deduct_inventory_for_confirmed_order((select id from meal_fifo_orders where kind='with_and_extra'));
do $test$
begin
  if (select subtotal from meal_fifo_orders where kind='with_and_extra')<>235
    or (select count(*) from public.order_items where order_id=(select id from meal_fifo_orders where kind='with_and_extra'))<>2 then
    raise exception 'With Rice and separate rice order lines or prices changed'; end if;
  if (select quantity_on_hand from public.inventory_items where id='11111111-1111-4111-8111-111111111111')<>0.65
    or (select quantity_on_hand from public.inventory_batches where batch_code='SYN-RICE-EARLY')<>0
    or (select quantity_on_hand from public.inventory_batches where batch_code='SYN-RICE-LATER')<>0.65 then
    raise exception 'Rice FIFO allocation did not consume the earliest batch first'; end if;
  if (select coalesce(sum(a.quantity),0) from public.inventory_transaction_batch_allocations a
    join public.inventory_transactions t on t.id=a.inventory_transaction_id
    where t.order_id=(select id from meal_fifo_orders where kind='with_and_extra')
      and t.inventory_item_id='11111111-1111-4111-8111-111111111111')<>0.35 then
    raise exception 'Rice allocation does not reconcile with meal plus separate rice'; end if;
end;
$test$;

-- Create while stock is sufficient, then force a second-ingredient shortage.
-- The failed deduction must roll back the earlier rice allocation in that call.
set local role authenticated;
select set_config('request.jwt.claim.sub','42222222-2222-4222-8222-222222222222',true);
insert into meal_fifo_orders
select 'failed_confirm',order_id,subtotal from public.place_customer_order(
  'Synthetic Customer','09123456789','Synthetic address','',
  jsonb_build_array(jsonb_build_object('id','44444444-4444-4444-8444-444444444444','qty',1,'meal_option','with_rice')),
  '4bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
reset role;
update public.orders set current_status='confirmed' where id=(select id from meal_fifo_orders where kind='failed_confirm');
update public.inventory_batches set quantity_on_hand=0 where batch_code='SYN-OTHER';
update public.inventory_items set quantity_on_hand=0 where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
do $test$
begin
  begin
    perform public.deduct_inventory_for_confirmed_order((select id from meal_fifo_orders where kind='failed_confirm'));
    raise exception 'Shortage was accepted';
  exception when others then
    if sqlerrm='Shortage was accepted' then raise; end if;
  end;
  if (select quantity_on_hand from public.inventory_items where id='11111111-1111-4111-8111-111111111111')<>0.65
    or (select quantity_on_hand from public.inventory_batches where batch_code='SYN-RICE-LATER')<>0.65
    or exists(select 1 from public.inventory_transactions where order_id=(select id from meal_fifo_orders where kind='failed_confirm')) then
    raise exception 'Failed confirmation left a partial stock movement'; end if;
end;
$test$;

rollback;
