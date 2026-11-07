# Cashier functional and security review — October 2026

**Boundary:** One read-only pre-acceptance pass on the canonical repository and hosted Supabase project `zhzluhqvysvsadwuugpa`, on 2026-10-21. No application, migration, policy, business record, or hosted configuration was changed. Catalog queries and aggregate counts were read-only. The worktree was already dirty and was preserved. This report is the only repository addition from this review.

## A. Executive summary

**Disposition:** Continued local development is suitable. A controlled Capstone demonstration can proceed only with a supervised Cashier account and the existing UI path, while keeping shift closure and GCash approval out of the demo unless separately verified. Real financial operations are **not approved by this evidence**.

The owner's earlier manual observations establish two cash POS sales (`ORD-000060`, `ORD-000062`), GCash rejection and resubmission on `ORD-000061`, receipt previews, and five displayed saved shifts. Those are historical observations, not transactions repeated in this pass. The current source uses server RPCs for consequential actions, and the hosted catalog shows unique receipt/request/payment/order constraints, row locks, role checks, and restrictive direct-write grants. The material gap is that the hosted shift-closing RPC omits the pending-payment guard implemented in the UI. One open shift and one pending GCash payment existed at the time of the read-only count; no closure was attempted.

Hosted `cashier_shifts` RLS lets an authenticated user read their own rows without checking whether their Cashier profile remains active. The hosted historical RPC performs the active-profile check, but a direct table read can bypass that RPC. The H-08C closed-shift protection trigger is absent; current `authenticated` grants deny direct shift writes, so its absence does **not** establish an ordinary Cashier snapshot-mutation exploit. The approved migration history also does not show H-08C applied wholesale. These points need narrow, separately approved backend corrections.

## B. Critical workflow coverage

| Workflow | Result | Evidence and limit |
| --- | --- | --- |
| Walk-in POS cash transaction | **PARTIAL** | Owner's historical `ORD-000060`/`ORD-000062` observations; source `pos/useWalkInPOSController.ts`, `api/walkInSaleApi.ts`, `hooks/useCashierActions.ts`; hosted `create_walk_in_sale` is active-Cashier, shift-linked, request-ID based, and inserts order/payment/transaction in one function. No sale was made now. |
| GCash proof submission/rejection | **PARTIAL** | Owner's `ORD-000061` rejection/resubmission; hosted private `payment-proofs` bucket and scoped Storage policies; rejection RPC checks active Cashier, pending payment, waiting order, proof path/object, and reason. No fresh authenticated action. |
| GCash approval | **NOT TESTED** | Hosted verification RPC has active-Cashier, open-shift, row-lock, payment/order-state and replay checks on inspection. No actual merchant-ledger match or hosted approval was performed; the intentionally invalid `ORD-000061` proof must remain unapproved. |
| Order progression | **PARTIAL** | Earlier manual queue/Kitchen observations; hosted `release_ready_order` checks staff and `ready` status under an order lock. `cancel_order` blocks pending/verified payments and any cashier transaction. No transition executed now. |
| Rider dispatch | **PARTIAL** | Hosted one-active-assignment-per-order unique index, order locks, and deployed Cashier assignment-status RPC found. A real offer/accept/delivery journey was not repeated. |
| Receipt/history | **PARTIAL** | Earlier previews; source `transactions/useTransactionHistory.ts` exports the same filtered set and opens receipt preview without printing; `transactionSummaryMetrics.ts` uses recorded completed transaction amounts and excludes Refunded/Voided from completed revenue. Hosted transaction keys uniquely constrain request, order, payment, transaction number and receipt number. Physical print not tested. |
| Shift closure | **FAIL — control gap** | Hosted `close_cashier_shift` does not check pending payments, while `shifts/EndShiftDialog.tsx` and `shifts/ShiftSettlementPage.tsx` block in the UI. No shift was closed. See CASH-FIN-001. |
| Historical settlement | **PARTIAL** | Owner saw five closed shifts. Hosted six-argument `get_closed_cashier_shifts` reads saved amounts with active-role checks and keyset pagination; catalog confirms five closed rows. No trigger protects frozen rows from privileged changes. See CASH-FIN-003. |
| Role authorization | **PARTIAL** | Hosted function EXECUTE grants deny `anon` for reviewed Cashier RPCs; active-role checks are present in their bodies. Direct shift/transaction SELECT policy lacks active-profile check. No live role-token denial test was run. See CASH-FIN-002. |

**Current checks:** `npm.cmd run typecheck` **PASS**; `npm.cmd run verify:quality` **PASS** (11 checks); `node scripts/verify-cashier-workspace.mjs` **PASS**; `node scripts/verify-cashier-order-list.mjs` **PASS**; `node scripts/verify-cashier-transaction-history.mjs` **PASS**. These are static/fixture checks, not hosted transactional or browser acceptance. Browser inventory had no authenticated browser/app; current rendered behavior is **NOT TESTED**.

## C. Financial integrity findings

### CASH-FIN-001 — Pending payment closure guard exists only in the UI

- **Severity:** P1. **Workflow:** End Shift / GCash verification.
- **Evidence:** `src/modules/cashier/shifts/ShiftSettlementPage.tsx:15-30`, `EndShiftDialog.tsx:101,460` block when `pendingPaymentCount > 0`; `src/modules/cashier/api/shiftApi.ts:120` calls the hosted RPC. The hosted `public.close_cashier_shift(numeric,text,text)` definition checks active Cashier, locks the open shift, validates cash/variance, aggregates completed verified sales, and updates the shift, but has no pending-payment query. A read-only hosted count returned **1 open shift, 1 pending GCash payment**.
- **Observed behavior / cause:** The RPC's server-side closure preconditions are weaker than the UI's. This is a confirmed definition gap; no live closure bypass was attempted.
- **Impact:** An active Cashier calling the RPC directly can bypass the pending-payment UI block. The pending proof would remain unresolved while the shift is closed; later verification requires an open shift and may be attributed to a different shift after reopening. The exact operational outcome requires isolated testing.
- **Smallest correction / scope:** Add a server-side pending-payment precondition to `public.close_cashier_shift`, with a clear policy for which pending payments block which Cashier. Lock or otherwise coordinate with verification/submission so a concurrent pending payment cannot slip between check and closure. Deliver as a narrowly scoped additive migration after approval; retain cash aggregation and stored snapshot semantics.
- **Acceptance:** On isolated data, pending proof blocks direct RPC closure with no shift-row change; resolution permits exactly one closure; concurrent verification/closure serializes safely; a second closure fails; completed receipt totals and saved snapshot are unchanged by retries. **Confidence:** Strongly supported by hosted function inspection, not a production write probe.

## D. Security and RLS findings

### CASH-FIN-002 — Inactive Cashier can retain direct reads of own financial rows

- **Severity:** P1. **Workflow:** Direct Data API reads of `cashier_shifts` and `cashier_transactions`.
- **Evidence:** Hosted `authenticated` has SELECT and no INSERT/UPDATE/DELETE on both tables; RLS is enabled. Both `*_select_staff` policies allow `cashier_id = auth.uid()` independently of `profiles.is_active`. The hosted `get_closed_cashier_shifts` RPC does check active Cashier/Manager and restricts Cashiers to their own rows.
- **Observed behavior / cause:** The policy text permits an authenticated token belonging to the row's Cashier even after that profile is deactivated. A fresh inactive-token REST request was not made. The policy does not permit one Cashier to read another's rows; Customers and Riders without matching cashier IDs do not gain general shift access. Direct shift writes remain denied.
- **Impact:** A deactivated former Cashier with a still-valid authenticated session can potentially retrieve their historical settlement and transaction rows directly, bypassing the RPC's active-account denial.
- **Smallest correction / scope:** Narrow the two direct SELECT policies to require a current active Cashier profile for owned rows and active Manager profile for Manager reads. Preserve the existing column grants and RPC contract. Use an approved additive migration; do not broaden RLS.
- **Acceptance:** Isolated authenticated REST/JWT checks: active Cashier sees only own rows; inactive Cashier sees none by direct table and RPC; active Manager sees authorized rows; inactive Manager, Customer, Rider, and anon are denied. **Confidence:** Strongly supported by effective hosted ACL and policy definitions; live token enforcement not tested.

### CASH-FIN-003 — Closed-shift snapshot trigger is absent, without a current direct Cashier write path

- **Severity:** P2. **Workflow:** Frozen historical settlement integrity.
- **Evidence:** Hosted `pg_trigger` returned no non-internal trigger on `public.cashier_shifts`; `public.protect_closed_cashier_shift_snapshot()` is absent. `supabase/migrations/20261014191853_h08c_historical_shift_access.sql:78-103` contains the previously tested local trigger. Hosted `authenticated` has no UPDATE/DELETE table or column privilege; `service_role` has both. Hosted `close_cashier_shift` updates only an `open` row after locking it; the searched deployed function bodies show no other ordinary shift updater.
- **Observed behavior / cause:** The database does not enforce the H-08C immutable-closed-row invariant across privileged writers. The missing trigger alone is **not** a confirmed exploit available to an ordinary Cashier. Existing direct grants and current RPC guards substantially limit exposure.
- **Impact:** A future privileged writer or mistaken service-role operation could restate/delete a closed snapshot without a row-level guard. No such mutation was observed.
- **Smallest correction / scope:** After CASH-FIN-001 is settled, review and deploy a narrowly scoped closed-snapshot trigger migration, preserving any intended Manager approval fields. Do not deploy the whole historical H-08C migration without reconciling its policy and grant changes against hosted state.
- **Acceptance:** In an isolated database, closing an open shift succeeds once, but subsequent privileged UPDATE of protected snapshot fields and DELETE of the closed row fail; allowed approval-only metadata still works if intended. Then verify hosted trigger attachment via catalog after separately approved deployment. **Confidence:** Confirmed missing invariant; current exploitability requires a privileged writer or future code path.

**Other reviewed controls:** Hosted `payment-proofs` is private, limited to JPEG/PNG up to 5 MB, and Storage policies scope Customer-owned objects and active Cashier/Manager reads. `payments`, `orders`, and `order_items` direct authenticated writes are not granted in the inspected catalog. The reviewed sensitive RPCs are `SECURITY DEFINER` with explicit active-role checks and `anon` EXECUTE denied. Those catalog and source checks do not replace a fresh role-token test.

## E. Reliability and transaction handling

`create_walk_in_sale` calculates canonical item/modifier prices, discounts, tax/total and cash change server-side, validates item availability and quantities, associates the open Cashier shift, and inserts order/payment/transaction in one PostgreSQL function. The confirmed-order history trigger invokes inventory deduction in that same transaction. A unique transaction request ID, payment ID, order ID, and receipt number constrain duplicate effects. The client retains the request ID during unknown responses and reconciles the returned sale before showing success. `verify_customer_gcash_payment` locks the shift, payment and order; checks pending/waiting states; and rejects a different request for an already settled payment/order. Rejection requires a reason and stores rejection audit fields. These are source/hosted-definition findings; new network-loss and concurrency tests were **NOT TESTED**.

The UI uses recorded `transaction.amount` for completed revenue and keeps refunds/voids outside that figure. A receipt preview only sets dialog state; printing requires the separate Print control. The shift close RPC saves expected/actual cash and variance in one update, and the historical RPC returns those stored fields with a bounded keyset page. Physical printing, external GCash receipt matching, live cash counts, and post-close refund interpretation remain **NOT TESTED**.

## F. Prioritized remediation plan

1. **P1 shared backend, approval required:** Add pending-payment enforcement and concurrency handling inside `close_cashier_shift` (CASH-FIN-001). Keep the frontend block as early feedback.
2. **P1 shared backend, approval required:** Tighten existing `cashier_shifts` and `cashier_transactions` SELECT policies for inactive accounts (CASH-FIN-002). No Cashier-only UI change is needed.
3. **P2 shared backend, approval required:** Add the closed-snapshot guard alone after reviewing allowed privileged approval metadata (CASH-FIN-003).

No hosted migration or application fix is authorized by this read-only assessment. No Customer, Manager, Rider, Kitchen, Inventory, Production, or standalone Android changes are proposed. Existing Cashier session isolation, assignment-status visibility, Realtime recovery and edit confirmation should remain intact.

## G. Minimum acceptance and verification plan

Use an existing isolated database if available; do not rebuild infrastructure for this report. First prove the three findings' acceptance criteria above with synthetic shifts/payments and active/inactive role tokens. For a separately approved hosted migration, inspect exact SQL and apply only the approved migration; then use read-only catalog/SELECT checks and safe role reads. Recheck one Cashier POS receipt and one authorized closed-shift history page using existing records. Do not approve `ORD-000061`, create sales, close the live shift, or mutate historical rows for acceptance.

## H. Final recommendation

- **Continued local development:** Suitable, with P1 backend work isolated and prioritized.
- **Controlled Capstone demonstration:** Conditional. Use the established, supervised UI paths and existing records; do not demonstrate shift closure or claim GCash settlement proof until the server closure guard and role checks are verified. Historical manual successes remain useful evidence with their original scope.
- **Real financial operations:** Not established. Resolve P1 findings, test closure/role/concurrency behavior safely, confirm external GCash verification practice, and complete the separate release/recovery gates before treating the hosted system as financially ready.

**Stop boundary:** Review complete. No fixes, deployment, payment decision, order transition, shift operation, or new business data were produced.
