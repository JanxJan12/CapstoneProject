# Track B — authenticated Rider read acceptance (26 October 2026)

## Scope and environment

**Result: PASS for the specified local HTTP authorization cases.** Canonical checkout: `C:\Users\Janmari\Downloads\Capstone Project`. The checkout was already substantially dirty; existing modified and untracked work was preserved. The test used the already running, unlinked, disposable Supabase fixture `.tmp/track-a-auth-20261026-targeted` at `http://127.0.0.1:64521` (database `127.0.0.1:64522`). Its local GoTrue, PostgREST, Storage and gateway services were healthy. This targeted fixture has 34 public tables and 54 selected migration entries; it is not a current hosted clone or full migration replay.

Reviewed `qa/TRACK-B-SECURITY-INTEGRITY-PHASE1-20261026.md`, local-only migration `supabase/migrations/20261026144235_track_b_restrict_rider_assignment_proof_reads.sql`, and SQL regression `supabase/tests/verify_track_b_rider_read_authorization.sql`. First, the SQL regression injected the migration inside its transaction and completed with `ON_ERROR_STOP=1` and `ROLLBACK`, reproducing the old suspended-read gap before the policy replacement and checking approved/unrelated/suspended/inactive reads afterward. The migration was then applied directly **only to this disposable local database** for HTTP acceptance. The two resulting read policies require assignment ownership plus active profile, Rider role, and approved Rider record; the private `delivery-proofs` bucket and its existing upload policy were left intact. No hosted Supabase call, write, migration, or deployment was made; no production credential was used.

The reproducible test is `scripts/fixtures/verify-track-b-rider-http-local.mjs`. It guards the exact loopback API and container, creates random synthetic users through local GoTrue admin, signs them in through GoTrue password sessions, inserts a synthetic order and assignment, creates the private `delivery-proofs` bucket that was absent from this targeted fixture, and uploads a one-pixel private proof with the local service role for setup. All acceptance reads use the actor's actual GoTrue token (or the local anon key), not a handcrafted JWT or service role. It compares downloaded proof bytes and removes the synthetic users, order, assignment, and object afterward. Local checks found zero remaining `track-b-` Auth users, orders, or Storage objects. The empty local bucket remains for further disposable tests.

## Results

| Actor and current database state | PostgREST assignment | Assigned order | Private proof HTTP download | Result |
| --- | --- | --- | --- | --- |
| Active Rider, approved, owns assignment | HTTP 200, 1 row with expected proof path | HTTP 200, 1 row | HTTP 200, exact image bytes | **PASS** |
| Unrelated Customer account | HTTP 200, 0 rows | HTTP 200, 0 rows | HTTP 400 | **PASS: denied** |
| Anonymous | HTTP 200, 0 rows | HTTP 200, 0 rows | HTTP 400 | **PASS: denied** |
| Suspended former Rider, same valid GoTrue session | HTTP 200, 0 rows | HTTP 200, 0 rows | HTTP 400 | **PASS: denied** |
| Rider role with suspended approval, same session | HTTP 200, 0 rows | HTTP 200, 0 rows | HTTP 400 | **PASS: denied** |
| Customer role with approved Rider record, same session | HTTP 200, 0 rows | HTTP 200, 0 rows | HTTP 400 | **PASS: denied** |
| Inactive Rider with approved record, same session | HTTP 200, 0 rows | HTTP 200, 0 rows | HTTP 400 | **PASS: denied** |

The separate role/approval states show that neither an approved record alone nor a Rider profile role alone bypasses the new predicates. The suspended and inactive checks reused the already issued GoTrue access token, so the denial came from current database state rather than a failed sign-in. PostgREST's zero-row responses and Storage's HTTP 400 denial are the observed API behavior; they are not reported as transport errors or as 403s. An independent catalog check confirmed `delivery-proofs` is `public=false`, the assignment and proof read policies apply to `authenticated`, and the existing proof upload policy remains `INSERT` for `authenticated`. The actual private-object download checks independently exercised Storage enforcement rather than relying on a `storage.objects` SQL query alone.

| Focused check | Result |
| --- | --- |
| SQL role/JWT regression with migration inside rollback transaction | **PASS** |
| Genuine local GoTrue → PostgREST → private Storage HTTP cases above | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |
| `node scripts/verify-manager-riders-workspace.mjs` | **PASS**, 26 source-contract assertions |
| `node scripts/verify-mgr-rec-05-model.mjs` | **PASS**, request/Receiving model checks |
| Full Rider Android, rendered Manager/Receiving browser workflows, hosted authenticated behavior | **NOT RUN** in this bounded authorization acceptance |

**FAIL: none observed. BLOCKED: none for the requested local HTTP acceptance.** The listed NOT RUN checks remain outside this bounded run and are not counted as passes.

No Rider app, Manager, Receiving, or existing migration/test source was edited in this increment. The only new source file is the local HTTP verifier above; this report is the other new file. The Track B migration and SQL regression were pre-existing untracked files inspected and executed here, not newly authored in this increment. The local database retained the Track B policy replacement for further disposable testing. This does not establish hosted deployment readiness or exact hosted runtime parity.

**Next single small Track B action:** on this disposable stack, issue a short-lived signed URL for a synthetic proof while the Rider is approved, then suspend that Rider and check whether the already issued URL remains usable until expiry; record the observed expiry boundary without changing hosted state.
