-- Run after 20261013053159_production_delivery_policy.sql in a trusted
-- PostgreSQL session. Every behavioral write is rolled back. New unlinked
-- Production receipts carry explicit Manager emergency evidence.

begin;

do $catalog_verification$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_reports'
      and column_name = 'source_type'
      and data_type = 'text'
      and is_nullable = 'NO'
      and column_default = '''direct_supplier''::text'
  ) then
    raise exception 'receiving_reports.source_type contract is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_reports'
      and column_name = 'purchase_order_id'
      and is_nullable = 'YES'
  ) then
    raise exception 'receiving_reports.purchase_order_id is not conditional';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_report_items'
      and column_name = 'inventory_item_id'
      and data_type = 'uuid'
      and is_nullable = 'YES'
  ) then
    raise exception 'receiving_report_items.inventory_item_id is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_report_items'
      and column_name = 'purchase_order_item_id'
      and is_nullable = 'YES'
  ) then
    raise exception 'receiving_report_items.purchase_order_item_id is not conditional';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid in (
      'public.receiving_reports'::regclass,
      'public.receiving_report_items'::regclass
    )
      and conname in (
        'receiving_reports_source_type_chk',
        'receiving_reports_source_reference_chk',
        'receiving_reports_source_semantics_chk',
        'receiving_report_items_inventory_item_id_fkey',
        'receiving_report_items_source_reference_chk',
        'receiving_report_items_source_lot_code_chk',
        'receiving_report_items_date_order_chk'
      )
      and convalidated
  ) <> 7 then
    raise exception 'Source-neutral receiving constraints are incomplete';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'inventory_batches'
      and indexname = 'inventory_batches_receiving_report_item_uidx'
      and indexdef ilike 'create unique index%'
  ) then
    raise exception 'One receiving batch per accepted line is not enforced';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'inventory_transactions'
      and indexname = 'inventory_transactions_receiving_batch_uidx'
      and indexdef ilike 'create unique index%'
  ) then
    raise exception 'One receiving ledger movement per batch is not enforced';
  end if;

  select pg_get_functiondef(procedure.oid)
  into v_definition
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'post_receiving_report'
    and pg_get_function_identity_arguments(procedure.oid)
      = 'p_receiving_report_id uuid'
    and procedure.prosecdef
    and procedure.proconfig @> array[
      'search_path=public, extensions, pg_temp'
    ];

  if v_definition is null
     or v_definition not ilike '%auth.uid()%'
     or v_definition not ilike '%profile.role = ''manager''%'
     or v_definition not ilike '%profile.is_active = true%'
     or v_definition not ilike '%for update%'
     or v_definition not ilike '%insert into public.inventory_batches%'
     or v_definition not ilike '%update public.inventory_items%'
     or v_definition not ilike '%insert into public.inventory_transactions%'
  then
    raise exception 'post_receiving_report authority or locking contract is incomplete';
  end if;

  if has_function_privilege(
    'anon',
    'public.post_receiving_report(uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute post_receiving_report';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.post_receiving_report(uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute post_receiving_report';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.receiving_reports',
    'INSERT, UPDATE, DELETE'
  ) or has_table_privilege(
    'authenticated',
    'public.receiving_report_items',
    'INSERT, UPDATE, DELETE'
  ) or has_table_privilege(
    'authenticated',
    'public.inventory_batches',
    'INSERT, UPDATE, DELETE'
  ) then
    raise exception 'authenticated gained direct receiving-table DML';
  end if;
end
$catalog_verification$;

create temporary table verify_receiving_ids (
  key text primary key,
  value uuid not null
) on commit drop;

do $behavior_verification$
declare
  v_manager_id uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_supplier_id uuid := gen_random_uuid();
  v_production_item_id uuid := gen_random_uuid();
  v_supplier_item_id uuid := gen_random_uuid();
  v_secondary_item_id uuid := gen_random_uuid();
  v_expiry_item_id uuid := gen_random_uuid();
  v_rollback_item_one_id uuid := gen_random_uuid();
  v_rollback_item_two_id uuid := gen_random_uuid();
  v_unauthorized_item_id uuid := gen_random_uuid();
  v_po_id uuid := gen_random_uuid();
  v_other_po_id uuid := gen_random_uuid();
  v_po_item_id uuid := gen_random_uuid();
  v_other_po_item_id uuid := gen_random_uuid();
  v_production_report_id uuid := gen_random_uuid();
  v_production_line_id uuid := gen_random_uuid();
  v_supplier_report_id uuid := gen_random_uuid();
  v_supplier_line_id uuid := gen_random_uuid();
  v_invalid_supplier_report_id uuid := gen_random_uuid();
  v_secondary_report_id uuid := gen_random_uuid();
  v_expiry_report_id uuid := gen_random_uuid();
  v_rollback_report_id uuid := gen_random_uuid();
  v_rollback_line_one_id uuid := gen_random_uuid();
  v_rollback_line_two_id uuid := gen_random_uuid();
  v_unauthorized_report_id uuid := gen_random_uuid();
  v_batch_id uuid;
  v_result jsonb;
  v_blocked boolean;
  v_quantity numeric;
  v_secondary_quantity numeric;
  v_po_quantity_before numeric;
  v_po_quantity_after numeric;
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values
    (
      v_manager_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'verify-receiving-manager@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      v_customer_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'verify-receiving-customer@example.invalid',
      '',
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

  insert into public.profiles (
    id,
    first_name,
    last_name,
    role,
    is_active
  )
  values
    (v_manager_id, 'Verify', 'Manager', 'manager', true),
    (v_customer_id, 'Verify', 'Customer', 'customer', true)
  on conflict (id) do update
  set
    role = excluded.role,
    is_active = excluded.is_active;

  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  insert into public.suppliers (id, name, is_active)
  values (v_supplier_id, '__verify_receiving_supplier__', true);

  insert into public.inventory_items (
    id,
    item_name,
    unit,
    quantity_on_hand,
    reorder_level,
    is_active,
    quantity_scale,
    rotation_policy,
    expiry_required
  )
  values
    (v_production_item_id, '__verify_production_pcs__', 'pcs', 0, 0, true, 0, 'fifo', false),
    (v_supplier_item_id, '__verify_supplier_kg__', 'kg', 5, 0, true, 3, 'fifo', false),
    (v_expiry_item_id, '__verify_expiry_kg__', 'kg', 0, 0, true, 3, 'fefo', true),
    (v_rollback_item_one_id, '__verify_rollback_one__', 'kg', 10, 0, true, 3, 'fifo', false),
    (v_rollback_item_two_id, '__verify_rollback_two__', 'kg', 20, 0, true, 3, 'fifo', false),
    (v_unauthorized_item_id, '__verify_unauthorized__', 'pcs', 0, 0, true, 0, 'fifo', false);

  insert into public.inventory_items (
    id,
    item_name,
    unit,
    secondary_unit,
    quantity_on_hand,
    reorder_level,
    is_active,
    quantity_scale,
    rotation_policy,
    expiry_required
  )
  values (
    v_secondary_item_id,
    '__verify_independent_units__',
    'kg',
    'pcs',
    0,
    0,
    true,
    3,
    'fifo',
    false
  );

  insert into public.purchase_orders (
    id,
    po_number,
    supplier_id,
    created_by,
    status,
    ordered_at
  )
  values
    (v_po_id, '__VERIFY-PO-PRIMARY__', v_supplier_id, v_manager_id, 'submitted', now()),
    (v_other_po_id, '__VERIFY-PO-OTHER__', v_supplier_id, v_manager_id, 'submitted', now());

  insert into public.purchase_order_items (
    id,
    purchase_order_id,
    inventory_item_id,
    quantity_ordered,
    quantity_received,
    unit_cost,
    total_cost
  )
  values
    (v_po_item_id, v_po_id, v_supplier_item_id, 100, 0, 10, 1000),
    (v_other_po_item_id, v_other_po_id, v_supplier_item_id, 30, 0, 10, 300);

  select quantity_received
  into v_po_quantity_before
  from public.purchase_order_items
  where id = v_po_item_id;

  -- Production Team: delivered 60, accepted 58, rejected 2, no PO.
  insert into public.receiving_reports (
    id,
    rr_number,
    source_type,
    source_reference,
    purchase_order_id,
    received_at,
    received_by,
    emergency_reason, emergency_authorized_by,
    emergency_authorized_at, emergency_inspected_by_name
  )
  values (
    v_production_report_id,
    '__VERIFY-RR-PRODUCTION__',
    'production_team',
    'PROD-HANDOFF-001',
    null,
    now(),
    v_manager_id,
    'Synthetic local receiving verifier', v_manager_id,
    now(), 'Verify Inspector'
  );

  insert into public.receiving_report_items (
    id,
    receiving_report_id,
    inventory_item_id,
    purchase_order_item_id,
    quantity_delivered,
    quantity_accepted,
    rejection_reason,
    source_lot_code
  )
  values (
    v_production_line_id,
    v_production_report_id,
    v_production_item_id,
    null,
    60,
    58,
    'Two pieces rejected at Foodhouse receiving',
    'PROD-LOT-001'
  );

  v_result := public.post_receiving_report(v_production_report_id);

  if v_result ->> 'status' <> 'posted'
     or (v_result ->> 'total_accepted')::numeric <> 58
     or (v_result ->> 'batch_count')::integer <> 1
     or (v_result ->> 'transaction_count')::integer <> 1
  then
    raise exception 'Production Team posting result is incorrect: %', v_result;
  end if;

  select quantity_on_hand
  into v_quantity
  from public.inventory_items
  where id = v_production_item_id;

  if v_quantity is distinct from 58.000::numeric then
    raise exception 'Only accepted Production quantity was not added';
  end if;

  select batch.id
  into v_batch_id
  from public.inventory_batches batch
  where batch.receiving_report_item_id = v_production_line_id
    and batch.inventory_item_id = v_production_item_id
    and batch.origin_type = 'receiving'
    and batch.quantity_initial = 58
    and batch.quantity_on_hand = 58
    and batch.supplier_lot_code = 'PROD-LOT-001';

  if v_batch_id is null then
    raise exception 'Production receiving batch was not created correctly';
  end if;

  if not exists (
    select 1
    from public.inventory_transactions transaction_record
    where transaction_record.inventory_item_id = v_production_item_id
      and transaction_record.inventory_batch_id = v_batch_id
      and transaction_record.purchase_order_item_id is null
      and transaction_record.transaction_type = 'receiving'
      and transaction_record.quantity_before = 0
      and transaction_record.quantity_change = 58
      and transaction_record.quantity_after = 58
  ) then
    raise exception 'Production receiving ledger movement is incorrect';
  end if;

  if not exists (
    select 1
    from public.receiving_reports report
    where report.id = v_production_report_id
      and report.status = 'posted'
      and report.posted_at is not null
      and report.posted_by = v_manager_id
  ) then
    raise exception 'Production report posting fields are incorrect';
  end if;

  select quantity_received
  into v_po_quantity_after
  from public.purchase_order_items
  where id = v_po_item_id;

  if v_po_quantity_after is distinct from v_po_quantity_before then
    raise exception 'Production Team receipt changed a PO quantity';
  end if;

  -- Sequential replay is blocked; the report FOR UPDATE lock serializes a
  -- concurrent attempt before this same posted-state check.
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_production_report_id);
  exception
    when sqlstate '22023' then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Duplicate Production report posting was accepted';
  end if;

  -- Direct supplier: PO line determines inventory; accepted quantity updates
  -- the aggregate, batch, ledger, and PO quantities atomically.
  insert into public.receiving_reports (
    id,
    rr_number,
    source_type,
    source_reference,
    purchase_order_id,
    received_at,
    received_by,
    supplier_delivery_reference
  )
  values (
    v_supplier_report_id,
    '__VERIFY-RR-SUPPLIER__',
    'direct_supplier',
    'SUPPLIER-DELIVERY-001',
    v_po_id,
    now(),
    v_manager_id,
    'DR-001'
  );

  insert into public.receiving_report_items (
    id,
    receiving_report_id,
    inventory_item_id,
    purchase_order_item_id,
    quantity_delivered,
    quantity_accepted
  )
  values (
    v_supplier_line_id,
    v_supplier_report_id,
    null,
    v_po_item_id,
    20,
    20
  );

  perform public.post_receiving_report(v_supplier_report_id);

  if not exists (
    select 1
    from public.purchase_order_items purchase_order_item
    where purchase_order_item.id = v_po_item_id
      and purchase_order_item.quantity_received = 20
      and purchase_order_item.quantity_remaining = 80
  ) then
    raise exception 'Direct supplier PO quantities were not updated correctly';
  end if;

  if not exists (
    select 1
    from public.purchase_orders purchase_order
    where purchase_order.id = v_po_id
      and purchase_order.status = 'partially_received'
  ) then
    raise exception 'Direct supplier PO status was not updated correctly';
  end if;

  if not exists (
    select 1
    from public.inventory_items inventory_item
    where inventory_item.id = v_supplier_item_id
      and inventory_item.quantity_on_hand = 25
  ) then
    raise exception 'Direct supplier accepted quantity was not added';
  end if;

  if not exists (
    select 1
    from public.inventory_transactions transaction_record
    join public.inventory_batches batch
      on batch.id = transaction_record.inventory_batch_id
    where batch.receiving_report_item_id = v_supplier_line_id
      and transaction_record.purchase_order_item_id = v_po_item_id
      and transaction_record.quantity_change = 20
  ) then
    raise exception 'Direct supplier ledger or batch provenance is missing';
  end if;

  -- A PO item belonging to another PO is rejected during posting.
  insert into public.receiving_reports (
    id,
    rr_number,
    source_type,
    purchase_order_id,
    received_at,
    received_by
  )
  values (
    v_invalid_supplier_report_id,
    '__VERIFY-RR-INVALID-PO__',
    'direct_supplier',
    v_po_id,
    now(),
    v_manager_id
  );

  insert into public.receiving_report_items (
    receiving_report_id,
    purchase_order_item_id,
    quantity_delivered,
    quantity_accepted
  )
  values (v_invalid_supplier_report_id, v_other_po_item_id, 1, 1);

  v_blocked := false;
  begin
    perform public.post_receiving_report(v_invalid_supplier_report_id);
  exception
    when sqlstate '22023' then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Supplier line with an invalid PO item was posted';
  end if;

  -- Missing direct inventory is rejected by the quantity policy trigger or
  -- the table constraint before posting.
  v_blocked := false;
  begin
    insert into public.receiving_report_items (
      receiving_report_id,
      quantity_delivered,
      quantity_accepted
    )
    values (v_invalid_supplier_report_id, 1, 1);
  exception
    when check_violation then
      v_blocked := true;
    when foreign_key_violation then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Receiving line without a source item reference was accepted';
  end if;

  v_blocked := false;
  begin
    insert into public.receiving_report_items (
      receiving_report_id,
      inventory_item_id,
      quantity_delivered,
      quantity_accepted
    )
    values (v_invalid_supplier_report_id, v_production_item_id, 60, 58);
  exception
    when check_violation then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Rejected quantity without a reason was accepted';
  end if;

  -- Independent secondary measurements are stored without conversion.
  insert into public.receiving_reports (
    id,
    rr_number,
    source_type,
    received_at,
    received_by,
    emergency_reason, emergency_authorized_by,
    emergency_authorized_at, emergency_inspected_by_name
  )
  values (
    v_secondary_report_id,
    '__VERIFY-RR-SECONDARY__',
    'production_team',
    now(),
    v_manager_id,
    'Synthetic local receiving verifier', v_manager_id,
    now(), 'Verify Inspector'
  );

  insert into public.receiving_report_items (
    receiving_report_id,
    inventory_item_id,
    quantity_delivered,
    quantity_accepted,
    secondary_quantity_delivered,
    secondary_quantity_accepted,
    rejection_reason
  )
  values (
    v_secondary_report_id,
    v_secondary_item_id,
    10,
    8,
    20,
    15,
    'Independent base and secondary rejections'
  );

  perform public.post_receiving_report(v_secondary_report_id);

  select
    batch.quantity_initial,
    batch.secondary_quantity_initial
  into
    v_quantity,
    v_secondary_quantity
  from public.inventory_batches batch
  where batch.receiving_report_item_id in (
    select report_item.id
    from public.receiving_report_items report_item
    where report_item.receiving_report_id = v_secondary_report_id
  );

  if v_quantity is distinct from 8.000::numeric
     or v_secondary_quantity is distinct from 15.000::numeric
  then
    raise exception 'Secondary quantity was converted or not preserved independently';
  end if;

  -- Expiry-required items fail before posting if no use-by date is supplied.
  insert into public.receiving_reports (
    id,
    rr_number,
    source_type,
    received_at,
    received_by,
    emergency_reason, emergency_authorized_by,
    emergency_authorized_at, emergency_inspected_by_name
  )
  values (
    v_expiry_report_id,
    '__VERIFY-RR-EXPIRY__',
    'production_team',
    now(),
    v_manager_id,
    'Synthetic local receiving verifier', v_manager_id,
    now(), 'Verify Inspector'
  );

  v_blocked := false;
  begin
    insert into public.receiving_report_items (
      receiving_report_id,
      inventory_item_id,
      quantity_delivered,
      quantity_accepted
    )
    values (v_expiry_report_id, v_expiry_item_id, 5, 5);

    perform public.post_receiving_report(v_expiry_report_id);
  exception
    when sqlstate '22023' then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Expiry-required receipt without a use-by date was posted';
  end if;

  -- Force a failure after the first mutation by reserving the deterministic
  -- batch code for the second line. The entire posting call must roll back.
  insert into public.receiving_reports (
    id,
    rr_number,
    source_type,
    received_at,
    received_by,
    emergency_reason, emergency_authorized_by,
    emergency_authorized_at, emergency_inspected_by_name
  )
  values (
    v_rollback_report_id,
    '__VERIFY-RR-ROLLBACK__',
    'production_team',
    now(),
    v_manager_id,
    'Synthetic local receiving verifier', v_manager_id,
    now(), 'Verify Inspector'
  );

  insert into public.receiving_report_items (
    id,
    receiving_report_id,
    inventory_item_id,
    quantity_delivered,
    quantity_accepted
  )
  values
    (v_rollback_line_one_id, v_rollback_report_id, v_rollback_item_one_id, 2, 2),
    (v_rollback_line_two_id, v_rollback_report_id, v_rollback_item_two_id, 3, 3);

  insert into public.inventory_batches (
    batch_code,
    inventory_item_id,
    origin_type,
    receiving_report_item_id,
    received_at,
    quantity_initial,
    quantity_on_hand
  )
  values (
    'RRB-' || replace(v_rollback_line_two_id::text, '-', ''),
    v_rollback_item_two_id,
    'receiving',
    v_rollback_line_two_id,
    now(),
    1,
    1
  );

  v_blocked := false;
  begin
    perform public.post_receiving_report(v_rollback_report_id);
  exception
    when unique_violation then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Forced posting failure did not occur';
  end if;

  if not exists (
    select 1
    from public.inventory_items inventory_item
    where inventory_item.id = v_rollback_item_one_id
      and inventory_item.quantity_on_hand = 10
  ) or exists (
    select 1
    from public.inventory_batches batch
    where batch.receiving_report_item_id = v_rollback_line_one_id
  ) or exists (
    select 1
    from public.inventory_transactions transaction_record
    where transaction_record.mutation_request_id = v_rollback_line_one_id
  ) or not exists (
    select 1
    from public.receiving_reports report
    where report.id = v_rollback_report_id
      and report.status = 'draft'
  ) then
    raise exception 'Failed receiving line did not roll back the full report';
  end if;

  -- Authenticated non-manager execution is rejected without side effects.
  insert into public.receiving_reports (
    id,
    rr_number,
    source_type,
    received_at,
    received_by,
    emergency_reason, emergency_authorized_by,
    emergency_authorized_at, emergency_inspected_by_name
  )
  values (
    v_unauthorized_report_id,
    '__VERIFY-RR-UNAUTHORIZED__',
    'production_team',
    now(),
    v_manager_id,
    'Synthetic local receiving verifier', v_manager_id,
    now(), 'Verify Inspector'
  );

  insert into public.receiving_report_items (
    receiving_report_id,
    inventory_item_id,
    quantity_delivered,
    quantity_accepted
  )
  values (v_unauthorized_report_id, v_unauthorized_item_id, 1, 1);

  perform set_config('request.jwt.claim.sub', v_customer_id::text, true);
  v_blocked := false;
  begin
    perform public.post_receiving_report(v_unauthorized_report_id);
  exception
    when insufficient_privilege then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Authenticated non-manager posted a receiving report';
  end if;

  if not exists (
    select 1
    from public.inventory_items inventory_item
    where inventory_item.id = v_unauthorized_item_id
      and inventory_item.quantity_on_hand = 0
  ) then
    raise exception 'Unauthorized posting changed inventory';
  end if;

  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  insert into verify_receiving_ids (key, value)
  values
    ('manager', v_manager_id),
    ('production_report', v_production_report_id),
    ('supplier_report', v_supplier_report_id);

  raise notice 'Source-neutral receiving posting behavior checks passed';
end
$behavior_verification$;

rollback;
