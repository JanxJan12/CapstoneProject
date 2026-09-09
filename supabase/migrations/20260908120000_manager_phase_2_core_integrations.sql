-- RRJ Food-House Manager Phase 2 core integrations.
-- Adds only the secure manager APIs needed by Menu, Customers, and Riders.

create or replace function public.get_manager_menu_items()
returns table (
  id uuid,
  code text,
  name text,
  description text,
  category_name text,
  price numeric,
  is_active boolean,
  is_available boolean,
  effective_available boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  return query
  select
    menu_item.id,
    menu_item.code::text,
    menu_item.name::text,
    nullif(btrim(menu_item.description), '')::text,
    menu_category.name::text,
    menu_item.price,
    menu_item.is_active,
    menu_item.is_available,
    menu_item.is_active
      and menu_item.is_available
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
      ) as effective_available,
    menu_item.updated_at
  from public.menu_items menu_item
  join public.menu_categories menu_category
    on menu_category.id = menu_item.category_id
  order by menu_category.name, menu_item.name, menu_item.id;
end;
$$;


create or replace function public.set_manager_menu_item_availability(
  p_menu_item_id uuid,
  p_is_available boolean
)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  category_name text,
  price numeric,
  is_active boolean,
  is_available boolean,
  effective_available boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_menu_item public.menu_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_menu_item_id is null or p_is_available is null then
    raise exception 'Menu item and availability are required.'
      using errcode = '22023';
  end if;

  select menu_item.*
  into v_menu_item
  from public.menu_items menu_item
  where menu_item.id = p_menu_item_id
  for update;

  if not found then
    raise exception 'Menu item not found.'
      using errcode = 'P0002';
  end if;

  if not v_menu_item.is_active then
    raise exception 'Availability cannot be changed for an inactive menu item.'
      using errcode = '22023';
  end if;

  update public.menu_items menu_item
  set
    is_available = p_is_available,
    updated_at = now()
  where menu_item.id = v_menu_item.id
  returning menu_item.* into v_menu_item;

  return query
  select
    v_menu_item.id,
    v_menu_item.code::text,
    v_menu_item.name::text,
    nullif(btrim(v_menu_item.description), '')::text,
    menu_category.name::text,
    v_menu_item.price,
    v_menu_item.is_active,
    v_menu_item.is_available,
    v_menu_item.is_active
      and v_menu_item.is_available
      and not exists (
        select 1
        from public.menu_ingredients menu_ingredient
        left join public.inventory_items inventory_item
          on inventory_item.id = menu_ingredient.inventory_item_id
        where menu_ingredient.menu_item_id = v_menu_item.id
          and (
            inventory_item.id is null
            or not inventory_item.is_active
            or inventory_item.quantity_on_hand
              < menu_ingredient.quantity_required
          )
      ) as effective_available,
    v_menu_item.updated_at
  from public.menu_categories menu_category
  where menu_category.id = v_menu_item.category_id;
end;
$$;


create or replace function public.get_manager_customers()
returns table (
  id uuid,
  customer_name text,
  contact_number text,
  is_active boolean,
  order_count bigint,
  last_order_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  return query
  select
    customer.id,
    coalesce(
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(customer.first_name), ''),
            nullif(btrim(customer.last_name), '')
          )
        ),
        ''
      ),
      nullif(btrim(recent_order.customer_name), ''),
      'Customer'
    )::text as customer_name,
    coalesce(
      nullif(btrim(customer.contact_number), ''),
      nullif(btrim(recent_order.customer_contact_number), '')
    )::text as contact_number,
    customer.is_active,
    order_stats.order_count,
    recent_order.created_at as last_order_at,
    customer.created_at
  from public.profiles customer
  left join lateral (
    select
      count(*)::bigint as order_count
    from public.orders customer_order
    where customer_order.customer_id = customer.id
  ) order_stats on true
  left join lateral (
    select
      customer_order.customer_name,
      customer_order.customer_contact_number,
      customer_order.created_at
    from public.orders customer_order
    where customer_order.customer_id = customer.id
    order by customer_order.created_at desc, customer_order.id desc
    limit 1
  ) recent_order on true
  where customer.role = 'customer'::public.user_role
  order by recent_order.created_at desc nulls last, customer.created_at desc;
end;
$$;


create or replace function public.get_manager_riders()
returns table (
  id uuid,
  rider_name text,
  contact_number text,
  driver_license_number text,
  plate_number text,
  motor_brand text,
  motor_model text,
  approval_status public.rider_approval_status,
  availability_status public.rider_availability_status,
  is_active boolean,
  deliveries_today bigint,
  total_deliveries bigint,
  last_assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'manager'::public.user_role
      and profile.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  return query
  select
    rider.id,
    coalesce(
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(rider_profile.first_name), ''),
            nullif(btrim(rider_profile.last_name), '')
          )
        ),
        ''
      ),
      'Rider'
    )::text as rider_name,
    nullif(btrim(rider_profile.contact_number), '')::text,
    nullif(btrim(rider.driver_license_number), '')::text,
    nullif(btrim(rider.plate_number), '')::text,
    nullif(btrim(rider.motor_brand), '')::text,
    nullif(btrim(rider.motor_model), '')::text,
    rider.approval_status,
    rider.availability_status,
    rider_profile.is_active,
    delivery_stats.deliveries_today,
    delivery_stats.total_deliveries,
    rider.last_assigned_at
  from public.riders rider
  join public.profiles rider_profile
    on rider_profile.id = rider.id
  left join lateral (
    select
      count(*) filter (
        where assignment.status = 'delivered'::public.delivery_assignment_status
          and assignment.delivered_at >= (
            (current_timestamp at time zone 'Asia/Manila')::date
            at time zone 'Asia/Manila'
          )
          and assignment.delivered_at < (
            ((current_timestamp at time zone 'Asia/Manila')::date + 1)
            at time zone 'Asia/Manila'
          )
      )::bigint as deliveries_today,
      count(*) filter (
        where assignment.status = 'delivered'::public.delivery_assignment_status
      )::bigint as total_deliveries
    from public.delivery_assignments assignment
    where assignment.rider_id = rider.id
  ) delivery_stats on true
  where rider_profile.role = 'rider'::public.user_role
  order by
    case rider.approval_status
      when 'approved'::public.rider_approval_status then 0
      when 'pending'::public.rider_approval_status then 1
      when 'suspended'::public.rider_approval_status then 2
      else 3
    end,
    rider_profile.first_name,
    rider_profile.last_name,
    rider.id;
end;
$$;


revoke all on function public.get_manager_menu_items() from public;
revoke all on function public.set_manager_menu_item_availability(uuid, boolean) from public;
revoke all on function public.get_manager_customers() from public;
revoke all on function public.get_manager_riders() from public;

grant execute on function public.get_manager_menu_items()
to authenticated, service_role;

grant execute on function public.set_manager_menu_item_availability(uuid, boolean)
to authenticated, service_role;

grant execute on function public.get_manager_customers()
to authenticated, service_role;

grant execute on function public.get_manager_riders()
to authenticated, service_role;
