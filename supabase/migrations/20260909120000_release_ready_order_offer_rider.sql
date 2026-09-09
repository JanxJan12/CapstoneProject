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
  -- CREATE DELIVERY OFFER IN THIS TRANSACTION
  -- ------------------------------------------------------------

  if v_fulfillment_type =
    'delivery'::public.fulfillment_type then

    perform public.offer_order_to_next_rider(p_order_id);
  end if;


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

REVOKE ALL ON FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_ready_order"("p_order_id" "uuid", "p_notes" "text") TO "service_role";
