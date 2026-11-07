-- Isolated local restored database only. All synthetic identities and rows roll back.
begin;
do $verify$
declare
  v_manager uuid := gen_random_uuid();
  v_cashier uuid := gen_random_uuid();
  v_report uuid := gen_random_uuid();
  v_spoof_report uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_supplier uuid := gen_random_uuid();
  v_supplier_item uuid := gen_random_uuid();
  v_po uuid := gen_random_uuid();
  v_po_line uuid := gen_random_uuid();
  v_supplier_report uuid := gen_random_uuid();
  v_blocked boolean;
  v_evidence jsonb;
  v_before bigint;
begin
  if has_function_privilege('authenticated',
       'public.create_replenishment_request(uuid,uuid,numeric,timestamptz,text,text)', 'EXECUTE')
     or has_function_privilege('anon',
       'public.create_emergency_production_receiving(uuid,timestamptz,text,text,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated',
       'public.create_emergency_production_receiving(uuid,timestamptz,text,text,text,text)', 'EXECUTE')
  then raise exception 'Delivery policy RPC grants are wrong'; end if;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-policy-manager-' || v_manager || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_cashier, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-policy-cashier-' || v_cashier || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Verify Manager', 'manager', true),
         (v_cashier, 'Verify Cashier', 'cashier', true)
  on conflict (id) do update set role = excluded.role, is_active = true;
  select count(*) into v_before from public.inventory_transactions;

  perform set_config('request.jwt.claim.sub', v_cashier::text, true);
  v_blocked := false;
  begin
    perform public.create_emergency_production_receiving(v_report, now(), null,
      null, 'Local synthetic emergency', 'Verify Inspector');
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Cashier authorized emergency'; end if;

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_blocked := false;
  begin
    perform public.create_receiving_report_draft(gen_random_uuid(),
      'production_team', 'unlinked normal', null, now(), null, null);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'General unlinked Production draft was created'; end if;

  v_blocked := false;
  begin
    perform public.create_emergency_production_receiving(v_report, now(), null,
      null, '', 'Verify Inspector');
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Blank emergency reason accepted'; end if;

  perform public.create_emergency_production_receiving(v_report, now(),
    'synthetic handoff', null, 'Local synthetic emergency', 'Verify Inspector');
  v_evidence := public.get_receiving_policy_evidence(v_report);
  if v_evidence->>'classification' <> 'manager_emergency'
     or v_evidence->>'reason' <> 'Local synthetic emergency'
     or v_evidence->>'authorized_by' <> v_manager::text
     or v_evidence->>'inspected_by_name' <> 'Verify Inspector'
     or nullif(v_evidence->>'authorized_at', '') is null
     or (select count(*) from public.inventory_transactions) <> v_before
  then raise exception 'Emergency evidence or draft stock invariant failed'; end if;

  insert into public.receiving_reports (id, rr_number, source_type, received_at,
    received_by, emergency_reason, emergency_authorized_by,
    emergency_authorized_at, emergency_inspected_by_name)
  values (v_spoof_report, 'RR-POLICY-' || left(replace(v_spoof_report::text, '-', ''), 8),
    'production_team', now(), v_manager, 'Synthetic direct insert', v_manager,
    '2000-01-01'::timestamptz, 'Verify Inspector');
  if (select emergency_authorized_at from public.receiving_reports
      where id = v_spoof_report) <> now()
  then raise exception 'Emergency authorization timestamp was caller-controlled'; end if;

  v_blocked := false;
  begin
    update public.receiving_reports set emergency_reason = 'changed' where id = v_report;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Emergency evidence was mutable'; end if;
  v_blocked := false;
  begin
    delete from public.receiving_reports where id = v_report;
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Emergency evidence could be deleted'; end if;

  perform set_config('request.jwt.claim.sub', v_cashier::text, true);
  v_blocked := false;
  begin
    perform public.get_receiving_policy_evidence(v_report);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Cashier read Manager-only evidence'; end if;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_item, '__VERIFY_EMERGENCY__' || replace(v_item::text, '-', ''),
    'pcs', 0, 0, true, 0, 'fifo', false);
  perform public.save_receiving_report_item(v_report, gen_random_uuid(), v_item,
    null, 2, 1, null, null, 'Synthetic damaged unit', null, null, null, null);
  perform public.post_receiving_report(v_report);
  if (select quantity_on_hand from public.inventory_items where id = v_item) <> 1
     or (select count(*) from public.inventory_batches b
         join public.receiving_report_items line on line.id = b.receiving_report_item_id
         where line.receiving_report_id = v_report) <> 1
     or (select count(*) from public.inventory_transactions t
         join public.inventory_batches b on b.id = t.inventory_batch_id
         join public.receiving_report_items line on line.id = b.receiving_report_item_id
         where line.receiving_report_id = v_report and t.transaction_type::text = 'receiving'
           and t.reason = 'Manager emergency receiving report ' ||
             (select rr_number from public.receiving_reports where id = v_report)) <> 1
  then raise exception 'Emergency accepted-only posting or movement label failed'; end if;
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_report);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Emergency duplicate posting was accepted'; end if;

  insert into public.suppliers (id, name, is_active)
  values (v_supplier, '__VERIFY_POLICY_SUPPLIER__' || replace(v_supplier::text, '-', ''), true);
  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_supplier_item, '__VERIFY_POLICY_PO_ITEM__' || replace(v_supplier_item::text, '-', ''),
    'pcs', 0, 0, true, 0, 'fifo', false);
  insert into public.purchase_orders
    (id, po_number, supplier_id, created_by, status, ordered_at)
  values (v_po, '__VERIFY_POLICY_PO__' || left(replace(v_po::text, '-', ''), 8),
    v_supplier, v_manager, 'submitted', now());
  insert into public.purchase_order_items
    (id, purchase_order_id, inventory_item_id, quantity_ordered,
     quantity_received, unit_cost, total_cost)
  values (v_po_line, v_po, v_supplier_item, 3, 0, 1, 3);
  perform public.create_receiving_report_draft(v_supplier_report,
    'direct_supplier', null, v_po, now(), 'synthetic supplier delivery', null);
  perform public.save_receiving_report_item(v_supplier_report, gen_random_uuid(),
    null, v_po_line, 2, 1, null, null, 'Synthetic damaged unit', null, null, null, null);
  perform public.post_receiving_report(v_supplier_report);
  if (select quantity_on_hand from public.inventory_items where id = v_supplier_item) <> 1
     or (select quantity_received from public.purchase_order_items where id = v_po_line) <> 1
     or public.get_receiving_policy_evidence(v_supplier_report)->>'classification' <> 'direct_supplier'
     or (select count(*) from public.inventory_transactions t
         join public.inventory_batches b on b.id = t.inventory_batch_id
         join public.receiving_report_items line on line.id = b.receiving_report_item_id
         where line.receiving_report_id = v_supplier_report
           and t.reason = 'Direct-supplier receiving report ' ||
             (select rr_number from public.receiving_reports where id = v_supplier_report)) <> 1
  then raise exception 'Direct supplier PO Receiving regression'; end if;
  raise notice 'Delivery policy checks passed: normal denial, Manager emergency authorization/posting, PO supplier posting, source labels, retry denial';
end;
$verify$;
rollback;
