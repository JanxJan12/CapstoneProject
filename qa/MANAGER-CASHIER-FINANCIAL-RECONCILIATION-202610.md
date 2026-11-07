# RRJ’S FOOD-HOUSE — Manager Financial Report and Cashier Shift Reconciliation

**Assessment:** 2026-10-23 (Asia/Manila), hosted project `zhzluhqvysvsadwuugpa`. **Decision: CONDITIONALLY ACCEPTED** for this bounded reconciliation. The current hosted receipt, payment, shift, and fulfillment source records reconcile under their different definitions. **The actual hosted Manager report RPC and authenticated Cashier historical-read RPC were not executed**, and post-close hosted immutability was not tested. No financial reporting discrepancy was demonstrated; this is not an unconditional runtime PASS or production release approval.

## Evidence and definitions

The [Manager final acceptance](MANAGER-MODULE-FINAL-OPERATIONAL-ACCEPTANCE-202610.md) and its [read-only queries](MANAGER-MODULE-FINAL-OPERATIONAL-ACCEPTANCE-202610-QUERIES.sql) established a historical 2026-10-23 snapshot, not values to assume live forever. [H-07 isolated reconciliation](FINANCIAL-RECONCILIATION-REGRESSION.md), the [metric definition matrix](FINANCIAL-METRIC-DEFINITION-MATRIX.md), and [H-08C shift regression](H08C-HISTORICAL-SHIFT-REGRESSION.md) provide prior **disposable** execution. Current definitions were checked against the hosted `get_manager_sales_report(date,date)`, `get_manager_dashboard()`, `close_cashier_shift(...)`, and `get_closed_cashier_shifts(...)` function bodies, the mounted [Manager Reports page](../src/modules/manager/reports/ReportsPage.tsx#L88), [Cashier shift history mapper](../src/modules/cashier/api/closedShiftHistoryApi.ts#L60), and [saved snapshot presentation](../src/modules/cashier/shifts/ShiftMetrics.tsx#L6). Only focused financial objects were inspected; no broader module audit or implementation work was performed.

| Metric | Current implemented inclusion rule | Time axis / authoritative source |
| --- | --- | --- |
| Currently verified payments | `payments.status='verified'`, amount summed regardless of fulfillment. Pending, rejected, voided excluded. This is current state, not an immutable cashflow ledger. | `payments.amount`; payment verification time is a possible collections axis, but no owner-approved standalone collections report exists. |
| Cashier completed receipts | `cashier_transactions.status='completed'` joined to its **verified** `payment_id`; source payment amount counted once per completed receipt. | Receipt `created_at` for Transaction History Manila date; shift reporting instead groups by `shift_id`. |
| Manager verified fulfilled revenue | Verified payments for orders currently successfully fulfilled: delivery `delivered` with latest delivered assignment time; non-delivery `completed` with `orders.completed_at`. | Effective fulfillment time in `Asia/Manila`, inclusive date range `[start, day after end)`. `get_manager_sales_report` returns that sum. |
| Manager fulfilled order count / average | All successfully fulfilled orders with a dated fulfillment count toward `total_orders`, including two without verified payment in this snapshot; average divides verified fulfilled revenue by fulfilled orders **with** verified payment. | Same Manager report date range. |
| Shift cash/GCash sales | Completed receipts with verified linked payments and exact `shift_id`; method-specific sums. Pending/rejected/voided receipts excluded. | Shift identity, even when its start/end cross Manila midnight; no calendar-day assumption. |
| Saved shift expectation / variance | At closure: `expected_cash = opening_cash + completed verified cash sales`; GCash is separate. `variance = actual_cash - expected_cash`. | `cashier_shifts` persisted closure columns; closed UI/report shows saved columns, not a live recomputation. |
| Paid cancellation/refund | `paid_order_cancellations` is the settlement attestation; payment/receipt may become voided. Do not subtract the refund again from a current-state verified or fulfilled projection. | H-07/H-08C disposable tests; current hosted table has zero settlement rows. Owner refund-period/net-sales policy is unresolved. |

## Equivalent-period hosted reconciliation

The comparison interval is **2026-08-21 00:00 through 2026-10-24 00:00 Asia/Manila**, representing inclusive report dates **2026-08-21–2026-10-23**. This fits the Manager report's maximum 366-calendar-day range. The current hosted read found **zero completed verified receipts and zero fulfilled verified-payment orders outside this interval**, so full-population comparisons below have the same date coverage. The two measures still use their own correct event date: receipt creation for Cashier and fulfillment for Manager. Each hosted query ran as read-only SQL; none invoked an RPC under a user's authenticated session.

| Comparison | Independent expected source | Observed hosted source | Difference | Result |
| --- | ---: | ---: | ---: | --- |
| Verified payments vs completed verified Cashier receipts in interval | 28 payments / **₱4,055** | 28 receipts / **₱4,055** | **₱0** | **PASS**, direct hosted source rows; 0 unmatched verified payments, 0 completed receipts without verified payment, and 0 duplicate completed receipts per payment. |
| Completed verified receipts split by current fulfillment | 19 paid fulfilled **₱2,785** + 9 paid unfulfilled **₱1,270** | 28 receipts **₱4,055** | **₱0** | **PASS**, same receipt population joined to order status/fulfillment timestamp. |
| Manager fulfillment-date source projection | 19 verified paid fulfilled orders / **₱2,785** | Independent hosted SQL **₱2,785**; actual `get_manager_sales_report` output **not called** | Source calculation **₱0**; RPC comparison unavailable | **PASS** for source projection; **NOT TESTED** for authenticated hosted report output. |
| Manager successfully fulfilled order count | 21 dated fulfillments, of which 19 have verified payment | Independent hosted SQL 21 / 19 | 0 | **PASS** as source classification; report output **NOT TESTED**. |
| Pending/rejected/paid-cancellation classification | Pending 1 / ₱170; rejected 1 / ₱170; settled paid cancellations 0 | Same hosted status counts | 0 | **PASS** for current statuses; actual hosted cancellation/refund behavior **NOT TESTED**. |

The **₱1,270** paid-but-unfulfilled group is ₱170 confirmed delivery, ₱240 confirmed dine-in, and ₱860 ready dine-in. It is legitimately included in current collections/receipts and excluded from fulfilled sales. In the same receipt-by-shift join, the ₱1,270 divides into S4 ₱465, S5 ₱565, and open S6 ₱240. The old **₱1,020/₱880/₱140** values belong only to the 2026-10-14 H-07 disposable fixture; they were not used as a hosted expected value or described as a refund.

## Cashier shift reconciliation

Hosted `close_cashier_shift` locks the Cashier's open shift, excludes unresolved pending online GCash at close, sums only completed receipts with verified payments for that `shift_id`, saves expected/actual/variance, and returns method totals. The current hosted [historical read RPC](../supabase/migrations/20261021120000_restore_closed_cashier_shifts_rpc.sql#L3) returns saved shift columns with active Cashier-own or Manager access checks. It does not return stored per-method cash/GCash sums because the `cashier_shifts` table does not persist those as separate columns. The following **current** method sums are independently reconstructed from linked receipts, while saved expected/actual/variance are read directly from shift rows. S1–S6 are chronological labels for this report; no customer, cashier identity, receipt number, or payment proof is exposed.

| Shift / Manila start → end | State | Verified completed receipts | Cash | GCash | Opening | Saved expected / independent opening + cash | Saved actual / variance | Difference |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S1, Aug 26 15:10 → 15:11 | Closed | 0 | ₱0 | ₱0 | ₱4,000 | ₱4,000 / ₱4,000 | ₱4,000 / ₱0 | ₱0 |
| S2, Aug 26 15:11 → 15:15 | Closed | 0 | ₱0 | ₱0 | ₱4,000 | ₱4,000 / ₱4,000 | ₱4,000 / ₱0 | ₱0 |
| S3, Aug 29 22:40 → Sep 10 15:13 | Closed | 15 | ₱860 | ₱885 | ₱4,000 | ₱4,860 / ₱4,860 | ₱4,860 / ₱0 | ₱0 |
| S4, Sep 10 21:41 → Sep 11 15:30 | Closed | 8 | ₱465 | ₱870 | ₱4,000 | ₱4,465 / ₱4,465 | ₱4,465 / ₱0 | ₱0 |
| S5, Sep 13 22:13 → Sep 30 23:21 | Closed | 3 | ₱395 | ₱340 | ₱4,000 | ₱4,395 / ₱4,395 | ₱4,395 / ₱0 | ₱0 |
| S6, Oct 21 01:53 → open | Open | 2 | ₱240 | ₱0 | ₱4,000 | Not yet saved / current projection ₱4,240 | Not counted | Not applicable |

**Cashier shift totals: PASS for all five closed hosted rows**, including exact `actual_cash - expected_cash = saved variance` (₱0 each). The open shift was not closed or treated as a saved settlement. Shift collection components total **₱1,960 cash + ₱2,095 GCash = ₱4,055** across all six shift identities. The closed shifts include long periods spanning multiple Manila dates, which is why calendar-day Manager totals were not forced to match a shift row. No current linked receipt is voided or nonverified, and no paid-cancellation row exists; this snapshot cannot demonstrate post-close reversal behavior.

## Historical snapshot and authenticated-runtime limits

**Observed preservation:** five hosted closed rows retain saved `expected_cash`, `actual_cash`, `variance`, `ended_at`, and status. Their saved numeric values match the current linked receipts. The Cashier closed-shift UI uses the saved values; [H-08C disposable authenticated tests](H08C-HISTORICAL-SHIFT-REGRESSION.md) exercised historical Cashier-own/Manager reads, a later void with unchanged saved row hash, and rejected closed-row UPDATE/DELETE in that **local** stack.

**Hosted limitation:** focused hosted catalog inspection found **no noninternal trigger on `public.cashier_shifts` and no `protect_closed_cashier_shift_snapshot()` function**. The local [H-08C migration](../supabase/migrations/20261014191853_h08c_historical_shift_access.sql#L79) defines that protection, but its disposable result must not be promoted to hosted proof. Hosted `anon`/`authenticated` direct UPDATE/DELETE grants are absent, and the inspected hosted `close_cashier_shift` only targets an **open** shift; thus no normal app path to rewrite a closed row was observed. The hosted immutability guard itself and a post-close cancellation effect are **NOT TESTED / not established**. No hosted write was attempted to test them. This is a verified protection-parity gap, **not** an observed misreported amount or a reason to alter hosted schema under this assignment.

The hosted Manager `get_manager_sales_report` grants EXECUTE to `authenticated`, denies `anon`, and checks an active Manager profile in its body. The hosted closed-shift RPC similarly checks active Cashier/Manager scope. Function definitions and ACLs were inspected, but no valid authenticated Manager or Cashier session was supplied for this run. Consequently actual hosted report JSON, date-filter UI, closed-shift RPC response, and per-role runtime authorization are **NOT TESTED**. Prior H-07/H-08C disposable execution supports those contracts only in its recorded local environments. No credential was invented and no elevated database session was made to impersonate an application user.

## Reproducible read-only hosted queries

Run the following only as **SELECT** on project `zhzluhqvysvsadwuugpa`. They disclose only aggregate figures. The first query applies the comparable Manila interval; the second groups by exact shift identity internally and emits only a chronological label. The third checks hosted snapshot-protection catalog state. They were executed on 2026-10-23; live results can change later.

```sql
with bounds as (select '2026-08-21'::date d0, '2026-10-23'::date d1),
receipt as (
  select t.id,t.order_id,p.amount,t.created_at
  from public.cashier_transactions t join public.payments p on p.id=t.payment_id
  where t.status='completed' and p.status='verified'
), fulfilled as (
  select o.id,case
    when o.fulfillment_type='delivery' and o.current_status='delivered'
      then (select max(a.delivered_at) from public.delivery_assignments a
            where a.order_id=o.id and a.status='delivered' and a.delivered_at is not null)
    when o.fulfillment_type<>'delivery' and o.current_status='completed'
      then o.completed_at end completed_at
  from public.orders o
), report_paid as (
  select f.id,f.completed_at,sum(p.amount) amount
  from fulfilled f join public.payments p on p.order_id=f.id and p.status='verified'
  where f.completed_at is not null group by f.id,f.completed_at
)
select
  (select count(*) from receipt r,bounds b where r.created_at>=b.d0::timestamp at time zone 'Asia/Manila' and r.created_at<(b.d1+1)::timestamp at time zone 'Asia/Manila') receipt_count,
  (select coalesce(sum(r.amount),0) from receipt r,bounds b where r.created_at>=b.d0::timestamp at time zone 'Asia/Manila' and r.created_at<(b.d1+1)::timestamp at time zone 'Asia/Manila') receipt_collection,
  (select count(*) from report_paid p,bounds b where p.completed_at>=b.d0::timestamp at time zone 'Asia/Manila' and p.completed_at<(b.d1+1)::timestamp at time zone 'Asia/Manila') report_paid_order_count,
  (select coalesce(sum(p.amount),0) from report_paid p,bounds b where p.completed_at>=b.d0::timestamp at time zone 'Asia/Manila' and p.completed_at<(b.d1+1)::timestamp at time zone 'Asia/Manila') report_projection,
  (select count(*) from receipt r,bounds b where r.created_at<b.d0::timestamp at time zone 'Asia/Manila' or r.created_at>=(b.d1+1)::timestamp at time zone 'Asia/Manila') receipts_outside,
  (select count(*) from report_paid p,bounds b where p.completed_at<b.d0::timestamp at time zone 'Asia/Manila' or p.completed_at>=(b.d1+1)::timestamp at time zone 'Asia/Manila') report_paid_outside;
```

Observed: `28, 4055.00, 19, 2785.00, 0, 0` in the selected column order. Payment-to-receipt pairing was checked with:

```sql
with vp as (select p.id from public.payments p where p.status='verified'),
cr as (select t.id,t.payment_id from public.cashier_transactions t where t.status='completed')
select
  (select count(*) from vp p where not exists(select 1 from cr t where t.payment_id=p.id)) verified_without_completed_receipt,
  (select count(*) from cr t where not exists(select 1 from vp p where p.id=t.payment_id)) completed_without_verified_payment,
  (select count(*) from (select payment_id from cr group by payment_id having count(*)>1) x) duplicate_completed_receipts_per_payment;
```

Observed: `0, 0, 0`. The exact shift comparison was:

```sql
with shift_money as (
  select s.id,s.status,s.started_at,s.ended_at,s.opening_cash,s.expected_cash,s.actual_cash,s.variance,
    count(t.id) filter(where t.status='completed' and p.status='verified') receipt_count,
    coalesce(sum(p.amount) filter(where t.status='completed' and p.status='verified' and p.payment_method='cash'),0) cash_sales,
    coalesce(sum(p.amount) filter(where t.status='completed' and p.status='verified' and p.payment_method='gcash'),0) gcash_sales,
    count(t.id) filter(where t.status<>'completed' or p.status<>'verified') excluded_receipts
  from public.cashier_shifts s
  left join public.cashier_transactions t on t.shift_id=s.id
  left join public.payments p on p.id=t.payment_id
  group by s.id
)
select row_number() over(order by started_at,id) shift_no,status::text,
  started_at at time zone 'Asia/Manila' manila_start,
  ended_at at time zone 'Asia/Manila' manila_end,opening_cash,receipt_count,
  cash_sales,gcash_sales,excluded_receipts,expected_cash,
  opening_cash+cash_sales recomputed_expected,
  expected_cash-(opening_cash+cash_sales) expected_difference,
  actual_cash,variance,actual_cash-expected_cash recomputed_variance
from shift_money order by started_at,id;
```

```sql
select to_regprocedure('public.protect_closed_cashier_shift_snapshot()') protector_function,
  (select count(*) from pg_trigger t where t.tgrelid='public.cashier_shifts'::regclass
    and not t.tgisinternal) noninternal_trigger_count;
```

Observed protector function `NULL`, trigger count `0`. The source/report comparisons above, not this catalog check, support the financial amounts.

## Conclusion and data safety

**Manager Reports: NOT TESTED as authenticated hosted RPC output; independent hosted source projection PASS. Cashier Shift Totals: PASS for current saved closed-shift values versus linked receipts. Cross-Module Reconciliation: PASS for the same current hosted receipt/payment/order population and equivalent Manila interval. Historical Shift Snapshots: NOT TESTED for hosted post-close immutability, although current saved rows match and prior disposable H-08C behavior passed. Confirmed financial reporting defect: NO in executed comparisons.** The absence of hosted snapshot-protection objects is documented as a contract/protection gap, not concealed or repaired here.

The Manager–Cashier financial reconciliation milestone may **close conditionally** with the actual hosted Manager report/closed-shift authenticated output and hosted immutability limitation recorded for later authorized acceptance. There is no evidence-backed reason in this task to alter revenue rules, shifts, reports, or historical transactions. Only this QA report was created. No hosted orders, payments, shifts, inventory, grants, policies, functions, or migrations were changed; no disposable environment was created.
