-- Phase 6B.7A. Synthetic fixtures only. The terminal exception intentionally
-- aborts every write, including auth users, orders, receipts, and stock.
begin;

create temporary table phase_6b7a_checks (name text primary key) on commit drop;

create function pg_temp.cutover_check(p_ok boolean, p_name text)
returns void language plpgsql as $function$
begin
  if not coalesce(p_ok, false) then
    raise exception 'Phase 6B.7A failed: %', p_name;
  end if;
  insert into phase_6b7a_checks values (p_name);
end
$function$;

create function pg_temp.cutover_item(p_label text, p_category uuid)
returns table(item_id uuid, menu_id uuid) language plpgsql as $function$
begin
  item_id := gen_random_uuid();
  menu_id := gen_random_uuid();
  insert into public.inventory_items (
    id, item_name, unit, quantity_on_hand, reorder_level, is_active,
    quantity_scale, rotation_policy, expiry_required, shelf_life_days,
    batch_consumption_enabled
  ) values (item_id, '__VERIFY_6B7A_' || p_label, 'pcs', 0, 0, true,
            0, 'fifo', true, 2, true);
  insert into public.menu_items (id, category_id, name, code, price, is_available, is_active)
  values (menu_id, p_category, '__VERIFY_6B7A_MENU_' || p_label,
          'V7A' || upper(substr(md5(menu_id::text), 1, 8)), 1, true, true);
  insert into public.menu_ingredients (menu_item_id, inventory_item_id, quantity_required)
  values (menu_id, item_id, 1);
  return next;
end
$function$;

create function pg_temp.cutover_sale(p_menu uuid, p_quantity integer, p_actor uuid)
returns uuid language plpgsql as $function$
declare
  v_order uuid := gen_random_uuid();
  v_name text;
begin
  select name into strict v_name from public.menu_items where id = p_menu;
  insert into public.orders (
    id, order_number, order_channel, fulfillment_type, current_status,
    subtotal, delivery_fee, grand_total
  ) values (v_order, '__VERIFY-6B7A-' || v_order::text, 'walk_in', 'takeout',
            'confirmed', p_quantity, 0, p_quantity);
  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, line_total)
  values (v_order, p_menu, v_name, p_quantity, 1, p_quantity);
  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (v_order, 'confirmed', p_actor, 'Rollback-only cutover verifier');
  return v_order;
end
$function$;

do $verify$
declare
  v_manager uuid := gen_random_uuid();
  v_category uuid := gen_random_uuid();
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
  v_day_one timestamptz;
  v_day_two timestamptz;
  v_item uuid;
  v_menu uuid;
  v_batch_a uuid;
  v_batch_b uuid;
  v_batch_c uuid;
  v_open_request uuid;
  v_open jsonb;
  v_replay jsonb;
  v_order uuid;
  v_issuance uuid;
  v_report uuid;
  v_line uuid;
  v_blocked boolean;
begin
  v_day_one := ((v_today - 1)::timestamp + time '12:00') at time zone 'Asia/Manila';
  v_day_two := (v_today::timestamp + time '00:00') at time zone 'Asia/Manila';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_manager, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'verify-6b7a-manager@example.invalid',
    '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.profiles (id, first_name, last_name, role, is_active)
  values (v_manager, 'Verify', '6B7A Manager', 'manager', true)
  on conflict (id) do update
  set role=excluded.role, is_active=excluded.is_active;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  insert into public.menu_categories (id, name, is_active)
  values (v_category, '__VERIFY_6B7A_CATEGORY__', true);

  perform pg_temp.cutover_check(
    (select prosecdef and proconfig @> array['search_path=public, extensions, pg_temp']
     from pg_proc where oid = 'public.initialize_inventory_opening_balance(uuid,jsonb,text,uuid)'::regprocedure),
    'opening authority is a definer with explicit search path'
  );
  perform pg_temp.cutover_check(
    not has_function_privilege('anon','public.initialize_inventory_opening_balance(uuid,jsonb,text,uuid)','EXECUTE')
      and has_function_privilege('authenticated','public.initialize_inventory_opening_balance(uuid,jsonb,text,uuid)','EXECUTE'),
    'opening RPC ACL excludes anonymous clients'
  );

  -- Two opening batches, shelf-life dates, one ledger, then a cross-batch sale.
  select item_id, menu_id into v_item, v_menu from pg_temp.cutover_item('OPEN_SALE', v_category);
  v_open_request := gen_random_uuid();
  v_open := public.initialize_inventory_opening_balance(v_item,
    jsonb_build_array(
      jsonb_build_object('quantity',12,'received_at',v_day_one,'source_lot_code','A'),
      jsonb_build_object('quantity',18,'received_at',v_day_two,'source_lot_code','B')
    ), 'Synthetic 6B.7A opening', v_open_request);
  perform pg_temp.cutover_check((v_open->>'quantity_total')::numeric=30 and (v_open->>'batch_count')::integer=2,
                                '12 plus 18 opening totals 30 in two batches');
  perform pg_temp.cutover_check((select quantity_on_hand=30 from public.inventory_items where id=v_item),
                                'opening aggregate is 30');
  perform pg_temp.cutover_check((select count(*)=2 and sum(quantity_on_hand)=30 and
                                       bool_and(origin_type='legacy_opening') from public.inventory_batches where inventory_item_id=v_item),
                                'opening batches retain physical balances and origin');
  perform pg_temp.cutover_check((select count(*)=1 and sum(quantity_change)=30 from public.inventory_transactions
                                 where inventory_item_id=v_item and transaction_type='opening_balance'),
                                'opening creates one aggregate ledger movement');
  select id into strict v_batch_a from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='A';
  select id into strict v_batch_b from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='B';
  perform pg_temp.cutover_check((select use_by_date=public.derive_inventory_use_by_date(v_day_one,2::smallint)
                                 from public.inventory_batches where id=v_batch_a)
                                and (select use_by_date=public.derive_inventory_use_by_date(v_day_two,2::smallint)
                                     from public.inventory_batches where id=v_batch_b),
                                'two-day shelf life derives both opening use-by dates');
  v_replay := public.initialize_inventory_opening_balance(v_item,
    jsonb_build_array(
      jsonb_build_object('quantity',12,'received_at',v_day_one,'source_lot_code','A'),
      jsonb_build_object('quantity',18,'received_at',v_day_two,'source_lot_code','B')
    ), 'Synthetic 6B.7A opening', v_open_request);
  perform pg_temp.cutover_check((v_replay->>'replayed')::boolean and
                                v_replay->>'opening_balance_id'=v_open->>'opening_balance_id',
                                'identical opening request replays without another movement');
  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(v_item,'[]'::jsonb,'Changed',v_open_request);
  exception when sqlstate '22023' then v_blocked := true;
  end;
  perform pg_temp.cutover_check(v_blocked,'conflicting opening replay is rejected');
  v_blocked := false;
  begin
    perform public.initialize_inventory_opening_balance(v_item,'[]'::jsonb,null,gen_random_uuid());
  exception when sqlstate '22023' then v_blocked := true;
  end;
  perform pg_temp.cutover_check(v_blocked,'second opening initialization is rejected');
  v_order := pg_temp.cutover_sale(v_menu,15,v_manager);
  select id into strict v_issuance from public.inventory_transactions where order_id=v_order and inventory_item_id=v_item;
  perform pg_temp.cutover_check((select quantity_on_hand=0 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=15 from public.inventory_batches where id=v_batch_b)
                                and (select quantity_on_hand=15 from public.inventory_items where id=v_item),
                                'opening 12 plus 18 then sale 15 leaves 0 plus 15');
  perform pg_temp.cutover_check((select quantity_change=-15 from public.inventory_transactions where id=v_issuance)
                                and (select count(*)=2 and sum(quantity)=15 from public.inventory_transaction_batch_allocations
                                     where inventory_transaction_id=v_issuance),
                                'opening sale writes one issuance and two allocations');
  perform pg_temp.cutover_check((select quantity=12 from public.inventory_transaction_batch_allocations
                                 where inventory_transaction_id=v_issuance and inventory_batch_id=v_batch_a)
                                and (select quantity=3 from public.inventory_transaction_batch_allocations
                                     where inventory_transaction_id=v_issuance and inventory_batch_id=v_batch_b),
                                'opening sale allocates FIFO 12 then 3');
  perform public.assert_batch_inventory_consistent(v_item);
  perform pg_temp.cutover_check(true,'opening sale preserves aggregate and batch equality');

  -- A real zero count is still recorded once, without invented stock or ledger.
  select item_id, menu_id into v_item, v_menu from pg_temp.cutover_item('ZERO', v_category);
  v_open_request := gen_random_uuid();
  v_open := public.initialize_inventory_opening_balance(v_item,'[]'::jsonb,'Verified physical zero',v_open_request);
  perform pg_temp.cutover_check((v_open->>'quantity_total')::numeric=0 and (v_open->>'batch_count')::integer=0
                                and (select count(*)=1 from public.inventory_opening_balances where inventory_item_id=v_item),
                                'zero opening records auditable header');
  perform pg_temp.cutover_check((select quantity_on_hand=0 from public.inventory_items where id=v_item)
                                and not exists(select 1 from public.inventory_batches where inventory_item_id=v_item)
                                and not exists(select 1 from public.inventory_transactions where inventory_item_id=v_item),
                                'zero opening creates no batch or stock movement');
  v_replay := public.initialize_inventory_opening_balance(v_item,'[]'::jsonb,'Verified physical zero',v_open_request);
  perform pg_temp.cutover_check((v_replay->>'replayed')::boolean,'zero opening replays idempotently');
  perform pg_temp.cutover_check(public.inventory_usable_quantity(v_item)=0,
                                'zero-opened item remains unavailable until intake');

  -- Waste from the identified physical batch, then FIFO sales allocation.
  select item_id, menu_id into v_item, v_menu from pg_temp.cutover_item('WASTE_SALE', v_category);
  perform public.initialize_inventory_opening_balance(v_item,
    jsonb_build_array(jsonb_build_object('quantity',10,'received_at',v_day_one,'source_lot_code','A'),
                      jsonb_build_object('quantity',10,'received_at',v_day_two,'source_lot_code','B')),
    null,gen_random_uuid());
  select id into strict v_batch_a from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='A';
  select id into strict v_batch_b from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='B';
  perform public.record_batch_inventory_waste(v_item,v_batch_a,2,10,'Spoilage',gen_random_uuid(),'Synthetic');
  perform pg_temp.cutover_check((select quantity_on_hand=8 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=10 from public.inventory_batches where id=v_batch_b)
                                and (select quantity_on_hand=18 from public.inventory_items where id=v_item),
                                'explicit waste leaves opening batches 8 and 10');
  v_order := pg_temp.cutover_sale(v_menu,9,v_manager);
  select id into strict v_issuance from public.inventory_transactions where order_id=v_order and inventory_item_id=v_item;
  perform pg_temp.cutover_check((select quantity_on_hand=0 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=9 from public.inventory_batches where id=v_batch_b)
                                and (select quantity_on_hand=9 from public.inventory_items where id=v_item),
                                'waste then sale 9 leaves 0 and 9');
  perform pg_temp.cutover_check((select quantity=8 from public.inventory_transaction_batch_allocations
                                 where inventory_transaction_id=v_issuance and inventory_batch_id=v_batch_a)
                                and (select quantity=1 from public.inventory_transaction_batch_allocations
                                     where inventory_transaction_id=v_issuance and inventory_batch_id=v_batch_b),
                                'waste then sale allocates FIFO 8 then 1');
  perform pg_temp.cutover_check((select count(*)=1 and sum(quantity_change)=-2 from public.inventory_transactions
                                 where inventory_item_id=v_item and transaction_type='waste' and inventory_batch_id=v_batch_a)
                                and (select count(*)=1 and sum(quantity_change)=-9 from public.inventory_transactions
                                     where inventory_item_id=v_item and transaction_type='issuance'),
                                'waste and issuance remain distinct ledger movements');
  perform public.assert_batch_inventory_consistent(v_item);
  perform pg_temp.cutover_check(true,'waste then sale preserves invariant');

  -- Both correction directions retain one opening and two batch-linked movements.
  select item_id, menu_id into v_item, v_menu from pg_temp.cutover_item('ADJUST', v_category);
  perform public.initialize_inventory_opening_balance(v_item,
    jsonb_build_array(jsonb_build_object('quantity',10,'received_at',v_day_two)),null,gen_random_uuid());
  select id into strict v_batch_a from public.inventory_batches where inventory_item_id=v_item;
  perform public.adjust_inventory_batch_stock(v_item,v_batch_a,2,10,'Physical count',gen_random_uuid(),'Found two');
  perform pg_temp.cutover_check((select quantity_on_hand=12 and quantity_positive_adjustments=2
                                 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=12 from public.inventory_items where id=v_item),
                                'positive correction adds two to identified batch');
  perform public.adjust_inventory_batch_stock(v_item,v_batch_a,-3,12,'Physical count',gen_random_uuid(),'Three missing');
  perform pg_temp.cutover_check((select quantity_on_hand=9 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=9 from public.inventory_items where id=v_item),
                                'negative correction leaves nine');
  perform pg_temp.cutover_check((select count(*)=1 and sum(quantity_change)=10 from public.inventory_transactions
                                 where inventory_item_id=v_item and transaction_type='opening_balance')
                                and (select count(*)=2 and sum(quantity_change)=-1
                                     and bool_and(inventory_batch_id=v_batch_a) from public.inventory_transactions
                                     where inventory_item_id=v_item and transaction_type='adjustment'),
                                'opening and both signed corrections remain auditable');
  perform public.assert_batch_inventory_consistent(v_item);
  perform pg_temp.cutover_check(true,'both correction directions preserve invariant');

  -- Expired physical stock cannot fund a sale, but can be explicitly disposed.
  select item_id, menu_id into v_item, v_menu from pg_temp.cutover_item('EXPIRED', v_category);
  perform public.initialize_inventory_opening_balance(v_item,
    jsonb_build_array(
      jsonb_build_object('quantity',5,'received_at',((v_today-3)::timestamp+time '12:00') at time zone 'Asia/Manila','source_lot_code','EXPIRED'),
      jsonb_build_object('quantity',10,'received_at',v_day_two,'source_lot_code','CURRENT')
    ),null,gen_random_uuid());
  select id into strict v_batch_a from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='EXPIRED';
  select id into strict v_batch_b from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='CURRENT';
  perform pg_temp.cutover_check((select quantity_on_hand=15 from public.inventory_items where id=v_item)
                                and public.inventory_usable_quantity(v_item)=10
                                and (select use_by_date<v_today from public.inventory_batches where id=v_batch_a),
                                'expired five remain physical while only ten are saleable');
  v_blocked := false;
  begin
    perform pg_temp.cutover_sale(v_menu,11,v_manager);
  exception when sqlstate '22023' then v_blocked := true;
  end;
  perform pg_temp.cutover_check(v_blocked and (select quantity_on_hand=15 from public.inventory_items where id=v_item),
                                'sale of eleven rejects without consuming physical stock');
  v_order := pg_temp.cutover_sale(v_menu,8,v_manager);
  perform pg_temp.cutover_check((select quantity_on_hand=5 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=2 from public.inventory_batches where id=v_batch_b)
                                and (select quantity_on_hand=7 from public.inventory_items where id=v_item),
                                'sale of eight consumes current batch only');
  perform public.record_batch_inventory_waste(v_item,v_batch_a,5,5,'Expired/disposed',gen_random_uuid(),null);
  perform pg_temp.cutover_check((select quantity_on_hand=0 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=2 from public.inventory_items where id=v_item),
                                'expired five are removed only by explicit waste');
  perform pg_temp.cutover_check((select count(*)=1 and sum(quantity_change)=-5 from public.inventory_transactions
                                 where inventory_item_id=v_item and inventory_batch_id=v_batch_a and transaction_type='waste'),
                                'expired disposal has its own negative waste ledger');
  perform public.assert_batch_inventory_consistent(v_item);
  perform pg_temp.cutover_check(true,'expiry sale and disposal preserve invariant');

  -- A post-opening Production Team receipt becomes the later FIFO batch.
  select item_id, menu_id into v_item, v_menu from pg_temp.cutover_item('RECEIVING', v_category);
  perform public.initialize_inventory_opening_balance(v_item,
    jsonb_build_array(jsonb_build_object('quantity',5,'received_at',v_day_one,'source_lot_code','A'),
                      jsonb_build_object('quantity',5,'received_at',v_day_two,'source_lot_code','B')),
    null,gen_random_uuid());
  select id into strict v_batch_a from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='A';
  select id into strict v_batch_b from public.inventory_batches where inventory_item_id=v_item and supplier_lot_code='B';
  v_report := gen_random_uuid();
  v_line := gen_random_uuid();
  perform public.create_receiving_report_draft(v_report,'production_team','VERIFY-6B7A-LATER',null,now(),null,null);
  perform public.save_receiving_report_item(v_report,v_line,v_item,null,10,10,null,null,null,null,null,v_today+1,null);
  perform public.post_receiving_report(v_report);
  select id into strict v_batch_c from public.inventory_batches where receiving_report_item_id=v_line;
  perform pg_temp.cutover_check((select quantity_on_hand=20 from public.inventory_items where id=v_item)
                                and (select count(*)=3 and sum(quantity_on_hand)=20 from public.inventory_batches where inventory_item_id=v_item),
                                'post-opening receipt adds a third batch and ten aggregate units');
  perform pg_temp.cutover_check((select count(*)=1 and sum(quantity_change)=10 from public.inventory_transactions
                                 where inventory_item_id=v_item and transaction_type='receiving'),
                                'post-opening receipt retains receiving ledger');
  v_order := pg_temp.cutover_sale(v_menu,8,v_manager);
  select id into strict v_issuance from public.inventory_transactions where order_id=v_order and inventory_item_id=v_item;
  perform pg_temp.cutover_check((select quantity_on_hand=0 from public.inventory_batches where id=v_batch_a)
                                and (select quantity_on_hand=2 from public.inventory_batches where id=v_batch_b)
                                and (select quantity_on_hand=10 from public.inventory_batches where id=v_batch_c)
                                and (select quantity_on_hand=12 from public.inventory_items where id=v_item),
                                'post-opening FIFO sale leaves batches 0, 2, and 10');
  perform pg_temp.cutover_check((select quantity=5 from public.inventory_transaction_batch_allocations
                                 where inventory_transaction_id=v_issuance and inventory_batch_id=v_batch_a)
                                and (select quantity=3 from public.inventory_transaction_batch_allocations
                                     where inventory_transaction_id=v_issuance and inventory_batch_id=v_batch_b)
                                and not exists(select 1 from public.inventory_transaction_batch_allocations
                                               where inventory_transaction_id=v_issuance and inventory_batch_id=v_batch_c),
                                'later received batch is not consumed before opening batches');
  perform public.assert_batch_inventory_consistent(v_item);
  perform pg_temp.cutover_check(true,'post-opening receipt and sale preserve invariant');
end
$verify$;

do $rollback_sentinel$
declare v_total integer;
begin
  select count(*) into v_total from phase_6b7a_checks;
  raise exception 'PHASE_6B7A_VERIFICATION_PASSED: % checks; intentional rollback sentinel.', v_total
    using errcode = 'P6007';
end
$rollback_sentinel$;
