-- Historical Phase 7B baseline: run only at that migration checkpoint. The
-- current Track A access contract denies Production transitions; use
-- scripts/fixtures/verify-track-a-legacy-access-local.mjs after that migration.
-- Run against an isolated local database after Phase 7B. Synthetic rows roll back.
begin;

do $verify$
declare
  v_manager uuid := gen_random_uuid();
  v_production uuid := gen_random_uuid();
  v_cashier uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_other_item uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_line uuid := gen_random_uuid();
  v_supplier uuid := gen_random_uuid();
  v_supplier_item uuid := gen_random_uuid();
  v_po uuid := gen_random_uuid();
  v_po_line uuid := gen_random_uuid();
  v_supplier_report uuid := gen_random_uuid();
  v_supplier_report_line uuid := gen_random_uuid();
  v_report uuid;
  v_result jsonb;
  v_blocked boolean;
  v_before_transactions bigint;
  v_before_batches bigint;
begin
  if has_table_privilege('authenticated', 'public.production_replenishment_requests', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.production_replenishment_status_events', 'SELECT')
     or has_function_privilege('anon', 'public.create_replenishment_request(uuid,uuid,numeric,timestamptz,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.advance_replenishment_request(uuid,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.start_replenishment_receiving(uuid)', 'EXECUTE')
  then raise exception 'Phase 7B direct access or anon RPC grant is unsafe'; end if;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-7b-manager@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_production, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-7b-production@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_cashier, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-7b-cashier@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Verify Manager', 'manager', true),
         (v_production, 'Verify Production', 'production', true),
         (v_cashier, 'Verify Cashier', 'cashier', true)
  on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_item, '__VERIFY_7B_ITEM__', 'pcs', 0, 0, true, 0, 'fifo', false),
         (v_other_item, '__VERIFY_7B_OTHER__', 'pcs', 0, 0, true, 0, 'fifo', false);
  select count(*) into v_before_transactions from public.inventory_transactions;
  select count(*) into v_before_batches from public.inventory_batches;

  perform set_config('request.jwt.claim.sub', v_cashier::text, true);
  v_blocked := false;
  begin
    perform public.create_replenishment_request(v_request, v_item, 10, null, 'normal', null);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Cashier created a request'; end if;

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_result := public.create_replenishment_request(v_request, v_item, 10,
    now() + interval '1 day', 'urgent', 'Needed for tomorrow service');
  if v_result ->> 'status' <> 'requested' then raise exception 'Request creation failed'; end if;
  v_result := public.create_replenishment_request(v_request, v_item, 10,
    (select needed_at from public.production_replenishment_requests where id = v_request),
    'urgent', 'Needed for tomorrow service');
  if (select count(*) from public.production_replenishment_status_events
      where request_id = v_request) <> 1 then raise exception 'Create retry duplicated audit event'; end if;
  if (select quantity_on_hand from public.inventory_items where id = v_item) <> 0
     or (select count(*) from public.inventory_transactions) <> v_before_transactions
     or (select count(*) from public.inventory_batches) <> v_before_batches
  then raise exception 'Request creation moved stock'; end if;

  v_blocked := false;
  begin
    perform public.start_replenishment_receiving(v_request);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Receiving started before request ready'; end if;

  perform set_config('request.jwt.claim.sub', v_production::text, true);
  v_blocked := false;
  begin
    perform public.advance_replenishment_request(v_request, 'requested', 'ready_for_delivery');
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Production skipped status'; end if;
  perform public.advance_replenishment_request(v_request, 'requested', 'acknowledged');
  perform public.advance_replenishment_request(v_request, 'requested', 'acknowledged');
  perform public.advance_replenishment_request(v_request, 'acknowledged', 'preparing');
  perform public.advance_replenishment_request(v_request, 'preparing', 'ready_for_delivery');
  if (select ready_at from public.production_replenishment_requests where id = v_request) is null
     or (select count(*) from public.production_replenishment_status_events
       where request_id = v_request) <> 4
  then raise exception 'Valid status progression or audit failed'; end if;

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_blocked := false;
  begin
    update public.inventory_items set unit = 'kg' where id = v_item;
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Open request allowed unit change'; end if;
  v_blocked := false;
  begin
    update public.production_replenishment_requests
    set inventory_item_id = v_other_item where id = v_request;
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Request item changed'; end if;

  v_result := public.start_replenishment_receiving(v_request);
  v_report := (v_result ->> 'id')::uuid;
  if (public.start_replenishment_receiving(v_request) ->> 'id')::uuid <> v_report
     or (select count(*) from public.receiving_reports
         where replenishment_request_id = v_request) <> 1
     or (select source_type from public.receiving_reports where id = v_report) <> 'production_team'
     or (select quantity_on_hand from public.inventory_items where id = v_item) <> 0
  then raise exception 'Linked draft is not idempotent or moved stock'; end if;
  v_blocked := false;
  begin
    update public.receiving_reports
    set replenishment_request_id = gen_random_uuid() where id = v_report;
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Linked report was relinked'; end if;

  perform set_config('request.jwt.claim.sub', v_production::text, true);
  v_blocked := false;
  begin
    perform public.start_replenishment_receiving(v_request);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Production accessed Manager Receiving'; end if;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(v_report, gen_random_uuid(), v_other_item,
      null, 8, 6, null, null, 'Two damaged', null, null, null, null);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Linked draft accepted another item'; end if;

  perform public.save_receiving_report_item(v_report, v_line, v_item, null,
    8, 6, null, null, 'Two damaged', null, null, null, null);
  if (select quantity_on_hand from public.inventory_items where id = v_item) <> 0
     or (select count(*) from public.inventory_transactions) <> v_before_transactions
     or (select count(*) from public.inventory_batches) <> v_before_batches
  then raise exception 'Receiving draft moved stock'; end if;

  perform public.post_receiving_report(v_report);
  if (select quantity_on_hand from public.inventory_items where id = v_item) <> 6
     or (select status from public.production_replenishment_requests where id = v_request) <> 'received'
     or (select fulfilled_report_id from public.production_replenishment_requests
         where id = v_request) <> v_report
     or (select count(*) from public.inventory_batches
         where receiving_report_item_id = v_line and quantity_initial = 6) <> 1
     or (select count(*) from public.inventory_transactions
         where mutation_request_id = v_line and quantity_change = 6) <> 1
     or (select count(*) from public.production_replenishment_status_events
         where request_id = v_request and next_status = 'received'
           and changed_by = v_manager) <> 1
  then raise exception 'Posting did not atomically receive only accepted stock'; end if;
  v_result := (select row from jsonb_array_elements(public.get_replenishment_requests()) row
    where row ->> 'id' = v_request::text);
  if (v_result ->> 'accepted')::numeric <> 6
     or (v_result ->> 'rejected')::numeric <> 2
  then raise exception 'Final accepted/rejected read model is wrong'; end if;

  v_blocked := false;
  begin
    perform public.post_receiving_report(v_report);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Posted report retried as a new posting'; end if;
  if (select count(*) from public.production_replenishment_status_events
      where request_id = v_request and next_status = 'received') <> 1
  then raise exception 'Request closed more than once'; end if;

  -- Existing direct-supplier Receiving remains PO-backed and independent.
  insert into public.suppliers (id, name, is_active)
  values (v_supplier, '__VERIFY_7B_SUPPLIER__', true);
  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_supplier_item, '__VERIFY_7B_SUPPLIER_ITEM__', 'pcs', 0, 0,
    true, 0, 'fifo', false);
  insert into public.purchase_orders
    (id, po_number, supplier_id, created_by, status, ordered_at)
  values (v_po, '__VERIFY_7B_PO__', v_supplier, v_manager, 'submitted', now());
  insert into public.purchase_order_items
    (id, purchase_order_id, inventory_item_id, quantity_ordered,
     quantity_received, unit_cost, total_cost)
  values (v_po_line, v_po, v_supplier_item, 10, 0, 1, 10);
  perform public.create_receiving_report_draft(v_supplier_report,
    'direct_supplier', null, v_po, now(), 'TEST-7B', null);
  perform public.save_receiving_report_item(v_supplier_report,
    v_supplier_report_line, null, v_po_line, 5, 4,
    null, null, 'One damaged', null, null, null, null);
  if (select quantity_on_hand from public.inventory_items where id = v_supplier_item) <> 0
  then raise exception 'Supplier draft moved stock'; end if;
  perform public.post_receiving_report(v_supplier_report);
  if (select quantity_on_hand from public.inventory_items where id = v_supplier_item) <> 4
     or (select quantity_received from public.purchase_order_items where id = v_po_line) <> 4
     or (select replenishment_request_id from public.receiving_reports
         where id = v_supplier_report) is not null
  then raise exception 'Direct-supplier receiving changed under Phase 7B'; end if;
  raise notice 'Phase 7B business checks passed; transaction will roll back.';
end;
$verify$;

rollback;
