-- Read-only hosted evidence, executed through Supabase execute_sql against
-- project zhzluhqvysvsadwuugpa on 2026-10-23 (Asia/Manila).
-- Queries read aggregate business data and catalog metadata only.

-- Financial projection. Cashier receipt amount comes from its linked payment;
-- cashier_transactions does not have a total_amount column.
with bounds as (select (current_timestamp at time zone 'Asia/Manila')::date d),
fulfilled as (
  select o.id,
    case
      when o.fulfillment_type='delivery'::public.fulfillment_type
       and o.current_status='delivered'::public.order_status
      then (select max(a.delivered_at) from public.delivery_assignments a
            where a.order_id=o.id
              and a.status='delivered'::public.delivery_assignment_status
              and a.delivered_at is not null)
      when o.fulfillment_type<>'delivery'::public.fulfillment_type
       and o.current_status='completed'::public.order_status
      then o.completed_at
    end at_ts
  from public.orders o
  where (o.fulfillment_type='delivery'::public.fulfillment_type
     and o.current_status='delivered'::public.order_status)
     or (o.fulfillment_type<>'delivery'::public.fulfillment_type
     and o.current_status='completed'::public.order_status)
), paid as (
  select f.id,f.at_ts,sum(p.amount) amount
  from fulfilled f join public.payments p
    on p.order_id=f.id and p.status='verified'::public.payment_status
  group by f.id,f.at_ts
), tx as (
  select count(*) cnt,coalesce(sum(p.amount),0) amount
  from public.cashier_transactions ct
  join public.payments p on p.id=ct.payment_id and p.status='verified'
  where ct.status='completed'
)
select (select d from bounds) manila_day,
  (select count(*) from public.orders) orders_count,
  (select count(*) from public.orders o,bounds b
   where o.created_at>=b.d::timestamp at time zone 'Asia/Manila'
     and o.created_at<(b.d+1)::timestamp at time zone 'Asia/Manila') orders_created_today,
  (select count(*) from public.payments where status='pending') pending_payments,
  (select count(*) from public.payments where status='verified') verified_payment_rows,
  (select coalesce(sum(amount),0) from public.payments where status='verified') verified_payment_amount_all,
  (select count(*) from fulfilled where at_ts is not null) fulfilled_orders_dated,
  (select count(*) from paid where at_ts is not null) fulfilled_paid_orders,
  (select coalesce(sum(amount),0) from paid where at_ts is not null) fulfilled_verified_amount_all,
  (select coalesce(sum(amount),0) from paid p,bounds b
   where p.at_ts>=b.d::timestamp at time zone 'Asia/Manila'
     and p.at_ts<(b.d+1)::timestamp at time zone 'Asia/Manila') fulfilled_verified_amount_today,
  (select cnt from tx) completed_cashier_receipts,
  (select amount from tx) completed_cashier_receipt_amount,
  (select count(*) from (select order_id from public.payments where status='verified'
     group by order_id having count(*)>1) x) orders_with_multiple_verified_payments,
  (select count(*) from public.paid_order_cancellations) paid_cancellation_rows;

-- Payment/order state explains the difference between collections and
-- fulfilled revenue without reading names, IDs, or individual receipts.
select o.current_status::text order_status,o.fulfillment_type::text fulfillment_type,
  p.status::text payment_status,count(*) payment_rows,
  coalesce(sum(p.amount),0) payment_amount
from public.payments p join public.orders o on o.id=p.order_id
group by o.current_status,o.fulfillment_type,p.status
order by order_status,fulfillment_type,payment_status;

-- Current payment/receipt and shift status counts.
select 'shift_status' kind,status::text label,count(*) rows,
  coalesce(sum(opening_cash),0) amount from public.cashier_shifts group by status
union all select 'receipt_status',status::text,count(*),0::numeric
  from public.cashier_transactions group by status
union all select 'payment_status',status::text,count(*),coalesce(sum(amount),0)
  from public.payments group by status
union all select 'cancellation','paid_order_cancellations',count(*),
  coalesce(sum(refund_amount),0) from public.paid_order_cancellations
order by kind,label;

-- Active inventory physical/usable and batch balance invariants.
with s as (
  select i.id,i.quantity_on_hand physical,i.reorder_level threshold,
    i.batch_consumption_enabled batched,public.inventory_usable_quantity(i.id) usable,
    coalesce((select sum(b.quantity_on_hand) from public.inventory_batches b
      where b.inventory_item_id=i.id),0) batch_total
  from public.inventory_items i where i.is_active
)
select count(*) active_items,
  count(*) filter(where physical<0) negative_physical,
  count(*) filter(where usable<0) negative_usable,
  count(*) filter(where batched and physical<>batch_total) batched_balance_mismatch,
  count(*) filter(where physical<=threshold) physical_low_count,
  count(*) filter(where usable=0 or usable>0 and usable<=threshold) usable_attention_count,
  count(*) filter(where physical>threshold and usable<=threshold) physical_sufficient_usable_low
from s;

-- Posted receiving line, batch-opening and receiving-ledger comparison.
with lines as (
  select ri.id,ri.quantity_accepted,
    coalesce(sum(distinct b.quantity_initial),0) batch_initial,
    coalesce(sum(t.quantity_change),0) ledger_delta,
    count(distinct b.id) batches,count(t.id) movements
  from public.receiving_report_items ri
  join public.receiving_reports r on r.id=ri.receiving_report_id and r.status='posted'
  left join public.inventory_batches b on b.receiving_report_item_id=ri.id
  left join public.inventory_transactions t on t.inventory_batch_id=b.id
    and t.transaction_type='receiving'
  group by ri.id,ri.quantity_accepted
)
select count(*) posted_lines,coalesce(sum(quantity_accepted),0) accepted_total,
  coalesce(sum(batch_initial),0) batch_initial_total,
  coalesce(sum(ledger_delta),0) ledger_delta_total,
  count(*) filter(where quantity_accepted<>batch_initial
    or quantity_accepted<>ledger_delta) mismatched_lines
from lines;

-- One batch and one receipt movement per posted line in this snapshot.
with lines as (
  select ri.id,ri.quantity_accepted,
    (select count(*) from public.inventory_batches b
      where b.receiving_report_item_id=ri.id) batch_count,
    (select count(*) from public.inventory_transactions t
      join public.inventory_batches b on b.id=t.inventory_batch_id
      where b.receiving_report_item_id=ri.id and t.transaction_type='receiving') movement_count
  from public.receiving_report_items ri
  join public.receiving_reports r on r.id=ri.receiving_report_id
  where r.status='posted'
)
select count(*) lines,count(*) filter(where batch_count<>1) non_single_batch_lines,
  count(*) filter(where movement_count<>1) non_single_movement_lines
from lines;

-- Relevant hosted function ACL and a textual guard indicator. The indicator
-- is source inspection only; it is not a runtime authorization test.
select p.proname,pg_get_function_identity_arguments(p.oid) args,
  has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
  (pg_get_functiondef(p.oid) ilike '%active manager access required%'
    or pg_get_functiondef(p.oid) ilike '%inventory_request_manager_required%') apparent_manager_guard
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'get_manager_dashboard','get_manager_sales_report',
  'get_manager_inventory_stock_summary','issue_inventory_request',
  'start_inventory_request_receiving','post_receiving_report',
  'set_manager_menu_item_availability','set_manager_fixed_meal_option',
  'set_manager_drink_choice','get_manager_riders','approve_rider_application',
  'get_manager_cashier_shift_audit')
order by p.proname;
