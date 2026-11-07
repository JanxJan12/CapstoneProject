# H-23 Manager Requests and Receiving workflow UX

**Scope:** Focused source implementation on 2026-10-16 in the preserved dirty canonical worktree. Starting HEAD: `9748bdef6d31a96282b88dc67f02724b8fd05819` (`main...origin/main`). The starting worktree had many pre-existing tracked and untracked changes, including a modified `StockReceivingPage.tsx` and an untracked `ManagerRequestsPage.tsx`. None were reset or discarded. H-20, H-21, H-22, H-15B, and H-15C were read for context.

## A. Executive summary

The selected formal request now answers which step is next using its current register status, current-revision Manager dispatch record, linked Receiving draft, posted report count, and number of outstanding item lines. A linked draft opens directly in the mounted Receiving page. The final Receiving review now puts requested, already posted accepted, and conditional outstanding quantities beside each linked report line. A confirmed post result remains visible if its follow-up read fails. These are source changes; no rendered or database behavior was exercised.

## B. Existing workflow and authority

`ManagerApp` mounts `ManagerRequestsPage` for Requests and `StockReceivingPage` for Receiving. Its existing callbacks carry a report ID from Requests to Receiving and a request ID back. [Manager shell](../src/modules/manager/index.tsx), [Requests](../src/modules/manager/inventory/ManagerRequestsPage.tsx), [Receiving](../src/modules/manager/inventory/StockReceivingPage.tsx). The historical single-item Production queue remains a separate expandable Requests section.

The formal register RPC returns `issued`, `partially_received`, `fulfilled`, or `closed_short`; current revision, request lines (`quantity`, posted `accepted`, delivered `rejected`, `remaining`), linked draft/posted receipts, and Manager-recorded events. The unsaved preparation sheet is local, not a persisted draft status. [Request API](../src/modules/manager/inventory/inventoryRequestApi.ts), [register projection](../supabase/migrations/20261012181744_manager_inventory_request_documents.sql). Receiving uses its existing workspace and policy reads and `post_receiving_report` RPC. [Receiving API](../src/modules/manager/inventory/receivingApi.ts), [document list](../src/modules/manager/inventory/ReceivingDocumentList.tsx).

## C. Confirmed source-level gaps

1. The selected request showed all facts and controls, but no compact direction for the current combination of dispatch record, open draft, and outstanding lines. Managers had to inspect separate sections to determine the next existing action.
2. The final post dialog showed delivered/accepted/rejected and stock delta, while linked request quantities and outstanding after this report were above the dialog. The consequential confirmation did not show those amounts together.
3. A successful post followed by a failed workspace read cleared the confirmed `postResult` banner. The workspace was cleared safely, but the success evidence disappeared behind a read error.

These are code observations, not reproduced user incidents. The existing per-item reconciliation, pre-issue review, post safeguards, and H-21/H-22 improvements were retained.

## D. Implemented changes

| File / function | Change and Manager benefit |
| --- | --- |
| [requestWorkflow.ts](../src/modules/manager/inventory/requestWorkflow.ts), `requestWorkflow` | Derives a read-only next-step cue from one current register record. A linked draft takes priority, followed by unrecorded current-revision dispatch, then an outstanding physical delivery. Closed requests show reconciliation only. It counts lines and reports instead of summing different units. |
| [ManagerRequestsPage.tsx](../src/modules/manager/inventory/ManagerRequestsPage.tsx), selected detail | Shows issued status, posted report count, outstanding line count, draft state, and Manager-recorded external evidence near the top. The draft action uses the existing `onReceive(reportId)` handoff; other links jump to the existing export or delivery controls. These links do not send a message or create a delivery. The current-register gate still controls selected data and the draft handoff. |
| [StockReceivingPage.tsx](../src/modules/manager/inventory/StockReceivingPage.tsx), final review and `loadWorkspace` | For a formally linked request, shows original request amount, accepted and posted to date, and outstanding **if this report posts** next to delivered, accepted, rejected and stock delta. It sums accepted quantities for multiple report lines of the same request item. The post result survives a failed follow-up read for that same report while the unavailable workspace stays closed. |
| [verify-h23-request-workflow.mjs](../scripts/verify-h23-request-workflow.mjs) | Offline synthetic assertions for request step selection and source guards. |

## E. Business integrity

Issuance, export, Manager-recorded external dispatch/reply, and Receiving drafts remain separate from stock. The event label says **Manager recorded** and explicitly does not claim supplier receipt or acceptance. Rejected and undelivered quantities do not enter stock. The final review calls accepted quantity a conditional stock delta; only a successful `post_receiving_report` applies it to batches, aggregate stock, and ledger. The existing single-post server rule, `postingRef`, version/conflict handling, and RPC path were not changed. PostgreSQL and active Manager authorization remain authoritative.

## F. Error handling and recovery

Requests retains its H-15B current-register version gate: loading or failed reads clear old rows, suppress selected detail/actions, and offer retry. The summary is absent until a current selected row exists; it invents no zero quantities when the register is unavailable. An empty register has no selected task. The preparation sheet and its validation/review/issue flow remain unchanged.

Receiving retains workspace clearing on a failed read, versioned response handling, and its draft/post action guards. A confirmed post followed by a failed read keeps the server-returned success banner for the same report and displays the read error; there is no actionable report while the workspace is unavailable. An unknown post outcome follows the existing refresh/reconciliation path; H-23 does not automatically resubmit. The report-specific banner is cleared when selecting or creating other work.

## G. Verification

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `npm.cmd run typecheck` | **PASS** | TypeScript static compile. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11 non-workflow checks. |
| `node --experimental-strip-types scripts/verify-h23-request-workflow.mjs` | **PASS** | 15 synthetic/source assertions: empty request lines, partial/open/closed states, prior-revision dispatch exclusion, linked draft priority, current gate, post review wording, confirmed-result preservation, and posting guards. No React mount. |
| `node --experimental-strip-types scripts/verify-h15bc-inventory-consistency.mjs` | **PASS** | Existing stale-register and pagination source/helper checks. |
| Changed-file `git diff --check` | **PASS** | Tracked Receiving file and new files checked; Git's expected exit 1 for untracked file differences had no whitespace diagnostics. |
| Offline source/RPC contract review | **PASS** | Active mounts, request register projection, Receiving client post RPC. |
| Authenticated Manager, browser, database, hosted, physical delivery | **NOT TESTED** | Explicit H-23 boundary. |
| Offline checks | **FAIL: none** | No failed check. |
| Runtime acceptance | **BLOCKED by task scope** | Services and database/browser testing were prohibited for H-23. |

H-16 remains **10 PASS / 0 FAIL / 49 NOT RUN**. No H-23 static result upgrades those runtime scenarios.

## H. Security and performance

No new read, write, route, dependency, direct table access, RLS rule, or RPC was added. The request cue scans the already returned selected record and the Receiving dialog scans the selected report's lines. The existing full register read in both pages is unchanged. Anchor links expose existing controls; they confer no authority. The request/receipt projections can become stale after external activity, so all consequential writes remain subject to existing server checks and a fresh read is required after failure. No frontend quantity is treated as a new authoritative balance.

## I. Outstanding acceptance

On a separately authorized isolated stack, exercise authenticated issue → export → recorded dispatch → linked draft → partial delivery → accepted/rejected post → remaining quantity, including two report lines for one item. Verify draft/posted links both directions, closed short, missing/failed reads, delayed stale responses, duplicate and conflicting posts, and a confirmed post with failed follow-up read. Reconcile request lines and receipt rows against independent stock, batch, and ledger queries. Render mobile/desktop and test keyboard, focus, screen-reader labels and touch targets. Hosted, physical delivery, and supplier-message proof remain separate.

## J. Next Manager UX improvement

Replace the formal request audit timeline's raw JSON event details with readable, source-labeled dispatch, reply, revision, and reconciliation descriptions. Preserve exact actor/revision/time and distinguish Manager attestations from externally verified evidence.
