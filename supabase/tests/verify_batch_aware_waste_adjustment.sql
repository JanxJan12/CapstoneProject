-- Phase 6B.6B live verifier. P6004 is success: PostgreSQL aborts the whole
-- transaction, including every fixture and stock movement.
begin;

create temporary table phase_6b6b_checks (name text primary key) on commit drop;

create function pg_temp.assert_6b6b(p_condition boolean, p_name text)
returns void language plpgsql as $function$
begin
  if not coalesce(p_condition, false) then
    raise exception 'Phase 6B.6B verification failed: %', p_name;
  end if;
  insert into phase_6b6b_checks values (p_name);
end;
$function$;

do $catalog$
begin
  perform pg_temp.assert_6b6b(
    exists (select 1 from pg_attribute where attrelid='public.inventory_batches'::regclass
      and attname='quantity_positive_adjustments' and not attisdropped),
    'positive correction allowance exists without rewriting initial intake'
  );
  perform pg_temp.assert_6b6b(
    exists (select 1 from pg_constraint where conrelid='public.inventory_batches'::regclass
      and conname='inventory_batches_quantity_on_hand_le_authorized_chk'),
    'batch balance is capped by initial intake plus positive corrections'
  );
  perform pg_temp.assert_6b6b(
    exists (select 1 from pg_constraint where conrelid='public.inventory_transactions'::regclass
      and conname='inventory_transactions_batch_balance_movement_chk'),
    'direct batch movement ledger has before and after constraints'
  );
  perform pg_temp.assert_6b6b(
    not has_function_privilege('anon','public.record_batch_inventory_waste(uuid,uuid,numeric,numeric,text,uuid,text)','EXECUTE')
      and has_function_privilege('authenticated','public.record_batch_inventory_waste(uuid,uuid,numeric,numeric,text,uuid,text)','EXECUTE')
      and not has_function_privilege('anon','public.adjust_inventory_batch_stock(uuid,uuid,numeric,numeric,text,uuid,text)','EXECUTE')
      and has_function_privilege('authenticated','public.adjust_inventory_batch_stock(uuid,uuid,numeric,numeric,text,uuid,text)','EXECUTE')
      and not has_function_privilege('authenticated','public.mutate_inventory_batch_quantity(uuid,uuid,numeric,numeric,text,text,uuid,public.inventory_transaction_type)','EXECUTE'),
    'business RPC ACLs exclude anon and internal engine is not directly callable'
  );
  perform pg_temp.assert_6b6b(
    not has_table_privilege('authenticated','public.inventory_batches','INSERT,UPDATE,DELETE')
      and not has_table_privilege('authenticated','public.inventory_transactions','INSERT,UPDATE,DELETE')
      and (select relrowsecurity from pg_class where oid='public.inventory_batches'::regclass),
    'protected inventory tables retain direct-write denial and RLS'
  );
  perform pg_temp.assert_6b6b(
    not has_function_privilege('anon','public.get_manager_inventory_batch_context()','EXECUTE')
      and has_function_privilege('authenticated','public.get_manager_inventory_batch_context()','EXECUTE'),
    'Manager batch context is authenticated only'
  );
end
$catalog$;

do $behavior$
declare
  v_manager uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_other_item uuid := gen_random_uuid();
  v_legacy uuid := gen_random_uuid();
  v_opening uuid := gen_random_uuid();
  v_other_opening uuid := gen_random_uuid();
  v_batch_a uuid := gen_random_uuid();
  v_batch_b uuid := gen_random_uuid();
  v_wrong_batch uuid := gen_random_uuid();
  v_menu_category uuid := gen_random_uuid();
  v_menu uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_waste_request uuid := gen_random_uuid();
  v_adjust_request uuid := gen_random_uuid();
  v_result jsonb;
  v_replay jsonb;
  v_blocked boolean;
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
  v_transaction_count bigint;
  v_chicken jsonb;
begin
  select to_jsonb(i) into strict v_chicken
  from public.inventory_items i where i.item_name='Chicken';

  insert into auth.users (
    id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    v_manager,'00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','verify-6b6b-manager@example.invalid',
    '',now(),'{}'::jsonb,'{}'::jsonb,now(),now()
  );
  insert into public.profiles (id,first_name,last_name,role,is_active)
  values (v_manager,'Verify','6B6B Manager','manager',true)
  on conflict (id) do update set role=excluded.role,is_active=excluded.is_active,
    last_name=excluded.last_name;
  perform set_config('request.jwt.claim.sub',v_manager::text,true);
  perform set_config('request.jwt.claim.sub','',true);
  v_blocked:=false;
  begin perform public.get_manager_inventory_batch_context();
  exception when sqlstate '42501' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'anonymous caller cannot read Manager batch context');
  perform set_config('request.jwt.claim.sub',v_manager::text,true);
  update public.profiles set is_active=false where id=v_manager;
  v_blocked:=false;
  begin perform public.adjust_inventory_batch_stock(gen_random_uuid(),gen_random_uuid(),1,0,'Count',gen_random_uuid());
  exception when sqlstate '42501' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'inactive Manager cannot invoke batch adjustment');
  update public.profiles set is_active=true,role='customer' where id=v_manager;
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(gen_random_uuid(),gen_random_uuid(),1,0,'Spoiled',gen_random_uuid());
  exception when sqlstate '42501' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'non-Manager cannot invoke batch waste');
  update public.profiles set role='manager' where id=v_manager;

  insert into public.menu_categories (id,name,is_active)
  values (v_menu_category,'__VERIFY_6B6B_CATEGORY__',true);
  insert into public.inventory_items (
    id,item_name,unit,quantity_on_hand,reorder_level,is_active,
    quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled
  ) values
    (v_item,'__VERIFY_6B6B_BATCH__','pcs',10,0,true,0,'fifo',true,true),
    (v_other_item,'__VERIFY_6B6B_OTHER__','pcs',1,0,true,0,'fifo',true,true),
    (v_legacy,'__VERIFY_6B6B_LEGACY__','pcs',10,0,true,0,'fifo',false,false);
  insert into public.inventory_opening_balances
    (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload)
  values
    (v_opening,gen_random_uuid(),v_item,v_manager,now(),10,2,'{}'::jsonb),
    (v_other_opening,gen_random_uuid(),v_other_item,v_manager,now(),1,1,'{}'::jsonb);
  insert into public.inventory_batches
    (id,batch_code,inventory_item_id,origin_type,opening_balance_id,
     received_at,use_by_date,quantity_initial,quantity_on_hand)
  values
    (v_batch_a,'__VERIFY-6B6B-A__',v_item,'legacy_opening',v_opening,
     now()-interval '2 days',v_today-1,4,4),
    (v_batch_b,'__VERIFY-6B6B-B__',v_item,'legacy_opening',v_opening,
     now()-interval '1 day',v_today+1,6,6),
    (v_wrong_batch,'__VERIFY-6B6B-WRONG__',v_other_item,'legacy_opening',v_other_opening,
     now(),v_today+1,1,1);

  -- Expired batch A still exists physically and is eligible for disposal.
  perform pg_temp.assert_6b6b(public.inventory_usable_quantity(v_item)=6,
    'expired batch is excluded from sales before disposal');
  v_result := public.record_batch_inventory_waste(v_item,v_batch_a,4,4,'Expired',v_waste_request,
    'Disposed after inspection');
  perform pg_temp.assert_6b6b((select quantity_on_hand=0 from public.inventory_batches where id=v_batch_a),
    'expired batch waste removes the exact physical batch');
  perform pg_temp.assert_6b6b((select quantity_on_hand=6 from public.inventory_items where id=v_item),
    'expired batch waste decrements aggregate equally');
  perform pg_temp.assert_6b6b((select quantity_change=-4 and inventory_batch_id=v_batch_a
    and batch_quantity_before=4 and batch_quantity_after=0
    and batch_mutation_notes='Disposed after inspection'
    from public.inventory_transactions where id=(v_result->>'transaction_id')::uuid),
    'expired batch waste writes a direct batch-linked negative waste ledger');
  perform pg_temp.assert_6b6b(public.inventory_usable_quantity(v_item)=6,
    'disposal of expired stock leaves current usable stock unchanged');

  v_replay := public.record_batch_inventory_waste(v_item,v_batch_a,4,4,'Expired',v_waste_request,
    'Disposed after inspection');
  perform pg_temp.assert_6b6b(v_replay=v_result,
    'same waste request returns identical original result');
  perform pg_temp.assert_6b6b((select count(*)=1 from public.inventory_transactions
    where performed_by=v_manager and mutation_request_id=v_waste_request),
    'same waste request creates only one transaction');
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(v_item,v_batch_a,3,4,'Expired',v_waste_request,
    'Disposed after inspection');
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'conflicting waste request payload is rejected');
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(v_item,v_batch_a,4,4,'Expired',v_waste_request,
    'Different inspection note');
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'conflicting waste notes are rejected on replay');

  -- A new request cannot overdraw the surviving batch or bypass scale.
  v_transaction_count := (select count(*) from public.inventory_transactions where inventory_item_id=v_item);
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(v_item,v_batch_b,7,6,'Spoiled',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'excessive waste is rejected');
  perform pg_temp.assert_6b6b((select quantity_on_hand=6 from public.inventory_batches where id=v_batch_b)
    and (select count(*)=v_transaction_count from public.inventory_transactions where inventory_item_id=v_item),
    'failed excessive waste leaves batch and ledger unchanged');
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(v_item,v_batch_b,1.5,6,'Spoiled',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'fractional scale-zero waste is rejected');
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(v_item,v_wrong_batch,1,1,'Damaged',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'waste rejects a batch belonging to another item');
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(v_item,v_batch_b,1,5,'Spoiled',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'stale displayed batch balance is rejected');

  -- A positive correction preserves the original intake and increases only
  -- the separately audited authorized capacity.
  v_result := public.adjust_inventory_batch_stock(v_item,v_batch_b,2,6,
    'Physical count correction',v_adjust_request,'Verified recount');
  perform pg_temp.assert_6b6b((select quantity_initial=6 and quantity_on_hand=8
    and quantity_positive_adjustments=2 from public.inventory_batches where id=v_batch_b),
    'positive adjustment keeps initial intake and records correction allowance');
  perform pg_temp.assert_6b6b((select quantity_on_hand=8 from public.inventory_items where id=v_item),
    'positive adjustment increases aggregate by the same quantity');
  perform pg_temp.assert_6b6b((select transaction_type='adjustment' and quantity_change=2
    and inventory_batch_id=v_batch_b and batch_quantity_before=6 and batch_quantity_after=8
    and batch_mutation_notes='Verified recount'
    from public.inventory_transactions where id=(v_result->>'transaction_id')::uuid),
    'positive adjustment ledger identifies batch and signed correction');
  v_replay := public.adjust_inventory_batch_stock(v_item,v_batch_b,2,6,
    'Physical count correction',v_adjust_request,'Verified recount');
  perform pg_temp.assert_6b6b(v_replay=v_result,'same adjustment request returns original result');
  v_blocked:=false;
  begin perform public.adjust_inventory_batch_stock(v_item,v_batch_b,1,6,
    'Physical count correction',v_adjust_request,'Verified recount');
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'conflicting adjustment replay is rejected');

  v_result := public.adjust_inventory_batch_stock(v_item,v_batch_b,-3,8,
    'Physical count correction',gen_random_uuid());
  perform pg_temp.assert_6b6b((select quantity_on_hand=5 from public.inventory_batches where id=v_batch_b)
    and (select quantity_on_hand=5 from public.inventory_items where id=v_item),
    'negative adjustment changes batch and aggregate equally');
  perform pg_temp.assert_6b6b((select quantity_change=-3 and transaction_type='adjustment'
    from public.inventory_transactions where id=(v_result->>'transaction_id')::uuid),
    'negative adjustment is a signed adjustment ledger movement');
  v_blocked:=false;
  begin perform public.adjust_inventory_batch_stock(v_item,v_batch_b,-6,5,'Count',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'negative correction cannot overdraw a batch');
  v_blocked:=false;
  begin perform public.adjust_inventory_batch_stock(v_item,v_batch_b,0.5,5,'Count',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'fractional positive correction is rejected for scale zero');
  v_blocked:=false;
  begin perform public.adjust_inventory_batch_stock(v_item,gen_random_uuid(),1,0,'Count',gen_random_uuid());
  exception when sqlstate 'P0002' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'positive adjustment cannot create an unidentified new batch');

  perform public.assert_batch_inventory_consistent(v_item);
  perform pg_temp.assert_6b6b(true,'batch and aggregate remain consistent after waste and corrections');
  update public.inventory_items set quantity_on_hand=6 where id=v_item;
  v_blocked:=false;
  begin perform public.record_batch_inventory_waste(v_item,v_batch_b,1,5,'Spoiled',gen_random_uuid());
  exception when sqlstate '23514' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'waste refuses pre-existing aggregate/batch drift');
  v_blocked:=false;
  begin perform public.adjust_inventory_batch_stock(v_item,v_batch_b,1,5,'Count',gen_random_uuid());
  exception when sqlstate '23514' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'adjustment refuses pre-existing aggregate/batch drift');
  update public.inventory_items set quantity_on_hand=5 where id=v_item;

  -- Legacy aggregate semantics continue without any physical batch.
  perform public.record_inventory_waste(v_legacy,2,'Spoiled',gen_random_uuid());
  perform public.adjust_inventory_stock(v_legacy,1,'Count',gen_random_uuid());
  perform pg_temp.assert_6b6b((select quantity_on_hand=9 from public.inventory_items where id=v_legacy)
    and not exists(select 1 from public.inventory_batches where inventory_item_id=v_legacy),
    'legacy waste and adjustment remain aggregate only');
  v_blocked:=false;
  begin perform public.record_inventory_waste(v_item,1,'Spoiled',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'legacy waste RPC still guards batch-enabled stock');
  v_blocked:=false;
  begin perform public.adjust_inventory_stock(v_item,1,'Count',gen_random_uuid());
  exception when sqlstate '22023' then v_blocked:=true; end;
  perform pg_temp.assert_6b6b(v_blocked,'legacy adjustment RPC still guards batch-enabled stock');

  -- The surviving identified batch remains usable for normal sales.
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active)
  values (v_menu,v_menu_category,'__VERIFY_6B6B_MENU__','V6B01',1,true,true);
  insert into public.menu_ingredients (menu_item_id,inventory_item_id,quantity_required)
  values (v_menu,v_item,1);
  insert into public.orders (id,order_number,order_channel,fulfillment_type,current_status,
    subtotal,delivery_fee,grand_total)
  values (v_order,'__VERIFY-6B6B-SALE__','walk_in','takeout','confirmed',3,0,3);
  insert into public.order_items (order_id,menu_item_id,item_name,quantity,unit_price,line_total)
  values (v_order,v_menu,'__VERIFY_6B6B_MENU__',3,1,3);
  insert into public.order_status_history (order_id,status,changed_by,notes)
  values (v_order,'confirmed',v_manager,'Verifier');
  perform pg_temp.assert_6b6b((select quantity_on_hand=2 from public.inventory_batches where id=v_batch_b)
    and (select quantity_on_hand=2 from public.inventory_items where id=v_item),
    'confirmed sale still consumes batch and aggregate after waste and corrections');
  perform pg_temp.assert_6b6b((select count(*)=1 and sum(allocation.quantity)=3
    from public.inventory_transaction_batch_allocations allocation
    join public.inventory_transactions transaction_record
      on transaction_record.id=allocation.inventory_transaction_id
    where transaction_record.order_id=v_order and allocation.inventory_batch_id=v_batch_b),
    'sale keeps its separate issuance allocation model');
  perform pg_temp.assert_6b6b((select to_jsonb(i)=v_chicken from public.inventory_items i
    where i.item_name='Chicken'), 'historical Chicken remains unchanged');
end
$behavior$;

do $compatibility$
declare
  v_manager uuid;
  v_category uuid := gen_random_uuid();
  v_fifo_item uuid := gen_random_uuid();
  v_fifo_opening uuid := gen_random_uuid();
  v_fifo_a uuid := gen_random_uuid();
  v_fifo_b uuid := gen_random_uuid();
  v_fifo_menu uuid := gen_random_uuid();
  v_fifo_order uuid := gen_random_uuid();
  v_formal_item uuid := gen_random_uuid();
  v_report uuid := gen_random_uuid();
  v_line uuid := gen_random_uuid();
  v_formal_batch uuid;
  v_open_item uuid := gen_random_uuid();
  v_open_request uuid := gen_random_uuid();
  v_open_a uuid;
  v_open_b uuid;
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
begin
  select id into strict v_manager from public.profiles
  where last_name='6B6B Manager';
  perform set_config('request.jwt.claim.sub',v_manager::text,true);
  insert into public.menu_categories (id,name,is_active)
  values (v_category,'__VERIFY_6B6B_COMPAT_CATEGORY__',true);

  -- Waste of a known older batch precedes normal FIFO sale allocation.
  insert into public.inventory_items
    (id,item_name,unit,quantity_on_hand,reorder_level,is_active,
     quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled)
  values (v_fifo_item,'__VERIFY_6B6B_FIFO__','pcs',10,0,true,0,'fifo',true,true);
  insert into public.inventory_opening_balances
    (id,request_id,inventory_item_id,verified_by,verified_at,quantity_total,batch_count,request_payload)
  values (v_fifo_opening,gen_random_uuid(),v_fifo_item,v_manager,now(),10,2,'{}'::jsonb);
  insert into public.inventory_batches
    (id,batch_code,inventory_item_id,origin_type,opening_balance_id,
     received_at,use_by_date,quantity_initial,quantity_on_hand)
  values
    (v_fifo_a,'__VERIFY-6B6B-FIFO-A__',v_fifo_item,'legacy_opening',v_fifo_opening,
     now()-interval '2 days',v_today+1,4,4),
    (v_fifo_b,'__VERIFY-6B6B-FIFO-B__',v_fifo_item,'legacy_opening',v_fifo_opening,
     now()-interval '1 day',v_today+1,6,6);
  perform public.record_batch_inventory_waste(v_fifo_item,v_fifo_a,1,4,'Damaged',gen_random_uuid());
  perform pg_temp.assert_6b6b((select quantity_on_hand=3 from public.inventory_batches where id=v_fifo_a)
    and (select quantity_on_hand=9 from public.inventory_items where id=v_fifo_item),
    'waste of oldest batch leaves three plus six before sale');
  insert into public.menu_items (id,category_id,name,code,price,is_available,is_active)
  values (v_fifo_menu,v_category,'__VERIFY_6B6B_FIFO_MENU__','V6B02',1,true,true);
  insert into public.menu_ingredients (menu_item_id,inventory_item_id,quantity_required)
  values (v_fifo_menu,v_fifo_item,1);
  insert into public.orders
    (id,order_number,order_channel,fulfillment_type,current_status,subtotal,delivery_fee,grand_total)
  values (v_fifo_order,'__VERIFY-6B6B-FIFO-SALE__','walk_in','takeout','confirmed',5,0,5);
  insert into public.order_items
    (order_id,menu_item_id,item_name,quantity,unit_price,line_total)
  values (v_fifo_order,v_fifo_menu,'__VERIFY_6B6B_FIFO_MENU__',5,1,5);
  insert into public.order_status_history (order_id,status,changed_by,notes)
  values (v_fifo_order,'confirmed',v_manager,'Verifier');
  perform pg_temp.assert_6b6b((select quantity_on_hand=0 from public.inventory_batches where id=v_fifo_a)
    and (select quantity_on_hand=4 from public.inventory_batches where id=v_fifo_b)
    and (select quantity_on_hand=4 from public.inventory_items where id=v_fifo_item),
    'FIFO sale after waste consumes three from A and two from B');
  perform pg_temp.assert_6b6b((select count(*)=2 and sum(allocation.quantity)=5
    from public.inventory_transaction_batch_allocations allocation
    join public.inventory_transactions transaction_record
      on transaction_record.id=allocation.inventory_transaction_id
    where transaction_record.order_id=v_fifo_order),
    'waste and sale retain one issuance with two child allocations');

  -- Formal receiving remains normal intake, then an explicit batch is wasted.
  insert into public.inventory_items
    (id,item_name,unit,quantity_on_hand,reorder_level,is_active,
     quantity_scale,rotation_policy,expiry_required,shelf_life_days,batch_consumption_enabled)
  values (v_formal_item,'__VERIFY_6B6B_FORMAL__','pcs',0,0,true,0,'fifo',true,2,true);
  perform public.create_receiving_report_draft(v_report,'production_team',
    'VERIFY-6B6B-FORMAL',null,now(),null,null);
  perform public.save_receiving_report_item(v_report,v_line,v_formal_item,
    null,10,10,null,null,null,null,null,v_today+1,null);
  perform public.post_receiving_report(v_report);
  select id into strict v_formal_batch from public.inventory_batches
  where inventory_item_id=v_formal_item;
  perform public.record_batch_inventory_waste(v_formal_item,v_formal_batch,2,10,
    'Spoiled',gen_random_uuid());
  perform pg_temp.assert_6b6b((select quantity_on_hand=8 from public.inventory_batches
    where id=v_formal_batch)
    and (select quantity_on_hand=8 from public.inventory_items where id=v_formal_item),
    'formal receiving followed by waste leaves batch and aggregate at eight');
  perform pg_temp.assert_6b6b((select count(*)=1 from public.inventory_transactions
    where inventory_item_id=v_formal_item and transaction_type='receiving')
    and (select count(*)=1 from public.inventory_transactions
      where inventory_item_id=v_formal_item and transaction_type='waste'
        and inventory_batch_id=v_formal_batch),
    'formal receiving ledger is retained beside direct batch waste ledger');

  -- One-time opening remains intact; correction targets only its second batch.
  insert into public.inventory_items
    (id,item_name,unit,quantity_on_hand,reorder_level,is_active,
     quantity_scale,rotation_policy,expiry_required,shelf_life_days,batch_consumption_enabled)
  values (v_open_item,'__VERIFY_6B6B_OPENING__','pcs',0,0,true,0,'fifo',true,2,true);
  perform public.initialize_inventory_opening_balance(v_open_item,
    jsonb_build_array(
      jsonb_build_object('quantity',5,'received_at',now()-interval '1 day',
        'use_by_date',v_today,'source_lot_code','VERIFY-A'),
      jsonb_build_object('quantity',5,'received_at',now(),
        'use_by_date',v_today+1,'source_lot_code','VERIFY-B')
    ),'Phase 6B.6B rollback verifier',v_open_request);
  select id into strict v_open_a from public.inventory_batches
  where inventory_item_id=v_open_item and supplier_lot_code='VERIFY-A';
  select id into strict v_open_b from public.inventory_batches
  where inventory_item_id=v_open_item and supplier_lot_code='VERIFY-B';
  perform public.adjust_inventory_batch_stock(v_open_item,v_open_b,2,5,
    'Physical count correction',gen_random_uuid());
  perform pg_temp.assert_6b6b((select quantity_on_hand=5 from public.inventory_batches where id=v_open_a)
    and (select quantity_on_hand=7 and quantity_initial=5 from public.inventory_batches where id=v_open_b)
    and (select quantity_on_hand=12 from public.inventory_items where id=v_open_item),
    'opening-backed correction changes only identified batch and aggregate');
  perform pg_temp.assert_6b6b((select count(*)=1 from public.inventory_transactions
    where inventory_item_id=v_open_item and transaction_type='opening_balance')
    and (select count(*)=1 from public.inventory_transactions
      where inventory_item_id=v_open_item and transaction_type='adjustment'
        and inventory_batch_id=v_open_b),
    'opening balance ledger and adjustment ledger remain distinct');
end
$compatibility$;

do $rollback_verification$
declare v_count integer;
begin
  select count(*) into v_count from phase_6b6b_checks;
  raise exception 'PHASE_6B6B_VERIFICATION_PASSED: % checks; intentional rollback sentinel.',v_count
    using errcode='P6004';
end
$rollback_verification$;
