# H-13B historical Production queue consistency — 2026-10-16 Manila

## Mounted contract and confirmed defect

The active `/production` route requires the Production role, mounts `ProductionApp` → `ProductionQueuePage`, and calls `getReplenishmentRequests()` / `advanceReplenishmentRequest()` in `replenishmentApi.ts`. Those use the versioned `get_replenishment_requests()` and `advance_replenishment_request(uuid,text,text)` RPCs in `20261007082647_phase_7b_production_replenishment_requests.sql`. The read projects historical single-item `production_replenishment_requests`, Receiving links, and status events. The write checks an active Production profile, locks the request, accepts only the next expected status, and rejects a changed status with `Request status changed. Refresh the queue.` The existing Phase 7B SQL verifier checks role denial, progression, duplicate replay, and no stock movement, but was not run here without a disposable database.

**Confirmed source defect:** on that status conflict, the mounted page showed the RPC error but kept the old row and action available. A second rapid click could also enter the handler before React rendered its disabled state. After a successful transition, a failed follow-up queue read cleared the success notice, leaving only a read error even though the status write had succeeded.

## Repair and exact H-13B files

| File | Change |
| --- | --- |
| `src/modules/production/ProductionQueuePage.tsx` | Synchronously guard in-flight advancement; on the exact RPC status conflict, reload and show the latest queue or the read error; after a successful write, retain truthful confirmation even if the read fails. Existing failed reads still clear stale rows and offer **Try again**. |
| `qa/H13-FEATURE-COMPLETION-PRIORITIES.md` | Mark the source-confirmed Production issue selected. |
| `qa/H13B-HISTORICAL-PRODUCTION-QUEUE-CONSISTENCY.md` | Record mapping, change, checks, and acceptance boundary. |

No RPC, migration, stock writer, grant, role permission, Manager formal request, Receiving flow, or Rider source was changed. The formal multi-item Manager documents remain externally dispatched and linked to Manager Receiving; Production keeps only its historical queue.

## Checks and limits

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Source route/API/RPC trace | **PASS, static** | Confirmed mounted route, API arguments, SQL expected-status lock/error, and existing idempotent replay check. |
| `npm.cmd run typecheck` | **PASS** | TypeScript exited 0 after the final edit. |
| `npm.cmd run build` | **PASS** | Vite transformed 3,017 modules after the final edit. |
| `npm.cmd run verify:quality` | **PASS** | 11 existing non-workflow checks; these do not exercise Production concurrency. |
| `node scripts/verify-manager-shell-navigation.mjs` | **PASS** | 19/19 existing Manager shell checks, including preservation of historical request navigation. |
| Whole-checkout `git diff --check` | **FAIL, pre-existing unrelated** | Trailing whitespace remains in dirty `supabase/config.toml` and `supabase/tests/verify_receiving_batch_foundation.sql`. Both predate H-13B. H-13B files were untracked at the start, so this Git check does not cover them. A targeted trailing-whitespace scan of the edited Production page and priority file found none. |
| Authenticated conflict, rapid double-click, successful write followed by read failure | **NOT TESTED in browser/API** | The code paths compile but require controlled concurrency and a failing authenticated read. Defer to consolidated local acceptance. |
| Phase 7B SQL verifier, hosted parity, stock and role end-to-end | **NOT TESTED in H-13B** | No disposable DB or hosted access used. Earlier local evidence retains only its own scope. |

No Docker stack or container was touched, no hosted Supabase write or query was made, and no canonical migration or defense demo artifact was changed. Hosted release remains **NO-GO** under the separate provenance and recovery gates.

Next bounded development work: address another source-confirmed defect only. Otherwise, in consolidated acceptance exercise two Production sessions against one historical fixture: conflicting advances, same-action double click, read failure after committed write, retry, and Manager Receiving closure, checking status events and unchanged stock until accepted Receiving is posted.
