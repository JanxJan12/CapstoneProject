\set ON_ERROR_STOP on
-- Synthetic targeted fixture on a cloned post-retirement database.
create or replace function auth.jwt() returns jsonb language sql stable as $jwt$
  select coalesce(nullif(current_setting('request.jwt.claim',true),''),
    nullif(current_setting('request.jwt.claims',true),''))::jsonb;
$jwt$;
alter table public.orders add column if not exists customer_request_id uuid;
create unique index if not exists orders_customer_request_id_uidx
  on public.orders(customer_id,customer_request_id) where customer_request_id is not null;
insert into auth.users(id,instance_id,aud,role,email) values
 ('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-customer@example.test'),
 ('c2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','quote-other@example.test')
on conflict(id) do nothing;
insert into public.profiles(id,role,is_active) values
 ('c1111111-1111-4111-8111-111111111111','customer',true),
 ('c2222222-2222-4222-8222-222222222222','customer',true)
on conflict(id) do update set role=excluded.role,is_active=true;
insert into public.inventory_items(id,item_name,unit,quantity_on_hand)
 values ('f9999999-9999-4999-8999-999999999999','Quote mapped rice','kg',10)
on conflict(id) do nothing;
insert into public.menu_ingredients(menu_item_id,inventory_item_id,quantity_required)
values ('b3333333-3333-4333-8333-333333333333',
  'f9999999-9999-4999-8999-999999999999',0.2)
on conflict do nothing;
update public.menu_items set without_rice_price=90,
  without_rice_inventory_item_id='f9999999-9999-4999-8999-999999999999'
  where id='b3333333-3333-4333-8333-333333333333';
create or replace function public.quote_test_order_count() returns integer
language sql security definer set search_path='' as $q$
  select count(*)::integer from public.orders;
$q$;
create or replace function public.quote_test_order_line_count(p_order_id uuid) returns integer
language sql security definer set search_path='' as $q$
  select count(*)::integer from public.order_items where order_id=p_order_id;
$q$;
create or replace function public.quote_test_order_snapshot(p_order_id uuid) returns jsonb
language sql security definer set search_path='' as $q$
  select modifiers from public.order_items where order_id=p_order_id limit 1;
$q$;
create or replace function public.quote_test_business_state() returns jsonb
language sql security definer set search_path='' as $q$
  select pg_catalog.jsonb_build_object('orders',(select count(*) from public.orders),
    'payments',(select count(*) from public.payments),
    'order_sequence',(select last_value from public.order_number_seq),
    'stock',(select coalesce(sum(quantity_on_hand),0) from public.inventory_items));
$q$;
create or replace function public.quote_test_change_price(p_price numeric) returns void
language sql security definer set search_path='' as $q$
  update public.menu_items set price=p_price where id='b3333333-3333-4333-8333-333333333333';
$q$;
create or replace function public.quote_test_change_availability(p_available boolean) returns void
language sql security definer set search_path='' as $q$
  update public.menu_items set is_available=p_available
    where id='b3333333-3333-4333-8333-333333333333';
$q$;
create or replace function public.quote_test_expire_token(p_token text) returns text
language plpgsql security definer set search_path='' as $q$
declare v_payload text; v_secret bytea;
begin
  v_payload := (pg_catalog.convert_from(pg_catalog.decode(split_part(p_token,'.',1),'hex'),'UTF8')::jsonb
    || pg_catalog.jsonb_build_object('expires_at','2020-01-01T00:00:00Z'))::text;
  select secret into v_secret from customer_quote_private.signing_key where singleton;
  return pg_catalog.encode(pg_catalog.convert_to(v_payload,'UTF8'),'hex') || '.' ||
    pg_catalog.encode(extensions.hmac(pg_catalog.convert_to(v_payload,'UTF8'),v_secret,'sha256'),'hex');
end $q$;
grant execute on function public.quote_test_order_count(),public.quote_test_order_line_count(uuid),
  public.quote_test_change_price(numeric), public.quote_test_expire_token(text),
  public.quote_test_change_availability(boolean),
  public.quote_test_order_snapshot(uuid), public.quote_test_business_state() to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims',
 '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"d1111111-1111-4111-8111-111111111111"}',true);
create temp table quote_cases(name text, subtotal numeric, fee numeric, total numeric, token text, request_id uuid, items jsonb);
grant select,insert on quote_cases to authenticated;
create temp table quote_baseline as select public.quote_test_order_count() as orders;
grant select on quote_baseline to authenticated;
create temp table quote_business_baseline as select public.quote_test_business_state() as state;
grant select on quote_business_baseline to authenticated;
insert into quote_cases
select 'ordinary',q.subtotal,q.delivery_fee,q.grand_total,q.quote_token,
 'fa000000-0000-4000-8000-000000000101',
 '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[]}]'::jsonb
from public.quote_customer_order('QA Customer','09123456789','QA address',null,
 '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[]}]'::jsonb,
 'fa000000-0000-4000-8000-000000000101') q;
do $test$ begin
 if not exists(select 1 from quote_cases where name='ordinary' and subtotal=120 and fee=50 and total=170)
 then raise exception 'Ordinary quote failed'; end if;
end $test$;
insert into quote_cases
select 'drink',q.subtotal,q.delivery_fee,q.grand_total,q.quote_token,
 'fa000000-0000-4000-8000-000000000102',
 '[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":2,"modifier_ids":["drink-coke","drink-large"]}]'::jsonb
from public.quote_customer_order('QA Customer','09123456789','QA address',null,
 '[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":2,"modifier_ids":["drink-coke","drink-large"]}]'::jsonb,
 'fa000000-0000-4000-8000-000000000102') q;
insert into quote_cases
select 'without_rice',q.subtotal,q.delivery_fee,q.grand_total,q.quote_token,
 'fa000000-0000-4000-8000-000000000103',
 '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[],"meal_option":"without_rice"}]'::jsonb
from public.quote_customer_order('QA Customer','09123456789','QA address',null,
 '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[],"meal_option":"without_rice"}]'::jsonb,
 'fa000000-0000-4000-8000-000000000103') q;
insert into quote_cases
select 'mixed',q.subtotal,q.delivery_fee,q.grand_total,q.quote_token,
 'fa000000-0000-4000-8000-000000000104',
 '[{"id":"b3333333-3333-4333-8333-333333333333","qty":2,"modifier_ids":[],"meal_option":"with_rice"},{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":["drink-sprite","drink-regular"]}]'::jsonb
from public.quote_customer_order('QA Customer','09123456789','QA address',null,
 '[{"id":"b3333333-3333-4333-8333-333333333333","qty":2,"modifier_ids":[],"meal_option":"with_rice"},{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":["drink-sprite","drink-regular"]}]'::jsonb,
 'fa000000-0000-4000-8000-000000000104') q;
do $test$
declare c quote_cases%rowtype; v_order record; v_before integer;
begin
  if not exists(select 1 from quote_cases where name='drink' and subtotal=90 and total=140)
    or not exists(select 1 from quote_cases where name='without_rice' and subtotal=90 and total=140)
    or not exists(select 1 from quote_cases where name='mixed' and subtotal=270 and total=320) then
    raise exception 'Drink or fixed meal quote incorrect'; end if;
  if pg_catalog.has_function_privilege('authenticated',
    'public.place_customer_order(text,text,text,text,jsonb,uuid)','EXECUTE') then
    raise exception 'Old writer remains callable by Customer'; end if;
  if pg_catalog.has_function_privilege('anon',
    'public.quote_customer_order(text,text,text,text,jsonb,uuid)','EXECUTE') then
    raise exception 'Anonymous quote execution allowed'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Cashier quoted Customer order' using errcode='XX000';
  exception when sqlstate '42501' then null; end;
  perform pg_catalog.set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
  perform pg_catalog.set_config('request.jwt.claims',
    '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"d2222222-2222-4222-8222-222222222222"}',true);
  select * into c from quote_cases where name='ordinary';
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
      c.items,c.request_id,c.token);
    raise exception 'Other session accepted quote' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  perform pg_catalog.set_config('request.jwt.claims',
    '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"d1111111-1111-4111-8111-111111111111"}',true);
  if (select subtotal from public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[],"unit_price":0.01}]'::jsonb,
      pg_catalog.gen_random_uuid())) <> 120 then
    raise exception 'Client price override changed quote'; end if;
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":["drink-large"]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Wrong-product drink choice accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":["drink-coke","drink-invalid"]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Invalid drink choice accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":["drink-coke","drink-regular"],"meal_option":"without_rice"}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Unconfigured meal choice accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","qty":1,"modifier_ids":[]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Invalid product accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":1,"modifier_ids":[]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Missing drink choices accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"b3333333-3333-4333-8333-333333333333","qty":0,"modifier_ids":[]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Invalid quantity accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    perform public.quote_customer_order('QA Customer','09123456789','',null,
      '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Empty address accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null;
  end;
  perform public.quote_test_change_availability(false);
  begin
    perform public.quote_customer_order('QA Customer','09123456789','QA address',null,
      '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[]}]'::jsonb,
      pg_catalog.gen_random_uuid());
    raise exception 'Unavailable product quoted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  perform public.quote_test_change_availability(true);
  select public.quote_test_order_count() into v_before;
  if v_before <> (select orders from quote_baseline) then raise exception 'Quote created an order'; end if;
  if public.quote_test_business_state() <> (select state from quote_business_baseline) then
    raise exception 'Quotes changed business state'; end if;
  select * into c from quote_cases where name='ordinary';
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','Other address',null,
      c.items,c.request_id,c.token);
    raise exception 'Changed address accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
      '[{"id":"b3333333-3333-4333-8333-333333333333","qty":2,"modifier_ids":[]}]'::jsonb,
      c.request_id,c.token);
    raise exception 'Changed quantity accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
      c.items,c.request_id,c.token || '0');
    raise exception 'Forged token accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
      c.items,c.request_id,public.quote_test_expire_token(c.token));
    raise exception 'Expired token accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  perform pg_catalog.set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
      c.items,c.request_id,c.token);
    raise exception 'Cross-customer token accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  perform pg_catalog.set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
  select * into c from quote_cases where name='drink';
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
      '[{"id":"3c78b355-2613-4f5b-af4d-ac2197d957fe","qty":2,"modifier_ids":["drink-sprite","drink-large"]}]'::jsonb,
      c.request_id,c.token);
    raise exception 'Changed drink choice accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  select * into c from quote_cases where name='ordinary';
  perform public.quote_test_change_price(121);
  begin
    perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
      c.items,c.request_id,c.token);
    raise exception 'Changed price accepted' using errcode='XX000';
  exception when sqlstate 'P0001' then null; end;
  perform public.quote_test_change_price(120);
  if public.quote_test_order_count() <> v_before then raise exception 'Stale quote created an order'; end if;
  if public.quote_test_business_state() <> (select state from quote_business_baseline) then
    raise exception 'Stale quote changed payment or stock'; end if;
  select * into v_order from public.place_customer_order_confirmed(
    'QA Customer','09123456789','QA address',null,c.items,c.request_id,c.token);
  if v_order.subtotal <> 120 or v_order.delivery_fee <> 50 or v_order.grand_total <> 170
    or public.quote_test_order_line_count(v_order.order_id) <> 1
    or public.quote_test_order_snapshot(v_order.order_id)->0->>'name' <> 'With Rice' then
    raise exception 'Confirmed order amounts or snapshots incorrect'; end if;
  if public.quote_test_order_count() <> v_before+1 then raise exception 'Order count incorrect'; end if;
  perform public.place_customer_order_confirmed('QA Customer','09123456789','QA address',null,
    c.items,c.request_id,c.token);
  if public.quote_test_order_count() <> v_before+1 then raise exception 'Idempotency failed'; end if;
end $test$;
rollback;
