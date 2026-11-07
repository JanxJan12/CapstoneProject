# Cashier P1 security hardening — local deployment readiness

**Post-deployment update (2026-10-21):** Both P1 SQL bodies are deployed and recorded on `zhzluhqvysvsadwuugpa`. Repository-only reconciliation renamed the canonical files to hosted versions `20261021053249` and `20261021053310`, preserving their bytes. The earlier readiness and test narrative below is historical; see `qa/CASHIER-POST-DEPLOYMENT-ACCEPTANCE-202610.md` for current evidence and limitations.

**Current disposition after isolated verification (2026-10-21): READY FOR DEPLOYMENT APPROVAL.** The earlier blocked assessment is retained below as a historical record. The new execution evidence and limits are in section K. Hosted deployment remains a separate decision.

**Scope and disposition (2026-10-21): BLOCKED for deployment approval.** Both P1 corrections are implemented as local migration proposals. Source checks pass, and read-only hosted catalog inspection shows matching definitions and no version collision. The SQL and its concurrent behavior have **not** been executed in an isolated database: Docker Desktop's Linux engine is unavailable and no local PostgreSQL binary was found. No hosted write, business mutation, or deployment occurred.

## A. Executive summary

The closure proposal blocks an open shift while any online GCash submission remains pending. The read proposal requires the caller's current active Cashier or Manager profile for direct shift and transaction SELECT. Both require isolated SQL and two-connection concurrency proof before deployment review can be approved.

## B. Root causes and actual scope

- Hosted `public.close_cashier_shift(numeric,text,text)` locks the caller's open shift and writes the settlement but omits a pending-payment query. The UI counts all pending payments from the shared Cashier queue. `get_cashier_online_payments()` returns online payments to every active Cashier without shift ownership; `payments` and `orders` have no shift attribution for an unverified online payment. The closure policy therefore covers **online GCash pending payments in the shared queue**, not unrelated payments in other channels or statuses. A read-only hosted aggregate found one such pending payment.
- Hosted `cashier_shifts_select_staff` and `cashier_transactions_select_staff` each contain the permissive branch `cashier_id = auth.uid()` without an active-profile test. `authenticated` has SELECT grants; RLS is enabled; no second applicable SELECT policy narrows that branch. A stale valid JWT can still supply the former Cashier ID. The current `profiles.role` and `profiles.is_active` values are the relevant authority. There is no separate Cashier approval column in `profiles`; an unapproved Cashier must be represented as inactive under the present contract.

## C. Changes made

| File | Database object | Purpose |
| --- | --- | --- |
| `supabase/migrations/20261021053249_cashier_pending_payment_shift_closure.sql` | `public.close_cashier_shift`; `public.lock_pending_gcash_for_shift_closure`; trigger on `public.payments` | Preserve the hosted close body and insert a pending queue guard; serialize pending GCash INSERT/status transitions with closure using one transaction advisory lock. |
| `supabase/migrations/20261021053310_cashier_active_profile_direct_reads.sql` | Two existing SELECT policies | Replace both permissive policies in one transaction with current-profile active Cashier own-row or active Manager access. |
| `supabase/tests/verify_cashier_p1_security_hardening.sql` | Disposable synthetic fixture | Rollback-only checks for allow/deny, stale identity, pending denial, settlement atomicity, duplicate close, Manager/Customer/Rider access, and closed-history RPC. **Written but not executed.** |

No client contract, calculation, historical row, other module, or P2 snapshot trigger changed.

## D. Security invariants and concurrency

The Cashier closure RPC still requires an active Cashier profile and its own open shift, validates the drawer count, computes completed verified transaction totals, then writes one closed snapshot. It now rejects with SQLSTATE `P0001` and a pending-GCash message before any settlement update. A failed PostgreSQL function call rolls back its transaction.

The trigger takes advisory transaction lock `713904210001` before a GCash payment can become pending on INSERT or status/payment-method UPDATE. This covers the existing customer submission and rejected-proof resubmission paths and privileged direct payment writers. Closure takes the same lock after locking its own shift and before a separate pending query. Under READ COMMITTED, a submission that wins the lock commits before the close query sees it; a closure that wins the lock completes before a later submission can become pending. The close RPC explicitly rejects stronger fixed-snapshot isolation with SQLSTATE `25000`. Two concurrent closes on one shift serialize on the shift row; the second should find no open shift. Verification already locks the open shift before payment/order rows; rejection can resolve pending without a shift and a close that sees pending during rejection can conservatively fail and be retried.

These are **source-derived concurrency arguments, not executed concurrency results**. A payment submitted after a shift is closed is new queue work for a later shift. The global lock may briefly serialize unrelated GCash submissions and shift closures.

The SELECT policies now re-read `profiles` for the current `auth.uid()` on every statement. Cashiers see only their own rows while active; active Managers retain all rows; deactivated, missing-profile, Customer, Rider, and anonymous callers have no authorized rows through these two policies. Replacing the broad permissive policies avoids PostgreSQL's permissive OR behavior. Grants and service-role behavior are unchanged.

## E. Test evidence

| Check / operation | Expected | Actual | Result |
| --- | --- | --- | --- |
| TypeScript `npm.cmd run typecheck` | Exit 0 | Exit 0 | **PASS** |
| `npm.cmd run verify:quality` | 11 checks | 11 checks | **PASS** |
| Three focused Cashier workspace, Order List, and Transaction History scripts | Exit 0 | All reported PASS | **PASS** |
| `npm.cmd run build` | Build completes | Vite built 3,025 modules | **PASS** |
| Hosted close source vs latest local base function | Exact body parity before the inserted guard | Normalized `pg_proc.prosrc` and local body matched | **PASS** |
| Hosted target signature, policies, grants, columns, trigger collision, migration version | Match expected | Read-only catalog matched; no payment trigger with proposed name; hosted latest version precedes both new files | **PASS** |
| Synthetic active Cashier allowed closure and saved totals | One closed snapshot with expected totals | Fixture written; no isolated DB run | **NOT TESTED** |
| Direct RPC pending denial, unchanged open shift, no partial snapshot | SQLSTATE `P0001`, no settlement write | Fixture written; no isolated DB run | **NOT TESTED** |
| Duplicate close, unauthorized close, Manager behavior | Second/unauthorized close denied | Fixture written; no isolated DB run | **NOT TESTED** |
| Same JWT before/after profile deactivation; Cashier and Manager SELECT | Immediate loss of direct rows | Fixture written; no isolated DB run | **NOT TESTED** |
| Active own-row, cross-Cashier, Customer, Rider, six-argument historical RPC | Intended visibility only | Fixture written; no isolated DB run | **NOT TESTED** |
| Two-connection submit/resubmit vs close, verify/reject vs close, close vs close | Serialized outcome without bypass or deadlock | Docker Linux engine pipe missing; no two-connection run | **NOT TESTED** |
| Authenticated REST/JWT and rendered Cashier pages | Correct runtime access and feedback | No isolated API/browser run | **NOT TESTED** |

The fixture uses synthetic Auth users, orders, payments, shifts, and a transaction, then rolls back. It must be run only on a disposable migrated database. The existing demonstration payment script requires a separate unavailable Docker stack and private fixture, so it was not run.

## F. Hosted compatibility

Read-only inspection of `zhzluhqvysvsadwuugpa` confirmed the exact close signature/return shape, `SECURITY DEFINER`, `search_path=public, pg_temp`, authenticated/service-role EXECUTE and anon denial. The hosted close body matched the local base body after line-ending normalization. Required `payments`, `orders`, `profiles`, `cashier_shifts`, and `cashier_transactions` columns and enum types exist. The two named SELECT policies are the sole policies on the affected financial tables and currently contain the reported broad owner branch. Authenticated payment INSERT/UPDATE is denied. Hosted payment triggers contain only `trg_payments_set_updated_at`; the proposed trigger name/function do not collide. The hosted migration list ends at `20261020201031`; the proposed versions are later. Six-argument `get_closed_cashier_shifts` and Cashier assignment-status RPCs exist and are untouched.

The current worktree contains many unrelated uncommitted and pending migration files. A deployment tool that applies every pending migration would violate this task's scope.

## G. Deployment plan — review only

1. Restore an isolated disposable database from the relevant schema, apply **only** `20261021143000_cashier_pending_payment_shift_closure.sql`, then **only** `20261021143100_cashier_active_profile_direct_reads.sql`; execute the rollback-only SQL fixture and two-connection concurrency cases. Record actual SQLSTATEs, row snapshots, payment status, deadlocks/timeouts, and grants.
2. Recheck hosted catalog and migration history immediately before any later approved deployment. Review the exact SQL and ensure the hosted close body/policy shapes still match. Explicitly authorize only these two migrations in order; do not use a bulk pending-migration push.
3. After separately approved deployment, use read-only catalog queries to confirm function body/security attributes, payment trigger, policies, grants, and migration entries; use existing authorized Cashier/Manager sessions for read-only row and RPC visibility checks. Do not close the production shift or resolve its pending payment as a test.

No hosted-change command was executed in this assignment.

## H. Rollback and recovery

If deployment later fails within a migration transaction, rely on PostgreSQL rollback and investigate before retrying. If deployed but defective, restore the exact prior close definition and two prior policies from a reviewed recovery migration, and remove the new payment trigger/function if appropriate. This reopens the two P1 gaps, so contain access and pause shift closure until a corrected migration is ready. Preserve all historical settlement and payment rows.

## I. Deferred finding

The P2 closed-shift snapshot immutability trigger remains deferred. This task neither deploys nor copies the whole H-08C migration.

## J. Final recommendation

**BLOCKED.** Local proposals and source/hosted compatibility checks are complete, but isolated SQL enforcement and controlled concurrency are not proven. Do not approve hosted deployment until those tests pass.

## K. Isolated verification follow-up — 2026-10-21

### A. Environment recovery and isolation

The prior Docker Linux-engine pipe failure was absent on this attempt; no workstation repair or context change was made, so its earlier cause is **not established**. The active `desktop-linux` context reached Docker Desktop Engine 29.8.2 on WSL 2. Preflight found **zero containers**, 45 preexisting volumes, and multiple preexisting networks; all were preserved. Free Windows physical memory was about 1.6 GiB, so only one database container was started.

The task-created `rrj_cashier_p1_verify_20261021` container used cached `public.ecr.aws/supabase/postgres:17.11.0.004`, PostgreSQL **17.11**, `--network none`, no published ports, and no mounts or named volumes. Database `postgres` initially had zero Auth users and zero business rows. All connections were `docker exec` over the container's Unix socket. Supabase `authenticated`, `anon`, `service_role`, `auth.users`, and `auth.uid()` were present. The container was recreated once from the same image to rerun all concurrency cases after a harness-only lookup defect; both instances were task-owned and networkless.

Cleanup: the task-created container was removed after evidence capture. Final Docker inventory again showed **zero containers, 45 volumes, and 21 networks**. No volume or network was created or removed. The task's nonsecret replay scripts and result JSON remain under `.tmp/cashier-p1-verify-20261021` for review.

The source `remote_schema.sql` baseline failed at its Storage policy section because the bare database image has no `storage.objects` table. On the fresh container, the public schema portion was loaded through its last Auth trigger. A local-only `storage.objects` compatibility table with `bucket_id` and `name` was added for synthetic proof-presence checks; it has RLS enabled and no browser-role grants. This is **not** Storage API or upload-policy parity. It does not replace the real `profiles`, payment functions, grants, or RLS used in the P1 assertions.

### B. Migration execution

The selected prerequisite chain applied successfully on the disposable database: online payment hydration, GCash verification, GCash rejection/resubmission, active-role helper, protected-table ACL, the hosted-matching base close body, and the six-argument saved-shift RPC. The two proposed migrations then applied **in this order, exit 0**:

1. `20261021143000_cashier_pending_payment_shift_closure.sql`
2. `20261021143100_cashier_active_profile_direct_reads.sql`

The first migration printed only the expected `DROP TRIGGER IF EXISTS` notice. The local replay used direct `psql` and did not populate a Supabase migration ledger or apply unrelated pending migrations. Before P1 application, the selected schema had zero business rows, two affected SELECT policies, authenticated SELECT on both financial tables, and no authenticated payment INSERT/UPDATE.

### C. Shift closure and role test matrix

The prepared `verify_cashier_p1_security_hardening.sql` first failed on two **fixture errors**: this PostgreSQL 17 Auth schema has no `email_confirmed_at` column, and `pickup` is not a `fulfillment_type` enum value. The fixture now omits the unneeded confirmation column and uses `takeout`. No assertion was weakened. Its complete run then exited **0** with every DO assertion successful and a final `ROLLBACK`. Postcheck immediately after that run found **0** Auth users, orders, payments, shifts, and transactions.

| Operation | Actual isolated result | Status |
| --- | --- | --- |
| Active Cashier direct SELECT of own shift and transaction | One of each visible; another Cashier's rows absent | **PASS** |
| Direct `close_cashier_shift` while online GCash pending | Denied with `P0001`; shift stayed open, `expected_cash` stayed null | **PASS** |
| Closure after pending resolution | One closed snapshot: opening/expected/actual cash 100, variance 0, GCash sales 30, one completed transaction | **PASS** |
| Repeated closure | Rejected; one closed shift row remained | **PASS** |
| Manager close attempt | Rejected by active-Cashier role check | **PASS** |
| Active Manager direct reads and six-argument history RPC | Two fixture shifts, one fixture transaction, one closed history result | **PASS** |
| Same Cashier claim before/after `profiles.is_active=false` | Own shift/transaction rows changed from 1/1 to 0/0 without changing the claim | **PASS** |
| Deactivated Manager, Customer, Rider direct reads | Zero financial rows | **PASS** |
| Anonymous direct reads | Both tables returned zero rows under RLS; this baseline grants SELECT, so no permission error occurred | **PASS** |
| Separate unapproved-Cashier state | No distinct Cashier approval field exists; inactive profile is the applicable state tested above | **NOT TESTED** as a separate state |

A separate verbose direct call while a synthetic pending payment was present returned SQLSTATE **`P0001`** and the intended message. The transaction rolled back: payment remained `rejected`, and that Cashier's shift remained `open`.

### D. Two-connection concurrency

Four scenarios used independent `docker exec ... psql` processes, explicit transactions, `READ COMMITTED`, **5-second lock** and **8-second statement** timeouts, and 2-second held transactions. Synthetic customer submission used the actual `submit_customer_payment` RPC; rejection used `reject_customer_gcash_payment`. No deadlock or timeout occurred.

| Scenario and ordering | Actual outcome | Status |
| --- | --- | --- |
| **A — submission first:** Customer RPC created pending payment and held its transaction open; Cashier close started while uncommitted. | Writer committed in 2,148 ms; close waited 2,023 ms, then returned the pending-payment error. Shift A stayed open. | **PASS** |
| **B — closure first:** Cashier close produced a closed result but held its transaction open; Customer submission started afterward. | Close committed in 2,133 ms; submission waited 2,038 ms and then committed. This is new queue work after the closure, not a payment visible at its commit. | **PASS** |
| **C — duplicate close:** Two sessions closed Cashier C's same open shift. | First committed in 2,112 ms; second waited 2,017 ms and returned “You do not have an open cashier shift.” Exactly one closed row persisted. | **PASS** |
| **D — resolution overlap:** A pending payment existed; Cashier rejected it but held the transaction open; another session attempted close. | Rejection committed in 2,113 ms. Overlapping close denied promptly (105 ms) while the old pending status was visible; retry after commit closed successfully (122 ms). | **PASS** |

The harness initially stopped before D because its payment-ID subquery ran under authenticated direct payment RLS and returned no row. It was corrected to obtain the ID through the privileged **disposable test connection**, then call the actual rejection RPC as Cashier. All four scenarios were rerun from a fresh disposable container. Final state: **3 closed shifts, 1 open shift, 0 pending payments, 0 Cashier transactions, 3 rejected payments**. All three closed shifts had opening = expected = actual cash and variance 0. Only synthetic local records were used.

### E. Regression and hosted compatibility

- `npm.cmd run typecheck` — **PASS**.
- `npm.cmd run verify:quality` — **PASS**, 11 checks.
- Cashier workspace, Order List, and Transaction History focused scripts — **PASS**.
- Production build — **PASS in the preceding implementation pass**; not repeated because no application source changed in this verification pass.
- Read-only hosted recheck — **PASS**: `close_cashier_shift` body MD5 remained `76eb0b01d6bc04dadd7b06b7b56f7399`; the two hosted policies still had the reported broad own-row branch; the six-argument history and assignment-status RPC bodies remained present. Hosted migration history still ended before these P1 versions. **No hosted write was made.**

### F. Changes, limits, and readiness

The P1 migration files were **unchanged**. Only the synthetic fixture's Auth-column and fulfillment enum values were corrected; temporary replay/overlap scripts and evidence were placed under `.tmp/cashier-p1-verify-20261021`. This report was updated. The P2 snapshot trigger remains deferred.

The isolated tests prove PostgreSQL function, RLS, grant, row-lock, advisory-lock, and rollback behavior for the two P1 changes. They do **not** test Storage upload policy, a full local Supabase API stack, a real JWT over PostgREST, browser rendering, physical payment verification, or hosted migration execution. The local baseline was a focused diagnostic replay, not a clean all-migration release proof. These limits do not substitute for the existing separate release/recovery gates.

**READY FOR DEPLOYMENT APPROVAL** for these **two P1 migrations only**, in the order above. Approval and hosted deployment are separate tasks; do not bulk-push other pending migrations or use a real payment/shift write as a post-deployment test.
