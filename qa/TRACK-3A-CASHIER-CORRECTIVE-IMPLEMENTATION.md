# TRACK-3A-CASHIER-CORRECTIVE-IMPLEMENTATION

Date: 2026-11-03 (Asia/Manila)  
Repository: `C:\Users\Janmari\Downloads\Capstone Project`  
Audit reference: `qa/TRACK-3-CASHIER-CONSOLIDATED-ALIGNMENT-AUDIT.md`

## 1. Executive result and original findings

| Finding | Track 3A result | Boundary |
| --- | --- | --- |
| T3-01 — initial Cashier hydration failure remains on a loading placeholder | **PASS** for focused source/behavioral tests, typecheck and build; **PARTIAL** for authenticated rendered acceptance. The failure now has a settled unavailable view while the existing Retry remains available. | No data service, mutation action, financial rule, or authorization code changed. |
| T3-02 — order-volume/incomplete hydration risk | **PARTIAL / unresolved.** The current hosted data is below the likely row-limit boundary; a complete safe fix spans more than the orders query. | No pagination rewrite, RPC change, migration or hosted setting change was made. |

The Track 3 audit was read in full before editing. Its historical browser gap remains: this task did not obtain an authorized authenticated Cashier browser session. `ORD-000080` was not verified, rejected, or modified.

## 2. T3-01 root cause, reproduction and correction

`CashierStore.tsx` starts `isHydrating = true`. Its initial `loadDatabaseState` calls five **read-only** loaders in parallel: `fetchCashierOrders`, `fetchCurrentShiftCashierSales`, `fetchCashierOnlinePayments`, `fetchOpenCashierShift`, and `fetchCashierMenuItems`. On success it merges authoritative data, clears the error, and sets `isHydrating` false. On failure it sets `databaseError` and leaves `isHydrating` true to keep unhydrated business workspaces gated. `refreshDatabaseState` only increments a refresh request counter; its effect clears the error and re-runs those reads. It does not invoke a sale, payment decision, or shift action.

**Before:** `index.tsx` chose “Loading cashier operations…” whenever `isHydrating` was true on a non-Dashboard page. Dashboard showed its skeleton. After a failed first read, the error banner appeared above a perpetual loading state. A source-level reproduction checked the failure branch and the unconditional loading selection and printed `REPRODUCED: failed initial hydration still selects loading placeholder`. Two preparatory one-off commands failed because of PowerShell quoting and a faulty test slice; neither was an application result. The corrected reproduction passed before the edit.

**After:** the small pure `cashierHydrationView` selector distinguishes `loading`, `failed`, and `ready`. When initial hydration fails, `CashierApp` shows “Cashier operations are unavailable. Use Retry above to load them.” for **all** Cashier pages, including Dashboard, and retains the existing error banner/Retry. The unhydrated page content stays gated. Retry clears the error, shows loading (Dashboard skeleton or other-page placeholder), and success reveals the authoritative workspace. If a later background refresh fails after successful hydration, the workspace stays visible with its error banner, preserving existing behavior.

**Changed production files:**

| File | Exact purpose |
| --- | --- |
| `src/modules/cashier/cashierHydrationView.ts` | New four-line view-state selector for initial loading, failed load and ready state. |
| `src/modules/cashier/index.tsx` | Uses the selector and renders a settled unavailable message during a failed initial load. Existing error banner, Retry callback, Dashboard skeleton and normal content remain in place. |

`src/modules/cashier/hooks/CashierStore.tsx` was **inspected, not edited**. Its authoritative-read and retry semantics remain intact. No payment/shift/POS component was edited.

**Regression coverage:** `qa/cashier-hydration-retry-regression.mjs` exercises `loading → failed → loading → ready`, a hydrated background-refresh error, and source guards for the failure message, existing Retry wiring, read-only refresh counter, and absence of mutation calls in the hydration routine. It passed. These checks validate the deterministic view selection and wiring; they are not a signed-in browser simulation.

## 3. T3-02 order-volume investigation and decision

The affected path is `fetchCashierOrders` in `src/modules/cashier/services/supabaseOrderService.ts`. It selects **all** RLS-visible orders in `created_at` descending order without `.range()` or a server page. It then queries all matching `order_items` and `order_status_history` with `.in(orderIds)` and no page/batch. Walk-in payment summaries are already batched at 100 IDs in `cashierOrderPaymentResolution.ts`, but that batching cannot recover orders omitted by an earlier read. `useOrderList` filters and paginates only the already-loaded `state.orders`; those page numbers do not page the server query.

`CashierStore` merges this order read with `get_cashier_online_payments()` and current-shift sale hydration. The online-payment RPC currently has **no pagination arguments**, and `fetchCashierOnlinePayments` calls it once. `PendingPaymentsPage` finds the selected payment's order in `state.orders`; a truncated older order can leave a pending proof in the queue without its order details/action target. The backend's restaurant-wide pending-online-GCash closure block remains active, so this could make a valid closure operationally difficult without permitting an unsafe close. Older orders/receipts may also disappear from the Orders view while the separate owner-scoped transaction-history RPC remains independently paged. No historical database rows are changed by this behavior.

[Supabase documentation](https://supabase.com/docs/reference/javascript/v1/select) states that projects default to a maximum of 1,000 returned rows, configurable in project API settings, and recommends `range()` pagination; its [range reference](https://supabase.com/docs/reference/javascript/using-modifiers-range) warns that order matters. This task did **not** establish the hosted project's configured maximum. A read-only hosted query found 66 orders, 72 items, and 269 status-history rows at inspection, so no truncation was observed. The hosted `get_cashier_online_payments()` signature has no arguments; the owner-scoped walk-in summary RPC accepts batches of UUIDs. No hosted data was mutated.

**Decision:** stop T3-02 implementation at investigation. Merely adding `.range()` to the order read would leave item/history caps and the unpaged payment queue, and offset paging over changing orders with only a `created_at` sort could duplicate or skip tied/new rows. A complete remedy requires a coordinated, bounded read model for orders, related rows, and pending payments, with deterministic cursors/limits and synthetic >1,000-row authorization and queue tests. It may use supported frontend API paging, but whether the payment RPC needs a new paginated contract must be decided and tested before implementation. Any hosted RPC/RLS/financial change requires separate authorization. No partial pagination code was shipped.

## 4. Validation and safeguard evidence

| Executed command/check | Actual result |
| --- | --- |
| `node qa/cashier-hydration-retry-regression.mjs` | **PASS**, exit 0. |
| `npm run typecheck` | **PASS**, exit 0. |
| `npm run build` | **PASS**, exit 0; Vite built in 15.05 s. |
| `node qa/cashier-ia-01-navigation.mjs` | **PASS**, exit 0. |
| `node qa/cashier-opt-02-pos-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-opt-03-action-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-opt-04-workflow-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-opt-05-shift-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-pay-recon-03.mjs` | **PASS**, exit 0. |
| `node qa/cashier-rs-02-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-receipt-01-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-receipt-01-print-regression.mjs` | **PASS**, exit 0; checks existing synthetic PDF evidence, not a live browser print. |
| `node qa/cashier-ss-02b-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-ss-02c-interaction-regression.mjs` | **PASS**, exit 0. |
| `node qa/cashier-data-01-read-model.mjs` | **PASS**, exit 0. |
| `node scripts/verify-cashier-order-list.mjs` | **PASS**, exit 0. |
| `node scripts/verify-cashier-transaction-history.mjs` | **PASS**, exit 0. |
| `node qa/cashier-fin-01-scenarios.mjs` | **PASS**, exit 0; 23 synthetic reconciliation scenarios. |
| `node scripts/verify-manager-focused-refinements.mjs` | **PASS**, exit 0; non-fatal Node type-stripping warning. |
| `node scripts/verify-manager-shell-navigation.mjs` | **PASS**, exit 0; 21/21 checks. |

The correction changes only a read-state presentation gate. It does not call or alter `create_walk_in_sale`, GCash verify/reject, start/close shift, financial calculations, authorization, RLS, RPCs, migrations, or Supabase configuration. Existing POS/payment/receipt/shift and Manager regression scripts passed. Prior Track 2C disposable SQL shift-lifecycle results were reviewed, **not rerun**; no state-changing SQL test was needed for this view-only change. Authenticated desktop/mobile rendering and actual network-failure retry remain **BLOCKED** by the previously documented browser-control host gap, so the T3-01 runtime assessment stays PARTIAL despite passing local checks.

## 5. Diff review, files and acceptance checkpoint

Intended Track 3A additions/edits are the two production files above, `qa/cashier-hydration-retry-regression.mjs`, and this report. The production change in `index.tsx` is one import, one selector call, and an unavailable-state branch ahead of the existing loading branch. No implementation code for T3-02 was changed. `git diff --check -- src/modules/cashier/index.tsx` reported no whitespace error; Git printed a line-ending conversion warning only. The checkout was heavily dirty before Track 3A, so aggregate `git diff --stat` for those already-modified Cashier files includes unrelated prior edits and is **not** a Track 3A delta. New test/helper/report files are untracked and likewise absent from `git diff --stat` until added. Existing `qa/cashier-receipt-01-evidence-20261030/*.html` files remain untracked from the earlier Track 3 run; Track 3A did not run the HTML renderer or regenerate those files. The build regenerated ignored `dist` output.

**Next checkpoint:** in an authorized browser session, force an initial read failure against a disposable API, confirm settled error and gated actions on Dashboard/POS/Payments/Orders/Settlement, then Retry and confirm normal hydration at desktop/mobile widths. Separately scope and approve a complete order/payment read-model pagination contract and >1,000-row isolated tests before T3-02 implementation. Do not use `ORD-000080` or hosted financial records as fixtures. Stop after this report; no further audit, deployment or corrective implementation is implied.
