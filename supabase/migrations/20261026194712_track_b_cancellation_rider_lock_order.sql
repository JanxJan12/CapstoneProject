begin;

-- Local-only Track B correction. No hosted deployment is part of this audit.
create or replace function public.settle_paid_order_cancellation(
  p_order_id uuid,
  p_reason text,
  p_inventory_disposition text,
  p_refund_method public.payment_method,
  p_refund_reference text,
  p_refund_confirmed boolean,
  p_kitchen_not_started_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_sale public.cashier_transactions%rowtype;
  v_shift_status public.cashier_shift_status;
  v_existing public.paid_order_cancellations%rowtype;
  v_issue record;
  v_allocation record;
  v_item public.inventory_items%rowtype;
  v_batch public.inventory_batches%rowtype;
  v_batch_count bigint;
  v_batch_total numeric;
  v_rider_id uuid;
  v_now timestamptz := now();
  v_restored_count integer := 0;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles profile
    where profile.id = v_actor
      and profile.role = 'manager'::public.user_role
      and profile.is_active
  ) then
    raise exception 'Active Manager access is required.' using errcode = '42501';
  end if;

  if p_order_id is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 300
     or p_inventory_disposition is null
     or p_inventory_disposition not in ('restore', 'waste', 'no_return')
     or p_refund_method is null
     or char_length(btrim(coalesce(p_refund_reference, ''))) not between 3 and 100
     or p_refund_confirmed is distinct from true
  then
    raise exception 'Order, reason, disposition, refund method, reference, and completed-refund confirmation are required.'
      using errcode = '22023';
  end if;

  -- Match the Rider transition lock order: active assignment, then order.
  select assignment.rider_id into v_rider_id
  from public.delivery_assignments assignment
  where assignment.order_id = p_order_id
    and assignment.status in (
      'offered'::public.delivery_assignment_status,
      'accepted'::public.delivery_assignment_status
    )
  order by assignment.assigned_at desc, assignment.id desc
  limit 1 for update;

  select orders.* into v_order
  from public.orders orders where orders.id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  select settlement.* into v_existing
  from public.paid_order_cancellations settlement
  where settlement.order_id = p_order_id;
  if found then
    if v_order.current_status <> 'cancelled'::public.order_status then
      raise exception 'Cancellation settlement and order status disagree.'
        using errcode = '23514';
    end if;
    if v_existing.reason = btrim(p_reason)
       and v_existing.inventory_disposition = p_inventory_disposition
       and v_existing.refund_method = p_refund_method
       and v_existing.refund_reference = btrim(p_refund_reference)
    then
      return jsonb_build_object(
        'order_id', v_order.id, 'order_number', v_order.order_number,
        'previous_status', v_existing.previous_status,
        'inventory_disposition', v_existing.inventory_disposition,
        'refund_amount', v_existing.refund_amount,
        'refund_method', v_existing.refund_method,
        'refund_reference', v_existing.refund_reference,
        'processed_at', v_existing.processed_at,
        'already_recorded', true
      );
    end if;
    raise exception 'This paid order already has a different cancellation settlement.'
      using errcode = '23505';
  end if;

  if v_order.current_status not in (
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status,
    'waiting_for_rider'::public.order_status,
    'rider_accepted'::public.order_status
  ) then
    raise exception 'Only a paid order before rider pickup or completion can be settled.'
      using errcode = '22023';
  end if;

  if v_order.current_status = 'confirmed'::public.order_status then
    if exists (
      select 1 from public.order_status_history history
      where history.order_id = p_order_id
        and history.status in (
          'preparing'::public.order_status,
          'ready'::public.order_status,
          'waiting_for_rider'::public.order_status,
          'rider_accepted'::public.order_status,
          'picked_up'::public.order_status,
          'out_for_delivery'::public.order_status
        )
    ) then
      raise exception 'Order history shows preparation or handoff already began.'
        using errcode = '23514';
    end if;
    if p_inventory_disposition <> 'restore' then
      raise exception 'Unstarted preparation requires exact inventory restoration.'
        using errcode = '22023';
    end if;
    if p_kitchen_not_started_confirmed is distinct from true then
      raise exception 'Confirm with Kitchen that preparation has not started before restoring stock.'
        using errcode = '22023';
    end if;
  elsif p_inventory_disposition = 'restore' then
    raise exception 'Food preparation has started; choose waste or no return.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.delivery_assignments assignment
    where assignment.order_id = p_order_id
      and assignment.status in (
        'picked_up'::public.delivery_assignment_status,
        'out_for_delivery'::public.delivery_assignment_status,
        'delivered'::public.delivery_assignment_status
      )
  ) then
    raise exception 'Rider custody has begun; this settlement cannot cancel the order.'
      using errcode = '22023';
  end if;

  select payment.* into v_payment from public.payments payment
  where payment.order_id = p_order_id for update;
  if not found or v_payment.status <> 'verified'::public.payment_status
     or v_payment.amount <> v_order.grand_total or v_payment.amount <= 0
  then
    raise exception 'A single verified full payment matching the order total is required.'
      using errcode = '23514';
  end if;

  select sale.* into v_sale from public.cashier_transactions sale
  where sale.order_id = p_order_id for update;
  if not found or v_sale.status <> 'completed'::public.cashier_transaction_status
     or v_sale.payment_id <> v_payment.id
  then
    raise exception 'A completed cashier sale linked to the verified payment is required.'
      using errcode = '23514';
  end if;

  if p_refund_method <> v_payment.payment_method then
    raise exception 'Refund through the original payment method so cash and GCash balances remain traceable.'
      using errcode = '22023';
  end if;
  if p_refund_method = 'cash'::public.payment_method then
    select shift.status into v_shift_status
    from public.cashier_shifts shift
    where shift.id = v_sale.shift_id for update;
    if v_shift_status is distinct from 'open'::public.cashier_shift_status then
      raise exception 'Cash refund requires the original cashier shift to remain open.'
        using errcode = '22023';
    end if;
  end if;

  -- The original sale issuance is authoritative. Current recipe configuration
  -- may have changed and must never be used to calculate a reversal.
  if p_inventory_disposition = 'restore' then
    for v_issue in
      select transaction_record.*
      from public.inventory_transactions transaction_record
      where transaction_record.order_id = p_order_id
        and transaction_record.transaction_type =
          'issuance'::public.inventory_transaction_type
      order by transaction_record.inventory_item_id, transaction_record.id
    loop
      if v_issue.quantity_change >= 0 then
        raise exception 'Original order issuance is invalid.' using errcode = '23514';
      end if;

      select item.* into v_item from public.inventory_items item
      where item.id = v_issue.inventory_item_id for update;
      if not found then
        raise exception 'Original inventory item is missing.' using errcode = '23514';
      end if;

      select count(*), coalesce(sum(allocation.quantity), 0)
      into v_batch_count, v_batch_total
      from public.inventory_transaction_batch_allocations allocation
      where allocation.inventory_transaction_id = v_issue.id;

      if v_item.batch_consumption_enabled then
        if v_batch_count = 0 or v_batch_total <> -v_issue.quantity_change then
          raise exception 'Original batch allocations do not reconcile.'
            using errcode = '23514';
        end if;
        perform public.assert_batch_inventory_consistent(v_item.id);

        for v_allocation in
          select allocation.*
          from public.inventory_transaction_batch_allocations allocation
          where allocation.inventory_transaction_id = v_issue.id
          order by allocation.inventory_batch_id
        loop
          select batch.* into v_batch from public.inventory_batches batch
          where batch.id = v_allocation.inventory_batch_id for update;
          if not found or v_batch.inventory_item_id <> v_item.id
             or v_batch.quantity_on_hand + v_allocation.quantity >
                v_batch.quantity_initial + v_batch.quantity_positive_adjustments
          then
            raise exception 'Exact batch restoration exceeds authorized physical quantity.'
              using errcode = '23514';
          end if;

          update public.inventory_batches batch
          set quantity_on_hand = batch.quantity_on_hand + v_allocation.quantity
          where batch.id = v_batch.id;
          update public.inventory_items item
          set quantity_on_hand = item.quantity_on_hand + v_allocation.quantity,
              updated_at = v_now
          where item.id = v_item.id;

          insert into public.inventory_transactions (
            inventory_item_id, inventory_batch_id, order_id, performed_by,
            transaction_type, quantity_change, quantity_before, quantity_after,
            reason, created_at, reverses_issuance_id, reverses_allocation_id
          ) values (
            v_item.id, v_batch.id, p_order_id, v_actor,
            'restock'::public.inventory_transaction_type,
            v_allocation.quantity,
            v_item.quantity_on_hand,
            v_item.quantity_on_hand + v_allocation.quantity,
            'Exact batch restoration after paid order cancellation', v_now,
            v_issue.id, v_allocation.id
          );
          v_item.quantity_on_hand := v_item.quantity_on_hand + v_allocation.quantity;
          v_restored_count := v_restored_count + 1;
        end loop;
        perform public.assert_batch_inventory_consistent(v_item.id);
      else
        if v_batch_count <> 0 then
          raise exception 'Legacy issuance unexpectedly has batch allocations.'
            using errcode = '23514';
        end if;
        update public.inventory_items item
        set quantity_on_hand = item.quantity_on_hand - v_issue.quantity_change,
            updated_at = v_now
        where item.id = v_item.id;
        insert into public.inventory_transactions (
          inventory_item_id, order_id, performed_by, transaction_type,
          quantity_change, quantity_before, quantity_after, reason,
          created_at, reverses_issuance_id
        ) values (
          v_item.id, p_order_id, v_actor,
          'restock'::public.inventory_transaction_type,
          -v_issue.quantity_change,
          v_item.quantity_on_hand,
          v_item.quantity_on_hand - v_issue.quantity_change,
          'Aggregate restoration after paid order cancellation', v_now,
          v_issue.id
        );
        v_restored_count := v_restored_count + 1;
      end if;
    end loop;
  end if;



  update public.delivery_assignments assignment
  set status = 'cancelled'::public.delivery_assignment_status,
      updated_at = v_now
  where assignment.order_id = p_order_id
    and assignment.status in (
      'offered'::public.delivery_assignment_status,
      'accepted'::public.delivery_assignment_status
    );

  if v_rider_id is not null then
    update public.riders rider
    set availability_status = 'available'::public.rider_availability_status,
        updated_at = v_now
    where rider.id = v_rider_id
      and not exists (
        select 1 from public.delivery_assignments assignment
        where assignment.rider_id = rider.id
          and assignment.order_id <> p_order_id
          and assignment.status in (
            'accepted'::public.delivery_assignment_status,
            'picked_up'::public.delivery_assignment_status,
            'out_for_delivery'::public.delivery_assignment_status
          )
      );
  end if;

  update public.payments payment
  set status = 'voided'::public.payment_status, updated_at = v_now
  where payment.id = v_payment.id;
  update public.cashier_transactions sale
  set status = 'voided'::public.cashier_transaction_status,
      void_reason = 'Refunded paid order: ' || btrim(p_reason),
      voided_at = v_now
  where sale.id = v_sale.id;
  update public.orders orders
  set current_status = 'cancelled'::public.order_status,
      cancelled_at = v_now
  where orders.id = p_order_id;

  insert into public.paid_order_cancellations (
    order_id, payment_id, cashier_transaction_id, previous_status,
    inventory_disposition, refund_amount, refund_method, refund_reference,
    reason, processed_by, processed_at
  ) values (
    p_order_id, v_payment.id, v_sale.id, v_order.current_status,
    p_inventory_disposition, v_payment.amount, p_refund_method,
    btrim(p_refund_reference), btrim(p_reason), v_actor, v_now
  );

  insert into public.order_status_history (
    order_id, status, changed_by, notes, created_at
  ) values (
    p_order_id, 'cancelled'::public.order_status, v_actor,
    'Paid order refunded; inventory ' || p_inventory_disposition ||
      '; reason: ' || btrim(p_reason), v_now
  );

  return jsonb_build_object(
    'order_id', p_order_id, 'order_number', v_order.order_number,
    'previous_status', v_order.current_status,
    'inventory_disposition', p_inventory_disposition,
    'refund_amount', v_payment.amount,
    'refund_method', p_refund_method,
    'refund_reference', btrim(p_refund_reference),
    'restoration_entries', v_restored_count,
    'processed_at', v_now, 'already_recorded', false
  );
end;
$function$;

commit;
