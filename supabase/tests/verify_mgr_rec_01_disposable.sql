-- MGR-REC-01 focused rollback-only test. Disposable PostgreSQL only.
begin;
do $verify$
declare
  v_manager uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_report uuid := gen_random_uuid();
  v_other_report uuid := gen_random_uuid();
  v_needed timestamptz := now() + interval '2 days';
  v_lines jsonb;
  v_register jsonb;
  v_before_tx integer;
  v_blocked boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'verify-mgr-rec-' || v_manager || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Receiving Manager', 'manager', true)
  on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;
  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_item, 'Fried Chicken - Quarter Leg', 'pcs', 0, 2, true, 0, 'fifo', false);
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  select count(*) into v_before_tx from public.inventory_transactions;
  v_lines := jsonb_build_array(jsonb_build_object('inventory_item_id', v_item,
    'quantity', 2, 'override_reason', 'Synthetic service need'));
  perform public.issue_inventory_request(v_request, 'scheduled', v_needed,
    v_lines, public.get_inventory_request_proposal(v_needed));
  v_register := public.get_inventory_request_register();
  if not exists (select 1 from jsonb_array_elements(v_register) r,
    jsonb_array_elements(r->'lines') l where r->>'id' = v_request::text
    and r->>'status' = 'issued' and (r->>'revision')::integer = 1
    and (l->>'remaining')::numeric = 2 and jsonb_array_length(r->'receipts') = 0)
     or (select count(*) from public.inventory_transactions) <> v_before_tx
     or (select quantity_on_hand from public.inventory_items where id = v_item) <> 0 then
    raise exception 'Issued request visibility or stock isolation failed';
  end if;
  v_blocked := false;
  begin
    perform public.start_inventory_request_receiving(v_request, 1, v_report, '', '');
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Blank inspector created a linked draft'; end if;
  perform public.start_inventory_request_receiving(v_request, 1, v_report,
    'Synthetic Inspector', 'Physical inspection');
  perform public.start_inventory_request_receiving(v_request, 1, v_report,
    'Synthetic Inspector', 'Physical inspection');
  v_blocked := false;
  begin
    perform public.start_inventory_request_receiving(v_request, 1, v_other_report,
      'Other Inspector', 'Concurrent attempt');
  exception when unique_violation then v_blocked := true;
  end;
  if not v_blocked or (select count(*) from public.receiving_reports
      where inventory_request_id = v_request and status = 'draft') <> 1
     or (select count(*) from public.inventory_transactions) <> v_before_tx
     or (select quantity_on_hand from public.inventory_items where id = v_item) <> 0 then
    raise exception 'Draft idempotency, uniqueness, or no-stock invariant failed';
  end if;
  perform public.save_receiving_report_item(v_report, gen_random_uuid(), v_item, null,
    2, 1, null, null, 'One rejected at inspection', null, null, null, null);
  perform public.post_receiving_report(v_report);
  v_register := public.get_inventory_request_register();
  if (select quantity_on_hand from public.inventory_items where id = v_item) <> 1
     or (select count(*) from public.inventory_transactions) <> v_before_tx + 1
     or not exists (select 1 from jsonb_array_elements(v_register) r,
       jsonb_array_elements(r->'lines') l where r->>'id' = v_request::text
       and r->>'status' = 'partially_received'
       and (l->>'accepted')::numeric = 1
       and (l->>'rejected')::numeric = 1
       and (l->>'remaining')::numeric = 1)
     or (select count(*) from public.receiving_reports
       where inventory_request_id = v_request and status = 'posted') <> 1 then
    raise exception 'Accepted-only posting or outstanding balance failed';
  end if;
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_report);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked or (select quantity_on_hand from public.inventory_items where id = v_item) <> 1 then
    raise exception 'Duplicate post changed stock';
  end if;
  raise notice 'MGR-REC-01 disposable request-to-Receiving checks passed; rolling back.';
end;
$verify$;
rollback;
