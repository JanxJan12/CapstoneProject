begin;

-- ============================================================
-- BACKEND HARDENING BATCH 3
-- Replay-safe lifecycle transitions.
--
-- A caller must now state the status it expects to transition
-- FROM. A repeated/stale request cannot advance a second stage.
-- ============================================================


-- ============================================================
-- KDS
-- Old signature:
--   advance_kds_order(uuid, text, uuid)
--
-- New signature:
--   advance_kds_order(uuid, text, uuid, order_status)
-- ============================================================

drop function if exists public.advance_kds_order(uuid, text, uuid);

create function public.advance_kds_order(
  p_terminal_id uuid,
  p_terminal_secret text,
  p_order_id uuid,
  p_expected_status public.order_status
)
returns table(
  order_id uuid,
  order_number character varying,
  previous_status public.order_status,
  current_status public.order_status
)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_secret text;
  v_secret_hash text;

  v_order_number varchar;
  v_previous_status public.order_status;
  v_next_status public.order_status;
begin
  -- ------------------------------------------------------------
  -- VERIFY KDS CREDENTIAL
  -- ------------------------------------------------------------

  v_secret := trim(p_terminal_secret);

  if p_terminal_id is null
     or v_secret is null
     or v_secret = '' then
    raise exception
      'Invalid kitchen terminal credential.';
  end if;

  v_secret_hash :=
    encode(
      extensions.digest(
        v_secret,
        'sha256'
      ),
      'hex'
    );

  if not exists (
    select 1
    from public.kds_terminals kt
    where kt.id = p_terminal_id
      and kt.is_active = true
      and kt.secret_hash = v_secret_hash
  ) then
    raise exception
      'Invalid or inactive kitchen terminal credential.';
  end if;


  -- ------------------------------------------------------------
  -- VALIDATE REQUESTED TRANSITION SOURCE
  -- ------------------------------------------------------------

  if p_expected_status is null
     or p_expected_status not in (
       'confirmed'::public.order_status,
       'preparing'::public.order_status
     )
  then
    raise exception
      'Invalid expected kitchen order status.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK + LOAD ORDER
  -- ------------------------------------------------------------

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
    raise exception 'Order not found.';
  end if;


  -- ------------------------------------------------------------
  -- REPLAY / STALE REQUEST PROTECTION
  -- ------------------------------------------------------------

  if v_previous_status <> p_expected_status then
    raise exception
      'Kitchen transition rejected because the order status has changed. Expected %, current %.',
      p_expected_status,
      v_previous_status;
  end if;


  -- ------------------------------------------------------------
  -- DETERMINE EXACT NEXT STATE
  -- ------------------------------------------------------------

  case p_expected_status
    when 'confirmed'::public.order_status then
      v_next_status :=
        'preparing'::public.order_status;

    when 'preparing'::public.order_status then
      v_next_status :=
        'ready'::public.order_status;

    else
      raise exception
        'This order cannot be advanced by the kitchen from status %.',
        p_expected_status;
  end case;


  -- ------------------------------------------------------------
  -- UPDATE ORDER
  -- ------------------------------------------------------------

  update public.orders
  set current_status = v_next_status
  where id = p_order_id;


  -- ------------------------------------------------------------
  -- RECORD AUDIT HISTORY
  -- ------------------------------------------------------------

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    p_order_id,
    v_next_status,
    null,
    case v_next_status
      when 'preparing'::public.order_status
        then 'Kitchen started preparation'
      when 'ready'::public.order_status
        then 'Kitchen marked order ready'
    end
  );


  -- ------------------------------------------------------------
  -- RECORD TERMINAL ACTIVITY
  -- ------------------------------------------------------------

  update public.kds_terminals
  set last_used_at = now()
  where id = p_terminal_id;


  return query
  select
    p_order_id,
    v_order_number,
    v_previous_status,
    v_next_status;
end;
$function$;


-- KDS intentionally supports anonymous terminal-secret auth.
revoke execute
on function public.advance_kds_order(
  uuid,
  text,
  uuid,
  public.order_status
)
from public;

grant execute
on function public.advance_kds_order(
  uuid,
  text,
  uuid,
  public.order_status
)
to anon, authenticated, service_role;



-- ============================================================
-- RIDER
-- Old signature:
--   advance_rider_delivery(uuid)
--
-- New signature:
--   advance_rider_delivery(uuid, delivery_assignment_status)
-- ============================================================

drop function if exists public.advance_rider_delivery(uuid);

create function public.advance_rider_delivery(
  p_assignment_id uuid,
  p_expected_assignment_status public.delivery_assignment_status
)
returns table(
  assignment_id uuid,
  order_id uuid,
  assignment_status public.delivery_assignment_status,
  order_status public.order_status
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_rider_id uuid;

  v_order_id uuid;
  v_rider_assignment_id uuid;
  v_assignment_status public.delivery_assignment_status;

  v_order_status public.order_status;

  v_next_assignment_status public.delivery_assignment_status;
  v_next_order_status public.order_status;
  v_history_note text;
begin
  v_rider_id := auth.uid();

  if v_rider_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.riders r
      on r.id = p.id
    where p.id = v_rider_id
      and p.is_active = true
      and p.role = 'rider'::public.user_role
      and r.approval_status =
        'approved'::public.rider_approval_status
  ) then
    raise exception
      'Only an active approved rider may update a delivery.';
  end if;


  -- ------------------------------------------------------------
  -- VALIDATE REQUESTED TRANSITION SOURCE
  -- ------------------------------------------------------------

  if p_expected_assignment_status is null
     or p_expected_assignment_status not in (
       'accepted'::public.delivery_assignment_status,
       'picked_up'::public.delivery_assignment_status
     )
  then
    raise exception
      'Invalid expected delivery status.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK ASSIGNMENT
  -- ------------------------------------------------------------

  select
    da.order_id,
    da.rider_id,
    da.status
  into
    v_order_id,
    v_rider_assignment_id,
    v_assignment_status
  from public.delivery_assignments da
  where da.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Delivery assignment not found.';
  end if;

  if v_rider_assignment_id <> v_rider_id then
    raise exception
      'This delivery assignment does not belong to you.';
  end if;


  -- ------------------------------------------------------------
  -- REPLAY / STALE REQUEST PROTECTION
  -- ------------------------------------------------------------

  if v_assignment_status <> p_expected_assignment_status then
    raise exception
      'Delivery transition rejected because the assignment status has changed. Expected %, current %.',
      p_expected_assignment_status,
      v_assignment_status;
  end if;


  -- ------------------------------------------------------------
  -- LOCK ORDER
  -- ------------------------------------------------------------

  select
    o.current_status
  into
    v_order_status
  from public.orders o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;


  -- ------------------------------------------------------------
  -- EXACT TRANSITION
  -- ------------------------------------------------------------

  if p_expected_assignment_status =
    'accepted'::public.delivery_assignment_status
  then
    if v_order_status <>
      'rider_accepted'::public.order_status
    then
      raise exception
        'Order and rider assignment statuses do not match.';
    end if;

    v_next_assignment_status :=
      'picked_up'::public.delivery_assignment_status;

    v_next_order_status :=
      'picked_up'::public.order_status;

    v_history_note :=
      'Rider picked up the order';

  elsif p_expected_assignment_status =
    'picked_up'::public.delivery_assignment_status
  then
    if v_order_status <>
      'picked_up'::public.order_status
    then
      raise exception
        'Order and rider assignment statuses do not match.';
    end if;

    v_next_assignment_status :=
      'out_for_delivery'::public.delivery_assignment_status;

    v_next_order_status :=
      'out_for_delivery'::public.order_status;

    v_history_note :=
      'Rider started delivery';

  else
    raise exception
      'This delivery cannot be advanced from its expected status.';
  end if;


  -- ------------------------------------------------------------
  -- UPDATE ASSIGNMENT
  -- ------------------------------------------------------------

  update public.delivery_assignments
  set
    status = v_next_assignment_status,

    picked_up_at =
      case
        when v_next_assignment_status =
          'picked_up'::public.delivery_assignment_status
        then now()
        else picked_up_at
      end,

    out_for_delivery_at =
      case
        when v_next_assignment_status =
          'out_for_delivery'::public.delivery_assignment_status
        then now()
        else out_for_delivery_at
      end,

    updated_at = now()

  where id = p_assignment_id;


  -- ------------------------------------------------------------
  -- UPDATE ORDER
  -- ------------------------------------------------------------

  update public.orders
  set
    current_status = v_next_order_status
  where id = v_order_id;


  -- ------------------------------------------------------------
  -- AUDIT TRAIL
  -- ------------------------------------------------------------

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    v_order_id,
    v_next_order_status,
    v_rider_id,
    v_history_note
  );


  return query
  select
    p_assignment_id,
    v_order_id,
    v_next_assignment_status,
    v_next_order_status;
end;
$function$;


revoke execute
on function public.advance_rider_delivery(
  uuid,
  public.delivery_assignment_status
)
from public, anon;

grant execute
on function public.advance_rider_delivery(
  uuid,
  public.delivery_assignment_status
)
to authenticated, service_role;

commit;