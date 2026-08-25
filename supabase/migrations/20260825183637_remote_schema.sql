


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."assignment_method" AS ENUM (
    'fairness_rule',
    'manual'
);


ALTER TYPE "public"."assignment_method" OWNER TO "postgres";


CREATE TYPE "public"."cashier_shift_status" AS ENUM (
    'open',
    'closed'
);


ALTER TYPE "public"."cashier_shift_status" OWNER TO "postgres";


CREATE TYPE "public"."cashier_transaction_status" AS ENUM (
    'completed',
    'voided'
);


ALTER TYPE "public"."cashier_transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."delivery_assignment_status" AS ENUM (
    'offered',
    'accepted',
    'rejected',
    'picked_up',
    'out_for_delivery',
    'delivered',
    'cancelled'
);


ALTER TYPE "public"."delivery_assignment_status" OWNER TO "postgres";


CREATE TYPE "public"."fulfillment_type" AS ENUM (
    'delivery',
    'takeout',
    'dine_in'
);


ALTER TYPE "public"."fulfillment_type" OWNER TO "postgres";


CREATE TYPE "public"."inventory_transaction_type" AS ENUM (
    'receiving',
    'issuance',
    'restock',
    'waste',
    'adjustment'
);


ALTER TYPE "public"."inventory_transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."modifier_selection_type" AS ENUM (
    'single',
    'multiple'
);


ALTER TYPE "public"."modifier_selection_type" OWNER TO "postgres";


CREATE TYPE "public"."order_channel" AS ENUM (
    'online',
    'walk_in'
);


ALTER TYPE "public"."order_channel" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'waiting_payment_verification',
    'confirmed',
    'preparing',
    'ready',
    'waiting_for_rider',
    'rider_accepted',
    'picked_up',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled',
    'rejected'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'gcash',
    'cash'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'verified',
    'rejected',
    'voided'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."purchase_order_status" AS ENUM (
    'draft',
    'submitted',
    'partially_received',
    'received',
    'cancelled'
);


ALTER TYPE "public"."purchase_order_status" OWNER TO "postgres";


CREATE TYPE "public"."rider_approval_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'suspended'
);


ALTER TYPE "public"."rider_approval_status" OWNER TO "postgres";


CREATE TYPE "public"."rider_availability_status" AS ENUM (
    'available',
    'on_delivery',
    'offline'
);


ALTER TYPE "public"."rider_availability_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'customer',
    'cashier',
    'manager',
    'rider'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_rider_offer"("p_assignment_id" "uuid") RETURNS TABLE("assignment_id" "uuid", "order_id" "uuid", "order_number" character varying, "assignment_status" "public"."delivery_assignment_status", "order_status" "public"."order_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_rider_id uuid;
  v_rider_availability public.rider_availability_status;

  v_assignment_order_id uuid;
  v_assignment_rider_id uuid;
  v_assignment_status public.delivery_assignment_status;

  v_order_number varchar;
  v_order_status public.order_status;
begin
  -- ------------------------------------------------------------
  -- REQUIRE AUTHENTICATED RIDER
  -- ------------------------------------------------------------

  v_rider_id := auth.uid();

  if v_rider_id is null then
    raise exception 'Authentication is required.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK + VALIDATE RIDER
  -- ------------------------------------------------------------

  select
    r.availability_status
  into
    v_rider_availability
  from public.riders r

  join public.profiles p
    on p.id = r.id

  where r.id = v_rider_id
    and p.is_active = true
    and p.role = 'rider'::public.user_role
    and r.approval_status =
      'approved'::public.rider_approval_status

  for update of r;

  if not found then
    raise exception
      'Only an active approved rider may accept a delivery.';
  end if;


  if v_rider_availability <>
    'available'::public.rider_availability_status
  then
    raise exception
      'You must be available to accept a delivery.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK + LOAD ASSIGNMENT
  -- ------------------------------------------------------------

  select
    da.order_id,
    da.rider_id,
    da.status
  into
    v_assignment_order_id,
    v_assignment_rider_id,
    v_assignment_status
  from public.delivery_assignments da
  where da.id = p_assignment_id
  for update;

  if not found then
    raise exception
      'Delivery assignment not found.';
  end if;


  -- ------------------------------------------------------------
  -- MUST BELONG TO THIS RIDER
  -- ------------------------------------------------------------

  if v_assignment_rider_id <> v_rider_id then
    raise exception
      'This delivery offer does not belong to you.';
  end if;

  if v_assignment_status <>
    'offered'::public.delivery_assignment_status
  then
    raise exception
      'This delivery offer is no longer available.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK + VALIDATE ORDER
  -- ------------------------------------------------------------

  select
    o.order_number,
    o.current_status
  into
    v_order_number,
    v_order_status
  from public.orders o
  where o.id = v_assignment_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order_status <>
    'waiting_for_rider'::public.order_status
  then
    raise exception
      'The order is no longer waiting for a rider.';
  end if;


  -- ------------------------------------------------------------
  -- RIDER MUST NOT HAVE ANOTHER ACTIVE DELIVERY
  -- ------------------------------------------------------------

  if exists (
    select 1
    from public.delivery_assignments da
    where da.rider_id = v_rider_id
      and da.id <> p_assignment_id
      and da.status in (
        'accepted'::public.delivery_assignment_status,
        'picked_up'::public.delivery_assignment_status,
        'out_for_delivery'::public.delivery_assignment_status
      )
  ) then
    raise exception
      'You already have an active delivery.';
  end if;


  -- ------------------------------------------------------------
  -- ACCEPT ASSIGNMENT
  -- ------------------------------------------------------------

  update public.delivery_assignments
  set
    status =
      'accepted'::public.delivery_assignment_status,
    responded_at = now(),
    accepted_at = now(),
    updated_at = now()
  where id = p_assignment_id;


  -- ------------------------------------------------------------
  -- UPDATE ORDER
  -- ------------------------------------------------------------

  update public.orders
  set
    current_status =
      'rider_accepted'::public.order_status
  where id = v_assignment_order_id;


  -- ------------------------------------------------------------
  -- RIDER IS NOW BUSY
  -- ------------------------------------------------------------

  update public.riders
  set
    availability_status =
      'on_delivery'::public.rider_availability_status,
    updated_at = now()
  where id = v_rider_id;


  -- ------------------------------------------------------------
  -- AUDIT HISTORY
  -- ------------------------------------------------------------

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    v_assignment_order_id,
    'rider_accepted'::public.order_status,
    v_rider_id,
    'Rider accepted delivery assignment'
  );


  -- ------------------------------------------------------------
  -- RETURN RESULT
  -- ------------------------------------------------------------

  return query
  select
    p_assignment_id,
    v_assignment_order_id,
    v_order_number,
    'accepted'::public.delivery_assignment_status,
    'rider_accepted'::public.order_status;
end;
$$;


ALTER FUNCTION "public"."accept_rider_offer"("p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_kds_order"("p_terminal_id" "uuid", "p_terminal_secret" "text", "p_order_id" "uuid") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "previous_status" "public"."order_status", "current_status" "public"."order_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
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
  -- VALID KITCHEN TRANSITION
  -- ------------------------------------------------------------

  case v_previous_status
    when 'confirmed'::public.order_status then
      v_next_status :=
        'preparing'::public.order_status;

    when 'preparing'::public.order_status then
      v_next_status :=
        'ready'::public.order_status;

    else
      raise exception
        'This order cannot be advanced by the kitchen from status %.',
        v_previous_status;
  end case;


  -- ------------------------------------------------------------
  -- UPDATE ORDER
  -- ------------------------------------------------------------

  update public.orders
  set current_status = v_next_status
  where id = p_order_id;


  -- ------------------------------------------------------------
  -- RECORD AUDIT HISTORY
  -- changed_by is null because the actor is a KDS terminal,
  -- not a profiles/auth user.
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


  -- ------------------------------------------------------------
  -- RETURN RESULT
  -- ------------------------------------------------------------

  return query
  select
    p_order_id,
    v_order_number,
    v_previous_status,
    v_next_status;
end;
$$;


ALTER FUNCTION "public"."advance_kds_order"("p_terminal_id" "uuid", "p_terminal_secret" "text", "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_rider_delivery"("p_assignment_id" "uuid") RETURNS TABLE("assignment_id" "uuid", "order_id" "uuid", "assignment_status" "public"."delivery_assignment_status", "order_status" "public"."order_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


  -- Lock assignment
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


  -- Lock order
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


  -- Determine next valid state
  if v_assignment_status =
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

  elsif v_assignment_status =
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
      'This delivery cannot be advanced from its current status.';
  end if;


  -- Update assignment
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


  -- Update order
  update public.orders
  set
    current_status = v_next_order_status
  where id = v_order_id;


  -- Audit trail
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
$$;


ALTER FUNCTION "public"."advance_rider_delivery"("p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "previous_status" "public"."order_status", "current_status" "public"."order_status", "cancelled_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_staff_id uuid;
  v_order_number varchar;
  v_previous_status public.order_status;
  v_cancelled_at timestamptz;
  v_rider_id uuid;
begin
  -- Require authenticated cashier / manager
  v_staff_id := auth.uid();

  if v_staff_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_staff_id
      and p.is_active = true
      and p.role in (
        'cashier'::public.user_role,
        'manager'::public.user_role
      )
  ) then
    raise exception
      'Only an active cashier or manager may cancel an order.';
  end if;


  -- Require cancellation reason
  if nullif(trim(p_reason), '') is null then
    raise exception
      'A cancellation reason is required.';
  end if;


  -- Lock and validate order
  select
    o.order_number,
    o.current_status
  into
    v_order_number,
    v_previous_status
  from public.orders as o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;


  if v_previous_status in (
    'cancelled'::public.order_status,
    'rejected'::public.order_status,
    'completed'::public.order_status,
    'delivered'::public.order_status
  ) then
    raise exception
      'This order can no longer be cancelled.';
  end if;


  if v_previous_status in (
    'picked_up'::public.order_status,
    'out_for_delivery'::public.order_status
  ) then
    raise exception
      'An order cannot be cancelled after rider pickup.';
  end if;


  -- Find active rider assignment, if any
  select
    da.rider_id
  into
    v_rider_id
  from public.delivery_assignments as da
  where da.order_id = p_order_id
    and da.status in (
      'offered'::public.delivery_assignment_status,
      'accepted'::public.delivery_assignment_status
    )
  order by da.assigned_at desc
  limit 1
  for update;


  -- Cancel any current offer / accepted assignment
  update public.delivery_assignments as da
  set
    status =
      'cancelled'::public.delivery_assignment_status,
    updated_at = now()
  where da.order_id = p_order_id
    and da.status in (
      'offered'::public.delivery_assignment_status,
      'accepted'::public.delivery_assignment_status
    );


  -- Release Rider if necessary
  if v_rider_id is not null then
    update public.riders as r
    set
      availability_status =
        'available'::public.rider_availability_status,
      updated_at = now()
    where r.id = v_rider_id
      and not exists (
        select 1
        from public.delivery_assignments as da
        where da.rider_id = r.id
          and da.order_id <> p_order_id
          and da.status in (
            'accepted'::public.delivery_assignment_status,
            'picked_up'::public.delivery_assignment_status,
            'out_for_delivery'::public.delivery_assignment_status
          )
      );
  end if;


  -- Cancel order
  v_cancelled_at := now();

  update public.orders as o
  set
    current_status =
      'cancelled'::public.order_status,
    cancelled_at = v_cancelled_at
  where o.id = p_order_id;


  -- Audit history
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
    'Order cancelled: ' || trim(p_reason)
  );


  return query
  select
    p_order_id,
    v_order_number,
    v_previous_status,
    'cancelled'::public.order_status,
    v_cancelled_at;
end;
$$;


ALTER FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_cashier_shift"("p_actual_cash" numeric, "p_variance_reason" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("shift_id" "uuid", "cashier_id" "uuid", "terminal" character varying, "opening_cash" numeric, "cash_sales" numeric, "gcash_sales" numeric, "transaction_count" bigint, "expected_cash" numeric, "actual_cash" numeric, "variance" numeric, "variance_reason" "text", "status" "public"."cashier_shift_status", "started_at" timestamp with time zone, "ended_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_cashier_id uuid;
  v_shift public.cashier_shifts%rowtype;

  v_cash_sales numeric(12,2) := 0;
  v_gcash_sales numeric(12,2) := 0;
  v_transaction_count bigint := 0;

  v_expected_cash numeric(12,2);
  v_actual_cash numeric(12,2);
  v_variance numeric(12,2);

  v_variance_reason text;
  v_notes text;
begin
  -- ============================================================
  -- 1. AUTHENTICATION
  -- ============================================================

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to close a cashier shift.';
  end if;


  -- ============================================================
  -- 2. AUTHORIZATION
  -- ============================================================

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may close a cashier shift.';
  end if;


  -- ============================================================
  -- 3. LOCK CURRENT OPEN SHIFT
  -- One cashier can only have one open shift.
  -- ============================================================

  select s.*
  into v_shift
  from public.cashier_shifts s
  where s.cashier_id = v_cashier_id
    and s.status = 'open'::public.cashier_shift_status
  for update;

  if not found then
    raise exception
      'You do not have an open cashier shift.';
  end if;


  -- ============================================================
  -- 4. VALIDATE ACTUAL CASH
  -- ============================================================

  if p_actual_cash is null then
    raise exception
      'Actual cash is required.';
  end if;

  if p_actual_cash < 0 then
    raise exception
      'Actual cash cannot be negative.';
  end if;

  v_actual_cash := round(p_actual_cash, 2);


  -- ============================================================
  -- 5. CALCULATE REAL SHIFT SALES
  --
  -- Cash increases the physical drawer by the sale amount,
  -- NOT by cash_received, because change is returned.
  --
  -- Only completed transactions with verified payments count.
  -- ============================================================

  select
    coalesce(
      sum(
        case
          when p.payment_method = 'cash'::public.payment_method
            then p.amount
          else 0
        end
      ),
      0
    ),

    coalesce(
      sum(
        case
          when p.payment_method = 'gcash'::public.payment_method
            then p.amount
          else 0
        end
      ),
      0
    ),

    count(*)
  into
    v_cash_sales,
    v_gcash_sales,
    v_transaction_count
  from public.cashier_transactions t
  join public.payments p
    on p.id = t.payment_id
  where t.shift_id = v_shift.id
    and t.status =
      'completed'::public.cashier_transaction_status
    and p.status =
      'verified'::public.payment_status;


  v_cash_sales := round(v_cash_sales, 2);
  v_gcash_sales := round(v_gcash_sales, 2);


  -- ============================================================
  -- 6. EXPECTED CASH / VARIANCE
  -- ============================================================

  v_expected_cash :=
    round(
      v_shift.opening_cash + v_cash_sales,
      2
    );

  v_variance :=
    round(
      v_actual_cash - v_expected_cash,
      2
    );


  -- ============================================================
  -- 7. VARIANCE REASON
  -- Required only when drawer is over/short.
  -- ============================================================

  v_variance_reason :=
    nullif(
      btrim(coalesce(p_variance_reason, '')),
      ''
    );

  if v_variance <> 0
     and v_variance_reason is null
  then
    raise exception
      'A variance reason is required when actual cash does not match expected cash.';
  end if;

  if v_variance = 0 then
    v_variance_reason := null;
  end if;


  v_notes :=
    nullif(
      btrim(coalesce(p_notes, '')),
      ''
    );


  -- ============================================================
  -- 8. CLOSE SHIFT
  -- Expected cash and variance are server-generated.
  -- ============================================================

  update public.cashier_shifts
  set
    actual_cash = v_actual_cash,
    expected_cash = v_expected_cash,
    variance = v_variance,
    variance_reason = v_variance_reason,
    notes = v_notes,
    closed_by = v_cashier_id,
    ended_at = now(),
    status = 'closed'::public.cashier_shift_status
  where id = v_shift.id
  returning *
  into v_shift;


  -- ============================================================
  -- 9. RETURN FINAL SETTLEMENT
  -- ============================================================

  return query
  select
    v_shift.id,
    v_shift.cashier_id,
    v_shift.terminal,
    v_shift.opening_cash,
    v_cash_sales,
    v_gcash_sales,
    v_transaction_count,
    v_shift.expected_cash,
    v_shift.actual_cash,
    v_shift.variance,
    v_shift.variance_reason,
    v_shift.status,
    v_shift.started_at,
    v_shift.ended_at;
end;
$$;


ALTER FUNCTION "public"."close_cashier_shift"("p_actual_cash" numeric, "p_variance_reason" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_rider_delivery"("p_assignment_id" "uuid", "p_proof_path" "text") RETURNS TABLE("assignment_id" "uuid", "order_id" "uuid", "assignment_status" "public"."delivery_assignment_status", "order_status" "public"."order_status", "proof_of_delivery_path" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_rider_id uuid;

  v_order_id uuid;
  v_assignment_rider_id uuid;
  v_assignment_status public.delivery_assignment_status;

  v_order_status public.order_status;

  v_proof_path text;
begin
  v_rider_id := auth.uid();

  if v_rider_id is null then
    raise exception 'Authentication is required.';
  end if;


  -- Only an active approved Rider may complete a delivery.
  if not exists (
    select 1
    from public.profiles p

    join public.riders r
      on r.id = p.id

    where p.id = v_rider_id
      and p.role =
        'rider'::public.user_role
      and p.is_active = true
      and r.approval_status =
        'approved'::public.rider_approval_status
  ) then
    raise exception
      'Only an active approved rider may complete a delivery.';
  end if;


  v_proof_path := trim(p_proof_path);

  if v_proof_path is null
    or v_proof_path = ''
  then
    raise exception
      'Proof of delivery is required.';
  end if;


  -- Lock the delivery assignment.
  select
    da.order_id,
    da.rider_id,
    da.status
  into
    v_order_id,
    v_assignment_rider_id,
    v_assignment_status
  from public.delivery_assignments da
  where da.id = p_assignment_id
  for update;

  if not found then
    raise exception
      'Delivery assignment not found.';
  end if;


  if v_assignment_rider_id <> v_rider_id then
    raise exception
      'This delivery assignment does not belong to you.';
  end if;


  if v_assignment_status <>
    'out_for_delivery'::public.delivery_assignment_status
  then
    raise exception
      'Only an out-for-delivery assignment may be completed.';
  end if;


  -- Verify that the Storage path belongs to this Rider
  -- and this exact assignment.
  if split_part(v_proof_path, '/', 1) <>
    v_rider_id::text
  then
    raise exception
      'Invalid proof of delivery path.';
  end if;


  if split_part(v_proof_path, '/', 2) <>
    p_assignment_id::text
  then
    raise exception
      'The proof does not belong to this delivery assignment.';
  end if;


  -- Verify the actual image exists in the private bucket.
  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id =
      'delivery-proofs'
      and so.name = v_proof_path
  ) then
    raise exception
      'Proof of delivery file was not found.';
  end if;


  -- Lock and validate the order.
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


  if v_order_status <>
    'out_for_delivery'::public.order_status
  then
    raise exception
      'Order and rider assignment statuses do not match.';
  end if;


  -- Complete the assignment.
  update public.delivery_assignments
  set
    status =
      'delivered'::public.delivery_assignment_status,

    delivered_at = now(),

    proof_of_delivery_path =
      v_proof_path,

    updated_at = now()

  where id = p_assignment_id;


  -- Update the customer order.
  update public.orders
  set
    current_status =
      'delivered'::public.order_status
  where id = v_order_id;


  -- Rider becomes available again.
  update public.riders
  set
    availability_status =
      'available'::public.rider_availability_status,

    updated_at = now()

  where id = v_rider_id;


  -- Audit history.
  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    v_order_id,
    'delivered'::public.order_status,
    v_rider_id,
    'Rider completed delivery with proof of delivery'
  );


  return query
  select
    p_assignment_id,
    v_order_id,
    'delivered'::public.delivery_assignment_status,
    'delivered'::public.order_status,
    v_proof_path;
end;
$$;


ALTER FUNCTION "public"."complete_rider_delivery"("p_assignment_id" "uuid", "p_proof_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_order"("p_order_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "current_status" "public"."order_status", "confirmed_at" timestamp with time zone, "processed_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_staff_id uuid;
  v_order_number varchar;
  v_current_status public.order_status;
  v_confirmed_at timestamptz;
begin
  -- ------------------------------------------------------------
  -- AUTHENTICATION
  -- ------------------------------------------------------------

  v_staff_id := auth.uid();

  if v_staff_id is null then
    raise exception
      'Authentication is required.';
  end if;


  -- ------------------------------------------------------------
  -- STAFF AUTHORIZATION
  -- Only active cashier or manager accounts may confirm orders.
  -- ------------------------------------------------------------

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
      'Only an active cashier or manager may confirm orders.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK + VALIDATE ORDER
  -- Prevent two staff members from confirming the same order
  -- at the same time.
  -- ------------------------------------------------------------

  select
    o.order_number,
    o.current_status
  into
    v_order_number,
    v_current_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception
      'Order not found.';
  end if;


  -- ------------------------------------------------------------
  -- VALID STATUS TRANSITION
  -- ------------------------------------------------------------

  if v_current_status <>
    'waiting_payment_verification'::public.order_status
  then
    raise exception
      'Only orders waiting for payment verification can be confirmed.';
  end if;


  -- ------------------------------------------------------------
  -- UPDATE ORDER
  -- ------------------------------------------------------------

  v_confirmed_at := now();

  update public.orders
  set
    current_status =
      'confirmed'::public.order_status,
    processed_by = v_staff_id,
    confirmed_at = v_confirmed_at
  where id = p_order_id;


  -- ------------------------------------------------------------
  -- STATUS AUDIT HISTORY
  -- ------------------------------------------------------------

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    p_order_id,
    'confirmed'::public.order_status,
    v_staff_id,
    coalesce(
      nullif(trim(p_notes), ''),
      'Order confirmed'
    )
  );


  -- ------------------------------------------------------------
  -- RETURN UPDATED ORDER
  -- ------------------------------------------------------------

  return query
  select
    p_order_id,
    v_order_number,
    'confirmed'::public.order_status,
    v_confirmed_at,
    v_staff_id;
end;
$$;


ALTER FUNCTION "public"."confirm_order"("p_order_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_walk_in_sale"("p_request_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type", "p_customer_name" "text", "p_contact_number" "text", "p_table_number" "text", "p_discount_type" "text", "p_discount_reference" "text", "p_order_instructions" "text", "p_payment_method" "public"."payment_method", "p_cash_received" numeric, "p_gcash_reference_number" "text", "p_items" "jsonb") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "transaction_id" "uuid", "transaction_number" character varying, "receipt_number" character varying, "payment_id" "uuid", "shift_id" "uuid", "subtotal" numeric, "discount_amount" numeric, "tax_amount" numeric, "grand_total" numeric, "payment_method" "public"."payment_method", "cash_received" numeric, "change_due" numeric, "current_status" "public"."order_status", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_cashier_id uuid;
  v_shift_id uuid;
  v_existing_cashier_id uuid;

  v_customer_name varchar(80);
  v_contact_number varchar(20);
  v_table_number varchar(20);
  v_discount_type varchar(40);
  v_discount_reference varchar(100);
  v_order_notes text;

  v_item jsonb;
  v_menu_item public.menu_items%rowtype;
  v_menu_item_id uuid;
  v_quantity integer;

  v_modifier_ids jsonb;
  v_modifier_count integer;
  v_distinct_modifier_count integer;
  v_modifier_total numeric(12,2);
  v_canonical_modifiers jsonb;

  v_group record;
  v_group_count integer;

  v_note text;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);

  v_validated_items jsonb := '[]'::jsonb;

  v_subtotal numeric(12,2) := 0;
  v_discount_amount numeric(12,2) := 0;
  v_tax_amount numeric(12,2) := 0;
  v_grand_total numeric(12,2);

  v_cash_received numeric(12,2);
  v_gcash_reference varchar;

  v_order_id uuid;
  v_order_number varchar;

  v_payment_id uuid;

  v_transaction_id uuid;
  v_transaction_sequence bigint;
  v_transaction_number varchar;
  v_receipt_number varchar;

  v_created_at timestamptz;
  v_validated_line jsonb;
begin

  -- ============================================================
  -- 1. AUTHENTICATION / AUTHORIZATION
  -- ============================================================

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to create a walk-in sale.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may create a walk-in sale.';
  end if;


  -- ============================================================
  -- 2. IDEMPOTENCY
  --
  -- A retry with the same request UUID returns the original sale
  -- instead of creating another order.
  -- ============================================================

  if p_request_id is null then
    raise exception
      'A checkout request ID is required.';
  end if;

  select t.cashier_id
  into v_existing_cashier_id
  from public.cashier_transactions t
  where t.request_id = p_request_id;

  if found then

    if v_existing_cashier_id <> v_cashier_id then
      raise exception
        'This checkout request ID has already been used.';
    end if;

    return query
    select
      o.id,
      o.order_number,
      t.id,
      t.transaction_number,
      t.receipt_number,
      p.id,
      t.shift_id,
      o.subtotal,
      o.discount_amount,
      o.tax_amount,
      o.grand_total,
      p.payment_method,
      p.cash_received,
      case
        when p.payment_method =
          'cash'::public.payment_method
        then round(
          p.cash_received - p.amount,
          2
        )
        else null
      end,
      o.current_status,
      o.created_at
    from public.cashier_transactions t
    join public.orders o
      on o.id = t.order_id
    join public.payments p
      on p.id = t.payment_id
    where t.request_id = p_request_id;

    return;
  end if;


  -- ============================================================
  -- 3. ACTIVE SHIFT
  --
  -- Lock it so shift closing and sale creation cannot race.
  -- ============================================================

  select s.id
  into v_shift_id
  from public.cashier_shifts s
  where s.cashier_id = v_cashier_id
    and s.status =
      'open'::public.cashier_shift_status
  for update;

  if not found then
    raise exception
      'Start a cashier shift before placing an order.';
  end if;


  -- ============================================================
  -- 4. FULFILLMENT
  --
  -- The current walk-in POS supports Dine-in and Take-out.
  -- Delivery remains part of the wider order system but is not
  -- created by this counter-sale RPC.
  -- ============================================================

  if p_fulfillment_type not in (
    'dine_in'::public.fulfillment_type,
    'takeout'::public.fulfillment_type
  ) then
    raise exception
      'Walk-in POS supports only dine-in or take-out orders.';
  end if;


  -- ============================================================
  -- 5. CUSTOMER DETAILS
  -- ============================================================

  v_customer_name :=
    coalesce(
      nullif(
        btrim(coalesce(p_customer_name, '')),
        ''
      ),
      'Walk-in Customer'
    );

  if char_length(v_customer_name) > 80 then
    raise exception
      'Customer name must be 80 characters or fewer.';
  end if;


  v_contact_number :=
    nullif(
      btrim(coalesce(p_contact_number, '')),
      ''
    );

  if v_contact_number is not null
     and char_length(v_contact_number) > 20
  then
    raise exception
      'Contact number must be 20 characters or fewer.';
  end if;


  -- ============================================================
  -- 6. DINE-IN TABLE
  -- ============================================================

  if p_fulfillment_type =
     'dine_in'::public.fulfillment_type
  then

    v_table_number :=
      nullif(
        btrim(coalesce(p_table_number, '')),
        ''
      );

    if v_table_number is not null then

      -- "001" → "1", "010" → "10"
      v_table_number :=
        regexp_replace(
          v_table_number,
          '^0+([0-9])',
          '\1'
        );

      if char_length(v_table_number) > 20 then
        raise exception
          'Table number cannot exceed 20 characters.';
      end if;

      if exists (
        select 1
        from public.orders o
        where o.fulfillment_type =
          'dine_in'::public.fulfillment_type
          and o.table_number is not null
          and lower(o.table_number) =
              lower(v_table_number)
          and o.current_status not in (
            'completed'::public.order_status,
            'cancelled'::public.order_status,
            'rejected'::public.order_status
          )
      ) then
        raise exception
          'Table % already has an active order.',
          v_table_number;
      end if;

    end if;

  else
    v_table_number := null;
  end if;


  -- ============================================================
  -- 7. DISCOUNT
  --
  -- Current POS rules:
  -- Senior Citizen = 20%
  -- PWD            = 20%
  -- ============================================================

  v_discount_type :=
    nullif(
      btrim(coalesce(p_discount_type, '')),
      ''
    );

  if v_discount_type is not null
     and v_discount_type not in (
       'Senior Citizen',
       'PWD'
     )
  then
    raise exception
      'Invalid discount type.';
  end if;


  if v_discount_type is not null then

    v_discount_reference :=
      nullif(
        btrim(
          coalesce(
            p_discount_reference,
            ''
          )
        ),
        ''
      );

    if v_discount_reference is null then
      raise exception
        'ID or reference is required for this discount.';
    end if;

    if char_length(v_discount_reference) > 100 then
      raise exception
        'Discount reference cannot exceed 100 characters.';
    end if;

  else
    v_discount_reference := null;
  end if;


  v_order_notes :=
    nullif(
      btrim(
        coalesce(
          p_order_instructions,
          ''
        )
      ),
      ''
    );


  -- ============================================================
  -- 8. CART STRUCTURE
  --
  -- Expected item:
  --
  -- {
  --   "menu_item_id": "<uuid>",
  --   "quantity": 2,
  --   "modifier_ids": ["extra-rice", "spice-hot"],
  --   "note": "..."
  -- }
  -- ============================================================

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception
      'Add at least one menu item.';
  end if;


  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where
      jsonb_typeof(item) <> 'object'

      or coalesce(
        item ->> 'menu_item_id',
        ''
      ) !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

      or not (
        coalesce(
          item ->> 'quantity',
          ''
        ) ~ '^[1-9][0-9]*$'
      )

      or (
        case
          when coalesce(
            item ->> 'quantity',
            ''
          ) ~ '^[1-9][0-9]*$'
          then
            (item ->> 'quantity')::integer > 99
          else true
        end
      )

      or (
        item ? 'modifier_ids'
        and jsonb_typeof(
          item -> 'modifier_ids'
        ) <> 'array'
      )
  ) then
    raise exception
      'One or more cart items are invalid.';
  end if;


  -- Aggregate quantity for the same menu item must also stay <= 99.
  if exists (
    select 1
    from (
      select
        (item ->> 'menu_item_id')::uuid
          as menu_item_id,
        sum(
          (item ->> 'quantity')::integer
        ) as quantity
      from jsonb_array_elements(p_items) item
      group by
        (item ->> 'menu_item_id')::uuid
    ) q
    where q.quantity > 99
  ) then
    raise exception
      'A menu item quantity cannot exceed 99.';
  end if;


  -- ============================================================
  -- 9. SERVER-AUTHORITATIVE ITEM + MODIFIER PRICING
  -- ============================================================

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop

    v_menu_item_id :=
      (v_item ->> 'menu_item_id')::uuid;

    v_quantity :=
      (v_item ->> 'quantity')::integer;


    select mi.*
    into v_menu_item
    from public.menu_items mi
    where mi.id = v_menu_item_id
      and mi.is_active = true
      and mi.is_available = true;

    if not found then
      raise exception
        'One or more menu items are unavailable or invalid.';
    end if;


    v_modifier_ids :=
      coalesce(
        v_item -> 'modifier_ids',
        '[]'::jsonb
      );


    if jsonb_typeof(v_modifier_ids) <> 'array' then
      raise exception
        'Invalid modifiers for %.',
        v_menu_item.name;
    end if;


    v_modifier_count :=
      jsonb_array_length(v_modifier_ids);


    select count(distinct selected.option_id)
    into v_distinct_modifier_count
    from jsonb_array_elements_text(
      v_modifier_ids
    ) selected(option_id);


    if v_modifier_count <>
       v_distinct_modifier_count
    then
      raise exception
        'Duplicate modifiers are not allowed for %.',
        v_menu_item.name;
    end if;


    -- Every submitted modifier must:
    -- 1. exist,
    -- 2. be active,
    -- 3. belong to an active group,
    -- 4. be assigned to this menu item.
    if exists (
      select 1
      from jsonb_array_elements_text(
        v_modifier_ids
      ) selected(option_id)

      left join public.menu_modifier_options mo
        on mo.id = selected.option_id
       and mo.is_active = true

      left join public.menu_modifier_groups mg
        on mg.id = mo.group_id
       and mg.is_active = true

      left join public.menu_item_modifier_groups mimg
        on mimg.menu_item_id = v_menu_item.id
       and mimg.group_id = mo.group_id

      where mo.id is null
         or mg.id is null
         or mimg.menu_item_id is null
    ) then
      raise exception
        'One or more selected modifiers are invalid for %.',
        v_menu_item.name;
    end if;


    -- Enforce every group's min/max selections.
    for v_group in
      select
        mg.id,
        mg.name,
        mg.min_selections,
        mg.max_selections
      from public.menu_item_modifier_groups mimg
      join public.menu_modifier_groups mg
        on mg.id = mimg.group_id
      where mimg.menu_item_id =
        v_menu_item.id
        and mg.is_active = true
    loop

      select count(*)
      into v_group_count
      from jsonb_array_elements_text(
        v_modifier_ids
      ) selected(option_id)
      join public.menu_modifier_options mo
        on mo.id = selected.option_id
       and mo.group_id = v_group.id
       and mo.is_active = true;


      if v_group_count <
         v_group.min_selections
      then
        raise exception
          '% requires a selection.',
          v_group.name;
      end if;


      if v_group_count >
         v_group.max_selections
      then
        raise exception
          '% allows at most % selection(s).',
          v_group.name,
          v_group.max_selections;
      end if;

    end loop;


    -- Canonical modifier names/prices come from PostgreSQL.
    select
      coalesce(
        sum(mo.price_adjustment),
        0
      ),

      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', mo.id,
            'name', mo.name,
            'price', mo.price_adjustment
          )
          order by selected.ordinality
        ),
        '[]'::jsonb
      )

    into
      v_modifier_total,
      v_canonical_modifiers

    from jsonb_array_elements_text(
      v_modifier_ids
    )
    with ordinality
      as selected(option_id, ordinality)

    join public.menu_modifier_options mo
      on mo.id = selected.option_id
     and mo.is_active = true;


    v_unit_price :=
      round(
        v_menu_item.price +
        v_modifier_total,
        2
      );


    v_line_total :=
      round(
        v_unit_price * v_quantity,
        2
      );


    v_note :=
      nullif(
        btrim(
          coalesce(
            v_item ->> 'note',
            ''
          )
        ),
        ''
      );

    if v_note is not null
       and char_length(v_note) > 120
    then
      v_note := left(v_note, 120);
    end if;


    v_validated_items :=
      v_validated_items ||
      jsonb_build_array(
        jsonb_build_object(
          'menu_item_id',
            v_menu_item.id,
          'item_name',
            v_menu_item.name,
          'quantity',
            v_quantity,
          'unit_price',
            v_unit_price,
          'line_total',
            v_line_total,
          'note',
            v_note,
          'modifiers',
            v_canonical_modifiers
        )
      );


    v_subtotal :=
      v_subtotal + v_line_total;

  end loop;


  v_subtotal :=
    round(v_subtotal, 2);


  if v_subtotal <= 0 then
    raise exception
      'Order subtotal must be greater than zero.';
  end if;


  -- ============================================================
  -- 10. DISCOUNT / TAX / TOTAL
  --
  -- Tax is intentionally 0 because POS_TAX_ENABLED is currently
  -- false.
  -- ============================================================

  if v_discount_type is not null then
    v_discount_amount :=
      round(
        v_subtotal * 0.20,
        2
      );
  else
    v_discount_amount := 0;
  end if;


  v_tax_amount := 0;


  v_grand_total :=
    round(
      v_subtotal
      - v_discount_amount
      + v_tax_amount,
      2
    );


  if v_grand_total < 0 then
    raise exception
      'Order total cannot be negative.';
  end if;


  -- ============================================================
  -- 11. PAYMENT VALIDATION
  -- ============================================================

  if p_payment_method =
     'cash'::public.payment_method
  then

    if p_cash_received is null then
      raise exception
        'Cash received is required.';
    end if;

    if p_cash_received::text in (
      'NaN',
      'Infinity',
      '-Infinity'
    ) then
      raise exception
        'Cash received is invalid.';
    end if;


    v_cash_received :=
      round(p_cash_received, 2);


    if v_cash_received <
       v_grand_total
    then
      raise exception
        'Cash received is less than the order total.';
    end if;


    v_gcash_reference := null;


  elsif p_payment_method =
        'gcash'::public.payment_method
  then

    v_cash_received := null;


    v_gcash_reference :=
      nullif(
        btrim(
          coalesce(
            p_gcash_reference_number,
            ''
          )
        ),
        ''
      );


    if v_gcash_reference is null then
      raise exception
        'GCash reference number is required.';
    end if;


    if char_length(v_gcash_reference) > 100 then
      raise exception
        'GCash reference number cannot exceed 100 characters.';
    end if;


    if exists (
      select 1
      from public.payments p
      where p.payment_method =
        'gcash'::public.payment_method
        and lower(
          btrim(
            p.gcash_reference_number
          )
        ) =
        lower(
          btrim(
            v_gcash_reference
          )
        )
    ) then
      raise exception
        'This GCash reference number has already been used.';
    end if;


  else
    raise exception
      'Unsupported payment method.';
  end if;


  -- ============================================================
  -- 12. SERVER-GENERATED IDENTIFIERS
  -- ============================================================

  v_created_at := now();

  v_order_id :=
    gen_random_uuid();


  v_order_number :=
    'ORD-' ||
    lpad(
      nextval(
        'public.order_number_seq'
      )::text,
      6,
      '0'
    );


  v_payment_id :=
    gen_random_uuid();


  v_transaction_id :=
    gen_random_uuid();


  v_transaction_sequence :=
    nextval(
      'public.cashier_transaction_number_seq'
    );


  v_transaction_number :=
    'TXN-' ||
    lpad(
      v_transaction_sequence::text,
      6,
      '0'
    );


  v_receipt_number :=
    'RCP-' ||
    lpad(
      v_transaction_sequence::text,
      6,
      '0'
    );


  -- ============================================================
  -- 13. ORDER
  -- ============================================================

  insert into public.orders (
    id,
    order_number,
    customer_id,
    processed_by,
    order_channel,
    fulfillment_type,

    customer_name,
    customer_contact_number,

    delivery_address,
    landmark,
    table_number,

    current_status,

    subtotal,
    delivery_fee,
    discount_type,
    discount_reference,
    discount_amount,
    tax_amount,
    grand_total,

    notes,

    confirmed_at,
    created_at
  )
  values (
    v_order_id,
    v_order_number,
    null,
    v_cashier_id,
    'walk_in'::public.order_channel,
    p_fulfillment_type,

    v_customer_name,
    v_contact_number,

    null,
    null,
    v_table_number,

    'confirmed'::public.order_status,

    v_subtotal,
    0,
    v_discount_type,
    v_discount_reference,
    v_discount_amount,
    v_tax_amount,
    v_grand_total,

    v_order_notes,

    v_created_at,
    v_created_at
  );


  -- ============================================================
  -- 14. ORDER ITEMS
  -- ============================================================

  for v_validated_line in
    select value
    from jsonb_array_elements(
      v_validated_items
    )
  loop

    insert into public.order_items (
      order_id,
      menu_item_id,
      item_name,
      quantity,
      unit_price,
      line_total,
      special_instructions,
      modifiers,
      created_at
    )
    values (
      v_order_id,

      (
        v_validated_line
          ->> 'menu_item_id'
      )::uuid,

      v_validated_line
        ->> 'item_name',

      (
        v_validated_line
          ->> 'quantity'
      )::integer,

      (
        v_validated_line
          ->> 'unit_price'
      )::numeric,

      (
        v_validated_line
          ->> 'line_total'
      )::numeric,

      nullif(
        v_validated_line
          ->> 'note',
        ''
      ),

      coalesce(
        v_validated_line
          -> 'modifiers',
        '[]'::jsonb
      ),

      v_created_at
    );

  end loop;


  -- ============================================================
  -- 15. PAYMENT
  --
  -- Counter Cash and counter GCash are verified immediately.
  -- ============================================================

  insert into public.payments (
    id,
    order_id,
    payment_method,
    amount,

    gcash_reference_number,
    proof_image_path,

    cash_received,

    status,
    verified_by,
    verified_at,

    created_at,
    updated_at
  )
  values (
    v_payment_id,
    v_order_id,
    p_payment_method,
    v_grand_total,

    v_gcash_reference,
    null,

    v_cash_received,

    'verified'::public.payment_status,
    v_cashier_id,
    v_created_at,

    v_created_at,
    v_created_at
  );


  -- ============================================================
  -- 16. CASHIER TRANSACTION
  -- ============================================================

  insert into public.cashier_transactions (
    id,
    transaction_number,
    receipt_number,

    order_id,
    payment_id,
    shift_id,
    cashier_id,

    status,
    request_id,

    created_at
  )
  values (
    v_transaction_id,
    v_transaction_number,
    v_receipt_number,

    v_order_id,
    v_payment_id,
    v_shift_id,
    v_cashier_id,

    'completed'::public.cashier_transaction_status,
    p_request_id,

    v_created_at
  );


  -- ============================================================
  -- 17. ORDER STATUS HISTORY
  -- ============================================================

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes,
    created_at
  )
  values (
    v_order_id,
    'confirmed'::public.order_status,
    v_cashier_id,
    'Walk-in sale created and payment verified',
    v_created_at
  );


  -- ============================================================
  -- 18. RETURN COMPLETE SALE
  -- ============================================================

  return query
  select
    v_order_id,
    v_order_number,

    v_transaction_id,
    v_transaction_number,
    v_receipt_number,

    v_payment_id,
    v_shift_id,

    v_subtotal,
    v_discount_amount,
    v_tax_amount,
    v_grand_total,

    p_payment_method,
    v_cash_received,

    case
      when p_payment_method =
        'cash'::public.payment_method
      then
        round(
          v_cash_received -
          v_grand_total,
          2
        )
      else null
    end,

    'confirmed'::public.order_status,
    v_created_at;

end;
$_$;


ALTER FUNCTION "public"."create_walk_in_sale"("p_request_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type", "p_customer_name" "text", "p_contact_number" "text", "p_table_number" "text", "p_discount_type" "text", "p_discount_reference" "text", "p_order_instructions" "text", "p_payment_method" "public"."payment_method", "p_cash_received" numeric, "p_gcash_reference_number" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select role
  from public.profiles
  where id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_kds_queue"("p_terminal_id" "uuid", "p_terminal_secret" "text") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "fulfillment_type" "public"."fulfillment_type", "current_status" "public"."order_status", "notes" "text", "created_at" timestamp with time zone, "items" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_secret text;
  v_secret_hash text;
begin
  -- Normalize the supplied device secret.
  v_secret := trim(p_terminal_secret);

  -- Reject missing credentials immediately.
  if p_terminal_id is null
     or v_secret is null
     or v_secret = '' then
    raise exception
      'Invalid kitchen terminal credential.';
  end if;

  -- Hash the secret supplied by the KDS.
  v_secret_hash :=
    encode(
      extensions.digest(
        v_secret,
        'sha256'
      ),
      'hex'
    );

  -- Verify:
  -- 1. terminal exists
  -- 2. terminal is active
  -- 3. supplied secret matches stored hash
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

  -- Record successful terminal use.
  update public.kds_terminals
  set last_used_at = now()
  where id = p_terminal_id;

  -- Return only orders relevant to the kitchen.
  return query
  select
    o.id,
    o.order_number,
    o.fulfillment_type,
    o.current_status,
    o.notes,
    o.created_at,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'item_name', oi.item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'special_instructions',
              oi.special_instructions
          )
          order by oi.created_at asc
        )
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ) as items

  from public.orders o
  where o.current_status in (
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status
  )
  order by o.created_at asc;
end;
$$;


ALTER FUNCTION "public"."get_kds_queue"("p_terminal_id" "uuid", "p_terminal_secret" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  full_name_value text;
begin
  full_name_value := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  );

  insert into public.profiles (
    id,
    first_name,
    last_name,
    contact_number
  )
  values (
    new.id,

    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'first_name',
        new.raw_user_meta_data ->> 'given_name',
        split_part(full_name_value, ' ', 1)
      ),
      ''
    ),

    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'last_name',
        new.raw_user_meta_data ->> 'family_name',
        case
          when strpos(full_name_value, ' ') > 0
          then substr(
            full_name_value,
            strpos(full_name_value, ' ') + 1
          )
          else null
        end
      ),
      ''
    ),

    nullif(
      new.raw_user_meta_data ->> 'contact_number',
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  meta jsonb;
  v_first_name text;
  v_last_name text;
  v_contact_number text;
  v_full_name text;
  parts text[];
begin
  meta := new.raw_user_meta_data;

  v_first_name := meta ->> 'first_name';
  v_last_name  := meta ->> 'last_name';
  v_contact_number := meta ->> 'contact_number';

  -- If full_name exists but first_name/last_name do not, split it
  v_full_name := meta ->> 'full_name';
  if (v_first_name is null or v_first_name = '') and v_full_name is not null and v_full_name <> '' then
    parts := regexp_split_to_array(trim(v_full_name), '\s+');
    if array_length(parts, 1) >= 1 then
      v_first_name := parts[1];
    end if;
    if array_length(parts, 1) >= 2 then
      v_last_name := array_to_string(parts[2:array_length(parts,1)], ' ');
    end if;
  end if;

  -- Do not overwrite if profile already exists
  if not exists (select 1 from public.profiles p where p.id = new.id) then
    insert into public.profiles (id, first_name, last_name, contact_number)
    values (new.id, v_first_name, v_last_name, v_contact_number);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."offer_order_to_next_rider"("p_order_id" "uuid") RETURNS TABLE("assignment_id" "uuid", "order_id" "uuid", "order_number" character varying, "rider_id" "uuid", "assignment_status" "public"."delivery_assignment_status", "assigned_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_staff_id uuid;
  v_order_number varchar;
  v_order_status public.order_status;
  v_fulfillment_type public.fulfillment_type;

  v_rider_id uuid;
  v_assignment_id uuid;
  v_assigned_at timestamptz;
begin
  -- ------------------------------------------------------------
  -- REQUIRE AUTHENTICATED CASHIER / MANAGER
  -- ------------------------------------------------------------

  v_staff_id := auth.uid();

  if v_staff_id is null then
    raise exception 'Authentication is required.';
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
      'Only an active cashier or manager may assign a rider.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK + VALIDATE ORDER
  -- ------------------------------------------------------------

  select
    o.order_number,
    o.current_status,
    o.fulfillment_type
  into
    v_order_number,
    v_order_status,
    v_fulfillment_type
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_fulfillment_type <>
    'delivery'::public.fulfillment_type
  then
    raise exception
      'Only delivery orders may be assigned to riders.';
  end if;

  if v_order_status <>
    'waiting_for_rider'::public.order_status
  then
    raise exception
      'Order must be waiting for a rider before assignment.';
  end if;


  -- ------------------------------------------------------------
  -- PREVENT ANOTHER ACTIVE OFFER
  -- ------------------------------------------------------------

  if exists (
    select 1
    from public.delivery_assignments da
    where da.order_id = p_order_id
      and da.status in (
        'offered'::public.delivery_assignment_status,
        'accepted'::public.delivery_assignment_status,
        'picked_up'::public.delivery_assignment_status,
        'out_for_delivery'::public.delivery_assignment_status
      )
  ) then
    raise exception
      'This order already has an active rider assignment.';
  end if;


  -- ------------------------------------------------------------
  -- FAIRNESS RULE
  -- ------------------------------------------------------------

  select r.id
  into v_rider_id
  from public.riders r

  join public.profiles p
    on p.id = r.id

  where p.role =
      'rider'::public.user_role

    and p.is_active = true

    and r.approval_status =
      'approved'::public.rider_approval_status

    and r.availability_status =
      'available'::public.rider_availability_status


    -- Rider must not already have another active delivery.
    and not exists (
      select 1
      from public.delivery_assignments active_assignment

      where active_assignment.rider_id = r.id

        and active_assignment.status in (
          'offered'::public.delivery_assignment_status,
          'accepted'::public.delivery_assignment_status,
          'picked_up'::public.delivery_assignment_status,
          'out_for_delivery'::public.delivery_assignment_status
        )
    )


    -- IMPORTANT:
    -- Do not offer the same order back to a Rider
    -- who already rejected it.
    and not exists (
      select 1
      from public.delivery_assignments rejected_assignment

      where rejected_assignment.order_id =
          p_order_id

        and rejected_assignment.rider_id =
          r.id

        and rejected_assignment.status =
          'rejected'::public.delivery_assignment_status
    )

  order by
    r.last_assigned_at asc nulls first,
    r.created_at asc,
    r.id

  limit 1

  for update of r skip locked;


  if v_rider_id is null then
    raise exception
      'No approved and available rider is currently eligible.';
  end if;


  -- ------------------------------------------------------------
  -- CREATE OFFER
  -- ------------------------------------------------------------

  insert into public.delivery_assignments (
    order_id,
    rider_id,
    assignment_method,
    status
  )
  values (
    p_order_id,
    v_rider_id,
    'fairness_rule'::public.assignment_method,
    'offered'::public.delivery_assignment_status
  )
  returning
    id,
    delivery_assignments.assigned_at
  into
    v_assignment_id,
    v_assigned_at;


  -- ------------------------------------------------------------
  -- UPDATE FAIRNESS TIMESTAMP
  -- ------------------------------------------------------------

  update public.riders
  set
    last_assigned_at = v_assigned_at,
    updated_at = now()
  where id = v_rider_id;


  -- ------------------------------------------------------------
  -- RETURN OFFER
  -- ------------------------------------------------------------

  return query
  select
    v_assignment_id,
    p_order_id,
    v_order_number,
    v_rider_id,
    'offered'::public.delivery_assignment_status,
    v_assigned_at;
end;
$$;


ALTER FUNCTION "public"."offer_order_to_next_rider"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_customer_order"("p_customer_name" "text", "p_contact_number" "text", "p_delivery_address" "text", "p_landmark" "text", "p_items" "jsonb") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "subtotal" numeric, "delivery_fee" numeric, "grand_total" numeric, "current_status" "public"."order_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number varchar;

  v_subtotal numeric := 0;
  v_delivery_fee numeric := 50;
  v_grand_total numeric := 0;

  v_requested_item_count integer := 0;
  v_valid_item_count integer := 0;
begin
  v_customer_id := auth.uid();

  if v_customer_id is null then
    raise exception
      'Authentication is required to place an order.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_customer_id
      and p.role = 'customer'::public.user_role
      and p.is_active = true
  ) then
    raise exception
      'Only an active customer account may place an order.';
  end if;

  if nullif(trim(p_customer_name), '') is null then
    raise exception 'Customer name is required.';
  end if;

  if nullif(trim(p_contact_number), '') is null then
    raise exception 'Contact number is required.';
  end if;

  if trim(p_contact_number) !~ '^09[0-9]{9}$' then
    raise exception
      'A valid Philippine mobile number is required.';
  end if;

  if nullif(trim(p_delivery_address), '') is null then
    raise exception
      'Delivery address is required.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception
      'The order must contain at least one menu item.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where
      jsonb_typeof(item) <> 'object'
      or not (item ? 'id')
      or not (item ? 'qty')
      or coalesce(item ->> 'id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item ->> 'qty', '') !~
        '^[1-9][0-9]*$'
      or (
        case
          when coalesce(item ->> 'qty', '') ~
            '^[1-9][0-9]*$'
          then (item ->> 'qty')::integer
          else 0
        end
      ) > 99
  ) then
    raise exception
      'One or more cart items are invalid.';
  end if;

  if exists (
    select 1
    from (
      select
        (item ->> 'id')::uuid as menu_item_id,
        sum((item ->> 'qty')::integer) as quantity
      from jsonb_array_elements(p_items) as item
      group by (item ->> 'id')::uuid
    ) requested
    where requested.quantity > 99
  ) then
    raise exception
      'A menu item quantity cannot exceed 99.';
  end if;

  with requested_items as (
    select
      (item ->> 'id')::uuid as menu_item_id,
      sum((item ->> 'qty')::integer)::integer
        as quantity
    from jsonb_array_elements(p_items) as item
    group by (item ->> 'id')::uuid
  )
  select count(*)
  into v_requested_item_count
  from requested_items;

  with requested_items as (
    select
      (item ->> 'id')::uuid as menu_item_id,
      sum((item ->> 'qty')::integer)::integer
        as quantity
    from jsonb_array_elements(p_items) as item
    group by (item ->> 'id')::uuid
  )
  select count(*)
  into v_valid_item_count
  from requested_items requested
  join public.menu_items menu_item
    on menu_item.id = requested.menu_item_id
  where menu_item.is_active = true
    and menu_item.is_available = true;

  if v_requested_item_count <> v_valid_item_count then
    raise exception
      'One or more menu items are unavailable or invalid.';
  end if;

  with requested_items as (
    select
      (item ->> 'id')::uuid as menu_item_id,
      sum((item ->> 'qty')::integer)::integer
        as quantity
    from jsonb_array_elements(p_items) as item
    group by (item ->> 'id')::uuid
  )
  select
    coalesce(
      sum(
        menu_item.price * requested.quantity
      ),
      0
    )
  into v_subtotal
  from requested_items requested
  join public.menu_items menu_item
    on menu_item.id = requested.menu_item_id
  where menu_item.is_active = true
    and menu_item.is_available = true;

  if v_subtotal <= 0 then
    raise exception
      'The order subtotal must be greater than zero.';
  end if;

  v_grand_total :=
    v_subtotal + v_delivery_fee;

  v_order_id := gen_random_uuid();

  v_order_number :=
    'ORD-' ||
    lpad(
      nextval('public.order_number_seq')::text,
      6,
      '0'
    );

  insert into public.orders (
    id,
    order_number,
    customer_id,
    processed_by,
    order_channel,
    fulfillment_type,
    customer_name,
    customer_contact_number,
    delivery_address,
    landmark,
    current_status,
    subtotal,
    delivery_fee,
    grand_total
  )
  values (
    v_order_id,
    v_order_number,
    v_customer_id,
    null,
    'online'::public.order_channel,
    'delivery'::public.fulfillment_type,
    trim(p_customer_name),
    trim(p_contact_number),
    trim(p_delivery_address),
    nullif(trim(coalesce(p_landmark, '')), ''),
    'waiting_payment_verification'::public.order_status,
    v_subtotal,
    v_delivery_fee,
    v_grand_total
  );

  with requested_items as (
    select
      (item ->> 'id')::uuid as menu_item_id,
      sum((item ->> 'qty')::integer)::integer
        as quantity
    from jsonb_array_elements(p_items) as item
    group by (item ->> 'id')::uuid
  )
  insert into public.order_items (
    order_id,
    menu_item_id,
    item_name,
    quantity,
    unit_price,
    line_total
  )
  select
    v_order_id,
    menu_item.id,
    menu_item.name,
    requested.quantity,
    menu_item.price,
    menu_item.price * requested.quantity
  from requested_items requested
  join public.menu_items menu_item
    on menu_item.id = requested.menu_item_id
  where menu_item.is_active = true
    and menu_item.is_available = true;

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    v_order_id,
    'waiting_payment_verification'::public.order_status,
    v_customer_id,
    'Order created'
  );

  return query
  select
    v_order_id,
    v_order_number,
    v_subtotal,
    v_delivery_fee,
    v_grand_total,
    'waiting_payment_verification'::public.order_status;
end;
$_$;


ALTER FUNCTION "public"."place_customer_order"("p_customer_name" "text", "p_contact_number" "text", "p_delivery_address" "text", "p_landmark" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provision_kds_terminal"("p_terminal_name" "text") RETURNS TABLE("terminal_id" "uuid", "terminal_name" "text", "terminal_secret" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_manager_id uuid;
  v_terminal_id uuid;
  v_terminal_name text;
  v_terminal_secret text;
  v_secret_hash text;
begin
  -- Require an authenticated manager.
  v_manager_id := auth.uid();

  if v_manager_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_manager_id
      and p.is_active = true
      and p.role = 'manager'::public.user_role
  ) then
    raise exception
      'Only an active manager may provision a KDS terminal.';
  end if;

  -- Validate terminal name.
  v_terminal_name := trim(p_terminal_name);

  if v_terminal_name is null
     or v_terminal_name = '' then
    raise exception 'Terminal name is required.';
  end if;

  if length(v_terminal_name) > 80 then
    raise exception
      'Terminal name must be 80 characters or fewer.';
  end if;

  -- Generate a random device secret.
  v_terminal_secret :=
    'kds_' ||
    encode(
      extensions.gen_random_bytes(32),
      'hex'
    );

  -- Store only its SHA-256 hash.
  v_secret_hash :=
    encode(
      extensions.digest(
        v_terminal_secret,
        'sha256'
      ),
      'hex'
    );

  insert into public.kds_terminals (
    terminal_name,
    secret_hash,
    is_active
  )
  values (
    v_terminal_name,
    v_secret_hash,
    true
  )
  returning id
  into v_terminal_id;

  return query
  select
    v_terminal_id,
    v_terminal_name,
    v_terminal_secret;
end;
$$;


ALTER FUNCTION "public"."provision_kds_terminal"("p_terminal_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_rider_offer"("p_assignment_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS TABLE("assignment_id" "uuid", "order_id" "uuid", "order_number" character varying, "assignment_status" "public"."delivery_assignment_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_rider_id uuid;

  v_order_id uuid;
  v_assignment_rider_id uuid;
  v_assignment_status public.delivery_assignment_status;

  v_order_number varchar;
  v_order_status public.order_status;

  v_reason text;
begin
  v_rider_id := auth.uid();

  if v_rider_id is null then
    raise exception 'Authentication is required.';
  end if;


  -- Only active approved Riders may reject offers.
  if not exists (
    select 1
    from public.profiles p

    join public.riders r
      on r.id = p.id

    where p.id = v_rider_id
      and p.role =
        'rider'::public.user_role
      and p.is_active = true
      and r.approval_status =
        'approved'::public.rider_approval_status
  ) then
    raise exception
      'Only an active approved rider may reject a delivery.';
  end if;


  -- Lock assignment.
  select
    da.order_id,
    da.rider_id,
    da.status
  into
    v_order_id,
    v_assignment_rider_id,
    v_assignment_status
  from public.delivery_assignments da
  where da.id = p_assignment_id
  for update;

  if not found then
    raise exception
      'Delivery assignment not found.';
  end if;


  if v_assignment_rider_id <> v_rider_id then
    raise exception
      'This delivery assignment does not belong to you.';
  end if;


  if v_assignment_status <>
    'offered'::public.delivery_assignment_status
  then
    raise exception
      'Only an offered delivery may be rejected.';
  end if;


  -- Lock and validate order.
  select
    o.order_number,
    o.current_status
  into
    v_order_number,
    v_order_status
  from public.orders o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception
      'Order not found.';
  end if;


  if v_order_status <>
    'waiting_for_rider'::public.order_status
  then
    raise exception
      'This order is no longer waiting for a rider.';
  end if;


  v_reason :=
    nullif(trim(p_reason), '');


  -- Reject the offer.
  update public.delivery_assignments
  set
    status =
      'rejected'::public.delivery_assignment_status,

    responded_at = now(),

    rejected_at = now(),

    rejection_reason =
      v_reason,

    updated_at = now()

  where id = p_assignment_id;


  -- Order remains waiting_for_rider.
  -- Add an audit entry without changing its status.
  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes
  )
  values (
    v_order_id,
    'waiting_for_rider'::public.order_status,
    v_rider_id,
    case
      when v_reason is not null then
        'Rider rejected delivery assignment: ' ||
        v_reason
      else
        'Rider rejected delivery assignment'
    end
  );


  return query
  select
    p_assignment_id,
    v_order_id,
    v_order_number,
    'rejected'::public.delivery_assignment_status;
end;
$$;


ALTER FUNCTION "public"."reject_rider_offer"("p_assignment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("order_id" "uuid", "order_number" character varying, "previous_status" "public"."order_status", "current_status" "public"."order_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_staff_id uuid;
  v_order_number varchar;
  v_fulfillment_type public.fulfillment_type;
  v_previous_status public.order_status;
  v_next_status public.order_status;
begin
  -- ------------------------------------------------------------
  -- REQUIRE AUTHENTICATED STAFF
  -- ------------------------------------------------------------

  v_staff_id := auth.uid();

  if v_staff_id is null then
    raise exception 'Authentication is required.';
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
      'Only an active cashier or manager may release a ready order.';
  end if;


  -- ------------------------------------------------------------
  -- LOCK + LOAD ORDER
  -- ------------------------------------------------------------

  select
    o.order_number,
    o.fulfillment_type,
    o.current_status
  into
    v_order_number,
    v_fulfillment_type,
    v_previous_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;


  -- ------------------------------------------------------------
  -- ORDER MUST ACTUALLY BE READY
  -- ------------------------------------------------------------

  if v_previous_status <> 'ready'::public.order_status then
    raise exception
      'Only ready orders may be released.';
  end if;


  -- ------------------------------------------------------------
  -- DETERMINE NEXT STATUS SERVER-SIDE
  -- ------------------------------------------------------------

  if v_fulfillment_type =
    'delivery'::public.fulfillment_type then

    v_next_status :=
      'waiting_for_rider'::public.order_status;

  else
    v_next_status :=
      'completed'::public.order_status;
  end if;


  -- ------------------------------------------------------------
  -- UPDATE ORDER
  -- ------------------------------------------------------------

  update public.orders
  set
    current_status = v_next_status,
    completed_at =
      case
        when v_next_status =
          'completed'::public.order_status
        then now()
        else completed_at
      end
  where id = p_order_id;


  -- ------------------------------------------------------------
  -- AUDIT HISTORY
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
    v_staff_id,
    coalesce(
      nullif(trim(p_notes), ''),
      case
        when v_next_status =
          'waiting_for_rider'::public.order_status
        then 'Ready order released for rider assignment'
        else 'Ready order released and completed'
      end
    )
  );


  -- ------------------------------------------------------------
  -- RETURN RESULT
  -- ------------------------------------------------------------

  return query
  select
    p_order_id,
    v_order_number,
    v_previous_status,
    v_next_status;
end;
$$;


ALTER FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_rider_availability"("p_status" "public"."rider_availability_status") RETURNS TABLE("rider_id" "uuid", "availability_status" "public"."rider_availability_status")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_rider_id uuid;
  v_current_status public.rider_availability_status;
begin
  v_rider_id := auth.uid();

  if v_rider_id is null then
    raise exception 'Authentication is required.';
  end if;


  if p_status not in (
    'available'::public.rider_availability_status,
    'offline'::public.rider_availability_status
  ) then
    raise exception
      'Rider availability may only be set to available or offline.';
  end if;


  if not exists (
    select 1
    from public.profiles p
    where p.id = v_rider_id
      and p.role = 'rider'::public.user_role
      and p.is_active = true
  ) then
    raise exception
      'Only an active rider may change availability.';
  end if;


  select
    r.availability_status
  into
    v_current_status
  from public.riders r
  where r.id = v_rider_id
    and r.approval_status =
      'approved'::public.rider_approval_status
  for update;

  if not found then
    raise exception
      'An approved rider profile was not found.';
  end if;


  /*
   * A Rider must resolve any pending offer or active
   * delivery before manually changing availability.
   */
  if exists (
    select 1
    from public.delivery_assignments da
    where da.rider_id = v_rider_id
      and da.status in (
        'offered'::public.delivery_assignment_status,
        'accepted'::public.delivery_assignment_status,
        'picked_up'::public.delivery_assignment_status,
        'out_for_delivery'::public.delivery_assignment_status
      )
  ) then
    raise exception
      'Availability cannot be changed while a delivery assignment is active.';
  end if;


  update public.riders
  set
    availability_status = p_status,
    updated_at = now()
  where id = v_rider_id;


  return query
  select
    v_rider_id,
    p_status;
end;
$$;


ALTER FUNCTION "public"."set_rider_availability"("p_status" "public"."rider_availability_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_cashier_shift"("p_terminal" "text", "p_opening_cash" numeric) RETURNS TABLE("shift_id" "uuid", "cashier_id" "uuid", "terminal" character varying, "opening_cash" numeric, "status" "public"."cashier_shift_status", "started_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_cashier_id uuid;
  v_terminal text;
  v_shift public.cashier_shifts%rowtype;
begin
  -- ------------------------------------------------------------
  -- AUTHENTICATION
  -- ------------------------------------------------------------

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to start a cashier shift.';
  end if;


  -- ------------------------------------------------------------
  -- AUTHORIZATION
  -- Only an active Cashier account may open a Cashier shift.
  -- ------------------------------------------------------------

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may start a cashier shift.';
  end if;


  -- ------------------------------------------------------------
  -- TERMINAL
  -- ------------------------------------------------------------

  v_terminal :=
    nullif(
      btrim(coalesce(p_terminal, '')),
      ''
    );

  if v_terminal is null then
    raise exception
      'Terminal is required.';
  end if;

  if char_length(v_terminal) > 50 then
    raise exception
      'Terminal cannot exceed 50 characters.';
  end if;


  -- ------------------------------------------------------------
  -- OPENING CASH
  -- ------------------------------------------------------------

  if p_opening_cash is null then
    raise exception
      'Opening cash is required.';
  end if;

  if p_opening_cash < 0 then
    raise exception
      'Opening cash cannot be negative.';
  end if;


  -- ------------------------------------------------------------
  -- EXISTING OPEN SHIFT
  -- Friendly checks before the unique indexes enforce them.
  -- ------------------------------------------------------------

  if exists (
    select 1
    from public.cashier_shifts s
    where s.cashier_id = v_cashier_id
      and s.status =
        'open'::public.cashier_shift_status
  ) then
    raise exception
      'You already have an open cashier shift.';
  end if;

  if exists (
    select 1
    from public.cashier_shifts s
    where lower(s.terminal) =
          lower(v_terminal)
      and s.status =
        'open'::public.cashier_shift_status
  ) then
    raise exception
      'This terminal already has an open cashier shift.';
  end if;


  -- ------------------------------------------------------------
  -- CREATE SHIFT
  -- Cashier identity and time come from PostgreSQL, not React.
  -- ------------------------------------------------------------

  insert into public.cashier_shifts (
    cashier_id,
    terminal,
    opening_cash
  )
  values (
    v_cashier_id,
    v_terminal,
    p_opening_cash
  )
  returning *
  into v_shift;


  -- ------------------------------------------------------------
  -- RETURN CREATED SHIFT
  -- ------------------------------------------------------------

  return query
  select
    v_shift.id,
    v_shift.cashier_id,
    v_shift.terminal,
    v_shift.opening_cash,
    v_shift.status,
    v_shift.started_at;


exception
  when unique_violation then
    raise exception
      'The cashier or terminal already has an open shift.';
end;
$$;


ALTER FUNCTION "public"."start_cashier_shift"("p_terminal" "text", "p_opening_cash" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_kds_terminal"("p_terminal_id" "uuid", "p_terminal_secret" "text") RETURNS TABLE("terminal_id" "uuid", "terminal_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
declare
  v_secret text;
  v_secret_hash text;
begin
  -- Basic input validation.
  if p_terminal_id is null then
    raise exception 'Terminal ID is required.';
  end if;

  v_secret := trim(p_terminal_secret);

  if v_secret is null or v_secret = '' then
    raise exception 'Terminal secret is required.';
  end if;

  -- Our generated secrets have this exact format:
  -- kds_ + 64 hexadecimal characters.
  if v_secret !~ '^kds_[0-9a-f]{64}$' then
    raise exception 'Invalid terminal credential.';
  end if;

  -- Hash what the KDS supplied.
  v_secret_hash :=
    encode(
      extensions.digest(
        v_secret,
        'sha256'
      ),
      'hex'
    );

  /*
   * Return a terminal only when:
   * 1. the UUID exists
   * 2. the credential is active
   * 3. the supplied secret hashes to the stored hash
   *
   * Successful verification also updates last_used_at.
   */
  return query
  update public.kds_terminals kt
  set last_used_at = now()
  where kt.id = p_terminal_id
    and kt.is_active = true
    and kt.secret_hash = v_secret_hash
  returning
    kt.id,
    kt.terminal_name;
end;
$_$;


ALTER FUNCTION "public"."verify_kds_terminal"("p_terminal_id" "uuid", "p_terminal_secret" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cashier_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cashier_id" "uuid" NOT NULL,
    "terminal" character varying(50) NOT NULL,
    "opening_cash" numeric(12,2) NOT NULL,
    "status" "public"."cashier_shift_status" DEFAULT 'open'::"public"."cashier_shift_status" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "actual_cash" numeric(12,2),
    "expected_cash" numeric(12,2),
    "variance" numeric(12,2),
    "variance_reason" "text",
    "notes" "text",
    "closed_by" "uuid",
    "manager_approved_by" "uuid",
    "manager_approved_at" timestamp with time zone,
    CONSTRAINT "cashier_shifts_actual_cash_nonneg_chk" CHECK ((("actual_cash" IS NULL) OR ("actual_cash" >= (0)::numeric))),
    CONSTRAINT "cashier_shifts_expected_cash_nonneg_chk" CHECK ((("expected_cash" IS NULL) OR ("expected_cash" >= (0)::numeric))),
    CONSTRAINT "cashier_shifts_opening_cash_nonneg_chk" CHECK (("opening_cash" >= (0)::numeric)),
    CONSTRAINT "cashier_shifts_status_fields_chk" CHECK (((("status" = 'open'::"public"."cashier_shift_status") AND ("ended_at" IS NULL) AND ("actual_cash" IS NULL) AND ("expected_cash" IS NULL) AND ("variance" IS NULL) AND ("closed_by" IS NULL)) OR (("status" = 'closed'::"public"."cashier_shift_status") AND ("ended_at" IS NOT NULL) AND ("actual_cash" IS NOT NULL) AND ("expected_cash" IS NOT NULL) AND ("variance" IS NOT NULL) AND ("closed_by" IS NOT NULL))))
);


ALTER TABLE "public"."cashier_shifts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cashier_transaction_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cashier_transaction_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cashier_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_number" character varying(20) NOT NULL,
    "receipt_number" character varying(20) NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "cashier_id" "uuid" NOT NULL,
    "status" "public"."cashier_transaction_status" DEFAULT 'completed'::"public"."cashier_transaction_status" NOT NULL,
    "void_reason" "text",
    "voided_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    CONSTRAINT "cashier_transactions_void_fields_chk" CHECK (((("status" = 'completed'::"public"."cashier_transaction_status") AND ("void_reason" IS NULL) AND ("voided_at" IS NULL)) OR (("status" = 'voided'::"public"."cashier_transaction_status") AND ("void_reason" IS NOT NULL) AND ("btrim"("void_reason") <> ''::"text") AND ("voided_at" IS NOT NULL))))
);


ALTER TABLE "public"."cashier_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "rider_id" "uuid" NOT NULL,
    "assignment_method" "public"."assignment_method" DEFAULT 'fairness_rule'::"public"."assignment_method" NOT NULL,
    "status" "public"."delivery_assignment_status" DEFAULT 'offered'::"public"."delivery_assignment_status" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "picked_up_at" timestamp with time zone,
    "out_for_delivery_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "rejection_reason" "text",
    "proof_of_delivery_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "delivery_assignments_status_chk" CHECK (("status" IS NOT NULL))
);


ALTER TABLE "public"."delivery_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_name" character varying(150) NOT NULL,
    "unit" character varying(20) NOT NULL,
    "quantity_on_hand" numeric(12,3) DEFAULT 0 NOT NULL,
    "reorder_level" numeric(12,3) DEFAULT 0 NOT NULL,
    "inventory_category" character varying(100),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_items_quantity_on_hand_nonneg_chk" CHECK (("quantity_on_hand" >= (0)::numeric)),
    CONSTRAINT "inventory_items_reorder_level_nonneg_chk" CHECK (("reorder_level" >= (0)::numeric)),
    CONSTRAINT "inventory_items_unit_len_chk" CHECK (("char_length"(("unit")::"text") <= 20))
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "purchase_order_item_id" "uuid",
    "order_id" "uuid",
    "performed_by" "uuid",
    "transaction_type" "public"."inventory_transaction_type" NOT NULL,
    "quantity_change" numeric(12,3) NOT NULL,
    "quantity_before" numeric(12,3) NOT NULL,
    "quantity_after" numeric(12,3) NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_transactions_qty_after_nonneg_chk" CHECK (("quantity_after" >= (0)::numeric)),
    CONSTRAINT "inventory_transactions_qty_before_nonneg_chk" CHECK (("quantity_before" >= (0)::numeric)),
    CONSTRAINT "inventory_transactions_qty_matches_chk" CHECK (("quantity_after" = ("quantity_before" + "quantity_change")))
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kds_terminals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "terminal_name" "text" NOT NULL,
    "secret_hash" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."kds_terminals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity_required" numeric(12,3) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_ingredients_quantity_required_pos_chk" CHECK (("quantity_required" > (0)::numeric))
);


ALTER TABLE "public"."menu_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_item_modifier_groups" (
    "menu_item_id" "uuid" NOT NULL,
    "group_id" character varying(50) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "menu_item_modifier_groups_sort_nonneg_chk" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."menu_item_modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" character varying(150) NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "image_path" "text",
    "is_available" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "code" character varying(20) NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "menu_items_code_format_chk" CHECK ((("code")::"text" ~ '^[A-Z][A-Z0-9]{0,19}$'::"text")),
    CONSTRAINT "menu_items_price_nonneg_chk" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_modifier_groups" (
    "id" character varying(50) NOT NULL,
    "name" character varying(80) NOT NULL,
    "selection_type" "public"."modifier_selection_type" NOT NULL,
    "min_selections" smallint DEFAULT 0 NOT NULL,
    "max_selections" smallint NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "menu_modifier_groups_max_chk" CHECK (("max_selections" >= 1)),
    CONSTRAINT "menu_modifier_groups_min_chk" CHECK (("min_selections" >= 0)),
    CONSTRAINT "menu_modifier_groups_range_chk" CHECK (("min_selections" <= "max_selections")),
    CONSTRAINT "menu_modifier_groups_single_max_chk" CHECK ((("selection_type" <> 'single'::"public"."modifier_selection_type") OR ("max_selections" = 1)))
);


ALTER TABLE "public"."menu_modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_modifier_options" (
    "id" character varying(50) NOT NULL,
    "group_id" character varying(50) NOT NULL,
    "name" character varying(80) NOT NULL,
    "price_adjustment" numeric(12,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "menu_modifier_options_price_nonneg_chk" CHECK (("price_adjustment" >= (0)::numeric)),
    CONSTRAINT "menu_modifier_options_sort_nonneg_chk" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."menu_modifier_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    "special_instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "item_name" character varying,
    "modifiers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "order_items_line_total_matches_chk" CHECK (("line_total" = ("unit_price" * ("quantity")::numeric))),
    CONSTRAINT "order_items_line_total_nonneg_chk" CHECK (("line_total" >= (0)::numeric)),
    CONSTRAINT "order_items_modifiers_array_chk" CHECK (("jsonb_typeof"("modifiers") = 'array'::"text")),
    CONSTRAINT "order_items_quantity_pos_chk" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_unit_price_nonneg_chk" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "status" "public"."order_status" NOT NULL,
    "changed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" character varying(50) NOT NULL,
    "customer_id" "uuid",
    "processed_by" "uuid",
    "order_channel" "public"."order_channel" NOT NULL,
    "fulfillment_type" "public"."fulfillment_type" NOT NULL,
    "customer_name" character varying(150),
    "customer_contact_number" character varying(20),
    "delivery_address" "text",
    "landmark" "text",
    "geolocation" "text",
    "current_status" "public"."order_status" NOT NULL,
    "subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "table_number" character varying(20),
    "discount_type" character varying(40),
    "discount_reference" character varying(100),
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "orders_customer_contact_len_chk" CHECK ((("customer_contact_number" IS NULL) OR ("char_length"(("customer_contact_number")::"text") <= 20))),
    CONSTRAINT "orders_delivery_address_required_chk" CHECK ((("fulfillment_type" <> 'delivery'::"public"."fulfillment_type") OR (("delivery_address" IS NOT NULL) AND ("delivery_address" <> ''::"text")))),
    CONSTRAINT "orders_delivery_fee_nonneg_chk" CHECK (("delivery_fee" >= (0)::numeric)),
    CONSTRAINT "orders_discount_amount_nonneg_chk" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "orders_discount_not_over_subtotal_chk" CHECK (("discount_amount" <= "subtotal")),
    CONSTRAINT "orders_grand_total_matches_chk" CHECK (("grand_total" = ((("subtotal" - "discount_amount") + "tax_amount") + "delivery_fee"))),
    CONSTRAINT "orders_grand_total_nonneg_chk" CHECK (("grand_total" >= (0)::numeric)),
    CONSTRAINT "orders_subtotal_nonneg_chk" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "orders_tax_amount_nonneg_chk" CHECK (("tax_amount" >= (0)::numeric))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_method" "public"."payment_method" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "gcash_reference_number" character varying(100),
    "proof_image_path" "text",
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cash_received" numeric(12,2),
    CONSTRAINT "payments_amount_nonneg_chk" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_cash_proof_not_required_chk" CHECK ((("payment_method" <> 'cash'::"public"."payment_method") OR ("proof_image_path" IS NULL))),
    CONSTRAINT "payments_cash_received_chk" CHECK (((("payment_method" = 'cash'::"public"."payment_method") AND ("cash_received" IS NOT NULL) AND ("cash_received" >= "amount")) OR (("payment_method" <> 'cash'::"public"."payment_method") AND ("cash_received" IS NULL)))),
    CONSTRAINT "payments_gcash_reference_required_chk" CHECK ((("payment_method" <> 'gcash'::"public"."payment_method") OR (("gcash_reference_number" IS NOT NULL) AND ("btrim"(("gcash_reference_number")::"text") <> ''::"text"))))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" character varying(100),
    "last_name" character varying(100),
    "contact_number" character varying(20),
    "role" "public"."user_role" DEFAULT 'customer'::"public"."user_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    CONSTRAINT "profiles_contact_number_len_chk" CHECK ((("contact_number" IS NULL) OR ("char_length"(("contact_number")::"text") <= 20)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Public application profile connected one-to-one with Supabase auth.users.';



COMMENT ON COLUMN "public"."profiles"."role" IS 'Application access role. Users cannot assign or change their own role.';



CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity_ordered" numeric(12,3) NOT NULL,
    "quantity_received" numeric(12,3) DEFAULT 0 NOT NULL,
    "quantity_remaining" numeric(12,3) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "received_at" timestamp with time zone,
    "expiration_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_order_items_qty_ordered_pos_chk" CHECK (("quantity_ordered" > (0)::numeric)),
    CONSTRAINT "purchase_order_items_qty_received_le_ordered_chk" CHECK (("quantity_received" <= "quantity_ordered")),
    CONSTRAINT "purchase_order_items_qty_received_nonneg_chk" CHECK (("quantity_received" >= (0)::numeric)),
    CONSTRAINT "purchase_order_items_qty_remaining_le_received_chk" CHECK (("quantity_remaining" <= "quantity_received")),
    CONSTRAINT "purchase_order_items_qty_remaining_nonneg_chk" CHECK (("quantity_remaining" >= (0)::numeric)),
    CONSTRAINT "purchase_order_items_total_cost_nonneg_chk" CHECK (("total_cost" >= (0)::numeric)),
    CONSTRAINT "purchase_order_items_unit_cost_nonneg_chk" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_number" character varying(50) NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "status" "public"."purchase_order_status" DEFAULT 'draft'::"public"."purchase_order_status" NOT NULL,
    "ordered_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_orders_total_amount_nonneg_chk" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."riders" (
    "id" "uuid" NOT NULL,
    "valid_id_path" "text",
    "or_cr_document_path" "text",
    "driver_license_number" character varying(100),
    "plate_number" character varying(100),
    "motor_brand" character varying(100),
    "motor_model" character varying(100),
    "rider_photo_path" "text",
    "approval_status" "public"."rider_approval_status" DEFAULT 'pending'::"public"."rider_approval_status" NOT NULL,
    "availability_status" "public"."rider_availability_status" DEFAULT 'offline'::"public"."rider_availability_status" NOT NULL,
    "last_assigned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "riders_driver_plate_chk" CHECK (((("driver_license_number" IS NULL) OR ("char_length"(("driver_license_number")::"text") <= 100)) AND (("plate_number" IS NULL) OR ("char_length"(("plate_number")::"text") <= 100))))
);


ALTER TABLE "public"."riders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "price_per_unit" numeric(12,2) DEFAULT 0 NOT NULL,
    "is_preferred" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_items_price_nonneg_chk" CHECK (("price_per_unit" >= (0)::numeric))
);


ALTER TABLE "public"."supplier_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(150) NOT NULL,
    "contact_person" character varying(150),
    "contact_number" character varying(20),
    "email" character varying(150),
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cashier_shifts"
    ADD CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_payment_id_key" UNIQUE ("payment_id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_receipt_number_key" UNIQUE ("receipt_number");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_transaction_number_key" UNIQUE ("transaction_number");



ALTER TABLE ONLY "public"."delivery_assignments"
    ADD CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_item_name_key" UNIQUE ("item_name");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kds_terminals"
    ADD CONSTRAINT "kds_terminals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kds_terminals"
    ADD CONSTRAINT "kds_terminals_secret_hash_key" UNIQUE ("secret_hash");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_ingredients"
    ADD CONSTRAINT "menu_ingredients_menu_item_inventory_unique" UNIQUE ("menu_item_id", "inventory_item_id");



ALTER TABLE ONLY "public"."menu_ingredients"
    ADD CONSTRAINT "menu_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_item_modifier_groups"
    ADD CONSTRAINT "menu_item_modifier_groups_pkey" PRIMARY KEY ("menu_item_id", "group_id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_modifier_groups"
    ADD CONSTRAINT "menu_modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_modifier_options"
    ADD CONSTRAINT "menu_modifier_options_group_name_key" UNIQUE ("group_id", "name");



ALTER TABLE ONLY "public"."menu_modifier_options"
    ADD CONSTRAINT "menu_modifier_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_unique_purchase_order_inventory" UNIQUE ("purchase_order_id", "inventory_item_id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_po_number_key" UNIQUE ("po_number");



ALTER TABLE ONLY "public"."riders"
    ADD CONSTRAINT "riders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_items"
    ADD CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_items"
    ADD CONSTRAINT "supplier_items_supplier_inventory_unique" UNIQUE ("supplier_id", "inventory_item_id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "cashier_shifts_one_open_per_cashier_idx" ON "public"."cashier_shifts" USING "btree" ("cashier_id") WHERE ("status" = 'open'::"public"."cashier_shift_status");



CREATE UNIQUE INDEX "cashier_shifts_one_open_per_terminal_idx" ON "public"."cashier_shifts" USING "btree" ("lower"(("terminal")::"text")) WHERE ("status" = 'open'::"public"."cashier_shift_status");



CREATE UNIQUE INDEX "delivery_assignments_one_active_per_order_idx" ON "public"."delivery_assignments" USING "btree" ("order_id") WHERE ("status" = ANY (ARRAY['offered'::"public"."delivery_assignment_status", 'accepted'::"public"."delivery_assignment_status", 'picked_up'::"public"."delivery_assignment_status", 'out_for_delivery'::"public"."delivery_assignment_status"]));



CREATE INDEX "delivery_assignments_order_id_idx" ON "public"."delivery_assignments" USING "btree" ("order_id");



CREATE INDEX "delivery_assignments_rider_id_idx" ON "public"."delivery_assignments" USING "btree" ("rider_id");



CREATE INDEX "delivery_assignments_status_idx" ON "public"."delivery_assignments" USING "btree" ("status");



CREATE INDEX "inventory_transactions_inventory_item_id_idx" ON "public"."inventory_transactions" USING "btree" ("inventory_item_id");



CREATE INDEX "inventory_transactions_order_id_idx" ON "public"."inventory_transactions" USING "btree" ("order_id");



CREATE INDEX "inventory_transactions_purchase_order_item_id_idx" ON "public"."inventory_transactions" USING "btree" ("purchase_order_item_id");



CREATE INDEX "menu_ingredients_inventory_item_id_idx" ON "public"."menu_ingredients" USING "btree" ("inventory_item_id");



CREATE INDEX "menu_ingredients_menu_item_id_idx" ON "public"."menu_ingredients" USING "btree" ("menu_item_id");



CREATE INDEX "menu_items_category_id_idx" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "menu_items_is_available_idx" ON "public"."menu_items" USING "btree" ("is_available");



CREATE INDEX "order_items_order_id_idx" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "order_status_history_order_id_idx" ON "public"."order_status_history" USING "btree" ("order_id");



CREATE INDEX "orders_created_at_idx" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "orders_current_status_idx" ON "public"."orders" USING "btree" ("current_status");



CREATE INDEX "orders_customer_id_idx" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "orders_processed_by_idx" ON "public"."orders" USING "btree" ("processed_by");



CREATE UNIQUE INDEX "payments_gcash_reference_unique_idx" ON "public"."payments" USING "btree" ("lower"("btrim"(("gcash_reference_number")::"text"))) WHERE (("payment_method" = 'gcash'::"public"."payment_method") AND ("gcash_reference_number" IS NOT NULL));



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "profiles_role_idx" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "purchase_order_items_inventory_item_id_idx" ON "public"."purchase_order_items" USING "btree" ("inventory_item_id");



CREATE INDEX "purchase_order_items_quantity_remaining_idx" ON "public"."purchase_order_items" USING "btree" ("quantity_remaining");



CREATE INDEX "purchase_order_items_received_at_idx" ON "public"."purchase_order_items" USING "btree" ("received_at");



CREATE INDEX "purchase_orders_status_idx" ON "public"."purchase_orders" USING "btree" ("status");



CREATE INDEX "purchase_orders_supplier_id_idx" ON "public"."purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "riders_approval_status_idx" ON "public"."riders" USING "btree" ("approval_status");



CREATE INDEX "riders_availability_status_idx" ON "public"."riders" USING "btree" ("availability_status");



CREATE INDEX "supplier_items_inventory_item_id_idx" ON "public"."supplier_items" USING "btree" ("inventory_item_id");



CREATE INDEX "supplier_items_supplier_id_idx" ON "public"."supplier_items" USING "btree" ("supplier_id");



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "riders_set_updated_at" BEFORE UPDATE ON "public"."riders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_delivery_assignments_set_updated_at" BEFORE UPDATE ON "public"."delivery_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inventory_items_set_updated_at" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_menu_categories_set_updated_at" BEFORE UPDATE ON "public"."menu_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_menu_items_set_updated_at" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_purchase_order_items_set_updated_at" BEFORE UPDATE ON "public"."purchase_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_purchase_orders_set_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_riders_set_updated_at" BEFORE UPDATE ON "public"."riders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_supplier_items_set_updated_at" BEFORE UPDATE ON "public"."supplier_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_suppliers_set_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."cashier_shifts"
    ADD CONSTRAINT "cashier_shifts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cashier_shifts"
    ADD CONSTRAINT "cashier_shifts_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cashier_shifts"
    ADD CONSTRAINT "cashier_shifts_manager_approved_by_fkey" FOREIGN KEY ("manager_approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."cashier_transactions"
    ADD CONSTRAINT "cashier_transactions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."cashier_shifts"("id");



ALTER TABLE ONLY "public"."delivery_assignments"
    ADD CONSTRAINT "delivery_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_assignments"
    ADD CONSTRAINT "delivery_assignments_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_ingredients"
    ADD CONSTRAINT "menu_ingredients_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."menu_ingredients"
    ADD CONSTRAINT "menu_ingredients_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_item_modifier_groups"
    ADD CONSTRAINT "menu_item_modifier_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."menu_modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_item_modifier_groups"
    ADD CONSTRAINT "menu_item_modifier_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."menu_modifier_options"
    ADD CONSTRAINT "menu_modifier_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."menu_modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."riders"
    ADD CONSTRAINT "riders_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_items"
    ADD CONSTRAINT "supplier_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_items"
    ADD CONSTRAINT "supplier_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE "public"."cashier_shifts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cashier_shifts_select_staff" ON "public"."cashier_shifts" FOR SELECT TO "authenticated" USING ((("cashier_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = 'manager'::"public"."user_role"))))));



ALTER TABLE "public"."cashier_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cashier_transactions_select_staff" ON "public"."cashier_transactions" FOR SELECT TO "authenticated" USING ((("cashier_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = 'manager'::"public"."user_role"))))));



CREATE POLICY "customers_select_own_order_items" ON "public"."order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."customer_id" = "auth"."uid"())))));



CREATE POLICY "customers_select_own_order_status_history" ON "public"."order_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_status_history"."order_id") AND ("o"."customer_id" = "auth"."uid"())))));



CREATE POLICY "customers_select_own_orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (("customer_id" = "auth"."uid"()));



ALTER TABLE "public"."delivery_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kds_terminals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "managers_view_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."current_user_role"() = 'manager'::"public"."user_role"));



ALTER TABLE "public"."menu_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_categories_select_active" ON "public"."menu_categories" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."menu_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_item_modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_items_select_active" ON "public"."menu_items" FOR SELECT USING ((("is_active" = true) AND ("is_available" = true)));



CREATE POLICY "menu_items_select_staff" ON "public"."menu_items" FOR SELECT TO "authenticated" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['cashier'::"public"."user_role", 'manager'::"public"."user_role"])))))));



ALTER TABLE "public"."menu_modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_modifier_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_view_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rider_select_assigned_order_items" ON "public"."order_items" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = 'rider'::"public"."user_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."delivery_assignments" "da"
  WHERE (("da"."order_id" = "order_items"."order_id") AND ("da"."rider_id" = "auth"."uid"()) AND ("da"."status" = ANY (ARRAY['offered'::"public"."delivery_assignment_status", 'accepted'::"public"."delivery_assignment_status", 'picked_up'::"public"."delivery_assignment_status", 'out_for_delivery'::"public"."delivery_assignment_status", 'delivered'::"public"."delivery_assignment_status"])))))));



CREATE POLICY "rider_select_assigned_orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = 'rider'::"public"."user_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."delivery_assignments" "da"
  WHERE (("da"."order_id" = "orders"."id") AND ("da"."rider_id" = "auth"."uid"()) AND ("da"."status" = ANY (ARRAY['offered'::"public"."delivery_assignment_status", 'accepted'::"public"."delivery_assignment_status", 'picked_up'::"public"."delivery_assignment_status", 'out_for_delivery'::"public"."delivery_assignment_status", 'delivered'::"public"."delivery_assignment_status"])))))));



CREATE POLICY "rider_select_own_assignments" ON "public"."delivery_assignments" FOR SELECT TO "authenticated" USING (("rider_id" = "auth"."uid"()));



ALTER TABLE "public"."riders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "riders_view_own_application" ON "public"."riders" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."current_user_role"() = 'manager'::"public"."user_role")));



CREATE POLICY "staff_select_order_items" ON "public"."order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['cashier'::"public"."user_role", 'manager'::"public"."user_role"]))))));



CREATE POLICY "staff_select_order_status_history" ON "public"."order_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['cashier'::"public"."user_role", 'manager'::"public"."user_role"]))))));



CREATE POLICY "staff_select_orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_active" = true) AND ("p"."role" = ANY (ARRAY['cashier'::"public"."user_role", 'manager'::"public"."user_role"]))))));



ALTER TABLE "public"."supplier_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."delivery_assignments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_status_history";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."accept_rider_offer"("p_assignment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_rider_offer"("p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_rider_offer"("p_assignment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."advance_kds_order"("p_terminal_id" "uuid", "p_terminal_secret" "text", "p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_kds_order"("p_terminal_id" "uuid", "p_terminal_secret" "text", "p_order_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."advance_kds_order"("p_terminal_id" "uuid", "p_terminal_secret" "text", "p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_kds_order"("p_terminal_id" "uuid", "p_terminal_secret" "text", "p_order_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."advance_rider_delivery"("p_assignment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_rider_delivery"("p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_rider_delivery"("p_assignment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_order"("p_order_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_cashier_shift"("p_actual_cash" numeric, "p_variance_reason" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_cashier_shift"("p_actual_cash" numeric, "p_variance_reason" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_cashier_shift"("p_actual_cash" numeric, "p_variance_reason" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_rider_delivery"("p_assignment_id" "uuid", "p_proof_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_rider_delivery"("p_assignment_id" "uuid", "p_proof_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_rider_delivery"("p_assignment_id" "uuid", "p_proof_path" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_order"("p_order_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_order"("p_order_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_order"("p_order_id" "uuid", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_walk_in_sale"("p_request_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type", "p_customer_name" "text", "p_contact_number" "text", "p_table_number" "text", "p_discount_type" "text", "p_discount_reference" "text", "p_order_instructions" "text", "p_payment_method" "public"."payment_method", "p_cash_received" numeric, "p_gcash_reference_number" "text", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_walk_in_sale"("p_request_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type", "p_customer_name" "text", "p_contact_number" "text", "p_table_number" "text", "p_discount_type" "text", "p_discount_reference" "text", "p_order_instructions" "text", "p_payment_method" "public"."payment_method", "p_cash_received" numeric, "p_gcash_reference_number" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_walk_in_sale"("p_request_id" "uuid", "p_fulfillment_type" "public"."fulfillment_type", "p_customer_name" "text", "p_contact_number" "text", "p_table_number" "text", "p_discount_type" "text", "p_discount_reference" "text", "p_order_instructions" "text", "p_payment_method" "public"."payment_method", "p_cash_received" numeric, "p_gcash_reference_number" "text", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_kds_queue"("p_terminal_id" "uuid", "p_terminal_secret" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_kds_queue"("p_terminal_id" "uuid", "p_terminal_secret" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_kds_queue"("p_terminal_id" "uuid", "p_terminal_secret" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_kds_queue"("p_terminal_id" "uuid", "p_terminal_secret" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."offer_order_to_next_rider"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."offer_order_to_next_rider"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."offer_order_to_next_rider"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."place_customer_order"("p_customer_name" "text", "p_contact_number" "text", "p_delivery_address" "text", "p_landmark" "text", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."place_customer_order"("p_customer_name" "text", "p_contact_number" "text", "p_delivery_address" "text", "p_landmark" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."place_customer_order"("p_customer_name" "text", "p_contact_number" "text", "p_delivery_address" "text", "p_landmark" "text", "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."provision_kds_terminal"("p_terminal_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provision_kds_terminal"("p_terminal_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provision_kds_terminal"("p_terminal_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_rider_offer"("p_assignment_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_rider_offer"("p_assignment_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_rider_offer"("p_assignment_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_rider_availability"("p_status" "public"."rider_availability_status") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_rider_availability"("p_status" "public"."rider_availability_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_rider_availability"("p_status" "public"."rider_availability_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_cashier_shift"("p_terminal" "text", "p_opening_cash" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_cashier_shift"("p_terminal" "text", "p_opening_cash" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_cashier_shift"("p_terminal" "text", "p_opening_cash" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_kds_terminal"("p_terminal_id" "uuid", "p_terminal_secret" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_kds_terminal"("p_terminal_id" "uuid", "p_terminal_secret" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."verify_kds_terminal"("p_terminal_id" "uuid", "p_terminal_secret" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_kds_terminal"("p_terminal_id" "uuid", "p_terminal_secret" "text") TO "authenticated";


















GRANT SELECT,MAINTAIN ON TABLE "public"."cashier_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."cashier_shifts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cashier_transaction_number_seq" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cashier_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."cashier_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_assignments" TO "anon";
GRANT ALL ON TABLE "public"."delivery_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."kds_terminals" TO "service_role";



GRANT ALL ON TABLE "public"."menu_categories" TO "anon";
GRANT ALL ON TABLE "public"."menu_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."menu_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."menu_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."menu_item_modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."menu_modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."menu_modifier_options" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("first_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("last_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("contact_number") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."riders" TO "authenticated";
GRANT ALL ON TABLE "public"."riders" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_items" TO "anon";
GRANT ALL ON TABLE "public"."supplier_items" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_items" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke references on table "public"."cashier_shifts" from "anon";

revoke trigger on table "public"."cashier_shifts" from "anon";

revoke truncate on table "public"."cashier_shifts" from "anon";

revoke references on table "public"."cashier_shifts" from "authenticated";

revoke trigger on table "public"."cashier_shifts" from "authenticated";

revoke truncate on table "public"."cashier_shifts" from "authenticated";

revoke references on table "public"."cashier_transactions" from "anon";

revoke trigger on table "public"."cashier_transactions" from "anon";

revoke truncate on table "public"."cashier_transactions" from "anon";

revoke references on table "public"."cashier_transactions" from "authenticated";

revoke trigger on table "public"."cashier_transactions" from "authenticated";

revoke truncate on table "public"."cashier_transactions" from "authenticated";

revoke references on table "public"."kds_terminals" from "anon";

revoke trigger on table "public"."kds_terminals" from "anon";

revoke truncate on table "public"."kds_terminals" from "anon";

revoke references on table "public"."kds_terminals" from "authenticated";

revoke trigger on table "public"."kds_terminals" from "authenticated";

revoke truncate on table "public"."kds_terminals" from "authenticated";

revoke references on table "public"."menu_item_modifier_groups" from "anon";

revoke trigger on table "public"."menu_item_modifier_groups" from "anon";

revoke truncate on table "public"."menu_item_modifier_groups" from "anon";

revoke references on table "public"."menu_item_modifier_groups" from "authenticated";

revoke trigger on table "public"."menu_item_modifier_groups" from "authenticated";

revoke truncate on table "public"."menu_item_modifier_groups" from "authenticated";

revoke references on table "public"."menu_modifier_groups" from "anon";

revoke trigger on table "public"."menu_modifier_groups" from "anon";

revoke truncate on table "public"."menu_modifier_groups" from "anon";

revoke references on table "public"."menu_modifier_groups" from "authenticated";

revoke trigger on table "public"."menu_modifier_groups" from "authenticated";

revoke truncate on table "public"."menu_modifier_groups" from "authenticated";

revoke references on table "public"."menu_modifier_options" from "anon";

revoke trigger on table "public"."menu_modifier_options" from "anon";

revoke truncate on table "public"."menu_modifier_options" from "anon";

revoke references on table "public"."menu_modifier_options" from "authenticated";

revoke trigger on table "public"."menu_modifier_options" from "authenticated";

revoke truncate on table "public"."menu_modifier_options" from "authenticated";

revoke references on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke references on table "public"."riders" from "anon";

revoke trigger on table "public"."riders" from "anon";

revoke truncate on table "public"."riders" from "anon";

revoke references on table "public"."riders" from "authenticated";

revoke trigger on table "public"."riders" from "authenticated";

revoke truncate on table "public"."riders" from "authenticated";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "customer_read_own_payment_proof"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'payment-proofs'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE (((o.id)::text = split_part(objects.name, '/'::text, 2)) AND (o.customer_id = auth.uid()))))));



  create policy "customer_upload_own_payment_proof"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'payment-proofs'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.profiles p ON ((p.id = o.customer_id)))
  WHERE (((o.id)::text = split_part(objects.name, '/'::text, 2)) AND (o.customer_id = auth.uid()) AND (o.current_status = 'waiting_payment_verification'::public.order_status) AND (p.role = 'customer'::public.user_role) AND (p.is_active = true))))));



  create policy "rider_read_own_delivery_proof"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'delivery-proofs'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.delivery_assignments da
  WHERE (((da.id)::text = split_part(objects.name, '/'::text, 2)) AND (da.rider_id = auth.uid()))))));



  create policy "rider_upload_own_delivery_proof"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'delivery-proofs'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM ((public.delivery_assignments da
     JOIN public.profiles p ON ((p.id = da.rider_id)))
     JOIN public.riders r ON ((r.id = da.rider_id)))
  WHERE (((da.id)::text = split_part(objects.name, '/'::text, 2)) AND (da.rider_id = auth.uid()) AND (da.status = 'out_for_delivery'::public.delivery_assignment_status) AND (p.role = 'rider'::public.user_role) AND (p.is_active = true) AND (r.approval_status = 'approved'::public.rider_approval_status))))));



  create policy "staff_read_payment_proofs"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'payment-proofs'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_active = true) AND (p.role = ANY (ARRAY['cashier'::public.user_role, 'manager'::public.user_role])))))));



