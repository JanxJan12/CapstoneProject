\set ON_ERROR_STOP on
begin;

-- This prerequisite exists in the current hosted schema but not the 2026-08
-- baseline used by the disposable local parser stack.
alter table public.orders add column if not exists customer_request_id uuid;
create unique index if not exists orders_customer_request_id_key
  on public.orders(customer_id,customer_request_id) where customer_request_id is not null;
do $bootstrap$
begin
  if to_regprocedure('public.inventory_usable_quantity(uuid)') is null then
    execute $sql$create function public.inventory_usable_quantity(p_item_id uuid)
      returns numeric language sql stable as $body$
      select coalesce((select quantity_on_hand from public.inventory_items where id=p_item_id),0);
    $body$$sql$;
  end if;
end;
$bootstrap$;
alter table public.inventory_items
  add column if not exists quantity_scale smallint not null default 3,
  add column if not exists batch_consumption_enabled boolean not null default false;
do $bootstrap$
begin
  if to_regprocedure('public.inventory_quantity_matches_scale(numeric,smallint)') is null then
    execute $sql$create function public.inventory_quantity_matches_scale(p_quantity numeric,p_scale smallint)
      returns boolean language sql immutable as $body$
      select p_quantity=round(p_quantity,p_scale);
    $body$$sql$;
  end if;
end;
$bootstrap$;

insert into auth.users(id,instance_id,aud,role,email)
values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meal-manager@example.test'),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meal-customer@example.test'),
 ('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meal-cashier@example.test');
insert into public.profiles(id,role,is_active)
values
 ('11111111-1111-4111-8111-111111111111','manager',true),
 ('22222222-2222-4222-8222-222222222222','customer',true),
 ('33333333-3333-4333-8333-333333333333','cashier',true)
on conflict (id) do update set role=excluded.role,is_active=true;

insert into public.menu_categories(id,name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic Meals');
insert into public.menu_items(id,category_id,code,name,price)
values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEALSYN','Synthetic Biryani',200),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RICESYN','Synthetic Extra Rice',35),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ORDSYN','Ordinary Meal',80);
insert into public.cashier_shifts(id,cashier_id,terminal,opening_cash)
values ('abababab-abab-4bab-8bab-abababababab',
  '33333333-3333-4333-8333-333333333333','Synthetic Terminal',100);
-- The product has no rice recipe yet. Its old {id,qty} order remains ordinary.
create temp table meal_test_orders(kind text, id uuid, subtotal numeric);
grant select,insert on meal_test_orders to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into meal_test_orders
select 'pre mapping',order_id,subtotal from public.place_customer_order(
  'Test Customer','09123456789','Synthetic address','',
  '[{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1}]'::jsonb,
  'eeeeeeee-eeee-4eee-8eee-111111111111');
do $test$
begin
  begin
    perform public.place_customer_order('Test Customer','09123456789','Synthetic address','',
      '[{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","qty":1,"meal_option":"with_rice"}]'::jsonb,
      'eeeeeeee-eeee-4eee-8eee-222222222222');
    raise exception 'Unconfigured Customer meal choice accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'Meal option is unavailable%' then raise; end if;
  end;
end;
$test$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $test$
begin
  begin
    perform public.create_walk_in_sale(
      'eeeeeeee-eeee-4eee-8eee-333333333333',
      'takeout'::public.fulfillment_type,
      'Synthetic Guest',null,null,null,null,null,
      'cash'::public.payment_method,500,null,
      '[{"menu_item_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1,"meal_option":"with_rice"}]'::jsonb);
    raise exception 'Unconfigured Cashier meal choice accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'Meal option is unavailable%' then raise; end if;
  end;
end;
$test$;
reset role;
do $test$
begin
  begin
    update public.menu_items set without_rice_price=170
    where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    raise exception 'Price-only meal option bypassed the database constraint';
  exception when check_violation then null; end;
end;
$test$;
insert into public.inventory_items(id,item_name,unit,quantity_on_hand)
values ('abababab-abab-4bab-8bab-111111111111','Synthetic Rice','kg',10);

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $test$
declare v public.menu_items%rowtype;
begin
  perform public.set_manager_fixed_meal_option(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,
    'abababab-abab-4bab-8bab-111111111111',0.2);
  select * into v from public.menu_items where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v.price<>200 or v.without_rice_price<>170 then raise exception 'Manager config did not persist'; end if;
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,null);
    raise exception 'Manager enabled meal choices without a rice mapping';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,210,null);
    raise exception 'Invalid price accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','NaN'::numeric,170,null);
    raise exception 'NaN standard price accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,'NaN'::numeric,null);
    raise exception 'NaN alternative price accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.create_walk_in_sale(
      'eeeeeeee-eeee-4eee-8eee-444444444444',
      'takeout'::public.fulfillment_type,
      'Synthetic Guest',null,null,null,null,null,
      'cash'::public.payment_method,500,null,
      '[{"menu_item_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","quantity":1}]'::jsonb);
    raise exception 'Manager created Cashier-only walk-in sale';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'Only an active cashier%' then raise; end if;
  end;
end;
$test$;

set local role anon;
do $test$
begin
  if (select count(*) from public.get_fixed_meal_options()
      where menu_item_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        and standard_price=200 and without_rice_price=170)<>1 then
    raise exception 'Public fixed meal read projection missing'; end if;
end;
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $test$
begin
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,160,null);
    raise exception 'Customer changed configuration';
  exception when insufficient_privilege then null; end;
end;
$test$;

insert into meal_test_orders
select 'mixed',order_id,subtotal from public.place_customer_order(
  'Test Customer','09123456789','Synthetic address','',
  jsonb_build_array(
    jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qty',1,'meal_option','with_rice'),
    jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qty',1,'meal_option','without_rice','unit_price',1),
    jsonb_build_object('id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','qty',1)),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
do $test$
declare v_id uuid; v_subtotal numeric;
begin
  select id,subtotal into v_id,v_subtotal from meal_test_orders where kind='mixed';
  if v_subtotal<>405 then raise exception 'Incorrect mixed subtotal: %',v_subtotal; end if;
  if (select count(*) from public.order_items where order_id=v_id)<>3 then
    raise exception 'Mixed choices merged'; end if;
  if not exists (select 1 from public.order_items where order_id=v_id and unit_price=170
    and modifiers @> '[{"id":"fixed_meal:without_rice"}]'::jsonb) then
    raise exception 'Without Rice snapshot missing'; end if;
  if not exists (select 1 from public.order_items where order_id=v_id and unit_price=200
    and modifiers @> '[{"id":"fixed_meal:with_rice"}]'::jsonb) then
    raise exception 'With Rice snapshot missing'; end if;
  if not exists (select 1 from public.order_items where order_id=v_id and unit_price=35
    and modifiers='[]'::jsonb) then raise exception 'Separate rice product changed'; end if;
  begin
    perform public.place_customer_order('Test Customer','09123456789','Synthetic address','',
      jsonb_build_array(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'qty',1,'meal_option','other')),
      'ffffffff-ffff-4fff-8fff-ffffffffffff');
    raise exception 'Invalid meal choice accepted';
  exception when others then
    if sqlerrm='Invalid meal choice accepted' then raise; end if;
  end;
  begin
    perform public.place_customer_order('Test Customer','09123456789','Synthetic address','',
      jsonb_build_array(jsonb_build_object('id','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'qty',1,'meal_option','without_rice')),
      '99999999-9999-4999-8999-999999999999');
    raise exception 'Ordinary product accepted meal choice';
  exception when others then
    if sqlerrm='Ordinary product accepted meal choice' then raise; end if;
  end;
end;
$test$;

reset role;
do $test$
begin
  if (select current_status from public.orders
      where id=(select id from meal_test_orders where kind='mixed'))
      <>'waiting_payment_verification'::public.order_status
    or exists(select 1 from public.payments
      where order_id=(select id from meal_test_orders where kind='mixed')) then
    raise exception 'Customer payment state changed during order creation'; end if;
end;
$test$;
set local role authenticated;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $test$
declare v_sale record;
begin
  select * into v_sale from public.create_walk_in_sale(
    '12345678-1234-4234-8234-123456789abc',
    'takeout'::public.fulfillment_type,
    'Synthetic Guest',null,null,null,null,null,
    'cash'::public.payment_method,500,null,
    jsonb_build_array(
      jsonb_build_object('menu_item_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'quantity',1,'meal_option','with_rice'),
      jsonb_build_object('menu_item_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'quantity',1,'meal_option','without_rice','unit_price',1),
      jsonb_build_object('menu_item_id','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'quantity',1)));
  if v_sale.subtotal <> 450 or v_sale.grand_total <> 450 then
    raise exception 'Cashier subtotal/total incorrect: %/%',v_sale.subtotal,v_sale.grand_total; end if;
  if (select count(*) from public.order_items where order_id=v_sale.order_id)<>3 then
    raise exception 'Cashier mixed choices merged'; end if;
  if not exists (select 1 from public.order_items where order_id=v_sale.order_id
    and unit_price=170 and modifiers @> '[{"id":"fixed_meal:without_rice"}]'::jsonb) then
    raise exception 'Cashier Without Rice snapshot missing'; end if;
  if (select subtotal from public.create_walk_in_sale(
    '12345678-1234-4234-8234-123456789abc',
    'takeout'::public.fulfillment_type,'Synthetic Guest',null,null,null,null,null,
    'cash'::public.payment_method,500,null,'[]'::jsonb)) <> 450 then
    raise exception 'Cashier idempotent replay changed amount'; end if;
  begin
    perform public.create_walk_in_sale(
      '16161616-1616-4616-8616-161616161616',
      'takeout'::public.fulfillment_type,'Synthetic Guest',null,null,null,null,null,
      'cash'::public.payment_method,500,null,
      jsonb_build_array(jsonb_build_object('menu_item_id',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','quantity',1,'meal_option','invalid')));
    raise exception 'Cashier invalid meal choice accepted';
  exception when others then
    if sqlerrm='Cashier invalid meal choice accepted' then raise; end if;
  end;
end;
$test$;

reset role;
do $test$
begin
  if not exists(select 1 from public.cashier_transactions t
    join public.payments p on p.id=t.payment_id and p.order_id=t.order_id
    join public.orders o on o.id=t.order_id
    where t.request_id='12345678-1234-4234-8234-123456789abc'
      and p.amount=o.grand_total and o.grand_total=450
      and t.receipt_number is not null) then
    raise exception 'Cashier payment, transaction, or receipt link changed'; end if;
end;
$test$;
insert into public.menu_modifier_groups(id,name,selection_type,min_selections,max_selections)
values ('synthetic-side','Synthetic side','single',0,1);
insert into public.menu_modifier_options(id,group_id,name,price_adjustment)
values ('synthetic-sauce','synthetic-side','Synthetic sauce',10);
insert into public.menu_item_modifier_groups(menu_item_id,group_id)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','synthetic-side');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $test$
begin
  begin
    perform public.set_manager_fixed_meal_option(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',80,70,
      'abababab-abab-4bab-8bab-111111111111',0.2);
    raise exception 'Meal option enabled over active modifier';
  exception when others then
    if sqlerrm='Meal option enabled over active modifier' then raise; end if;
  end;
end;
$test$;
select * from public.set_manager_fixed_meal_option(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,160,
  'abababab-abab-4bab-8bab-111111111111');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $test$
declare v_subtotal numeric;
begin
  select subtotal into v_subtotal from public.place_customer_order(
    'Test Customer','09123456789','Synthetic address','',
    jsonb_build_array(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'qty',1,'meal_option','without_rice')),
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  if v_subtotal<>405 then raise exception 'Idempotent replay repriced an existing order'; end if;
  if not exists (select 1 from public.order_items oi
    join meal_test_orders t on t.id=oi.order_id where t.kind='mixed'
      and oi.unit_price=170 and oi.modifiers @> '[{"id":"fixed_meal:without_rice"}]'::jsonb) then
    raise exception 'Historical meal amount changed'; end if;
  select subtotal into v_subtotal from public.place_customer_order(
    'Test Customer','09123456789','Synthetic address','',
    jsonb_build_array(jsonb_build_object('id','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'qty',1,'modifier_ids',jsonb_build_array('synthetic-sauce'))),
    '15151515-1515-4515-8515-151515151515');
  if v_subtotal<>90 then raise exception 'Legacy modifier price changed: %',v_subtotal; end if;
end;
$test$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select * from public.set_manager_fixed_meal_option(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,
  'abababab-abab-4bab-8bab-111111111111');

-- Synthetic recipe only: 0.2 is test data, not a Chicken Biryani recipe claim.
reset role;
update public.inventory_items set quantity_on_hand=0
where id='abababab-abab-4bab-8bab-111111111111';
insert into public.inventory_items(id,item_name,unit,quantity_on_hand,quantity_scale)
values ('abababab-abab-4bab-8bab-333333333333','Synthetic Whole-Unit Item','pcs',0,0);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $test$
begin
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,
      'abababab-abab-4bab-8bab-333333333333',0.2);
    raise exception 'Fractional recipe quantity accepted for whole-unit inventory';
  exception when sqlstate '22023' then null; end;
end;
$test$;
reset role;
do $test$
begin
  if exists (select 1 from public.menu_ingredients
    where menu_item_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and inventory_item_id='abababab-abab-4bab-8bab-333333333333') then
    raise exception 'Rejected recipe link was inserted'; end if;
end;
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select * from public.set_manager_fixed_meal_option(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,
  'abababab-abab-4bab-8bab-111111111111',0.2);
do $test$
begin
  if (select count(*) from public.get_manager_fixed_meal_inventory_candidates()
    where inventory_item_id='abababab-abab-4bab-8bab-111111111111')<>1 then
    raise exception 'Manager cannot read the active inventory candidate'; end if;
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,
      'abababab-abab-4bab-8bab-111111111111',0.3);
    raise exception 'Existing recipe quantity was rewritten';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,null);
    raise exception 'Configured rice exclusion was silently removed';
  exception when sqlstate '22023' then null; end;
  perform public.set_manager_fixed_meal_option(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,null,null);
  begin
    perform public.set_manager_fixed_meal_option(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,null);
    raise exception 'Previously added rice link was abandoned on re-enable';
  exception when sqlstate '22023' then null; end;
  perform public.set_manager_fixed_meal_option(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',200,170,
    'abababab-abab-4bab-8bab-111111111111');
end;
$test$;
reset role;
do $test$
begin
  if (select quantity_required from public.menu_ingredients
    where menu_item_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and inventory_item_id='abababab-abab-4bab-8bab-111111111111') is distinct from 0.2 then
    raise exception 'Manager-approved recipe quantity missing or changed'; end if;
  if (select fixed_meal_added_at from public.menu_ingredients
    where menu_item_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and inventory_item_id='abababab-abab-4bab-8bab-111111111111') is null then
    raise exception 'New recipe link has no activation timestamp'; end if;
end;
$test$;
update public.orders set current_status='confirmed'
where id=(select id from meal_test_orders where kind='pre mapping');
select public.deduct_inventory_for_confirmed_order(
  (select id from meal_test_orders where kind='pre mapping'));
do $test$
begin
  if exists(select 1 from public.inventory_transactions
    where order_id=(select id from meal_test_orders where kind='pre mapping')
      and inventory_item_id='abababab-abab-4bab-8bab-111111111111') then
    raise exception 'Pre-mapping order retroactively consumed rice'; end if;
  if exists(select 1 from public.order_items oi
    where oi.order_id=(select id from meal_test_orders where kind='pre mapping')
      and oi.modifiers @> '[{"id":"fixed_meal:with_rice","rice_inventory_item_id":"abababab-abab-4bab-8bab-111111111111"}]'::jsonb) then
    raise exception 'Pre-mapping order gained a rice snapshot'; end if;
end;
$test$;
set local role anon;
do $test$
begin
  if (select count(*) from public.get_fixed_meal_options()
    where menu_item_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and not with_rice_available and without_rice_available)<>1 then
    raise exception 'Rice-only shortage hid Without Rice or exposed With Rice'; end if;
end;
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into meal_test_orders
select 'without mapped rice',order_id,subtotal from public.place_customer_order(
  'Test Customer','09123456789','Synthetic address','',
  jsonb_build_array(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'qty',1,'meal_option','without_rice')),
  '12121212-1212-4212-8212-121212121212');
do $test$
begin
  begin
    perform public.place_customer_order('Test Customer','09123456789','Synthetic address','',
      jsonb_build_array(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'qty',1,'meal_option','with_rice')),
      '13131313-1313-4313-8313-131313131313');
    raise exception 'With Rice bypassed unavailable rice';
  exception when others then
    if sqlerrm='With Rice bypassed unavailable rice' then raise; end if;
  end;
end;
$test$;
reset role;
update public.orders set current_status='confirmed'
where id=(select id from meal_test_orders where kind='without mapped rice');
select public.deduct_inventory_for_confirmed_order(
  (select id from meal_test_orders where kind='without mapped rice'));
do $test$
begin
  if (select quantity_on_hand from public.inventory_items
    where id='abababab-abab-4bab-8bab-111111111111')<>0 then
    raise exception 'Without Rice consumed mapped rice'; end if;
end;
$test$;
update public.inventory_items set quantity_on_hand=1
where id='abababab-abab-4bab-8bab-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into meal_test_orders
select 'with mapped rice',order_id,subtotal from public.place_customer_order(
  'Test Customer','09123456789','Synthetic address','',
  jsonb_build_array(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'qty',1,'meal_option','with_rice')),
  '14141414-1414-4414-8414-141414141414');
reset role;
do $test$
begin
  if not exists(select 1 from public.order_items oi
    where oi.order_id=(select id from meal_test_orders where kind='with mapped rice')
      and oi.modifiers @> '[{"id":"fixed_meal:with_rice","rice_inventory_item_id":"abababab-abab-4bab-8bab-111111111111"}]'::jsonb) then
    raise exception 'New With Rice snapshot lacks the approved rice mapping'; end if;
end;
$test$;
update public.orders set current_status='confirmed'
where id=(select id from meal_test_orders where kind='with mapped rice');
select public.deduct_inventory_for_confirmed_order(
  (select id from meal_test_orders where kind='with mapped rice'));
do $test$
begin
  if (select quantity_on_hand from public.inventory_items
    where id='abababab-abab-4bab-8bab-111111111111')<>0.8 then
    raise exception 'With Rice issuance incorrect'; end if;
end;
$test$;

-- A non-rice shortage must still block both choices.
insert into public.inventory_items(id,item_name,unit,quantity_on_hand)
values ('abababab-abab-4bab-8bab-222222222222','Synthetic Other Ingredient','kg',0);
insert into public.menu_ingredients(menu_item_id,inventory_item_id,quantity_required)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'abababab-abab-4bab-8bab-222222222222',0.1);
set local role anon;
do $test$
begin
  if (select count(*) from public.get_fixed_meal_options()
    where menu_item_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and not with_rice_available and not without_rice_available)<>1 then
    raise exception 'Other ingredient shortage did not block both choices'; end if;
end;
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $test$
begin
  begin
    perform public.get_manager_fixed_meal_inventory_candidates();
    raise exception 'Customer read Manager inventory candidates';
  exception when insufficient_privilege then null; end;
  begin
    perform public.place_customer_order('Test Customer','09123456789','Synthetic address','',
      jsonb_build_array(jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'qty',1,'meal_option','without_rice')),
      '16161616-1616-4616-8616-161616161616');
    raise exception 'Without Rice bypassed another ingredient shortage';
  exception when others then
    if sqlerrm='Without Rice bypassed another ingredient shortage' then raise; end if;
  end;
end;
$test$;

rollback;
