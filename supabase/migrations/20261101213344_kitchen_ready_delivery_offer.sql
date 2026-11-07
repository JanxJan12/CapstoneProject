-- Keep the existing fairness rule in one private implementation. Public callers
-- still enter through the staff-authorized offer_order_to_next_rider RPC.
create schema if not exists rrj_internal;
revoke all on schema rrj_internal from public, anon, authenticated;

create function rrj_internal.offer_order_to_next_rider(p_order_id uuid)
returns table(assignment_id uuid, order_id uuid, order_number varchar,
  rider_id uuid, assignment_status public.delivery_assignment_status,
  assigned_at timestamptz)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_order_number varchar;
  v_order_status public.order_status;
  v_fulfillment_type public.fulfillment_type;
  v_rider_id uuid;
  v_assignment_id uuid;
  v_assigned_at timestamptz;
begin
  select o.order_number, o.current_status, o.fulfillment_type
    into v_order_number, v_order_status, v_fulfillment_type
  from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_fulfillment_type <> 'delivery'::public.fulfillment_type then
    raise exception 'Only delivery orders may be assigned to riders.';
  end if;
  if v_order_status <> 'waiting_for_rider'::public.order_status then
    raise exception 'Order must be waiting for a rider before assignment.';
  end if;
  if exists (
    select 1 from public.delivery_assignments da
    where da.order_id = p_order_id and da.status in (
      'offered'::public.delivery_assignment_status,
      'accepted'::public.delivery_assignment_status,
      'picked_up'::public.delivery_assignment_status,
      'out_for_delivery'::public.delivery_assignment_status)
  ) then
    raise exception 'This order already has an active rider assignment.';
  end if;

  select r.id into v_rider_id
  from public.riders r join public.profiles p on p.id = r.id
  where p.role = 'rider'::public.user_role and p.is_active = true
    and r.approval_status = 'approved'::public.rider_approval_status
    and r.availability_status = 'available'::public.rider_availability_status
    and not exists (
      select 1 from public.delivery_assignments active_assignment
      where active_assignment.rider_id = r.id and active_assignment.status in (
        'offered'::public.delivery_assignment_status,
        'accepted'::public.delivery_assignment_status,
        'picked_up'::public.delivery_assignment_status,
        'out_for_delivery'::public.delivery_assignment_status)
    )
    and not exists (
      select 1 from public.delivery_assignments rejected_assignment
      where rejected_assignment.order_id = p_order_id
        and rejected_assignment.rider_id = r.id
        and rejected_assignment.status = 'rejected'::public.delivery_assignment_status)
  order by r.last_assigned_at asc nulls first, r.created_at asc, r.id
  limit 1 for update of r skip locked;

  -- A missing eligible rider is a recoverable Kitchen Ready state. The public
  -- staff RPC below preserves its previous error contract in this case.
  if v_rider_id is null then return; end if;

  insert into public.delivery_assignments
    (order_id, rider_id, assignment_method, status)
  values (p_order_id, v_rider_id, 'fairness_rule'::public.assignment_method,
    'offered'::public.delivery_assignment_status)
  returning id, delivery_assignments.assigned_at
    into v_assignment_id, v_assigned_at;

  update public.riders set last_assigned_at = v_assigned_at, updated_at = now()
  where id = v_rider_id;

  return query select v_assignment_id, p_order_id, v_order_number, v_rider_id,
    'offered'::public.delivery_assignment_status, v_assigned_at;
end;
$$;

revoke all on function rrj_internal.offer_order_to_next_rider(uuid)
  from public, anon, authenticated;

create or replace function public.offer_order_to_next_rider(p_order_id uuid)
returns table(assignment_id uuid, order_id uuid, order_number varchar,
  rider_id uuid, assignment_status public.delivery_assignment_status,
  assigned_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_staff_id uuid := auth.uid();
begin
  if v_staff_id is null then raise exception 'Authentication is required.'; end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_staff_id
      and p.is_active = true
      and p.role in ('cashier'::public.user_role, 'manager'::public.user_role)
  ) then
    raise exception 'Only an active cashier or manager may assign a rider.';
  end if;
  return query select * from rrj_internal.offer_order_to_next_rider(p_order_id);
  if not found then
    raise exception 'No approved and available rider is currently eligible.';
  end if;
end;
$$;
revoke all on function public.offer_order_to_next_rider(uuid) from public;
grant execute on function public.offer_order_to_next_rider(uuid) to authenticated, service_role;

create or replace function public.advance_kds_order(
  p_terminal_id uuid, p_terminal_secret text, p_order_id uuid,
  p_expected_status public.order_status)
returns table(order_id uuid, order_number varchar,
  previous_status public.order_status, current_status public.order_status)
language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  v_secret text := trim(p_terminal_secret);
  v_order_number varchar;
  v_previous_status public.order_status;
  v_next_status public.order_status;
  v_fulfillment_type public.fulfillment_type;
  v_order_channel public.order_channel;
  v_grand_total numeric;
  v_offer_id uuid;
begin
  if p_terminal_id is null or v_secret is null or v_secret = ''
    or not exists (
      select 1 from public.kds_terminals kt where kt.id = p_terminal_id
        and kt.is_active = true
        and kt.secret_hash = encode(extensions.digest(v_secret, 'sha256'), 'hex')
    ) then
    raise exception 'Invalid or inactive kitchen terminal credential.';
  end if;
  if p_expected_status is null or p_expected_status not in (
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status) then
    raise exception 'Invalid expected kitchen order status.';
  end if;

  select o.order_number, o.current_status, o.fulfillment_type,
      o.order_channel, o.grand_total
    into v_order_number, v_previous_status, v_fulfillment_type,
      v_order_channel, v_grand_total
  from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_previous_status <> p_expected_status then
    raise exception
      'Kitchen transition rejected because the order status has changed. Expected %, current %.',
      p_expected_status, v_previous_status;
  end if;

  if p_expected_status = 'confirmed'::public.order_status then
    v_next_status := 'preparing'::public.order_status;
  elsif p_expected_status = 'preparing'::public.order_status then
    v_next_status := 'ready'::public.order_status;
  elsif v_fulfillment_type = 'delivery'::public.fulfillment_type
    and v_order_channel = 'online'::public.order_channel then
    v_next_status := 'ready'::public.order_status; -- explicit retry
  else
    raise exception 'Only a ready online delivery may retry a rider offer.';
  end if;

  if v_next_status = 'ready'::public.order_status
    and v_fulfillment_type = 'delivery'::public.fulfillment_type
    and v_order_channel = 'online'::public.order_channel then
    if not exists (
      select 1 from public.payments p where p.order_id = p_order_id
        and p.payment_method = 'gcash'::public.payment_method
        and p.status = 'verified'::public.payment_status
        and p.amount = v_grand_total
    ) then
      raise exception 'A verified full GCash payment is required for automatic delivery handoff.';
    end if;
  end if;

  if p_expected_status <> 'ready'::public.order_status then
    update public.orders set current_status = v_next_status where id = p_order_id;
    insert into public.order_status_history (order_id, status, changed_by, notes)
    values (p_order_id, v_next_status, null,
      case v_next_status
        when 'preparing'::public.order_status then 'Kitchen started preparation'
        else 'Kitchen marked order ready' end);
  end if;

  if v_next_status = 'ready'::public.order_status
    and v_fulfillment_type = 'delivery'::public.fulfillment_type
    and v_order_channel = 'online'::public.order_channel then
    update public.orders set current_status = 'waiting_for_rider'::public.order_status
    where id = p_order_id;
    select offer.assignment_id into v_offer_id
    from rrj_internal.offer_order_to_next_rider(p_order_id) offer;
    if v_offer_id is null then
      update public.orders set current_status = 'ready'::public.order_status
      where id = p_order_id;
    else
      v_next_status := 'waiting_for_rider'::public.order_status;
      insert into public.order_status_history (order_id, status, changed_by, notes)
      values (p_order_id, v_next_status, null,
        'Kitchen automatically offered ready delivery to a rider');
    end if;
  end if;

  update public.kds_terminals set last_used_at = now() where id = p_terminal_id;
  return query select p_order_id, v_order_number, v_previous_status, v_next_status;
end;
$$;
revoke all on function public.advance_kds_order(uuid,text,uuid,public.order_status)
  from public;
grant execute on function public.advance_kds_order(uuid,text,uuid,public.order_status)
  to anon, authenticated, service_role;
