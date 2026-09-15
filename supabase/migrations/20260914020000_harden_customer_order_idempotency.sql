begin;

-- ============================================================
-- BACKEND HARDENING BATCH 4
-- Customer order idempotency.
--
-- One checkout attempt receives one request UUID.
-- Replaying the same request returns the original order instead
-- of creating another order.
-- ============================================================

alter table public.orders
add column if not exists customer_request_id uuid;

create unique index if not exists
  orders_customer_request_id_uidx
on public.orders (
  customer_id,
  customer_request_id
)
where customer_request_id is not null;


-- Remove the old non-idempotent RPC signature.
drop function if exists public.place_customer_order(
  text,
  text,
  text,
  text,
  jsonb
);


create function public.place_customer_order(
  p_customer_name text,
  p_contact_number text,
  p_delivery_address text,
  p_landmark text,
  p_items jsonb,
  p_request_id uuid
)
returns table(
  order_id uuid,
  order_number character varying,
  subtotal numeric,
  delivery_fee numeric,
  grand_total numeric,
  current_status public.order_status
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number varchar;

  v_subtotal numeric := 0;
  v_delivery_fee numeric := 50;
  v_grand_total numeric := 0;

  v_requested_item_count integer := 0;
  v_valid_item_count integer := 0;

  v_existing_order public.orders%rowtype;
begin
  -- ============================================================
  -- AUTHENTICATION / AUTHORIZATION
  -- ============================================================

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


  -- ============================================================
  -- IDEMPOTENCY REQUEST ID
  -- ============================================================

  if p_request_id is null then
    raise exception
      'Order request ID is required.';
  end if;

  -- Serialize concurrent calls from this customer using the same
  -- checkout request ID.
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_customer_id::text || ':' || p_request_id::text,
      0
    )
  );

  -- A previous request may already have completed successfully.
  select o.*
  into v_existing_order
  from public.orders o
  where o.customer_id = v_customer_id
    and o.customer_request_id = p_request_id
  limit 1;

  if found then
    return query
    select
      v_existing_order.id,
      v_existing_order.order_number,
      v_existing_order.subtotal,
      v_existing_order.delivery_fee,
      v_existing_order.grand_total,
      v_existing_order.current_status;

    return;
  end if;


  -- ============================================================
  -- CUSTOMER DETAILS
  -- ============================================================

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


  -- ============================================================
  -- CART VALIDATION
  -- ============================================================

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


  -- ============================================================
  -- MENU VALIDATION
  -- ============================================================

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


  -- ============================================================
  -- INVENTORY CHECK
  -- ============================================================

  perform public.assert_inventory_available_for_requested_items(
    p_items
  );


  -- ============================================================
  -- SERVER-AUTHORITATIVE PRICING
  -- ============================================================

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


  -- ============================================================
  -- CREATE ORDER
  -- ============================================================

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
    grand_total,
    customer_request_id
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
    v_grand_total,
    p_request_id
  );


  -- ============================================================
  -- ORDER ITEMS
  -- ============================================================

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


  -- ============================================================
  -- HISTORY
  -- ============================================================

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
$function$;


-- Browser callers must be authenticated.
revoke execute
on function public.place_customer_order(
  text,
  text,
  text,
  text,
  jsonb,
  uuid
)
from public, anon;

grant execute
on function public.place_customer_order(
  text,
  text,
  text,
  text,
  jsonb,
  uuid
)
to authenticated, service_role;

commit;