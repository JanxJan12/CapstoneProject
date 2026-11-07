-- Disposable current-schema clone only. Synthetic rows roll back.
begin;
do $catalog$
begin
  if (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r') <> 30
     or to_regclass('public.production_replenishment_requests') is not null
     or to_regclass('public.production_replenishment_status_events') is not null
     or to_regclass('public.suppliers') is not null
     or to_regclass('public.supplier_items') is not null
     or to_regclass('public.purchase_orders') is not null
     or to_regclass('public.purchase_order_items') is not null
     or exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
       and pg_get_functiondef(p.oid) ~* 'public\.(production_replenishment_requests|production_replenishment_status_events|suppliers|supplier_items|purchase_orders|purchase_order_items)')
  then
    raise exception 'Retired catalog postcondition failed';
  end if;
end;
$catalog$;
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'six-manager@example.invalid', '',
   now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'six-cashier@example.invalid', '',
   now(), '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, first_name, role, is_active)
values
  ('11111111-1111-4111-8111-111111111111', 'Six Manager', 'manager', true),
  ('22222222-2222-4222-8222-222222222222', 'Six Cashier', 'cashier', true);
insert into public.inventory_items
  (id, item_name, unit, quantity_on_hand, reorder_level, is_active,
   quantity_scale, rotation_policy, expiry_required)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '__SIX_TABLE_ACCEPTANCE__',
   'pcs', 0, 5, true, 0, 'fifo', false);
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $manager$
declare
  v_workspace jsonb;
  v_item uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_request uuid := gen_random_uuid();
  v_report uuid := gen_random_uuid();
  v_line uuid := gen_random_uuid();
  v_needed timestamptz := now() + interval '2 days';
  v_expected jsonb;
begin
  v_expected := public.get_inventory_request_proposal(v_needed);
  v_workspace := public.get_manager_receiving_workspace(null);
  if v_workspace->'purchase_orders' <> '[]'::jsonb then
    raise exception 'Retired PO response shape changed';
  end if;
  perform public.get_manager_receiving_documents();
  perform public.get_manager_inventory_movements();
  perform public.issue_inventory_request(v_request, 'scheduled', v_needed,
    jsonb_build_array(jsonb_build_object('inventory_item_id', v_item, 'quantity', 5)),
    v_expected);
  perform public.record_inventory_request_event(v_request, 1, 'dispatch',
    '{"channel":"Messenger","recipient":"External Production contact"}'::jsonb);
  perform public.start_inventory_request_receiving(v_request, 1, v_report,
    'Synthetic inspector', 'Verified delivery');
  v_workspace := public.get_manager_receiving_workspace(v_report);
  if v_workspace->'selected_report'->>'id' <> v_report::text then
    raise exception 'Linked Receiving workspace lost the selected report';
  end if;
  perform public.save_receiving_report_item(v_report, v_line, v_item, null,
    3, 2, null, null, 'One rejected', null, null, null, null);
  perform public.post_receiving_report(v_report);
  v_workspace := public.get_manager_receiving_workspace(v_report);
  if v_workspace->'selected_report'->>'status' <> 'posted'
     or not exists (
       select 1 from jsonb_array_elements(v_workspace->'selected_report'->'items') item
       where item->>'id' = v_line::text and (item->>'quantity_accepted')::numeric = 2
         and item->>'batch_id' is not null
     )
     or not exists (
       select 1 from jsonb_array_elements(public.get_inventory_request_proposal(v_needed)) item
       where item->>'id' = v_item::text and (item->>'usable_now')::numeric = 2
     )
  then
    raise exception 'Accepted-only linked Receiving failed';
  end if;
  begin
    perform public.post_receiving_report(v_report);
    raise exception 'Duplicate post was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_receiving_report_draft(gen_random_uuid(), 'direct_supplier',
      null, gen_random_uuid(), now(), null, null);
    raise exception 'Direct supplier draft was accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$manager$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $cashier$
begin
  begin
    perform public.get_inventory_request_proposal(now() + interval '2 days');
    raise exception 'Cashier could read Manager proposal';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.post_receiving_report(gen_random_uuid());
    raise exception 'Cashier could post Receiving';
  exception when insufficient_privilege then null;
  end;
end;
$cashier$;
rollback;
