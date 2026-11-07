# RRJ’S FOOD-HOUSE — relationship integrity verification

**Date:** 2026-10-14 (Asia/Manila). **Target:** hosted Supabase `zhzluhqvysvsadwuugpa`, read-only aggregate `SELECT` queries. **Result:** 16 populated checks **VERIFIED PASS** with zero mismatches; 16 checks had zero applicable hosted rows and are **NOT TESTED** in live data. **CONFIRMED FAIL:** none in the tested scope. This is a snapshot, not proof against future drift or every possible business invariant. No IDs, PII, recipes, credentials, private Storage paths, or row payloads were exported. No database or application state changed.

This focused pass continues the [final architecture assessment](DATABASE-ARCHITECTURE-FINAL-ASSESSMENT.md), [normalization matrix](DATABASE-NORMALIZATION-ASSESSMENT.md), [performance plan](DATABASE-PERFORMANCE-OPTIMIZATION-PLAN.md), [disposition register](DATABASE-DISPOSITION-REGISTER-20261014.md), [prior integrity audit](RECOVERY-STABILIZATION-20261013.md), and [recovery report](DATABASE-REPRODUCIBILITY-RECOVERY-20261014.md). It did not repeat the 34-table normalization review. A current metadata-only query reconfirmed **34 public base tables**. Existing SQL definitions and declared FKs/checks guided the comparisons; the four hosted query batches below returned only invariant labels, checked counts, and mismatch counts.

## Interpretation

`VERIFIED PASS` means the stated equality/relationship held for **all currently applicable hosted rows counted**. `NOT TESTED` means checked count was zero; zero mismatches then conveys no behavioral proof. `POTENTIAL RISK` means a possible future inconsistency or incomplete proof, not an observed bad row. Prior isolated same-database tests are separately labeled and never promoted to hosted proof. A declared FK proves reference existence only to the extent the live constraint is validated; these checks focus on cross-table identity and arithmetic that an FK alone does not express.

### 1. Orders, payments, cashier transactions, and cancellations

| Exact invariant and aggregate method | Checked / mismatch | Status | Limitation, severity, recommended action |
| --- | ---: | --- | --- |
| `cashier_transactions.order_id = payments.order_id` for every transaction with `payment_id` (inner join by payment PK; `IS DISTINCT FROM`). | 26 / 0 | **VERIFIED PASS** | **LOW:** populated hosted identity is consistent. Keep the authoritative writer and one-to-one keys; monitor after any payment/receipt RPC change. |
| `cashier_transactions.cashier_id = cashier_shifts.cashier_id` for each linked shift. | 26 / 0 | **VERIFIED PASS** | **LOW:** actor/shift assignment agrees in current journal. A historical cross-cashier settlement rule would require owner review before making this a permanent constraint. |
| `payments.amount = orders.grand_total` through `payments.order_id`. | 27 / 0 | **VERIFIED PASS** | **LOW:** current tender amount equals original payable order total; future refunds/cancellations may need snapshot-specific rules. Retain financial history. |
| `orders.subtotal = COALESCE(SUM(order_items.line_total),0)` grouped by order. | 45 / 0 | **VERIFIED PASS** | **LOW:** cross-row subtotal agrees now. Continue transaction-bound order writes and read-only reconciliation. |
| `orders.grand_total = subtotal - discount_amount + tax_amount + delivery_fee`. | 45 / 0 | **VERIFIED PASS** | **LOW:** same-row arithmetic agrees and is backed by a declared CHECK in the captured catalog. |
| `order_items.line_total = unit_price × quantity`. | 50 / 0 | **VERIFIED PASS** | **LOW:** sold-time line math agrees and is backed by a declared CHECK. Do not replace sold prices from current menu. |
| `paid_order_cancellations.order_id = payments.order_id` through its payment FK. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted cancellation row. Keep the prior isolated cancellation regression; repeat this check after an authorized real cancellation. |
| Cancellation `order_id/payment_id` agrees with the linked `cashier_transactions` row. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** one cancellation row carries three related identities; no live example verifies the writer. No automatic guard or repair. |

### 2. Receiving, purchase orders, and batch provenance

| Exact invariant and aggregate method | Checked / mismatch | Status | Limitation, severity, recommended action |
| --- | ---: | --- | --- |
| A Receiving line matches its source mode: `direct_supplier` uses a PO line; `production_team` uses a direct inventory item. | 2 / 0 | **VERIFIED PASS** | **LOW:** only the populated production-linked lines were exercised; direct supplier remains untested. Existing line source CHECK enforces exactly one of direct item/PO item. |
| `quantity_rejected = quantity_delivered - quantity_accepted` for every Receiving line. | 2 / 0 | **VERIFIED PASS** | **LOW:** accepted/rejected arithmetic agrees now. Keep partial/rejected receipt regressions. |
| Receiving batch `inventory_item_id` equals the effective source item: direct line item or linked PO line item. | 2 / 0 | **VERIFIED PASS** | **LOW:** both populated batch origins agree with Receiving. Source-path specific tests remain necessary. |
| Receiving batch `quantity_initial = receiving_report_items.quantity_accepted`. | 2 / 0 | **VERIFIED PASS** | **LOW:** accepted stock equals initial lot quantity for the two populated batches. |
| Each Receiving-origin batch has a `receiving` ledger transaction with matching item and `quantity_change = batch.quantity_initial`. | 2 / 0 | **VERIFIED PASS** | **LOW:** the two populated batches have matching movements; the existing partial unique receiving/batch index also protects duplicate posting. |
| `receiving_report_items.purchase_order_item_id` belongs to its parent report's `purchase_order_id`. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted PO lines or direct-supplier receipts. Preserve isolated PO-posting evidence and verify with an authorized future PO case. |
| Secondary-unit rejected quantity equals secondary delivered minus secondary accepted where secondary quantity is present. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted secondary-unit lines. Current checks cover nonnegative/pair bounds, not this observed branch. |
| Opening-origin batch item equals its `inventory_opening_balances.inventory_item_id`. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted opening balances. Do not invent physical stock to exercise it. |
| Every posted accepted line for a `batch_consumption_enabled` item has a corresponding batch. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** the current posted lines did not meet that precise predicate, even though two Receiving-origin batches exist. This cannot be generalized to all future tracked receipts. |

### 3. Stock ledger, allocations, and balances

| Exact invariant and aggregate method | Checked / mismatch | Status | Limitation, severity, recommended action |
| --- | ---: | --- | --- |
| `inventory_transactions.quantity_after = quantity_before + quantity_change`. | 43 / 0 | **VERIFIED PASS** | **LOW:** ledger arithmetic agrees; a declared CHECK also enforces it. This does not by itself reconstruct every historical opening balance. |
| A transaction referencing a batch has the same `inventory_item_id` as the batch. | 2 / 0 | **VERIFIED PASS** | **LOW:** populated batch-linked movements agree. Continue source-item validation in stock writers. |
| For `batch_consumption_enabled` inventory items, master `quantity_on_hand = COALESCE(SUM(batch.quantity_on_hand),0)`. | 4 / 0 | **VERIFIED PASS** | **LOW:** current tracked master/batch balances agree. The 14 other items use aggregate/legacy semantics; this formula is not asserted for them. |
| A transaction referencing a PO line has the same inventory item as that PO line. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted PO-linked ledger row. Test on a future authorized direct-supplier posting. |
| A transaction referencing an opening balance has the same inventory item. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted opening ledger row. Keep physical baseline provenance gate. |
| A reversal transaction matches original issuance order and item. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted reversal row. Retain prior isolated cancellation/reversal tests. |
| A reversal allocation points to its original issuance and item and restores exactly allocated quantity. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted allocated reversal. Do not recompute lots on cancellation. |
| Every allocation's transaction item equals its batch item. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** allocation table is empty hosted. Prior local exact-lot tests do not establish a live example. |
| Sum of allocation quantities equals absolute issuance movement for transactions with allocations. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted allocation group. Test under tracked confirmed-order issue on an isolated same-database stack. |

### 4. Order status and conditional commercial/request paths

| Exact invariant and aggregate method | Checked / mismatch | Status | Limitation, severity, recommended action |
| --- | ---: | --- | --- |
| `orders.current_status` equals the latest `order_status_history.status` by `(created_at DESC,id DESC)`. | 45 / 0 | **VERIFIED PASS** | **LOW:** current projection agrees for all hosted orders. Repeated same-status events are not considered duplicate orders. |
| A formal Receiving report's `(inventory_request_id,inventory_request_revision)` resolves to an issued request revision. | 1 / 0 | **VERIFIED PASS** | **LOW:** the current formal receipt points to an existing issued version. This is document lineage, not permission to edit the historical snapshot. |
| A legacy Production request's `fulfilled_report_id` agrees with the report that links that request. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no hosted legacy linked receipt. Keep the two request models separate. |
| PO line `quantity_remaining = quantity_ordered - quantity_received - quantity_cancelled`. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** PO lines empty; no calculation claim. |
| PO header `total_amount = SUM(purchase_order_items.total_cost)`. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** POs empty. The commercial total may be a signed snapshot; confirm its lifecycle before enforcing equality. |
| PO line `quantity_received = SUM(quantity_accepted)` across posted linked Receiving lines. | 0 / 0 | **NOT TESTED** | **MEDIUM potential risk:** no PO lines. Preserve partial-receipt and cancellation semantics in future comparison. |

## Method, scope, and evidence limits

The four hosted queries used only `SELECT`, aggregate `COUNT(*)`, `COUNT(*) FILTER`, grouped `SUM`, joins by IDs, and `IS DISTINCT FROM` for null-safe comparison. They returned no raw IDs or business values. The comparisons were evaluated against the current 34-table hosted project. Foreign keys, unique/check definitions, and relevant RPC/trigger paths were read from the existing disposition and migration artifacts. Zero mismatch means only the **specified** predicate passed for its checked rows; it does not prove all transaction paths, physical inventory, external payment settlement, Auth/Storage bytes, or future concurrency.

The [prior integrity audit](RECOVERY-STABILIZATION-20261013.md) recorded zero discrepancy in its earlier hosted relationship screens. The [defense readiness report](DEFENSE-DEMO-READINESS-20261014.md) documents isolated synthetic Customer → Cashier → KDS → Rider and Manager request → accepted Receiving → batch/ledger flows. Those are **previously tested local invariants**, not replacement rows for the empty hosted cancellation, PO, opening, or allocation branches. No direct customer PII, recipe quantity, credentials, or private Storage content was read here.

**Confirmed mismatches:** none in 16 populated checks. **Blocked:** representative query-performance baseline, because Docker could not connect to `npipe:////./pipe/dockerDesktopLinuxEngine` (daemon pipe absent). No isolated `EXPLAIN ANALYZE` or hosted performance measurement was performed, so `DATABASE-QUERY-PERFORMANCE-BASELINE.md` was not created. Plain hosted `EXPLAIN` was unnecessary for the integrity predicates and cannot provide observed latency by itself. The existing [performance plan](DATABASE-PERFORMANCE-OPTIMIZATION-PLAN.md) remains a candidate list, not measured improvement evidence.

## Next action

Keep hosted read-only. For populated PASS predicates, retain the current writers and rerun the same aggregate checks after any separately authorized change. For zero-row branches, use the preserved isolated same-database regression evidence and add focused future tests on an authorized representative stack; never create hosted fixture rows merely to turn NOT TESTED into PASS. If a future aggregate returns a nonzero mismatch, freeze the exact predicate and privately investigate source/temporal semantics before proposing a reversible writer guard or data repair. Any hosted change remains subject to the existing migration provenance, encrypted off-device DB/Auth/private Storage recovery, restore rehearsal, and separate approval gates.
