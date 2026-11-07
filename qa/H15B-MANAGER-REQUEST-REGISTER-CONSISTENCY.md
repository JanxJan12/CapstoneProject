# H-15B Manager request register consistency — 2026-10-16 Manila

## Source finding and contract

The mounted Manager `replenishment` route in `src/modules/manager/index.tsx` renders `ManagerRequestsPage.tsx`. That page calls `getRequestProposal` and `getInventoryRequestRegister` from `inventoryRequestApi.ts`, which call `get_inventory_request_proposal(p_needed_at)` and `get_inventory_request_register()`. Issue, revision, external-event, linked-Receiving, and shortfall actions use the existing Manager RPCs in that service. `supabase/migrations/20261012181744_manager_inventory_request_documents.sql` defines the request documents, revisions, lines, events, and Receiving link. Requests and Manager-attested Messenger events do not write stock; `post_receiving_report(uuid)` remains the stock-entry boundary.

Before H-15B, a failed `Promise.all` read set `fresh=false` and an error but left the prior `register` and `selected` request intact. History could still show old status, export the old revision, record a dispatch/reply, or start a delivery. The existing `loadVersion` and `neededInputRef` prevented some obsolete responses but did not make a failed register unavailable. This is a confirmed frontend source defect, not evidence of incorrect database rows.

## Correction

Only `src/modules/manager/inventory/ManagerRequestsPage.tsx` changed for H-15B:

- Lines 149–156: a synchronous register-read gate and a committed register version accompany the existing load version.
- Lines 194–198: selection resolves only against the currently accepted register version; a synchronous gate also protects actions fired before React paints the new state.
- Lines 214–284: starting a read makes the old register unavailable and clears it; only the latest matching response restores proposal, register, readiness, and version. Failure clears the read projections and reports that actions and issue are unavailable. The unsaved draft and history search remain intact.
- Lines 363–491 and 1054: issue, dispatch/reply, linked delivery, revision, export, and shortfall handlers reject a click from an obsolete render as well as hiding stale controls.
- Lines 531–534 and 750–752: a visible **Try again** reloads the same Manager request workspace; history says it is unavailable until a successful read. A successful retry repopulates records from the RPC. The selected request ID is retained, but resolves only if that ID appears in the new register.

A mutation's existing success notice remains visible if its follow-up read fails. That notice concerns the RPC result; the separate read error means the current register could not be verified. The page does not describe a failed read as a rolled-back mutation. Request revision snapshots, external-attestation semantics, and Receiving links are unchanged.

## Verification

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `node --experimental-strip-types scripts/verify-h15bc-inventory-consistency.mjs` | **PASS** | Source checks for unavailable state, current-version selection, retry/search preservation, and superseded-read guards. These are static component checks, not rendered interactions. |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit`, exit 0. |
| `npm.cmd run build` | **PASS** | Vite transformed 3,018 modules; build and Sites preparation exited 0. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11 non-workflow checks. |
| `node scripts/verify-manager-inventory-ui-completion.mjs` | **PASS** | Existing 19/19 Manager inventory source checks. |
| Authenticated successful read → failed refresh → stale actions unavailable → retry | **NOT TESTED — REQUIRES CONSOLIDATED LOCAL ACCEPTANCE** | Requires a controlled local read failure and rendered Manager session. |
| Concurrent request reads, mutation commit followed by failed read, SQL/RLS | **NOT TESTED — REQUIRES CONSOLIDATED LOCAL ACCEPTANCE** | No Docker, database, or browser exercise in H-15B. |

The H-14 consolidated report remains blocked at its scenario level. No SQL, role, stock-writer, migration, or hosted resource changed.
