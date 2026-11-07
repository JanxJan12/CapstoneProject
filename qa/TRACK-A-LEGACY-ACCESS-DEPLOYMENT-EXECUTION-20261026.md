# Track A legacy access — hosted execution record

**26 October 2026 (Asia/Manila). Decision: BLOCKED before deployment.** No hosted write, grant change, function replacement, migration-history edit, recovery operation, or business test was performed. The target was `zhzluhqvysvsadwuugpa` (`RRJS-Foodhouse-Final`, active/healthy). This record covers only `20261026132319_track_a_retire_production_replenishment_access.sql`.

## Evidence and gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| Reviewed artifact | **PASS** | Local SHA-256 `3CEB555E757B64F2A26CBF5ED7E88B9BE5865DEAE6F6209205DD96A2B10DBCD0` matches the readiness review. The file contains one `BEGIN`/`COMMIT`, a guard, one `REVOKE`, and replacement/regrant of `get_replenishment_requests()`. |
| Live function baseline | **PASS, read-only** | At the 2026-10-26 13:52:14 UTC observation, all six expected signatures existed, were `postgres` owned and `SECURITY DEFINER`. The complete live read-function body, after only replacing `p.role::text in ('manager', 'production')` with `p.role::text = 'manager'` and its corresponding 42501 error text, matched the migration body after whitespace normalization. Its fields, joins, aggregate order, and return are therefore unchanged in this comparison. `get_replenishment_requests()` is stable, returns `jsonb`, and has `search_path=public, extensions, pg_temp`. The five other complete function definitions and exact ACLs are in the protected snapshot. |
| Effective function access | **PASS, baseline only** | `advance_replenishment_request(uuid,text,text)`: anon/authenticated/service_role = **false/true/true**. `get_replenishment_requests()`: **false/true/true**. `create_replenishment_request(...)`: **false/false/true**. `start_replenishment_receiving(uuid)`, `post_receiving_report(uuid)`, and `get_inventory_request_proposal(timestamptz)`: each **false/true/true**. These are the *pre-deployment* permissions; the legacy Production transition remains callable by authenticated users who satisfy its internal predicate. |
| Tables and Receiving dependencies | **PASS, read-only** | Both legacy tables and both Receiving tables have RLS enabled. Authenticated has no SELECT/INSERT/UPDATE/DELETE grant on any of the four. The five named link/close/formal-reconciliation triggers are installed. FKs still connect legacy requests/events to Receiving and formal documents to Receiving. Anon/authenticated have no `CREATE` on `public` or `extensions`. |
| Live rows | **PASS, point-in-time** | Legacy requests **0**, legacy events **0**, legacy linked reports **0**, formal request documents **4**, formal linked reports **3**. Zero legacy rows means hosted historical-row behavior cannot be accepted from this observation. |
| Migration ledger | **BLOCKED for broad replay; targeted version absent** | Read-only `list_migrations` and SQL show Phase 7B `20261007082647` and formal Requests `20261012181744` present, and target `20261026132319` absent. Other hosted versions differ from local filenames, including ledger audit hosted `20261019103144` versus local `20261019095803`, and Receiving inspector hosted `20261023182339` versus local `20261023113221`. The live catalog is suitable for this one SQL file, but the local/hosted migration chain is not reconciled for repository-wide application. |
| Operator and single-version mechanism | **PARTIAL / BLOCKED** | Read-only SQL ran as `postgres`, the owner of the replacement function. Installed Supabase CLI 2.33.9 exposes `migration up --db-url`/`--workdir` but has no named-file selector; the connected `apply_migration` tool accepts a name, not an exact version. No isolated single-file migration rehearsal against a disposable copy and no confirmed exact-version recording were performed. |
| Verified recoverability | **BLOCKED — hard gate** | The existing [disaster-recovery assessment](./DATABASE-DISASTER-RECOVERY-PHASE3.md) documents a local backup and local synthetic restores, but no current independently verified off-device hosted restore, full private Storage bytes, complete configuration, or current recovery point. The available Supabase connector exposed project/catalog/migration reads but no backup inventory or restore-proof read. Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) notes that database backups exclude Storage object bytes. A backup's presumed existence is insufficient to pass this gate. |
| Final authorization to alter hosted grants/ledger | **NOT REQUESTED** | The recovery and deployment-method gates already block execution. Obtain an explicit final confirmation only after the gates pass and an exact reviewed command/result is ready. |
| Hosted apply and postflight | **NOT RUN** | No SQL was applied. No hosted authenticated role test, historical Manager Receiving transaction, formal Request/Receiving posting, or ledger acceptance was run. Local synthetic acceptance in the consolidation report remains local evidence only. |

The full preflight `pg_get_functiondef`, `proacl`, effective permissions, table ACL/RLS, trigger definitions, dependency ledger rows, and counts were saved outside the repository at `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\TrackA-20261026\preflight-catalog-20261026.json`. A companion `preflight-dependencies-20261026.json` in the same folder records the operator, schema privileges, and relevant FKs. The folder has explicit access only for Janmari, SYSTEM, and Administrators. This point-in-time capture is a rollback source, not proof of a recoverable current hosted database. No credentials or customer rows were placed in this report.

## SQL evidence used (all SELECT-only)

```sql
select p.oid::regprocedure::text as signature, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef, p.provolatile, p.prorettype::regtype::text as return_type,
       p.proconfig, p.proacl,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_exec,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('advance_replenishment_request','get_replenishment_requests',
  'start_replenishment_receiving','create_replenishment_request',
  'post_receiving_report','get_inventory_request_proposal')
order by signature;

select version,name from supabase_migrations.schema_migrations
where version in ('20261007082647','20261012181744','20261026132319')
order by version;
-- Returned: 20261007082647, 20261012181744. No target row.

select (select count(*) from public.production_replenishment_requests) as legacy_requests,
       (select count(*) from public.production_replenishment_status_events) as legacy_events,
       (select count(*) from public.receiving_reports where replenishment_request_id is not null) as legacy_linked_reports,
       (select count(*) from public.inventory_request_documents) as formal_requests,
       (select count(*) from public.receiving_reports where inventory_request_id is not null) as formal_linked_reports;
-- Returned: 0, 0, 0, 4, 3.
```

The complete table/trigger SQL and expected postflight queries are in the [readiness review](./TRACK-A-LEGACY-ACCESS-DEPLOYMENT-READINESS-20261026.md); their exact returned rows are in the protected snapshot. `pg_constraint` inspection also found the expected Receiving and legacy request/event FKs. Read-only `current_user` and `session_user` both returned `postgres`.

## Tightly scoped resume procedure

1. **Prove recovery before any hosted write.** The accountable owner must identify the current backup/recovery point for this project, verify a protected independent copy covering schema/data, Auth, complete private Storage bytes and configuration, and complete an isolated restore with integrity and access checks. Record the restore target, snapshot time, hashes, results, recovery time, and operator in a restricted record. If this cannot be done, stop. A function/ACL rollback capture is useful but does not satisfy this gate.
2. **Refresh the complete preflight immediately before execution.** Recompute the file hash; rerun the exact catalog, ACL, RLS, FK, trigger, counts, and ledger queries; compare the entire read-function definition with the reviewed file and prior capture; inventory any newly created legacy requests and users relying on transitions. Require target version absent and dependencies present. Stop on any drift. Freeze competing schema changes for the operation.
3. **Prove an exact-version single-file mechanism in a disposable restored database.** Build an isolated temporary Supabase project directory containing only this reviewed migration file under `supabase/migrations/` and a minimal `supabase/config.toml`. Use the installed CLI's documented `supabase migration up --db-url <disposable-connection> --workdir <isolated-directory>` only after checking its current `--help`. Before rehearsal, show that the isolated directory has exactly one migration file and the disposable ledger lacks `20261026132319`. Afterward require the intended function/ACL changes and exactly one added ledger version `20261026132319`, with no other version. Do not run from the canonical dirty repository. If the tool cannot record precisely that version, stop and separately review another controlled mechanism. Do not repair unrelated ledger rows.
4. **Prepare the final production command and request explicit confirmation.** Repeat the same exact-file, exact-hash, one-pending-migration proof against the live ledger immediately before execution. Use a protected connection string; never place it in QA, shell history, or logs. Apply only after the owner confirms that concrete command, current recovery proof, and preflight record.
5. **Postflight immediately.** Compare the full ledger before/after and require exactly one new `20261026132319` entry. Re-run the function/ACL, table/RLS, FK, trigger, and count queries. Expected `advance_replenishment_request` execute is **false/false/true**; expected read execute is **false/true/true**, with `postgres` ownership, stable `jsonb`, fixed search path, Manager-only predicate, and otherwise identical body. Require untouched start/create/post/proposal definitions and permissions. Perform authenticated Manager/Production/Customer/anon checks only with separately authorized real test identities; do not create or post business records for this migration. Observe Manager Requests/Receiving errors, record actual results, and halt on any mismatch.
6. **Rollback on a failed postflight.** In one transaction under an authorized operator, restore the captured *current pre-deployment* `get_replenishment_requests()` definition verbatim and restore the previous execute ACLs: revoke PUBLIC/anon on both changed functions, grant authenticated and service_role on both, including `advance_replenishment_request`. Verify the restored full definition, owner, security mode, grants, RLS, ledger, and Receiving dependencies. Treat migration-history correction as a separate, reviewed metadata action for this one version only after confirming SQL rollback; do not replay Phase 7B or repair unrelated versions. A failed apply may already have rolled back, so inspect actual state before acting.

After steps 1–2 pass, the isolated CLI rehearsal and later approved production apply can use this PowerShell sequence. Supply the two connection URLs through an approved private credential route; the literal URLs must never be typed into a saved script or this report. The CLI 2.33.9 `init` and `migration up` flags below were checked with `--help` on 26 October. Recheck help/version and inspect the isolated folder and ledger immediately before each use.

```powershell
$repo = 'C:\Users\Janmari\Downloads\Capstone Project'
$version = '20261026132319'
$file = '20261026132319_track_a_retire_production_replenishment_access.sql'
$stage = Join-Path $env:TEMP ('rrj-track-a-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
supabase init --workdir $stage --yes
New-Item -ItemType Directory -Path (Join-Path $stage 'supabase\migrations') -Force -ErrorAction Stop | Out-Null
Copy-Item -LiteralPath (Join-Path $repo "supabase\migrations\$file") -Destination (Join-Path $stage "supabase\migrations\$file") -ErrorAction Stop
$only = @(Get-ChildItem -LiteralPath (Join-Path $stage 'supabase\migrations') -File)
if ($only.Count -ne 1 -or $only[0].Name -ne $file) { throw 'Isolated migration set is not exactly Track A' }
$digest = (Get-FileHash -LiteralPath $only[0].FullName -Algorithm SHA256).Hash
if ($digest -ne '3CEB555E757B64F2A26CBF5ED7E88B9BE5865DEAE6F6209205DD96A2B10DBCD0') { throw 'Migration hash drift' }
# Rehearse first, against a disposable restored database only:
supabase migration up --db-url $env:TRACKA_DISPOSABLE_DB_URL --workdir $stage
# Re-run all postflight SQL and prove exactly one new version. Stop on any mismatch.
# After verified recovery, fresh preflight, successful rehearsal, and explicit final approval only:
supabase migration up --db-url $env:TRACKA_PRODUCTION_DB_URL --workdir $stage
# Re-run all postflight SQL before unfreezing schema work.
```

The CLI command's single-file behavior and recorded version are **not yet proven** for this project; the disposable rehearsal is mandatory. Never run the production line merely because the folder contains one file. For rollback, load the protected JSON's captured `get_replenishment_requests()` definition into a reviewed transaction and then run the following exact ACL reversal in the *same* transaction:

```sql
-- BEGIN and the captured CREATE OR REPLACE FUNCTION definition go first.
revoke execute on function public.advance_replenishment_request(uuid,text,text) from public, anon;
grant execute on function public.advance_replenishment_request(uuid,text,text) to authenticated, service_role;
revoke execute on function public.get_replenishment_requests() from public, anon;
grant execute on function public.get_replenishment_requests() to authenticated, service_role;
-- COMMIT only after the operator reviews the captured definition and target.
```

**Worktree safeguard:** `git status --porcelain=v1` had 317 pre-existing entries before this record. No existing source, migration, or QA file was edited. Only this execution record and the protected external snapshot were created.

## Retry — 26 October 2026, 21:58 PHT

**Decision remains BLOCKED; no hosted write.** A fresh, authenticated read of the [project's scheduled-backups dashboard](https://supabase.com/dashboard/project/zhzluhqvysvsadwuugpa/database/backups/scheduled) identified `RRJS-Foodhouse-Final` and displayed: “Free Plan does not include project backups.” The [point-in-time recovery page](https://supabase.com/dashboard/project/zhzluhqvysvsadwuugpa/database/backups/pitr) displayed: “Point in Time Recovery is a Pro Plan add-on,” with an upgrade offer rather than a recovery window. This is direct project-specific evidence that managed scheduled backup and PITR are unavailable here; it does not rule out a separately maintained private backup, but none has been verified as a current independent hosted restore. The recovery hard gate therefore fails before deployment.

At **2026-10-26 13:58:11–13:58:12 UTC**, fresh read-only SQL returned the same six function definitions and `proacl` values as the protected 13:52 snapshot, with the same effective execute permissions and `postgres` ownership. The ledger still contained Phase 7B `20261007082647` and formal Requests `20261012181744`, and still lacked target `20261026132319`. Counts remained **0** legacy requests, **0** legacy linked reports, **4** formal documents, **3** formal linked reports. The migration file SHA-256 remained `3CEB555E757B64F2A26CBF5ED7E88B9BE5865DEAE6F6209205DD96A2B10DBCD0`.

```sql
-- Retry checks, all SELECT-only; the full definitions were compared in memory
-- with the protected earlier capture rather than copied into this report.
select now() at time zone 'UTC' as observed_at_utc,
       p.oid::regprocedure::text as signature, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef, p.provolatile, p.proconfig, p.proacl,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_exec,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('advance_replenishment_request','get_replenishment_requests',
  'start_replenishment_receiving','create_replenishment_request',
  'post_receiving_report','get_inventory_request_proposal')
order by signature;
```

**Not run:** isolated recovery restore, exact-version migration rehearsal, production migration, authenticated hosted role acceptance, historical Manager Receiving, formal Requests/Receiving business transactions, and postflight. A later retry needs a current independent, tested recovery route before any hosted access or ledger change. Do not use an unscoped `db push` or repair the discrepant historical ledger to work around this gate.

## Authorized deployment — 26 October 2026, 22:06–22:15 PHT

**Track A hosted deployment: COMPLETE for the one reviewed access migration.** The owner expressly accepted the previously recorded limitation that this Free Plan project has no verified current independent recovery route, and authorized this one deployment without another recovery approval cycle. This acceptance does not establish disaster recovery readiness.

| Gate / check | Actual result |
| --- | --- |
| Target and file | **PASS.** Project `zhzluhqvysvsadwuugpa`; canonical and staged file SHA-256 `3CEB555E757B64F2A26CBF5ED7E88B9BE5865DEAE6F6209205DD96A2B10DBCD0`. No canonical migration or source file was edited. |
| Fresh preflight | **PASS.** At 14:06:23 and again at 14:13:48 UTC, all six complete function definitions, owners, attributes, ACLs, the 63-row ledger, four table ACL/RLS states, five Receiving triggers, 15 relevant FKs, and row counts matched the protected earlier baseline. Target version absent. Counts: 0 legacy requests/events/linked reports; 4 formal request documents; 3 formal linked reports. The refreshed full-definition snapshot is in the restricted `preflight-catalog-refresh-20261026.json`. |
| Single pending migration proof | **PASS after resolving a CLI guard.** The first isolated staging folder contained only the target file, and a minimal disposable local database applied it with exactly one `20261026132319` ledger row. Hosted `migration up --linked` initially stopped *before SQL* because the CLI requires all 63 existing remote versions to have matching local files. Direct `--db-url` showed the same guard on a disposable database. `migration fetch --linked` then copied those 63 **already recorded** versions into the isolated temporary staging folder, without touching the canonical repository or repairing hosted history. `migration list --linked` showed exactly one pending version: `20261026132319`; the target file retained its reviewed hash. A second disposable rehearsal with those same 63 ledger versions and the 64 staged files applied only the target, giving 64 total rows, exactly one new target row, the intended permissions, and the Manager predicate. The disposable fixture used the exact captured legacy function bodies and minimal dependency stubs; it was a migration-selection/SQL test, not a full hosted restore. |
| Hosted apply | **PASS.** `supabase migration up --linked` from the isolated folder returned success and printed only `Applying migration 20261026132319_track_a_retire_production_replenishment_access.sql...`. No `db push`, migration repair, or unrelated SQL replay was run. CLI linking/listing printed `Initialising cli_login_postgres role`; this operational role initialization was not part of the reviewed migration and was not independently diffed. |
| Ledger postflight | **PASS.** At 14:14:25 UTC, ledger count was 64 versus 63 before; the sole added row was version `20261026132319`, name `track_a_retire_production_replenishment_access`. No version was removed. |
| Access/function postflight | **PASS.** Effective `EXECUTE` on `advance_replenishment_request(uuid,text,text)` is anon/authenticated/service_role = **false/false/true**; its full body is unchanged. `get_replenishment_requests()` is **false/true/true**, remains `postgres` owned, `SECURITY DEFINER`, stable `jsonb`, and retains `search_path=public, extensions, pg_temp`. Comparing the full old and new definitions shows only the Manager-only predicate and its 42501 error text changed, apart from whitespace immediately before one SQL semicolon. The complete definitions and ACLs of `start_replenishment_receiving`, `create_replenishment_request`, `post_receiving_report`, and `get_inventory_request_proposal` are identical to preflight. |
| Data/dependencies postflight | **PASS.** The four table ACL/RLS records, five Receiving trigger definitions, and 15 relevant FK definitions matched preflight exactly. Counts remained 0/0/0 legacy requests/events/linked reports and 4/3 formal documents/linked reports. The restricted `postflight-catalog-20261026.json` contains the full postflight capture. |
| Real authenticated and business workflow smoke | **NOT RUN.** No hosted test identity/session was available for a safe Manager/Production/Customer login check. No historical Receiving or formal Request/Receiving transaction was created or posted; there are no legacy requests to inspect. The verified catalog and local rehearsal support the access change, but do not claim end-to-end hosted UI acceptance. |

Both protected JSON snapshots are under `C:\Users\Janmari\AppData\Local\RRJ-Private-Backups\TrackA-20261026\`, with access limited to Janmari, SYSTEM, and Administrators. The prior **BLOCKED** entries above describe the earlier attempts; this section records the later authorized completion. Track B can begin on that bounded basis, with independent recovery and real authenticated workflow acceptance still tracked separately.

The disposable rehearsal database was dropped after verification. The isolated staging folder remains under the user's temporary directory; it contains the fetched, already-recorded migration files and the reviewed target copy, and no canonical worktree files were changed by staging.
