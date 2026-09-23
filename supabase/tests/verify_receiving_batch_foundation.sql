-- Run after 20260923010000_receiving_batch_foundation.sql in a trusted SQL
-- session. Behavioral probes use temporary copies, and the transaction rolls
-- back every write.

begin;

do $catalog_verification$
declare
  v_role text;
  v_table text;
  v_privilege text;
  v_generated_expression text;
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_reports'
      and column_name in (
        'id',
        'rr_number',
        'purchase_order_id',
        'received_at',
        'received_by',
        'status',
        'supplier_delivery_reference',
        'notes',
        'posted_at',
        'posted_by',
        'created_at',
        'updated_at'
      )
  ) <> 12 then
    raise exception 'receiving_reports expected columns are missing';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_report_items'
      and column_name in (
        'id',
        'receiving_report_id',
        'purchase_order_item_id',
        'quantity_delivered',
        'quantity_accepted',
        'quantity_rejected',
        'secondary_quantity_delivered',
        'secondary_quantity_accepted',
        'secondary_quantity_rejected',
        'rejection_reason',
        'notes',
        'created_at',
        'updated_at'
      )
  ) <> 13 then
    raise exception 'receiving_report_items expected columns are missing';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_batches'
      and column_name in (
        'id',
        'batch_code',
        'inventory_item_id',
        'origin_type',
        'receiving_report_item_id',
        'supplier_lot_code',
        'received_at',
        'manufactured_on',
        'use_by_date',
        'quantity_initial',
        'quantity_on_hand',
        'secondary_quantity_initial',
        'secondary_quantity_on_hand',
        'created_at'
      )
  ) <> 14 then
    raise exception 'inventory_batches expected columns are missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_report_items'
      and column_name = 'inventory_item_id'
  ) then
    raise exception 'receiving_report_items incorrectly duplicates inventory_item_id';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receiving_reports'
      and column_name = 'rr_number'
      and data_type = 'character varying'
      and character_maximum_length = 50
      and is_nullable = 'NO'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_batches'
      and column_name = 'batch_code'
      and data_type = 'character varying'
      and character_maximum_length = 100
      and is_nullable = 'NO'
  ) then
    raise exception 'RR or batch identifier contract is incorrect';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('receiving_report_items', 'inventory_batches')
      and column_name in (
        'quantity_delivered',
        'quantity_accepted',
        'quantity_rejected',
        'secondary_quantity_delivered',
        'secondary_quantity_accepted',
        'secondary_quantity_rejected',
        'quantity_initial',
        'quantity_on_hand',
        'secondary_quantity_initial',
        'secondary_quantity_on_hand'
      )
      and data_type = 'numeric'
      and numeric_precision = 12
      and numeric_scale = 3
  ) <> 10 then
    raise exception 'One or more receiving/batch quantities do not use numeric(12,3)';
  end if;

  select pg_get_expr(attribute.adbin, attribute.adrelid)
  into v_generated_expression
  from pg_attribute column_attribute
  join pg_attrdef attribute
    on attribute.adrelid = column_attribute.attrelid
   and attribute.adnum = column_attribute.attnum
  where column_attribute.attrelid = 'public.receiving_report_items'::regclass
    and column_attribute.attname = 'quantity_rejected'
    and column_attribute.attgenerated = 's';

  if regexp_replace(v_generated_expression, '[()[:space:]]', '', 'g')
       is distinct from 'quantity_delivered-quantity_accepted' then
    raise exception 'Base rejected quantity generated expression is incorrect: %',
      v_generated_expression;
  end if;

  select pg_get_expr(attribute.adbin, attribute.adrelid)
  into v_generated_expression
  from pg_attribute column_attribute
  join pg_attrdef attribute
    on attribute.adrelid = column_attribute.attrelid
   and attribute.adnum = column_attribute.attnum
  where column_attribute.attrelid = 'public.receiving_report_items'::regclass
    and column_attribute.attname = 'secondary_quantity_rejected'
    and column_attribute.attgenerated = 's';

  if v_generated_expression is null
     or v_generated_expression !~* 'secondary_quantity_delivered.*secondary_quantity_accepted'
  then
    raise exception 'Secondary rejected quantity generated expression is incorrect: %',
      v_generated_expression;
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.receiving_reports'::regclass
      and conname in (
        'receiving_reports_status_chk',
        'receiving_reports_posting_fields_chk'
      )
      and contype = 'c'
      and convalidated
  ) <> 2 then
    raise exception 'Receiving report status constraints are missing or unvalidated';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.receiving_report_items'::regclass
      and conname in (
        'receiving_report_items_quantity_delivered_pos_chk',
        'receiving_report_items_quantity_accepted_nonneg_chk',
        'receiving_report_items_quantity_accepted_le_delivered_chk',
        'receiving_report_items_secondary_quantities_pair_chk',
        'receiving_report_items_secondary_delivered_pos_chk',
        'receiving_report_items_secondary_accepted_nonneg_chk',
        'receiving_report_items_secondary_accepted_le_delivered_chk',
        'receiving_report_items_rejection_reason_chk'
      )
      and contype = 'c'
      and convalidated
  ) <> 8 then
    raise exception 'Receiving report item quantity constraints are missing or unvalidated';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.receiving_report_items'::regclass
      and conname = 'receiving_report_items_report_po_item_key'
      and contype = 'u'
  ) then
    raise exception 'Receiving report item uniqueness is missing';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.inventory_batches'::regclass
      and conname in (
        'inventory_batches_origin_type_chk',
        'inventory_batches_origin_reference_chk',
        'inventory_batches_quantity_initial_pos_chk',
        'inventory_batches_quantity_on_hand_nonneg_chk',
        'inventory_batches_quantity_on_hand_le_initial_chk',
        'inventory_batches_secondary_quantities_pair_chk',
        'inventory_batches_secondary_initial_pos_chk',
        'inventory_batches_secondary_on_hand_nonneg_chk',
        'inventory_batches_secondary_on_hand_le_initial_chk',
        'inventory_batches_date_order_chk'
      )
      and contype = 'c'
      and convalidated
  ) <> 10 then
    raise exception 'Inventory batch origin/quantity/date constraints are missing or unvalidated';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid in (
      'public.receiving_reports'::regclass,
      'public.receiving_report_items'::regclass,
      'public.inventory_batches'::regclass,
      'public.inventory_transactions'::regclass
    )
      and conname in (
        'receiving_reports_purchase_order_id_fkey',
        'receiving_reports_received_by_fkey',
        'receiving_reports_posted_by_fkey',
        'receiving_report_items_receiving_report_id_fkey',
        'receiving_report_items_purchase_order_item_id_fkey',
        'inventory_batches_inventory_item_id_fkey',
        'inventory_batches_receiving_report_item_id_fkey',
        'inventory_transactions_inventory_batch_id_fkey'
      )
      and contype = 'f'
      and convalidated
  ) <> 8 then
    raise exception 'One or more receiving/batch foreign keys are missing or unvalidated';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_transactions'
      and column_name = 'inventory_batch_id'
      and data_type = 'uuid'
      and is_nullable = 'YES'
      and column_default is null
  ) then
    raise exception 'inventory_transactions.inventory_batch_id is missing or not nullable';
  end if;

  if exists (
    select 1
    from public.inventory_transactions
    where inventory_batch_id is not null
  ) then
    raise exception 'A historical inventory transaction was assigned a batch';
  end if;

  if (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'receiving_reports_purchase_order_id_idx',
        'receiving_reports_status_received_at_idx',
        'receiving_report_items_purchase_order_item_id_idx',
        'inventory_batches_receiving_report_item_id_idx',
        'inventory_batches_inventory_item_fefo_idx',
        'inventory_transactions_inventory_batch_id_idx'
      )
  ) <> 6 then
    raise exception 'One or more receiving/batch lookup indexes are missing';
  end if;

  foreach v_table in array array[
    'receiving_reports',
    'receiving_report_items',
    'inventory_batches'
  ]
  loop
    if not (
      select relation.relrowsecurity
      from pg_class relation
      where relation.oid = format('public.%I', v_table)::regclass
    ) then
      raise exception 'RLS is not enabled on public.%', v_table;
    end if;

    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table
    ) then
      raise exception 'Unexpected client policy exists on public.%', v_table;
    end if;

    foreach v_role in array array['anon', 'authenticated']
    loop
      foreach v_privilege in array array[
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
        'MAINTAIN'
      ]
      loop
        if has_table_privilege(
          v_role,
          format('public.%I', v_table),
          v_privilege
        ) then
          raise exception '% unexpectedly has % on public.%',
            v_role,
            v_privilege,
            v_table;
        end if;
      end loop;
    end loop;

    foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not has_table_privilege(
        'service_role',
        format('public.%I', v_table),
        v_privilege
      ) then
        raise exception 'service_role lacks % on public.%', v_privilege, v_table;
      end if;
    end loop;
  end loop;
end
$catalog_verification$;

create temporary table verify_receiving_reports (
  like public.receiving_reports
    including defaults
    including generated
    including constraints
) on commit drop;

create temporary table verify_receiving_report_items (
  like public.receiving_report_items
    including defaults
    including generated
    including constraints
) on commit drop;

create temporary table verify_inventory_batches (
  like public.inventory_batches
    including defaults
    including generated
    including constraints
) on commit drop;

do $behavior_verification$
declare
  v_report_id uuid;
  v_item_id uuid;
  v_base_rejected numeric;
  v_secondary_rejected numeric;
begin
  insert into verify_receiving_reports (
    rr_number,
    purchase_order_id,
    received_at,
    received_by
  ) values (
    '__verify_rr_draft__',
    gen_random_uuid(),
    now(),
    gen_random_uuid()
  ) returning id into v_report_id;

  begin
    insert into verify_receiving_reports (
      rr_number,
      purchase_order_id,
      received_at,
      received_by,
      status,
      posted_at
    ) values (
      '__verify_invalid_draft__',
      gen_random_uuid(),
      now(),
      gen_random_uuid(),
      'draft',
      now()
    );
    raise exception 'Draft receiving report accepted posting fields';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_receiving_reports (
      rr_number,
      purchase_order_id,
      received_at,
      received_by,
      status
    ) values (
      '__verify_invalid_posted__',
      gen_random_uuid(),
      now(),
      gen_random_uuid(),
      'posted'
    );
    raise exception 'Posted receiving report accepted missing posting fields';
  exception
    when check_violation then null;
  end;

  insert into verify_receiving_report_items (
    receiving_report_id,
    purchase_order_item_id,
    quantity_delivered,
    quantity_accepted,
    secondary_quantity_delivered,
    secondary_quantity_accepted,
    rejection_reason
  ) values (
    v_report_id,
    gen_random_uuid(),
    10,
    8,
    12,
    9,
    'Damaged in transit'
  )
  returning id, quantity_rejected, secondary_quantity_rejected
  into v_item_id, v_base_rejected, v_secondary_rejected;

  if v_base_rejected is distinct from 2.000::numeric
     or v_secondary_rejected is distinct from 3.000::numeric
  then
    raise exception 'Generated rejected quantity arithmetic failed';
  end if;

  begin
    insert into verify_receiving_report_items (
      receiving_report_id,
      purchase_order_item_id,
      quantity_delivered,
      quantity_accepted
    ) values (gen_random_uuid(), gen_random_uuid(), 10, 8);
    raise exception 'Rejected quantity without a reason was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_receiving_report_items (
      receiving_report_id,
      purchase_order_item_id,
      quantity_delivered,
      quantity_accepted,
      secondary_quantity_delivered,
      secondary_quantity_accepted
    ) values (gen_random_uuid(), gen_random_uuid(), 5, 5, 6, 5);
    raise exception 'Secondary-only rejected quantity without a reason was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_receiving_report_items (
      receiving_report_id,
      purchase_order_item_id,
      quantity_delivered,
      quantity_accepted
    ) values (gen_random_uuid(), gen_random_uuid(), 5, 6);
    raise exception 'Accepted base quantity above delivered was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_receiving_report_items (
      receiving_report_id,
      purchase_order_item_id,
      quantity_delivered,
      quantity_accepted,
      secondary_quantity_delivered
    ) values (gen_random_uuid(), gen_random_uuid(), 5, 5, 6);
    raise exception 'Unpaired secondary receiving quantity was accepted';
  exception
    when check_violation then null;
  end;

  insert into verify_inventory_batches (
    batch_code,
    inventory_item_id,
    origin_type,
    receiving_report_item_id,
    received_at,
    manufactured_on,
    use_by_date,
    quantity_initial,
    quantity_on_hand,
    secondary_quantity_initial,
    secondary_quantity_on_hand
  ) values (
    '__verify_receiving_batch__',
    gen_random_uuid(),
    'receiving',
    v_item_id,
    now(),
    current_date - 1,
    current_date + 3,
    8,
    8,
    9,
    9
  );

  insert into verify_inventory_batches (
    batch_code,
    inventory_item_id,
    origin_type,
    received_at,
    quantity_initial,
    quantity_on_hand
  ) values (
    '__verify_legacy_shape__',
    gen_random_uuid(),
    'legacy_opening',
    now(),
    1,
    1
  );

  begin
    insert into verify_inventory_batches (
      batch_code,
      inventory_item_id,
      origin_type,
      received_at,
      quantity_initial,
      quantity_on_hand
    ) values (
      '__verify_missing_receipt_item__',
      gen_random_uuid(),
      'receiving',
      now(),
      1,
      1
    );
    raise exception 'Receiving batch without a receiving item was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_batches (
      batch_code,
      inventory_item_id,
      origin_type,
      receiving_report_item_id,
      received_at,
      quantity_initial,
      quantity_on_hand
    ) values (
      '__verify_legacy_with_receipt_item__',
      gen_random_uuid(),
      'legacy_opening',
      gen_random_uuid(),
      now(),
      1,
      1
    );
    raise exception 'Legacy-opening batch with a receiving item was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_batches (
      batch_code,
      inventory_item_id,
      origin_type,
      received_at,
      quantity_initial,
      quantity_on_hand
    ) values (
      '__verify_excess_on_hand__',
      gen_random_uuid(),
      'legacy_opening',
      now(),
      1,
      2
    );
    raise exception 'Batch on-hand quantity above initial was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_batches (
      batch_code,
      inventory_item_id,
      origin_type,
      received_at,
      manufactured_on,
      use_by_date,
      quantity_initial,
      quantity_on_hand
    ) values (
      '__verify_invalid_dates__',
      gen_random_uuid(),
      'legacy_opening',
      now(),
      current_date,
      current_date - 1,
      1,
      1
    );
    raise exception 'Batch manufactured after its use-by date was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_batches (
      batch_code,
      inventory_item_id,
      origin_type,
      received_at,
      quantity_initial,
      quantity_on_hand,
      secondary_quantity_initial
    ) values (
      '__verify_unpaired_secondary__',
      gen_random_uuid(),
      'legacy_opening',
      now(),
      1,
      1,
      2
    );
    raise exception 'Unpaired secondary batch quantity was accepted';
  exception
    when check_violation then null;
  end;
end
$behavior_verification$;

do $comments_verification$
declare
  v_receiving_items_comment text;
  v_batches_comment text;
  v_transaction_batch_comment text;
begin
  v_receiving_items_comment := obj_description(
    'public.receiving_report_items'::regclass,
    'pg_class'
  );
  v_batches_comment := obj_description(
    'public.inventory_batches'::regclass,
    'pg_class'
  );
  v_transaction_batch_comment := col_description(
    'public.inventory_transactions'::regclass,
    (
      select attnum
      from pg_attribute
      where attrelid = 'public.inventory_transactions'::regclass
        and attname = 'inventory_batch_id'
    )
  );

  if v_receiving_items_comment not ilike '%belongs to the receiving report purchase order%'
     or v_receiving_items_comment not ilike '%determines the inventory item%'
     or v_receiving_items_comment not ilike '%sum of new receiving-batch base quantities%'
     or v_receiving_items_comment not ilike '%sum of batch secondary quantities%'
     or v_receiving_items_comment not ilike '%secondary_unit require secondary receiving quantities%'
  then
    raise exception 'Receiving-item future posting invariants are incomplete';
  end if;

  if v_batches_comment not ilike '%expiry_required = true%'
     or v_batches_comment not ilike '%require use_by_date%'
     or v_batches_comment not ilike '%no legacy-opening rows are created%'
  then
    raise exception 'Inventory-batch future posting invariants are incomplete';
  end if;

  if v_transaction_batch_comment not ilike '%historical transactions remain null%'
     or v_transaction_batch_comment not ilike '%authoritative posting%'
  then
    raise exception 'Inventory transaction posting invariant is incomplete';
  end if;

  if col_description(
    'public.receiving_report_items'::regclass,
    (
      select attnum
      from pg_attribute
      where attrelid = 'public.receiving_report_items'::regclass
        and attname = 'quantity_accepted'
    )
  ) not ilike '%increments the PO item received quantity%'
  then
    raise exception 'Accepted-quantity PO invariant is missing';
  end if;

  if col_description(
    'public.receiving_report_items'::regclass,
    (
      select attnum
      from pg_attribute
      where attrelid = 'public.receiving_report_items'::regclass
        and attname = 'quantity_rejected'
    )
  ) not ilike '%does not increment PO received or cancelled quantity%'
  then
    raise exception 'Rejected-quantity PO invariant is missing';
  end if;

  raise notice 'Phase 6B.3 receiving and batch foundation checks passed';
end
$comments_verification$;

rollback;
