-- Run only in an approved disposable PostgreSQL/Supabase database after the
-- audit migration. Execute with ON_ERROR_STOP; all fixture writes roll back.
begin;

do $catalog$
begin
  if not exists (select 1 from pg_constraint
      where conrelid = 'public.inventory_audit_items'::regclass
        and conname = 'inventory_audit_movement_item_fk' and convalidated)
     or not exists (select 1 from pg_constraint
      where conrelid = 'public.inventory_audit_items'::regclass
        and conname = 'inventory_audit_item_unique')
     or not exists (select 1 from pg_constraint
      where conrelid = 'public.inventory_transactions'::regclass
        and conname = 'inventory_transactions_id_item_unique') then
    raise exception 'Audit relationship constraints are missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.inventory_audits'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.inventory_audit_items'::regclass)
     or has_table_privilege('authenticated', 'public.inventory_audits', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.inventory_audit_items', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('service_role', 'public.inventory_audits', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('service_role', 'public.inventory_audit_items', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'Audit RLS or direct-write ACL is unsafe';
  end if;
  if has_function_privilege('anon', 'public.run_manager_inventory_ledger_audit(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.run_manager_inventory_ledger_audit(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.get_manager_inventory_audits(integer,timestamptz,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.get_manager_inventory_audit_items(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.reject_inventory_audit_mutation()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.run_manager_inventory_ledger_audit(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_manager_inventory_audits(integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_manager_inventory_audit_items(uuid)', 'EXECUTE')
     or not (select prosecdef from pg_proc where oid = 'public.run_manager_inventory_ledger_audit(uuid)'::regprocedure)
     or not (select proconfig @> array['search_path='] from pg_proc where oid = 'public.run_manager_inventory_ledger_audit(uuid)'::regprocedure) then
    raise exception 'Audit run RPC ownership, ACL, or search path is unsafe';
  end if;
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'inventory_audits'
        and column_name in ('total_items', 'matched_count', 'mismatch_count', 'incomplete_count'))
     or exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'inventory_audit_items'
        and column_name = 'variance') then
    raise exception 'Derived audit values were stored redundantly';
  end if;
end;
$catalog$;

do $behavior$
declare
  v_manager uuid := gen_random_uuid();
  v_cashier uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_zero uuid := gen_random_uuid();
  v_gap uuid := gen_random_uuid();
  v_tie uuid := gen_random_uuid();
  v_many uuid := gen_random_uuid();
  v_reverse uuid := gen_random_uuid();
  v_a_movement uuid := gen_random_uuid();
  v_run uuid;
  v_second uuid;
  v_manual uuid := gen_random_uuid();
  v_before bigint;
  v_blocked boolean;
  v_saved record;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_manager, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-audit-manager@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_cashier, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'verify-audit-cashier@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Audit Manager', 'manager', true),
         (v_cashier, 'Audit Cashier', 'cashier', true)
  on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;
  insert into public.inventory_items
    (id, item_name, unit, quantity_on_hand, reorder_level, is_active,
     quantity_scale, rotation_policy, expiry_required)
  values
    (v_a, '__VERIFY_AUDIT_MATCH__', 'kg', 1.250, 0, true, 3, 'fifo', false),
    (v_b, '__VERIFY_AUDIT_MISMATCH__', 'pcs', 2, 0, true, 0, 'fifo', false),
    (v_zero, '__VERIFY_AUDIT_ZERO__', 'L', 0, 0, true, 3, 'fifo', false),
    (v_gap, '__VERIFY_AUDIT_GAP__', 'pcs', 3, 0, true, 0, 'fifo', false),
    (v_tie, '__VERIFY_AUDIT_TIE__', 'pcs', 2, 0, true, 0, 'fifo', false),
    (v_many, '__VERIFY_AUDIT_MANY__', 'pcs', 501, 0, true, 0, 'fifo', false),
    (v_reverse, '__VERIFY_AUDIT_REVERSE__', 'pcs', 1, 0, true, 0, 'fifo', false);
  insert into public.inventory_transactions
    (id, inventory_item_id, performed_by, transaction_type,
     quantity_before, quantity_change, quantity_after, created_at)
  values
    (v_a_movement, v_a, v_manager, 'adjustment', 0, 1.250, 1.250, now()),
    (gen_random_uuid(), v_b, v_manager, 'adjustment', 0, 1, 1, now()),
    (gen_random_uuid(), v_gap, v_manager, 'adjustment', 0, 1, 1, now()),
    (gen_random_uuid(), v_gap, v_manager, 'adjustment', 2, 1, 3, now() + interval '1 second'),
    (gen_random_uuid(), v_tie, v_manager, 'adjustment', 0, 1, 1, now()),
    (gen_random_uuid(), v_tie, v_manager, 'adjustment', 1, 1, 2, now()),
    (gen_random_uuid(), v_reverse, v_manager, 'adjustment', 0, 2, 2, now()),
    (gen_random_uuid(), v_reverse, v_manager, 'adjustment', 2, -1, 1, now() + interval '1 second');
  insert into public.inventory_transactions
    (inventory_item_id, performed_by, transaction_type,
     quantity_before, quantity_change, quantity_after, created_at)
  select v_many, v_manager, 'adjustment'::public.inventory_transaction_type,
    (n - 1)::numeric, 1::numeric, n::numeric,
    now() + n * interval '1 second'
  from generate_series(1, 501) as n;

  v_blocked := false;
  begin
    insert into public.inventory_transactions
      (inventory_item_id, performed_by, transaction_type,
       quantity_before, quantity_change, quantity_after)
    values (v_a, v_manager, 'adjustment', 0, 1, 2);
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'Invalid movement arithmetic was accepted'; end if;

  select count(*) into v_before from public.inventory_transactions;
  perform set_config('request.jwt.claim.sub', '', true);
  v_blocked := false;
  begin perform public.run_manager_inventory_ledger_audit(gen_random_uuid());
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'Anonymous audit run was accepted'; end if;
  perform set_config('request.jwt.claim.sub', v_cashier::text, true);
  v_blocked := false;
  begin perform public.run_manager_inventory_ledger_audit(gen_random_uuid());
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'Cashier audit run was accepted'; end if;

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_run := public.run_manager_inventory_ledger_audit(v_manual);
  if public.run_manager_inventory_ledger_audit(v_manual) <> v_run
     or (select count(*) from public.inventory_audits where request_id = v_manual) <> 1
     or (select count(*) from public.inventory_transactions) <> v_before
     or (select quantity_on_hand from public.inventory_items where id = v_a) <> 1.250 then
    raise exception 'Replay duplicated an audit or audit changed stock';
  end if;
  if not exists (select 1 from public.inventory_audit_items
      where audit_id = v_run and inventory_item_id = v_a and result = 'matched'
        and book_quantity = 1.250 and ledger_quantity = 1.250
        and recorded_unit = 'kg' and latest_movement_id = v_a_movement)
     or not exists (select 1 from public.inventory_audit_items
      where audit_id = v_run and inventory_item_id = v_b and result = 'mismatch'
        and finding_code = 'book_ledger_difference' and book_quantity = 2 and ledger_quantity = 1)
     or not exists (select 1 from public.inventory_audit_items
      where audit_id = v_run and inventory_item_id = v_zero and result = 'incomplete'
        and finding_code = 'no_history' and ledger_quantity is null)
     or not exists (select 1 from public.inventory_audit_items
      where audit_id = v_run and inventory_item_id = v_gap and result = 'incomplete'
        and finding_code = 'sequence_gap' and ledger_quantity is null)
     or not exists (select 1 from public.inventory_audit_items
      where audit_id = v_run and inventory_item_id = v_tie and result = 'incomplete'
        and finding_code = 'ambiguous_order' and ledger_quantity is null)
     or not exists (select 1 from public.inventory_audit_items
      where audit_id = v_run and inventory_item_id = v_many and result = 'matched'
        and movement_count = 501 and ledger_quantity = 501)
     or not exists (select 1 from public.inventory_audit_items
      where audit_id = v_run and inventory_item_id = v_reverse and result = 'matched'
        and ledger_quantity = 1 and movement_count = 2) then
    raise exception 'Audit classification or >500-row reconstruction is incorrect';
  end if;
  if (select movement_rows_examined from public.inventory_audits where id = v_run) <> v_before
     or (select total_items from public.get_manager_inventory_audits(25, null, null)
           where id = v_run) <> (select count(*) from public.inventory_audit_items where audit_id = v_run) then
    raise exception 'Audit summary does not derive from saved findings';
  end if;

  insert into public.inventory_audits
    (id, request_id, performed_by, started_at, completed_at, movement_rows_examined)
  values (gen_random_uuid(), gen_random_uuid(), v_manager, now(), now(), 0)
  returning id into v_manual;
  v_blocked := false;
  begin
    insert into public.inventory_audit_items
      (audit_id, inventory_item_id, latest_movement_id, item_name, recorded_unit,
       book_quantity, ledger_quantity, result, finding_code, movement_count)
    values (v_manual, v_b, v_a_movement, 'Wrong item', 'pcs', 1, 1, 'matched', 'matched', 1);
  exception when foreign_key_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'Cross-item movement reference was accepted'; end if;
  v_blocked := false;
  begin
    insert into public.inventory_audit_items
      (audit_id, inventory_item_id, item_name, recorded_unit,
       book_quantity, result, finding_code, movement_count)
    values (v_run, v_zero, 'Duplicate', 'L', 0, 'incomplete', 'no_history', 0);
  exception when unique_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'Duplicate audit/item finding was accepted'; end if;
  v_blocked := false;
  begin
    insert into public.inventory_audit_items
      (audit_id, inventory_item_id, item_name, recorded_unit,
       book_quantity, result, finding_code, movement_count)
    values (v_manual, gen_random_uuid(), 'Invalid item', 'pcs', 0, 'incomplete', 'no_history', 0);
  exception when foreign_key_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'Unknown inventory item was accepted'; end if;
  v_blocked := false;
  begin
    insert into public.inventory_audit_items
      (audit_id, inventory_item_id, item_name, recorded_unit,
       book_quantity, result, finding_code, movement_count)
    values (v_manual, v_zero, 'Invalid result', 'L', 0, 'approved', 'no_history', 0);
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'Unsupported audit result was accepted'; end if;
  v_blocked := false;
  begin
    update public.inventory_audit_items set item_name = 'Changed'
    where audit_id = v_run and inventory_item_id = v_a;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'Historical finding was updated'; end if;
  v_blocked := false;
  begin delete from public.inventory_audits where id = v_run;
  exception when insufficient_privilege then v_blocked := true; end;
  if not v_blocked then raise exception 'Completed audit was deleted'; end if;

  update public.inventory_items set item_name = '__VERIFY_AUDIT_RENAMED__',
    unit = 'g', quantity_on_hand = 2 where id = v_a;
  select item_name, recorded_unit, book_quantity, ledger_quantity, result, finding_code
    into v_saved from public.inventory_audit_items
    where audit_id = v_run and inventory_item_id = v_a;
  if v_saved.item_name <> '__VERIFY_AUDIT_MATCH__' or v_saved.recorded_unit <> 'kg'
     or v_saved.book_quantity <> 1.250 or v_saved.ledger_quantity <> 1.250
     or v_saved.result <> 'matched' or v_saved.finding_code <> 'matched' then
    raise exception 'Historical snapshot changed with live inventory';
  end if;
  v_second := public.run_manager_inventory_ledger_audit(gen_random_uuid());
  if v_second = v_run then raise exception 'Distinct request ID reused a run'; end if;
  raise notice 'PASS: audit catalog, Manager authorization, classification, 501 rows, replay, FKs, immutability, and history';
end;
$behavior$;

rollback;
