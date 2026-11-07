# MGR-REC-01 — Manager Request to Receiving workflow (23 October 2026)

## Decision and starting state

**ACCEPTED for local Manager acceptance testing.** Eligible formal requests are visible in Receiving before any receipt exists. A Manager can resume the one open linked draft or enter the actual physical inspector inside Receiving and start a new draft. No receipt is created by reading or navigating to the page. The current backend requires the inspector at draft creation, so the inspector interaction occurs in Receiving before the draft RPC is called. Posting remains a separate review action.

The repository was on `main` with a large pre-existing dirty worktree, including untracked Manager and QA files. All unrelated work was preserved. No hosted data, migration history, or deployed code was changed.

## Root cause and contracts

The Receiving workspace previously showed only actual Receiving documents. Its empty state directed Managers back to Inventory Requests. The request detail owned the only normal linked-draft start action and asked for inspector and condition information there. This was a navigation and responsibility-placement gap; the observed issued request did not imply a backend failure.

Existing authoritative contracts reused:

- `get_inventory_request_register()` requires an active Manager and returns current request status, revision, server-calculated remaining quantities, and linked draft/posted receipts. This RPC returns the full register; it has no bounded page parameter. The Receiving document list remains independently paginated at 20 rows.
- `start_inventory_request_receiving(request_id, revision, report_id, inspected_by_name, inspection_note)` requires the current issued/partially received revision and a nonblank inspector. Repeating the same report ID is idempotent; `one_open_inventory_request_receipt` prevents another open draft for that request. The client rereads the register immediately before starting and after an uncertain failure or uniqueness race, then resumes any existing draft.
- `save_receiving_report_item` and `post_receiving_report` retain delivered/accepted/rejected validation and accepted-only stock movement. Request remaining balances come from posted accepted quantities. The UI does not calculate stock or write tables directly.
- `ReceivingDocumentList`, posted receipt inspection, supplier/emergency entry, and follow-up delivery actions remain available.

## Change and workflow

| File | Change |
| --- | --- |
| `src/modules/manager/inventory/AwaitingProductionDelivery.tsx` | Added a separate request queue in Receiving. It uses the Manager register read, displays reference/revision/status/Manila need time, remaining lines and units, posted count, loading/empty/error states, and `Record delivery` or `Resume draft`. It rereads before action and handles a concurrent or uncertain draft creation by resolving the saved draft. |
| `src/modules/manager/inventory/StockReceivingPage.tsx` | Placed the queue before Receiving documents and connected its action to the existing report editor. |
| `src/modules/manager/inventory/ManagerRequestsPage.tsx` | Removed inspector and condition inputs from request detail. `Open Receiving` navigates to the workspace without creating a draft. |
| `src/modules/manager/inventory/ReceivingDocumentList.tsx` | Updated the empty-state direction to the queue above. |
| `scripts/fixtures/visual-manager.config.ts`, `scripts/fixtures/visual-manager-mocks.ts`, `scripts/fixtures/visual-manager.tsx` | Added a local-only request/Receiving scenario to the existing rendered fixture; existing fixture routes remain. |
| `scripts/verify-mgr-rec-browser.mjs`, `supabase/tests/verify_mgr_rec_01_disposable.sql` | Added focused rendered and rollback-only database checks. |

Before: Issue Request → leave Receiving to find the request detail → enter inspector/note there → create linked draft → return to Receiving. After: Issue Request → open Receiving → find the outstanding request → resume its draft or enter inspector/note there → create linked draft → record actual line quantities → review/post. Export and manual Messenger handoff remain separate; neither is treated as evidence of delivery.

The queue includes only `issued` or `partially_received` requests with a positive server-provided remaining line and a `delivery` or `draft` next step. It excludes fulfilled/closed requests and fully satisfied balances. These are display rules; the Manager-only register and start RPC enforce access and current revision again. Requests and actual Receiving documents are visibly separate.

## Verification

### Rendered browser, synthetic mocks

`node scripts/verify-mgr-rec-browser.mjs` **PASS** at 1280 px and 390 px. The issued `PR-20261023-000004 Rev 1` displayed 2 pcs remaining and the Oct 24, 2026 6:15 PM Manila needed time. A partial request displayed 1 pc remaining and one posted receipt. Fulfilled and closed requests were absent from the actionable queue. Initial view, inspection-form opening, and Request-to-Receiving navigation recorded zero start calls. Entering a synthetic inspector and selecting Start created one linked draft for the correct request/revision; it appeared in the Receiving editor and document list. Resume did not create a second draft. A register read error remained visible rather than appearing as an empty queue. The browser recorded no external requests, network writes, exceptions, or horizontal overflow.

Screenshots: [desktop queue](mgr-rec-01-rendered-20261023/receiving-1280.png), [mobile queue](mgr-rec-01-rendered-20261023/receiving-390.png), [inspection entry](mgr-rec-01-rendered-20261023/receiving-inspection-entry.png), [linked draft](mgr-rec-01-rendered-20261023/receiving-created-draft.png). [Machine result](mgr-rec-01-rendered-20261023/result.json).

### Disposable real PostgreSQL

Created only `rrj_mgr_rec_01_20261023` from cached Supabase PostgreSQL 17.11, with `--network none`, no published port, and no mounted volume. Restored the local Phase 8 schema baseline into a task database, then applied the selected local request, reason-removal, and Production-delivery policy SQL needed by these focused contracts. This is a **targeted local fixture**, not a faithful hosted-schema replay, a migration-ledger replay, or an authenticated HTTP/PostgREST session.

`verify_mgr_rec_01_disposable.sql` **PASS** under a synthetic Manager JWT claim and rollback: issue 2 pcs changed no stock; blank inspector was denied; same report ID was idempotent; a second concurrent-style open draft ID was rejected by the unique index; draft changed no stock; 2 delivered / 1 accepted / 1 rejected posted exactly +1 pc and left 1 pc outstanding; duplicate post was denied. After rollback, request/report/transaction counts were `0/0/0`.

Additional rollback-only SQL results:

| Check | Result |
| --- | --- |
| `verify_manager_inventory_request_documents.sql` | **PASS**: issue/revision, partial and second delivery, accepted-only stock/ledger, overage and duplicate-post rejection, shortfall. |
| `verify_manager_inventory_request_security.sql` | **PASS**: 8 anonymous RPC, 4 RLS-table, and 12 role/RPC denial checks. |
| `verify_manager_receiving_draft_authoring.sql` | **PASS** after the policy fixture was installed. |
| `verify_source_neutral_receiving_posting.sql` | **PASS** after the policy fixture was installed. |
| `verify_production_delivery_policy.sql` | **PASS**: normal denial, Manager emergency, supplier, source labels, retry denial. |
| `verify_receiving_policy_classes.sql` | **FAIL / not applicable to this current-schema fixture**: its fixture inserts the removed `inventory_request_documents.reason` column. No unrelated migration or historical test was rewritten. |

The first attempts at draft-authoring and source-neutral posting failed because the initial disposable fixture lacked `20261013053159_production_delivery_policy.sql`; both passed after that existing prerequisite was added. The `verify_receiving_policy_classes.sql` failure is the remaining stale test fixture, not a failure in the MGR-REC-01 path.

### Source and build regression

- `verify-h23-request-workflow.mjs` **PASS**, 40 checks.
- `verify-manager-focused-refinements.mjs` **PASS**.
- `verify-inv-export-browser.mjs` **PASS**: prior export consistency unchanged.
- `verify-manager-usability-browser.mjs` **PASS**, six rendered cases.
- `verify-manager-focused-browser.mjs` **PASS**, six focused renders.
- `npm.cmd run typecheck` **PASS**; `npm.cmd run verify:quality` **PASS**, 11 checks; `npm.cmd run build` **PASS**.

## Limits and next use

The rendered start/resume interaction used local mocks; the write-path and role/stock invariants used real disposable PostgreSQL. They were not one authenticated browser-to-PostgREST transaction. No hosted read or write, real Production delivery, Messenger handoff, physical inspection, or live Manager acceptance action was exercised. The request register is unbounded because its existing RPC has no paging contract; this change adds no new database read API. Manual Manager acceptance testing may resume locally with an authorized account, while any hosted release remains subject to its separate deployment controls.

The visual fixture's Vite dependency pre-scan also logged an unrelated missing Rider mock export (`setManagerRiderApprovalStatus`). The targeted Receiving route still rendered and its browser checks passed with no page exceptions; the unrelated Rider fixture import was not changed for this task.
