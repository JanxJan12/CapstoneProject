# CASHIER-PAY-RECON-03 — Local implementation report

Date: 2026-11-03. Hosted deployment is **not authorized** and did not occur.

## Architecture and resolution

The Orders list already loads its full order population before client-side search, filters, sorting, and pagination. A separate, owner-scoped read is therefore batched over its walk-in order IDs in groups of at most 100. This avoids changing list semantics or adding one RPC call per order. The existing online-payment hydration remains unchanged.

The new forward migration defines `public.get_cashier_order_payment_summaries(p_order_ids uuid[])`, returning `(order_id uuid, payment_method public.payment_method, payment_status public.payment_status)`. It is a read-only `SECURITY DEFINER` RPC with an empty search path, schema-qualified relations, no dynamic SQL, active Cashier role validation, `auth.uid()` ownership through `cashier_transactions.cashier_id`, a 1–100 ID input limit, rejection of null IDs, and `EXECUTE` limited to `authenticated`. It does not grant direct `payments` access. Unauthorized IDs produce no row. Closed shifts are included because ownership is tied to the transaction, not the current shift.

For a cashier-owned walk-in order, `Verified` is returned only when exactly one order payment and one cashier transaction exist, the transaction references that payment and is completed, the payment's recorded status is verified, and its amount equals the order total. A recorded voided payment with a voided transaction resolves to `Voided` under the same single-record, ownership, linkage, and amount checks. Missing, duplicate, contradictory, mismatched, or unowned evidence remains `Unknown`; no payment is inferred from Kitchen status, receipt, or shift closure. Pending and rejected **online** GCash states continue through the existing `get_cashier_online_payments` path. The current database payment enum has `pending`, `verified`, `rejected`, and `voided`; the UI has no separate backend `refunded` state. Existing cancellation logic records reversal with a voided payment/transaction.

The Orders table and mobile cards render `Unknown` as “Payment status unavailable,” rather than asserting a missing payment link. The filter still uses the same `Unknown` value. The Order Details drawer remains order-specific. A minimal guard prevents its single-sale fallback from presenting a clean Verified state when the batch explicitly found contradictory owned financial records. Otherwise its existing `get_cashier_sale` lookup remains available for unresolved owned walk-in sales.

## Source changes

- `supabase/migrations/20261102193437_cashier_owned_order_payment_summaries.sql` — new forward-only read contract and least-privilege grants.
- `src/modules/cashier/services/cashierOrderPaymentResolution.ts` — response validation, 100-ID batching, and conservative mapping.
- `src/modules/cashier/services/supabaseOrderService.ts` — one batch sequence per order refresh; failed financial reads leave orders unresolved without failing the entire list.
- `src/modules/cashier/types.ts`, `src/modules/cashier/orders/useOrderDetailsDrawer.ts` — optional unresolved-financial-evidence flag and narrow drawer presentation guard for contradictory owned records.
- `src/modules/cashier/components/StatusBadge.tsx` — optional label for an unknown status, preserving the default for other callers.
- `src/modules/cashier/orders/OrderTableRow.tsx`, `OrderCards.tsx`, `OrderFilters.tsx` — non-misleading Orders-list label only; filter value and behavior are unchanged. `OrderCards.tsx` was already untracked before this task.
- `qa/cashier-pay-recon-03.mjs` — synthetic mapping, malformed-response, batching, and SQL guard checks.
- This report.

Pre-existing dirty worktree changes were preserved. No previous migration was edited. No Customer, Kitchen, Rider, Manager, POS transaction, receipt, shift, or payment-action source was changed for this task.

## Security and performance evidence

The source contract checks `auth.uid()` and active Cashier role, then requires an owned transaction for every returned order. Both cashiers use the same RPC, but an unrelated cashier gets no row for a transaction they do not own. There is no caller-supplied cashier ID. The migration revokes PUBLIC and anon execution, grants authenticated execution, and adds no payment-table SELECT policy. These are **source-inspected properties**, not authenticated-runtime proof.

For `W` walk-in orders, the client makes `ceil(W / 100)` sequential payment-summary RPC calls during a database refresh, and zero when `W = 0`. There is no render-triggered fetch or per-row request. The existing full-list architecture remains the scaling limit; this task does not change its search/pagination semantics. The Cashier store's existing refresh generation check prevents stale completed refreshes from replacing newer state. If a payment batch fails, the Orders list still loads, with unresolved payment status. The frontend must be released together with or after the RPC; before migration deployment, the new call will fail and the list will use that unresolved fallback.

## Validation matrix

| Check | Result | Evidence or limit |
| --- | --- | --- |
| TypeScript typecheck | PASS | `npm run typecheck` |
| Production build | PASS | `npm run build` |
| Cashier Orders focused check | PASS | `node scripts/verify-cashier-order-list.mjs` |
| Transaction history focused check | PASS | `node scripts/verify-cashier-transaction-history.mjs` |
| Historical read model focused check | PASS | `node qa/cashier-data-01-read-model.mjs` |
| Synthetic payment mapping and batching | PASS | `node --experimental-strip-types qa/cashier-pay-recon-03.mjs`; 205 IDs produce batches of 100, 100, and 5 |
| Static SQL guard checks | PASS | Same script checks ownership, role, amount, count, status, search path, and grants; this is not SQL execution |
| `git diff --check` | PASS | Focused changed files |
| Migration replay in disposable PostgreSQL | BLOCKED | Docker engine and local PostgreSQL executables/services unavailable; no hosted replay attempted |
| Authenticated Cashier, other Cashier, and anonymous RPC calls | NOT VERIFIED | Requires migration replay in an isolated database |
| Closed-shift verified cash, current-shift cash, pending/rejected GCash, missing payment | NOT VERIFIED end to end | Source mapping tested; no authenticated runtime or disposable SQL fixture |
| Voided, refunded/reversed, duplicate, conflicting, amount mismatch | NOT VERIFIED end to end | Conservative SQL predicates inspected; SQL fixtures not run |
| Authenticated browser table/drawer comparison | NOT VERIFIED | New RPC was not deployed; no signed-in browser acceptance |

The prior **read-only** hosted investigation established that `ORD-000045` has a single linked verified ₱120 Cash payment and a completed matching transaction from a closed shift; the table previously labeled its unresolved projection “Payment unlinked.” That hosted evidence does not substitute for the missing authenticated-role and migration-replay tests.

An additional edge remains unverified at runtime: if a historical sale has duplicate or contradictory financial records, the batch returns an unresolved row and the drawer guard prevents its single-sale fallback from showing Verified. Disposable SQL and authenticated browser fixtures must confirm that behavior before deployment. A complete failure of the batch RPC still leaves the list unresolved while the drawer may independently resolve an owned sale; that outage case is not treated as evidence of a payment-state change.

## Deployment readiness and rollback

Local source implementation is complete, but **not ready for hosted rollout** until disposable migration replay and authenticated-role regression tests pass. No migration was deployed; hosted schema, payment, transaction, order, and receipt records were not modified. No general payment-table access was added.

Proposed later rollout, requiring separate authorization: review the exact migration and hash, replay it in an isolated clone with Cashier/other Cashier/anonymous contexts and financial edge fixtures, inspect execute privileges and source behavior, then apply only this reviewed migration to hosted Supabase. Verify function signature, grants, owner-scoped results, and a signed-in Cashier table/drawer comparison before releasing the frontend. Do not use a repository-wide `db push` against the dirty migration history.

If the hosted read contract must be rolled back, first revert the frontend to its prior payment-resolution path, then revoke authenticated execution and drop only `public.get_cashier_order_payment_summaries(uuid[])` in a reviewed migration. The RPC does not write financial data, so no payment-record rollback is involved.
