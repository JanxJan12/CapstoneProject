\set ON_ERROR_STOP on
begin;
-- Targeted synthetic fixture in a disposable database after the transition migration.
alter table public.orders add column if not exists customer_request_id uuid;
create unique index if not exists orders_customer_request_id_key
  on public.orders(customer_id,customer_request_id) where customer_request_id is not null;
insert into auth.users(id,instance_id,aud,role,email) values
 ('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','retirement-customer@example.test'),
 ('c2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','retirement-manager@example.test'),
 ('c3333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','retirement-cashier@example.test');
insert into public.profiles(id,role,is_active) values
 ('c1111111-1111-4111-8111-111111111111','customer',true),
 ('c2222222-2222-4222-8222-222222222222','manager',true),
 ('c3333333-3333-4333-8333-333333333333','cashier',true)
on conflict(id) do update set role=excluded.role,is_active=true;
insert into public.menu_categories(id,name) values
 ('faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Retirement food'),
 ('faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab','Rice');
insert into public.menu_items(id,category_id,code,name,price) values
 ('fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A1','Adobong Manok',120),
 ('fccccccc-cccc-4ccc-8ccc-cccccccccccc','faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FM','Fixed Meal',200),
 ('fddddddd-dddd-4ddd-8ddd-dddddddddddd','faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab','R1','White Rice',35),
 ('feeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CB','Chicken Biryani',210);
insert into public.inventory_items(id,item_name,unit,quantity_on_hand)
 values ('f9999999-9999-4999-8999-999999999999','QA mapped rice','kg',10);
insert into public.cashier_shifts(id,cashier_id,terminal,opening_cash) values
 ('f8888888-8888-4888-8888-888888888888','c3333333-3333-4333-8333-333333333333','Retirement QA',100);

set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select public.set_manager_fixed_meal_option('fccccccc-cccc-4ccc-8ccc-cccccccccccc',200,170,
  'f9999999-9999-4999-8999-999999999999',0.2);
do $test$ begin
 perform public.set_manager_drink_choice('e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c','drink-large',16,true);
 perform public.set_manager_drink_choice('e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c','drink-large',15,true);
 perform public.set_manager_drink_choice('e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c','drink-large',15,false);
 begin
   perform public.set_manager_drink_choice('e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c','drink-regular',0,false);
   raise exception 'Manager disabled the last size';
 exception when sqlstate '22023' then null;
 end;
 perform public.set_manager_drink_choice('e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c','drink-large',15,true);
end $test$;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
create temp table retirement_orders(kind text, order_id uuid, subtotal numeric);
grant select,insert on retirement_orders to authenticated;
create temp table retirement_sales(kind text, order_id uuid, subtotal numeric, grand_total numeric);
grant select,insert on retirement_sales to authenticated;
insert into retirement_orders select 'ordinary',order_id,subtotal from public.place_customer_order(
 'QA Customer','09123456789','QA address',null,
 '[{"id":"fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1,"modifier_ids":[]}]'::jsonb,
 'fa000000-0000-4000-8000-000000000001');
insert into retirement_orders select 'softdrink',order_id,subtotal from public.place_customer_order(
 'QA Customer','09123456789','QA address',null,
 '[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":2,"modifier_ids":["drink-coke","drink-large"],"unit_price":1}]'::jsonb,
 'fa000000-0000-4000-8000-000000000002');
insert into retirement_orders select 'buko',order_id,subtotal from public.place_customer_order(
 'QA Customer','09123456789','QA address',null,
 '[{"id":"e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c","qty":1,"modifier_ids":["drink-regular"]}]'::jsonb,
 'fa000000-0000-4000-8000-000000000003');
insert into retirement_orders select 'mixed',order_id,subtotal from public.place_customer_order(
 'QA Customer','09123456789','QA address',null,
 '[{"id":"fccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":1,"modifier_ids":[],"meal_option":"with_rice"},{"id":"fccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":1,"modifier_ids":[],"meal_option":"without_rice"},{"id":"fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1,"modifier_ids":[]},{"id":"fddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":1,"modifier_ids":[]},{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":["drink-sprite","drink-regular"]}]'::jsonb,
 'fa000000-0000-4000-8000-000000000004');

reset role;
update public.order_items set modifiers='[{"id":"no-onions","name":"No onion","price":0}]'::jsonb
where order_id=(select order_id from retirement_orders where kind='ordinary');
do $test$
declare v_id uuid;
begin
 if (select subtotal from retirement_orders where kind='ordinary')<>120
   or (select subtotal from retirement_orders where kind='softdrink')<>90
   or (select subtotal from retirement_orders where kind='buko')<>35
   or (select subtotal from retirement_orders where kind='mixed')<>555 then
   raise exception 'Authoritative subtotal or mixed cart failed'; end if;
 select order_id into v_id from retirement_orders where kind='mixed';
 if (select count(*) from public.order_items where order_id=v_id)<>5 then
   raise exception 'Mixed cart lines merged'; end if;
 if not exists(select 1 from public.order_items where order_id=v_id and item_name='White Rice'
     and unit_price=35 and quantity=1 and modifiers='[]'::jsonb)
   or not exists(select 1 from public.order_items where order_id=v_id and item_name='Fixed Meal'
     and unit_price=200 and modifiers @> '[{"id":"fixed_meal:with_rice"}]'::jsonb)
   or not exists(select 1 from public.order_items where order_id=v_id and item_name='Fixed Meal'
     and unit_price=170 and modifiers @> '[{"id":"fixed_meal:without_rice"}]'::jsonb)
   or not exists(select 1 from public.order_items where order_id=v_id and item_name='Softdrinks'
     and unit_price=30 and modifiers @> '[{"id":"drink-sprite","name":"Sprite","price":0},{"id":"drink-regular","name":"Regular","price":0}]'::jsonb)
   or not exists(select 1 from public.order_items where order_id=(select order_id from retirement_orders where kind='softdrink')
     and unit_price=45 and line_total=90 and modifiers @> '[{"id":"drink-coke","name":"Coke","price":0},{"id":"drink-large","name":"Large","price":15}]'::jsonb)
   then raise exception 'Order-line snapshot or price failed'; end if;
 if exists(select 1 from public.payments where order_id=v_id)
   or (select grand_total from public.orders where id=v_id)<>605 then
   raise exception 'Payment state or total changed'; end if;
 if not exists(select 1 from public.order_items
   where order_id=(select order_id from retirement_orders where kind='ordinary')
     and modifiers @> '[{"id":"no-onions","name":"No onion","price":0}]'::jsonb
     and unit_price=120 and line_total=120) then
   raise exception 'Historical modifier snapshot or financial fields changed'; end if;
end $test$;

set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
do $test$
declare v_items jsonb; v_expected text;
begin
 for v_items,v_expected in select * from (values
  ('[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":[]}]'::jsonb,'requires'),
  ('[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":["drink-coke"]}]'::jsonb,'requires'),
  ('[{"id":"e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c","qty":1,"modifier_ids":["drink-coke"]}]'::jsonb,'Invalid'),
  ('[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":["drink-coke","drink-coke"]}]'::jsonb,'Duplicate'),
  ('[{"id":"fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1,"modifier_ids":["extra-rice"]}]'::jsonb,'Invalid'),
  ('[{"id":"fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1,"meal_option":"with_rice"}]'::jsonb,'unavailable'),
  ('[{"id":"feeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","qty":1,"meal_option":"without_rice"}]'::jsonb,'unavailable')
 ) cases(items,expected) loop
   begin
     perform public.place_customer_order('QA Customer','09123456789','QA address',null,v_items,gen_random_uuid());
     raise exception 'Invalid cart accepted';
   exception when others then
     if sqlerrm not ilike '%'||v_expected||'%' then raise; end if;
   end;
 end loop;
end $test$;

select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
insert into retirement_sales select 'mixed',order_id,subtotal,grand_total from public.create_walk_in_sale(
 'fa000000-0000-4000-8000-000000000005','takeout'::public.fulfillment_type,
 'QA Guest',null,null,null,null,null,'cash'::public.payment_method,500,null,
 '[{"menu_item_id":"fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"modifier_ids":[]},{"menu_item_id":"e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c","quantity":1,"modifier_ids":["drink-large"],"unit_price":1},{"menu_item_id":"fddddddd-dddd-4ddd-8ddd-dddddddddddd","quantity":1,"modifier_ids":[]}]'::jsonb);
do $test$ begin
 begin
   perform public.create_walk_in_sale(gen_random_uuid(),'takeout'::public.fulfillment_type,
     'QA Guest',null,null,null,null,null,'cash'::public.payment_method,500,null,
     '[{"menu_item_id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","quantity":1,"modifier_ids":["drink-coke"]}]'::jsonb);
   raise exception 'Cashier accepted missing drink size';
 exception when others then
   if sqlerrm not ilike '%requires%' then raise; end if;
 end;
 begin
   perform public.create_walk_in_sale(gen_random_uuid(),'takeout'::public.fulfillment_type,
     'QA Guest',null,null,null,null,null,'cash'::public.payment_method,500,null,
     '[{"menu_item_id":"fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"modifier_ids":["extra-rice"]}]'::jsonb);
   raise exception 'Cashier accepted retired extra rice modifier';
 exception when others then
   if sqlerrm not ilike '%Invalid drink choice%' then raise; end if;
 end;
end $test$;
do $test$ begin
 begin
   perform public.place_customer_order('QA Cashier','09123456789','QA address',null,
     '[{"id":"fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1}]'::jsonb,gen_random_uuid());
   raise exception 'Cashier placed Customer order';
 exception when others then
   if sqlerrm not like 'Only an active customer%' then raise; end if;
 end;
end $test$;
do $test$ begin
 begin
   perform public.set_manager_drink_choice('3c78b355-2613-4f5b-af4d-ac2197d957fe','drink-large',999,true);
   raise exception 'Cashier changed drink choice';
 exception when others then
   if sqlstate <> '42501' then raise; end if;
 end;
end $test$;
reset role;
do $test$ begin
 if (select subtotal from retirement_sales where kind='mixed')<>205
   or (select grand_total from retirement_sales where kind='mixed')<>205 then
   raise exception 'Cashier authoritative subtotal or total failed'; end if;
 if not exists(select 1 from public.order_items where order_id=(select order_id from retirement_sales where kind='mixed')
   and item_name='Buko Juice' and unit_price=50 and modifiers @> '[{"id":"drink-large","name":"Large","price":15}]'::jsonb)
   or (select count(*) from public.order_items where order_id=(select order_id from retirement_sales where kind='mixed'))<>3 then
   raise exception 'Cashier drink snapshot or distinct lines failed'; end if;
end $test$;
do $test$ begin
 if has_function_privilege('anon','public.place_customer_order(text,text,text,text,jsonb,uuid)','EXECUTE')
   or has_function_privilege('anon','public.set_manager_drink_choice(uuid,text,numeric,boolean)','EXECUTE') then
   raise exception 'Anon writer execute privilege remains'; end if;
end $test$;
rollback;
