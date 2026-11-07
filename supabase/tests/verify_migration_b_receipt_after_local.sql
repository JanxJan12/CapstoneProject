\set ON_ERROR_STOP on
-- Run only after the exact reviewed Migration B in the same disposable DB.
do $test$ begin
  if to_regclass('public.menu_modifier_groups') is not null
    or to_regclass('public.menu_modifier_options') is not null
    or to_regclass('public.menu_item_modifier_groups') is not null
    or to_regprocedure('public.get_customer_menu_modifiers()') is not null
    or (select count(*) from public.drink_choices)<>7
  then raise exception 'Post-drop catalog contract failed'; end if;
  if has_function_privilege('anon','public.get_cashier_sale(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_cashier_sale(uuid)','EXECUTE')
  then raise exception 'Receipt RPC ACL failed'; end if;
end $test$;

set role authenticated;
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',false);
do $test$ declare b qa_b.receipt_baseline%rowtype; r jsonb; begin
  select * into strict b from qa_b.receipt_baseline;
  r:=public.get_cashier_sale(b.order_id);
  if r->'transaction'->>'receipt_number'<>b.receipt_number
    or r->'items'->0->>'item_name'<>b.item_name
    or r->'items'->0->'modifiers'<>b.modifiers
    or r->'items'->0->'modifiers'->0->>'name'<>'No Onion'
    or (r->'items'->0->>'unit_price')::numeric<>b.unit_price
    or (r->'items'->0->>'line_total')::numeric<>b.line_total
    or (r->'order'->>'grand_total')::numeric<>b.grand_total
    or (r->'payment'->>'amount')::numeric<>b.payment_amount
  then raise exception 'Post-drop authenticated receipt changed'; end if;
end $test$;
reset role;
select 'PASS: exact B preserved authenticated receipt number, legacy label, line prices, and total' as result;
