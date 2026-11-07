\set ON_ERROR_STOP on
-- Disposable retirement_b_receipt_20261022 only. Persist one synthetic sale
-- and its original receipt values so the exact B migration can run between
-- this file and verify_migration_b_receipt_after_local.sql.
insert into auth.users(id,instance_id,aud,role,email)
values ('b1111111-1111-4111-8111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','retirement-receipt@example.test');
insert into public.profiles(id,role,is_active)
values ('b1111111-1111-4111-8111-111111111111','cashier',true)
on conflict (id) do update set role='cashier',is_active=true;
insert into public.menu_categories(id,name)
values ('b2222222-2222-4222-8222-222222222222','Synthetic receipt');
insert into public.menu_items(id,category_id,code,name,price)
values ('b3333333-3333-4333-8333-333333333333',
        'b2222222-2222-4222-8222-222222222222','BRCPT','Synthetic legacy meal',120);
insert into public.cashier_shifts(id,cashier_id,terminal,opening_cash)
values ('b4444444-4444-4444-8444-444444444444',
        'b1111111-1111-4111-8111-111111111111','Receipt rehearsal',100);

set role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',false);
select order_id,receipt_number,grand_total from public.create_walk_in_sale(
  'b5555555-5555-4555-8555-555555555555','takeout'::public.fulfillment_type,
  'Synthetic Guest',null,null,null,null,null,'cash'::public.payment_method,500,null,
  '[{"menu_item_id":"b3333333-3333-4333-8333-333333333333","quantity":1,"modifier_ids":[]}]'::jsonb);
reset role;

-- A prior legacy sale's choice survives as a stored order-line snapshot.
update public.order_items oi set modifiers=
  '[{"id":"no-onion","name":"No Onion","price":0}]'::jsonb
from public.cashier_transactions ct
where oi.order_id=ct.order_id and ct.request_id='b5555555-5555-4555-8555-555555555555';

create schema qa_b;
create table qa_b.receipt_baseline as
select o.id as order_id,ct.receipt_number,oi.item_name,oi.modifiers,
       oi.unit_price,oi.line_total,o.grand_total,p.amount as payment_amount
from public.cashier_transactions ct
join public.orders o on o.id=ct.order_id
join public.order_items oi on oi.order_id=o.id
join public.payments p on p.id=ct.payment_id
where ct.request_id='b5555555-5555-4555-8555-555555555555';
grant usage on schema qa_b to authenticated;
grant select on qa_b.receipt_baseline to authenticated;

do $test$ begin
  if (select count(*) from qa_b.receipt_baseline)<>1
    or not exists(select 1 from qa_b.receipt_baseline where
      receipt_number is not null and receipt_number<>''
      and item_name='Synthetic legacy meal'
      and modifiers @> '[{"id":"no-onion","name":"No Onion","price":0}]'::jsonb
      and unit_price=120 and line_total=120 and grand_total=120 and payment_amount=120)
  then raise exception 'Synthetic original sale baseline failed'; end if;
end $test$;

set role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',false);
do $test$ declare b qa_b.receipt_baseline%rowtype; r jsonb; begin
  select * into strict b from qa_b.receipt_baseline;
  r:=public.get_cashier_sale(b.order_id);
  if r->'transaction'->>'receipt_number'<>b.receipt_number
    or r->'items'->0->>'item_name'<>b.item_name
    or r->'items'->0->'modifiers'<>b.modifiers
    or (r->'items'->0->>'unit_price')::numeric<>b.unit_price
    or (r->'items'->0->>'line_total')::numeric<>b.line_total
    or (r->'order'->>'grand_total')::numeric<>b.grand_total
    or (r->'payment'->>'amount')::numeric<>b.payment_amount
  then raise exception 'Pre-drop authenticated receipt differs from original sale'; end if;
end $test$;
reset role;
