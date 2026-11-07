# Manager Inventory Requests live RPC investigation — 2026-10-13

## Outcome

**BLOCKED; live error not fixed.** No hosted SQL change, PostgREST reload, business-data mutation, frontend edit, or deployment was performed. Follow-up read-only inspection found no listed physical backups and no enabled point-in-time recovery (PITR). The project's development/staging/production role remains unconfirmed. The requested stop condition applies before a hosted schema change.

## Linked target and verified cause

- The running Vite listener on localhost:5173 is the canonical `Capstone Project` checkout (node process 28116). Its `.env.local` contains the API host `zhzluhqvysvsadwuugpa.supabase.co`; no key or password was copied into this report. The connected Supabase app lists the matching active project as `RRJS-Foodhouse-Final`, reference `zhzl…ugpa`, region `ap-southeast-1`. The local `supabase/config.toml` project ID is a local CLI label, not the hosted reference.
- Live `pg_proc` has **no** `public.get_inventory_request_register()`, `get_inventory_request_proposal(timestamptz)`, `issue_inventory_request(...)`, `revise_inventory_request(...)`, or `start_inventory_request_receiving(...)`. The four request-document tables, linked Receiving columns, and request triggers are also absent. This is a missing backend deployment, not just stale PostgREST cache.
- Migration history ends with `20261007082647_phase_7b_production_replenishment_requests`; it does not include `20261011120154_manager_inventory_request_documents.sql`. The local candidate's SHA-256 is `FEC604AA63AC3B2B55703118DFAC8858E921BC7AB1673872D15CBC4F446DE969`.
- Existing `post_receiving_report(uuid)`, `get_manager_receiving_workspace(uuid DEFAULT NULL)`, and `inventory_usable_quantity(uuid)` are present. `post_receiving_report` and the workspace RPC grant execution to `authenticated` and deny `anon`; the stock helper is not client-executable. All six inspected legacy tables have RLS enabled. Existing Phase 7B Receiving guards act only when `replenishment_request_id` is present, so their definitions show no direct conflict with a separate `inventory_request_id` link. This is a static compatibility review, not a hosted transaction test.
- Hosted counts at inspection: zero Receiving reports, zero legacy replenishment requests, 16 active inventory items, one active Manager. All 16 active items have threshold, unit, and precision; four have a positive current reorder gap and four use expiry-sensitive batch quantities. Actual future-needed-time proposals may differ due to expiry. No stock or item identity was fabricated.

## Follow-up read-only inspection: actual use and recovery

- The connected project belongs to an organization on the **Free** plan. The canonical Supabase CLI is linked to the same project reference. `supabase backups list --project-ref zhzluhqvysvsadwuugpa --output json` returned `backups: []`, `physical_backup_data: {}`, and `pitr_enabled: false`. It also returned `walg_enabled: true`; that flag alone does **not** establish an available restore point.
- This is an in-use hosted database, although whether the organization calls it production, staging, or development is unknown. Read-only aggregate counts: 8 Auth users, 8 profiles, 45 orders, 41 inventory movements, 30 Storage objects, zero inventory batches, zero Receiving reports, and zero legacy replenishment requests. The latest Auth sign-in was 2026-10-12 02:18 Manila time; latest order and inventory movement were 2026-09-15 09:35 and 09:41 Manila time. Nine orders and ten movements fall within the queried last-30-days window. No customer rows, object contents, or credentials were exported.
- A fresh `pg_proc` search found existing Phase 7B `create_replenishment_request`, `advance_replenishment_request`, `get_replenishment_requests`, `start_replenishment_receiving`, and the Receiving draft/read/post functions. The new multi-item document RPCs remain absent. Existing user-facing request/Receiving functions execute for `authenticated` and not `anon`; internal guards are not client-executable, apart from two older shelf-life trigger helpers whose broader ACL is outside this targeted fix.
- A fresh migration-history query again ends at `20261007082647`; the candidate `20261011120154` remains unapplied.
- Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) says automatic daily backups are provided for Pro, Team, and Enterprise projects and recommends regular off-site CLI exports for Free projects. A CLI `db dump` is a possible **future** logical database backup, but none was made in this read-only inspection. It would need an access-safe destination, completeness check, and restore rehearsal before being treated as a proven recovery path. Database backups do not restore Storage object bytes.

## Snapshot and recovery scope

Read-only catalog snapshot: [MAIN-REQUEST-LIVE-SCHEMA-SNAPSHOT-20261013.json](./MAIN-REQUEST-LIVE-SCHEMA-SNAPSHOT-20261013.json), SHA-256 `9466E5507B12F930DA32575DF2FBD7E1EEBCDFFD5E2E121993AB1038901AFDF0`. It records exact definitions/ACLs of six relevant existing functions plus existing table columns, constraints, triggers, policies, and RLS state. It contains no client rows or credentials. It is a schema/function snapshot, **not a database backup**.

The candidate migration is transaction-wrapped, so a SQL error before commit should roll back its DDL. A post-commit reversal would require checking for newly issued requests and linked receipts first, then removing only the new request triggers, functions, indexes, tables, sequence, and Receiving columns in dependency order; it must preserve `post_receiving_report`, Phase 7B functions, legacy Receiving rows, and stock ledger. Once real requests exist, dropping those objects would destroy business history and is not an acceptable recovery method. The CLI currently lists no physical backup or PITR, so this is only a recovery *plan*, not an established recovery path.

## Verification state

| Check | Result |
| --- | --- |
| Project match between canonical frontend config and connected Supabase project | **PASS** |
| Current hosted data/activity and project plan | **PASS: data and sign-in activity present; Free plan** |
| Listed physical backup / PITR | **FAIL: no listed backup; PITR disabled** |
| Exact live zero-argument register function and authorized Manager RPC | **FAIL: function absent** |
| Candidate prerequisites / legacy guard static inspection | **PARTIAL: prerequisites found; no live transactional proof** |
| PostgREST schema reload | **NOT RUN: absent function cannot be exposed by reload** |
| Authorized/unauthorized hosted RPC, localhost banner, prefill, issuance, linked Receiving | **NOT TESTED after fix: no SQL applied** |
| Source typecheck/build | **NOT RUN: no source changed** |

**Next one step:** Establish and verify a recoverable backup of this exact hosted project, including a restore rehearsal and separate coverage for Storage objects if full-project recovery is needed. Also confirm whether the project is production or non-production before any migration. No real request or stock posting is needed for the subsequent live check. Staging and production readiness remain separate decisions.
