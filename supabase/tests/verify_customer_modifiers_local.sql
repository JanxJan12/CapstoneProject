-- Run only against the verified unlinked loopback stack. All orders roll back.
begin;
select set_config('request.jwt.claim.sub', (
  select customer_id::text from public.orders
  where customer_name = 'Recovery QA' order by created_at desc limit 1), true);
set local role authenticated;

do $$
declare
  v_customer uuid := auth.uid();
  v_item uuid := '79dc274a-b608-4ff8-b14a-c8f9b1effb4f';
  v_drink uuid := 'e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c';
  v_args jsonb;
  v_result record;
  v_rows integer;
  v_bad jsonb;
  v_expected text;
  v_request uuid := gen_random_uuid();
begin
  if v_customer is null or has_table_privilege('authenticated', 'public.menu_modifier_options', 'SELECT')
    or has_table_privilege('anon', 'public.menu_modifier_options', 'SELECT')
    or has_function_privilege('anon', 'public.place_customer_order(text,text,text,text,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('anon', 'public.get_customer_menu_modifiers()', 'EXECUTE') then
    raise exception 'Role setup or modifier table isolation failed';
  end if;
  if not exists (select 1 from public.get_customer_menu_modifiers()
    where menu_item_id = v_item and option_id = 'extra-rice') then
    raise exception 'Active modifier projection failed';
  end if;
  v_args := jsonb_build_array(
    jsonb_build_object('id', v_item, 'qty', 2, 'modifier_ids', jsonb_build_array('extra-rice'),
      'unit_price', 0, 'price_adjustment', -100),
    jsonb_build_object('id', v_item, 'qty', 1, 'modifier_ids', jsonb_build_array('extra-sauce')));
  select * into v_result from public.place_customer_order('Modifier QA', '09171234567',
    'Local QA Street', null, v_args, v_request);
  if v_result.subtotal <> 445 or v_result.delivery_fee <> 50 or v_result.grand_total <> 495 then
    raise exception 'Modifier-inclusive totals were incorrect: %', v_result;
  end if;
  select count(*) into v_rows from public.order_items where order_id = v_result.order_id
    and ((quantity = 2 and unit_price = 155 and line_total = 310
      and modifiers @> '[{"id":"extra-rice","name":"Extra rice","price":35}]'::jsonb)
      or (quantity = 1 and unit_price = 135 and line_total = 135
      and modifiers @> '[{"id":"extra-sauce","name":"Extra sauce","price":15}]'::jsonb));
  -- 2*155 + 1*135 = 445; assertion below also catches order-level mismatch.
  if v_rows <> 2 then raise exception 'Variant snapshots or separate lines failed'; end if;
  if (select replay.order_id from public.place_customer_order('Changed name', '09171234567',
      'Different address', null, '[]'::jsonb, v_request) replay) <> v_result.order_id then
    raise exception 'Idempotent replay did not return original order';
  end if;
  for v_bad, v_expected in select * from (values
    (jsonb_build_array(jsonb_build_object('id', v_item, 'qty', 1,
      'modifier_ids', jsonb_build_array('extra-rice','extra-rice'))), 'Duplicate modifiers'),
    (jsonb_build_array(jsonb_build_object('id', v_item, 'qty', 1,
      'modifier_ids', jsonb_build_array('drink-large'))), 'invalid'),
    (jsonb_build_array(jsonb_build_object('id', v_item, 'qty', 1,
      'modifier_ids', jsonb_build_array('spice-mild','spice-hot'))), 'at most'),
    (jsonb_build_array(jsonb_build_object('id', v_drink, 'qty', 1,
      'modifier_ids', jsonb_build_array())), 'requires'),
    (jsonb_build_array(jsonb_build_object('id', v_item, 'qty', 100)), 'invalid'),
    (jsonb_build_array(jsonb_build_object('id', v_item, 'qty', 999999999999999999999)), 'invalid'),
    (jsonb_build_array(jsonb_build_object('id', v_item, 'qty', 1,
      'modifier_ids', jsonb_build_object('id','extra-rice'))), 'Invalid modifiers'),
    (jsonb_build_array(jsonb_build_object('id', v_item, 'qty', 50),
      jsonb_build_object('id', v_item, 'qty', 50, 'modifier_ids', jsonb_build_array('extra-rice'))), 'cannot exceed')
  ) cases(items, expected) loop
    begin
      perform public.place_customer_order('Modifier QA', '09171234567',
        'Local QA Street', null, v_bad, gen_random_uuid());
      raise exception 'Unexpected acceptance of invalid cart: %', v_bad;
    exception when others then
      if sqlerrm not ilike '%' || v_expected || '%' then raise; end if;
    end;
  end loop;
end $$;
rollback;

-- Disabled catalog changes must reject a previously valid selection.
begin;
update public.menu_modifier_options set is_active = false where id = 'extra-rice';
select set_config('request.jwt.claim.sub', (
  select customer_id::text from public.orders
  where customer_name = 'Recovery QA' order by created_at desc limit 1), true);
set local role authenticated;
do $$
begin
  begin
    perform public.place_customer_order('Modifier QA', '09171234567', 'Local QA Street', null,
      jsonb_build_array(jsonb_build_object('id', '79dc274a-b608-4ff8-b14a-c8f9b1effb4f',
        'qty', 1, 'modifier_ids', jsonb_build_array('extra-rice'))), gen_random_uuid());
    raise exception 'Disabled option unexpectedly accepted';
  exception when others then
    if sqlerrm not ilike '%invalid%' then raise; end if;
  end;
end $$;
rollback;
