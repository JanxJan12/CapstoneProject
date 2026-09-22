-- Run after 20260923000000_inventory_po_semantics_foundation.sql in a trusted
-- SQL session. All behavioral writes are rolled back, including the temporary
-- metadata-only Chicken update used to verify its balance is untouched.

begin;

do $catalog_verification$
declare
  v_generation_expression text;
  v_generated "char";
  v_not_null boolean;
  v_type text;
  v_rls_enabled boolean;
  v_role text;
  v_table text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_items'
      and column_name = 'item_kind'
      and data_type = 'text'
      and is_nullable = 'YES'
      and column_default is null
  ) then
    raise exception 'inventory_items.item_kind contract is missing or incorrect';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_items'
      and column_name = 'secondary_unit'
      and data_type = 'character varying'
      and character_maximum_length = 20
      and is_nullable = 'YES'
      and column_default is null
  ) then
    raise exception 'inventory_items.secondary_unit contract is missing or incorrect';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_items'
      and column_name = 'quantity_scale'
      and data_type = 'smallint'
      and is_nullable = 'NO'
      and column_default = '3'
  ) then
    raise exception 'inventory_items.quantity_scale contract is missing or incorrect';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_items'
      and column_name = 'rotation_policy'
      and data_type = 'text'
      and is_nullable = 'NO'
      and column_default = '''fifo''::text'
  ) then
    raise exception 'inventory_items.rotation_policy contract is missing or incorrect';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_items'
      and column_name = 'expiry_required'
      and data_type = 'boolean'
      and is_nullable = 'NO'
      and column_default = 'false'
  ) then
    raise exception 'inventory_items.expiry_required contract is missing or incorrect';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname in (
        'inventory_items_item_kind_chk',
        'inventory_items_secondary_unit_chk',
        'inventory_items_quantity_scale_chk',
        'inventory_items_rotation_policy_chk',
        'inventory_items_expiry_policy_chk'
      )
      and contype = 'c'
      and convalidated
  ) <> 5 then
    raise exception 'One or more inventory metadata constraints are missing or unvalidated';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchase_order_items'
      and column_name = 'secondary_quantity_ordered'
      and data_type = 'numeric'
      and numeric_precision = 12
      and numeric_scale = 3
      and is_nullable = 'YES'
      and column_default is null
  ) then
    raise exception 'purchase_order_items.secondary_quantity_ordered contract is missing or incorrect';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchase_order_items'
      and column_name = 'secondary_quantity_received'
      and data_type = 'numeric'
      and numeric_precision = 12
      and numeric_scale = 3
      and is_nullable = 'NO'
      and column_default = '0'::text
  ) then
    raise exception 'purchase_order_items.secondary_quantity_received contract is missing or incorrect';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchase_order_items'
      and column_name = 'quantity_cancelled'
      and data_type = 'numeric'
      and numeric_precision = 12
      and numeric_scale = 3
      and is_nullable = 'NO'
      and column_default = '0'::text
  ) then
    raise exception 'purchase_order_items.quantity_cancelled contract is missing or incorrect';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'public.purchase_order_items'::regclass
      and conname in (
        'purchase_order_items_secondary_ordered_pos_chk',
        'purchase_order_items_secondary_received_nonneg_chk',
        'purchase_order_items_quantity_cancelled_nonneg_chk',
        'purchase_order_items_received_cancelled_le_ordered_chk',
        'purchase_order_items_qty_remaining_nonneg_chk'
      )
      and contype = 'c'
      and convalidated
  ) <> 5 then
    raise exception 'One or more PO quantity constraints are missing or unvalidated';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_order_items'::regclass
      and conname = 'purchase_order_items_qty_remaining_le_received_chk'
  ) then
    raise exception 'The incorrect legacy quantity_remaining constraint still exists';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_order_items'::regclass
      and pg_get_constraintdef(oid) ~* 'quantity_remaining[^<]*<=.*quantity_received'
  ) then
    raise exception 'A constraint still requires quantity_remaining <= quantity_received';
  end if;

  select
    attribute.attgenerated,
    attribute.attnotnull,
    format_type(attribute.atttypid, attribute.atttypmod),
    pg_get_expr(default_value.adbin, default_value.adrelid)
  into
    v_generated,
    v_not_null,
    v_type,
    v_generation_expression
  from pg_attribute attribute
  join pg_attrdef default_value
    on default_value.adrelid = attribute.attrelid
    and default_value.adnum = attribute.attnum
  where attribute.attrelid = 'public.purchase_order_items'::regclass
    and attribute.attname = 'quantity_remaining'
    and not attribute.attisdropped;

  if v_generated is distinct from 's'
     or v_not_null is distinct from true
     or v_type is distinct from 'numeric(12,3)'
     or regexp_replace(
       v_generation_expression,
       '[[:space:]"()]',
       '',
       'g'
     ) is distinct from 'quantity_ordered-quantity_received-quantity_cancelled'
  then
    raise exception
      'quantity_remaining is not the expected stored generated numeric(12,3) expression: %',
      v_generation_expression;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'purchase_order_items'
      and indexname = 'purchase_order_items_quantity_remaining_idx'
  ) then
    raise exception 'The quantity_remaining index was not preserved';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'receiving_reports',
        'receiving_report_items',
        'inventory_batches',
        'inventory_locations',
        'inventory_allocations',
        'production_batches',
        'production_inputs',
        'production_outputs'
      )
  ) then
    raise exception 'An out-of-scope operational supply-chain table exists';
  end if;

  foreach v_table in array array['inventory_items', 'purchase_order_items']
  loop
    select relation.relrowsecurity
    into v_rls_enabled
    from pg_class relation
    where relation.oid = format('public.%I', v_table)::regclass;

    if v_rls_enabled is distinct from true then
      raise exception 'RLS is not enabled on public.%', v_table;
    end if;

    foreach v_role in array array['anon', 'authenticated']
    loop
      if not has_table_privilege(
        v_role,
        format('public.%I', v_table),
        'SELECT'
      ) then
        raise exception '% lost SELECT on public.%', v_role, v_table;
      end if;

      if has_table_privilege(
        v_role,
        format('public.%I', v_table),
        'INSERT, UPDATE, DELETE'
      ) then
        raise exception '% gained direct DML on public.%', v_role, v_table;
      end if;
    end loop;
  end loop;
end
$catalog_verification$;

create temporary table verify_inventory_items (
  like public.inventory_items
    including defaults
    including constraints
) on commit drop;

do $inventory_behavior_verification$
declare
  v_chicken_id uuid;
  v_quantity_before numeric;
  v_quantity_after numeric;
begin
  begin
    insert into verify_inventory_items (item_name, unit, item_kind)
    values ('__verify_invalid_kind__', 'kg', 'ingredient');
    raise exception 'Invalid item_kind was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_items (item_name, unit, rotation_policy)
    values ('__verify_invalid_rotation__', 'kg', 'lifo');
    raise exception 'Invalid rotation_policy was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_items (item_name, unit, quantity_scale)
    values ('__verify_invalid_scale__', 'kg', 7);
    raise exception 'Invalid quantity_scale was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_items (
      item_name,
      unit,
      rotation_policy,
      expiry_required
    )
    values ('__verify_fifo_expiry__', 'kg', 'fifo', true);
    raise exception 'expiry_required item was allowed to use FIFO';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_items (item_name, unit, secondary_unit)
    values ('__verify_blank_secondary_unit__', 'kg', '   ');
    raise exception 'Blank secondary_unit was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_inventory_items (item_name, unit, secondary_unit)
    values ('__verify_same_secondary_unit__', 'kg', 'KG');
    raise exception 'secondary_unit equal to base unit was accepted';
  exception
    when check_violation then null;
  end;

  select inventory_item.id, inventory_item.quantity_on_hand
  into v_chicken_id, v_quantity_before
  from public.inventory_items inventory_item
  where inventory_item.item_name = 'Chicken'
    and inventory_item.unit = 'kg'
    and inventory_item.item_kind = 'raw'
    and inventory_item.secondary_unit = 'pcs'
    and inventory_item.quantity_scale = 3
    and inventory_item.rotation_policy = 'fefo'
    and inventory_item.expiry_required = true;

  if not found then
    raise exception 'Chicken metadata does not match the Phase 6B.2 contract';
  end if;

  update public.inventory_items
  set
    item_kind = 'raw',
    secondary_unit = 'pcs',
    quantity_scale = 3,
    rotation_policy = 'fefo',
    expiry_required = true
  where id = v_chicken_id
  returning quantity_on_hand into v_quantity_after;

  if v_quantity_after is distinct from v_quantity_before then
    raise exception 'Chicken metadata update changed quantity_on_hand';
  end if;
end
$inventory_behavior_verification$;

create temporary table verify_purchase_order_items (
  like public.purchase_order_items
    including defaults
    including generated
    including constraints
) on commit drop;

do $purchase_order_behavior_verification$
declare
  v_remaining numeric;
  v_secondary_received numeric;
begin
  insert into verify_purchase_order_items (
    purchase_order_id,
    inventory_item_id,
    quantity_ordered,
    quantity_received,
    secondary_quantity_ordered,
    secondary_quantity_received,
    quantity_cancelled
  )
  values (
    gen_random_uuid(),
    gen_random_uuid(),
    10,
    7,
    12,
    14,
    2
  )
  returning quantity_remaining, secondary_quantity_received
  into v_remaining, v_secondary_received;

  if v_remaining is distinct from 1.000::numeric
     or v_secondary_received is distinct from 14.000::numeric
  then
    raise exception
      'Generated PO arithmetic or independent secondary receipt semantics failed';
  end if;

  begin
    insert into verify_purchase_order_items (
      purchase_order_id,
      inventory_item_id,
      quantity_ordered,
      quantity_received,
      quantity_cancelled
    )
    values (gen_random_uuid(), gen_random_uuid(), 10, 8, 3);
    raise exception 'Received plus cancelled quantity above ordered was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_purchase_order_items (
      purchase_order_id,
      inventory_item_id,
      quantity_ordered,
      secondary_quantity_ordered
    )
    values (gen_random_uuid(), gen_random_uuid(), 10, 0);
    raise exception 'Non-positive secondary_quantity_ordered was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_purchase_order_items (
      purchase_order_id,
      inventory_item_id,
      quantity_ordered,
      secondary_quantity_received
    )
    values (gen_random_uuid(), gen_random_uuid(), 10, -1);
    raise exception 'Negative secondary_quantity_received was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into verify_purchase_order_items (
      purchase_order_id,
      inventory_item_id,
      quantity_ordered,
      quantity_cancelled
    )
    values (gen_random_uuid(), gen_random_uuid(), 10, -1);
    raise exception 'Negative quantity_cancelled was accepted';
  exception
    when check_violation then null;
  end;
end
$purchase_order_behavior_verification$;

do $comments_verification$
declare
  v_column text;
begin
  foreach v_column in array array[
    'item_kind',
    'secondary_unit',
    'quantity_scale',
    'rotation_policy',
    'expiry_required'
  ]
  loop
    if col_description(
      'public.inventory_items'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.inventory_items'::regclass
          and attname = v_column
      )
    ) is null then
      raise exception 'Missing inventory_items.% comment', v_column;
    end if;
  end loop;

  foreach v_column in array array[
    'secondary_quantity_ordered',
    'secondary_quantity_received',
    'quantity_cancelled',
    'quantity_remaining'
  ]
  loop
    if col_description(
      'public.purchase_order_items'::regclass,
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.purchase_order_items'::regclass
          and attname = v_column
      )
    ) is null then
      raise exception 'Missing purchase_order_items.% comment', v_column;
    end if;
  end loop;

  raise notice 'Phase 6B.2 inventory metadata and PO semantics checks passed';
end
$comments_verification$;

rollback;
