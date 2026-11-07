# CASHIER-PAY-RECON-04 — Isolated validation and deployment readiness

Date: 2026-11-03. Hosted deployment and hosted writes: **not performed**.

## A. Executive summary

The existing payment-summary migration applied successfully to a newly cloned, empty RRJ integration database. Synthetic role-context calls demonstrated owner-scoped historical and current Cash resolution, conservative handling of conflicting evidence, and denial of other Cashiers, Manager, and anonymous callers. Typecheck, build, and focused frontend scripts passed. No source defect was confirmed or repaired.

Deployment readiness remains blocked because this was a replay on a prior integration schema clone, not a clean replay of the repository's complete migration sequence. Signed-in browser comparison and actual JWT transport were not run. The isolated tests are meaningful, but they do not establish all mandatory gates for hosted rollout.

## B. Environment

- Docker Engine 29.9.2 was running. Supabase CLI 2.33.9 was available, but `supabase status` targeted a missing `supabase_db_Capstone_Project` container, so that command was not used for migration execution.
- Existing isolated stack: `supabase_db_rrj_current_contract_integration_2026102`, PostgreSQL 17.11. Source database: `rrj_simplification_final_20261101`, empty in Orders, Payments, Cashier transactions, and Profiles. The source had the relevant post-simplification columns and no payment-summary RPC.
- New disposable database: `rrj_cashier_pay_recon04_20261103`, created from that source using the local `supabase_admin` role. Existing integration databases were not modified.
- Authentication test method: SQL `SET LOCAL ROLE authenticated` or `anon` plus `request.jwt.claim.sub` using synthetic `auth.users`/`profiles`. The function executed as its `SECURITY DEFINER` owner. This tests database role and claim behavior, not JWT signing or PostgREST transport.
- Synthetic fixtures were inserted inside one transaction and rolled back. Counts after testing were zero for Orders, Payments, and Cashier transactions.

## C. Migration validation

| Check | Result | Evidence |
| --- | --- | --- |
| Pending migration applied | PASS | `psql -v ON_ERROR_STOP=1 -f /tmp/cashier_pay_recon04.sql`: `CREATE FUNCTION`, `REVOKE`, `GRANT` |
| Signature and references | PASS | `p_order_ids uuid[]`; returns `order_id uuid`, `payment_method public.payment_method`, `payment_status public.payment_status`; fixture calls resolved against actual tables/enums |
| Privileges | PASS | `has_function_privilege`: `anon=false`, `authenticated=true`, `public=false` |
| Direct payment access | PASS in this clone | `payments` RLS enabled; authenticated fixture `SELECT count(*)` returned 0 despite eight inserted payment rows. The migration adds no direct table grant or policy. |
| No business writes | PASS | Migration contains only function DDL and privilege statements; fixture transaction rolled back; post-test counts zero |
| Function-level rollback | PASS in transaction | `DROP FUNCTION public.get_cashier_order_payment_summaries(uuid[])` removed only the new function; Orders and Payments remained; `ROLLBACK` restored the function |
| Clean full migration-chain replay | NOT VERIFIED | The schema source has no `supabase_migrations.schema_migrations` ledger. This run cannot prove the complete ordered repository replay. |
| Unrelated RPC signature comparison | NOT VERIFIED | No before/after catalog snapshot of every unrelated RPC was taken; migration text contains no `ALTER` or `DROP` of another function. |

The function is `STABLE SECURITY DEFINER` with `search_path = ''`, schema-qualified relations, no dynamic SQL, and no data-writing statements. Its owner in the isolated clone is `supabase_admin`.

## D. Authorization matrix

`qa/cashier-pay-recon-04-disposable.sql` is the reproducible fixture/assertion script. `psql` completed with exit code 0 and rolled back.

| Identity / input | Expected | Actual | Result |
| --- | --- | --- | --- |
| Cashier A, own closed-shift order 001 | Cash, Verified | `cash / verified` | PASS |
| Cashier A, own open-shift order 002 | Cash, Verified | `cash / verified` | PASS |
| Cashier B, A's order 001 | No financial row | Only B's own order 003 returned | PASS |
| Cashier A, mixed own/B/unlinked/online IDs | Only owned Walk-in transactions | Rows 001, 002, 005, 006, 007; no B or online rows | PASS |
| Manager profile | Denied | SQLSTATE `42501` caught | PASS |
| `anon` role with forged Cashier subject | Denied | EXECUTE denied | PASS |
| `authenticated` role without subject | Denied | SQLSTATE `42501` caught | PASS |
| Forged `request.jwt.claim.cashier_id` | Cannot override subject ownership | B's order returned zero rows to A | PASS |
| 101-element batch | Rejected | SQLSTATE `22023` caught | PASS |
| Empty batch / null ID | Rejected | SQLSTATE `22023` caught for both | PASS |
| Malformed UUID / injection text | Rejected by typed argument | SQLSTATE `22P02` caught for `not-a-uuid`; no dynamic SQL in function | PASS for typed rejection |
| Duplicate ID in request | One deterministic row | Order 001 appeared once | PASS |
| Inactive Cashier profile | Denied | Not exercised with fixture | NOT VERIFIED |

The SQL subject is set by the test connection; actual JWT integrity and gateway enforcement remain outside this test.

## E. Financial correctness matrix

The SQL result is authoritative only for cashier-owned Walk-in transactions. Frontend mapping below is from `qa/cashier-pay-recon-03.mjs` synthetic tests, not a signed-in browser session.

| Scenario / evidence | Expected | Actual RPC | Frontend mapping | Result |
| --- | --- | --- | --- | --- |
| Closed-shift Cash, single verified payment, completed transaction, matching ₱120 | Cash · Verified | `cash / verified` | Cash · Verified | PASS isolated + mapping |
| Open-shift Cash, matching ₱45 | Cash · Verified | `cash / verified` | Cash · Verified | PASS isolated + mapping |
| Pending online GCash, no cashier transaction | Never Verified | No row | Existing Pending preserved in synthetic mapping | PASS isolated + mapping; online hydration runtime NOT VERIFIED |
| Rejected online GCash, no cashier transaction | Never Verified | No row | Existing Rejected preserved in synthetic mapping | PASS isolated + mapping; online hydration runtime NOT VERIFIED |
| Walk-in with no payment or transaction | Unknown/unresolved | No row | Unknown preserved | PASS isolated + mapping |
| Voided Cash payment and voided transaction | No clean Verified | `cash / voided` | Cash · Voided | PASS isolated + mapping |
| Reversed/"refunded" sale | Preserve recorded reversal | Represented by voided/voided fixture | Voided | PASS for voided reversal; no separate refunded enum exists |
| Payment amount ₱55 vs order total ₱60 | No Verified | Null method/status row | Unknown, uncertainty flag | PASS isolated + mapping |
| Verified payment with voided transaction | No Verified | Null method/status row | Unknown, uncertainty flag | PASS isolated + mapping |
| Duplicate payment/transaction records | Conservative | Not constructible with current unique constraints on `payments.order_id` and `cashier_transactions.order_id` | Parser rejects duplicate RPC rows | NOT VERIFIED as database fixture; constrained by schema |

## F. Frontend and regression validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `node --experimental-strip-types qa/cashier-pay-recon-03.mjs` | PASS: status mapping, malformed responses, 205-ID batches of 100/100/5, zero request for empty list, static SQL guards |
| `node scripts/verify-cashier-order-list.mjs` | PASS |
| `node scripts/verify-cashier-transaction-history.mjs` | PASS |
| `node qa/cashier-data-01-read-model.mjs` | PASS: historical read model, closed shifts, isolation, pagination/filter checks |
| Focused `git diff --check` | PASS; only line-ending warnings from pre-existing edited files |

Source inspection confirms a single batch sequence per Orders refresh, at most 100 IDs per RPC, no per-row request, and failure fallback that leaves the list usable with unresolved statuses. The batch response parser rejects unexpected IDs, duplicates, invalid enums, and partial method/status pairs. The drawer guard suppresses its single-sale Verified fallback when the batch explicitly marks contradictory owned evidence. Existing order-list filtering and pagination were not changed in this milestone. The broader store refresh generation guard was inspected in RECON-03 but was not exercised with a live race here.

Signed-in rendered Orders table/drawer comparison, network waterfall, stale-response race, and outage behavior were **NOT VERIFIED**. No local browser fixture was created for this validation; no hosted browser payment action was taken.

## G. Source modifications in this milestone

- `qa/cashier-pay-recon-04-disposable.sql` — new isolated, rolled-back synthetic role and financial assertion script.
- `qa/CASHIER-PAY-RECON-04-VALIDATION.md` — this report.

No RECON-03 migration or application source was changed during this milestone. The worktree had extensive pre-existing changes, which were preserved.

## H. Proposed deployment and rollback (not executed)

1. Review the exact pending migration and hash against the intended hosted version, plus the dirty migration ledger; establish recovery and a reviewed function-level rollback.
2. Replay the complete required migration sequence in a fresh disposable environment, then rerun the role and financial fixture. Resolve any schema drift before proceeding.
3. Obtain separate hosted deployment authorization. Apply **only** `20261102193437_cashier_owned_order_payment_summaries.sql`; do not run a repository-wide `db push`.
4. Read back the hosted function signature, owner/search path, and `EXECUTE` privileges. Confirm no new direct payment-table exposure.
5. Perform non-mutating authenticated Cashier A/B checks against authorized existing records, then compare the Orders table and drawer for a historical closed-shift sale. Do not verify, reject, release, or create an order as a test.
6. If access scope, payment status, or UI comparison fails, stop frontend rollout. Revert the frontend read path and, through a separately reviewed migration, revoke authenticated execution and drop only `public.get_cashier_order_payment_summaries(uuid[])`.

## I. Final verdict

**BLOCKED — SPECIFIC DEFECTS OR UNVERIFIED SECURITY REQUIREMENTS**

No confirmed defect emerged from the isolated checks. The smallest remaining gate is a clean full-sequence disposable migration replay followed by authenticated integration and table/drawer comparison. This report does not authorize hosted deployment.
