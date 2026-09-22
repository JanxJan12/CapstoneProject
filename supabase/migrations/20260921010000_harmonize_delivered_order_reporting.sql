begin;

-- A successful fulfillment has one reporting timestamp:
--   delivery     -> delivery_assignments.delivered_at
--   non-delivery -> orders.completed_at
--
-- orders.completed_at remains specific to the "completed" order status. The
-- reporting functions derive the cross-status concept without changing either
-- terminal status or adding a second persistent delivery-completion timestamp.

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
  successful_fulfillments as (
    select
      orders.id,
      case
        when orders.fulfillment_type = 'delivery'::public.fulfillment_type
          and orders.current_status = 'delivered'::public.order_status
        then delivery_completion.delivered_at
        when orders.fulfillment_type <> 'delivery'::public.fulfillment_type
          and orders.current_status = 'completed'::public.order_status
        then orders.completed_at
        else null
      end as effective_completion_at
    from public.orders orders
    left join lateral (
      select max(assignment.delivered_at) as delivered_at
      from public.delivery_assignments assignment
      where assignment.order_id = orders.id
        and assignment.status = 'delivered'::public.delivery_assignment_status
        and assignment.delivered_at is not null
    ) delivery_completion on true
    where (
      orders.fulfillment_type = 'delivery'::public.fulfillment_type
      and orders.current_status = 'delivered'::public.order_status
    ) or (
      orders.fulfillment_type <> 'delivery'::public.fulfillment_type
      and orders.current_status = 'completed'::public.order_status
    )
  ),
  range_fulfillments as (
    select
      fulfillment.id,
      (
        fulfillment.effective_completion_at at time zone 'Asia/Manila'
      )::date as sale_date
    from successful_fulfillments fulfillment
    where fulfillment.effective_completion_at >= v_week_start
      and fulfillment.effective_completion_at < v_tomorrow_start
  ),
  verified_order_payments as (
    select
      fulfillment.id as order_id,
      fulfillment.sale_date,
      sum(payment.amount) as verified_amount
    from range_fulfillments fulfillment
    join public.payments payment
      on payment.order_id = fulfillment.id
    where payment.status = 'verified'::public.payment_status
    group by fulfillment.id, fulfillment.sale_date
  ),
  sales_by_day as (
    select
      verified_payment.sale_date,
      sum(verified_payment.verified_amount) as sales
    from verified_order_payments verified_payment
    group by verified_payment.sale_date
  )
  select
    coalesce(
      sum(sales_by_day.sales) filter (
        where calendar_day.sale_date = v_today
      ),
      0
    ),
    coalesce(
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
  into
    v_sales_today,
    v_daily_sales
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

  with calendar_days as (
    select generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    )::date as sale_date
  ),
  successful_fulfillments as (
    select
      orders.id,
      case
        when orders.fulfillment_type = 'delivery'::public.fulfillment_type
          and orders.current_status = 'delivered'::public.order_status
        then delivery_completion.delivered_at
        when orders.fulfillment_type <> 'delivery'::public.fulfillment_type
          and orders.current_status = 'completed'::public.order_status
        then orders.completed_at
        else null
      end as effective_completion_at
    from public.orders orders
    left join lateral (
      select max(assignment.delivered_at) as delivered_at
      from public.delivery_assignments assignment
      where assignment.order_id = orders.id
        and assignment.status = 'delivered'::public.delivery_assignment_status
        and assignment.delivered_at is not null
    ) delivery_completion on true
    where (
      orders.fulfillment_type = 'delivery'::public.fulfillment_type
      and orders.current_status = 'delivered'::public.order_status
    ) or (
      orders.fulfillment_type <> 'delivery'::public.fulfillment_type
      and orders.current_status = 'completed'::public.order_status
    )
  ),
  range_fulfillments as (
    select
      fulfillment.id,
      (
        fulfillment.effective_completion_at at time zone 'Asia/Manila'
      )::date as sale_date
    from successful_fulfillments fulfillment
    where fulfillment.effective_completion_at >= v_start_timestamp
      and fulfillment.effective_completion_at < v_end_timestamp
  ),
  verified_order_payments as (
    select
      fulfillment.id as order_id,
      fulfillment.sale_date,
      sum(payment.amount) as verified_amount
    from range_fulfillments fulfillment
    join public.payments payment
      on payment.order_id = fulfillment.id
    where payment.status = 'verified'::public.payment_status
    group by fulfillment.id, fulfillment.sale_date
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
    from verified_order_payments verified_payment
    join public.order_items order_item
      on order_item.order_id = verified_payment.order_id
    join public.menu_items menu_item
      on menu_item.id = order_item.menu_item_id
    group by order_item.menu_item_id
  ),
  sales_by_day as (
    select
      verified_payment.sale_date,
      sum(verified_payment.verified_amount) as sales
    from verified_order_payments verified_payment
    group by verified_payment.sale_date
  )
  select
    (select count(*) from range_fulfillments),
    (
      select coalesce(sum(verified_payment.verified_amount), 0)
      from verified_order_payments verified_payment
    ),
    (select count(*) from verified_order_payments),
    (
      select item_total.item_name
      from item_totals item_total
      order by
        item_total.quantity_sold desc,
        item_total.item_name asc,
        item_total.menu_item_id asc
      limit 1
    ),
    (
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
      from calendar_days calendar_day
      left join sales_by_day
        on sales_by_day.sale_date = calendar_day.sale_date
    )
  into
    v_total_orders,
    v_total_revenue,
    v_verified_order_count,
    v_top_item_name,
    v_daily_sales;

  v_average_order_value := case
    when v_verified_order_count = 0 then 0
    else round(v_total_revenue / v_verified_order_count, 2)
  end;

  return jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_orders', v_total_orders,
    'average_order_value', v_average_order_value,
    'top_item_name', v_top_item_name,
    'daily_sales', v_daily_sales
  );
end;
$$;


comment on function public.get_manager_dashboard() is
  'Manager dashboard with verified fulfilled revenue grouped by the authoritative successful-fulfillment timestamp.';

comment on function public.get_manager_sales_report(date, date) is
  'Manager sales report for successfully fulfilled orders, using delivered_at for delivery and completed_at for non-delivery.';

revoke execute
on function public.get_manager_dashboard()
from public, anon;

revoke execute
on function public.get_manager_sales_report(date, date)
from public, anon;

grant execute
on function public.get_manager_dashboard()
to authenticated, service_role;

grant execute
on function public.get_manager_sales_report(date, date)
to authenticated, service_role;

commit;
