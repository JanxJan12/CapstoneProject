-- RRJ Food-House Manager Phase 1 read-only APIs.
-- Business calendar dates are evaluated in Asia/Manila.

create or replace function public.get_manager_orders(
  p_limit integer default 100
)
returns table (
  id uuid,
  order_number text,
  customer_name text,
  customer_contact_number text,
  delivery_address text,
  order_channel public.order_channel,
  fulfillment_type public.fulfillment_type,
  current_status public.order_status,
  grand_total numeric,
  created_at timestamptz,
  payment_method public.payment_method,
  payment_status public.payment_status,
  payment_amount numeric,
  rider_name text,
  items jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_limit integer;
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

  v_limit := greatest(1, least(coalesce(p_limit, 100), 500));

  return query
  select
    orders.id,
    orders.order_number::text,
    coalesce(
      nullif(btrim(orders.customer_name), ''),
      'Guest'
    )::text as customer_name,
    nullif(btrim(orders.customer_contact_number), '')::text,
    nullif(btrim(orders.delivery_address), '')::text,
    orders.order_channel,
    orders.fulfillment_type,
    orders.current_status,
    orders.grand_total,
    orders.created_at,
    order_payment.payment_method,
    order_payment.payment_status,
    order_payment.payment_amount,
    current_assignment.rider_name,
    coalesce(order_contents.items, '[]'::jsonb) as items
  from public.orders
  left join lateral (
    select
      payment.payment_method,
      payment.status as payment_status,
      payment.amount as payment_amount
    from public.payments payment
    where payment.order_id = orders.id
    order by payment.created_at desc, payment.id desc
    limit 1
  ) order_payment on true
  left join lateral (
    select
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(rider_profile.first_name), ''),
            nullif(btrim(rider_profile.last_name), '')
          )
        ),
        ''
      )::text as rider_name
    from public.delivery_assignments assignment
    join public.profiles rider_profile
      on rider_profile.id = assignment.rider_id
    where assignment.order_id = orders.id
      and assignment.status not in (
        'rejected'::public.delivery_assignment_status,
        'cancelled'::public.delivery_assignment_status
      )
    order by
      case
        when assignment.status in (
          'offered'::public.delivery_assignment_status,
          'accepted'::public.delivery_assignment_status,
          'picked_up'::public.delivery_assignment_status,
          'out_for_delivery'::public.delivery_assignment_status
        ) then 0
        else 1
      end,
      assignment.assigned_at desc,
      assignment.id desc
    limit 1
  ) current_assignment on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'name', coalesce(nullif(btrim(order_item.item_name), ''), 'Menu item'),
        'qty', order_item.quantity,
        'unit_price', order_item.unit_price,
        'line_total', order_item.line_total
      )
      order by order_item.created_at, order_item.id
    ) as items
    from public.order_items order_item
    where order_item.order_id = orders.id
  ) order_contents on true
  order by orders.created_at desc, orders.id desc
  limit v_limit;
end;
$$;


create or replace function public.get_manager_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
  v_today_start timestamptz;
  v_tomorrow_start timestamptz;
  v_week_start timestamptz;
  v_sales_today numeric := 0;
  v_orders_today bigint := 0;
  v_pending_payments bigint := 0;
  v_low_stock_count bigint := 0;
  v_recent_orders jsonb := '[]'::jsonb;
  v_order_status_counts jsonb := '[]'::jsonb;
  v_daily_sales jsonb := '[]'::jsonb;
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

  v_today_start := v_today::timestamp at time zone 'Asia/Manila';
  v_tomorrow_start := (v_today + 1)::timestamp at time zone 'Asia/Manila';
  v_week_start := (v_today - 6)::timestamp at time zone 'Asia/Manila';

  with verified_order_payments as (
    select
      payment.order_id,
      sum(payment.amount) as verified_amount
    from public.payments payment
    where payment.status = 'verified'::public.payment_status
    group by payment.order_id
  )
  select coalesce(sum(verified_payment.verified_amount), 0)
  into v_sales_today
  from public.orders orders
  join verified_order_payments verified_payment
    on verified_payment.order_id = orders.id
  where orders.created_at >= v_today_start
    and orders.created_at < v_tomorrow_start
    and orders.current_status not in (
      'cancelled'::public.order_status,
      'rejected'::public.order_status
    );

  select count(*)
  into v_orders_today
  from public.orders orders
  where orders.created_at >= v_today_start
    and orders.created_at < v_tomorrow_start;

  select count(*)
  into v_pending_payments
  from public.payments payment
  where payment.status = 'pending'::public.payment_status;

  select count(*)
  into v_low_stock_count
  from public.inventory_items inventory_item
  where inventory_item.is_active = true
    and inventory_item.quantity_on_hand <= inventory_item.reorder_level;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order_number', recent.order_number,
        'customer_name', recent.customer_name,
        'grand_total', recent.grand_total,
        'current_status', recent.current_status
      )
      order by recent.created_at desc, recent.id desc
    ),
    '[]'::jsonb
  )
  into v_recent_orders
  from (
    select
      orders.id,
      orders.order_number::text,
      coalesce(
        nullif(btrim(orders.customer_name), ''),
        'Guest'
      )::text as customer_name,
      orders.grand_total,
      orders.current_status,
      orders.created_at
    from public.orders orders
    order by orders.created_at desc, orders.id desc
    limit 4
  ) recent;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'status', status_count.current_status,
        'count', status_count.order_count
      )
      order by status_count.current_status::text
    ),
    '[]'::jsonb
  )
  into v_order_status_counts
  from (
    select
      orders.current_status,
      count(*) as order_count
    from public.orders orders
    where orders.created_at >= v_today_start
      and orders.created_at < v_tomorrow_start
    group by orders.current_status
  ) status_count;

  with calendar_days as (
    select generate_series(
      (v_today - 6)::timestamp,
      v_today::timestamp,
      interval '1 day'
    )::date as sale_date
  ),
  verified_order_payments as (
    select
      payment.order_id,
      sum(payment.amount) as verified_amount
    from public.payments payment
    where payment.status = 'verified'::public.payment_status
    group by payment.order_id
  ),
  sales_by_day as (
    select
      (orders.created_at at time zone 'Asia/Manila')::date as sale_date,
      sum(verified_payment.verified_amount) as sales
    from public.orders orders
    join verified_order_payments verified_payment
      on verified_payment.order_id = orders.id
    where orders.created_at >= v_week_start
      and orders.created_at < v_tomorrow_start
      and orders.current_status not in (
        'cancelled'::public.order_status,
        'rejected'::public.order_status
      )
    group by (orders.created_at at time zone 'Asia/Manila')::date
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', calendar_day.sale_date,
        'day', to_char(calendar_day.sale_date, 'Dy'),
        'sales', coalesce(sales_by_day.sales, 0)
      )
      order by calendar_day.sale_date
    ),
    '[]'::jsonb
  )
  into v_daily_sales
  from calendar_days calendar_day
  left join sales_by_day
    on sales_by_day.sale_date = calendar_day.sale_date;

  return jsonb_build_object(
    'sales_today', v_sales_today,
    'orders_today', v_orders_today,
    'pending_payments', v_pending_payments,
    'low_stock_count', v_low_stock_count,
    'recent_orders', v_recent_orders,
    'order_status_counts', v_order_status_counts,
    'daily_sales', v_daily_sales
  );
end;
$$;


create or replace function public.get_manager_sales_report(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_start_timestamp timestamptz;
  v_end_timestamp timestamptz;
  v_total_revenue numeric := 0;
  v_total_orders bigint := 0;
  v_verified_order_count bigint := 0;
  v_average_order_value numeric := 0;
  v_top_item_name text;
  v_daily_sales jsonb := '[]'::jsonb;
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

  if p_start_date is null or p_end_date is null then
    raise exception 'Start date and end date are required.'
      using errcode = '22023';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date must be on or after start date.'
      using errcode = '22023';
  end if;

  if p_end_date - p_start_date > 365 then
    raise exception 'Report date range must not exceed 366 calendar days.'
      using errcode = '22023';
  end if;

  v_start_timestamp := p_start_date::timestamp at time zone 'Asia/Manila';
  v_end_timestamp := (p_end_date + 1)::timestamp at time zone 'Asia/Manila';

  with range_orders as (
    select
      orders.id,
      orders.current_status
    from public.orders orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
  ),
  verified_order_payments as (
    select
      range_order.id as order_id,
      sum(payment.amount) as verified_amount
    from range_orders range_order
    join public.payments payment
      on payment.order_id = range_order.id
    where payment.status = 'verified'::public.payment_status
      and range_order.current_status not in (
        'cancelled'::public.order_status,
        'rejected'::public.order_status
      )
    group by range_order.id
  )
  select
    count(range_order.id),
    coalesce(sum(verified_payment.verified_amount), 0),
    count(verified_payment.order_id)
  into
    v_total_orders,
    v_total_revenue,
    v_verified_order_count
  from range_orders range_order
  left join verified_order_payments verified_payment
    on verified_payment.order_id = range_order.id;

  v_average_order_value := case
    when v_verified_order_count = 0 then 0
    else round(v_total_revenue / v_verified_order_count, 2)
  end;

  with range_orders as (
    select
      orders.id,
      orders.current_status
    from public.orders orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
  ),
  verified_orders as (
    select range_order.id
    from range_orders range_order
    where range_order.current_status not in (
      'cancelled'::public.order_status,
      'rejected'::public.order_status
    )
      and exists (
        select 1
        from public.payments payment
        where payment.order_id = range_order.id
          and payment.status = 'verified'::public.payment_status
      )
  ),
  item_totals as (
    select
      order_item.menu_item_id,
      coalesce(
        max(nullif(btrim(order_item.item_name), '')),
        max(nullif(btrim(menu_item.name), '')),
        'Menu item'
      )::text as item_name,
      sum(order_item.quantity) as quantity_sold
    from verified_orders verified_order
    join public.order_items order_item
      on order_item.order_id = verified_order.id
    join public.menu_items menu_item
      on menu_item.id = order_item.menu_item_id
    group by order_item.menu_item_id
  )
  select item_total.item_name
  into v_top_item_name
  from item_totals item_total
  order by
    item_total.quantity_sold desc,
    item_total.item_name asc,
    item_total.menu_item_id asc
  limit 1;

  with calendar_days as (
    select generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    )::date as sale_date
  ),
  range_orders as (
    select
      orders.id,
      orders.current_status,
      (orders.created_at at time zone 'Asia/Manila')::date as sale_date
    from public.orders orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
  ),
  verified_order_payments as (
    select
      range_order.id as order_id,
      range_order.sale_date,
      sum(payment.amount) as verified_amount
    from range_orders range_order
    join public.payments payment
      on payment.order_id = range_order.id
    where payment.status = 'verified'::public.payment_status
      and range_order.current_status not in (
        'cancelled'::public.order_status,
        'rejected'::public.order_status
      )
    group by range_order.id, range_order.sale_date
  ),
  sales_by_day as (
    select
      verified_payment.sale_date,
      sum(verified_payment.verified_amount) as sales
    from verified_order_payments verified_payment
    group by verified_payment.sale_date
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', calendar_day.sale_date,
        'day', to_char(calendar_day.sale_date, 'Mon DD'),
        'sales', coalesce(sales_by_day.sales, 0)
      )
      order by calendar_day.sale_date
    ),
    '[]'::jsonb
  )
  into v_daily_sales
  from calendar_days calendar_day
  left join sales_by_day
    on sales_by_day.sale_date = calendar_day.sale_date;

  return jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_orders', v_total_orders,
    'average_order_value', v_average_order_value,
    'top_item_name', v_top_item_name,
    'daily_sales', v_daily_sales
  );
end;
$$;


revoke all on function public.get_manager_orders(integer) from public;
revoke all on function public.get_manager_dashboard() from public;
revoke all on function public.get_manager_sales_report(date, date) from public;

grant execute on function public.get_manager_orders(integer)
to authenticated, service_role;

grant execute on function public.get_manager_dashboard()
to authenticated, service_role;

grant execute on function public.get_manager_sales_report(date, date)
to authenticated, service_role;
