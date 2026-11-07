-- Run after 20261004160118_inventory_master_data_foundation.sql in a trusted
-- PostgreSQL session. Every fixture and behavior write is rolled back.

begin;

do $catalog_verification$
declare
  v_chicken record;
  v_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_items'
      and column_name = 'shelf_life_days' and data_type = 'smallint'
  ) then
    raise exception 'shelf_life_days schema is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_items'
      and column_name = 'batch_consumption_enabled'
      and data_type = 'boolean' and is_nullable = 'NO'
  ) then
    raise exception 'batch consumption policy schema is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_quantity_scale_chk'
      and pg_get_constraintdef(oid) ilike '%quantity_scale >= 0%'
      and pg_get_constraintdef(oid) ilike '%quantity_scale <= 3%'
  ) then
    raise exception 'quantity_scale is not reconciled to numeric(12,3) storage';
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and pg_get_constraintdef(oid) ilike '%expiry_required%rotation_policy%fefo%'
  ) then
    raise exception 'expiry remains coupled to FEFO';
  end if;

  if not exists (
    select 1 from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace namespace on namespace.oid = enum_type.typnamespace
    where namespace.nspname = 'public'
      and enum_type.typname = 'inventory_transaction_type'
      and enum_value.enumlabel = 'opening_balance'
  ) then
    raise exception 'opening_balance transaction type is missing';
  end if;

  if to_regclass('public.inventory_opening_balances') is null then
    raise exception 'opening balance authority table is missing';
  end if;

  if exists (select 1 from public.inventory_items where shelf_life_days is not null)
     or exists (select 1 from public.inventory_items where batch_consumption_enabled)
  then
    raise exception 'existing inventory items did not retain null shelf life and legacy batch behavior';
  end if;

  select item_name, unit, secondary_unit, quantity_on_hand, item_kind,
         quantity_scale, rotation_policy, expiry_required,
         shelf_life_days, batch_consumption_enabled
  into strict v_chicken
  from public.inventory_items
  where item_name = 'Chicken' and unit = 'kg';

  if v_chicken.secondary_unit <> 'pcs'
     or v_chicken.quantity_on_hand <> 29.251
     or v_chicken.item_kind <> 'raw'
     or v_chicken.quantity_scale <> 3
     or v_chicken.rotation_policy <> 'fefo'
     or not v_chicken.expiry_required
     or v_chicken.shelf_life_days is not null
     or v_chicken.batch_consumption_enabled
  then
    raise exception 'historical Chicken changed';
  end if;

  select pg_get_functiondef(procedure.oid) into v_definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'initialize_inventory_opening_balance'
    and procedure.prosecdef
    and procedure.proconfig @> array['search_path=public, extensions, pg_temp'];

  if v_definition is null
     or v_definition not ilike '%auth.uid()%'
     or v_definition not ilike '%role = ''manager''%'
     or v_definition not ilike '%is_active = true%'
  then
    raise exception 'opening RPC authorization or search_path contract is incomplete';
  end if;

  if has_function_privilege('anon', 'public.initialize_inventory_opening_balance(uuid,jsonb,text,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.initialize_inventory_opening_balance(uuid,jsonb,text,uuid)', 'EXECUTE')
     or has_table_privilege('authenticated', 'public.inventory_opening_balances', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.inventory_opening_balances', 'SELECT, INSERT, UPDATE, DELETE')
  then
    raise exception 'opening authority ACL is incorrect';
  end if;
end
$catalog_verification$;

do $behavior_verification$
declare
  v_manager_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_scale0_id uuid := gen_random_uuid();
  v_scale2_id uuid := gen_random_uuid();
  v_shelf_receiving_id uuid := gen_random_uuid();
  v_manual_expiry_id uuid := gen_random_uuid();
  v_nonexpiry_id uuid := gen_random_uuid();
  v_opening_id uuid := gen_random_uuid();
  v_zero_id uuid := gen_random_uuid();
  v_atomic_id uuid := gen_random_uuid();
  v_category_id uuid := gen_random_uuid();
  v_menu_id uuid := gen_random_uuid();
  v_report_id uuid := gen_random_uuid();
  v_manual_report_id uuid := gen_random_uuid();
  v_nonexpiry_report_id uuid := gen_random_uuid();
  v_line_id uuid := gen_random_uuid();
  v_open_request uuid := gen_random_uuid();
  v_zero_request uuid := gen_random_uuid();
  v_atomic_request uuid := gen_random_uuid();
  v_result jsonb;
  v_replay jsonb;
  v_blocked boolean;
  v_reports_before bigint;
  v_po_before bigint;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_manager_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-6b5b-manager@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_customer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-6b5b-customer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, first_name, last_name, role, is_active) values
    (v_manager_id, 'Verify', 'Foundation Manager', 'manager', true),
    (v_customer_id, 'Verify', 'Foundation Customer', 'customer', true)
  on conflict (id) do update set role = excluded.role, is_active = excluded.is_active;

  insert into public.inventory_items (
    id, item_name, unit, quantity_on_hand, reorder_level, is_active,
    quantity_scale, rotation_policy, expiry_required, shelf_life_days,
    batch_consumption_enabled
  ) values
    (v_scale0_id, '__VERIFY_6B5B_SCALE0__', 'pcs', 10, 2, true, 0, 'fifo', false, null, false),
    (v_scale2_id, '__VERIFY_6B5B_SCALE2__', 'L', 10.25, 1.25, true, 2, 'fifo', false, null, false),
    (v_shelf_receiving_id, '__VERIFY_6B5B_SHELF_RECEIVING__', 'pcs', 0, 0, true, 0, 'fifo', true, 2, false),
    (v_manual_expiry_id, '__VERIFY_6B5B_MANUAL_EXPIRY__', 'kg', 0, 0, true, 3, 'fefo', true, null, false),
    (v_nonexpiry_id, '__VERIFY_6B5B_NONEXPIRY__', 'kg', 0, 0, true, 3, 'fifo', false, null, false),
    (v_opening_id, '__VERIFY_6B5B_OPENING__', 'pcs', 0, 0, true, 0, 'fifo', true, 2, true),
    (v_zero_id, '__VERIFY_6B5B_ZERO__', 'pcs', 0, 0, true, 0, 'fifo', false, null, true),
    (v_atomic_id, '__VERIFY_6B5B_ATOMIC__', 'pcs', 0, 0, true, 0, 'fifo', true, 2, true);

  -- Positive shelf life, FIFO+expiry, and FEFO+expiry have all been accepted.
  v_blocked := false;
  begin
    update public.inventory_items set shelf_life_days = 0 where id = v_nonexpiry_id;
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'zero shelf life was accepted'; end if;

  v_blocked := false;
  begin
    update public.inventory_items set shelf_life_days = -1 where id = v_nonexpiry_id;
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'negative shelf life was accepted'; end if;

  -- Direct aggregate defense and scale-change defense.
  v_blocked := false;
  begin
    update public.inventory_items set quantity_on_hand = 10.5 where id = v_scale0_id;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'scale-0 aggregate accepted a fraction'; end if;

  v_blocked := false;
  begin
    update public.inventory_items set quantity_scale = 0 where id = v_scale2_id;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'scale change stranded incompatible stored quantities'; end if;

  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  -- Legacy receiving authority: integer accepted, fraction rejected.
  perform public.receive_inventory_stock(v_scale0_id, 2, 'Verifier receive', gen_random_uuid());
  v_blocked := false;
  begin
    perform public.receive_inventory_stock(v_scale0_id, 1.5, 'Invalid verifier receive', gen_random_uuid());
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'legacy receiving accepted scale-0 fraction'; end if;

  -- Adjustment authority and scale-2 boundary.
  perform public.adjust_inventory_stock(v_scale0_id, 1, 'Verifier adjustment', gen_random_uuid());
  v_blocked := false;
  begin
    perform public.adjust_inventory_stock(v_scale0_id, 1.1, 'Invalid adjustment', gen_random_uuid());
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'adjustment accepted scale-0 fraction'; end if;

  perform public.adjust_inventory_stock(v_scale2_id, 1.25, 'Verifier scale-2 adjustment', gen_random_uuid());
  v_blocked := false;
  begin
    perform public.adjust_inventory_stock(v_scale2_id, 1.251, 'Invalid scale-2 adjustment', gen_random_uuid());
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'adjustment accepted scale-2 third decimal'; end if;

  -- Waste authority.
  perform public.record_inventory_waste(v_scale0_id, 1, 'Verifier waste', gen_random_uuid());
  v_blocked := false;
  begin
    perform public.record_inventory_waste(v_scale0_id, 1.5, 'Invalid verifier waste', gen_random_uuid());
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'waste accepted scale-0 fraction'; end if;

  -- Recipe precision is based on the base item only.
  insert into public.menu_categories (id, name, is_active)
  values (v_category_id, '__VERIFY_6B5B_CATEGORY__', true);
  insert into public.menu_items (id, category_id, name, code, price, is_available, is_active)
  values (v_menu_id, v_category_id, '__VERIFY_6B5B_MENU__', 'V6B5B', 1, false, false);
  insert into public.menu_ingredients (menu_item_id, inventory_item_id, quantity_required)
  values (v_menu_id, v_scale2_id, 1.25);
  v_blocked := false;
  begin
    update public.menu_ingredients set quantity_required = 1.251
    where menu_item_id = v_menu_id and inventory_item_id = v_scale2_id;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'recipe accepted quantity beyond item scale'; end if;

  -- Late Monday Manila remains Monday Day 1; Tuesday is Day 2.
  perform public.create_receiving_report_draft(
    v_report_id, 'production_team', 'VERIFY-SHELF', null,
    '2026-10-05 15:30:00+00'::timestamptz, null, null
  );
  perform public.save_receiving_report_item(
    v_report_id, v_line_id, v_shelf_receiving_id, null,
    2, 2, null, null, null, null, null, null, null
  );
  if (select use_by_date from public.receiving_report_items where id = v_line_id) <> date '2026-10-06' then
    raise exception 'late-Monday shelf date was not derived as Tuesday';
  end if;

  -- Explicit match is accepted; conflict and fractional receiving are rejected.
  perform public.save_receiving_report_item(
    v_report_id, v_line_id, v_shelf_receiving_id, null,
    2, 2, null, null, null, null, null, date '2026-10-06', null
  );
  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_report_id, v_line_id, v_shelf_receiving_id, null,
      2, 2, null, null, null, null, null, date '2026-10-07', null
    );
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'conflicting receiving use-by date was accepted'; end if;

  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_report_id, gen_random_uuid(), v_shelf_receiving_id, null,
      1.5, 1.5, null, null, null, null, null, null, null
    );
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'formal receiving accepted scale-0 fraction'; end if;

  perform public.post_receiving_report(v_report_id);
  if not exists (
    select 1 from public.inventory_batches batch
    where batch.receiving_report_item_id = v_line_id
      and batch.use_by_date = date '2026-10-06'
      and batch.quantity_initial = 2
  ) then
    raise exception 'formal posting did not preserve authoritative shelf date and quantity';
  end if;

  perform public.create_receiving_report_draft(
    v_manual_report_id, 'production_team', 'VERIFY-MANUAL', null,
    now(), null, null
  );
  v_blocked := false;
  begin
    perform public.save_receiving_report_item(
      v_manual_report_id, gen_random_uuid(), v_manual_expiry_id, null,
      1, 1, null, null, null, null, null, null, null
    );
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'manual-expiry item accepted no use-by date'; end if;

  perform public.create_receiving_report_draft(
    v_nonexpiry_report_id, 'production_team', 'VERIFY-NONEXPIRY', null,
    now(), null, null
  );
  perform public.save_receiving_report_item(
    v_nonexpiry_report_id, gen_random_uuid(), v_nonexpiry_id, null,
    1.25, 1.25, null, null, null, null, null, null, null
  );

  select count(*) into v_reports_before from public.receiving_reports;
  select count(*) into v_po_before from public.purchase_orders;

  -- Opening authorization: customer and anonymous are rejected.
  perform set_config('request.jwt.claim.sub', v_customer_id::text, true);
  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(v_opening_id, '[]'::jsonb, null, gen_random_uuid());
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'non-Manager initialized opening stock'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(v_opening_id, '[]'::jsonb, null, gen_random_uuid());
  exception when insufficient_privilege then v_blocked := true;
  end;
  if not v_blocked then raise exception 'anonymous initialized opening stock'; end if;

  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  v_result := public.initialize_inventory_opening_balance(
    v_opening_id,
    jsonb_build_array(
      jsonb_build_object('quantity', 12, 'received_at', '2026-10-05T15:30:00Z', 'use_by_date', '2026-10-06', 'source_lot_code', 'LOT-A'),
      jsonb_build_object('quantity', 20, 'received_at', '2026-10-06T01:00:00Z', 'use_by_date', '2026-10-07', 'source_lot_code', 'LOT-B')
    ),
    'Verified physical count',
    v_open_request
  );

  if (v_result->>'quantity_total')::numeric <> 32
     or (v_result->>'batch_count')::integer <> 2
     or (v_result->>'replayed')::boolean
     or (select quantity_on_hand from public.inventory_items where id = v_opening_id) <> 32
     or (select count(*) from public.inventory_batches where opening_balance_id = (v_result->>'opening_balance_id')::uuid) <> 2
     or (select sum(quantity_initial) from public.inventory_batches where opening_balance_id = (v_result->>'opening_balance_id')::uuid) <> 32
     or not exists (
       select 1 from public.inventory_transactions transaction_record
       where transaction_record.opening_balance_id = (v_result->>'opening_balance_id')::uuid
         and transaction_record.transaction_type = 'opening_balance'
         and transaction_record.quantity_change = 32
         and transaction_record.quantity_before = 0
         and transaction_record.quantity_after = 32
     )
  then
    raise exception 'multi-batch opening aggregate/batch/ledger result is incorrect';
  end if;

  if exists (
    select 1 from public.inventory_batches batch
    where batch.opening_balance_id = (v_result->>'opening_balance_id')::uuid
      and (batch.origin_type <> 'legacy_opening' or batch.use_by_date <> (batch.received_at at time zone 'Asia/Manila')::date + 1)
  ) then
    raise exception 'opening batches did not preserve origin or shelf-life derivation';
  end if;

  v_replay := public.initialize_inventory_opening_balance(
    v_opening_id,
    jsonb_build_array(
      jsonb_build_object('quantity', 12, 'received_at', '2026-10-05T15:30:00Z', 'use_by_date', '2026-10-06', 'source_lot_code', 'LOT-A'),
      jsonb_build_object('quantity', 20, 'received_at', '2026-10-06T01:00:00Z', 'use_by_date', '2026-10-07', 'source_lot_code', 'LOT-B')
    ),
    'Verified physical count',
    v_open_request
  );
  if (v_replay->>'opening_balance_id') <> (v_result->>'opening_balance_id')
     or not (v_replay->>'replayed')::boolean
     or (select count(*) from public.inventory_batches where opening_balance_id = (v_result->>'opening_balance_id')::uuid) <> 2
  then
    raise exception 'opening replay was not idempotent';
  end if;

  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(v_opening_id, '[]'::jsonb, 'Conflict', v_open_request);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'conflicting opening replay was accepted'; end if;

  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(v_opening_id, '[]'::jsonb, null, gen_random_uuid());
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'second item initialization was accepted'; end if;

  v_result := public.initialize_inventory_opening_balance(v_zero_id, '[]'::jsonb, 'Verified zero', v_zero_request);
  if (v_result->>'quantity_total')::numeric <> 0
     or (v_result->>'batch_count')::integer <> 0
     or exists (select 1 from public.inventory_batches where opening_balance_id = (v_result->>'opening_balance_id')::uuid)
     or exists (select 1 from public.inventory_transactions where opening_balance_id = (v_result->>'opening_balance_id')::uuid)
     or (select quantity_on_hand from public.inventory_items where id = v_zero_id) <> 0
  then
    raise exception 'verified zero opening created stock or movement';
  end if;

  -- Invalid second batch must roll back header, first batch, aggregate, and ledger.
  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(
      v_atomic_id,
      jsonb_build_array(
        jsonb_build_object('quantity', 1, 'received_at', '2026-10-05T15:30:00Z'),
        jsonb_build_object('quantity', 2, 'received_at', '2026-10-05T15:30:00Z', 'use_by_date', '2026-10-09')
      ),
      'Must roll back',
      v_atomic_request
    );
  exception when others then v_blocked := true;
  end;
  if not v_blocked
     or exists (select 1 from public.inventory_opening_balances where request_id = v_atomic_request)
     or exists (select 1 from public.inventory_batches where inventory_item_id = v_atomic_id)
     or exists (select 1 from public.inventory_transactions where inventory_item_id = v_atomic_id)
     or (select quantity_on_hand from public.inventory_items where id = v_atomic_id) <> 0
  then
    raise exception 'failed opening initialization did not roll back atomically';
  end if;

  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(
      v_atomic_id,
      jsonb_build_array(jsonb_build_object('quantity', 1.5)),
      null,
      gen_random_uuid()
    );
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'opening authority accepted scale-0 fraction'; end if;

  if (select count(*) from public.receiving_reports) <> v_reports_before
     or (select count(*) from public.purchase_orders) <> v_po_before
  then
    raise exception 'opening initialization fabricated a receiving report or changed purchase orders';
  end if;
end
$behavior_verification$;

select 'Phase 6B.5B SQL verification: 48/48 checks passed.' as result;

rollback;
