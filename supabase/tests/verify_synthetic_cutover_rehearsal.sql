-- Phase 6B.7B-R. Synthetic physical-opening/cutover rehearsal only.
-- Every database write is enclosed by this transaction. The final intentional
-- exception is the rollback mechanism; do not replace it with a trailing ROLLBACK.
begin;

create temporary table phase_6b7br_results (
  section text primary key,
  result jsonb not null
) on commit drop;

create function pg_temp.rehearsal_check(p_ok boolean, p_name text)
returns void
language plpgsql
as $function$
begin
  if not coalesce(p_ok, false) then
    raise exception 'Phase 6B.7B-R failed: %', p_name;
  end if;
end
$function$;

create function pg_temp.rehearsal_sale(
  p_menu_name text,
  p_quantity integer,
  p_actor uuid
)
returns uuid
language plpgsql
as $function$
declare
  v_menu_id uuid;
  v_order_id uuid := gen_random_uuid();
begin
  select id into strict v_menu_id
  from public.menu_items
  where name = p_menu_name and is_active = true;

  insert into public.orders (
    id, order_number, order_channel, fulfillment_type, current_status,
    subtotal, delivery_fee, grand_total
  ) values (
    v_order_id, 'V7BR-' || v_order_id::text,
    'walk_in', 'takeout', 'confirmed', p_quantity, 0, p_quantity
  );

  insert into public.order_items (
    order_id, menu_item_id, item_name, quantity, unit_price, line_total
  ) values (
    v_order_id, v_menu_id, p_menu_name, p_quantity, 1, p_quantity
  );

  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (v_order_id, 'confirmed', p_actor, 'Rollback-only synthetic cutover rehearsal');

  return v_order_id;
end
$function$;

do $rehearsal$
declare
  v_manager uuid := gen_random_uuid();
  v_paa constant uuid := 'e199e594-5da9-4151-84bf-eba83054622d';
  v_pecho constant uuid := '2574c386-4726-4ffa-96cb-63b9967e7f0d';
  v_breast constant uuid := '035b89ec-8341-4f3c-8eff-b15250656916';
  v_quarter constant uuid := '47420228-5810-4a93-a6a6-ac03f6fdf569';
  v_cutover constant timestamptz := '2026-10-05 11:30:00+08';
  v_paa_a constant timestamptz := '2026-10-04 09:00:00+08';
  v_paa_b constant timestamptz := '2026-10-05 07:30:00+08';
  v_pecho_a constant timestamptz := '2026-10-05 08:00:00+08';
  v_quarter_a constant timestamptz := '2026-10-05 08:30:00+08';
  v_paa_payload jsonb := jsonb_build_array(
    jsonb_build_object(
      'quantity', 12, 'received_at', v_paa_a,
      'source_lot_code', null, 'manufactured_on', null,
      'notes', 'SYNTHETIC CUTOVER QA - PAA A'
    ),
    jsonb_build_object(
      'quantity', 8, 'received_at', v_paa_b,
      'source_lot_code', null, 'manufactured_on', null,
      'notes', 'SYNTHETIC CUTOVER QA - PAA B'
    )
  );
  v_pecho_payload jsonb := jsonb_build_array(
    jsonb_build_object(
      'quantity', 10, 'received_at', v_pecho_a,
      'source_lot_code', null, 'manufactured_on', null,
      'notes', 'SYNTHETIC CUTOVER QA - PECHO A'
    )
  );
  v_quarter_payload jsonb := jsonb_build_array(
    jsonb_build_object(
      'quantity', 9, 'received_at', v_quarter_a,
      'source_lot_code', null, 'manufactured_on', null,
      'notes', 'SYNTHETIC CUTOVER QA - QUARTER LEG A'
    )
  );
  v_paa_request uuid;
  v_pecho_request uuid;
  v_breast_request uuid;
  v_quarter_request uuid;
  v_open jsonb;
  v_replay jsonb;
  v_batch_a uuid;
  v_batch_b uuid;
  v_batch_c uuid;
  v_order uuid;
  v_issuance uuid;
  v_report uuid;
  v_line uuid;
  v_before_count bigint;
  v_blocked boolean;
  v_result jsonb;
  v_summary jsonb;
begin
  perform pg_temp.rehearsal_check(
    (current_timestamp at time zone 'Asia/Manila')::date = date '2026-10-05',
    'database Manila date must match the synthetic rehearsal date'
  );
  perform pg_temp.rehearsal_check(
    (select version from supabase_migrations.schema_migrations order by version desc limit 1)
      = '20261005013037',
    'latest live migration remains 20261005013037'
  );
  perform pg_temp.rehearsal_check(
    (select count(*) = 4
     from public.inventory_items
     where id in (v_paa, v_pecho, v_breast, v_quarter)
       and quantity_on_hand = 0
       and batch_consumption_enabled
       and quantity_scale = 0
       and rotation_policy = 'fifo'
       and expiry_required
       and shelf_life_days = 2),
    'all four target items retain the verified zero batch-enabled baseline'
  );
  perform pg_temp.rehearsal_check(
    not exists (
      select 1 from public.inventory_batches
      where inventory_item_id in (v_paa, v_pecho, v_breast, v_quarter)
    ) and not exists (
      select 1 from public.inventory_opening_balances
      where inventory_item_id in (v_paa, v_pecho, v_breast, v_quarter)
    ) and not exists (
      select 1 from public.inventory_transactions
      where inventory_item_id in (v_paa, v_pecho, v_breast, v_quarter)
    ),
    'all four target items have no prior batches, openings, or transactions'
  );

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_manager, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'verify-6b7br-manager@example.invalid',
    '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.profiles (id, first_name, last_name, role, is_active)
  values (v_manager, 'Verify', '6B7B-R Manager', 'manager', true)
  on conflict (id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      role = excluded.role,
      is_active = excluded.is_active;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);

  -- Exact four-item physical opening, shelf life, availability, and replay.
  v_result := null;
  begin
    v_paa_request := gen_random_uuid();
    v_pecho_request := gen_random_uuid();
    v_breast_request := gen_random_uuid();
    v_quarter_request := gen_random_uuid();
    perform pg_temp.rehearsal_check(
      (select count(distinct request_id) = 4
       from (values (v_paa_request), (v_pecho_request), (v_breast_request), (v_quarter_request)) r(request_id)),
      'opening request UUIDs are unique'
    );

    perform public.initialize_inventory_opening_balance(
      v_paa, v_paa_payload, 'SYNTHETIC CUTOVER QA - PAA', v_paa_request
    );
    perform public.initialize_inventory_opening_balance(
      v_pecho, v_pecho_payload, 'SYNTHETIC CUTOVER QA - PECHO', v_pecho_request
    );
    perform public.initialize_inventory_opening_balance(
      v_breast, '[]'::jsonb, 'SYNTHETIC CUTOVER QA - VERIFIED ZERO', v_breast_request
    );
    perform public.initialize_inventory_opening_balance(
      v_quarter, v_quarter_payload, 'SYNTHETIC CUTOVER QA - QUARTER LEG', v_quarter_request
    );

    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 20 from public.inventory_items where id = v_paa)
      and (select count(*) = 2 and sum(quantity_on_hand) = 20
           from public.inventory_batches where inventory_item_id = v_paa)
      and (select count(*) = 1 and sum(quantity_change) = 20
           from public.inventory_transactions
           where inventory_item_id = v_paa and transaction_type = 'opening_balance'),
      'Paa opening is aggregate 20, batches 12 plus 8, movement plus 20'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 10 from public.inventory_items where id = v_pecho)
      and (select count(*) = 1 and sum(quantity_on_hand) = 10
           from public.inventory_batches where inventory_item_id = v_pecho)
      and (select count(*) = 1 and sum(quantity_change) = 10
           from public.inventory_transactions
           where inventory_item_id = v_pecho and transaction_type = 'opening_balance'),
      'Pecho opening is aggregate 10, one batch, movement plus 10'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 0 from public.inventory_items where id = v_breast)
      and (select count(*) = 0 from public.inventory_batches where inventory_item_id = v_breast)
      and (select count(*) = 1 and min(quantity_total) = 0 and min(batch_count) = 0
           from public.inventory_opening_balances where inventory_item_id = v_breast)
      and (select count(*) = 0 from public.inventory_transactions where inventory_item_id = v_breast),
      'Breast zero opening records an audit header without batch or stock movement'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 9 from public.inventory_items where id = v_quarter)
      and (select count(*) = 1 and sum(quantity_on_hand) = 9
           from public.inventory_batches where inventory_item_id = v_quarter)
      and (select count(*) = 1 and sum(quantity_change) = 9
           from public.inventory_transactions
           where inventory_item_id = v_quarter and transaction_type = 'opening_balance'),
      'Quarter Leg opening is aggregate 9, one batch, movement plus 9'
    );
    perform pg_temp.rehearsal_check(
      (select bool_and(
        case notes
          when 'SYNTHETIC CUTOVER QA - PAA A' then use_by_date = date '2026-10-05'
          when 'SYNTHETIC CUTOVER QA - PAA B' then use_by_date = date '2026-10-06'
          else false
        end)
       from public.inventory_batches where inventory_item_id = v_paa)
      and (select min(use_by_date) = date '2026-10-06'
           from public.inventory_batches where inventory_item_id = v_pecho)
      and (select min(use_by_date) = date '2026-10-06'
           from public.inventory_batches where inventory_item_id = v_quarter),
      'two-day shelf-life dates derive from received day as Day 1'
    );
    perform pg_temp.rehearsal_check(
      public.inventory_usable_quantity(v_paa) = 20
      and public.inventory_usable_quantity(v_pecho) = 10
      and public.inventory_usable_quantity(v_breast) = 0
      and public.inventory_usable_quantity(v_quarter) = 9,
      'usable quantities at the October 5 cutover are 20, 10, 0, and 9'
    );
    perform pg_temp.rehearsal_check(
      (select count(*) = 10 and bool_and(
        case when menu_item.name = 'Chicken Biryani'
          then not availability.effective_available
          else availability.effective_available
        end)
       from public.menu_items menu_item
       join public.get_menu_effective_availability() availability
         on availability.menu_item_id = menu_item.id
       where menu_item.name in (
         'Inasal Paa No Rice', 'Inasal Paa Regular', 'Inasal Paa Unli Rice',
         'Inasal Pecho No Rice', 'Inasal Pecho Regular', 'Inasal Pecho Unli Rice',
         'Chicken Biryani',
         'Fried Chicken No Rice', 'Fried Chicken Regular', 'Fried Chicken Unli Rice'
       )),
      'all ten configured menu items have the expected synthetic availability'
    );
    perform pg_temp.rehearsal_check(
      floor(public.inventory_usable_quantity(v_quarter) / 2) = 4,
      'nine Quarter Legs theoretically support four Fried Chicken orders'
    );

    v_replay := public.initialize_inventory_opening_balance(
      v_paa, v_paa_payload, 'SYNTHETIC CUTOVER QA - PAA', v_paa_request
    );
    perform pg_temp.rehearsal_check((v_replay ->> 'replayed')::boolean, 'Paa opening replays');
    v_replay := public.initialize_inventory_opening_balance(
      v_pecho, v_pecho_payload, 'SYNTHETIC CUTOVER QA - PECHO', v_pecho_request
    );
    perform pg_temp.rehearsal_check((v_replay ->> 'replayed')::boolean, 'Pecho opening replays');
    v_replay := public.initialize_inventory_opening_balance(
      v_breast, '[]'::jsonb, 'SYNTHETIC CUTOVER QA - VERIFIED ZERO', v_breast_request
    );
    perform pg_temp.rehearsal_check((v_replay ->> 'replayed')::boolean, 'Breast zero opening replays');
    v_replay := public.initialize_inventory_opening_balance(
      v_quarter, v_quarter_payload, 'SYNTHETIC CUTOVER QA - QUARTER LEG', v_quarter_request
    );
    perform pg_temp.rehearsal_check((v_replay ->> 'replayed')::boolean, 'Quarter Leg opening replays');
    perform pg_temp.rehearsal_check(
      (select count(*) = 4 from public.inventory_opening_balances
       where inventory_item_id in (v_paa, v_pecho, v_breast, v_quarter))
      and (select count(*) = 4 from public.inventory_batches
           where inventory_item_id in (v_paa, v_pecho, v_breast, v_quarter))
      and (select count(*) = 3 from public.inventory_transactions
           where inventory_item_id in (v_paa, v_pecho, v_breast, v_quarter)),
      'opening replays create no duplicate headers, batches, or movements'
    );
    v_blocked := false;
    begin
      perform public.initialize_inventory_opening_balance(
        v_paa, '[]'::jsonb, 'SYNTHETIC CUTOVER QA - PAA', v_paa_request
      );
    exception when sqlstate '22023' then
      v_blocked := true;
    end;
    perform pg_temp.rehearsal_check(v_blocked, 'conflicting opening payload is rejected');

    select jsonb_build_object(
      'cutover_time', v_cutover,
      'items', (
        select jsonb_object_agg(item.item_name, jsonb_build_object(
          'aggregate', item.quantity_on_hand,
          'batch_count', (select count(*) from public.inventory_batches batch where batch.inventory_item_id = item.id),
          'batch_quantities', coalesce((select jsonb_agg(batch.quantity_on_hand order by batch.received_at, batch.id) from public.inventory_batches batch where batch.inventory_item_id = item.id), '[]'::jsonb),
          'use_by_dates', coalesce((select jsonb_agg(batch.use_by_date order by batch.received_at, batch.id) from public.inventory_batches batch where batch.inventory_item_id = item.id), '[]'::jsonb),
          'opening_movement', coalesce((select sum(tx.quantity_change) from public.inventory_transactions tx where tx.inventory_item_id = item.id and tx.transaction_type = 'opening_balance'), 0)
        ))
        from public.inventory_items item
        where item.id in (v_paa, v_pecho, v_breast, v_quarter)
      ),
      'availability', (
        select jsonb_object_agg(menu_item.name, availability.effective_available order by menu_item.name)
        from public.menu_items menu_item
        join public.get_menu_effective_availability() availability on availability.menu_item_id = menu_item.id
        where menu_item.name in (
          'Inasal Paa No Rice', 'Inasal Paa Regular', 'Inasal Paa Unli Rice',
          'Inasal Pecho No Rice', 'Inasal Pecho Regular', 'Inasal Pecho Unli Rice',
          'Chicken Biryani',
          'Fried Chicken No Rice', 'Fried Chicken Regular', 'Fried Chicken Unli Rice'
        )
      ),
      'fried_max_orders', floor(public.inventory_usable_quantity(v_quarter) / 2),
      'idempotency', 'four identical replays passed; conflicting Paa payload rejected'
    ) into v_result;
    raise exception using errcode = 'P6R01', message = 'opening scenario complete';
  exception when sqlstate 'P6R01' then
    null;
  end;
  insert into phase_6b7br_results values ('opening_and_availability', v_result);

  -- FIFO: exact Paa 12 plus 8, then consume 15 as 12 plus 3.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_paa, v_paa_payload, 'SYNTHETIC CUTOVER QA - FIFO PAA', gen_random_uuid()
    );
    select id into strict v_batch_a from public.inventory_batches
    where inventory_item_id = v_paa and received_at = v_paa_a;
    select id into strict v_batch_b from public.inventory_batches
    where inventory_item_id = v_paa and received_at = v_paa_b;
    v_order := pg_temp.rehearsal_sale('Inasal Paa Regular', 15, v_manager);
    select id into strict v_issuance from public.inventory_transactions
    where order_id = v_order and inventory_item_id = v_paa and transaction_type = 'issuance';
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 0 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 5 from public.inventory_batches where id = v_batch_b)
      and (select quantity_on_hand = 5 from public.inventory_items where id = v_paa),
      '15-Paa sale leaves batches zero and five and aggregate five'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_change = -15 from public.inventory_transactions where id = v_issuance)
      and (select quantity = 12 from public.inventory_transaction_batch_allocations where inventory_transaction_id = v_issuance and inventory_batch_id = v_batch_a)
      and (select quantity = 3 from public.inventory_transaction_batch_allocations where inventory_transaction_id = v_issuance and inventory_batch_id = v_batch_b),
      '15-Paa sale writes one issuance allocated 12 then 3'
    );
    perform public.assert_batch_inventory_consistent(v_paa);
    select jsonb_build_object(
      'required', 15, 'batch_a_before', 12, 'batch_a_after', 0,
      'batch_a_allocation', 12, 'batch_b_before', 8, 'batch_b_after', 5,
      'batch_b_allocation', 3, 'aggregate_after', 5, 'issuance', -15
    ) into v_result;
    raise exception using errcode = 'P6R01', message = 'FIFO scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('fifo_paa_15', v_result);

  -- Four Fried Chicken orders succeed against nine Quarter Legs.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_quarter, v_quarter_payload, 'SYNTHETIC CUTOVER QA - FRIED PASS', gen_random_uuid()
    );
    select id into strict v_batch_a from public.inventory_batches where inventory_item_id = v_quarter;
    v_order := pg_temp.rehearsal_sale('Fried Chicken Regular', 4, v_manager);
    select id into strict v_issuance from public.inventory_transactions
    where order_id = v_order and inventory_item_id = v_quarter and transaction_type = 'issuance';
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 1 from public.inventory_items where id = v_quarter)
      and (select quantity_on_hand = 1 from public.inventory_batches where id = v_batch_a)
      and (select quantity_change = -8 from public.inventory_transactions where id = v_issuance)
      and (select sum(quantity) = 8 from public.inventory_transaction_batch_allocations where inventory_transaction_id = v_issuance),
      'four Fried Chicken orders consume eight and leave one Quarter Leg'
    );
    select jsonb_build_object('orders', 4, 'required', 8, 'result', 'PASS', 'remaining', 1) into v_result;
    raise exception using errcode = 'P6R01', message = 'fried pass scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('fried_chicken_4_orders', v_result);

  -- Five Fried Chicken orders fail atomically against a fresh nine-piece opening.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_quarter, v_quarter_payload, 'SYNTHETIC CUTOVER QA - FRIED FAIL', gen_random_uuid()
    );
    select id into strict v_batch_a from public.inventory_batches where inventory_item_id = v_quarter;
    select count(*) into v_before_count from public.orders;
    v_blocked := false;
    begin
      perform pg_temp.rehearsal_sale('Fried Chicken Regular', 5, v_manager);
    exception when sqlstate '22023' then
      v_blocked := true;
    end;
    perform pg_temp.rehearsal_check(
      v_blocked
      and (select count(*) = v_before_count from public.orders)
      and (select quantity_on_hand = 9 from public.inventory_items where id = v_quarter)
      and (select quantity_on_hand = 9 from public.inventory_batches where id = v_batch_a)
      and (select count(*) = 1 from public.inventory_transactions where inventory_item_id = v_quarter)
      and (select count(*) = 0 from public.inventory_transaction_batch_allocations allocation join public.inventory_transactions tx on tx.id = allocation.inventory_transaction_id where tx.inventory_item_id = v_quarter),
      'five Fried Chicken orders fail without partial order, stock, issuance, or allocation'
    );
    select jsonb_build_object('orders', 5, 'required', 10, 'result', 'INSUFFICIENT_STOCK', 'remaining', 9, 'partial_mutation', false) into v_result;
    raise exception using errcode = 'P6R01', message = 'fried fail scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('fried_chicken_5_orders', v_result);

  -- Zero-opening Biryani cannot confirm one order.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_breast, '[]'::jsonb, 'SYNTHETIC CUTOVER QA - ZERO BIRYANI', gen_random_uuid()
    );
    select count(*) into v_before_count from public.orders;
    v_blocked := false;
    begin
      perform pg_temp.rehearsal_sale('Chicken Biryani', 1, v_manager);
    exception when sqlstate '22023' then
      v_blocked := true;
    end;
    perform pg_temp.rehearsal_check(
      v_blocked
      and (select count(*) = v_before_count from public.orders)
      and (select quantity_on_hand = 0 from public.inventory_items where id = v_breast)
      and not exists (select 1 from public.inventory_transactions where inventory_item_id = v_breast)
      and not exists (select 1 from public.inventory_batches where inventory_item_id = v_breast),
      'one Chicken Biryani fails without negative stock, issuance, or allocation'
    );
    select jsonb_build_object('available', false, 'order_quantity', 1, 'result', 'INSUFFICIENT_STOCK', 'partial_mutation', false) into v_result;
    raise exception using errcode = 'P6R01', message = 'zero Biryani scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('zero_biryani', v_result);

  -- Batch-specific waste from Paa Batch A.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_paa, v_paa_payload, 'SYNTHETIC CUTOVER QA - WASTE', gen_random_uuid()
    );
    select id into strict v_batch_a from public.inventory_batches where inventory_item_id = v_paa and received_at = v_paa_a;
    select id into strict v_batch_b from public.inventory_batches where inventory_item_id = v_paa and received_at = v_paa_b;
    perform public.record_batch_inventory_waste(
      v_paa, v_batch_a, 2, 12, 'Spoilage', gen_random_uuid(), 'SYNTHETIC CUTOVER QA'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 10 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 8 from public.inventory_batches where id = v_batch_b)
      and (select quantity_on_hand = 18 from public.inventory_items where id = v_paa)
      and (select count(*) = 1 and min(quantity_change) = -2 and bool_and(inventory_batch_id = v_batch_a)
           from public.inventory_transactions where inventory_item_id = v_paa and transaction_type = 'waste'),
      'waste two from Paa Batch A leaves 10 plus 8 and aggregate 18'
    );
    perform pg_temp.rehearsal_check(
      (select count(*) = 3 and bool_and(availability.effective_available)
       from public.menu_items menu_item
       join public.get_menu_effective_availability() availability on availability.menu_item_id = menu_item.id
       where menu_item.name in ('Inasal Paa No Rice', 'Inasal Paa Regular', 'Inasal Paa Unli Rice')),
      'all Paa variants remain available after waste'
    );
    perform public.assert_batch_inventory_consistent(v_paa);
    select jsonb_build_object('batch_a', 10, 'batch_b', 8, 'aggregate', 18, 'waste_movement', -2, 'batch_linked', true, 'paa_variants_available', true) into v_result;
    raise exception using errcode = 'P6R01', message = 'waste scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('waste', v_result);

  -- Signed positive and negative correction movements on the Pecho batch.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_pecho, v_pecho_payload, 'SYNTHETIC CUTOVER QA - ADJUSTMENT', gen_random_uuid()
    );
    select id into strict v_batch_a from public.inventory_batches where inventory_item_id = v_pecho;
    perform public.adjust_inventory_batch_stock(
      v_pecho, v_batch_a, 2, 10, 'Physical count', gen_random_uuid(), 'SYNTHETIC CUTOVER QA +2'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 12 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 12 from public.inventory_items where id = v_pecho),
      'positive Pecho adjustment raises batch and aggregate to 12'
    );
    perform public.adjust_inventory_batch_stock(
      v_pecho, v_batch_a, -3, 12, 'Physical count', gen_random_uuid(), 'SYNTHETIC CUTOVER QA -3'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 9 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 9 from public.inventory_items where id = v_pecho)
      and (select count(*) = 2 and sum(quantity_change) = -1 and min(quantity_change) = -3 and max(quantity_change) = 2
           from public.inventory_transactions where inventory_item_id = v_pecho and transaction_type = 'adjustment'),
      'negative Pecho adjustment leaves nine with signed plus two and minus three ledger rows'
    );
    perform public.assert_batch_inventory_consistent(v_pecho);
    select jsonb_build_object('opening', 10, 'after_positive', 12, 'positive_movement', 2, 'after_negative', 9, 'negative_movement', -3) into v_result;
    raise exception using errcode = 'P6R01', message = 'adjustment scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('adjustment', v_result);

  -- Expired physical stock remains in aggregate but cannot fund a sale.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_paa,
      jsonb_build_array(
        jsonb_build_object('quantity', 5, 'received_at', '2026-10-02 09:00:00+08'::timestamptz, 'notes', 'SYNTHETIC CUTOVER QA - EXPIRED'),
        jsonb_build_object('quantity', 10, 'received_at', '2026-10-05 08:00:00+08'::timestamptz, 'notes', 'SYNTHETIC CUTOVER QA - USABLE')
      ),
      'SYNTHETIC CUTOVER QA - EXPIRY', gen_random_uuid()
    );
    select id into strict v_batch_a from public.inventory_batches where inventory_item_id = v_paa and notes = 'SYNTHETIC CUTOVER QA - EXPIRED';
    select id into strict v_batch_b from public.inventory_batches where inventory_item_id = v_paa and notes = 'SYNTHETIC CUTOVER QA - USABLE';
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 15 from public.inventory_items where id = v_paa)
      and public.inventory_usable_quantity(v_paa) = 10
      and (select use_by_date = date '2026-10-03' from public.inventory_batches where id = v_batch_a)
      and (select count(*) = 1 from public.inventory_transactions where inventory_item_id = v_paa),
      'expired five plus usable ten yields aggregate 15 and usable 10 without expiry movement'
    );
    v_blocked := false;
    begin
      perform pg_temp.rehearsal_sale('Inasal Paa Regular', 11, v_manager);
    exception when sqlstate '22023' then
      v_blocked := true;
    end;
    perform pg_temp.rehearsal_check(
      v_blocked
      and (select quantity_on_hand = 15 from public.inventory_items where id = v_paa)
      and (select quantity_on_hand = 5 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 10 from public.inventory_batches where id = v_batch_b),
      'sale requiring 11 rejects with no mutation'
    );
    v_order := pg_temp.rehearsal_sale('Inasal Paa Regular', 8, v_manager);
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 5 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 2 from public.inventory_batches where id = v_batch_b)
      and (select quantity_on_hand = 7 from public.inventory_items where id = v_paa),
      'sale requiring eight consumes only the usable batch'
    );
    perform public.record_batch_inventory_waste(
      v_paa, v_batch_a, 5, 5, 'Expired/disposed', gen_random_uuid(), 'SYNTHETIC CUTOVER QA'
    );
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 0 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 2 from public.inventory_items where id = v_paa)
      and (select count(*) = 1 and min(quantity_change) = -5 from public.inventory_transactions where inventory_item_id = v_paa and inventory_batch_id = v_batch_a and transaction_type = 'waste'),
      'explicit waste removes expired five and writes one negative movement'
    );
    perform public.assert_batch_inventory_consistent(v_paa);
    select jsonb_build_object('aggregate_initial', 15, 'usable_initial', 10, 'sale_11', 'FAIL_NO_MUTATION', 'sale_8', 'USABLE_BATCH_ONLY', 'expired_waste', -5, 'aggregate_final', 2, 'expiry_created_movement', false) into v_result;
    raise exception using errcode = 'P6R01', message = 'expiry scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('expired_stock', v_result);

  -- Formal receiving after opening joins behind older physical batches.
  v_result := null;
  begin
    perform public.initialize_inventory_opening_balance(
      v_paa,
      jsonb_build_array(
        jsonb_build_object('quantity', 5, 'received_at', '2026-10-04 09:00:00+08'::timestamptz, 'notes', 'SYNTHETIC CUTOVER QA - RECEIVING A'),
        jsonb_build_object('quantity', 5, 'received_at', '2026-10-05 07:30:00+08'::timestamptz, 'notes', 'SYNTHETIC CUTOVER QA - RECEIVING B')
      ),
      'SYNTHETIC CUTOVER QA - RECEIVING AFTER OPENING', gen_random_uuid()
    );
    select id into strict v_batch_a from public.inventory_batches where inventory_item_id = v_paa and notes = 'SYNTHETIC CUTOVER QA - RECEIVING A';
    select id into strict v_batch_b from public.inventory_batches where inventory_item_id = v_paa and notes = 'SYNTHETIC CUTOVER QA - RECEIVING B';
    v_report := gen_random_uuid();
    v_line := gen_random_uuid();
    perform public.create_receiving_report_draft(
      v_report, 'production_team', 'SYNTHETIC CUTOVER QA - LATER RECEIPT', null,
      '2026-10-06 08:00:00+08'::timestamptz, null, 'Rollback-only synthetic receipt'
    );
    perform public.save_receiving_report_item(
      v_report, v_line, v_paa, null, 10, 10,
      null, null, null, null, null, null, 'SYNTHETIC CUTOVER QA - RECEIVING C'
    );
    perform public.post_receiving_report(v_report);
    select id into strict v_batch_c from public.inventory_batches where receiving_report_item_id = v_line;
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 20 from public.inventory_items where id = v_paa)
      and (select count(*) = 3 and sum(quantity_on_hand) = 20 from public.inventory_batches where inventory_item_id = v_paa)
      and (select received_at = '2026-10-06 08:00:00+08'::timestamptz and quantity_on_hand = 10 and use_by_date = date '2026-10-07' from public.inventory_batches where id = v_batch_c),
      'October 6 formal receipt adds Batch C behind opening batches'
    );
    v_order := pg_temp.rehearsal_sale('Inasal Paa Regular', 8, v_manager);
    select id into strict v_issuance from public.inventory_transactions
    where order_id = v_order and inventory_item_id = v_paa and transaction_type = 'issuance';
    perform pg_temp.rehearsal_check(
      (select quantity_on_hand = 0 from public.inventory_batches where id = v_batch_a)
      and (select quantity_on_hand = 2 from public.inventory_batches where id = v_batch_b)
      and (select quantity_on_hand = 10 from public.inventory_batches where id = v_batch_c)
      and (select quantity_on_hand = 12 from public.inventory_items where id = v_paa)
      and (select quantity = 5 from public.inventory_transaction_batch_allocations where inventory_transaction_id = v_issuance and inventory_batch_id = v_batch_a)
      and (select quantity = 3 from public.inventory_transaction_batch_allocations where inventory_transaction_id = v_issuance and inventory_batch_id = v_batch_b)
      and not exists (select 1 from public.inventory_transaction_batch_allocations where inventory_transaction_id = v_issuance and inventory_batch_id = v_batch_c),
      'sale of eight consumes A five and B three while leaving C untouched'
    );
    perform public.assert_batch_inventory_consistent(v_paa);
    select jsonb_build_object('opening_a', 5, 'opening_b', 5, 'received_c', 10, 'total_before_sale', 20, 'allocation_a', 5, 'allocation_b', 3, 'allocation_c', 0, 'remaining_a', 0, 'remaining_b', 2, 'remaining_c', 10, 'aggregate_after', 12) into v_result;
    raise exception using errcode = 'P6R01', message = 'receiving scenario complete';
  exception when sqlstate 'P6R01' then null;
  end;
  insert into phase_6b7br_results values ('receiving_after_opening', v_result);

  select jsonb_object_agg(section, result order by section)
  into v_summary
  from phase_6b7br_results;

  raise exception 'PHASE_6B7BR_REHEARSAL_PASSED: %; intentional rollback sentinel.', v_summary
    using errcode = 'P6R99';
end
$rehearsal$;
