# Track A legacy access: focused deployment readiness review

**26 October 2026 (Asia/Manila). Decision: conditional GO for this one access migration, NO-GO for an unscoped `supabase db push`. No deployment was performed.** The conditions are the exact preflight, a deployment mechanism that records the intended migration version without running other files, and immediate postflight checks below. If any condition fails, stop before applying SQL. This is an assessment of a narrow, reversible access change, not a declaration that disaster recovery or the full migration chain is ready.

## Scope and evidence

- Reviewed `supabase/migrations/20261026132319_track_a_retire_production_replenishment_access.sql` (73 lines), `qa/TRACK-A-LEGACY-BACKEND-CONSOLIDATION-20261026.md`, the Phase 7B and formal Requests/Receiving migrations, and current Manager callers. The repository has extensive unrelated pre-existing modified and untracked files; they were left alone.
- Used read-only Supabase catalog SQL against project `zhzluhqvysvsadwuugpa` at **2026-10-26 13:42 UTC / 21:42 PHT**, plus `list_migrations`. No hosted function was executed with a business identity and no hosted schema, data, grants, or ledger was changed.
- The earlier local report records direct application twice in a disposable 54-entry fixture and 24 checks with real **local** GoTrue sessions. Its JSON records Manager legacy/formal Receiving, accepted-only stock/batch/ledger increments, and duplicate-post rejection. These are local test claims, not hosted acceptance.

## Exact contract and security assessment

| Object | Current hosted catalog | Migration effect / review |
| --- | --- | --- |
| `public.advance_replenishment_request(uuid,text,text)` | `postgres` owned, `plpgsql`, volatile, `SECURITY DEFINER`, `search_path=public, extensions, pg_temp`. Effective `EXECUTE`: anon **no**, authenticated **yes**, service_role **yes**. Body requires an active Production profile. | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`; leaves the function and service grant. An authenticated former Production account loses the transition API even if its profile remains active. |
| `public.get_replenishment_requests()` | `postgres` owned, `plpgsql`, stable, `jsonb`, `SECURITY DEFINER`, same fixed search path. Effective `EXECUTE`: anon **no**, authenticated **yes**, service_role **yes**. Body currently accepts active Manager **or** Production. | `CREATE OR REPLACE` changes only that predicate and error text to require an active Manager. The JSON keys, joins, ordering, event array, return type, volatility, and search path match the hosted body reviewed today. The subsequent revoke/grant retains authenticated and service access, with no PUBLIC/anon execute. The function owner should stay `postgres` when replaced by the owner; confirm this after deployment. |
| `public.start_replenishment_receiving(uuid)` | `postgres` owned `SECURITY DEFINER`; authenticated/service execute, anon no. Body requires active Manager and a request at `ready_for_delivery` unless a linked report already exists. | Unchanged. Manager can still open an already ready historical request and see existing linked reports. Revoking transitions intentionally means no client can advance a newly created legacy request to ready. |
| `public.create_replenishment_request(uuid,uuid,numeric,timestamptz,text,text)` | Authenticated/anon execute **no**; service execute **yes**; active Manager predicate in body. | Unchanged. The client wrapper was removed separately. |
| `public.post_receiving_report(uuid)` and `public.get_inventory_request_proposal(timestamptz)` | Authenticated/service execute, anon no. Posting requires active Manager, validates draft/lines, and credits accepted amounts; proposal includes legacy outstanding quantity. | Neither function is changed. Formal Requests and shared posting remain available. |

The two legacy tables and both Receiving tables have RLS enabled and **no authenticated SELECT/INSERT/UPDATE/DELETE table grant**. `anon` and `authenticated` also lack CREATE on `public` and `extensions`; this limits search-path object spoofing in these existing definer functions. The replacement uses schema-qualified relation and `auth.uid()` references. `SECURITY DEFINER` remains necessary for these protected reads, so the internal active-profile predicate and execute ACL are both material. The migration is enclosed in `BEGIN`/`COMMIT`: a SQL error should roll its changes back as one transaction. `CREATE OR REPLACE` retains the existing function identity and grants unless explicitly changed; this migration explicitly reasserts the read grants.

**Narrow review caveat:** the migration's DO guard checks signatures and only whether the read body contains a Manager or Manager/Production predicate. It does **not** prove the remainder of the hosted body is unchanged. Today's complete hosted definition matched the intended retained projection/joins, but a later edit could be overwritten. Treat a fresh, line-by-line definition and ACL comparison as a hard preflight gate. No SQL correction is required for the catalog observed today; editing the migration solely to duplicate this operational comparison would invalidate the already tested local artifact.

## Historical Receiving and ledger implications

Hosted FKs still connect the legacy request to its events and `receiving_reports.replenishment_request_id`; the request also points to its fulfilled report. The `receiving_link_guard`, `receiving_linked_line_guard`, `receiving_closes_replenishment`, formal request guards/reconciliation, and shared posting function remain installed. `ReplenishmentPage` still calls the legacy read/start RPCs; `StockReceivingPage` reads the legacy record for a linked receipt. None of these objects is dropped or replaced by this migration. Hosted counts at inspection: **0** legacy requests, **0** legacy events, **0** legacy linked reports, **4** formal documents, **3** formal linked reports. The zero legacy count does not prove historical compatibility in production; the disposable local fixture supplies that narrower test.

The hosted ledger contains Phase 7B `20261007082647` and formal Requests `20261012181744`, but no `20261026132319` entry. Several other hosted migration versions differ from local filenames: for example local `20261019095803` ledger audits is hosted as `20261019103144`, and local `20261023113221` Receiving inspector is hosted as `20261023182339`. The inspected **live catalog** satisfies this migration's dependencies, so the SQL is independently applicable. A normal `db push` may compare every local filename to the hosted ledger and try to replay unrelated migrations or fail. Do not use it for this bounded deployment. Do not repair/replay historical entries as part of Track A. A targeted deployment must verify its own version-recording behavior in advance and confirm exactly one new `20261026132319` ledger entry afterward; if the available tool generates a different version or cannot provide this assurance, stop and choose a controlled, separately reviewed migration mechanism.

Unresolved disaster recovery remains a project-level concern. This change performs no business-row mutation and has an explicit function/ACL reversal path, so it does not by itself require replaying old migrations. A prior hosted definition/ACL capture is still mandatory before the change. A database recovery plan remains unverified; this GO does not cover a broader release or physical database loss.

## Exact preflight (read-only; stop on any mismatch)

1. Confirm the target project ID is `zhzluhqvysvsadwuugpa`, the intended file is exactly `20261026132319_track_a_retire_production_replenishment_access.sql`, and no other migration is queued by the chosen deployment mechanism. Its reviewed SHA-256 is `3CEB555E757B64F2A26CBF5ED7E88B9BE5865DEAE6F6209205DD96A2B10DBCD0`; require that same hash at execution and record reviewer/deployment time. Freeze competing schema work for this short operation.
2. Capture the full outputs of the following catalog queries in a private deployment record. Keep the **complete** `pg_get_functiondef` output for both changed functions as the rollback source; do not store account credentials. Compare the read function's entire returned fields, joins, sort, predicate and error with the file, not merely the guard substring. Confirm signatures, owner `postgres`, `prosecdef=true`, and expected `proconfig`; confirm ACL and effective permissions match the table above. Any drift is a NO-GO pending renewed review.

   ```sql
   select p.oid::regprocedure::text as signature, pg_get_userbyid(p.proowner) as owner,
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

   select version,name from supabase_migrations.schema_migrations
   where version in ('20261007082647','20261012181744','20261026132319')
   order by version;

   select c.relname, c.relrowsecurity, c.relacl,
          has_table_privilege('authenticated',c.oid,'SELECT') as auth_select,
          has_table_privilege('authenticated',c.oid,'INSERT') as auth_insert,
          has_table_privilege('authenticated',c.oid,'UPDATE') as auth_update,
          has_table_privilege('authenticated',c.oid,'DELETE') as auth_delete
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in
     ('production_replenishment_requests','production_replenishment_status_events',
      'receiving_reports','receiving_report_items') and c.relkind='r'
   order by c.relname;

   select tgname, tgrelid::regclass::text as table_name, pg_get_triggerdef(oid)
   from pg_trigger where not tgisinternal and tgname in
     ('receiving_link_guard','receiving_linked_line_guard',
      'receiving_closes_replenishment','receiving_inventory_request_guard',
      'receiving_reconciles_inventory_request')
   order by tgname;

   select (select count(*) from public.production_replenishment_requests) as legacy_requests,
          (select count(*) from public.receiving_reports
           where replenishment_request_id is not null) as legacy_linked_reports,
          (select count(*) from public.inventory_request_documents) as formal_requests,
          (select count(*) from public.receiving_reports
           where inventory_request_id is not null) as formal_linked_reports;
   ```

3. Confirm `20261026132319` is absent, Phase 7B/formal dependencies are present in the **catalog**, authenticated still lacks direct legacy-table DML, the two legacy tables still have RLS, and Receiving link/close triggers remain installed. Recheck legacy request and linked-report counts; if new requests exist, inventory their statuses and identify any active users still relying on obsolete transitions before restricting access. Do not use this check to mutate records.
4. Confirm the deployment operator can replace the `postgres` owned function without changing ownership, and that the chosen single-migration mechanism will record **only** version `20261026132319`. Hold the captured prior definition and ACL where the operator can retrieve them for rollback. The old function body is security sensitive: access to the record should be limited.

## Exact postflight (read-only unless a separately authorized smoke test is scheduled)

1. Confirm execution returned success for the **single** transaction and the ledger gained exactly one `20261026132319` entry, with no unexpected version. Re-run the preflight catalog query: `advance_replenishment_request` effective execute must be **false/false/true** for anon/authenticated/service; `get_replenishment_requests` must be **false/true/true**, still `postgres` owned, `SECURITY DEFINER`, stable `jsonb`, and fixed search path. Its authorization predicate must be `p.role::text = 'manager' and p.is_active`; all projection/joins/order must remain as reviewed. Check that start/create/post/proposal definitions and grants did not change.
2. Verify the legacy tables, Receiving FKs/triggers, RLS and counts are unchanged. Recheck the hosted formal document and linked-report counts for unexpected movement. These checks detect drift; they do not prove runtime behavior.
3. If separately authorized with real test identities, verify active Manager read succeeds, active former Production and Customer reads fail with `42501`, anon cannot execute, authenticated Production cannot advance, and Manager can still view an existing historical linked receipt. Do **not** create or post business test records as part of this review. Without those identities, record hosted runtime acceptance as **untested**.
4. Observe Manager Requests and Receiving errors after application, and retain the captured before/after catalog and ledger outputs with the deployment record. If a gate fails, halt further rollout and apply the reversal below.

## Safe rollback

Before any deployment, save the exact hosted `pg_get_functiondef('public.get_replenishment_requests()'::regprocedure)` and ACL/effective privilege output. If rollback is needed, use one transaction under the original owner or an appropriately authorized operator: run that captured **pre-deployment** `CREATE OR REPLACE FUNCTION` definition verbatim; restore the previous `advance_replenishment_request(uuid,text,text)` execute ACL (`REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role`); and restore the read ACL (`REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role`). Verify owner, security mode, function text and all three effective permissions after commit. The captured definition is preferable to reconstructing it from an old migration because it preserves any legitimate hosted changes discovered at preflight. This rollback intentionally reopens the previous Production transition capability; use it only to restore a failed deployment, and restrict former Production accounts operationally if needed.

Migration-history reversal is a **separate metadata action**: first establish whether the targeted tool recorded the version and whether the SQL rollback completed; only then have the operator correct that single ledger entry through a reviewed migration-history process. Never delete or mark arbitrary historical versions, and never run the old Phase 7B migration to reverse this change. If a failure occurred before commit, check the actual function/ACL state and ledger before attempting any reversal; PostgreSQL should already have rolled the transaction back.

## Limits and sources

No hosted authenticated role test, historical row journey, actual deployment, or disaster-recovery restore was run. This review cannot establish privileged external clients beyond the catalog and repository search. The local result and the current hosted shape together support the scoped decision, subject to a fresh preflight at execution time.

Relevant current Supabase guidance: [Database functions and function privileges](https://supabase.com/docs/guides/database/functions); [database migration history and `db push` behavior](https://supabase.com/docs/guides/deployment/database-migrations). The October 2026 changelog's imminent Data API table-exposure change does not alter this review's existing-function grants or existing-table access model.
