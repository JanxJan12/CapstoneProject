# Track A — Production read-only formal Manager requests

> Historical checkpoint. The Production Queue route and formal Production read screen have since been removed. The current workflow and legacy backend access decisions are recorded in `TRACK-A-LEGACY-BACKEND-CONSOLIDATION-20261026.md`.

26 October 2026. Implemented locally in the canonical `Capstone Project` worktree. This builds on `TRACK-A-REQUEST-LEGACY-DEPENDENCIES-20261026.md` and the actual request, Receiving, and Production code. **No hosted schema, data, grants, or RLS were changed.** The pre-existing dirty worktree was left intact.

## Change

- `supabase/migrations/20261026130040_production_formal_request_read_queue.sql` adds `get_production_formal_requests()`. It returns only `issued` and `partially_received` formal documents, each request's number, revision, priority, needed and issued time, and current item lines with requested, posted accepted, and remaining quantities. Only `posted` Receiving lines count toward accepted. The RPC checks `auth.uid()` against an active `production` profile before reading protected tables. It is `SECURITY DEFINER` because authenticated clients have no direct access to the formal tables; its output is deliberately limited and it grants no table access or Manager mutation. `PUBLIC` and `anon` execution are revoked; `authenticated` execution is granted with the in-function role check.
- `src/modules/production/formalRequestApi.ts` calls that read RPC. `src/modules/production/ProductionQueuePage.tsx` adds a separate read-only Manager Inventory Requests section above the historical legacy queue. It shows lifecycle labels `Issued` and `Partially received`, multi-item quantities, priority, and needed time. Formal loading errors stay in that section, leaving the legacy queue usable.
- The mounted historical Production queue, its `get_replenishment_requests` and `advance_replenishment_request` calls, Manager formal issue/revise paths, legacy Receiving compatibility, and shared `post_receiving_report` were not edited.

## Verification

| Check | Result |
| --- | --- |
| Typecheck and build | PASS |
| Offline H-23 request workflow (40 checks), Receiving posting (42), Receiving draft authoring (65), proposal contract | PASS |
| Disposable SQL: `verify_phase_7b_replenishment_requests.sql`, `verify_manager_inventory_request_documents.sql`, `verify_source_neutral_receiving_posting.sql`, `verify_manager_inventory_request_security.sql` | PASS; each rolled back its synthetic transaction |
| Authenticated PostgREST on dedicated `127.0.0.1:64521` stack | PASS: active Production read issued two-item and partially received requests; posted accepted and remaining values matched; Manager, Cashier, inactive Production, and anonymous reads denied; Production Manager register and issue denied; no authenticated table SELECT grant |
| Local rendered Production page | PASS: issued two-item and partially received cards, no formal action buttons, legacy queue remains visible. [Screenshot](track-a-production-formal-20261026.png). |

The synthetic issued document was removed after each local test. The existing disposable partially received fixture remained. The migration was applied only to that disposable local database for testing; this does not establish hosted behavior.

## Security and rollout limit

The RPC is an intentional, narrowly scoped `SECURITY DEFINER` read over otherwise protected request and Receiving tables. Anyone with an `authenticated` database role may invoke its endpoint, but only an active `production` profile receives data. It does not reveal revisions, reasons, notes, events, reports, actor identities, or other table columns. Production receives no Manager write grant; existing Manager RPCs retain their own role checks. This local test does not prove hosted deployment, hosted authenticated UI acceptance, or every historical legacy row shape. Until this migration is reviewed and deployed, the hosted new section will show a load error while the legacy queue continues to work.

**Next smallest Track A action:** review this single migration and UI change, then separately authorize deployment of the read RPC and run authenticated hosted Production and unauthorized-role read checks. Keep legacy request/Receiving retirement out of that step.
