# H-13D Cashier payment conflict consistency — 2026-10-16 Manila

## Active contract and confirmed issue

The protected `/cashier` route mounts `CashierApp` → `PendingPaymentsPage`. It filters the Cashier store's payment projection to `Pending` rows. Verification calls `useCashierActions.verifyPayment` → `verifyCustomerGcashPayment` → `verify_customer_gcash_payment(uuid,uuid)`; rejection calls `rejectPayment` → `rejectCustomerGcashPayment` → `reject_customer_gcash_payment(uuid,text,text)`. The store's refresh reads `get_cashier_online_payments` alongside Cashier orders, sales, shift and menu data. The versioned RPCs in `20260831000000_secure_customer_gcash_verification.sql`, `20260831010000_customer_gcash_rejection_resubmission.sql`, and `20260830030000_cashier_online_payment_hydration.sql` use `payments` and `orders` as the status source of truth. Both write RPCs reject a payment that is no longer pending or an order no longer awaiting verification; verification creates a linked receipt and advances the order only after those checks. No database contract changed here.

**Source-confirmed defect:** on either exact status rejection, the mounted page's generic error path reselected the old pending row and reopened its verify/reject dialog. That offered the same invalid action until a later read happened to update the store.

**Correction:** `PendingPaymentsPage.tsx` recognizes only the two versioned status-conflict messages. It closes the action dialog, suppresses the stale payment ID plus `updatedAt` version in this page, and requests a fresh Cashier store read. A newly changed payment version can appear again if it is truly pending. Other write failures keep their previous dialog/error behavior. The existing server-read error and Retry control remain visible if the refresh fails; no local payment, order, receipt, shift, stock, or settlement record is fabricated or mutated by this presentation guard. The page file was already dirty before H-13D; this report describes only the conflict-handling addition.

## Checks and deferred acceptance

| Check | Result |
| --- | --- |
| Mounted route → action service → versioned RPC/DB status trace | **PASS, static source inspection** |
| `npm.cmd run typecheck` | **PASS** (exit 0) |
| `npm.cmd run build` | **PASS** (3,017 modules transformed) |
| `npm.cmd run verify:quality` | **PASS** (11 existing checks; none exercise this conflict) |
| Two authenticated Cashier sessions racing verify/reject, failed refresh and Retry, later resubmission, receipt/stock exactness | **NOT TESTED** in browser or database runtime |
| Hosted Supabase and physical Rider/payment evidence | **NOT TESTED** |

Consolidated local acceptance should cover H-13 Receiving stale-read Retry, H-13B Production conflict/double-click/committed-write read failure, H-13C Kitchen conflict/overlapping poll/failed follow-up read, and this H-13D Cashier payment conflict. For H-13D, use a disposable order and two authorized Cashier sessions, confirm one server outcome and one receipt/stock deduction where verification succeeds, then verify the losing session removes the stale action and that a failed read exposes Retry. Preserve closed shift snapshots and keep current payment receipts separate from fulfilled revenue. Hosted release remains **NO-GO** under the separate provenance and recovery gates.
