# Track A — legacy backend dependency consolidation, 26 October 2026

**Result: PASS for bounded local consolidation; REVIEW REQUIRED before any hosted access change.** The Production Queue stays removed. No hosted schema, data, grant, RLS policy, or migration history was changed. The canonical repository's extensive pre-existing dirty files were preserved.

## A. Baseline

The current `src/app/routes.tsx` mounts Manager, Cashier, Customer, Rider and Kitchen, with no `/production` route; `src/data/accountRole.ts` no longer lists Production. `src/modules/production/` contains no files. The older Track A architecture, dependency, and Production read reports describe earlier mounted states and now carry historical-checkpoint notices. No separate Queue-removal checkpoint file was present in `qa/`; the current router, role type, and module tree establish the removal.

Manager Requests still embeds `ReplenishmentPage` for older single-item records. `StockReceivingPage` uses `getReplenishmentRequests` when displaying a linked legacy receipt. The uncalled `createReplenishmentRequest` wrapper remained in `replenishmentApi.ts`. The 26 October hosted read-only catalog showed 0 legacy requests, 0 legacy events, 0 linked legacy receipts, 4 formal requests and 3 formal linked receipts. These counts did not justify deleting historical objects.

Hosted function inspection found all four legacy RPCs are `SECURITY DEFINER`. Effective `EXECUTE` before this change was: `create_replenishment_request` **anon no / authenticated no / service_role yes**; `get_replenishment_requests`, `advance_replenishment_request`, and `start_replenishment_receiving` **anon no / authenticated yes / service_role yes**. Internal predicates allowed active Manager to read/start Receiving, active Production to read/advance, and active Manager to create only where grants permitted. Thus the obsolete Production account could still call `advance_replenishment_request` on hosted before any deployment of this local migration.

## B. Dependency evidence and classification

| Class | Candidate | Actual callers or database dependency | Decision |
| --- | --- | --- | --- |
| A — unused frontend | `createReplenishmentRequest` export | Repository-wide `src` search found no caller; backend creation already lacks authenticated `EXECUTE`. | Removed the wrapper only. |
| A — obsolete test/setup expectation | Production role in `scripts/demo/browser-smoke.mjs` and `provision-defense-demo.mjs` | Smoke test expected `/production`; provisioning created a role no current route needs. | Removed Production from future role loops. Existing private demo accounts/data were untouched. |
| B — obsolete exposed capability | `advance_replenishment_request(uuid,text,text)` | No mounted client caller. Hosted authenticated grant and Production-only internal predicate still allowed old state transitions. | Local migration revokes `EXECUTE` from `PUBLIC`, `anon`, `authenticated`; function and service grant remain. |
| B with C read dependency | Production branch of `get_replenishment_requests()` | No Production route; Manager's `ReplenishmentPage` and `StockReceivingPage` still call the same read. | Local migration narrows the existing read predicate to active Manager; authenticated grant retained for Manager. |
| B already retired | `create_replenishment_request(...)` | No frontend caller; `20261013053159_production_delivery_policy.sql` already revoked authenticated execution, confirmed hosted. | Retained database function for privileged compatibility; no further grant change. |
| C — historical compatibility | `production_replenishment_requests`, status events, `receiving_reports.replenishment_request_id`, `fulfilled_report_id`, legacy read/start RPC, guards and `receiving_closes_replenishment` trigger | FKs connect request, events and report; `start_replenishment_receiving` is Manager-only and `ReplenishmentPage` calls it for a ready historical item. The posting trigger closes the old status. | Retained. No table, function, FK, trigger or past migration was dropped/reworked. |
| D — active shared dependency | `get_inventory_request_proposal` legacy outstanding term; formal documents/lines/revisions/events and issue/revise; shared `post_receiving_report` | Proposal reads open legacy quantity as well as formal residual. Formal RPCs serve Manager Requests; both Receiving branches use one accepted-only posting authority and batch/ledger writes. | Retained and regressed. |

Hosted catalog inspection confirmed the legacy request and event FKs, both Receiving request links, `receiving_link_guard`, `receiving_linked_line_guard`, `receiving_closes_replenishment`, and formal reconciliation triggers. The historical Phase 7B SQL test still verifies its original checkpoint, so its header now warns that it is not a current access test.

## C. Removed application dependencies

- `src/modules/manager/inventory/replenishmentApi.ts`: removed the unused `createReplenishmentRequest` export and its `create_replenishment_request` client call. `getReplenishmentRequests` and `startReplenishmentReceiving` remain for Manager history and Receiving.
- `scripts/demo/browser-smoke.mjs`: removed the nonexistent Production route from future role smoke checks.
- `scripts/demo/provision-defense-demo.mjs`: stopped provisioning a new Production demo account in future runs. The script was not rerun against existing demo slots.
- Historical Track A reports gained short supersession notices; the original evidence text remains. No Manager Prepare Request or Receiving UI was changed.

## D–E. Retained authority and local security change

The new **local-only, forward-only** migration is `supabase/migrations/20261026132319_track_a_retire_production_replenishment_access.sql`. It checks that the expected legacy functions and read predicate exist, revokes client execution of `advance_replenishment_request`, and replaces only `get_replenishment_requests()` to require an active Manager. Its projection, joins, result shape, service grant, and Manager client grant are preserved. It is idempotent on the tested fixture. It changes no table DML grant or RLS policy. `start_replenishment_receiving` remains callable by authenticated users but internally requires an active Manager, so historical linked Receiving remains possible. `create_replenishment_request` remains authenticated-revoked. `post_receiving_report` was not edited.

**Hosted remains at the baseline grants and predicates.** The migration has not been deployed. A deploy review must compare the current hosted function body and ACL again because replacing the read function could overwrite intervening changes.

## F. Before and after

Before, the application had no Production Queue, but an unused legacy create wrapper and future demo checks still referred to Production, while a Production-profile database account could read and advance the legacy queue. After the local changes, the current application has no legacy creation wrapper or Production demo route expectation; in the disposable database, only Manager can read historical legacy requests, and client roles cannot advance their obsolete states. The formal Manager document → external communication → linked Receiving → accepted-only stock posting model is unchanged.

## G. Verification

| Gate | Result and evidence |
| --- | --- |
| Hosted baseline | **PASS, read-only:** four function definitions/effective grants, relevant triggers/FKs and current row counts inspected. No hosted mutation. |
| Local migration apply and repeat | **PASS:** applied twice with `ON_ERROR_STOP=1` in the isolated `rrj_track_a_targeted_20261026` database. No canonical historical migration edited; its 54-entry targeted fixture was already documented in `TRACK-A-AUTH-LOCAL-REPORT-20261026.md`. This access SQL was applied directly and did not claim a new local ledger version. |
| Authenticated role/security and compatibility | **PASS:** [TRACK-A-LEGACY-ACCESS-LOCAL-20261026.json](./TRACK-A-LEGACY-ACCESS-LOCAL-20261026.json) records 24 checks using actual local GoTrue Manager, former Production, and Customer sessions plus anonymous calls. `anon` could not read/advance; Production could not read/advance; Customer could not read/start Receiving. Manager read a synthetic legacy request and its posted linked report. |
| Historical and formal posting | **PASS, disposable:** each synthetic path saved 2 delivered / 1 accepted / 1 rejected. Before post, item aggregate, batch and ledger were all zero; after post each was aggregate +1, one batch holding 1, one ledger movement of +1. Legacy status closed through its trigger. Formal issue/link/post passed and duplicate post was rejected without stock change. |
| TypeScript and bundle | **PASS:** `npm.cmd run typecheck`; `npm.cmd run build`. |
| Quality, route, request and Receiving | **PASS:** `npm.cmd run verify:quality` (11 checks); `verify-track-a-legacy-route.mjs` (Manager guard, no Production route/role, retained history callers), `verify-h24-manager-navigation.mjs` (15 mounted destinations), `verify-manager-shell-navigation.mjs` (21/21), `verify-h23-request-workflow.mjs` (40), `verify-request-proposal-contract.mjs`, `verify-receiving-draft-authoring.mjs` (65/65), `verify-receiving-posting.mjs` (42/42). |
| Historical Phase 7B SQL verifier after consolidation | **NOT RUN:** it asserts the former Production transition capability and is scoped to the Phase 7B checkpoint; the new authenticated local regression covers the current contract. |
| Full current migration-chain replay / hosted authenticated access after restriction | **BLOCKED / NOT RUN:** the targeted synthetic fixture is not a clean current-chain replay; hosted deployment was prohibited. |

## H. Remaining risks

The hosted Production transition grant and legacy read predicate remain unchanged until a separately reviewed deployment. Privileged external clients were not exhaustively inventoried; retaining service grants and historical objects avoids claiming they have no consumers. The targeted local fixture proves this request/Receiving slice, not a clean release install or real restaurant records. Older private demo account cards may still contain a Production user; no existing account was deleted. The migration's full read-function replacement must be compared with the hosted definition immediately before any deployment.

## I. Next minimal Track A task

**Review this single access-retirement migration against the then-current hosted function definition and grants, and decide whether to authorize its deployment.** Keep that decision separate from this local implementation.
