-- RRJ'S FOOD-HOUSE
-- Harden ordinary order cancellation against financial inconsistency.
--
-- Ordinary cancellation is only for orders with no unresolved/confirmed
-- financial activity.
--
-- Allowed:
--   - no payment
--   - rejected payment
--
-- Blocked:
--   - pending payment
--   - verified payment
--   - any cashier transaction
--
-- Paid sales must eventually go through a dedicated void/refund workflow.

create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text
)
returns table (
  order_id uuid,
  order_number varchar,
  previous_status public.order_status,
  current_status public.order_status,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_id uuid;
  v_order_number varchar;
  v_previous_status public.order_status;
  v_cancelled_at timestamptz;
  v_rider_id uuid;
  v_payment_status public.payment_status;
begin
  -- ============================================================
  -- 1. AUTHORIZATION
  -- ============================================================

  v_staff_id := auth.uid();

  if v_staff_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_staff_id
      and p.is_active = true
      and p.role in (
        'cashier'::public.user_role,
        'manager'::public.user_role
      )
  ) then
    raise exception
      'Only an active cashier or manager may cancel an order.'
      using errcode = '42501';
  end if;


  -- ============================================================
  -- 2. VALIDATE INPUT
  -- ============================================================

  if p_order_id is null then
    raise exception 'Order is required.'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A cancellation reason is required.'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_reason)) > 300 then
    raise exception
      'Cancellation reason must not exceed 300 characters.'
      using errcode = '22023';
  end if;


  -- ============================================================
  -- 3. LOCK ORDER
  -- ============================================================

  select
    o.order_number,
    o.current_status
  into
    v_order_number,
    v_previous_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.'
      using errcode = 'P0002';
  end if;


  -- ============================================================
  -- 4. OPERATIONAL STATUS GUARDS
  -- ============================================================

  if v_previous_status in (
    'cancelled'::public.order_status,
    'rejected'::public.order_status,
    'completed'::public.order_status,
    'delivered'::public.order_status
  ) then
    raise exception
      'This order can no longer be cancelled.'
      using errcode = '22023';
  end if;

  if v_previous_status in (
    'picked_up'::public.order_status,
    'out_for_delivery'::public.order_status
  ) then
    raise exception
      'An order cannot be cancelled after rider pickup.'
      using errcode = '22023';
  end if;


  -- ============================================================
  -- 5. FINANCIAL GUARDS
  -- ============================================================

  -- Any cashier transaction means a financial sale already exists.
  -- Ordinary cancellation must never alter or hide that transaction.
  if exists (
    select 1
    from public.cashier_transactions ct
    where ct.order_id = p_order_id
  ) then
    raise exception
      'This order already has a financial transaction. Use the void or refund workflow instead of ordinary cancellation.'
      using errcode = '22023';
  end if;

  select p.status
  into v_payment_status
  from public.payments p
  where p.order_id = p_order_id
  limit 1;

  if v_payment_status = 'verified'::public.payment_status then
    raise exception
      'This order has a verified payment. Use the void or refund workflow instead of ordinary cancellation.'
      using errcode = '22023';
  end if;

  if v_payment_status = 'pending'::public.payment_status then
    raise exception
      'This order has a pending payment. Resolve or reject the payment before cancelling the order.'
      using errcode = '22023';
  end if;

  -- A rejected payment is unpaid and may proceed through ordinary
  -- operational cancellation.


  -- ============================================================
  -- 6. FIND ACTIVE RIDER ASSIGNMENT
  -- ============================================================

  select da.rider_id
  into v_rider_id
  from public.delivery_assignments da
  where da.order_id = p_order_id
    and da.status in (
      'offered'::public.delivery_assignment_status,
      'accepted'::public.delivery_assignment_status
    )
  order by da.assigned_at desc
  limit 1
  for update;


  -- ============================================================
  -- 7. CANCEL ACTIVE RIDER OFFER / ACCEPTANCE
  -- ============================================================

  update public.delivery_assignments da
  set
    status = 'cancelled'::public.delivery_assignment_status,
    updated_at = now()
  where da.order_id = p_order_id
    and da.status in (
      'offered'::public.delivery_assignment_status,
      'accepted'::public.delivery_assignment_status
    );


  -- ============================================================
  -- 8. RELEASE RIDER WHEN APPROPRIATE
  -- ============================================================

  if v_rider_id is not null then
    update public.riders r
    set
      availability_status =
        'available'::public.rider_availability_status,
      updated_at = now()
    where r.id = v_rider_id
      and not exists (
        select 1
        from public.delivery_assignments da
        where da.rider_id = r.id
          and da.order_id <> p_order_id
          and da.status in (
            'accepted'::public.delivery_assignment_status,
            'picked_up'::public.delivery_assignment_status,
            'out_for_delivery'::public.delivery_assignment_status
          )
      );
  end if;


  -- ============================================================
  -- 9. CANCEL ORDER
  -- ============================================================

  v_cancelled_at := now();

  update public.orders o
  set
    current_status = 'cancelled'::public.order_status,
    cancelled_at = v_cancelled_at
  where o.id = p_order_id;


  -- ============================================================
  -- 10. AUDIT HISTORY
  -- ============================================================

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    p_order_id,
    'cancelled'::public.order_status,
    v_staff_id,
    'Order cancelled: ' || btrim(p_reason)
  );


  -- ============================================================
  -- 11. AUTHORITATIVE RESULT
  -- ============================================================

  return query
  select
    p_order_id,
    v_order_number,
    v_previous_status,
    'cancelled'::public.order_status,
    v_cancelled_at;
end;
$$;


revoke all on function public.cancel_order(uuid, text)
from public;

grant execute on function public.cancel_order(uuid, text)
to authenticated, service_role;