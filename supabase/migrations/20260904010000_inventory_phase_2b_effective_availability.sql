-- RRJ'S FOOD-HOUSE
-- Inventory Phase 2B: inventory-aware menu availability and customer cart validation.

-- ============================================================
-- 1. EFFECTIVE MENU AVAILABILITY
-- ============================================================

create or replace function public.get_menu_effective_availability()
returns table (
  menu_item_id uuid,
  effective_available boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    menu_item.id as menu_item_id,
    menu_item.is_available
      and not exists (
        select 1
        from public.menu_ingredients menu_ingredient
        left join public.inventory_items inventory_item
          on inventory_item.id = menu_ingredient.inventory_item_id
        where menu_ingredient.menu_item_id = menu_item.id
          and (
            inventory_item.id is null
            or not inventory_item.is_active
            or inventory_item.quantity_on_hand
              < menu_ingredient.quantity_required
          )
      ) as effective_available
  from public.menu_items menu_item
  where menu_item.is_active = true;
$$;

revoke all
on function public.get_menu_effective_availability()
from public;

grant execute
on function public.get_menu_effective_availability()
to anon, authenticated, service_role;


-- ============================================================
-- 2. INTERNAL REQUESTED-CART STOCK VALIDATION
-- ============================================================

create or replace function public.assert_inventory_available_for_requested_items(
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inventory_item_id uuid;
  v_inventory_item_exists boolean;
  v_item_name text;
  v_is_active boolean;
  v_quantity_on_hand numeric;
  v_required_quantity numeric;
begin
  with requested_items as (
    select
      (item ->> 'id')::uuid as menu_item_id,
      sum((item ->> 'qty')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as item
    group by (item ->> 'id')::uuid
  ),
  required_inventory as (
    select
      menu_ingredient.inventory_item_id,
      sum(
        requested.quantity::numeric
          * menu_ingredient.quantity_required
      ) as required_quantity
    from requested_items requested
    join public.menu_ingredients menu_ingredient
      on menu_ingredient.menu_item_id = requested.menu_item_id
    group by menu_ingredient.inventory_item_id
  )
  select
    requirement.inventory_item_id,
    inventory_item.id is not null,
    inventory_item.item_name,
    inventory_item.is_active,
    inventory_item.quantity_on_hand,
    requirement.required_quantity
  into
    v_inventory_item_id,
    v_inventory_item_exists,
    v_item_name,
    v_is_active,
    v_quantity_on_hand,
    v_required_quantity
  from required_inventory requirement
  left join public.inventory_items inventory_item
    on inventory_item.id = requirement.inventory_item_id
  where inventory_item.id is null
    or not inventory_item.is_active
    or inventory_item.quantity_on_hand < requirement.required_quantity
  order by requirement.inventory_item_id
  limit 1;

  if not found then
    return;
  end if;

  if not v_inventory_item_exists then
    raise exception
      'Inventory item % required by the requested cart was not found.',
      v_inventory_item_id
      using errcode = 'P0002';
  end if;

  if not v_is_active then
    raise exception
      'Inventory item "%" required by the requested cart is inactive.',
      v_item_name
      using errcode = '22023';
  end if;

  raise exception
    'Insufficient stock for "%": available %, required %.',
    v_item_name,
    to_char(v_quantity_on_hand, 'FM999999999999990.000'),
    to_char(v_required_quantity, 'FM999999999999990.000')
    using errcode = '22023';
end;
$$;

revoke all
on function public.assert_inventory_available_for_requested_items(jsonb)
from public;

revoke all
on function public.assert_inventory_available_for_requested_items(jsonb)
from anon;

revoke all
on function public.assert_inventory_available_for_requested_items(jsonb)
from authenticated;

grant execute
on function public.assert_inventory_available_for_requested_items(jsonb)
to service_role;


-- ============================================================
-- 3. CUSTOMER ORDER PRE-PAYMENT STOCK VALIDATION
-- ============================================================

create or replace function public.place_customer_order(
  p_customer_name text,
  p_contact_number text,
  p_delivery_address text,
  p_landmark text,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number character varying,
  subtotal numeric,
  delivery_fee numeric,
  grand_total numeric,
  current_status public.order_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  perform public.assert_inventory_available_for_requested_items(p_items);

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
$$;

revoke all
on function public.place_customer_order(text, text, text, text, jsonb)
from public;

grant all
on function public.place_customer_order(text, text, text, text, jsonb)
to authenticated;

grant all
on function public.place_customer_order(text, text, text, text, jsonb)
to service_role;
