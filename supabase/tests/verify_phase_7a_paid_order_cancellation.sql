-- Run only with local psql against a disposable local database after Phase 7A.
-- Synthetic business records exist only inside this transaction.
begin;

do $test$
declare
  v_manager uuid := gen_random_uuid();
  v_cashier uuid := gen_random_uuid();
  v_rider uuid := gen_random_uuid();
  v_shift uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_opening uuid := gen_random_uuid();
  v_batch_a uuid := gen_random_uuid();
  v_batch_b uuid := gen_random_uuid();
  v_order_one uuid := gen_random_uuid();
  v_order_two uuid := gen_random_uuid();
  v_order_three uuid := gen_random_uuid();
  v_order_four uuid := gen_random_uuid();
  v_order_five uuid := gen_random_uuid();
  v_payment_one uuid := gen_random_uuid();
  v_payment_two uuid := gen_random_uuid();
  v_payment_three uuid := gen_random_uuid();
  v_payment_four uuid := gen_random_uuid();
  v_payment_five uuid := gen_random_uuid();
  v_issue_one uuid := gen_random_uuid();
  v_issue_two uuid := gen_random_uuid();
  v_result jsonb;
  v_rejected boolean;
begin
  if not (select relrowsecurity from pg_class
          where oid = 'public.paid_order_cancellations'::regclass) then
    raise exception 'Phase 7A settlement table must have RLS enabled';
  end if;
  if has_table_privilege('authenticated', 'public.paid_order_cancellations', 'INSERT')
     or has_table_privilege('anon', 'public.paid_order_cancellations', 'SELECT')
     or has_function_privilege('anon',
       'public.settle_paid_order_cancellation(uuid,text,text,public.payment_method,text,boolean,boolean)',
       'EXECUTE') then
    raise exception 'Phase 7A browser access controls are unsafe';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_manager, '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'verify-7a-manager@example.invalid',
     '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_cashier, '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'verify-7a-cashier@example.invalid',
     '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_rider, '00000000-0000-0000-0000-000000000000',
     'authenticated', 'authenticated', 'verify-7a-rider@example.invalid',
     '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, first_name, role, is_active)
  values (v_manager, 'Verify Manager', 'manager', true),
         (v_cashier, 'Verify Cashier', 'cashier', true),
         (v_rider, 'Verify Rider', 'rider', true)
  on conflict (id) do update
    set role = excluded.role, is_active = excluded.is_active;
  insert into public.cashier_shifts (id, cashier_id, terminal, opening_cash)
  values (v_shift, v_cashier, 'Phase 7A local verifier', 0);
  insert into public.riders (id, approval_status, availability_status)
  values (v_rider, 'approved', 'on_delivery');

  insert into public.inventory_items (
    id, item_name, unit, quantity_on_hand, reorder_level, is_active,
    quantity_scale, rotation_policy, expiry_required, batch_consumption_enabled
  ) values (
    v_item, '__VERIFY_7A_CHICKEN__', 'pcs', 7, 0, true,
    0, 'fifo', true, true
  );
  insert into public.inventory_opening_balances (
    id, request_id, inventory_item_id, verified_by, verified_at,
    quantity_total, batch_count, request_payload
  ) values (
    v_opening, gen_random_uuid(), v_item, v_manager, now(), 15, 2, '{}'::jsonb
  );
  insert into public.inventory_batches (
    id, batch_code, inventory_item_id, origin_type, opening_balance_id,
    received_at, use_by_date, quantity_initial, quantity_on_hand
  ) values
    (v_batch_a, '__VERIFY-7A-BATCH-A__', v_item, 'legacy_opening', v_opening,
     now() - interval '4 days',
     (current_timestamp at time zone 'Asia/Manila')::date - 1, 5, 0),
    (v_batch_b, '__VERIFY-7A-BATCH-B__', v_item, 'legacy_opening', v_opening,
     now() - interval '1 day',
     (current_timestamp at time zone 'Asia/Manila')::date + 2, 10, 7);

  insert into public.orders (
    id, order_number, order_channel, fulfillment_type, current_status,
    subtotal, delivery_fee, grand_total, delivery_address
  ) values
    (v_order_one, '__VERIFY-7A-ORDER-1__', 'walk_in', 'takeout',
     'confirmed', 10, 0, 10, null),
    (v_order_two, '__VERIFY-7A-ORDER-2__', 'walk_in', 'takeout',
     'preparing', 12, 0, 12, null),
    (v_order_three, '__VERIFY-7A-ORDER-3__', 'walk_in', 'delivery',
     'picked_up', 14, 0, 14, 'Synthetic delivery address'),
    (v_order_four, '__VERIFY-7A-ORDER-4__', 'walk_in', 'delivery',
     'rider_accepted', 16, 0, 16, 'Synthetic delivery address');
  insert into public.payments (
    id, order_id, payment_method, amount, status, cash_received,
    verified_by, verified_at
  ) values
    (v_payment_one, v_order_one, 'cash', 10, 'verified', 10, v_cashier, now()),
    (v_payment_two, v_order_two, 'cash', 12, 'verified', 12, v_cashier, now()),
    (v_payment_three, v_order_three, 'cash', 14, 'verified', 14, v_cashier, now()),
    (v_payment_four, v_order_four, 'cash', 16, 'verified', 16, v_cashier, now());
  insert into public.cashier_transactions (
    receipt_number, order_id, payment_id,
    shift_id, cashier_id, request_id
  ) values
    ('V7A-RC1', v_order_one, v_payment_one,
     v_shift, v_cashier, gen_random_uuid()),
    ('V7A-RC2', v_order_two, v_payment_two,
     v_shift, v_cashier, gen_random_uuid()),
    ('V7A-RC3', v_order_three, v_payment_three,
     v_shift, v_cashier, gen_random_uuid()),
    ('V7A-RC4', v_order_four, v_payment_four,
     v_shift, v_cashier, gen_random_uuid());
  insert into public.delivery_assignments (order_id, rider_id, status)
  values (v_order_four, v_rider, 'accepted');

  insert into public.inventory_transactions (
    id, inventory_item_id, order_id, transaction_type,
    quantity_change, quantity_before, quantity_after, reason
  ) values (
    v_issue_one, v_item, v_order_one, 'issuance', -8, 15, 7,
    'Synthetic confirmed order issuance'
  );
  insert into public.inventory_transaction_batch_allocations (
    inventory_transaction_id, inventory_batch_id, quantity
  ) values (v_issue_one, v_batch_a, 5), (v_issue_one, v_batch_b, 3);

  perform set_config('request.jwt.claim.sub', v_cashier::text, true);
  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_one, 'Customer cancelled', 'restore', 'cash',
      'V7A-REFUND-1', true, true
    );
  exception when sqlstate '42501' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Cashier role was allowed to settle'; end if;

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_one, 'Customer cancelled', 'waste', 'cash',
      'V7A-REFUND-1', true, true
    );
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unstarted order accepted waste'; end if;

  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_one, 'Customer cancelled', 'restore', 'cash',
      'V7A-REFUND-1', false, true
    );
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unconfirmed refund was accepted'; end if;

  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_one, 'Customer cancelled', 'restore', 'cash',
      'V7A-REFUND-1', true, false
    );
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unconfirmed kitchen state restored stock'; end if;

  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_one, 'Customer cancelled', 'restore', 'gcash',
      'V7A-REFUND-1', true, true
    );
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Cross-method refund was accepted'; end if;

  v_result := public.settle_paid_order_cancellation(
    v_order_one, 'Customer cancelled', 'restore', 'cash',
    'V7A-REFUND-1', true, true
  );
  if v_result ->> 'inventory_disposition' <> 'restore'
     or (select quantity_on_hand from public.inventory_items where id = v_item) <> 15
     or (select quantity_on_hand from public.inventory_batches where id = v_batch_a) <> 5
     or (select quantity_on_hand from public.inventory_batches where id = v_batch_b) <> 10
     or public.inventory_usable_quantity(v_item) <> 10
     or (select count(*) from public.inventory_transactions
         where reverses_issuance_id = v_issue_one) <> 2
     or (select coalesce(sum(quantity_change), 0) from public.inventory_transactions
         where reverses_issuance_id = v_issue_one) <> 8
     or (select status from public.payments where id = v_payment_one) <> 'voided'
     or (select status from public.cashier_transactions
         where order_id = v_order_one) <> 'voided'
     or (select current_status from public.orders where id = v_order_one) <> 'cancelled'
  then
    raise exception 'Exact multi-batch restoration or financial settlement failed';
  end if;
  perform public.assert_batch_inventory_consistent(v_item);
  if public.get_manager_paid_order_cancellation(v_order_one) ->> 'refund_reference'
       <> 'V7A-REFUND-1' then
    raise exception 'Manager refund audit read is incomplete';
  end if;

  perform set_config('request.jwt.claim.sub', v_cashier::text, true);
  v_rejected := false;
  begin
    perform public.get_manager_paid_order_cancellation(v_order_one);
  exception when sqlstate '42501' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Cashier read Manager refund audit'; end if;
  perform set_config('request.jwt.claim.sub', v_manager::text, true);

  v_result := public.settle_paid_order_cancellation(
    v_order_one, 'Customer cancelled', 'restore', 'cash',
    'V7A-REFUND-1', true, true
  );
  if v_result ->> 'already_recorded' <> 'true'
     or (select count(*) from public.inventory_transactions
         where reverses_issuance_id = v_issue_one) <> 2
  then
    raise exception 'Settlement replay duplicated inventory';
  end if;

  -- Prepared food stays consumed, whether the Manager records waste or no return.
  update public.inventory_items set quantity_on_hand = 13 where id = v_item;
  update public.inventory_batches set quantity_on_hand = 8 where id = v_batch_b;
  insert into public.inventory_transactions (
    id, inventory_item_id, order_id, transaction_type,
    quantity_change, quantity_before, quantity_after, reason
  ) values (
    v_issue_two, v_item, v_order_two, 'issuance', -2, 15, 13,
    'Synthetic preparing order issuance'
  );
  insert into public.inventory_transaction_batch_allocations (
    inventory_transaction_id, inventory_batch_id, quantity
  ) values (v_issue_two, v_batch_b, 2);

  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_two, 'Customer cancelled', 'restore', 'cash',
      'V7A-REFUND-2', true, false
    );
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Prepared order restored stock'; end if;

  perform public.settle_paid_order_cancellation(
    v_order_two, 'Customer cancelled', 'waste', 'cash',
    'V7A-REFUND-2', true, false
  );
  if (select quantity_on_hand from public.inventory_items where id = v_item) <> 13
     or (select count(*) from public.inventory_transactions
         where reverses_issuance_id = v_issue_two) <> 0
     or (select inventory_disposition from public.paid_order_cancellations
         where order_id = v_order_two) <> 'waste'
  then
    raise exception 'Prepared-food waste disposition changed inventory';
  end if;

  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_three, 'Customer cancelled', 'no_return', 'cash',
      'V7A-REFUND-3', true, false
    );
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Picked-up order was cancelled'; end if;

  perform public.settle_paid_order_cancellation(
    v_order_four, 'Customer cancelled', 'no_return', 'cash',
    'V7A-REFUND-4', true, false
  );
  if (select status from public.delivery_assignments
      where order_id = v_order_four) <> 'cancelled'
     or (select availability_status from public.riders
         where id = v_rider) <> 'available'
     or (select inventory_disposition from public.paid_order_cancellations
         where order_id = v_order_four) <> 'no_return'
     or (select quantity_on_hand from public.inventory_items
         where id = v_item) <> 13
  then
    raise exception 'Accepted rider or no-return settlement was inconsistent';
  end if;

  -- A historical cash shift cannot be silently rewritten by a later refund.
  update public.orders set current_status = 'confirmed'
  where id = v_order_three;
  insert into public.order_status_history (order_id, status, notes)
  values (v_order_three, 'preparing', 'Synthetic earlier kitchen start');
  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_three, 'Customer cancelled', 'restore', 'cash',
      'V7A-REFUND-3', true, true
    );
  exception when sqlstate '23514' then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Earlier kitchen history was ignored'; end if;
  delete from public.order_status_history
  where order_id = v_order_three and status = 'preparing';

  update public.cashier_shifts
  set status = 'closed', ended_at = now(), actual_cash = 0,
      expected_cash = 0, variance = 0, closed_by = v_cashier
  where id = v_shift;
  v_rejected := false;
  begin
    perform public.settle_paid_order_cancellation(
      v_order_three, 'Customer cancelled', 'restore', 'cash',
      'V7A-REFUND-3', true, true
    );
  exception when sqlstate '22023' then v_rejected := true;
  end;
  if not v_rejected
     or exists (select 1 from public.paid_order_cancellations
                where order_id = v_order_three)
  then
    raise exception 'Closed-shift cash refund was accepted';
  end if;

  -- A GCash refund is external to the drawer and may be recorded later.
  insert into public.orders (
    id, order_number, order_channel, fulfillment_type, current_status,
    subtotal, delivery_fee, grand_total, delivery_address
  ) values (
    v_order_five, '__VERIFY-7A-ORDER-5__', 'online', 'delivery',
    'confirmed', 18, 0, 18, 'Synthetic delivery address'
  );
  insert into public.payments (
    id, order_id, payment_method, amount, status,
    gcash_reference_number, verified_by, verified_at
  ) values (
    v_payment_five, v_order_five, 'gcash', 18, 'verified',
    'V7A-ORIGINAL-GCASH-5', v_cashier, now()
  );
  insert into public.cashier_transactions (
    receipt_number, order_id, payment_id,
    shift_id, cashier_id, request_id
  ) values (
    'V7A-RC5', v_order_five, v_payment_five,
    v_shift, v_cashier, gen_random_uuid()
  );
  perform public.settle_paid_order_cancellation(
    v_order_five, 'Customer cancelled', 'restore', 'gcash',
    'V7A-GCASH-REFUND-5', true, true
  );
  if (select refund_method from public.paid_order_cancellations
      where order_id = v_order_five) <> 'gcash'
     or (select status from public.payments where id = v_payment_five) <> 'voided'
  then
    raise exception 'Confirmed GCash refund after shift closure failed';
  end if;

  raise notice 'Phase 7A synthetic cancellation checks passed; transaction will roll back.';
end;
$test$;

rollback;
