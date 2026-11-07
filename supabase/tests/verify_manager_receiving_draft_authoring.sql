-- Run after 20261013053159_production_delivery_policy.sql in a trusted
-- PostgreSQL session. Every behavioral write is rolled back.

begin;

do $catalog_verification$
declare
  v_function_name text;
  v_definition text;
begin
  foreach v_function_name in array array[
    'get_manager_receiving_workspace',
    'create_receiving_report_draft',
    'update_receiving_report_draft',
    'save_receiving_report_item',
    'remove_receiving_report_item',
    'delete_empty_receiving_report_draft'
  ]
  loop
    select pg_get_functiondef(procedure.oid)
    into v_definition
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_function_name
      and procedure.prosecdef
      and procedure.proconfig @> array['search_path=public, extensions, pg_temp'];

    if v_definition is null
       or v_definition not ilike '%auth.uid()%'
       or v_definition not ilike '%profile.role = ''manager''%'
       or v_definition not ilike '%profile.is_active = true%'
    then
      raise exception '% authorization or search_path contract is incomplete', v_function_name;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.get_manager_receiving_workspace(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_receiving_report_draft(uuid,text,text,uuid,timestamptz,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_receiving_report_draft(uuid,text,text,uuid,timestamptz,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date)', 'EXECUTE')
     or has_function_privilege('anon', 'public.remove_receiving_report_item(uuid,uuid)', 'EXECUTE')
  then
    raise exception 'anon can execute a Manager receiving RPC';
  end if;

  if not has_function_privilege('authenticated', 'public.get_manager_receiving_workspace(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_receiving_report_draft(uuid,text,text,uuid,timestamptz,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_receiving_report_draft(uuid,text,text,uuid,timestamptz,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.remove_receiving_report_item(uuid,uuid)', 'EXECUTE')
  then
    raise exception 'authenticated cannot execute a Manager receiving RPC';
  end if;

  if has_table_privilege('authenticated', 'public.receiving_reports', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.receiving_report_items', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.receiving_reports', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.receiving_report_items', 'INSERT, UPDATE, DELETE')
  then
    raise exception 'Direct browser receiving-table mutation is not denied';
  end if;
end
$catalog_verification$;

do $behavior_verification$
declare
  v_manager_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_supplier_id uuid := gen_random_uuid();
  v_production_item_id uuid := gen_random_uuid();
  v_secondary_item_id uuid := gen_random_uuid();
  v_expiry_item_id uuid := gen_random_uuid();
  v_supplier_item_id uuid := gen_random_uuid();
  v_po_id uuid := gen_random_uuid();
  v_other_po_id uuid := gen_random_uuid();
  v_po_item_id uuid := gen_random_uuid();
  v_other_po_item_id uuid := gen_random_uuid();
  v_production_report_id uuid := gen_random_uuid();
  v_supplier_report_id uuid := gen_random_uuid();
  v_production_line_id uuid := gen_random_uuid();
  v_secondary_line_id uuid := gen_random_uuid();
  v_supplier_line_id uuid := gen_random_uuid();
  v_received_at timestamptz := now();
  v_blocked boolean;
  v_result jsonb;
  v_quantity_before numeric;
  v_transaction_count_before bigint;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    (v_manager_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-draft-manager@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_customer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-draft-customer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, first_name, last_name, role, is_active)
  values
    (v_manager_id, 'Verify', 'Draft Manager', 'manager', true),
    (v_customer_id, 'Verify', 'Draft Customer', 'customer', true)
  on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

  insert into public.suppliers (id, name, is_active)
  values (v_supplier_id, '__VERIFY_DRAFT_SUPPLIER__', true);

  insert into public.inventory_items (
    id, item_name, unit, secondary_unit, quantity_on_hand, reorder_level,
    is_active, quantity_scale, rotation_policy, expiry_required
  )
  values
    (v_production_item_id, '__VERIFY_DRAFT_PRODUCTION__', 'pcs', null, 0, 0, true, 0, 'fifo', false),
    (v_secondary_item_id, '__VERIFY_DRAFT_SECONDARY__', 'kg', 'pcs', 0, 0, true, 3, 'fifo', false),
    (v_expiry_item_id, '__VERIFY_DRAFT_EXPIRY__', 'kg', null, 0, 0, true, 3, 'fefo', true),
    (v_supplier_item_id, '__VERIFY_DRAFT_SUPPLIER_ITEM__', 'L', null, 5, 0, true, 3, 'fifo', false);

  insert into public.purchase_orders (
    id, po_number, supplier_id, created_by, status, ordered_at
  )
  values
    (v_po_id, '__VERIFY-DRAFT-PO__', v_supplier_id, v_manager_id, 'submitted', now()),
    (v_other_po_id, '__VERIFY-DRAFT-OTHER-PO__', v_supplier_id, v_manager_id, 'submitted', now());

  insert into public.purchase_order_items (
    id, purchase_order_id, inventory_item_id, quantity_ordered,
    quantity_received, unit_cost, total_cost
  )
  values
    (v_po_item_id, v_po_id, v_supplier_item_id, 100, 0, 10, 1000),
    (v_other_po_item_id, v_other_po_id, v_supplier_item_id, 10, 0, 10, 100);

  perform set_config('request.jwt.claim.sub', v_customer_id::text, true);
  v_blocked := false;
  begin
    perform public.create_receiving_report_draft(
      gen_random_uuid(), 'production_team', 'UNAUTHORIZED', null,
      v_received_at, null);
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Non-Manager created a receiving draft';
  end if;

  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  select quantity_on_hand into v_quantity_before
  from public.inventory_items where id = v_production_item_id;
  select count(*) into v_transaction_count_before
  from public.inventory_transactions;

  -- The current policy requires an explicit Manager emergency for an
  -- unlinked Production receipt. The fixture does not claim a formal request.
  perform public.create_emergency_production_receiving(
    v_production_report_id, v_received_at, 'PROD-HANDOFF-004',
    'Synthetic local receiving verifier', 'Verify Inspector'
  );
  v_result := public.create_receiving_report_draft(
    v_production_report_id, 'production_team', 'PROD-HANDOFF-004', null,
    v_received_at, null);
  if v_result->>'source_type' <> 'production_team'
     or v_result->>'status' <> 'draft'
  then
    raise exception 'Manager could not create Production Team draft';
  end if;

  perform public.create_receiving_report_draft(
    v_production_report_id, 'production_team', 'PROD-HANDOFF-004', null,
    v_received_at, null);
  if (select count(*) from public.receiving_reports where id = v_production_report_id) <> 1 then
    raise exception 'Retry duplicated the Production Team draft';
  end if;

  if (select quantity_on_hand from public.inventory_items where id = v_production_item_id) <> v_quantity_before
     or (select count(*) from public.inventory_transactions) <> v_transaction_count_before
     or exists (
       select 1 from public.inventory_batches
       where receiving_report_item_id is not null
         and inventory_item_id = v_production_item_id
     )
  then
    raise exception 'Production draft changed stock before posting';
  end if;

  v_blocked := false;
  begin
    perform public.create_receiving_report_draft(
      gen_random_uuid(), 'direct_supplier', null, gen_random_uuid(),
      now(), null);
  exception when others then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Supplier draft without a valid PO was accepted';
  end if;

  v_result := public.create_receiving_report_draft(
    v_supplier_report_id, 'direct_supplier', 'SUPPLIER-DELIVERY-004', v_po_id,
    now(), 'DR-004');
  if v_result->>'source_type' <> 'direct_supplier' then
    raise exception 'Manager could not create direct supplier draft';
  end if;

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_production_report_id, gen_random_uuid(), null, null,
      60, 58, null, null, 'Two damaged', null, null, null);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Production line without inventory identity was accepted';
  end if;

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_supplier_report_id, gen_random_uuid(), null, v_other_po_item_id,
      2, 2, null, null, null, null, null, null);
  exception when others then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Supplier line with a foreign PO item was accepted';
  end if;

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_production_report_id, gen_random_uuid(), v_production_item_id, v_po_item_id,
      2, 2, null, null, null, null, null, null);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Mixed source identity was accepted';
  end if;

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_production_report_id, gen_random_uuid(), v_production_item_id, null,
      5, 6, null, null, null, null, null, null);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Invalid delivered/accepted quantities were accepted';
  end if;

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_production_report_id, gen_random_uuid(), v_production_item_id, null,
      60, 58, null, null, null, null, null, null);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Rejected quantity without a reason was accepted';
  end if;

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_production_report_id, gen_random_uuid(), v_expiry_item_id, null,
      2, 2, null, null, null, null, null, null);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Expiry-required line without use-by was accepted';
  end if;

  perform public.save_receiving_report_item(
    v_production_report_id, v_production_line_id, v_production_item_id, null,
    60, 58, null, null, 'Two damaged', 'PROD-LOT-004', current_date, current_date + 3);
  perform public.save_receiving_report_item(
    v_production_report_id, v_secondary_line_id, v_secondary_item_id, null,
    10, 8, 20, 15, 'Independent rejects', null, null, null);
  if not exists (
    select 1 from public.receiving_report_items
    where id = v_secondary_line_id
      and quantity_accepted = 8
      and secondary_quantity_accepted = 15
  ) then
    raise exception 'Secondary quantities were converted or changed';
  end if;

  perform public.update_receiving_report_draft(
    v_production_report_id, 'production_team', 'PROD-HANDOFF-004', null,
    v_received_at, null);
  if (select source_reference from public.receiving_reports where id = v_production_report_id) <> 'PROD-HANDOFF-004' then
    raise exception 'Draft header edit failed';
  end if;

  perform public.remove_receiving_report_item(v_production_report_id, v_secondary_line_id);
  if exists (select 1 from public.receiving_report_items where id = v_secondary_line_id) then
    raise exception 'Draft line removal failed';
  end if;

  perform public.save_receiving_report_item(
    v_supplier_report_id, v_supplier_line_id, null, v_po_item_id,
    25, 20, null, null, 'Five rejected', 'SUP-LOT-004', null, null);

  v_result := public.post_receiving_report(v_production_report_id);
  if v_result->>'status' <> 'posted'
     or (v_result->>'total_accepted')::numeric <> 58
     or (select quantity_on_hand from public.inventory_items where id = v_production_item_id) <> v_quantity_before + 58
  then
    raise exception 'Draft RPC-created report did not post correctly';
  end if;

  v_blocked := false;
  begin
    perform public.update_receiving_report_draft(
      v_production_report_id, 'production_team', 'CHANGED', null,
      v_received_at, null);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Posted report was edited';
  end if;

  v_blocked := false;
  begin
    perform public.remove_receiving_report_item(v_production_report_id, v_production_line_id);
  exception when invalid_parameter_value then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'Posted line was removed';
  end if;

  if (select quantity_received from public.purchase_order_items where id = v_po_item_id) <> 0 then
    raise exception 'Unposted supplier draft changed PO received quantity';
  end if;

  raise notice 'Manager receiving draft authoring behavior checks passed';
end
$behavior_verification$;

rollback;
