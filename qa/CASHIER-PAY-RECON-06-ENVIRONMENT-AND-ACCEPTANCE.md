# CASHIER-PAY-RECON-06 — Environment recovery and payment acceptance

Date: 2026-11-03. Canonical hosted project `zhzluhqvysvsadwuugpa` was **not** changed.

## A. Executive summary

The original clean replay failed because the first repository migration expects the Supabase-managed `storage.objects` relation before it exists in the temporary local database. A bounded recovery attempt staged the untouched application migrations aside and started Supabase CLI to let the platform initialize first. That attempt also failed: the Storage service reported `relation "migrations" does not exist` and became unhealthy. The exact cause of that platform bootstrap failure is not established; it must not be treated as a payment-summary migration defect.

The RECON-04 function-level disposable database remains available. Its role and financial security tests passed again, as did focused frontend checks. A genuine authenticated Cashier browser acceptance could not run without an isolated Auth/API stack containing the new RPC. No payment implementation change is justified by the evidence.

**Deployment verdict: BLOCKED — SPECIFIC TECHNICAL OR SECURITY FAILURE.** The blocking dependency is a healthy isolated Supabase Storage/Auth/API initialization, followed by authenticated Orders table/drawer acceptance.

## B. Environment and cause

- Repository has 82 ordered migrations. The first, `20260825183637_remote_schema.sql`, is a remote schema export containing policies for Supabase-managed Storage objects, plus references to Auth and other platform facilities. It is intended to run in a Supabase-compatible database with those facilities present. Supabase [documents Storage as a managed schema and supports custom policies on `storage.objects`](https://supabase.com/docs/guides/local-development/cli-workflows).
- RECON-05 used `supabase start` in a temporary project copy. The CLI initialized the database and applied repository migration 1 before Storage had made `storage.objects` available. The exact first error was SQLSTATE `42P01` at statement 490, `CREATE POLICY customer_read_own_payment_proof ON storage.objects`.
- This milestone reused `C:\Users\Janmari\AppData\Local\Temp\rrj-pay-recon05-20261103`. Docker Engine 29.9.2, Supabase CLI 2.33.9, and PostgreSQL 17 image were available. The existing unrelated `rrj_current_contract_integration_2026102` stack remained running. About 95.8 GB free disk and 8.2 GB Docker memory were reported; ports 65320–65329 had no listening conflict in preflight.
- A second and final bounded startup used the same temporary project ID and ports, with all 82 repository migrations moved **within the temporary copy** to `migrations_staged`. This allowed the CLI to initialize its database without applying application migrations. Storage then failed its own startup with `Migration failed. Reason: relation "migrations" does not exist`; the Storage container became unhealthy and the CLI stopped the temporary stack. This is a missing **platform-managed Storage migration catalog** in that local initialization path, not a missing application payment table. The underlying image/init ordering cause is **unproven**.
- The 82 unchanged migration files were restored to the temporary copy. No repository migration, canonical Supabase config, non-disposable container, or hosted project was altered. The stopped temporary Storage container/volume was left untouched; no broad Docker cleanup ran.
- The supported intended method is a healthy Supabase CLI local stack followed by ordered application migration replay. The [official workflow](https://supabase.com/docs/guides/local-development/cli-workflows) says `supabase start` applies migrations and `db reset` rebuilds the local database from them. It does not support replacing missing platform tables with handwritten stand-ins. Supabase [identifies `storage.migrations` as a service-owned platform object](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025). A local Auth, Storage, and PostgREST stack is required for browser acceptance.

## C. Migration results

| Evidence tier | Result | Exact coverage |
| --- | --- | --- |
| Full historical replay | **FAIL / BLOCKED** | First of 82 migrations failed in RECON-05 on missing `storage.objects`; RECON-06 platform-first attempt failed before application replay because Storage lacked `migrations`. No later migration was skipped or marked applied. |
| Focused current-schema compatibility | **PASS in isolated clone** | RECON-04 applied `20261102193437_cashier_owned_order_payment_summaries.sql` to empty `rrj_cashier_pay_recon04_20261103`, cloned from the existing post-simplification integration schema. The function resolved real Orders, Payments, Cashier transactions, Profiles, enums, and `auth.uid()`. This is not a full migration-chain PASS or hosted schema attestation. |
| Payment-summary function | **PASS in isolated clone; NOT REACHED in clean replay** | `p_order_ids uuid[]` returns `order_id uuid`, `payment_method public.payment_method`, `payment_status public.payment_status`. The migration creates a read-only `STABLE SECURITY DEFINER` function with empty search path and bounded 1–100 IDs. |
| Privileges | **PASS in isolated clone** | `anon` and PUBLIC EXECUTE denied; `authenticated` EXECUTE allowed. Existing Payments RLS remained enabled and the fixture's direct authenticated Payments SELECT returned zero of eight inserted rows. No new general Payments SELECT grant was introduced. |
| Existing financial RPC signatures | **NOT VERIFIED in full replay** | The clean sequence did not reach the payment migration. The pending migration text changes no other RPC. |

The earlier integration-schema clone is a viable **focused** compatibility environment because it has the relevant actual table constraints and platform relations. It is not proof that all 82 migrations replay or that the canonical hosted schema is identical.

## D. Security results

`qa/cashier-pay-recon-04-disposable.sql` was rerun against the isolated RECON-04 database using `SET LOCAL ROLE authenticated`/`anon` and synthetic `request.jwt.claim.sub` values. It exited 0 and rolled back all fixtures. Cashier A received verified Cash for an owned closed-shift and an owned open-shift sale; Cashier B received only B's own sale. Manager, anonymous, and missing-subject calls were denied. Mixed IDs, forged cashier identifier, empty/null/malformed/oversized inputs, mismatched amount, and contradictory status behaved conservatively. The function did not expose another Cashier's financial row. These are database role-context tests, **not** signed JWT or browser evidence.

No frontend service-role credential was added or used. No Auth, RLS, or payment-table privilege was weakened.

## E. Authenticated browser acceptance

| Required observation | Result |
| --- | --- |
| Genuine local Supabase Cashier session | **NOT VERIFIED**; temporary Auth/API stack did not become healthy |
| Frontend call to new payment-summary RPC | **NOT RUN** |
| Historical closed-shift Cash: Orders table and drawer | **NOT VERIFIED** in rendered UI |
| Recent verified Cash: Orders table and drawer | **NOT VERIFIED** in rendered UI |
| Pending online GCash remains Pending | **NOT VERIFIED** in rendered UI |
| Unresolved/conflicting order stays non-Verified | **NOT VERIFIED** in rendered UI |
| Second Cashier denied restricted historical details | **NOT VERIFIED** through real Auth/PostgREST/UI |
| Search, pagination, loading, failed-RPC state, network batching, console | **NOT VERIFIED** in browser |
| Screenshots / network captures | **None**; no authenticated browser session was opened |

The existing integration API stack has unrelated records and Auth users but lacks the new RPC; it was inspected read-only and was not used as a substitute. The RECON-04 clone has the RPC but no matching Auth/PostgREST service. No hosted backend was used for testing.

## F. Regression checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `node --experimental-strip-types qa/cashier-pay-recon-03.mjs` | PASS |
| `node scripts/verify-cashier-order-list.mjs` | PASS |
| Existing RECON-04 disposable SQL security/financial fixture | PASS, rolled back |
| Focused `git diff --check` | PASS; only pre-existing line-ending warnings |

Source and focused tests still show bounded 100-ID batching and conservative unresolved status handling. Runtime request counts, stale-response behavior, rendered badges, and drawer consistency remain unverified in this milestone.

## G. Changed files

- Added `qa/CASHIER-PAY-RECON-06-ENVIRONMENT-AND-ACCEPTANCE.md` (this report).

No application code, financial logic, migration, Auth policy, or canonical Supabase configuration was edited. The temporary project copy outside the repository had its migration directory staged and restored. All unrelated dirty-worktree changes were preserved.

## H. Remaining blockers

1. Restore a healthy **isolated** Supabase Storage initialization using supported local tooling, where both `storage.migrations` and `storage.objects` exist before the first repository migration is applied. The current CLI 2.33.9 startup path failed even with application migrations staged aside. Diagnose that specific platform bootstrap/version interaction; do not create fake tables or replay migrations out of order.
2. On that healthy isolated stack, run the 82-file sequence and then one real authenticated Cashier Orders table/drawer acceptance pass with synthetic records and bounded network evidence.

These are environment and acceptance dependencies. There is no confirmed payment-summary implementation defect from this run.

## I. Proposed production deployment (not executed)

After the blockers close, review the exact pending migration and hosted ledger, verify the function is unapplied, confirm recovery and rollback prerequisites, and obtain separate hosted authorization. Apply only `20261102193437_cashier_owned_order_payment_summaries.sql`; verify signature and EXECUTE grants; perform non-mutating authenticated Cashier ownership checks; compare the historical Orders table/drawer and pending online payment display. Stop rollout and use the reviewed frontend/function rollback only if authorization or financial consistency fails. No repository-wide `db push` is proposed.

## Final engineering verdict

**BLOCKED — SPECIFIC TECHNICAL OR SECURITY FAILURE**

The specific technical failure is local Supabase Storage bootstrap, which prevents clean migration replay and genuine authenticated UI acceptance. Focused payment-function tests pass, but they cannot close either missing gate. No production deployment or hosted write occurred.
