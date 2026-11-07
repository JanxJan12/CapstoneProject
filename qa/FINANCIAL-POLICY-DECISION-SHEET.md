# RRJ’S FOOD-HOUSE — Owner financial policy decision sheet

**Status: Decision requested; no option has been approved or implemented.** This sheet uses the [H-07 metric definitions](FINANCIAL-METRIC-DEFINITION-MATRIX.md) and [isolated reconciliation](FINANCIAL-RECONCILIATION-REGRESSION.md). It is for the restaurant owner to choose business meaning before any label, report or accounting-contract change. The local Manila date filter correction is a presentation fix, not a new financial policy.

## 1. Names shown to staff and in reports

The current system has different valid grains. A paid but unfulfilled synthetic order contributed ₱140 to verified receipts and ₱0 to Manager fulfilled sales. The active Cashier Dashboard presently shows shift drawer/work queue; its older “Sales Today” card is not mounted.

| Value | Present calculation | Owner's display-name choice |
| --- | --- | --- |
| Order intake | `orders.grand_total` for created orders; may include unpaid/cancelled orders unless explicitly excluded | ____________________ |
| Verified collections | Current `payments.status='verified'` amount; can include unfulfilled orders | ____________________ |
| Completed receipts | Current completed `cashier_transactions`, dated by receipt creation in Manila; later voids drop from current view | ____________________ |
| Fulfilled sales | Verified payment on successfully fulfilled orders, dated by effective fulfillment in Manila | ____________________ |
| Closed-shift expected drawer | Opening cash plus completed verified cash receipts at closure; GCash disclosed separately | ____________________ |

**Decision 1:** Approve these as separate staff-facing metrics, or specify which should be combined and exactly why: ____________________. Also decide whether the active Cashier Dashboard should display a receipt-day sales card: **Yes / No**. If yes, approved title: ____________________.

## 2. Refund date and evidence

The paid-cancellation record currently captures a Manager-confirmed settlement and voids the original local payment/receipt. For GCash, it does not itself execute or independently verify an external transfer.

**Decision 2A — time axis:** Show the refund as an adjustment on **the original sale date / the Manager-confirmation date / both, in separate columns**. Specify which timestamp governs each report: ____________________.

**Decision 2B — evidence:** Define required external GCash proof or reconciliation before a Manager may attest completion, who checks it, and how disputes or reversals are handled: ____________________.

**Decision 2C — period reporting:** Should a previously issued sales report be restated when a later cancellation voids its receipt, or remain an as-issued snapshot with a later-period contra-entry? **Restate / Preserve with later adjustment / Other:** ____________________.

## 3. Net sales definition

No approved standalone net-sales formula or authoritative net-sales RPC exists. Current fulfilled sales already excludes a payment that has become voided. Subtracting the same cancellation amount again would double count the reduction.

**Decision 3:** Write the exact formula and grain for “net sales,” including whether the starting point is completed receipts or fulfilled sales, and how discounts, tax, delivery fee, voids, partial refunds and later-period refunds enter. Formula: ____________________. Report date basis: ____________________. Treatment of an unpaid fulfilled order: ____________________.

## 4. Historical closed-shift adjustments

In the isolated H-07 case, a permitted later GCash paid cancellation changed the current completed-receipt count from 1 to 0 while the earlier closed shift stayed closed with its stored expected cash. The closure is a historical settlement snapshot; the current receipt view is a live projection.

**Decision 4:** Preserve the signed closure and display a dated later adjustment alongside it (**recommended for traceability**), or authorize another defined treatment: ____________________. Specify whether a later GCash refund changes historical GCash sales display, whether an adjustment is attributed to the original cashier/shift or the Manager's refund period, and who may approve any correction: ____________________.

## Approval and implementation gate

Owner name/signature: ____________________  Date: ____________________

After approval, prepare a separate implementation proposal stating the chosen formulas, authoritative event/row, roles, historical comparison, rollback/restore path and regression cases. Any SQL, permission, migration or accounting-behavior change requires separate authorization. This decision sheet does not authorize a change.
