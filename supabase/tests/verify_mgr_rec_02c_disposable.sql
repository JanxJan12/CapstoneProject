-- MGR-REC-02C integrated rollback-only test. Disposable PostgreSQL only.
begin;
do $verify$
declare
  v_manager uuid := gen_random_uuid();
  v_second_manager uuid := gen_random_uuid();
  v_cashier uuid := gen_random_uuid();
  v_rider uuid := gen_random_uuid();
  v_inactive_manager uuid := gen_random_uuid();
  v_denied_actor uuid;
  v_item uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_report uuid := gen_random_uuid();
  v_other_report uuid := gen_random_uuid();
  v_needed timestamptz := now() + interval '2 days';
  v_lines jsonb;
  v_register jsonb;
  v_workspace jsonb;
  v_before_tx integer;
  v_before_batches integer;
  v_line uuid := gen_random_uuid();
  v_blocked boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'verify-mgr-rec-' || v_manager || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Receiving Manager', 'manager', true)
  on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select actor, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
    'verify-mgr-rec-02c-' || actor || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array[v_second_manager, v_cashier, v_rider, v_inactive_manager]) actor;
  insert into public.profiles (id, first_name, role, is_active) values
    (v_second_manager, 'Second Manager', 'manager', true),
    (v_cashier, 'Cashier', 'cashier', true),
    (v_rider, 'Rider', 'rider', true),
    (v_inactive_manager, 'Inactive Manager', 'manager', false)
  on conflict (id) do update set first_name = excluded.first_name,
    role = excluded.role, is_active = excluded.is_active;
  insert into public.inventory_items (id, item_name, unit, quantity_on_hand,
    reorder_level, is_active, quantity_scale, rotation_policy, expiry_required)
  values (v_item, 'Fried Chicken - Quarter Leg', 'pcs', 0, 2, true, 0, 'fifo', false);
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  select count(*) into v_before_tx from public.inventory_transactions;
  select count(*) into v_before_batches from public.inventory_batches;
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
  perform public.start_inventory_request_receiving(v_request, 1, v_report,
    'FORGED INSPECTOR', null);
  if not exists (select 1 from public.receiving_reports
      where id = v_report and inventory_request_id = v_request
        and inventory_request_revision = 1 and source_type = 'production_team'
        and status = 'draft' and received_by = v_manager
        and inspected_by_name = v_manager::text and inspection_note is null)
     or not exists (select 1 from public.inventory_request_events
      where request_id = v_request and event_type = 'delivery_started'
        and actor_id = v_manager and details->>'inspected_by_name' = v_manager::text)
     or (select count(*) from public.inventory_batches) <> v_before_batches then
    raise exception 'Draft inspector/creator/association/note/batch baseline failed';
  end if;
  v_workspace := public.get_manager_receiving_workspace(v_report);
  if v_workspace->'selected_report'->>'id' <> v_report::text
     or v_workspace->'selected_report'->>'status' <> 'draft'
     or v_workspace->'selected_report'->>'received_by' <> v_manager::text
     or v_workspace->'selected_report'->>'source_reference' is null then
    raise exception 'Manager Receiving workspace did not read the linked draft';
  end if;
  perform set_config('request.jwt.claim.sub', v_second_manager::text, true);
  perform public.start_inventory_request_receiving(v_request, 1, v_report,
    'SECOND FORGED INSPECTOR', 'do not overwrite');
  if (select inspected_by_name from public.receiving_reports where id = v_report) <> v_manager::text
     or (select inspection_note from public.receiving_reports where id = v_report) is not null
     or (select count(*) from public.receiving_reports where inventory_request_id = v_request) <> 1 then
    raise exception 'Resume overwrote the original inspector or created another draft';
  end if;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_blocked := false;
  begin
    perform public.start_inventory_request_receiving(v_request, 1, v_other_report, null, null);
  exception when unique_violation then v_blocked := true;
  end;
  if not v_blocked or (select count(*) from public.receiving_reports
      where inventory_request_id = v_request and status = 'draft') <> 1
     or (select count(*) from public.inventory_transactions) <> v_before_tx
     or (select quantity_on_hand from public.inventory_items where id = v_item) <> 0 then
    raise exception 'Draft idempotency, uniqueness, or no-stock invariant failed';
  end if;
  foreach v_denied_actor in array array[v_cashier, v_rider, v_inactive_manager] loop
    perform set_config('request.jwt.claim.sub', v_denied_actor::text, true);
    v_blocked := false;
    begin
      perform public.start_inventory_request_receiving(v_request, 1, gen_random_uuid(), null, null);
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception 'Unauthorized actor % started draft', v_denied_actor; end if;
    v_blocked := false;
    begin
      perform public.post_receiving_report(v_report);
    exception when insufficient_privilege then v_blocked := true;
    end;
    if not v_blocked then raise exception 'Unauthorized actor % posted draft', v_denied_actor; end if;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  v_blocked := false;
  begin
    perform public.start_inventory_request_receiving(v_request, 1, gen_random_uuid(), null, null);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Unauthenticated actor started draft'; end if;
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_report);
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Unauthenticated actor posted draft'; end if;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_blocked := false;
  begin
    perform public.save_receiving_report_item(v_report, v_line, v_item, null,
      2, 1, null, null, null, null, null, null);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Rejected quantity accepted without a reason'; end if;
  perform public.save_receiving_report_item(v_report, v_line, v_item, null,
    2, 1, null, null, 'One rejected at inspection', null, null, null);
  if not exists (select 1 from public.receiving_report_items where id = v_line
      and receiving_report_id = v_report and inventory_item_id = v_item
      and quantity_delivered = 2 and quantity_accepted = 1 and quantity_rejected = 1
      and rejection_reason = 'One rejected at inspection')
     or (select quantity_on_hand from public.inventory_items where id = v_item) <> 0
     or (select count(*) from public.inventory_transactions) <> v_before_tx
     or (select count(*) from public.inventory_batches) <> v_before_batches then
    raise exception 'Saved draft line or pre-post stock isolation failed';
  end if;
  perform public.post_receiving_report(v_report);
  v_register := public.get_inventory_request_register();
  if (select quantity_on_hand from public.inventory_items where id = v_item) <> 1
     or (select count(*) from public.inventory_transactions) <> v_before_tx + 1
     or (select count(*) from public.inventory_batches) <> v_before_batches + 1
     or not exists (select 1 from public.inventory_batches b
       where b.receiving_report_item_id = v_line and b.inventory_item_id = v_item
         and b.quantity_initial = 1 and b.quantity_on_hand = 1)
     or not exists (select 1 from public.inventory_transactions t
       join public.inventory_batches b on b.id = t.inventory_batch_id
       where b.receiving_report_item_id = v_line and t.inventory_item_id = v_item
         and t.transaction_type::text = 'receiving' and t.quantity_change = 1
         and t.quantity_before = 0 and t.quantity_after = 1)
     or not exists (select 1 from public.receiving_reports
       where id = v_report and status = 'posted' and posted_at is not null
         and posted_by = v_manager and received_by = v_manager
         and inspected_by_name = v_manager::text and inventory_request_id = v_request
         and inventory_request_revision = 1)
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
    perform public.save_receiving_report_item(v_report, v_line, v_item, null,
      2, 1, null, null, 'One rejected at inspection', null, null, null);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Posted receipt allowed a line edit'; end if;
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_report);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked or (select quantity_on_hand from public.inventory_items where id = v_item) <> 1
     or (select count(*) from public.inventory_transactions) <> v_before_tx + 1
     or (select count(*) from public.inventory_batches) <> v_before_batches + 1 then
    raise exception 'Duplicate post changed stock';
  end if;
  perform public.start_inventory_request_receiving(v_request, 1, v_other_report, null, null);
  if not exists (select 1 from public.receiving_reports
      where id = v_other_report and status = 'draft' and inspected_by_name = v_manager::text)
     or (select quantity_on_hand from public.inventory_items where id = v_item) <> 1 then
    raise exception 'Partial request could not start next delivery without stock mutation';
  end if;
  perform set_config('qa.manager_id', v_manager::text, true);
  perform set_config('qa.posted_report_id', v_report::text, true);
  raise notice 'MGR-REC-02C PASS: item % request % report %; before stock 0 batches % transactions % outstanding 2; after stock 1 batches % transactions % outstanding 1; rolling back',
    v_item, v_request, v_report, v_before_batches, v_before_tx,
    (select count(*) from public.inventory_batches),
    (select count(*) from public.inventory_transactions);
end;
$verify$;
select set_config('request.jwt.claim.sub', current_setting('qa.manager_id'), true);
set local role authenticated;
do $role_check$
declare v_report uuid := current_setting('qa.posted_report_id')::uuid;
  v_workspace jsonb; v_blocked boolean := false;
begin
  v_workspace := public.get_manager_receiving_workspace(v_report);
  if v_workspace->'selected_report'->>'id' <> v_report::text
     or v_workspace->'selected_report'->>'status' <> 'posted' then
    raise exception 'Authenticated database role could not read posted receipt';
  end if;
  begin
    perform public.post_receiving_report(v_report);
  exception when invalid_parameter_value then v_blocked := true;
  end;
  if not v_blocked then raise exception 'Authenticated duplicate post was not denied'; end if;
  raise notice 'Authenticated database role read posted receipt and duplicate post was denied';
end;
$role_check$;
reset role;
rollback;
