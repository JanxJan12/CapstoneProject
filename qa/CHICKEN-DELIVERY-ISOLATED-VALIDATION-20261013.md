# RRJ’S FOOD-HOUSE — isolated split Receiving and reconciliation validation

**Date:** 2026-10-13 (Asia/Manila)  
**Decision:** **PASS for the tested local request/Receiving invariants; NO-GO for hosted deployment or release.** No application or migration defect was reproduced in the prioritized path, so no production source or schema was changed.

## Boundary and current-source check

This continues `qa/CHICKEN-DELIVERY-AS-IS-TARGET-GAP-ANALYSIS-20261013.md`. The canonical `Capstone Project` checkout was already dirty; all pre-existing changes, backups, hosted link/configuration, and unrelated containers were preserved. The active `src/app/routes.tsx` still mounts `/manager` and `/production`. `src/modules/manager/index.tsx` routes the standard Manager Requests page to `ManagerRequestsPage`, linked Receiving to `StockReceivingPage`, and Stock Movements to `InvTransactionsPage`. The formal route uses `inventoryRequestApi.ts` and `receivingApi.ts`; the historical Phase 7B panel remains inside Manager Requests and the Production route remains available. Direct-supplier Receiving remains an alternate source, not a Production supplier fiction.

The current hosted project `zhzluhqvysvsadwuugpa` was queried **SELECT-only** for `pg_proc` signatures, execute grants and function-definition MD5s. The nine inspected hosted definitions matched the isolated restored database exactly: `issue_inventory_request`, `start_inventory_request_receiving`, `reconcile_inventory_request_receiving`, `close_inventory_request_short`, `get_inventory_request_register`, `post_receiving_report`, `create_replenishment_request`, `start_replenishment_receiving`, and `create_receiving_report_draft`. The externally callable workflow functions are `SECURITY DEFINER`, executable by `authenticated`, and not executable by `anon`; the reconciliation helper is a trigger function, not a client RPC. This comparison establishes definition parity for those nine functions, **not** full schema/data or hosted runtime parity. No hosted function was invoked for a write.

Local target was the existing, unlinked, restored Supabase stack from `qa/RECOVERY-STABILIZATION-20261013.md`, bound to `127.0.0.1:56321` with database at `127.0.0.1:56322`. Its stopped `isolated-stack` database/Auth/REST/Storage/gateway containers were started by exact name. Before testing, the database had two earlier synthetic request documents and two Receiving reports; it was not a pristine baseline. The guarded test script checks the exact loopback API and expected container before creating any synthetic user or item. The script uses authenticated GoTrue → PostgREST RPC calls against the same isolated PostgreSQL database. SQL verifier files execute with `BEGIN`/`ROLLBACK`. The Customer-to-Rider regression uses only this loopback stack.

## Confirmed fix, restricted to QA code

The first authenticated rerun failed before issuing a new request because `qa/recovery-auth-inventory-e2e-20261013.ps1` used the fixed inventory name `__RECOVERY_AUTH_E2E__`, already present in the preserved rehearsal database (`inventory_items_item_name_key`). The script now appends its generated item UUID to that name, so it is safely rerunnable without deleting or altering old synthetic rows. That initial failed attempt had already created one isolated Auth user; it remains in the preserved local volume. No business application bug was inferred from this fixture collision.

The same script now verifies two partial reports linked to **one** formal Manager request, overage rollback, serial and simultaneous duplicate-post rejection, request register totals, audited shortfall closure, and a separate fulfilled request. This is test-only code; `post_receiving_report`, reconciliation, UI and existing migrations were left untouched.

## Executed results

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Current active Manager/Production routes and RPC wiring | **PASS source inspection** | `src/app/routes.tsx`, `src/modules/manager/index.tsx`, `ManagerRequestsPage.tsx`, `StockReceivingPage.tsx`, `inventoryRequestApi.ts`, `receivingApi.ts`. No browser interaction in this run. |
| Hosted versus local function definitions | **PASS 9/9 exact MD5 match** | SELECT-only `pg_proc` metadata for the nine named functions above. No hosted writes or authentication attempt. |
| Rollback-only formal request SQL verifier | **PASS** | `supabase/tests/verify_manager_inventory_request_documents.sql`: two linked posted reports, accepted-only +13 across three lines, cumulative overage rollback, duplicate post denial, partial register, shortfall closure. Entire fixture rolled back. |
| Authenticated split delivery | **PASS** | Updated `qa/recovery-auth-inventory-e2e-20261013.ps1`: request 10; first delivery 8/accepted 6/rejected 2; second attempted accepted 5 rejected as cumulative overage; corrected second delivery 3/accepted 2/rejected 1. One request has **two posted partial reports**, accepted 8, rejected 3, outstanding 2, two batches and two +6/+2 receiving movements, stock 8. |
| Over-limit atomicity | **PASS** | Attempted second post returned SQLSTATE `22023`; report stayed draft, book stock 6 and receiving movement count 1. Corrected draft then posted. |
| Duplicate post, serial and simultaneous | **PASS** | Repeat post returned SQLSTATE `22023`. Two concurrent PostgREST calls on another draft returned exactly one HTTP 200 and one HTTP 400; report fulfilled, stock +1 once, one batch and one movement for that line. |
| Audited shortfall closure | **PASS** | Closing the two-receipt request with reason set `closed_short` and appended one `closed_short` event; stock stayed 8 with two receiving movements. |
| Full reconciliation | **PASS** | Separate authenticated request 2/delivery 2/accepted 2 became `fulfilled`; item stock 10 and third receiving movement existed. Concurrent case also fulfilled. |
| Formal RPC security | **PASS rollback-only** | `verify_manager_inventory_request_security.sql`: 8 anonymous RPC denials, four RLS table checks and 12 role/RPC denials. This is local role-claim simulation; no hosted denial test. |
| Receiving and compatibility regressions | **PASS rollback-only** | `verify_manager_receiving_draft_authoring.sql`, `verify_source_neutral_receiving_posting.sql`, `verify_phase_7b_replenishment_requests.sql`. Legacy and direct-supplier branches remain intact in tested local behavior. |
| Local inventory integrity after tests | **PASS sampled checks** | Zero negative `inventory_items` or `inventory_batches` quantities; zero posted positive-accepted receipt lines missing batches; zero receiving-origin batches missing receiving movements. Local volume retains synthetic rows. |
| Main app source validation | **PASS** | `npm.cmd run typecheck`; `scripts/verify-manager-inventory-ui-completion.mjs` 19/19 checks. No application source edit. |
| Customer → Payment → Cashier → KDS → Rider | **PASS local same-database API/Storage** | `qa/recovery-auth-order-rider-e2e-20261013.mjs`: order and payment replay, private proof upload, cashier transaction/receipt, KDS transitions, rider assignment/transit/proof/delivery and final join reconciliation. Separate synthetic local data. |
| Standalone Rider app | **PASS source/unit** | `npm.cmd run typecheck`; `npm.cmd test` 8/8. Android installation/camera/device journey **NOT TESTED**. |

The authenticated split test was rerun after its extension and passed. Its calls create synthetic accounts, requests, receipts, batches, movements and proof-independent inventory items **only in the local isolated stack**. The local rows were preserved; no delete, reset, clean or volume removal was performed. The SQL verifier cases rolled back their fixtures.

## Interpretation and remaining decisions

1. **No confirmed production code gap in the prioritized invariants.** The installed `post_receiving_report` and reconciliation trigger gave the expected accepted-only arithmetic, one-to-many formal linkage, atomic overage rejection, duplicate protection and status transitions. A new production migration or refactor would add risk without a failing case.
2. **Canonical workflow policy remains open.** Formal Manager Request is the standard flow in the active UI, but historical Phase 7B creation and the `/production` queue still exist; a Manager can also create an unlinked `production_team` draft via general Receiving. This run did not change those compatibility paths. Decide whether new legacy/unlinked Production records are allowed before narrowing them. Preserve old rows and direct-supplier PO behavior.
3. **Evidence policy remains open.** Messenger dispatch/reply and physical inspector are Manager attestations, not independently verified external messages or trained-staff signatures. Decide the required proof, retention, no-show/overdelivery and closure authority before adding fields or rules.
4. **Release remains NO-GO.** The October 13 recovery report still requires private rotation of the re-disclosed PostgreSQL password, a verified encrypted off-device recovery copy, separately approved hosted MAINTAIN-grant repair, and controlled Customer/Manager browser plus Rider Android/device checks. This local run does not establish hosted OAuth, Messenger, physical Receiving, staging, or production readiness.

## Change inventory and follow-up gate

Only `qa/recovery-auth-inventory-e2e-20261013.ps1` was changed for the fixture fix and expanded local assertions; this report is new. No production application file, SQL migration, hosted row or privilege changed. Before any later hosted proposal, rerun hosted **read-only** catalog/count checks; review the exact intended migration and rollback/recovery plan; repeat the isolated Auth/Receiving and Customer-to-Rider tests; then obtain explicit approval for the named project. Do not use QA-labeled hosted rows as disposable fixtures without provenance review.
