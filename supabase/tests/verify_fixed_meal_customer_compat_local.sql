\set ON_ERROR_STOP on
begin;

-- Targeted disposable-schema test. All synthetic users, catalog rows and orders roll back.
alter table public.orders add column if not exists customer_request_id uuid;
create unique index if not exists orders_customer_request_id_key
  on public.orders(customer_id, customer_request_id)
  where customer_request_id is not null;

insert into auth.users(id,instance_id,aud,role,email) values
  ('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','customer-compat@example.test'),
  ('c2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-compat@example.test'),
  ('c3333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','cashier-compat@example.test');
insert into public.profiles(id,role,is_active) values
  ('c1111111-1111-4111-8111-111111111111','customer',true),
  ('c2222222-2222-4222-8222-222222222222','manager',true),
  ('c3333333-3333-4333-8333-333333333333','cashier',true)
on conflict(id) do update set role=excluded.role,is_active=true;

insert into public.menu_categories(id,name)
values ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Customer compatibility QA');
insert into public.menu_items(id,category_id,code,name,price) values
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CQMEAL','QA Meal',200),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CQPLAIN','QA Ordinary',80),
  ('cddddddd-dddd-4ddd-8ddd-dddddddddddd','caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CQDRINK','QA Drink',60);
insert into public.inventory_items(id,item_name,unit,quantity_on_hand)
values ('ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','QA mapped rice','kg',10);
insert into public.menu_modifier_groups(id,name,selection_type,min_selections,max_selections)
values ('qa-drink-flavor','Drink flavor','single',1,1);
insert into public.menu_modifier_options(id,group_id,name,price_adjustment)
values ('qa-drink-lemon','qa-drink-flavor','Lemon',5),
       ('qa-drink-berry','qa-drink-flavor','Berry',10);
insert into public.menu_item_modifier_groups(menu_item_id,group_id)
values ('cddddddd-dddd-4ddd-8ddd-dddddddddddd','qa-drink-flavor');

set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select public.set_manager_fixed_meal_option(
  'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,
  'ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',0.2);

select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
create temp table customer_compat_orders(kind text, order_id uuid, subtotal numeric);
grant select,insert on customer_compat_orders to authenticated;

-- Canonical local frontend fields: id, qty, modifier_ids, optional meal_option.
insert into customer_compat_orders
select 'ordinary',order_id,subtotal from public.place_customer_order(
  'QA Customer','09123456789','QA address',null,
  '[{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":2,"modifier_ids":[]}]'::jsonb,
  'ca000000-0000-4000-8000-000000000001');
insert into customer_compat_orders
select 'drink',order_id,subtotal from public.place_customer_order(
  'QA Customer','09123456789','QA address',null,
  '[{"id":"cddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":2,"modifier_ids":["qa-drink-lemon"],"unit_price":1}]'::jsonb,
  'ca000000-0000-4000-8000-000000000002');
insert into customer_compat_orders
select 'mixed',order_id,subtotal from public.place_customer_order(
  'QA Customer','09123456789','QA address',null,
  '[{"id":"cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1,"modifier_ids":[],"meal_option":"with_rice","unit_price":1},{"id":"cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":2,"modifier_ids":[],"meal_option":"without_rice","price_adjustment":999},{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":1,"modifier_ids":[]},{"id":"cddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":1,"modifier_ids":["qa-drink-berry"]}]'::jsonb,
  'ca000000-0000-4000-8000-000000000003');

do $test$
declare v_id uuid;
begin
  if (select subtotal from customer_compat_orders where kind='ordinary')<>160
    or (select subtotal from customer_compat_orders where kind='drink')<>130
    or (select subtotal from customer_compat_orders where kind='mixed')<>690 then
    raise exception 'Authoritative ordinary, drink or mixed subtotal failed';
  end if;
  select order_id into v_id from customer_compat_orders where kind='mixed';
  if (select count(*) from public.order_items where order_id=v_id)<>4 then
    raise exception 'Mixed Customer lines merged or disappeared'; end if;
  if not exists(select 1 from public.order_items where order_id=v_id
      and unit_price=200 and line_total=200 and quantity=1
      and modifiers @> '[{"id":"fixed_meal:with_rice","name":"With Rice","price":0,"rice_inventory_item_id":"ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}]'::jsonb)
    or not exists(select 1 from public.order_items where order_id=v_id
      and unit_price=170 and line_total=340 and quantity=2
      and modifiers @> '[{"id":"fixed_meal:without_rice","name":"Without Rice","price":-30,"excluded_inventory_item_id":"ceeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}]'::jsonb)
    or not exists(select 1 from public.order_items where order_id=v_id
      and unit_price=80 and line_total=80 and modifiers='[]'::jsonb)
    or not exists(select 1 from public.order_items where order_id=v_id
      and unit_price=70 and line_total=70
      and modifiers @> '[{"id":"qa-drink-berry","name":"Berry","price":10}]'::jsonb) then
    raise exception 'Persisted Customer line price or snapshot failed';
  end if;
  if not exists(select 1 from public.order_items where order_id=(select order_id from customer_compat_orders where kind='drink')
      and unit_price=65 and line_total=130
      and modifiers @> '[{"id":"qa-drink-lemon","name":"Lemon","price":5}]'::jsonb) then
    raise exception 'Required drink selection was not persisted'; end if;
  if exists(select 1 from public.payments where order_id=v_id)
    or (select current_status from public.orders where id=v_id)<>'waiting_payment_verification'::public.order_status
    or (select grand_total from public.orders where id=v_id)<>740 then
    raise exception 'Customer order payment state or total failed'; end if;
end;
$test$;

do $test$
declare v_items jsonb; v_expected text;
begin
  for v_items,v_expected in select * from (values
    ('[{"id":"cddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":1,"modifier_ids":[]}]'::jsonb,'requires'),
    ('[{"id":"cddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":1}]'::jsonb,'requires'),
    ('[{"id":"cddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":1,"modifier_ids":["missing-id"]}]'::jsonb,'invalid'),
    ('[{"id":"cddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":1,"modifier_ids":["qa-drink-lemon","qa-drink-lemon"]}]'::jsonb,'Duplicate'),
    ('[{"id":"cddddddd-dddd-4ddd-8ddd-dddddddddddd","qty":1,"modifier_ids":{"id":"qa-drink-lemon"}}]'::jsonb,'Invalid'),
    ('[{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":1,"modifier_ids":["qa-drink-lemon"]}]'::jsonb,'invalid'),
    ('[{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":1,"modifier_ids":[],"meal_option":"with_rice"}]'::jsonb,'unavailable'),
    ('[{"id":"cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1,"modifier_ids":[],"meal_option":"invalid"}]'::jsonb,'Invalid')
  ) cases(items,expected) loop
    begin
      perform public.place_customer_order('QA Customer','09123456789','QA address',null,v_items,gen_random_uuid());
      raise exception 'Invalid Customer cart was accepted';
    exception when others then
      if sqlerrm not ilike '%'||v_expected||'%' then raise; end if;
    end;
  end loop;
end;
$test$;

select set_config('request.jwt.claim.sub','c3333333-3333-4333-8333-333333333333',true);
do $test$
begin
  begin
    perform public.place_customer_order('QA Cashier','09123456789','QA address',null,
      '[{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":1,"modifier_ids":[]}]'::jsonb,
      gen_random_uuid());
    raise exception 'Cashier placed Customer order';
  exception when others then
    if sqlerrm not like 'Only an active customer%' then raise; end if;
  end;
end;
$test$;
reset role;
update public.profiles set is_active=false
where id='c1111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
do $test$
begin
  begin
    perform public.place_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","qty":1,"modifier_ids":[]}]'::jsonb,
      gen_random_uuid());
    raise exception 'Inactive Customer placed order';
  exception when others then
    if sqlerrm not like 'Only an active customer%' then raise; end if;
  end;
end;
$test$;
reset role;
do $test$
begin
  if has_function_privilege('anon','public.place_customer_order(text,text,text,text,jsonb,uuid)','EXECUTE') then
    raise exception 'Anon can execute Customer order writer'; end if;
end;
$test$;

rollback;
