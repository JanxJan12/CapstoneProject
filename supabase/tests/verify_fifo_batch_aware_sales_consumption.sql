-- Run after 20261004170254_fifo_batch_aware_sales_consumption.sql.
-- All behavioral fixtures and mutations are transaction-local. The terminal
-- exception is intentional: it makes PostgreSQL abort the transaction even
-- when the remote SQL endpoint does not honor a trailing explicit ROLLBACK.

begin;

create temporary table phase_6b6a_verification_results (
  name text primary key
) on commit drop;

create function pg_temp.assert_phase_6b6a(
  p_condition boolean,
  p_name text
)
returns void
language plpgsql
as $function$
begin
  if not coalesce(p_condition, false) then
    raise exception 'Phase 6B.6A verification failed: %', p_name;
  end if;
  insert into phase_6b6a_verification_results(name) values (p_name);
end;
$function$;

do $catalog_verification$
declare
  v_definition text;
begin
  perform pg_temp.assert_phase_6b6a(
    to_regclass('public.inventory_transaction_batch_allocations') is not null,
    'allocation table exists'
  );
  perform pg_temp.assert_phase_6b6a(
    (select relrowsecurity from pg_class where oid = 'public.inventory_transaction_batch_allocations'::regclass),
    'allocation table has RLS enabled'
  );
  perform pg_temp.assert_phase_6b6a(
    not has_table_privilege('anon', 'public.inventory_transaction_batch_allocations', 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', 'public.inventory_transaction_batch_allocations', 'SELECT, INSERT, UPDATE, DELETE'),
    'allocation table denies browser-role direct access'
  );
  perform pg_temp.assert_phase_6b6a(
    has_table_privilege('service_role', 'public.inventory_transaction_batch_allocations', 'SELECT, INSERT, UPDATE, DELETE'),
    'allocation table retains backend authority'
  );
  perform pg_temp.assert_phase_6b6a(
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.inventory_transaction_batch_allocations'::regclass
        and conname = 'inventory_transaction_batch_allocations_transaction_batch_key'
    ),
    'allocation transaction and batch relationship is unique'
  );
  perform pg_temp.assert_phase_6b6a(
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'inventory_transaction_batch_allocations'
        and indexname = 'inventory_transaction_batch_allocations_batch_id_idx'
    ),
    'allocation batch foreign key is indexed'
  );
  perform pg_temp.assert_phase_6b6a(
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = 'inventory_batches_positive_fifo_idx'
    ) and exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = 'inventory_batches_positive_fefo_idx'
    ),
    'positive-batch FIFO and FEFO indexes exist'
  );

  select pg_get_functiondef(procedure.oid)
  into v_definition
  from pg_proc procedure
  where procedure.oid = 'public.deduct_inventory_for_confirmed_order(uuid)'::regprocedure;

  perform pg_temp.assert_phase_6b6a(
    v_definition ilike '%sum(order_item.quantity::numeric * menu_ingredient.quantity_required)%'
      and v_definition ilike '%order by menu_ingredient.inventory_item_id%'
      and v_definition ilike '%for update%'
      and v_definition ilike '%inventory_transaction_batch_allocations%',
    'confirmed-order authority aggregates, locks, and allocates'
  );
  perform pg_temp.assert_phase_6b6a(
    v_definition ilike '%case when v_item.rotation_policy = ''fefo'' then batch.use_by_date end%'
      and v_definition ilike '%batch.received_at asc%'
      and v_definition ilike '%batch.id asc%',
    'allocator has generic deterministic FIFO and FEFO ordering'
  );
  perform pg_temp.assert_phase_6b6a(
    v_definition ilike '%current_timestamp at time zone ''Asia/Manila''%'
      and v_definition ilike '%batch.use_by_date >=%',
    'allocator excludes batches expired before the Manila current date'
  );
  perform pg_temp.assert_phase_6b6a(
    v_definition ilike '%assert_batch_inventory_consistent%'
      and v_definition ilike '%replay integrity error%'
      and v_definition ilike '%allocation total does not reconcile%',
    'allocator checks consistency and replay completeness'
  );
  perform pg_temp.assert_phase_6b6a(
    has_function_privilege('anon', 'public.get_menu_effective_availability()', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.get_menu_effective_availability()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.inventory_usable_quantity(uuid)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.inventory_usable_quantity(uuid)', 'EXECUTE'),
    'public availability remains callable while quantity helper stays internal'
  );
  perform pg_temp.assert_phase_6b6a(
    not has_function_privilege('anon', 'public.deduct_inventory_for_confirmed_order(uuid)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.deduct_inventory_for_confirmed_order(uuid)', 'EXECUTE')
      and has_function_privilege('service_role', 'public.deduct_inventory_for_confirmed_order(uuid)', 'EXECUTE'),
    'deduction function remains internal to backend authority'
  );
  perform pg_temp.assert_phase_6b6a(
    exists (
      select 1 from pg_trigger
      where tgrelid = 'public.order_status_history'::regclass
        and tgname = 'order_status_history_deduct_inventory_on_confirmed_trg'
        and not tgisinternal
    ),
    'confirmed status-history trigger remains installed'
  );
  perform pg_temp.assert_phase_6b6a(
    exists (
      select 1 from pg_proc
      where oid = 'public.receive_inventory_stock_legacy_aggregate(uuid,numeric,text,uuid)'::regprocedure
        and not has_function_privilege('authenticated', oid, 'EXECUTE')
        and not has_function_privilege('anon', oid, 'EXECUTE')
        and not has_function_privilege('service_role', oid, 'EXECUTE')
    ),
    'renamed legacy receive implementation is not directly executable'
  );
  perform pg_temp.assert_phase_6b6a(
    exists (
      select 1 from pg_proc
      where oid = 'public.adjust_inventory_stock_legacy_aggregate(uuid,numeric,text,uuid)'::regprocedure
        and not has_function_privilege('authenticated', oid, 'EXECUTE')
        and not has_function_privilege('anon', oid, 'EXECUTE')
        and not has_function_privilege('service_role', oid, 'EXECUTE')
    ),
    'renamed legacy adjustment implementation is not directly executable'
  );
  perform pg_temp.assert_phase_6b6a(
    exists (
      select 1 from pg_proc
      where oid = 'public.record_inventory_waste_legacy_aggregate(uuid,numeric,text,uuid)'::regprocedure
        and not has_function_privilege('authenticated', oid, 'EXECUTE')
        and not has_function_privilege('anon', oid, 'EXECUTE')
        and not has_function_privilege('service_role', oid, 'EXECUTE')
    ),
    'renamed legacy waste implementation is not directly executable'
  );
end
$catalog_verification$;

do $behavior_verification$
declare
  v_manager_id uuid := gen_random_uuid();
  v_category_id uuid := gen_random_uuid();
  v_fifo_item uuid := gen_random_uuid();
  v_fifo_menu uuid := gen_random_uuid();
  v_fifo_order uuid := gen_random_uuid();
  v_fifo_opening uuid := gen_random_uuid();
  v_fifo_batch_a uuid := gen_random_uuid();
  v_fifo_batch_b uuid := gen_random_uuid();
  v_multi_item uuid := gen_random_uuid();
  v_multi_menu uuid := gen_random_uuid();
  v_multi_order uuid := gen_random_uuid();
  v_multi_opening uuid := gen_random_uuid();
  v_multi_batch_a uuid := gen_random_uuid();
  v_multi_batch_b uuid := gen_random_uuid();
  v_expired_item uuid := gen_random_uuid();
  v_expired_menu uuid := gen_random_uuid();
  v_expired_order uuid := gen_random_uuid();
  v_expired_opening uuid := gen_random_uuid();
  v_expired_batch uuid := gen_random_uuid();
  v_today_batch uuid := gen_random_uuid();
  v_fefo_item uuid := gen_random_uuid();
  v_fefo_menu uuid := gen_random_uuid();
  v_fefo_order uuid := gen_random_uuid();
  v_fefo_opening uuid := gen_random_uuid();
  v_fefo_later_expiry uuid := gen_random_uuid();
  v_fefo_earlier_expiry uuid := gen_random_uuid();
  v_legacy_item uuid := '6b6a0000-0000-0000-0000-000000000101';
  v_mixed_batch_item uuid := '6b6a0000-0000-0000-0000-000000000102';
  v_legacy_menu uuid := gen_random_uuid();
  v_mixed_batch_menu uuid := gen_random_uuid();
  v_mixed_order uuid := gen_random_uuid();
  v_mixed_fail_order uuid := gen_random_uuid();
  v_mixed_opening uuid := gen_random_uuid();
  v_mixed_batch uuid := gen_random_uuid();
  v_formal_item uuid := gen_random_uuid();
  v_formal_menu uuid := gen_random_uuid();
  v_formal_order uuid := gen_random_uuid();
  v_formal_report uuid := gen_random_uuid();
  v_formal_line uuid := gen_random_uuid();
  v_open_item uuid := gen_random_uuid();
  v_open_menu uuid := gen_random_uuid();
  v_open_order uuid := gen_random_uuid();
  v_open_request uuid := gen_random_uuid();
  v_quarter_item uuid;
  v_fried_menu uuid;
  v_quarter_opening uuid := gen_random_uuid();
  v_quarter_batch uuid := gen_random_uuid();
  v_fried_fail_order uuid := gen_random_uuid();
  v_fried_success_order uuid := gen_random_uuid();
  v_paa_item uuid;
  v_paa_regular uuid;
  v_paa_no_rice uuid;
  v_paa_opening uuid := gen_random_uuid();
  v_paa_batch uuid := gen_random_uuid();
  v_paa_order uuid := gen_random_uuid();
  v_transaction_id uuid;
  v_open_result jsonb;
  v_blocked boolean;
  v_before_legacy numeric;
  v_before_batch numeric;
  v_transaction_count bigint;
  v_allocation_count bigint;
  v_allocation_total numeric;
  v_tampered_batch_id uuid;
  v_tampered_quantity numeric;
  v_manila_today date := (current_timestamp at time zone 'Asia/Manila')::date;
  v_chicken jsonb;
  v_chicken_recipes jsonb;
begin
  select to_jsonb(inventory_item)
  into strict v_chicken
  from public.inventory_items inventory_item
  where inventory_item.item_name = 'Chicken';

  select jsonb_agg(to_jsonb(recipe) order by recipe.menu_name, recipe.item_name)
  into v_chicken_recipes
  from (
    select menu.name menu_name, inventory_item.item_name,
           ingredient.quantity_required, inventory_item.unit
    from public.menu_ingredients ingredient
    join public.menu_items menu on menu.id = ingredient.menu_item_id
    join public.inventory_items inventory_item on inventory_item.id = ingredient.inventory_item_id
    where menu.name in ('Adobong Manok', 'Chicken Bicol Express')
  ) recipe;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_manager_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'verify-6b6a-manager@example.invalid',
    '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.profiles (id, first_name, last_name, role, is_active)
  values (v_manager_id, 'Verify', '6B6A Manager', 'manager', true)
  on conflict (id) do update
  set role = excluded.role, is_active = excluded.is_active;
  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  insert into public.menu_categories (id, name, is_active)
  values (v_category_id, '__VERIFY_6B6A_CATEGORY__', true);

  -- Basic FIFO: 10 + 10, consume 6 from the oldest batch only.
  insert into public.inventory_items (
    id, item_name, unit, quantity_on_hand, reorder_level, is_active,
    quantity_scale, rotation_policy, expiry_required, batch_consumption_enabled
  ) values (v_fifo_item, '__VERIFY_6B6A_FIFO_BASIC__', 'pcs', 20, 0, true, 0, 'fifo', true, true);
  insert into public.inventory_opening_balances
    (id, request_id, inventory_item_id, verified_by, verified_at, quantity_total, batch_count, request_payload)
  values (v_fifo_opening, gen_random_uuid(), v_fifo_item, v_manager_id, now(), 20, 2, '{}'::jsonb);
  insert into public.inventory_batches
    (id, batch_code, inventory_item_id, origin_type, opening_balance_id, received_at, use_by_date, quantity_initial, quantity_on_hand)
  values
    (v_fifo_batch_a, '__VERIFY-6B6A-FIFO-A__', v_fifo_item, 'legacy_opening', v_fifo_opening, now() - interval '2 days', v_manila_today + 2, 10, 10),
    (v_fifo_batch_b, '__VERIFY-6B6A-FIFO-B__', v_fifo_item, 'legacy_opening', v_fifo_opening, now() - interval '1 day', v_manila_today + 2, 10, 10);
  insert into public.menu_items (id, category_id, name, code, price, is_available, is_active)
  values (v_fifo_menu, v_category_id, '__VERIFY_6B6A_FIFO_MENU__', 'V6A01', 1, true, true);
  insert into public.menu_ingredients (menu_item_id, inventory_item_id, quantity_required)
  values (v_fifo_menu, v_fifo_item, 1);
  insert into public.orders (id, order_number, order_channel, fulfillment_type, current_status, subtotal, delivery_fee, grand_total)
  values (v_fifo_order, '__VERIFY-6B6A-ORDER-01__', 'walk_in', 'takeout', 'confirmed', 6, 0, 6);
  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, line_total)
  values (v_fifo_order, v_fifo_menu, '__VERIFY_6B6A_FIFO_MENU__', 6, 1, 6);
  insert into public.order_status_history (order_id, status, changed_by, notes)
  values (v_fifo_order, 'confirmed', v_manager_id, 'Verifier confirmation');

  perform pg_temp.assert_phase_6b6a((select quantity_on_hand = 14 from public.inventory_items where id = v_fifo_item), 'basic FIFO decrements aggregate');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand = 4 from public.inventory_batches where id = v_fifo_batch_a), 'basic FIFO decrements oldest batch');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand = 10 from public.inventory_batches where id = v_fifo_batch_b), 'basic FIFO preserves later batch');
  select id into strict v_transaction_id from public.inventory_transactions
  where order_id = v_fifo_order and inventory_item_id = v_fifo_item and transaction_type = 'issuance';
  perform pg_temp.assert_phase_6b6a((select quantity_change = -6 from public.inventory_transactions where id = v_transaction_id), 'basic FIFO writes one total issuance');
  perform pg_temp.assert_phase_6b6a((select count(*) = 1 and sum(quantity) = 6 from public.inventory_transaction_batch_allocations where inventory_transaction_id = v_transaction_id), 'basic FIFO writes one exact allocation');
  perform public.assert_batch_inventory_consistent(v_fifo_item);
  perform pg_temp.assert_phase_6b6a(true, 'basic FIFO aggregate and batches reconcile');

  -- Multi-batch FIFO: 4 + 10, consume 7 as 4 + 3.
  insert into public.inventory_items (id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled)
  values (v_multi_item,'__VERIFY_6B6A_FIFO_MULTI__','pcs',14,0,true,0,'fifo',true,true);
  insert into public.inventory_opening_balances (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload)
  values (v_multi_opening,gen_random_uuid(),v_multi_item,v_manager_id,now(),14,2,'{}'::jsonb);
  insert into public.inventory_batches (id,batch_code,inventory_item_id,origin_type,opening_balance_id,received_at,use_by_date,quantity_initial,quantity_on_hand)
  values
    (v_multi_batch_a,'__VERIFY-6B6A-MULTI-A__',v_multi_item,'legacy_opening',v_multi_opening,now()-interval '2 days',v_manila_today+2,4,4),
    (v_multi_batch_b,'__VERIFY-6B6A-MULTI-B__',v_multi_item,'legacy_opening',v_multi_opening,now()-interval '1 day',v_manila_today+2,10,10);
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active)
  values (v_multi_menu,v_category_id,'__VERIFY_6B6A_MULTI_MENU__','V6A02',1,true,true);
  insert into public.menu_ingredients values (gen_random_uuid(),v_multi_menu,v_multi_item,1,now());
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total)
  values (v_multi_order,'__VERIFY-6B6A-ORDER-02__','walk_in','takeout','confirmed',7,0,7);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total)
  values (v_multi_order,v_multi_menu,'__VERIFY_6B6A_MULTI_MENU__',7,1,7);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_multi_order,'confirmed',v_manager_id,'Verifier');
  select id into strict v_transaction_id from public.inventory_transactions where order_id=v_multi_order and inventory_item_id=v_multi_item and transaction_type='issuance';
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=0 from public.inventory_batches where id=v_multi_batch_a), 'multi-batch FIFO exhausts first batch');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=7 from public.inventory_batches where id=v_multi_batch_b), 'multi-batch FIFO decrements second batch');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=7 from public.inventory_items where id=v_multi_item), 'multi-batch FIFO decrements aggregate');
  perform pg_temp.assert_phase_6b6a((select count(*)=2 and sum(quantity)=7 from public.inventory_transaction_batch_allocations where inventory_transaction_id=v_transaction_id), 'multi-batch FIFO records two allocations totaling seven');
  perform pg_temp.assert_phase_6b6a((select exists(select 1 from public.inventory_transaction_batch_allocations where inventory_transaction_id=v_transaction_id and inventory_batch_id=v_multi_batch_a and quantity=4)), 'multi-batch first allocation is four');
  perform pg_temp.assert_phase_6b6a((select exists(select 1 from public.inventory_transaction_batch_allocations where inventory_transaction_id=v_transaction_id and inventory_batch_id=v_multi_batch_b and quantity=3)), 'multi-batch second allocation is three');

  -- Expiry: yesterday is excluded, today is usable through the end of day.
  insert into public.inventory_items (id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled)
  values (v_expired_item,'__VERIFY_6B6A_EXPIRY__','pcs',20,0,true,0,'fifo',true,true);
  insert into public.inventory_opening_balances (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload)
  values (v_expired_opening,gen_random_uuid(),v_expired_item,v_manager_id,now(),20,2,'{}'::jsonb);
  insert into public.inventory_batches (id,batch_code,inventory_item_id,origin_type,opening_balance_id,received_at,use_by_date,quantity_initial,quantity_on_hand)
  values
    (v_expired_batch,'__VERIFY-6B6A-EXPIRED__',v_expired_item,'legacy_opening',v_expired_opening,now()-interval '3 days',v_manila_today-1,10,10),
    (v_today_batch,'__VERIFY-6B6A-TODAY__',v_expired_item,'legacy_opening',v_expired_opening,now()-interval '2 days',v_manila_today,10,10);
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active)
  values (v_expired_menu,v_category_id,'__VERIFY_6B6A_EXPIRY_MENU__','V6A03',1,true,true);
  insert into public.menu_ingredients (menu_item_id,inventory_item_id,quantity_required) values (v_expired_menu,v_expired_item,1);
  perform pg_temp.assert_phase_6b6a(public.inventory_usable_quantity(v_expired_item)=10, 'expired stock is excluded from usable quantity');
  perform pg_temp.assert_phase_6b6a((select effective_available from public.get_menu_effective_availability() where menu_item_id=v_expired_menu), 'use-by-day stock keeps menu available');
  perform public.assert_inventory_available_for_requested_items(jsonb_build_array(jsonb_build_object('id',v_expired_menu,'qty',10)));
  perform pg_temp.assert_phase_6b6a(true, 'customer cart validation accepts exact usable quantity');
  v_blocked := false;
  begin
    perform public.assert_inventory_available_for_requested_items(jsonb_build_array(jsonb_build_object('id',v_expired_menu,'qty',11)));
  exception when sqlstate '22023' then v_blocked := true;
  end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'customer cart validation rejects quantity above usable batches');
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total)
  values (v_expired_order,'__VERIFY-6B6A-ORDER-03__','walk_in','takeout','confirmed',5,0,5);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total)
  values (v_expired_order,v_expired_menu,'__VERIFY_6B6A_EXPIRY_MENU__',5,1,5);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_expired_order,'confirmed',v_manager_id,'Verifier');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=10 from public.inventory_batches where id=v_expired_batch), 'sale never decrements expired batch');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=5 from public.inventory_batches where id=v_today_batch), 'sale decrements use-by-day batch');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=15 from public.inventory_items where id=v_expired_item), 'expired stock remains in aggregate physical quantity');
  perform pg_temp.assert_phase_6b6a(public.inventory_usable_quantity(v_expired_item)=5, 'usable quantity reflects remaining non-expired balance');
  update public.menu_ingredients set quantity_required=6 where menu_item_id=v_expired_menu;
  perform pg_temp.assert_phase_6b6a(not (select effective_available from public.get_menu_effective_availability() where menu_item_id=v_expired_menu), 'availability respects recipe quantity against usable stock');
  perform pg_temp.assert_phase_6b6a(not (select effective_available from public.get_manager_menu_items() where id=v_expired_menu), 'Manager availability uses the same usable quantity');
  update public.menu_ingredients set quantity_required=1 where menu_item_id=v_expired_menu;

  -- FEFO compatibility chooses earliest usable use-by date before receipt time.
  insert into public.inventory_items (id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled)
  values (v_fefo_item,'__VERIFY_6B6A_FEFO__','pcs',10,0,true,0,'fefo',true,true);
  insert into public.inventory_opening_balances (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload)
  values (v_fefo_opening,gen_random_uuid(),v_fefo_item,v_manager_id,now(),10,2,'{}'::jsonb);
  insert into public.inventory_batches (id,batch_code,inventory_item_id,origin_type,opening_balance_id,received_at,use_by_date,quantity_initial,quantity_on_hand)
  values
    (v_fefo_later_expiry,'__VERIFY-6B6A-FEFO-LATE__',v_fefo_item,'legacy_opening',v_fefo_opening,now()-interval '3 days',v_manila_today+3,5,5),
    (v_fefo_earlier_expiry,'__VERIFY-6B6A-FEFO-EARLY__',v_fefo_item,'legacy_opening',v_fefo_opening,now()-interval '1 day',v_manila_today+1,5,5);
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active) values (v_fefo_menu,v_category_id,'__VERIFY_6B6A_FEFO_MENU__','V6A04',1,true,true);
  insert into public.menu_ingredients (menu_item_id,inventory_item_id,quantity_required) values (v_fefo_menu,v_fefo_item,1);
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_fefo_order,'__VERIFY-6B6A-ORDER-04__','walk_in','takeout','confirmed',3,0,3);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values (v_fefo_order,v_fefo_menu,'__VERIFY_6B6A_FEFO_MENU__',3,1,3);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_fefo_order,'confirmed',v_manager_id,'Verifier');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=5 from public.inventory_batches where id=v_fefo_later_expiry), 'FEFO preserves earlier-received later-expiry batch');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=2 from public.inventory_batches where id=v_fefo_earlier_expiry), 'FEFO consumes earliest use-by batch');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=7 from public.inventory_items where id=v_fefo_item), 'FEFO keeps aggregate synchronized');

  -- Real Fried Chicken recipe: 2 Quarter Legs per order; 5 units fail at 9.
  select id into strict v_quarter_item from public.inventory_items where item_name='Fried Chicken - Quarter Leg';
  select id into strict v_fried_menu from public.menu_items where name='Fried Chicken Regular';
  update public.inventory_items set quantity_on_hand=9 where id=v_quarter_item;
  insert into public.inventory_opening_balances (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload)
  values (v_quarter_opening,gen_random_uuid(),v_quarter_item,v_manager_id,now(),9,1,'{}'::jsonb);
  insert into public.inventory_batches (id,batch_code,inventory_item_id,origin_type,opening_balance_id,received_at,use_by_date,quantity_initial,quantity_on_hand)
  values (v_quarter_batch,'__VERIFY-6B6A-QUARTER__',v_quarter_item,'legacy_opening',v_quarter_opening,now(),v_manila_today+1,9,9);
  v_blocked := false;
  begin
    insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_fried_fail_order,'__VERIFY-6B6A-FRIED-FAIL__','walk_in','takeout','confirmed',5,0,5);
    insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values (v_fried_fail_order,v_fried_menu,'Fried Chicken Regular',5,1,5);
    insert into public.order_status_history (order_id,status,changed_by,notes) values (v_fried_fail_order,'confirmed',v_manager_id,'Must fail');
  exception when sqlstate '22023' then v_blocked := true;
  end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'five Fried Chicken orders fail against nine Quarter Legs');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=9 from public.inventory_items where id=v_quarter_item), 'failed Fried Chicken confirmation preserves aggregate');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=9 from public.inventory_batches where id=v_quarter_batch), 'failed Fried Chicken confirmation preserves batch');
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_fried_success_order,'__VERIFY-6B6A-FRIED-OK__','walk_in','takeout','confirmed',4,0,4);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values (v_fried_success_order,v_fried_menu,'Fried Chicken Regular',4,1,4);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_fried_success_order,'confirmed',v_manager_id,'Verifier');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=1 from public.inventory_items where id=v_quarter_item), 'four Fried Chicken orders consume eight Quarter Legs');
  perform pg_temp.assert_phase_6b6a((select quantity_change=-8 from public.inventory_transactions where order_id=v_fried_success_order and inventory_item_id=v_quarter_item), 'Fried Chicken issuance uses order quantity times recipe quantity');

  -- Real Paa variants aggregate to one item requirement and one issuance.
  select id into strict v_paa_item from public.inventory_items where item_name='Marinated Chicken - Paa';
  select id into strict v_paa_regular from public.menu_items where name='Inasal Paa Regular';
  select id into strict v_paa_no_rice from public.menu_items where name='Inasal Paa No Rice';
  update public.inventory_items set quantity_on_hand=10 where id=v_paa_item;
  insert into public.inventory_opening_balances (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload) values (v_paa_opening,gen_random_uuid(),v_paa_item,v_manager_id,now(),10,1,'{}'::jsonb);
  insert into public.inventory_batches (id,batch_code,inventory_item_id,origin_type,opening_balance_id,received_at,use_by_date,quantity_initial,quantity_on_hand) values (v_paa_batch,'__VERIFY-6B6A-PAA__',v_paa_item,'legacy_opening',v_paa_opening,now(),v_manila_today+1,10,10);
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_paa_order,'__VERIFY-6B6A-PAA-ORDER__','walk_in','takeout','confirmed',5,0,5);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values
    (v_paa_order,v_paa_regular,'Inasal Paa Regular',2,1,2),
    (v_paa_order,v_paa_no_rice,'Inasal Paa No Rice',3,1,3);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_paa_order,'confirmed',v_manager_id,'Verifier');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=5 from public.inventory_items where id=v_paa_item), 'multiple Paa menu lines consume five aggregate pieces');
  perform pg_temp.assert_phase_6b6a((select count(*)=1 and min(quantity_change)=-5 from public.inventory_transactions where order_id=v_paa_order and inventory_item_id=v_paa_item and transaction_type='issuance'), 'multiple Paa variants produce one issuance');
  select id into strict v_transaction_id from public.inventory_transactions where order_id=v_paa_order and inventory_item_id=v_paa_item and transaction_type='issuance';
  perform pg_temp.assert_phase_6b6a((select count(*)=1 and sum(quantity)=5 from public.inventory_transaction_batch_allocations where inventory_transaction_id=v_transaction_id), 'multiple Paa variants produce reconciled batch allocation');

  -- Mixed legacy and batch order, replay, and forced rollback after legacy mutation.
  insert into public.inventory_items (id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled) values
    (v_legacy_item,'__VERIFY_6B6A_LEGACY__','pcs',20,0,true,0,'fifo',false,false),
    (v_mixed_batch_item,'__VERIFY_6B6A_MIXED_BATCH__','pcs',5,0,true,0,'fifo',true,true);
  insert into public.inventory_opening_balances (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload) values (v_mixed_opening,gen_random_uuid(),v_mixed_batch_item,v_manager_id,now(),5,1,'{}'::jsonb);
  insert into public.inventory_batches (id,batch_code,inventory_item_id,origin_type,opening_balance_id,received_at,use_by_date,quantity_initial,quantity_on_hand) values (v_mixed_batch,'__VERIFY-6B6A-MIXED__',v_mixed_batch_item,'legacy_opening',v_mixed_opening,now(),v_manila_today+1,5,5);
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active) values
    (v_legacy_menu,v_category_id,'__VERIFY_6B6A_LEGACY_MENU__','V6A05',1,true,true),
    (v_mixed_batch_menu,v_category_id,'__VERIFY_6B6A_MIXED_MENU__','V6A06',1,true,true);
  insert into public.menu_ingredients (menu_item_id,inventory_item_id,quantity_required) values
    (v_legacy_menu,v_legacy_item,1),(v_mixed_batch_menu,v_mixed_batch_item,1);
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_mixed_order,'__VERIFY-6B6A-MIXED-OK__','walk_in','takeout','confirmed',4,0,4);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values
    (v_mixed_order,v_legacy_menu,'__VERIFY_6B6A_LEGACY_MENU__',2,1,2),
    (v_mixed_order,v_mixed_batch_menu,'__VERIFY_6B6A_MIXED_MENU__',2,1,2);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_mixed_order,'confirmed',v_manager_id,'Verifier');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=18 from public.inventory_items where id=v_legacy_item), 'mixed order deducts legacy aggregate item');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=3 from public.inventory_items where id=v_mixed_batch_item), 'mixed order deducts batch aggregate item');
  perform pg_temp.assert_phase_6b6a((select count(*)=2 from public.inventory_transactions where order_id=v_mixed_order and transaction_type='issuance'), 'mixed order writes one issuance per inventory item');
  perform pg_temp.assert_phase_6b6a((select count(*)=0 from public.inventory_transaction_batch_allocations allocation join public.inventory_transactions transaction_record on transaction_record.id=allocation.inventory_transaction_id where transaction_record.order_id=v_mixed_order and transaction_record.inventory_item_id=v_legacy_item), 'legacy issuance has no batch allocation');
  select count(*) into v_transaction_count from public.inventory_transactions where order_id=v_mixed_order;
  select count(*),coalesce(sum(allocation.quantity),0) into v_allocation_count,v_allocation_total from public.inventory_transaction_batch_allocations allocation join public.inventory_transactions transaction_record on transaction_record.id=allocation.inventory_transaction_id where transaction_record.order_id=v_mixed_order;
  perform public.deduct_inventory_for_confirmed_order(v_mixed_order);
  perform pg_temp.assert_phase_6b6a((select count(*)=v_transaction_count from public.inventory_transactions where order_id=v_mixed_order), 'confirmation replay creates no second issuance');
  perform pg_temp.assert_phase_6b6a((select count(*)=v_allocation_count and coalesce(sum(quantity),0)=v_allocation_total from public.inventory_transaction_batch_allocations allocation join public.inventory_transactions transaction_record on transaction_record.id=allocation.inventory_transaction_id where transaction_record.order_id=v_mixed_order), 'confirmation replay creates no second allocation or decrement');

  select transaction_record.id
  into strict v_transaction_id
  from public.inventory_transactions transaction_record
  where transaction_record.order_id=v_mixed_order
    and transaction_record.inventory_item_id=v_mixed_batch_item
    and transaction_record.transaction_type='issuance';
  delete from public.inventory_transaction_batch_allocations allocation
  where allocation.inventory_transaction_id=v_transaction_id
  returning allocation.inventory_batch_id, allocation.quantity
  into strict v_tampered_batch_id, v_tampered_quantity;
  v_before_batch := (select quantity_on_hand from public.inventory_items where id=v_mixed_batch_item);
  v_blocked := false;
  begin
    perform public.deduct_inventory_for_confirmed_order(v_mixed_order);
  exception when sqlstate '23514' then v_blocked := true;
  end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'partial-allocation replay is rejected as an integrity error');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=v_before_batch from public.inventory_items where id=v_mixed_batch_item), 'partial-allocation replay does not double-consume aggregate stock');
  perform pg_temp.assert_phase_6b6a((select count(*)=1 from public.inventory_transactions where id=v_transaction_id), 'partial-allocation replay does not duplicate the issuance');
  insert into public.inventory_transaction_batch_allocations (
    inventory_transaction_id, inventory_batch_id, quantity
  ) values (v_transaction_id, v_tampered_batch_id, v_tampered_quantity);

  v_before_legacy := (select quantity_on_hand from public.inventory_items where id=v_legacy_item);
  v_before_batch := (select quantity_on_hand from public.inventory_items where id=v_mixed_batch_item);
  v_blocked := false;
  begin
    insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_mixed_fail_order,'__VERIFY-6B6A-MIXED-FAIL__','walk_in','takeout','confirmed',12,0,12);
    insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values
      (v_mixed_fail_order,v_legacy_menu,'__VERIFY_6B6A_LEGACY_MENU__',1,1,1),
      (v_mixed_fail_order,v_mixed_batch_menu,'__VERIFY_6B6A_MIXED_MENU__',11,1,11);
    insert into public.order_status_history (order_id,status,changed_by,notes) values (v_mixed_fail_order,'confirmed',v_manager_id,'Must roll back');
  exception when sqlstate '22023' then v_blocked := true;
  end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'mixed order fails when one batch requirement is insufficient');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=v_before_legacy from public.inventory_items where id=v_legacy_item), 'forced failure rolls back earlier legacy aggregate mutation');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=v_before_batch from public.inventory_items where id=v_mixed_batch_item), 'forced failure preserves batch aggregate mutation');
  perform pg_temp.assert_phase_6b6a(not exists(select 1 from public.inventory_transactions where order_id=v_mixed_fail_order), 'forced failure leaves no issuance transaction');
  perform pg_temp.assert_phase_6b6a(not exists(select 1 from public.inventory_transaction_batch_allocations allocation join public.inventory_transactions transaction_record on transaction_record.id=allocation.inventory_transaction_id where transaction_record.order_id=v_mixed_fail_order), 'forced failure leaves no allocation');

  -- Guard aggregate-only mutations for batch items; preserve legacy behavior.
  v_blocked := false;
  begin perform public.receive_inventory_stock(v_mixed_batch_item,1,'Blocked receive',gen_random_uuid()); exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'batch-enabled legacy receiving is rejected');
  v_blocked := false;
  begin perform public.adjust_inventory_stock(v_mixed_batch_item,1,'Blocked adjust',gen_random_uuid()); exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'batch-enabled aggregate adjustment is rejected');
  v_blocked := false;
  begin perform public.record_inventory_waste(v_mixed_batch_item,1,'Blocked waste',gen_random_uuid()); exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'batch-enabled aggregate waste is rejected');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=v_before_batch from public.inventory_items where id=v_mixed_batch_item), 'blocked batch mutations create no aggregate drift');
  perform public.receive_inventory_stock(v_legacy_item,2,'Legacy receive',gen_random_uuid());
  perform public.adjust_inventory_stock(v_legacy_item,1,'Legacy adjust',gen_random_uuid());
  perform public.record_inventory_waste(v_legacy_item,1,'Legacy waste',gen_random_uuid());
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=v_before_legacy+2 from public.inventory_items where id=v_legacy_item), 'legacy aggregate mutators remain operational');

  -- Allocation quantities remain subject to the inventory scale authority.
  select transaction_record.id into strict v_transaction_id
  from public.inventory_transactions transaction_record
  where transaction_record.order_id=v_mixed_order and transaction_record.inventory_item_id=v_mixed_batch_item;
  v_blocked := false;
  begin
    update public.inventory_transaction_batch_allocations set quantity=0.5
    where inventory_transaction_id=v_transaction_id;
  exception when sqlstate '22023' then v_blocked:=true;
  end;
  perform pg_temp.assert_phase_6b6a(v_blocked, 'scale-zero allocation rejects fractional quantity');

  -- Authorized emergency receiving remains batch-safe, then its batch funds a sale.
  insert into public.inventory_items (id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,shelf_life_days,batch_consumption_enabled)
  values (v_formal_item,'__VERIFY_6B6A_FORMAL__','pcs',0,0,true,0,'fifo',true,2,true);
  perform public.create_emergency_production_receiving(v_formal_report,now(),
    'VERIFY-6B6A-FORMAL',null,'Synthetic order regression','Verifier');
  perform public.save_receiving_report_item(v_formal_report,v_formal_line,v_formal_item,null,8,8,null,null,null,null,null,v_manila_today+1,null);
  perform public.post_receiving_report(v_formal_report);
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=8 from public.inventory_items where id=v_formal_item), 'formal receiving increments batch-enabled aggregate');
  perform pg_temp.assert_phase_6b6a((select count(*)=1 and sum(quantity_on_hand)=8 from public.inventory_batches where inventory_item_id=v_formal_item), 'formal receiving creates matching batch balance');
  perform pg_temp.assert_phase_6b6a((select count(*)=1 and min(quantity_change)=8 from public.inventory_transactions where inventory_item_id=v_formal_item and transaction_type='receiving'), 'formal receiving creates linked receiving ledger');
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active) values (v_formal_menu,v_category_id,'__VERIFY_6B6A_FORMAL_MENU__','V6A07',1,true,true);
  insert into public.menu_ingredients (menu_item_id,inventory_item_id,quantity_required) values (v_formal_menu,v_formal_item,1);
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_formal_order,'__VERIFY-6B6A-FORMAL-ORDER__','walk_in','takeout','confirmed',3,0,3);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values (v_formal_order,v_formal_menu,'__VERIFY_6B6A_FORMAL_MENU__',3,1,3);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_formal_order,'confirmed',v_manager_id,'Verifier');
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=5 from public.inventory_items where id=v_formal_item), 'sale consumes formally received aggregate stock');
  perform pg_temp.assert_phase_6b6a((select sum(quantity_on_hand)=5 from public.inventory_batches where inventory_item_id=v_formal_item), 'sale consumes formally received batch stock');

  -- Opening balance compatibility: 4 + 6, consume 5 as 4 + 1.
  insert into public.inventory_items (id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,shelf_life_days,batch_consumption_enabled)
  values (v_open_item,'__VERIFY_6B6A_OPENING__','pcs',0,0,true,0,'fifo',true,2,true);
  v_open_result := public.initialize_inventory_opening_balance(
    v_open_item,
    jsonb_build_array(
      jsonb_build_object('quantity',4,'received_at',(now()-interval '1 day'),'use_by_date',v_manila_today,'source_lot_code','VERIFY-A'),
      jsonb_build_object('quantity',6,'received_at',now(),'use_by_date',v_manila_today+1,'source_lot_code','VERIFY-B')
    ),
    'Phase 6B.6A rollback verifier',
    v_open_request
  );
  perform pg_temp.assert_phase_6b6a((v_open_result->>'quantity_total')::numeric=10 and (v_open_result->>'batch_count')::integer=2, 'opening balance creates two batches totaling ten');
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active) values (v_open_menu,v_category_id,'__VERIFY_6B6A_OPEN_MENU__','V6A08',1,true,true);
  insert into public.menu_ingredients (menu_item_id,inventory_item_id,quantity_required) values (v_open_menu,v_open_item,1);
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total) values (v_open_order,'__VERIFY-6B6A-OPEN-ORDER__','walk_in','takeout','confirmed',5,0,5);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total) values (v_open_order,v_open_menu,'__VERIFY_6B6A_OPEN_MENU__',5,1,5);
  insert into public.order_status_history (order_id,status,changed_by,notes) values (v_open_order,'confirmed',v_manager_id,'Verifier');
  select id into strict v_transaction_id from public.inventory_transactions where order_id=v_open_order and inventory_item_id=v_open_item and transaction_type='issuance';
  perform pg_temp.assert_phase_6b6a((select quantity_on_hand=5 from public.inventory_items where id=v_open_item), 'opening-backed sale leaves aggregate five');
  perform pg_temp.assert_phase_6b6a((select count(*)=2 and sum(quantity)=5 from public.inventory_transaction_batch_allocations where inventory_transaction_id=v_transaction_id), 'opening-backed sale allocates across two batches');
  perform pg_temp.assert_phase_6b6a((select min(quantity_on_hand)=0 and max(quantity_on_hand)=5 from public.inventory_batches where inventory_item_id=v_open_item), 'opening-backed FIFO leaves batch balances zero and five');

  -- Historical Chicken and its recipes remain byte-for-byte data equivalent.
  perform pg_temp.assert_phase_6b6a((select to_jsonb(inventory_item)=v_chicken from public.inventory_items inventory_item where inventory_item.item_name='Chicken'), 'historical Chicken row remains unchanged');
  perform pg_temp.assert_phase_6b6a((select jsonb_agg(to_jsonb(recipe) order by recipe.menu_name,recipe.item_name)=v_chicken_recipes from (select menu.name menu_name,inventory_item.item_name,ingredient.quantity_required,inventory_item.unit from public.menu_ingredients ingredient join public.menu_items menu on menu.id=ingredient.menu_item_id join public.inventory_items inventory_item on inventory_item.id=ingredient.inventory_item_id where menu.name in ('Adobong Manok','Chicken Bicol Express')) recipe), 'historical Chicken recipes remain unchanged');
  perform pg_temp.assert_phase_6b6a(not exists(select 1 from public.inventory_batches where inventory_item_id=(select id from public.inventory_items where item_name='Chicken')), 'historical Chicken remains batch-free');
end
$behavior_verification$;

do $rollback_verification$
declare
  v_checks integer;
begin
  select count(*)::integer
  into v_checks
  from phase_6b6a_verification_results;

  raise exception
    'PHASE_6B6A_VERIFICATION_PASSED: % checks; intentional rollback sentinel.',
    v_checks
    using errcode = 'P6001';
end
$rollback_verification$;
