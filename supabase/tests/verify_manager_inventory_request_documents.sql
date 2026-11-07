-- Run only against a disposable local database after all migrations. Entire fixture rolls back.
begin;
do $verify$
declare
  v_manager uuid := gen_random_uuid();
  v_cashier uuid := gen_random_uuid();
  v_production uuid := gen_random_uuid();
  v_inactive_manager uuid := gen_random_uuid();
  v_item_a uuid := gen_random_uuid();
  v_item_b uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_report_a uuid := gen_random_uuid();
  v_report_b uuid := gen_random_uuid();
  v_line_a uuid := gen_random_uuid();
  v_line_b uuid := gen_random_uuid();
  v_needed timestamptz := now() + interval '2 days';
  v_lines jsonb;
  v_expected jsonb;
  v_result jsonb;
  v_blocked boolean;
  v_before_transactions bigint;
begin
  if has_table_privilege('authenticated', 'public.inventory_request_documents', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.inventory_request_lines', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.inventory_request_events', 'INSERT')
     or has_function_privilege('anon', 'public.issue_inventory_request(uuid,text,timestamptz,jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.revise_inventory_request(uuid,integer,text,timestamptz,jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_inventory_request_register()', 'EXECUTE') then
    raise exception 'New request table ACL or anonymous RPC grant is unsafe';
  end if;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-request-manager@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_cashier, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-request-cashier@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_production, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-request-production@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_inactive_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-request-inactive@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Verify Manager', 'manager', true),
         (v_cashier, 'Verify Cashier', 'cashier', true),
         (v_production, 'Verify Production', 'production', true),
         (v_inactive_manager, 'Verify Inactive', 'manager', false)
  on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;
  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_item_a, '__VERIFY_REQUEST_A__', 'pcs', 0, 5, true, 0, 'fifo', false),
         (v_item_b, '__VERIFY_REQUEST_B__', 'pcs', 0, 5, true, 0, 'fifo', false);
  v_lines := jsonb_build_array(
    jsonb_build_object('inventory_item_id', v_item_a, 'quantity', 10, 'override_reason', 'Service need'),
    jsonb_build_object('inventory_item_id', v_item_b, 'quantity', 5, 'override_reason', 'Service need'));
  select count(*) into v_before_transactions from public.inventory_transactions;

  perform set_config('request.jwt.claim.sub', v_cashier::text, true);
  v_blocked := false;
  begin
    perform public.issue_inventory_request(v_request, 'scheduled', v_needed,
      v_lines, '[]'::jsonb);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Cashier issued a request'; end if;
  perform set_config('request.jwt.claim.sub', v_production::text, true);
  v_blocked := false;
  begin
    perform public.get_inventory_request_register();
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Production read Manager request register'; end if;
  perform set_config('request.jwt.claim.sub', v_inactive_manager::text, true);
  v_blocked := false;
  begin
    perform public.get_inventory_request_proposal(v_needed);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Inactive Manager read proposal'; end if;

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_expected := public.get_inventory_request_proposal(v_needed);
  v_result := public.issue_inventory_request(v_request, 'scheduled', v_needed,
    v_lines, v_expected);
  if nullif(v_result->>'request_number', '') is null then raise exception 'Number missing'; end if;
  perform public.issue_inventory_request(v_request, 'scheduled', v_needed,
    v_lines, v_expected);
  if exists (select 1 from pg_attribute where attrelid = 'public.inventory_request_documents'::regclass
      and attname = 'reason' and not attisdropped)
     or exists (select 1 from public.inventory_request_revisions
       where request_id = v_request and (snapshot ? 'reason')) then
    raise exception 'New request still stores ordinary Reason';
  end if;
  if (select count(*) from public.inventory_request_events where request_id = v_request) <> 1
     or (select count(*) from public.inventory_request_lines where request_id = v_request) <> 2
     or (select count(*) from public.inventory_transactions) <> v_before_transactions then
    raise exception 'Issue was not idempotent or moved stock';
  end if;
  perform public.record_inventory_request_event(v_request, 1, 'dispatch',
    '{"channel":"Messenger","recipient":"Production contact"}'::jsonb);
  perform public.record_inventory_request_event(v_request, 1, 'acknowledgment',
    '{"responder":"Production contact","response":"Acknowledged"}'::jsonb);

  -- Revision is a new immutable snapshot before any delivery.
  v_expected := public.get_inventory_request_proposal(v_needed);
  v_lines := jsonb_build_array(
    jsonb_build_object('inventory_item_id', v_item_a, 'quantity', 12, 'override_reason', 'Revised service need'),
    jsonb_build_object('inventory_item_id', v_item_b, 'quantity', 5, 'override_reason', 'Service need'));
  perform public.revise_inventory_request(v_request, 1, 'priority', v_needed,
    v_lines, v_expected);
  if (select count(*) from public.inventory_request_revisions where request_id = v_request) <> 2
     or (select snapshot->'lines'->0->>'quantity' from public.inventory_request_revisions
       where request_id = v_request and revision = 1) is null then
    raise exception 'Revision snapshot lost';
  end if;
  v_blocked := false;
  begin
    perform public.record_inventory_request_event(v_request, 1, 'dispatch',
      '{"channel":"Messenger","recipient":"Old revision"}'::jsonb);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Stale revision dispatch allowed'; end if;

  perform public.start_inventory_request_receiving(v_request, 2, v_report_a,
    'Trained staff A', 'Physical count complete');
  if (select count(*) from public.inventory_transactions) <> v_before_transactions then
    raise exception 'Receiving draft moved stock';
  end if;
  v_blocked := false;
  begin
    perform public.revise_inventory_request(v_request, 2, 'priority', v_needed,
      v_lines, public.get_inventory_request_proposal(v_needed));
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Revision after delivery draft allowed'; end if;
  perform public.save_receiving_report_item(v_report_a, v_line_a, v_item_a, null,
    8, 6, null, null, 'Two rejected', null, null, null);
  perform public.save_receiving_report_item(v_report_a, v_line_b, v_item_b, null,
    5, 5, null, null, null, null, null, null);
  perform public.post_receiving_report(v_report_a);
  if (select quantity_on_hand from public.inventory_items where id = v_item_a) <> 6
     or (select quantity_on_hand from public.inventory_items where id = v_item_b) <> 5
     or (select status from public.inventory_request_documents where id = v_request) <> 'partially_received'
     or (select count(*) from public.inventory_transactions) <> v_before_transactions + 2 then
    raise exception 'First split delivery did not post accepted-only stock';
  end if;
  perform public.start_inventory_request_receiving(v_request, 2, v_report_b,
    'Trained staff B', 'Second physical count');
  perform public.save_receiving_report_item(v_report_b, gen_random_uuid(), v_item_a, null,
    7, 7, null, null, null, null, null, null);
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_report_b);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked or (select quantity_on_hand from public.inventory_items where id = v_item_a) <> 6 then
    raise exception 'Accepted overage was not atomically rejected';
  end if;
  delete from public.receiving_report_items where receiving_report_id = v_report_b;
  perform public.save_receiving_report_item(v_report_b, gen_random_uuid(), v_item_a, null,
    3, 2, null, null, 'One rejected', null, null, null);
  perform public.post_receiving_report(v_report_b);
  if (select quantity_on_hand from public.inventory_items where id = v_item_a) <> 8
     or (select count(*) from public.receiving_reports
       where inventory_request_id = v_request and status = 'posted') <> 2 then
    raise exception 'Second delivery failed';
  end if;
  if (select count(*) from public.inventory_batches b
      join public.receiving_report_items ri on ri.id = b.receiving_report_item_id
      where ri.receiving_report_id in (v_report_a, v_report_b)) <> 3
     or (select sum(b.quantity_initial) from public.inventory_batches b
      join public.receiving_report_items ri on ri.id = b.receiving_report_item_id
      where ri.receiving_report_id in (v_report_a, v_report_b)) <> 13
     or exists (select 1 from public.inventory_batches b
      join public.receiving_report_items ri on ri.id = b.receiving_report_item_id
      left join public.inventory_transactions tx on tx.inventory_batch_id = b.id
      where ri.receiving_report_id in (v_report_a, v_report_b)
        and (b.quantity_initial <> ri.quantity_accepted
          or b.quantity_on_hand <> ri.quantity_accepted
          or tx.transaction_type <> 'receiving'
          or tx.quantity_change <> ri.quantity_accepted)) then
    raise exception 'Batch or ledger diverged from accepted-only quantities';
  end if;
  v_result := public.get_inventory_request_register();
  if not exists (select 1 from jsonb_array_elements(v_result) d,
      jsonb_array_elements(d->'lines') l
      where d->>'id' = v_request::text and l->>'inventory_item_id' = v_item_a::text
        and (l->>'accepted')::numeric = 8
        and (l->>'rejected')::numeric = 3
        and (l->>'remaining')::numeric = 4) then
    raise exception 'Request register reconciliation is inaccurate';
  end if;
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_report_b);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Duplicate receiving post allowed'; end if;
  perform public.close_inventory_request_short(v_request, 2, 'Four pieces not delivered');
  if (select status from public.inventory_request_documents where id = v_request) <> 'closed_short'
     or (select quantity_on_hand from public.inventory_items where id = v_item_a) <> 8
     or (select count(*) from public.inventory_transactions) <> v_before_transactions + 3 then
    raise exception 'Shortfall closure changed stock or status';
  end if;
  -- The temporary old signature remains callable during application rollout.
  v_request := gen_random_uuid();
  v_expected := public.get_inventory_request_proposal(v_needed);
  v_lines := jsonb_build_array(jsonb_build_object(
    'inventory_item_id', v_item_a, 'quantity', 5,
    'override_reason', 'Compatibility fixture'));
  perform public.issue_inventory_request(v_request, 'scheduled', v_needed,
    'Historical compatibility reason', v_lines, v_expected);
  if (select snapshot->>'reason' from public.inventory_request_revisions
      where request_id = v_request and revision = 1) <> 'Historical compatibility reason' then
    raise exception 'Old client Reason was not preserved in revision JSON';
  end if;
  v_blocked := false;
  begin
    perform public.issue_inventory_request(v_request, 'scheduled', v_needed,
      'Different retry reason', v_lines, v_expected);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Old-client retry changed Reason'; end if;
  raise notice 'Manager request document checks passed; rolling back.';
end;
$verify$;
rollback;
