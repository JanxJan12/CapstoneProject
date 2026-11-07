# Track B Rider authorization — hosted deployment readiness (27 October 2026)

## Decision and boundary

**NO-GO for execution today; prepared for a narrow, separately authorized deployment.** The hosted catalog matches the reviewed old-policy baseline, and the target migration has passed prior disposable SQL and genuine local GoTrue/PostgREST/Storage HTTP acceptance. The exact-version, single-file hosted executor and rollback have not been rehearsed on a disposable database in this session: Docker Desktop is unavailable, and `psql` is not on this machine's PATH. Hosted authenticated behavior remains untested. Do not treat the catalog match as an HTTP acceptance result.

No hosted write, migration, Storage call, or production business-row query was made for this review. The migration source was not edited. The canonical checkout was already substantially dirty; only this report and a local SQL-bundle generator were added. Scope of the future hosted change is **only** `supabase/migrations/20261026144235_track_b_restrict_rider_assignment_proof_reads.sql` for project `zhzluhqvysvsadwuugpa`. Track A, Production Queue, Rider availability, Manager, and Receiving changes are excluded.

## Reviewed artifact and prior proof

- SHA-256 of the exact local file: `3940049EDB24E149E6551F523B5F4513A79561DFD1E59C97A2F3C7D29F100A27`.
- The file drops and recreates **only** `public.delivery_assignments.rider_select_own_assignments` and `storage.objects.rider_read_own_delivery_proof`. Both remain `SELECT TO authenticated`, preserve assignment/path ownership, and require the current profile to be active with `role='rider'` and the matching Rider row to have `approval_status='approved'`. No grant, upload policy, bucket, function, data row, or other policy is changed.
- `qa/TRACK-B-SECURITY-INTEGRITY-PHASE1-20261026.md` reproduced the old suspended-Rider read gap and passed a rollback-scoped SQL RLS test. `qa/TRACK-B-RIDER-AUTHENTICATED-ACCEPTANCE-20261026.md` records genuine local GoTrue sessions: approved owner read its assignment and exact private-proof bytes; suspended, inactive, wrong-role, wrong-approval, unrelated, and anonymous actors were denied. The local test also passed typecheck, build, Manager Riders, and Receiving model checks. These are **prior 26 October results**, not rerun or hosted results today.
- Reusable disposable HTTP check: `node scripts/fixtures/verify-track-b-rider-http-local.mjs`. It is hard-guarded to `127.0.0.1:64521` and a named local Docker container, creates and cleans synthetic users/order/assignment/object, and must **never** be repointed at hosted. Current Docker daemon connection failed, so no fresh SQL/HTTP rehearsal was possible today.

## Read-only hosted comparison, 27 October

| Item | Hosted finding | Readiness consequence |
| --- | --- | --- |
| Ledger | Latest listed version `20261026132319` (Track A); `20261026144235` absent. Other historically deployed versions differ from local filenames, including Receiving `20261023182339`. | Normal `supabase db push` from the dirty canonical directory is not a single-file operation. Do not run it. |
| Assignment policy | Sole `delivery_assignments` policy is `rider_select_own_assignments`, permissive `SELECT TO authenticated`, `USING (rider_id = auth.uid())`. RLS enabled. | Exact old gap still exists; replacement matches intended target. |
| Proof read | `rider_read_own_delivery_proof` is permissive `SELECT TO authenticated`; bucket/path owner and assignment owner only. No other policy grants `delivery-proofs` read. | Exact old gap still exists. |
| Proof upload | `rider_upload_own_delivery_proof` remains `INSERT TO authenticated`, requiring assignment ownership, `out_for_delivery`, active Rider profile, and approval. | Migration must leave it untouched. |
| Other Storage reads | Other `SELECT` policies are bucket-specific to `payment-proofs` and `rider-documents`; no anonymous broad read policy found. | No alternate `delivery-proofs` read in the inspected policy set. |
| Bucket | `delivery-proofs` is private, 5 MiB, JPEG/PNG/WebP. | Private-download RLS is relevant; preissued signed URLs have different expiry behavior and were not tested. |
| Dependencies | `delivery_assignments.id/rider_id`, `profiles.id/role/is_active`, `riders.id/approval_status`, `storage.objects.bucket_id/name` and the required enum labels exist. `auth.uid()` is invoker, executable by authenticated; Manager suspension changes profile role to customer and Rider approval to suspended. | SQL references and revocation semantics match local assumptions. |
| Grants | Authenticated has `SELECT` on assignments, profiles, riders, and `storage.objects`; RLS enabled on each. Anonymous has assignment and Storage object table-level SELECT but no matching target policy. | Grants alone are not row access. Check both grants and policies after deployment. |
| Role fields | Authenticated has no table-wide `UPDATE` on profiles or riders. The inspected column grants permit profile `contact_number` updates only; `profiles.role`, `profiles.is_active`, and `riders.approval_status` are not client-updatable. | The new predicate uses server-controlled state in this inspected direct-grant path. |
| Assigned-order policy | `orders.rider_select_assigned_orders` still checks an active Rider profile and assignment ownership, without a direct approval check. | Local HTTP test passed with the new assignment policy; hosted end-to-end effect remains unverified. |

Catalog fingerprints for a fresh comparison (MD5 of PostgreSQL's `pg_policies.qual`, **not** a migration-file hash): assignment old `226224fad5f07bbdb74d1e8a20cc0df8`; proof old `b5088a344d716a67ad83e91573184d64`; assigned-order `d4c67ca997f5d9e2d95cf277686373ca`; proof-upload `with_check` `3ff4c84d3acd1447af24954329c19777`. These values are drift alarms, not substitutes for inspecting the definitions. Hosted ledger columns are `version text` (required), `statements text[]`, `name text`, `created_by text`, `idempotency_key text`, and `rollback text[]`. The connected reader is `postgres` and reports ledger `USAGE`/`INSERT`/`DELETE`; the future direct deployment connection has **not** been verified. Authenticated schema usage for `public` and `storage` is present.

## Exact single-file execution plan — for a later authorized window

**Gate 1: disposable rehearsal and recovery.** Restore local Docker or use another disposable database matching the two old policies. Run the SQL regression by injecting the exact migration at its marker inside its rollback transaction, then run the existing genuine local HTTP script. Rehearse the atomic wrapper below and its rollback on that disposable database, including the ledger version. If the migration hash, old-policy fingerprints, ledger absence, privileges, or postflight checks differ, stop and review drift. Do not “repair” the hosted ledger by guesswork. The installed Supabase CLI is v2.33.9; its `db push` supports `--dry-run` but does not select one migration file from this divergent directory. The connected `apply_migration` tool chooses its own version and cannot promise `20261026144235`. Neither is the execution path here.

**Gate 2: read-only hosted preflight immediately before execution.** Run the following as separate queries through the connected Supabase SQL reader; save the output securely with the change record. `pg_policies` is the captured prechange definition for rollback. Check exactly one expected policy per target, the fingerprints above, private bucket, grants/RLS, and target version absence. Also check the actual deployment login can create/drop policies and insert/delete the migration row. Never print or save a database password in the report.

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname='public' and tablename='delivery_assignments')
   or (schemaname='storage' and tablename='objects')
order by schemaname, tablename, policyname;

select version, name from supabase_migrations.schema_migrations
where version='20261026144235' or version>='20261023000000'
order by version;

select n.nspname, c.relname, c.relrowsecurity,
       has_table_privilege('anon',c.oid,'SELECT') anon_select,
       has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname in ('delivery_assignments','profiles','riders','orders'))
   or (n.nspname='storage' and c.relname='objects');

select id, public from storage.buckets where id='delivery-proofs';
```

**Gate 3: atomic execution, exact version.** The read-only local generator `scripts/fixtures/prepare-track-b-rider-deployment.ps1` checks the migration SHA-256 and emits `track-b-apply.sql` and `track-b-rollback.sql` into a new directory. It never connects to a database. Its generation was run successfully today; SQL execution was not. Obtain a trusted `psql` executable and a direct **project `zhzluhqvysvsadwuugpa`** Postgres connection through the approved secret channel. Do not use a service-role HTTP key as a DB password. In a PowerShell session, after the disposable rehearsal and same-day preflight, use this exact command sequence with an approved `PG*` connection environment (for example `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE`) configured privately:

```powershell
$bundle = Join-Path $env:TEMP ('track-b-' + [guid]::NewGuid().ToString('N'))
& 'C:\Users\Janmari\Downloads\Capstone Project\scripts\fixtures\prepare-track-b-rider-deployment.ps1' -OutputDirectory $bundle
Get-Content -LiteralPath (Join-Path $bundle 'track-b-apply.sql')
Get-Content -LiteralPath (Join-Path $bundle 'track-b-rollback.sql')
# Stop here for final review and authorization. During the approved window only:
if ($env:PGHOST -ne 'db.zhzluhqvysvsadwuugpa.supabase.co' -or
    $env:PGDATABASE -ne 'postgres' -or $env:PGUSER -ne 'postgres' -or
    $env:PGSSLMODE -ne 'require') { throw 'Direct hosted connection settings differ from the reviewed target.' }
psql -X -v ON_ERROR_STOP=1 -f (Join-Path $bundle 'track-b-apply.sql')
```

The apply file begins a transaction, aborts on old-policy/ledger/bucket/RLS drift, applies the **verbatim target file**, inserts exactly `version='20261026144235'` with one safely SQL-quoted `statements` element and the target name, verifies new policies and the unchanged upload policy, then commits. No CLI `db push`, seed, roles, or other migration files are involved. The generator ran locally today, and a check confirmed that the apply file contains the verbatim migration and no unsubstituted marker; `psql` is absent on the present PATH, so SQL execution and the direct connection still require disposable rehearsal and final review. Keep the generated bundle restricted because it is the change record, though it contains no credentials.

**Gate 4: read-only postflight and HTTP smoke.** Re-run the catalog query above. Require only version `20261026144235` added, with the expected name and one `statements` element matching the reviewed file, both new policies and RLS/grants intact, the upload and other Storage policies unchanged, and private bucket unchanged. A designated existing approved Rider with an existing assignment/proof should receive one own assignment and exact private-proof bytes via a genuine hosted GoTrue token; unrelated and anonymous identities should see zero assignment rows and fail private download. A designated already suspended/inactive former Rider with a pre-existing completed assignment and valid session should see zero rows and fail download. Arrange these identities through a separately approved test plan; **do not create or modify hosted business data under this preparation request**. Check signed URL expiry separately if relevant: policy revocation may not invalidate a URL already issued. Use HTTP status **and row/byte assertions**, since RLS denials may be HTTP 200 with zero rows and Storage may return HTTP 400. Stop and diagnose any unexpected result before calling deployment accepted.

## Captured rollback target and trigger

The two prechange `USING` expressions, as read from hosted today, are:

```sql
-- public.delivery_assignments / rider_select_own_assignments
(rider_id = auth.uid())

-- storage.objects / rider_read_own_delivery_proof
((bucket_id = 'delivery-proofs'::text)
 AND (split_part(name, '/'::text, 1) = (auth.uid())::text)
 AND (EXISTS (SELECT 1 FROM public.delivery_assignments da
              WHERE da.id::text = split_part(storage.objects.name, '/'::text, 2)
                AND da.rider_id = auth.uid())))
```

If the apply transaction fails, PostgreSQL rolls it back; confirm the ledger is absent and old fingerprints remain. If it commits but acceptance fails, preserve the **immediate preflight capture**, inspect the failure, and review `track-b-rollback.sql` against that capture before running `psql -X -v ON_ERROR_STOP=1 -f (Join-Path $bundle 'track-b-rollback.sql')`. The rollback transaction asserts the target ledger row and two new policies, drops only those policies, recreates them as permissive `SELECT TO authenticated` with the captured old `USING` expressions, deletes only the target ledger row, verifies old fingerprints and version absence, then commits. Re-run the hosted catalog and HTTP checks. This rollback restores the known confidentiality gap, so restrict access or pause affected proof delivery while diagnosing. Never restore from a policy capture if another change occurred after preflight. No full database restore is claimed.

The project is understood to be on Supabase Free: [Supabase's backup guide](https://supabase.com/docs/guides/platform/backups) reserves managed daily backups for Pro/Team/Enterprise and advises Free projects to export data. No independent restore was verified for this project. This change is policy-only, and transactional rollback plus captured definitions are the scoped recovery path; they are **not** a substitute for a proven full restore.

## Acceptance and next authorization

**GO only after** a disposable execution/rollback rehearsal succeeds, the deployment connection and exact-version ledger write are verified, same-day hosted preflight matches all fingerprints and shows target absence, the project owner explicitly accepts the Free-plan recovery limit, and a hosted postflight HTTP actor plan is available. Any policy/ledger drift, hash mismatch, missing privileges, extra proposed migration, or missing rollback capture is **NO-GO**. After those gates, seek explicit authorization to execute **only** version `20261026144235` on `zhzluhqvysvsadwuugpa`; this report does not authorize or perform that write.
