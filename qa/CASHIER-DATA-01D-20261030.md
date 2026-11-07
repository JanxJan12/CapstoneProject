# CASHIER-DATA-01D — bounded hosted history RPC deployment

**Date:** 30 October 2026, Asia/Manila. **Project:** `zhzluhqvysvsadwuugpa` (`RRJS-Foodhouse-Final`). **Authorized scope:** only `supabase/migrations/20261030034730_cashier_owned_transaction_history_read.sql`. No app/UI, other schema, or business-record change is authorized.

## Preflight gate — PASS before deployment

- Reviewed DATA-01B and DATA-01C, the exact 70-line SQL file, and its full untracked-file Git diff. Its SHA-256 is `6F28DA33590DAC3E82A08BE4A4ED59B3F2995E4D3A09518C7BFBE3505B4B702D`, matching DATA-01C. The migration file is untracked in the already dirty canonical repo; no unrelated change was staged or reset.
- SQL checks active `auth.uid()` against an active Cashier profile; both `tx.cashier_id` and `s.cashier_id` must equal that UID. It rejects `NULL` limit/offset and values outside limit 1–100 and offset 0–10,000 with `22023`. The page and JSON aggregation order are `created_at DESC, id DESC`.
- Hosted project was active/healthy on PostgreSQL 17.6. Target function and version `20261030034730` were absent. `auth.uid()` exists. All referenced columns/types, enum values, five tables, and five expected foreign keys matched. Existing sale/current-shift functions were present. Tables and existing RPCs are owned by `postgres`; the migration mechanism must produce a function owner with SELECT on the joined tables.
- Read-only hosted counts: 42 transactions, six shifts, one cashier with transactions. Consequently hosted data cannot prove Cashier A/B isolation without separate authenticated accounts or fixtures. Existing security/performance advisor findings were inspected; the cashier transaction foreign key lacks a covering index. An index is outside this authorization and the small current row count does not block this function-only deployment.
- Hosted and local migration histories diverge. An unscoped `supabase db push` would be unsafe. Use the Supabase migration API with only the exact reviewed SQL text and record the returned migration version. No other pending migration may run.

## Safe rollback plan prepared before deployment

If acceptance finds a defect, first revert/disable the frontend path that depends on this RPC. Confirm no new dependent object was added, then apply a **separate, reviewed forward rollback migration** containing only `drop function public.get_cashier_transaction_history(integer, integer, jsonb);`. Verify the function is absent, its execute grants are gone, prior RPC definitions are intact, and the rollback migration is recorded. Do not reset the production database or delete migration history. This rollback plan changes no business rows. If a dependency appears, stop and review it before dropping anything.

## Deployment and verification

**Deployment COMPLETE; authenticated browser acceptance PARTIAL/NOT RUN.** Supabase `apply_migration` accepted only the reviewed SQL, under migration name `cashier_owned_transaction_history_read_20261030034730`. The hosted migration-history version is **`20261030042437`**. This is the server-assigned version; the reviewed local file remains `20261030034730_cashier_owned_transaction_history_read.sql`, SHA-256 `6F28DA33590DAC3E82A08BE4A4ED59B3F2995E4D3A09518C7BFBE3505B4B702D`. No broad migration push was used.

Post-apply catalog inspection found the exact function signature `public.get_cashier_transaction_history(integer,integer,jsonb)`, owner `postgres`, `SECURITY DEFINER`, `search_path = ''`, the reviewed body including the explicit null guard, both ownership predicates, and `created_at DESC, id DESC` pagination. The ACL is `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`. `has_function_privilege` reports `anon=false`, `PUBLIC=false`, `authenticated=true`, and `service_role=true`. `get_cashier_sale(uuid)` and `get_current_shift_cashier_sales()` remain present. Read-only counts stayed at 42 transactions and six shifts before and after deployment.

### Hosted read-only permission probes

These probes used database transactions with `READ ONLY`, `SET LOCAL ROLE`, a simulated `request.jwt.claim.sub`, and `ROLLBACK`. They exercised the deployed function without changing business rows. **They are simulated database claims, not authenticated user sessions or browser acceptance.**

| Probe | Hosted result |
| --- | --- |
| Simulated active Cashier, limit 100 / offset 0 | 42 returned, total 42; limit 1 returned one; offset 41 returned one; offset 100 returned none. Current hosted data cannot exercise a 100-row page. |
| Deterministic sort | All 42 returned rows satisfied `created_at DESC, id DESC`. |
| Closed-shift filter | 15 rows returned from a closed shift. The function does not require an open shift, although this probe did not prove the absence of an open shift for the account. |
| `NULL` limit and offset; limit 101 and offset 10,001 | Each direct call rejected with SQLSTATE `22023`. DATA-01C disposable PostgreSQL 17 separately proved a 100-row ceiling with 107 fixture rows and all invalid-input bounds. |
| Authenticated role with a UID lacking a profile | Rejected with SQLSTATE `42501` (`Active Cashier access required`). |
| `anon` role | Rejected with SQLSTATE `42501` (`permission denied for function`). |

**NOT RUN:** real signed-in Cashier A/B isolation (hosted has only one Cashier profile), inactive Cashier session, authenticated History screen/filter/count parity, CSV download, receipt detail/reprint, and physical or PDF print. No second account or production fixture was created. Browser access was not established in this deployment task. Production timing at higher row volume remains untested; no index was added.

The existing DATA-01C local disposable tests, focused source checks, typecheck, and build passed before deployment. They are evidence for the reviewed SQL and local app behavior, not a new hosted browser run. The Supabase security and performance advisors were inspected before apply; pre-existing unrelated findings were left untouched under this bounded authorization.
