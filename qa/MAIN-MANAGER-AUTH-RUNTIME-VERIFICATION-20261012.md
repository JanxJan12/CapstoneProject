# Main Manager Inventory authenticated runtime verification — 2026-10-12

**Result: BLOCKED / NO AUTHENTICATED TEST.** This was the one bounded operational verification attempt. No approved, disposable, same-database local baseline or running local Auth/PostgREST/database service was available. No request was issued, receipt posted, stock changed, or migration applied. This is an environment/approval gate, not a demonstrated application failure or a passing transaction result.

## Environment and authorization

- Sole application source inspected: `C:\Users\Janmari\Downloads\Capstone Project`. Its dirty worktree and hosted `.env.local` were preserved. Its `supabase/.temp` has `project-ref` and `linked-project.json`, so the linked Supabase CLI was not invoked. The main app was not started.
- The existing `RRJ-Inventory-Dev-20261011/scripts/offline-preflight.mjs` **PASS**ed in its own isolated workspace: no active link or remote-capable credentials, loopback-only config, and its expected ports free. This result describes that older workspace, **not** an approved baseline for main or a running same-database stack.
- Current read-only service check found no loopback listeners on 55320–57329. `docker ps` could not connect to the Docker Desktop Linux engine (`dockerDesktopLinuxEngine` pipe absent), so no container database/schema state could be inspected. No local database, Auth service, or app API was contacted.
- Existing provenance: `RRJ-Inventory-Dev-20261011/.tmp/phase8-local-schema-acl-restorable.sql`, SHA-256 `514ED9B0B61C7736F92905C2845A2EFF794AE4F3B3E050C39A46C41FDF8D473B`, is a schema/ACL-only copy from the earlier `rrj_phase8_sim` simulation. The prior Phase 2F report says its GoTrue Auth and application databases were separate, test fixtures were not an approved migration/opening-balance baseline, and its resources were removed. The earlier integrated-candidate gate found no approval designating this snapshot or another artifact for a same-database authenticated test. This attempt found no newer approval. The snapshot was not restored.
- Authorization for this attempt was local-only. No hosted, staging, production, Messenger, external API, or Supabase CLI call was made; no credential value was printed. No local synthetic identity or business row was created.

## Contract inspected and test status

The canonical additive request migration `supabase/migrations/20261011120154_manager_inventory_request_documents.sql` has SHA-256 `FEC604AA63AC3B2B55703118DFAC8858E921BC7AB1673872D15CBC4F446DE969`. It defines request documents/lines/revisions/events with RLS and table grants removed from `anon`/`authenticated`; Manager-gated proposal, issue, event, linked Receiving, revision, and register RPCs are granted to `authenticated`. The linked Receiving RPC creates a draft against the current issued revision. The existing `post_receiving_report(uuid)` definition checks the authenticated actor's active Manager profile and rejects an already posted receipt. The main frontend calls those RPCs through `inventoryRequestApi.ts` and `receivingApi.ts`; `AuthProvider.tsx` reads the authenticated user's profile and role. These are **source contracts only**; installed schema, effective grants/RLS, and runtime behavior were not verified.

| Check | Result |
| --- | --- |
| Approved same-database baseline and installed migration state | **BLOCKED / UNKNOWN** — no approved artifact or accessible local instance; no SQL applied. |
| Real Manager sign-in, profile/role authorization, non-Manager denial or role-elevation denial | **NOT TESTED** — no local Auth/PostgREST session. |
| Unsaved multi-item proposal and preview with zero issue calls; explicit one-request issuance; optional synthetic dispatch attestation | **NOT TESTED** — no real app API/RPC call or persisted request ID. |
| Blank linked Receiving draft; delivered/accepted/rejected/undelivered inspection; one accepted-only post | **NOT TESTED** — no receipt ID or posting call. |
| Same-receipt pre/post physical and usable stock, batch, ledger, Stock Movement, reconciliation, duplicate-post rejection/no double count | **NOT TESTED** — no pre/post counts or IDs exist from this attempt. |

The prior Phase 2F two-database result and local visual fixture are separate evidence; neither establishes this same-database main-app transaction. The migration has no observed SQL failure in this attempt because it was not executed.

**One next action:** explicitly approve a named, provenance-backed **local-test** schema/ACL baseline (or the identified snapshot with its known drift accepted) for one disposable **same-database** Auth/RLS/request/Receiving/Movement run, and provide a working loopback-only local container runtime. Then repeat this single bounded test against that approved instance. Historical clean replay, hosted behavior, staging, and production remain **NO-GO / NOT TESTED**.
