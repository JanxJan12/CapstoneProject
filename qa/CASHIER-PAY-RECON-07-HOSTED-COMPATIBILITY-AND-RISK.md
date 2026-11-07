# CASHIER-PAY-RECON-07 — Hosted compatibility and deployment risk

Date: 2026-11-03. Project: `zhzluhqvysvsadwuugpa` (`RRJS-Foodhouse-Final`, PostgreSQL 17.6.1.147). This was a SELECT-only hosted catalog review. No deployment, hosted write, ledger change, or application edit occurred.

## 1. Executive summary and decision

**BLOCKED — SPECIFIC RECOVERY PREREQUISITE.** The pending payment-summary function is compatible with the hosted schema and its static authorization boundary is coherent with the deployed ownership model. The focused disposable role/financial tests passed previously. There is no evidence that historical payment records need repair: the reported discrepancy is an Orders-list read projection. But the project's documented production gate requires a verified current hosted recovery point and independent restore; neither is documented. A narrow function rollback is available but does not waive that gate. Actual hosted migration execution, signed-in RPC authorization, and rendered UI acceptance remain unverified. This review does not authorize rollout.

Evidence tiers throughout: **hosted catalog** means SELECT-only metadata observed on 2026-11-03; **source** means current local files; **disposable** means prior synthetic role-context tests in `qa/CASHIER-PAY-RECON-04-VALIDATION.md`; **runtime unverified** means no call to the new function on hosted.

## 2. Migration identity and state

| Item | Result | Evidence |
| --- | --- | --- |
| Local file | `supabase/migrations/20261102193437_cashier_owned_order_payment_summaries.sql` exists; untracked in the already dirty worktree | Local file and `git status --short` |
| SHA-256 | `1EF09A695D217246F45369921CD1BAD06A853DAA733DE7A8D61E340E04B3B3E1` | `Get-FileHash -Algorithm SHA256`, 2026-11-03 |
| Function | `public.get_cashier_order_payment_summaries(p_order_ids uuid[]) RETURNS TABLE(order_id uuid, payment_method public.payment_method, payment_status public.payment_status)` | Migration source |
| Hosted ledger | Version `20261102193437` and matching migration name absent. Latest hosted ledger version observed: `20261101233254` | SELECT from `supabase_migrations.schema_migrations` |
| Hosted function | No function of that name in `public`, including another overload | SELECT from `pg_proc`/`pg_namespace` |
| Other local migration dependency | No reference to an unhosted application function or table. Uses hosted `auth.uid()`, public tables/enums, and built-in array/aggregate operations. | Migration source plus hosted catalog; actual CREATE remains untested |

Ledger absence alone was not used to infer function absence; both were checked independently. The migration creates only this function and its EXECUTE ACL; it contains no financial-table DDL or DML. The extensive pre-existing dirty worktree was left untouched.

## 3. Hosted schema dependency matrix

| Dependency | Expected by migration | Hosted SELECT-only contract | Result |
| --- | --- | --- | --- |
| Identity | `auth.uid()` returns UUID; `profiles.id uuid`, `is_active boolean`, `role user_role` | All present; `auth.uid()` returns UUID | MATCH |
| Cashier role | `user_role` contains `cashier` | `customer`, `cashier`, `manager`, `rider`, `production` | MATCH |
| Orders | `id uuid`, `grand_total numeric`, `order_channel order_channel`; `walk_in` value | All columns/types and `walk_in` present | MATCH |
| Payments | `id uuid`, `order_id uuid`, `amount numeric`, `payment_method payment_method`, `status payment_status` | All present; `payments.order_id` FK to `orders.id`, UNIQUE | MATCH |
| Payment values | `cash`, `gcash`; `verified`, `voided` | Methods `gcash`,`cash`; statuses `pending`,`verified`,`rejected`,`voided` | MATCH |
| Cashier transactions | `order_id uuid`, `payment_id uuid`, `cashier_id uuid`, `status cashier_transaction_status` | All present; FKs to orders/payments/profiles; `order_id` and `payment_id` each UNIQUE | MATCH |
| Transaction values | `completed`, `voided` | Both present | MATCH |
| Historical shift relationship | Ownership via transaction cashier ID, without an open-shift condition | Transaction has `shift_id uuid` FK to `cashier_shifts.id`; shift has `cashier_id uuid`, status `open`/`closed` | MATCH |
| Function/extension support | PL/pgSQL, `auth.uid()`, built-in UUID-array functions | `auth.uid()` exists; no extension-specific call in migration | MATCH by static dependency; execution UNVERIFIED |
| Function namespace | New function name/signature free | No hosted function of that name found | MATCH |

Sources: current migration text; hosted `information_schema.columns`, `pg_enum`, `pg_constraint`, `pg_proc`, and migration-ledger SELECTs. This is a catalog compatibility result, **not** an execution result. Because hosted Payments and transaction order links are unique, duplicate rows cannot normally occur without a schema change; the function still checks counts conservatively.

## 4. Authorization and security

**Static and hosted catalog: supported.** The function uses `auth.uid()` rather than a caller-provided cashier ID; requires an active `cashier` profile; limits input to 1–100 non-null UUIDs; deduplicates input; and returns rows only for Walk-in orders having a transaction owned by that cashier. Its result exposes only order ID, payment method, and payment status. It uses no dynamic SQL, sets `search_path = ''`, and schema-qualifies referenced relations/types. Migration text revokes EXECUTE from PUBLIC and `anon`, then grants it to `authenticated`. The function owner will need read privileges for its `SECURITY DEFINER` path; hosted `postgres` owns the five relevant tables, can SELECT them, and owns existing Cashier SECURITY DEFINER readers. The actual owner/ACL of this new function can only be verified after deployment. Source: migration; hosted `pg_roles`, `pg_class`, `pg_proc`, privilege catalog.

**Direct table access nuance.** Hosted `payments` has table-level SELECT grants for `authenticated` and `anon`, but RLS is enabled and it has **no SELECT policies**. Thus ordinary client-row access remains denied by RLS; saying there is no table-level grant would be inaccurate. The pending migration does not alter payment grants or RLS. Hosted `cashier_transactions` has an active-staff policy that scopes a Cashier to their own `cashier_id`; the new function's own ownership predicate is needed because its expected privileged definer bypasses table RLS. Hosted `postgres` has `BYPASSRLS`. The existing `get_cashier_sale` and `get_current_shift_cashier_sales` functions are postgres-owned SECURITY DEFINER functions. Historical closed shifts do not invalidate the new function's transaction ownership check. Source: hosted RLS/policy/role/function catalog and migration.

**Disposable, not hosted runtime:** `qa/CASHIER-PAY-RECON-04-VALIDATION.md` records successful role-context tests for own closed/open-shift orders, other Cashier denial, Manager/anonymous/missing-subject denial, forged caller cashier claim, oversized/empty/null inputs, and restricted EXECUTE. Those tests used synthetic `SET LOCAL ROLE` and subject claims, not a signed JWT or PostgREST. Inactive-Cashier behavior was source-checked but not fixture-tested. Genuine hosted authenticated execution and resulting owner/ACL remain **NOT VERIFIED**. A failed batch call preserves unresolved list behavior; it is not proof of an authorized hosted read.

## 5. Financial correctness and data compatibility

The function requires one recorded payment and one cashier transaction for an owned Walk-in order; the transaction must reference that payment; the payment amount must equal `orders.grand_total`; `verified` pairs only with `completed`, and `voided` only with `voided`. Otherwise the returned method/status are null or the order returns no row. It does not use Kitchen Ready, a receipt, or shift closure as proof. Pending/rejected online GCash lacks an owned Walk-in transaction and remains on the existing online hydration path. It writes no order, payment, receipt, or transaction data. Source: migration and `cashierOrderPaymentResolution.ts`.

The reported `ORD-000045` ₱120 verified Cash payment, matching completed transaction, receipt, and closed shift are documented in `qa/CASHIER-PAY-RECON-03-IMPLEMENTATION.md` from earlier bounded hosted investigation. This review did not re-query financial rows. No repair of that order or the previously observed historical group is justified by a presentation mismatch alone. Disposable tests covered matching closed-shift Cash, voided pairs, amount mismatch, contradictory statuses, and online pending/rejected isolation; signed-in hosted behavior is unverified. Source: RECON-03 and RECON-04 reports.

## 6. Frontend contract

`supabaseOrderService.ts` calls exactly `get_cashier_order_payment_summaries` with `{ p_order_ids: batch }`. `cashierOrderPaymentResolution.ts` uses 100-ID batches, matching the SQL limit; validates the returned IDs, enum values, uniqueness, and method/status pairing; and maps only owned Walk-in summaries to `Verified` or `Voided`. Null/conflicting evidence becomes uncertain, not Verified. RPC failure is caught so Orders still load with unresolved payment status. The existing online-payment hydration is separate. The list obtains the orders before client-side search/filter/pagination, so this adds batches per loaded Walk-in set, not per row. The drawer guard in `useOrderDetailsDrawer.ts` blocks its single-sale fallback when the batch found contradictory evidence. Source: current service, resolver, drawer hook, and `qa/CASHIER-PAY-RECON-03-IMPLEMENTATION.md`.

Previously recorded checks in RECON-04/06: typecheck, production build, focused Orders and transaction-history scripts, synthetic parser/batching tests, and disposable SQL fixture passed. No checks were rerun in this read-only milestone. Rendered desktop/browser behavior, signed-in network batches, failure presentation, stale-response races, and table/drawer parity are **NOT VERIFIED** for the new hosted RPC.

## 7. Residual risk register

| Risk | Rating | Evidence and limit |
| --- | --- | --- |
| Hosted schema mismatch | LOW | All essential columns, enum values, FKs, helper, and name availability matched hosted catalog; CREATE execution not attempted. |
| Authorization | MODERATE | Static checks and disposable role tests support isolation; actual function owner/ACL, signed JWT, and hosted PostgREST owner denial not yet observed. |
| Financial classification | MODERATE | Conservative predicates and disposable fixtures pass; real hosted results and table/drawer comparison remain unobserved. |
| Migration execution | MODERATE | Focused isolated apply passed. Complete 82-file replay failed in RECON-05 at missing `storage.objects`; RECON-06 platform-first Storage startup failed at `storage.migrations`. Neither failure reached this migration or proves a defect in it. No hosted apply test. |
| Authenticated UI acceptance | HIGH | New RPC is absent hosted and an isolated Auth/API stack was not healthy; no signed-in browser comparison. |
| Current hosted recovery | **BLOCKING** | `qa/RRJ-HOSTED-SUPABASE-SIMPLIFICATION-DEPLOYMENT-20261101.md` documents no verified current hosted backup identifier/recovery point and no independent hosted restore, while describing that as a mandatory production gate. No newer qualifying evidence was found in this review. Narrow function rollback does not satisfy general recovery. |

These ratings describe evidence gaps, not permission to create hosted test transactions or waive recovery.

## 8. Recovery, rollback, and exact blockers

The migration consists of `CREATE FUNCTION`, `REVOKE`, and `GRANT`. Under an atomic migration transaction, a failed statement should roll back the whole unit; the supported deployment workflow and transaction boundary must be confirmed before execution. If a non-atomic executor is used, a partial function/ACL could remain, so check both function catalog and ledger after failure. The prior disposable function-level rollback dropped only the new function. A controlled hosted rollback would first disable/revert frontend calls or rely on the documented unresolved fallback, then in a separately reviewed migration revoke authenticated EXECUTE and drop **only** `public.get_cashier_order_payment_summaries(uuid[])`. Verify no dependents and exact function identity before dropping; preserve financial tables and unrelated RPCs. Do not delete or rewrite migration history by assumption. Source: migration, RECON-03/04 reports.

Exact blockers for an actual GO: (1) document the required current hosted recovery point and independently verified restore, or obtain a **new explicit owner decision** changing that existing gate for this exact read-only function after reviewing the limited function rollback; (2) obtain separate authorization for this exact migration/hash and deployment operator/workflow. Actual authenticated runtime and UI acceptance are controlled post-deployment stop/go checks, not claims of predeployment PASS. This report alone cannot clear the existing recovery gate.

## 9. Proposed controlled rollout — not executed

1. **Preflight:** confirm project `zhzluhqvysvsadwuugpa`, operator privileges, exact SQL SHA-256 above, ledger absence, function-name absence, hosted dependency/ACL/RLS state, current recovery evidence, rollback trigger/owner, and frontend fallback. Stop for drift or missing mandatory recovery. Do not use repository-wide `db push` against the divergent dirty history.
2. **Authorized apply:** using a separately approved exact-file, atomic migration workflow targeting that project, apply only `20261102193437_cashier_owned_order_payment_summaries.sql`; capture result and verify one ledger version. No deployment command is supplied here because the operator, connection, and workflow have not been approved.
3. **Postflight catalog:** read back exact signature, body/hash as feasible, owner, SECURITY DEFINER, empty search path, PUBLIC/anon denial, authenticated EXECUTE, unchanged Payments RLS/policies, and no unexpected function or table changes.
4. **Non-mutating acceptance:** sign in as an authorized Cashier; inspect an existing owned historical Cash order and a recent Walk-in order in Orders table and drawer; confirm pending online GCash stays Pending; use an authorized second-Cashier context to confirm restricted rows are not returned; inspect bounded network requests, errors, search/pagination, and unchanged financial row counts. Do not verify/reject payment, release/create orders, or create hosted fixtures merely for testing.
5. **Stop/rollback triggers:** unauthorized financial exposure, falsely Verified status, broken Orders loading, privilege escalation, material performance regression, or conflicting table/drawer payment interpretation. Stop frontend rollout; use reviewed frontend-first, function-only rollback after checking current catalog and dependencies. Maintain evidence of any ledger handling instead of silently repairing it.

## 10. Files and operational scope

Changed in RECON-07: **this report only** (`qa/CASHIER-PAY-RECON-07-HOSTED-COMPATIBILITY-AND-RISK.md`). The migration, frontend source, other modules, and existing reports were not edited. Hosted access was SELECT-only; there was **no hosted deployment, no financial-data change, no migration-ledger change, and no application-source change**.
