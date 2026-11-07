\set ON_ERROR_STOP on
begin;

insert into auth.users(id,instance_id,aud,role,email) values
  ('51111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meal-kds-manager@example.test'),
  ('52222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','meal-kds-customer@example.test');
insert into public.profiles(id,role,is_active) values
  ('51111111-1111-4111-8111-111111111111','manager',true),
  ('52222222-2222-4222-8222-222222222222','customer',true)
on conflict(id) do update set role=excluded.role,is_active=true;
insert into public.menu_categories(id,name)
values('53333333-3333-4333-8333-333333333333','Synthetic KDS Meals');
insert into public.menu_items(id,category_id,code,name,price) values
  ('54444444-4444-4444-8444-444444444444','53333333-3333-4333-8333-333333333333','KDSMEAL','Synthetic KDS Meal',200),
  ('55555555-5555-4555-8555-555555555555','53333333-3333-4333-8333-333333333333','KDSDRINK','Synthetic KDS Drink',50),
  ('57777777-7777-4777-8777-777777777777','53333333-3333-4333-8333-333333333333','KDSEXTRA','Synthetic Extra Rice',35),
  ('58888888-8888-4888-8888-888888888888','53333333-3333-4333-8333-333333333333','KDSPLAIN','Synthetic Plain Item',25);
insert into public.inventory_items(id,item_name,unit,quantity_on_hand)
values('59999999-9999-4999-8999-999999999999','Synthetic KDS Rice','kg',1);
insert into public.menu_modifier_groups(id,name,selection_type,min_selections,max_selections)
values('synthetic-kds-flavor','Synthetic flavor','single',1,1);
insert into public.menu_modifier_options(id,group_id,name,price_adjustment)
values('synthetic-kds-calamansi','synthetic-kds-flavor','Calamansi',0);
insert into public.menu_item_modifier_groups(menu_item_id,group_id)
values('55555555-5555-4555-8555-555555555555','synthetic-kds-flavor');

set local role authenticated;
select set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);
select * from public.set_manager_fixed_meal_option(
  '54444444-4444-4444-8444-444444444444',200,170,
  '59999999-9999-4999-8999-999999999999',0.2);
select set_config('request.jwt.claim.sub','52222222-2222-4222-8222-222222222222',true);
do $test$
begin
  begin
    perform public.place_customer_order(
      'Synthetic Customer','09123456789','Synthetic address','',
      '[{"id":"55555555-5555-4555-8555-555555555555","qty":1}]'::jsonb,
      '56666666-6666-4666-8666-888888888888');
    raise exception 'Required drink accepted without a flavor';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%requires 1 selection(s).' then raise; end if;
  end;
end;
$test$;
create temp table meal_kds_order(id uuid);
insert into meal_kds_order
select order_id from public.place_customer_order(
  'Synthetic Customer','09123456789','Synthetic address','',
  jsonb_build_array(
    jsonb_build_object('id','54444444-4444-4444-8444-444444444444','qty',1,'meal_option','with_rice'),
    jsonb_build_object('id','54444444-4444-4444-8444-444444444444','qty',1,'meal_option','without_rice'),
    jsonb_build_object('id','55555555-5555-4555-8555-555555555555','qty',1,
      'modifier_ids',jsonb_build_array('synthetic-kds-calamansi')),
    jsonb_build_object('id','57777777-7777-4777-8777-777777777777','qty',1),
    jsonb_build_object('id','58888888-8888-4888-8888-888888888888','qty',1)),
  '56666666-6666-4666-8666-666666666666');
create temp table meal_kds_ordinary_order(id uuid);
insert into meal_kds_ordinary_order
select order_id from public.place_customer_order(
  'Synthetic Customer','09123456789','Synthetic address','',
  '[{"id":"58888888-8888-4888-8888-888888888888","qty":1}]'::jsonb,
  '56666666-6666-4666-8666-777777777777');
reset role;
update public.orders set current_status='confirmed',created_at=now()-interval '1 hour'
where id=(select id from meal_kds_order);
update public.orders set current_status='preparing' where id=(select id from meal_kds_ordinary_order);
create temp table meal_kds_terminal(id uuid,secret text);
with t as (
  insert into public.kds_terminals(terminal_name,secret_hash)
  values('Synthetic Meal KDS',encode(extensions.digest('synthetic-meal-kds-secret','sha256'),'hex'))
  returning id
) insert into meal_kds_terminal select id,'synthetic-meal-kds-secret' from t;
grant select on meal_kds_order,meal_kds_ordinary_order,meal_kds_terminal to anon;
set local role anon;
do $test$
declare v_id uuid; v_secret text; v_order uuid; v_items jsonb;
begin
  select id,secret into v_id,v_secret from pg_temp.meal_kds_terminal;
  select id into v_order from pg_temp.meal_kds_order;
  if (select count(*) from public.get_kds_queue(v_id,v_secret)) <>
     (select count(*) from public.get_kds_queue_v2(v_id,v_secret)) then
    raise exception 'KDS v2 changed terminal-authorized ticket count'; end if;
  if (select array_agg(order_id order by created_at) from public.get_kds_queue(v_id,v_secret))
    is distinct from
     (select array_agg(order_id order by created_at) from public.get_kds_queue_v2(v_id,v_secret)) then
    raise exception 'KDS v2 changed queue chronology'; end if;
  select items into v_items from public.get_kds_queue_v2(v_id,v_secret) where order_id=v_order;
  if jsonb_array_length(v_items)<>5
    or not exists(select 1 from jsonb_array_elements(v_items) i
      where i->>'item_name'='Synthetic KDS Meal'
        and i->'modifiers' @> '[{"id":"fixed_meal:with_rice","name":"With Rice"}]'::jsonb)
    or not exists(select 1 from jsonb_array_elements(v_items) i
      where i->>'item_name'='Synthetic KDS Meal'
        and i->'modifiers' @> '[{"id":"fixed_meal:without_rice","name":"Without Rice"}]'::jsonb)
    or not exists(select 1 from jsonb_array_elements(v_items) i
      where i->'modifiers' @> '[{"id":"synthetic-kds-calamansi","name":"Calamansi"}]'::jsonb) then
    raise exception 'KDS meal choices or required drink flavor missing'; end if;
  if not exists(select 1 from jsonb_array_elements(v_items) i
      where i->>'item_name'='Synthetic Extra Rice' and i->'modifiers'='[]'::jsonb)
    or not exists(select 1 from jsonb_array_elements(v_items) i
      where i->>'item_name'='Synthetic Plain Item' and i->'modifiers'='[]'::jsonb) then
    raise exception 'Extra Rice or ordinary item was changed or hidden'; end if;
  if exists(select 1 from jsonb_array_elements(v_items) i
      cross join lateral jsonb_array_elements(i->'modifiers') as modifier(value)
      where modifier.value ?| array['rice_inventory_item_id','excluded_inventory_item_id'])
    or exists(select 1 from public.get_kds_queue_v2(v_id,v_secret) q
      where to_jsonb(q) ?| array['customer_name','customer_contact_number',
        'delivery_address','payment_id','grand_total','proof_image_path']) then
    raise exception 'KDS response exposed unrelated inventory, customer, or payment data'; end if;
  if exists(select 1 from public.get_kds_queue_v2(v_id,v_secret) q
      join public.get_kds_queue(v_id,v_secret) base using(order_id)
      where q.current_status is distinct from base.current_status
        or q.created_at is distinct from base.created_at) then
    raise exception 'KDS status or queue chronology changed'; end if;
  if not exists(select 1 from public.get_kds_queue_v2(v_id,v_secret)
      where order_id=(select id from pg_temp.meal_kds_ordinary_order)
        and current_status='preparing'::public.order_status) then
    raise exception 'Existing ordinary preparing order was hidden'; end if;
  begin
    perform 1 from public.get_kds_queue_v2(v_id,'wrong-secret');
    raise exception 'Wrong KDS secret accepted';
  exception when others then
    if sqlerrm='Wrong KDS secret accepted' then raise; end if;
  end;
end;
$test$;

reset role;
update public.kds_terminals set is_active=false where id=(select id from meal_kds_terminal);
set local role anon;
do $test$
declare v_id uuid; v_secret text;
begin
  select id,secret into v_id,v_secret from pg_temp.meal_kds_terminal;
  begin
    perform 1 from public.get_kds_queue_v2(v_id,v_secret);
    raise exception 'Inactive KDS terminal accepted';
  exception when others then
    if sqlerrm='Inactive KDS terminal accepted' then raise; end if;
  end;
end;
$test$;
reset role;
do $test$
begin
  if (select count(*) from public.order_items oi
      where oi.order_id=(select id from meal_kds_order)
        and oi.modifiers @> '[{"id":"fixed_meal:with_rice","name":"With Rice","rice_inventory_item_id":"59999999-9999-4999-8999-999999999999"}]'::jsonb)<>1
    or (select count(*) from public.order_items oi
      where oi.order_id=(select id from meal_kds_order)
        and oi.modifiers @> '[{"id":"fixed_meal:without_rice","name":"Without Rice","excluded_inventory_item_id":"59999999-9999-4999-8999-999999999999"}]'::jsonb)<>1 then
    raise exception 'Stored order-line meal choices changed after Kitchen read'; end if;
end;
$test$;

rollback;
