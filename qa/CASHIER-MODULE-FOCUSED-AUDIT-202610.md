# RRJ's Food-House — focused Cashier audit

**Date:** 2026-10-21 (Asia/Manila)
**Scope:** Current mounted Cashier module and its direct Supabase dependencies. Audit only.
**Evidence levels:** `SOURCE` = current working-tree code; `HOSTED` = read-only catalog/function inspection of project `zhzluhqvysvsadwuugpa`; `RUNTIME` = authenticated user-flow observation. No Cashier `RUNTIME` test was performed.

## Executive summary

**Assessment: partially operational at source level; end-to-end operation unverified.** The mounted module has implemented paths for shift start/close, walk-in sales, online GCash review, order edits/cancellation, ready-order release, rider offers, and history. A read-only hosted inspection found the called core RPC signatures, active-role checks, transaction-level row locks on important transitions, RLS on the directly read order tables, and a unique index preventing two active assignments for one order. `npm.cmd run typecheck` passed. These facts establish compatibility and guardrails, not successful authenticated transactions.

The most consequential gaps are cached operational/customer state crossing Cashier sessions, incomplete visibility of rider offers/assignments, no authoritative order refresh on network return, and an edit success message shown before the refresh succeeds. There is **no confirmed P0** in this audit. No hosted writes, synthetic transactions, browser login, or Rider-device actions were performed.

## Current Cashier architecture and workflow

- `/cashier` is lazy mounted under `<RequireAuth role="cashier">` in `src/app/routes.tsx:166-174`; `src/app/RequireAuth.tsx:13-65` checks the restored role. `src/app/providers/AuthProvider.tsx:109-205` loads `profiles.role` and `is_active` from Supabase. The client uses the publishable key in `src/lib/supabase.ts:3-42`.
- `src/modules/cashier/index.tsx:31-35,81-125,282-315` mounts `CashierProvider` and the active dashboard, pending payments, walk-in POS, order list, transactions, and shift settlement views. Legacy or standalone components outside this navigation are not assumed active.
- `src/modules/cashier/hooks/CashierStore.tsx:140-294,464-592` holds the shared view state and hydrates orders, current-shift sales, online payments, the open shift, and menu. `src/modules/cashier/hooks/useCashierActions.ts` invokes business RPCs; `src/modules/cashier/services/supabaseOrderService.ts:291-463` reads order rows/items/history. Browser `localStorage` persists most Cashier state (`src/modules/cashier/hooks/cashierPersistence.ts:34-126`).
- Existing lifecycle: Customer creates/submits an online order and payment; Cashier reviews GCash proof (`verify_customer_gcash_payment` / `reject_customer_gcash_payment`); KDS prepares and marks ready; Cashier releases a ready order (`release_ready_order`) and may offer a delivery to a rider (`offer_order_to_next_rider`); Rider accepts, advances, and completes delivery via Rider RPCs. Walk-in POS uses `create_walk_in_sale` and `get_cashier_sale`; shifts use `get_open_cashier_shift`, `start_cashier_shift`, and `close_cashier_shift`.
- The dashboard derives its queue and counters from Cashier state (`src/modules/cashier/hooks/useCashierDashboard.ts:8-38`, `src/modules/cashier/services/cashierDashboardService.ts:157-238`). Order changes trigger a full refresh through the three Realtime listeners in `CashierStore.tsx:535-592`; there is also a manual refresh and menu-on-focus refresh.

## Functional coverage matrix

| Workflow | Result | Evidence / limit |
| --- | --- | --- |
| Cashier route and active-role gate | PARTIAL | Client route and hosted role checks inspected; no authenticated access attempt. |
| Dashboard queue/counters | PARTIAL | Derivation traced; source-supported stale-state gap in CASH-001/003; no live value comparison. |
| Incoming orders, details, search, status/history | PARTIAL | Direct orders/items/history read and UI mapping traced; no authenticated order run. |
| Walk-in sale and receipt | NOT TESTED | RPC and reconciliation code inspected; no sale created. |
| Online GCash verification/rejection | PARTIAL | Hosted signatures, role/row-lock behavior, and client conflict recovery inspected; no payment decision performed. |
| Ready release and cancellation | PARTIAL | RPCs, client reconciliation, and hosted guards inspected; no operational mutation performed. |
| Rider offer and Cashier assignment view | FAIL (source projection) | Offer RPC exists; current Cashier read model neither loads assignments nor refreshes after offer; CASH-002. Rider acceptance/device behavior NOT TESTED. |
| Realtime and network recovery | PARTIAL | Order/history subscriptions exist and clean up; focus only refreshes menu; CASH-003. Delivery timing NOT TESTED. |
| Shift start/close, totals/history | NOT TESTED | Client and hosted RPC paths inspected; no shift action performed. |
| Desktop/tablet/mobile rendered usability | NOT TESTED | No safe authenticated browser session established during this audit. Static responsive observations below. |

## Prioritized findings

### P1 — important

**CASH-001 — Persisted customer and operational state survives cashier changes and failed hydration.**
**Area:** Session transition, dashboard, orders, payments, shifts. **Evidence:** `src/modules/cashier/hooks/cashierPersistence.ts:34-126` restores/saves the full state to one storage key; `src/modules/cashier/hooks/CashierStore.tsx:327-364` changes cashier identity but clears only held orders and notifications; `:464-530` leaves the previous state in place if a refresh fails and ends hydration. **Observed problem:** The active UI can render prior cached orders/payments/transactions or closed shifts after an account switch or failed authoritative read. This is a source-confirmed path, not a demonstrated cross-user browser incident. **Root cause:** Shared browser cache is neither scoped to the authenticated cashier nor stripped of server-owned/customer fields before reuse. **Impact:** Misleading counters and order decisions; customer contact/payment metadata remains in persistent workstation storage. **Fix:** Persist only device-local preferences/draft metadata, scope it to the account, and clear server-owned state on identity change; on failed initial hydration, keep operational actions unavailable until a fresh read succeeds. **Scope:** `cashierPersistence.ts`, `CashierStore.tsx`, relevant action gates. **Acceptance:** On cashier A→B switch and an induced read failure, B never sees A's cached customer/transaction data, and no mutation action uses it; a successful refresh restores the correct state. **Confidence:** Strongly supported by source; requires browser verification.

**CASH-002 — Rider offer and assignment state is missing from Cashier's authoritative view.**
**Area:** Rider dispatch, order details/list. **Evidence:** `src/modules/cashier/hooks/useCashierActions.ts:485-508` only awaits `offer_order_to_next_rider`; `src/modules/cashier/services/supabaseOrderService.ts:291-359,448-455` fetches orders/items/history but no `delivery_assignments`; `src/modules/cashier/orders/OrderDetailsDrawer.tsx:170-222` shows `assignedRider ?? "No rider assigned"` and retains the offer action while status is `Waiting for Rider`. Hosted `offer_order_to_next_rider` inserts an `offered` assignment without changing order status; hosted `delivery_assignments` triggers only update timestamps and push enqueue. The hosted unique index `delivery_assignments_one_active_per_order_idx` prevents duplicate active offers per order. **Observed problem:** After a successful offer, the Cashier view has no assigned rider or offer state, and the offer control remains eligible; a repeat hits the server's duplicate guard. **Root cause:** Assignment data is absent from the Cashier read model and Realtime subscriptions (`CashierStore.tsx:535-592`). **Impact:** Cashier cannot reliably distinguish an outstanding offer from no offer, or see rejection/offline release before deciding to reoffer. **Fix:** Add an authorized assignment projection/read for relevant orders, reconcile it after the offer RPC, subscribe to assignment changes (or perform bounded refresh), and label offered/accepted/released states. Keep the backend uniqueness guard. **Scope:** Cashier order service, store/actions, order details/list; a **hosted Supabase change needs separate authorization only if the current RLS/RPC cannot expose the required staff projection**. **Acceptance:** Successful offer displays the rider and pending offer, disables repeat offer, and rejection/offline release or Rider acceptance updates the Cashier view without a misleading state; concurrent offers leave one active assignment. **Confidence:** Confirmed source/hosted projection gap; rendered timing requires runtime verification.

**CASH-003 — Order state does not explicitly reconcile after network return.**
**Area:** Realtime/dashboard/order list. **Evidence:** `CashierStore.tsx:535-592` subscribes to order INSERT/UPDATE and history INSERT and reports channel error, but no `SUBSCRIBED` recovery refresh; `:598-638` refreshes menu only on focus/visibility. `src/modules/cashier/orders/useOrderList.ts:113-121` advances the elapsed-time clock but does not reload orders. Hosted `supabase_realtime` publication includes orders/history/assignments; Cashier listens only to the first two. **Observed problem:** If changes occur while disconnected or the tab sleeps, the module has no explicit authoritative order reconciliation when focus returns or the channel recovers; manual refresh remains necessary in that path. **Root cause:** Refresh lifecycle is tied to delivered events and manual action. **Impact:** Old payment/order/dispatch status can remain visible during an operational decision. **Fix:** Trigger one guarded full refresh on channel resubscription and focus/online return, with deduplication and clear stale/error state. **Scope:** `CashierStore.tsx`. **Acceptance:** After a missed order/history event, restoring the connection updates Cashier state without manual refresh; rapid focus/reconnect events do not commit an older response. **Confidence:** Strongly supported by source; missed-event scenario requires runtime verification.

**CASH-004 — Order edit reports success before the new state is confirmed.**
**Area:** Order list operational edit. **Evidence:** `src/modules/cashier/hooks/useCashierActions.ts:458-480` awaits the update RPC then calls `refreshDatabaseState()` (which only increments a request counter in `CashierStore.tsx:382-384`); `src/modules/cashier/orders/useOrderList.ts:283-299` immediately displays `updated` and closes the editor. **Observed problem:** A successful RPC followed by a failed or stale read still produces the success toast and leaves the old order projection displayed. **Root cause:** The asynchronous follow-up hydration is not awaited/reconciled before the UI claims updated state. **Impact:** Cashier may act on or communicate old customer/contact/fulfillment details. **Fix:** Verify the returned RPC row and perform an awaited scoped authoritative read before closing and confirming; show an explicit pending-reconciliation state if the write response is uncertain. **Scope:** `useCashierActions.ts`, order service, `useOrderList.ts`. **Acceptance:** Success appears only when the edited fields are visible from an authoritative read; a failed follow-up read leaves a retry/reconcile path and no false success. **Confidence:** Confirmed source behavior; failure sequence needs runtime verification.

### P2 — improvement

**CASH-005 — Order list loads all orders and related rows before client pagination.**
**Area:** History/search performance. **Evidence:** `supabaseOrderService.ts:291-370` reads all visible orders then issues `.in("order_id", orderIds)` for all items/history; `useOrderList.ts:175-183` paginates only after client filtering. **Observed problem:** Read size and URL/filter length grow with order history. **Root cause:** No bounded server-side page/filter in this path. **Impact:** Slow or failed loading as history grows; no failure reproduced on current data. **Fix:** Add a bounded, authorized server query/page for history while preserving current operational queue coverage. **Scope:** Order service and list hook; hosted query/RPC only if required. **Acceptance:** Large-history fixture loads the first page and finds searched orders without fetching the whole history; current active orders remain complete. **Confidence:** Strongly supported scaling risk, not a reproduced failure.

**CASH-006 — Mobile order operations depend on a wide horizontally scrolling table.**
**Area:** Order list responsive usability. **Evidence:** `src/modules/cashier/orders/OrderTable.tsx:55-58` sets `min-w-[1040px]` under horizontal overflow, including the action column. **Observed problem:** At about 390px or 768px, the user must pan to reach later columns/actions. Overflow is contained, so clipping is not asserted. **Root cause:** One desktop table layout is used at all widths. **Impact:** Slower touch use, especially dispatch/cancel inspection. **Fix:** Add a compact small-screen row/card or persistent key-action treatment if rendered review confirms the friction. **Scope:** Cashier order table/row only. **Acceptance:** At 390px and 768px, order identity, status, and primary action are reachable without panning through all nine columns; no clipped dialog. **Confidence:** Code-level observation; actual usability needs rendered review.

## UI/UX findings

The mounted navigation offers six clear operational destinations (`index.tsx:81-125`); the dashboard routes payment and ready-order work to their pages (`CashierDashboardPage.tsx:138-185`). Loading skeletons, error banner/retry, payment review guards, and cancellation confirmation exist. The current dashboard does not mount `RecentActivityFeed`; that component reads workstation-local `state.activities` (`src/modules/cashier/dashboard/RecentActivityFeed.tsx:27-37`), so no authoritative recent-activity claim is made. The main actionable UI issues are the misleading assignment state (CASH-002), early edit success (CASH-004), and the wide mobile order table (CASH-006). No 1440px/768px/390px visual defect is claimed because no authenticated rendered session was inspected.

## Supabase and security findings

- **Hosted read-only checks:** The called RPC signatures for walk-in sale/hydration, open/start/close shift, online-payment read/verify/reject, ready release, offer, cancellation, and operational edit exist. Those cataloged functions are `SECURITY DEFINER`, set `search_path=public, pg_temp`, deny `anon` execution, and permit `authenticated` execution. The sampled transition/payment definitions contain `auth.uid()` and active-role checks; important transition functions inspected use `FOR UPDATE`. This is code evidence, not an adversarial concurrency test.
- Hosted `orders`, `order_items`, `order_status_history`, `cashier_shifts`, `cashier_transactions`, and `delivery_assignments` have RLS enabled. Staff order read policies require an active cashier/manager; own shift/transaction reads and rider-own assignment reads are separate. `payments` has RLS enabled and zero direct SELECT policies, consistent with the Cashier payment RPC path. `profiles.role`/`is_active` have no `authenticated` column UPDATE privilege in the inspected catalog. No concrete server-side privilege escalation was found in this scope.
- `delivery_assignments_one_active_per_order_idx` is a hosted partial unique index for offered/accepted/picked-up/out-for-delivery rows. The hosted offer function checks approved/active/available rider, locks the order and chosen rider, checks existing active/rejected assignments, and returns the new offer. The Cashier UI still lacks its projection (CASH-002).
- **Repository/hosted parity:** Hosted migration history contains `20261019205801_rider_offline_releases_pending_offers`, `20261019221405_rider_realtime_profile_and_availability`, and the `20261020` rider push migrations; no corresponding files were found under the canonical repository's `supabase/migrations`. This is a confirmed history/file difference relevant to reproducing dispatch behavior locally, not proof that the hosted functions are broken. Reconcile provenance in the next authorized release workflow; do not overwrite hosted definitions from older local files.
- Customer names, contacts, delivery addresses, payment metadata and proof paths are read into Cashier state. The persistent browser copy in CASH-001 is the concrete client data-handling issue. No secret/service-role key was found in the inspected browser client (`src/lib/supabase.ts:3-42`); environment values were not printed.

## Proposed implementation scope

1. **Cashier-only, first pass:** Fix CASH-001 session-scoped state and failed-hydration action gates; fix CASH-003 reconnect/focus refresh; fix CASH-004 edit reconciliation. Touch only the named Cashier files and reuse the existing refresh sequencing.
2. **Cashier plus required shared read contract:** Fix CASH-002 with a narrow staff-authorized assignment projection and state/UI update. Prefer existing hosted capability; request separate authorization before any hosted RPC/RLS or migration change. Keep Rider-app behavior and assignment uniqueness intact.
3. **Small follow-up improvements:** Address CASH-005 when realistic history volume warrants the query change; verify CASH-006 in a rendered authenticated 390px/768px view and make a compact Cashier-only layout if needed. Do not expand into a design rewrite.

## Acceptance checklist for the implementation pass

- [ ] Cashier A→B switch and initial-read failure show no prior account's server data or enabled operational actions.
- [ ] Incoming order/payment changes and missed changes after reconnect appear from an authoritative read; older concurrent refreshes cannot overwrite newer state.
- [ ] Edit success matches the server-read fields; failed reconciliation shows a recoverable, accurate status.
- [ ] One rider offer is visible as offered; acceptance, rejection, offline release, and reoffer eligibility are shown correctly; duplicate/concurrent offers remain blocked by the server.
- [ ] Existing payment verification/rejection, cancellation, release, walk-in recovery, and shift settlement behavior still pass their focused checks.
- [ ] At 1440px, 768px, and 390px, primary Cashier actions and dialogs are reachable in a rendered session.

## Validation record and limits

| Check | Outcome |
| --- | --- |
| Initial `git status --short` | Dirty working tree with many pre-existing Cashier/shared changes and untracked `qa/`; preserved. |
| `npm.cmd run typecheck` | PASS (`tsc --noEmit`, exit 0). Not workflow proof. |
| Current source trace | PASS for identifying mounted path, actions, queries, state/realtime and presentation; findings above are source-level unless marked HOSTED. |
| Hosted Supabase project/migration and read-only `pg_proc`, `pg_policies`, `pg_indexes`, `pg_trigger`, `pg_publication_tables`, privilege queries | PASS for inspected objects on `zhzluhqvysvsadwuugpa`; no customer rows or credentials queried. |
| Authenticated browser, Cashier RPC mutation, Rider device, payment proof, responsive screenshots | NOT TESTED; read-only audit and no safe authenticated session/transaction fixture. |

## Final recommendation

Run **one focused implementation pass** on CASH-001 through CASH-004, keeping the database as authority and preserving the existing dirty tree. Include CASH-005/006 only if the targeted fixture/rendered check justifies their small changes. Then execute the acceptance checklist in a safe isolated environment. This report is the audit handoff; it does not authorize hosted changes or implementation.
