# H-13C Kitchen queue status consistency — 2026-10-16 Manila

## Confirmed contract and correction

The mounted `/kitchen` route activates a terminal before rendering `KitchenQueue`. `kdsTerminalService.ts` reads `get_kds_queue_v2(uuid,text)` and writes `advance_kds_order(uuid,text,uuid,order_status)`. The versioned write in `20260914010000_harden_transition_replay_safety.sql` locks `orders`, requires the displayed expected status, and rejects a changed status before writing. The v2 read in `20261013162631_kds_queue_modifier_channel_v2.sql` preserves the authorized v1 ticket set and adds channel and modifier snapshots. The existing Kitchen queue already clears tickets on a failed read and synchronously blocks duplicate advances; those gaps were previously addressed.

**Source-confirmed defect:** a rejected expected-status advance left the old ticket and its action visible until the next five-second poll. Also, the intended post-write read called `loadQueue()` but could return early when a poll was in flight; that older poll could then show a pre-write status. This is a Kitchen order-status presentation issue, not a request for a new transition rule.

**Edit:** `src/modules/kitchen/queue/KitchenQueue.tsx` now removes the rejected ticket immediately on the RPC's specific changed-status error and forces a new server read. A committed advance also forces that read. A request version prevents an older poll from overwriting the newer result; a failed forced read clears tickets and leaves the existing retry/error UI. Missing terminal credentials also clear prior tickets. No service, SQL, role, payment, stock, Rider, or migration source changed. The file was already dirty before H-13C; these statements describe only this tranche's added lines.

## Checks and boundary

| Check | Result |
| --- | --- |
| Mounted route, service arguments, and versioned SQL status guard | **PASS, static source trace** |
| `npm.cmd run typecheck` | **PASS** (exit 0) |
| `npm.cmd run build` | **PASS** (3,017 modules transformed) |
| `npm.cmd run verify:quality` | **PASS** (11 existing checks; no Kitchen concurrency coverage) |
| Existing targeted Kitchen non-Docker test | **NOT AVAILABLE**; existing Kitchen browser/API scripts require the deferred local stack. No new mock-only test was added. |
| Two-terminal conflict, overlapping poll/write, failed read after committed write, hosted parity | **NOT TESTED** in authenticated browser or database runtime. |

Whole-checkout `git diff --check` was not used as a gate: unrelated pre-existing trailing whitespace in `supabase/config.toml` and `supabase/tests/verify_receiving_batch_foundation.sql` is already known. H-13C did not change either file. No Docker stack, hosted Supabase project, demo fixture, or Rider artifact was accessed.

Next narrow feature: in consolidated local acceptance, run two authenticated Kitchen terminals against one disposable confirmed order, including a stale advance, an overlapping poll during a successful advance, and a failed follow-up read. Check the authoritative `orders.current_status` and status history once, then verify the screen and Retry converge without a second transition. Keep H-13B Production conflict/read-failure cases in that same future acceptance backlog. Hosted release remains **NO-GO** under the separate provenance and recovery gates.
