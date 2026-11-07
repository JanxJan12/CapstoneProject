# MGR-REC-02C — Integrated Receiving and posting acceptance (23 October 2026)

## Outcome

**PARTIAL overall; the local SQL Receiving/posting contract passes.** The exact MGR-REC-02B migration, applied to a disposable restored local schema, worked with the existing request, draft-line, posting, batch, movement, reconciliation, and Manager-read RPCs. A synthetic request for 2 pcs produced a linked draft attributed to the authenticated Manager claim, then one posted receipt for 2 delivered / 1 accepted / 1 rejected. Stock rose by exactly 1 pc, one batch and one receiving movement appeared, and the request retained 1 pc outstanding. Duplicate start and post attempts did not duplicate stock. Cashier, Rider, inactive Manager, and unauthenticated claims were denied by server functions. A separately seeded synthetic posted receipt was unchanged across the exact migration. GoTrue, PostgREST, a React-to-database journey, and hosted-schema parity were **not** exercised, so this is not hosted production acceptance.

## Starting state, checksum, and environment

The `main` worktree was already substantially dirty, including prior untracked MGR-REC-01/02B source, migration, fixtures, and reports. No existing work was reset. Production source and the 02B migration were not edited in this assignment. SHA-256 of `supabase/migrations/20261023113221_manager_receiving_verified_inspector.sql` was confirmed before testing as **`23D7F72D20C9D3B9C5791078EE56C17C8D458930EE7027164D49B0C582C8D776`**, matching the reported hash.

Docker had no running containers and Windows reported 4,390,276 KiB free physical memory. Only `rrj_mgr_rec_02c_20261023` was created from cached Supabase PostgreSQL 17.11, with `--network none`, no published ports, no mounted volumes, and temporary database storage. The baseline was the read-only local Phase 8 **schema/ACL-only** file `C:\Users\Janmari\Downloads\RRJ-Inventory-Dev-20261011\.tmp\phase8-local-schema-acl-restorable.sql`, SHA-256 `514ED9B0B61C7736F92905C2845A2EFF794AE4F3B3E050C39A46C41FDF8D473B`. It contains no approved master rows or physical opening stock. In dedicated databases, the October 12 Request, October 13 Production delivery policy, October 18 Request-reason removal, and exact October 23 inspector migration applied successfully. This was a **targeted incremental local fixture**, not a clean replay of the migration ledger or a faithful hosted-schema/data copy. The container had no route to hosted Supabase.

Relevant live-in-fixture RPCs were `start_inventory_request_receiving(uuid,integer,uuid,text,text)`, `save_receiving_report_item(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date,text)`, `post_receiving_report(uuid)`, `get_inventory_request_register()`, and `get_manager_receiving_workspace(uuid)`. Each was `SECURITY DEFINER`, executable by `authenticated`, and not by `anon`; the start/register search path was empty, while the Receiving authoring/posting/workspace path was `public, extensions, pg_temp`. `inventory_request_manager_required()` checked `auth.uid()` against an active Manager profile. The 02B start RPC ignored caller inspector text and stored that profile UUID in `inspected_by_name`, while `received_by` remained a separate UUID field. The existing posting RPC remained the sole stock authority.

The first restore attempt in the dedicated history database hit the default empty `public` schema. That schema and the two partially created empty schemas were dropped **inside that dedicated database only**, then the baseline restored cleanly. No unrelated container, database, migration, or volume was touched.

## Synthetic integrated transaction

`supabase/tests/verify_mgr_rec_02c_disposable.sql` ran the actual repository RPCs inside `BEGIN`/`ROLLBACK`. It used new random synthetic Manager, second Manager, Cashier, Rider, inactive Manager, request, item, line, and receipt IDs. The final passing run reported item `44fbbde2-1923-40b4-993d-5a67b8f47644`, request `81009742-3b40-4dba-9c81-c6c802b381ad`, and posted receipt `2d363987-875b-448a-b098-66f57379e1ee`. These IDs were local only and rolled back.

| State | Before issue/start | Saved draft, before post | After post | Duplicate post / next draft |
| --- | ---: | ---: | ---: | ---: |
| Requested | 2 pcs | 2 pcs | 2 pcs | 2 pcs |
| Delivered / accepted / rejected | 0 / 0 / 0 | 2 / 1 / 1 pcs | 2 / 1 / 1 pcs | Unchanged |
| Aggregate item stock | 0 pcs | 0 pcs | **1 pc** | **1 pc** |
| Receiving batches for item | 0 | 0 | **1**, initial/on-hand 1 pc | **1** |
| Receiving movements for item | 0 | 0 | **1**, change +1, before 0, after 1 | **1** |
| Request status / outstanding | Issued / 2 pcs | Issued / 2 pcs | Partially received / **1 pc** | Still 1 pc; a next linked draft is eligible |

The draft used the current request revision 1 and Production source. `get_manager_receiving_workspace` read it as Draft with the expected creator and reference. `received_by`, the stored inspector text, and the delivery-started event actor/details all identified the first Manager; a forged legacy inspector argument did not override them. The note remained null. A second active Manager repeated the same report ID without changing the original inspector or note or making another receipt. A different open report ID was rejected by the unique index. Initial request issuance, draft creation, and draft-line save created no batch or movement.

`save_receiving_report_item` rejected a 2-delivered/1-accepted line without a rejection reason, then accepted the same quantities with `One rejected at inspection`. No expiry date was needed for this synthetic non-expiry item; no claim is made about an expiry-required item in this one scenario. On post, the report became Posted with `posted_by` set to the posting Manager, while `received_by`, inspector, request ID, and revision stayed intact. A later line-save attempt on that posted report was denied. The second `post_receiving_report` call raised the expected invalid-parameter error; stock, batch, movement, and outstanding totals did not increase again. A next linked draft could start for the remaining 1 pc without moving stock.

Cashier, Rider, inactive Manager, and unauthenticated JWT-claim contexts were each denied start and post by the actual server functions. The main actions used synthetic JWT claims in direct PostgreSQL, **not** genuine GoTrue tokens. After the integrated action, a `SET LOCAL ROLE authenticated` check read the posted receipt through `get_manager_receiving_workspace` and confirmed duplicate-post denial under that database role. Browser button disabling was not used as authorization evidence.

## Historical receipt comparison

In a second dedicated database restored to the pre-02B function, `mgr_rec_02c_history_seed.sql` used the original October 12 start RPC plus the real line-save and post RPCs to commit synthetic posted receipt `4fbc263d-51e6-49c7-8a80-fd397926a46e` with inspector `Legacy Synthetic Inspector`, 1 pc accepted, one batch, and one movement. A JSON snapshot captured the complete receipt row, line, linked batch and movement, and request row, including timestamps and revision. The **exact unchanged 02B migration** then applied. `mgr_rec_02c_history_assert.sql` compared those full snapshots and passed: the posted receipt, legacy label, quantities, batch, movement, request revision/status, and audit times were unchanged. This was synthetic history in a disposable database, never a hosted receipt.

## Tests, limitations, and cleanup

| Test | Result |
| --- | --- |
| `verify_mgr_rec_02c_disposable.sql` | **PASS**: integrated issue/start/resume/line/post/reconcile, rejection requirement, accepted-only stock/batch/movement, duplicate guards, role denials, posted read-only. |
| `mgr_rec_02c_history_seed.sql` → exact 02B migration → `mgr_rec_02c_history_assert.sql` | **PASS**: full synthetic posted-record snapshot unchanged. The history seed committed in its dedicated disposable database. |
| `verify_manager_inventory_request_documents.sql` | **PASS** after 02B: request/revision, partial and second delivery, stock/ledger, overage, duplicate post, shortfall. |
| `verify_manager_inventory_request_security.sql` | **PASS** after 02B: 8 anon RPC denials, 4 RLS-table checks, 12 role/RPC denials. |
| `verify_manager_receiving_draft_authoring.sql` | **PASS** after 02B. |
| `verify_source_neutral_receiving_posting.sql` | **PASS** after 02B. |
| `npm.cmd run typecheck`; `npm.cmd run build` | **PASS**; build transformed 3,039 modules. |
| Genuine GoTrue sign-in, HTTP/PostgREST RPC, authenticated React browser-to-database flow | **NOT TESTED**. The prior 02B browser test used mocks; this turn exercised direct PostgreSQL and a database role. |
| Full hosted schema / real delivery / physical inventory observation | **NOT TESTED**. No hosted request, receipt, stock, auth, or finance record was read or changed for this test. |

After rollback, the primary fixture had **0** request documents, **0** Receiving reports, **0** batches, and **0** movements. The committed synthetic historical receipt existed only in the second database inside the owned container. The owned container was removed; it had no mounts or ports. The unrelated stopped `codex-meal-customer-qa-20261021` container and all Docker volumes were preserved. The only retained artifacts are these local test SQL files and report.

## Acceptance and next decision

The missing **02B SQL posting integration gap is closed locally**: the exact migration works with real repository Receiving and stock-posting contracts in the targeted disposable schema. MGR-REC-02C remains **PARTIAL** as a whole because a genuine authenticated React → PostgREST → database transaction and hosted-schema compatibility were not exercised. A separate hosted deployment decision is required. Before activating the updated local frontend against hosted Supabase, approve and coordinate the exact 02B migration cutover with read-only hosted preflight and postdeployment verification; this report does not authorize it.

| Required disposition | Result |
| --- | --- |
| MGR-REC-02C | **PARTIAL** |
| Inspector Attribution | **PASS — disposable SQL** |
| Authorized Manager Identity | **PASS — synthetic JWT claims and authenticated database role; GoTrue not tested** |
| Linked Draft Start/Resume | **PASS** |
| Partial Delivery & Rejection | **PASS** |
| Accepted-Only Stock Posting | **PASS** |
| Outstanding Request Reconciliation | **PASS** |
| Duplicate Posting Protection | **PASS** |
| Authorization | **PASS — server RPCs in disposable PostgreSQL** |
| Historical Receipt Integrity | **PASS — synthetic before/after snapshot** |
| Authenticated Browser-to-PostgREST | **NOT TESTED** |
| TypeScript | **PASS** |
| Production Build | **PASS** |
| Hosted Business Data Modified | **NO** |
| Hosted Migration Applied | **NO** |
| Deployment | **NONE** |
