# H-15B/H-15C Inventory gap closure and next steps — 2026-10-16 Manila

## Executive summary

Both H-15B and H-15C are **resolved at the inspected source level**. The mounted Manager request register now removes stale actionability on refresh/failure and retries against the existing authoritative RPC. Stock Movement pagination now rejects rapid duplicate claims, ignores superseded results, and advances only after unique-ID append. Typecheck, build, existing source checks, and the focused offline helper/source regression pass. Authenticated browser, concurrent API, and independent PostgreSQL reconciliation remain **NOT TESTED — REQUIRES CONSOLIDATED LOCAL ACCEPTANCE**. H-14's scenario acceptance remains blocked; H-15 did not change that status.

## Before and after

| Gap | Before | After |
| --- | --- | --- |
| H-15B request register | Failed joint read retained prior register, selection, and dispatch/delivery controls. | Starting a read removes register actionability; only latest successful response restores it. Failure shows unavailable state and **Try again**. Search and selected ID survive for a valid retry. |
| H-15C movement pagination | Repeated clicks could fetch the same cursor and append duplicate rows; a filter change waited for React effect to invalidate pending work. | Synchronous claim prevents a second page request. Filter changes invalidate immediately. Stable ledger IDs are checked before append; failure leaves cursor and rows in place. |

## Exact change inventory

Edited: `src/modules/manager/inventory/ManagerRequestsPage.tsx` (register gating, failed-read recovery, action guards) and `src/modules/manager/inventory/InvTransactionsPage.tsx` (pagination gating, versioning, filter invalidation, cursor/row refs). Created: `src/modules/manager/inventory/movementPage.ts` (ID and in-flight helpers), `scripts/verify-h15bc-inventory-consistency.mjs` (offline focused regression), and these three H-15B/H-15C QA reports. `StockReceivingPage.tsx` remains the pre-existing H-15 change; it was inspected, not edited by H-15B/H-15C.

## Frontend–backend consistency

H-15B reuses `inventoryRequestApi.ts` and `get_inventory_request_proposal` / `get_inventory_request_register`; the existing issue, revise, event, shortfall, and linked-Receiving RPCs remain intact. H-15C reuses `inventoryApi.ts:getManagerStockMovements` and `get_manager_inventory_movements`, including existing keyset pagination and ledger IDs. PostgreSQL remains authoritative for requests, quantities, batches, and ledger rows. External dispatch is a Manager attestation, not supplier fulfillment. Draft or revised requests do not add stock; only accepted posted Receiving does. Waste, adjustments, recipe deduction, historical Production requests, active-role checks, and confidential recipe access were not changed.

## Verification matrix

| Check | H-15B | H-15C | Evidence |
| --- | --- | --- | --- |
| Focused offline regression | **PASS** | **PASS** | `node --experimental-strip-types scripts/verify-h15bc-inventory-consistency.mjs`; nine checks including executed append/claim helpers and static component safeguards. |
| TypeScript | **PASS** | **PASS** | `npm.cmd run typecheck`, exit 0. |
| Production build | **PASS** | **PASS** | `npm.cmd run build`, 3,018 transformed modules, exit 0. |
| Existing quality baseline | **PASS** | **PASS** | `npm.cmd run verify:quality`, 11 checks. |
| Existing Manager inventory source baseline | **PASS** | **PASS** | `node scripts/verify-manager-inventory-ui-completion.mjs`, 19/19. |
| Authenticated rendered interaction | **NOT TESTED** | **NOT TESTED** | Requires consolidated local acceptance. |
| Independent database reconciliation | **NOT TESTED** | **NOT TESTED** | No database accessed or mutated. |

## Outstanding acceptance

On an approved, identified local synthetic stack with adequate resources: run Manager request successful read → failed refresh → hidden/stale actions → same-search retry; retain selected ID only if the new register includes it; delay an older register response until after a newer one; commit an event/revision then fail the follow-up read and distinguish committed notice from unavailable register. Exercise movement Load More rapid clicks, out-of-order page responses, failed-page retry with unchanged cursor, item/type/date filter changes while a page is pending, stable distinct ledger IDs and order. Recheck H-15 Receiving failed workspace read, cleared draft/post controls, report-ID retry, and superseded read handling. Include deferred H-13 through H-14 two-session/failure cases and independent request/Receiving/physical/usable/batch/ledger reconciliation, with role and denied-direct-table checks. None of these scenarios is marked passed by this report.

## Remaining gaps and risk

No further defect was confirmed in these two edited surfaces after the source fix. Runtime behavior under actual React scheduling, authenticated RPC failures, concurrent Managers, and live database balances remains uncertain. The locally versioned migration definitions do not establish which definitions are effective in a running target. The unmodified historical clean replay and hosted release/recovery gates remain separate blockers in the prior architecture and H-14 reports.

## Next recommendation — priority 1: bounded local Manager Inventory acceptance

**Business importance:** establish that the new failure/retry behavior, accepted-only stock entry, and ledger traceability work together in an authenticated session before further Inventory feature expansion. **Evidence:** H-14 confirmed local Auth/REST and two role-specific read contracts on the named H-09 stack at its check time, but had no Receiving fixtures, browser scenario, concurrency trace, or stock write audit; Docker VM memory/swap headroom blocked that campaign. H-15B/H-15C are compiled and offline checked only.

**Scope:** on a separately approved maintenance run, first recheck exact stack/volume identity, resource headroom, and synthetic fixture ownership; then run one bounded Manager browser/API/SQL sequence for failed register read/retry, page concurrency, H-15 Receiving failure/retry, linked partial Receiving, and exact accepted-only batch/ledger reconciliation. Expected inspection targets are `ManagerRequestsPage.tsx`, `InvTransactionsPage.tsx`, `StockReceivingPage.tsx`, their existing API services, and read-only SQL evidence over request, Receiving, item, batch, and movement records. **Backend impact:** no planned schema/RPC change; any newly demonstrated backend defect needs a separate proposal. **Tests:** controlled two-session/read-fault traces, rendered states, exact RPC requests/results, and independent before/after SQL counts and identities. **Dependency:** safe local resources and an approved disposable synthetic fixture. **Separate approval:** required before maintenance actions or fixture mutations; this report authorizes neither.

## Scope confirmation

Initial branch/HEAD: `main...origin/main`, `9748bdef6d31a96282b88dc67f02724b8fd05819`, with numerous pre-existing tracked edits and untracked source, migration, test, and QA files. The final branch/HEAD is unchanged. Only the files in the exact change inventory above are attributable to H-15B/H-15C. The H-15 Receiving load-version, fail-closed workspace, and report-ID retry logic was inspected and left intact. No original migration, RPC, stock writer, Docker environment or volume, hosted Supabase resource, Customer/Cashier/Kitchen/Production/Rider module, business row, or financial record was changed. No destructive Git operation, dependency installation, push, or deployment occurred. Build output is ignored/generated `dist` output. The scope and whitespace checks apply only to H-15B/H-15C files; unrelated dirty files were preserved.
