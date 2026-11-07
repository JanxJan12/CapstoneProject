# Track B — finance and inventory integrity, phase 2 (27 October 2026)

## Scope and decision

Canonical repository: `C:\Users\Janmari\Downloads\Capstone Project`. Hosted project: `zhzluhqvysvsadwuugpa`. This is a bounded **read-only hosted** assessment of payment/receipt/shift linkage, paid cancellations, accepted-only Receiving, and inventory ledger/master/batch agreement. Hosted operations were `SELECT` only; no RPC that writes business data, schema change, migration apply, fixture, Storage action, or deployment occurred. The existing dirty worktree was preserved. Track A and the deployed Rider policy `20261026144235` were not repeated.

**Decision: no local SQL fix.** The one highest-priority exception is two historical delivered online orders with no payment or cashier receipt, totaling **₱255**. Both were created on 17 August 2026, before the populated current receipt period. This is a real missing linkage in current records, but whether tender was collected or these were legacy/test orders cannot be established from the available rows. Adding a NOT NULL constraint, synthesizing payment/receipt history, or changing current checkout/settlement RPCs would not safely resolve that historical uncertainty. Current populated finance and inventory invariants below have zero mismatches. The next action is a narrow source-record disposition for those two orders.

## Active sources and controls traced

| Flow | Mounted client call | Authoritative backend and relevant controls |
| --- | --- | --- |
| Online payment verification | `src/modules/cashier/api/onlinePaymentApi.ts` → `verify_customer_gcash_payment`; Cashier store refreshes payment projections | `payments` is payment state/amount; `cashier_transactions` is one receipt per payment (`UNIQUE(payment_id)`), linked to a `cashier_shifts` row. The hosted function is `SECURITY DEFINER`, authenticated-only, and its body checks identity and locks rows. |
| Shift closure/history | `src/modules/cashier/api/shiftApi.ts` → `close_cashier_shift`; `closedShiftHistoryApi.ts` reads saved history | Hosted close RPC locks the open shift, excludes unresolved pending online GCash, sums completed receipts linked to verified payments, and saves `expected_cash = opening_cash + cash_sales` and `variance = actual_cash - expected_cash`. Saved closure fields are a historical snapshot; current receipt status can later change. The pending-GCash closure lock trigger is present. |
| Paid cancellation | `src/modules/manager/api/paidOrderCancellationApi.ts` → `settle_paid_order_cancellation` | Manager-only function checks verified full payment and linked completed receipt, requires refund attestation/reference, restricts eligible order status, and records cancellation while voiding payment/receipt. `restore` follows original issuance and exact batch allocations. Hosted cancellation table currently has no rows, so live refund behavior is unproven. |
| Receiving | `src/modules/manager/inventory/receivingApi.ts` → `post_receiving_report` | RPC locks the draft and lines, rejects repeat posting, validates accepted/rejected quantities and source links, then creates accepted-quantity stock, batch and ledger entries. Hosted quantity checks and Receiving line/source triggers are present. |
| Other stock movements | `src/modules/manager/inventory/inventoryApi.ts` → `receive_inventory_stock`, `adjust_inventory_stock`, `record_inventory_waste` and batch variants | `inventory_items.quantity_on_hand` is current master balance; `inventory_transactions` is movement history; `inventory_batches` is physical/FIFO detail for tracked items. Current aggregate receiving rejects batch-enabled items. Hosted item/transaction/batch quantity-scale triggers and batch quantity checks are present. |

The listed seven hosted write RPC names are `SECURITY DEFINER`, executable by `authenticated` and not `anon`. This catalog check is not a role-specific authenticated HTTP test. Local source was used to trace business rules; current hosted catalog and aggregate queries were used to validate the live shape and data. Relevant prior evidence: `qa/MANAGER-CASHIER-FINANCIAL-RECONCILIATION-202610.md`, `qa/DATABASE-RELATIONSHIP-INTEGRITY-ASSESSMENT.md`, `qa/BACKEND-AUDIT-REMEDIATION-PHASE1-20261026.md`, and the isolated cancellation/Receiving regressions.

## Hosted results, 27 October snapshot

| Check | Observation | Result and meaning |
| --- | --- | --- |
| Payment/receipt completeness | 28 verified payments, **₱4,055**; 28 completed receipts. Verified without completed receipt **0**; completed receipt without verified payment **0**; duplicate completed receipts per payment **0**. Among 28 linked receipts, payment/order and cashier/shift identity mismatches **0**. | **PASS** for currently verified population. |
| Fulfillment versus collection | Of verified payments, 19 fulfilled orders contribute **₱2,785** and 9 not-yet-fulfilled orders contribute **₱1,270**. | **PASS / valid semantics.** Collections/receipts and fulfilled sales have different inclusion rules and time axes. The old **₱1,020 / ₱880 / ₱140** was an H-07 disposable fixture, not current hosted data and not a refund. |
| Historical delivered exception | 12 delivered orders; 2 have no payment and no receipt, **₱255** combined. Both are online delivery orders created 17 August 2026 UTC. The other 10 delivered orders have payments and receipts. | **OPEN historical evidence exception**, not proof of lost cash. No synthetic repair or unconditional current-order constraint is justified. |
| Paid cancellation/refund | `paid_order_cancellations`: **0** rows; no cancelled order has a verified payment. One cancelled order has a rejected payment, which is not a paid refund. | **NOT RUN** for live paid-refund behavior; no live settlement example. Current-status projections must not subtract an imagined refund. |
| Shift closure | 5 closed shifts, 1 open. All closed saved expectations match opening cash plus *current* completed verified cash receipts; all saved variances match actual minus expected. **0** mismatches. | **PASS** for this snapshot; post-close void divergence and immutable historical breakdown are not proved by these rows. |
| Receiving accepted-only | 4 posted lines; 1 has a rejected portion; 0 have zero accepted quantity. Delivered = accepted + rejected mismatches **0**. All 4 accepted lines have a matching accepted-quantity batch. All 4 Receiving-origin batches have `quantity_initial = quantity_accepted` and a matching `receiving` ledger movement; mismatches **0**. | **PASS** for populated posted lines. Quantities across different items/units were not summed into one business total. |
| Inventory movement | 51 transactions; `quantity_after = quantity_before + quantity_change` mismatches **0**; batch/item mismatches **0**, missing referenced batches **0**. | **PASS** for row arithmetic and populated batch references. |
| Master/batch/ledger | 4 batch-consumption-enabled items; master versus sum of batch on-hand mismatches **0**. Of 18 items, 13 have a transaction and latest ledger-after versus master mismatches **0**. Five items have no movement history; all five currently have **zero** on hand, four are batch tracked. | **PASS** for applicable balances; `no_history` is an evidence gap, not proof of a missing positive stock movement. |

These are current-state aggregate checks, not a reconstruction of original tender, external GCash settlement, physical counts, or all future transitions. The prior audit's two delivered-linkage exceptions and five `no_history` items remain; the latter do not now hide nonzero stock.

## Reproducible read-only predicates

The decisive comparisons used `SELECT`, joins by primary/foreign keys, `NOT EXISTS`, grouped counts/sums, and null-safe `IS DISTINCT FROM`. Representative queries:

```sql
-- Historical exception, aggregate only.
select count(*) rows, sum(o.grand_total) total
from public.orders o
where o.current_status = 'delivered'
  and not exists (select 1 from public.payments p where p.order_id = o.id);

-- Verified payment journal coverage.
with vp as (select id from public.payments where status = 'verified'),
     cr as (select id, payment_id from public.cashier_transactions
            where status = 'completed')
select (select count(*) from vp p where not exists
          (select 1 from cr t where t.payment_id = p.id)) verified_without_receipt,
       (select count(*) from cr t where not exists
          (select 1 from vp p where p.id = t.payment_id)) receipt_without_verified,
       (select count(*) from (select payment_id from cr group by payment_id
          having count(*) > 1) d) duplicate_receipts;

-- Accepted-only Receiving, by line/batch rather than mixed-unit totals.
select count(*) posted_lines,
       count(*) filter (where ri.quantity_rejected > 0) partly_rejected,
       count(*) filter (where ri.quantity_accepted + ri.quantity_rejected
         is distinct from ri.quantity_delivered) arithmetic_mismatch,
       count(*) filter (where ri.quantity_accepted > 0 and not exists
         (select 1 from public.inventory_batches b
          where b.receiving_report_item_id = ri.id
            and b.quantity_initial = ri.quantity_accepted)) missing_batch
from public.receiving_report_items ri
join public.receiving_reports r on r.id = ri.receiving_report_id
where r.status = 'posted';
```

## Verification, modified files, and next step

| Gate | Result |
| --- | --- |
| Hosted current-state aggregates and relevant constraint/trigger/RPC catalog | **PASS**, read-only. |
| `npm run typecheck` | **PASS** on the existing dirty tree. |
| `npm run build` | **PASS** on the existing dirty tree. |
| New disposable database regression suite | **NOT RUN**: no supported code/SQL fix was made. A clean full historical replay was separately shown blocked at Phase 2A by missing approved historical inputs (`qa/BACKEND-AUDIT-REMEDIATION-PHASE1-20261026.md`); this increment did not detour into replay. |
| Hosted authenticated finance/Receiving HTTP and hosted paid cancellation | **NOT RUN**: no designated sessions or valid paid-cancellation row; hosted writes were outside scope. |

**Files modified in this increment:** this report only. No application file, migration, existing QA artifact, or hosted object was changed.

**One next bounded step:** obtain the original order/tender/receipt evidence for the **two 17 August delivered online orders** from the accountable business owner, then record each as a genuine unpaid delivery, an externally settled legacy sale with original proof, or a test/legacy record. Only that disposition can support a narrowly reviewed correction or an auditable permanent exception. Keep the five zero-balance `no_history` items and refund-period policy in their existing registers; neither warrants a speculative writer rewrite here.
