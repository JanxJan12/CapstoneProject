-- RRJ'S FOOD-HOUSE
-- Secure cashier editing of non-financial order details.

create or replace function public.update_cashier_order_operational_details(
  p_order_id uuid,
  p_customer_name text,
  p_contact_number text,
  p_table_number text default null,
  p_delivery_address text default null,
  p_order_instructions text default null
)
returns table (
  order_id uuid,
  order_number varchar,
  current_status public.order_status,
  edited_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cashier_id uuid;
  v_order_number varchar;
  v_current_status public.order_status;
  v_fulfillment_type public.fulfillment_type;
  v_customer_name text;
  v_contact_number text;
  v_table_number text;
  v_delivery_address text;
  v_order_instructions text;
  v_edited_at timestamptz;
begin
  if p_order_id is null then
    raise exception 'Order is required.'
      using errcode = '22023';
  end if;

  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  perform 1
  from public.profiles profile
  where profile.id = v_cashier_id
    and profile.role = 'cashier'::public.user_role
    and profile.is_active = true
  for share;

  if not found then
    raise exception
      'Only an active cashier account may edit order operational details.'
      using errcode = '42501';
  end if;

  v_customer_name := nullif(btrim(p_customer_name), '');
  v_contact_number := nullif(btrim(p_contact_number), '');
  v_table_number := nullif(btrim(p_table_number), '');
  v_delivery_address := nullif(btrim(p_delivery_address), '');
  v_order_instructions := nullif(btrim(p_order_instructions), '');

  if v_customer_name is null then
    raise exception 'Customer name is required.'
      using errcode = '22023';
  end if;

  if char_length(v_customer_name) > 80 then
    raise exception 'Customer name must not exceed 80 characters.'
      using errcode = '22023';
  end if;

  if v_contact_number is null then
    raise exception 'Contact number is required.'
      using errcode = '22023';
  end if;

  if char_length(v_contact_number) > 20 then
    raise exception 'Contact number must not exceed 20 characters.'
      using errcode = '22023';
  end if;

  if v_table_number is not null
    and char_length(v_table_number) > 20
  then
    raise exception 'Table number must not exceed 20 characters.'
      using errcode = '22023';
  end if;

  if v_delivery_address is not null
    and char_length(v_delivery_address) > 200
  then
    raise exception 'Delivery address must not exceed 200 characters.'
      using errcode = '22023';
  end if;

  if v_order_instructions is not null
    and char_length(v_order_instructions) > 500
  then
    raise exception 'Order instructions must not exceed 500 characters.'
      using errcode = '22023';
  end if;

  select
    orders.order_number,
    orders.current_status,
    orders.fulfillment_type
  into
    v_order_number,
    v_current_status,
    v_fulfillment_type
  from public.orders orders
  where orders.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.'
      using errcode = 'P0002';
  end if;

  if v_current_status not in (
    'waiting_payment_verification'::public.order_status,
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status,
    'waiting_for_rider'::public.order_status
  ) then
    raise exception
      'This order can no longer be edited at its current stage.'
      using errcode = '22023';
  end if;

  if v_fulfillment_type = 'delivery'::public.fulfillment_type
    and v_delivery_address is null
  then
    raise exception 'Delivery address is required for delivery orders.'
      using errcode = '22023';
  end if;

  v_edited_at := now();

  update public.orders orders
  set
    customer_name = v_customer_name,
    customer_contact_number = v_contact_number,
    table_number = case
      when v_fulfillment_type = 'dine_in'::public.fulfillment_type
        then v_table_number
      else null
    end,
    delivery_address = case
      when v_fulfillment_type = 'delivery'::public.fulfillment_type
        then v_delivery_address
      else null
    end,
    notes = v_order_instructions
  where orders.id = p_order_id;

  insert into public.order_status_history (
    order_id,
    status,
    changed_by,
    notes,
    created_at
  )
  values (
    p_order_id,
    v_current_status,
    v_cashier_id,
    'Operational order details updated by cashier',
    v_edited_at
  );

  return query
  select
    p_order_id,
    v_order_number,
    v_current_status,
    v_edited_at;
end;
$$;

revoke all
on function public.update_cashier_order_operational_details(
  uuid,
  text,
  text,
  text,
  text,
  text
)
from public;

grant execute
on function public.update_cashier_order_operational_details(
  uuid,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

grant execute
on function public.update_cashier_order_operational_details(
  uuid,
  text,
  text,
  text,
  text,
  text
)
to service_role;
