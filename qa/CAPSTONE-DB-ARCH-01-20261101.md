# CAPSTONE-DB-ARCH-01 — Cashier shift approval-column disposition

**Date:** 1 November 2026 (Asia/Manila). **Decision:** **INVESTIGATION COMPLETE — NO SAFE COLUMN REMOVAL YET.** The ordinary shift-close workflow is Cashier-owned and writes neither Manager-approval field. Both fields are empty in the current six hosted shift rows. Nevertheless, each is a live output and body dependency of the deployed historical-shift RPC; a direct drop demonstrably breaks that RPC. External consumers of its return shape remain unverified. No active migration, application code, hosted schema or hosted business record was changed.

## 1. Scope and preflight

The business objective is to retain only necessary operational, financial, historical, security and reliability state. This milestone evaluated exactly `public.cashier_shifts.manager_approved_by` and `manager_approved_at` under the agreed Cashier-owned ordinary closing rule. It did not redesign shift opening, counted Cash/GCash, variance, pending-payment restrictions, refunds, handover or exceptional Manager investigations. Branch `main...origin/main` had extensive unrelated dirty work and untracked QA. It was preserved. The migration directory contains 71 chronological files through `20261031155629_cashier_db_03a_remove_redundant_profile_rider_objects.sql`; no new migration was created because neither candidate passed the removal gate.

Reviewed [DB-01](CASHIER-DB-01-20261031.md), its [column matrix](CASHIER-DB-01-COLUMN-MATRIX-20261031.csv) and [elimination register](CASHIER-DB-01-ELIMINATION-REGISTER-20261031.csv), [FIN-01](CASHIER-FIN-01-20261030.md), [SS-01](CASHIER-SS-01-20261030.md), [DB-03A](CASHIER-DB-03A-20261031.md), [migration-root-cause report](CAPSTONE-MIG-01-20261031.md), and manual findings. Live hosted catalog, aggregate data and statement statistics were checked read-only; canonical web and standalone Rider source were searched. The existing full-history replay blocker at Phase 2A remains separate.

## 2. Independent business and data decisions

| Column | Event represented | Current necessity evidence | Disposition |
| --- | --- | --- | --- |
| `manager_approved_by` | Identity of a Manager attesting approval of a shift, if such an exceptional workflow is authorized | Ordinary `close_cashier_shift` does not set it; no active web/Rider writer was found. However it is a profile FK, an authenticated readable field and a deployed historical-RPC output. Exceptional approval policy and external readers remain unresolved. | **RETAIN TEMPORARILY** |
| `manager_approved_at` | Time of that hypothetical attestation | Ordinary close does not set it; no active source writer. It remains a deployed historical-RPC output and may carry meaning if an exceptional approval flow is later established. External readers remain unresolved. | **RETAIN TEMPORARILY** |

Hosted `public.cashier_shifts` has **6** records: **5 closed, 1 open**. `manager_approved_by` is nonnull in **0/6**, `manager_approved_at` in **0/6**, and mixed null/non-null pairs in **0/6**. This proves no current stored historical approval value would be lost *at the instant of this read*, but it does not prove the fields are safe to drop while an exposed read contract still requires them or privileged integrations might write them. No identifiers or shift records were extracted. No historical value was nulled or archived. `closed_by` remains a distinct required closure attribution; `variance_reason`, expected/actual Cash and saved variance remain.

Both candidates are nullable and have no default or generation expression. `manager_approved_by` is `uuid` with `cashier_shifts_manager_approved_by_fkey` → `public.profiles(id)`; `manager_approved_at` is `timestamptz` with no FK. No target-specific index, generated column, view/materialized view, noninternal shift trigger, check constraint or RLS predicate was found. The table's status-fields CHECK concerns open/closed settlement values and `closed_by`, not Manager approval. RLS is enabled; `cashier_shifts_select_staff` permits an active Cashier's own rows and active Manager reads. Authenticated has SELECT on the candidate fields; service_role has SELECT/INSERT/UPDATE/REFERENCES. The service-role grant is an exposed capability, not proof it is exercised. `pg_depend` reports the auto dependency of the `manager_approved_by` FK on that column. PL/pgSQL source references need separate inspection because the catalog dependency list alone does not prevent an unsafe drop.

## 3. Active contracts and cross-module map

The exact deployed `public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer)` is an authenticated, security-invoker, paginated TABLE-returning RPC. Its `RETURNS TABLE` shape includes **both** `manager_approved_by uuid` and `manager_approved_at timestamptz`, and its `RETURN QUERY` selects both from `cashier_shifts`. It enforces active Cashier/Manager roles, own-Cashier filtering, bounds and cursor rules, and reads saved financial fields. This is an **ACTIVE database/API contract**, even though the web mapper currently discards the two approval values. Hosted `pg_stat_statements` records **27 PostgREST calls** to this RPC in the available aggregate window; it does not identify the clients, requested fields, last-call date or whether they rely on these columns. Consequently external return-shape clearance is **BLOCKED**.

| Consumer/reference | Classification | Implication |
| --- | --- | --- |
| `src/modules/cashier/api/closedShiftHistoryApi.ts` | **ACTIVE** RPC caller | Maps saved Cash/variance/owner fields; ignores the two approval fields, but depends on the RPC remaining callable. |
| Cashier/Manager shared `ClosedShiftHistory` workflow | **ACTIVE** historical view | Cashier and Manager must keep readable saved shift snapshots and paging. |
| `src/modules/cashier/types.ts` `CashierShift.managerApprovedBy/At?` | **ACTIVE source declaration, unused fields** | No active assignment/read found. Could be removed only in a future reviewed contract cleanup; this task made no source change while DB contract remains. |
| `src/modules/cashier/transactions/historyReadApi.ts` | **ACTIVE**, unrelated projection | Selects shift identity/status/opening fields only; does not consume approval values. |
| `20261014191853_h08c_historical_shift_access.sql`, `20261021120000_restore_closed_cashier_shifts_rpc.sql` | **HISTORICAL migration definitions** | Preserve unchanged; latest function definition includes both fields. |
| `supabase/tests/verify_cashier_p1_security_hardening.sql` | **TEST** | Exercises historical access; no evidence it authorizes a changed response shape. |
| Standalone Rider source/tests, Customer, Kitchen/KDS, other Manager source | **No direct active approval-field reference found** | Indirect shared payment/order/identity paths remain; source absence does not clear external clients. |

No database function other than `get_closed_cashier_shifts` was found referencing either candidate in its source. The current shift-close RPC writes Cashier-owned expected/actual/variance/closure values but not these two fields. The direct table grant and exposed RPC mean a future removal must reconcile API shape, not merely drop a nullable column. No application behavior change was authorized without successful dependency clearance.

## 4. Disposable dependency rehearsal and decisive regression

An isolated `public.ecr.aws/supabase/postgres:17.11.0.004` container with tmpfs data was populated from a **schema-only** dump of the existing current-contract integration database. The existing database was read/dumped only. `auth` and `public` were restored with `--no-owner --no-acl`; this is a relevant current-schema clone, not a complete hosted backup or migration-history replay. The [rollback-only probe](CAPSTONE-DB-ARCH-01-DEPENDENCY-PROBE.sql) applied transient relevant grants, inserted one synthetic active Cashier Auth/profile pair, used actual PostgreSQL `SET ROLE authenticated` plus JWT-sub context, and ran the exact existing RPC. It returned an empty authorized page (**PASS**) before any drop.

Inside separate savepoints, `ALTER TABLE public.cashier_shifts DROP COLUMN manager_approved_by` and then `DROP COLUMN manager_approved_at` each succeeded in the clone. In each case, calling the unchanged RPC as authenticated failed at its `RETURN QUERY` with respectively **`column s.manager_approved_by does not exist`** and **`column s.manager_approved_at does not exist`**. Each savepoint and the outer transaction were rolled back. Postflight confirmed **15** shift columns, both target columns present, and **0** profile/shift fixture rows. This proves a direct column drop is unsafe even when the table holds no rows. It does **not** prove that a separately versioned or changed RPC would be safe for unknown external callers.

No elimination migration or compensating RPC rewrite was made. Therefore current-schema migration application, financial shift-close mutation, positive/negative closure ownership, signed-in browser acceptance and restoration of a committed column drop were **NOT RUN**. Restoration for this milestone was rollback of the temporary DDL, verified by the unchanged 15-column catalog. A future approved drop would require exact before-state capture, recovery of any newly populated approval values, and restoration of the FK plus exact RPC signature/body/grants. Recreating empty columns after deployment would not recover historical values written between cutover and rollback.

## 5. Financial, authorization and simplification scorecard

| Measure | Hosted/current baseline | After this milestone | Evidence |
| --- | ---: | ---: | --- |
| `cashier_shifts` columns | 15 | **15** | No approved removal; clone rolled back |
| Manager-approval columns | 2 | **2** | Both retained temporarily |
| Approval-value rows | 0/6 each | unchanged | Hosted read-only aggregate |
| Manager-approval FK | 1 | 1 | Retained |
| Historical-shift RPC outputs | 14 | 14 | Signature retained |
| Application source references removed | 0 | 0 | No source edit |
| Tables/unrelated columns removed | 0 | 0 | No migration |
| Hosted schema/data changes | 0 | 0 | Read-only hosted access |

**Financial integrity:** existing Cash/GCash, verified-payment, exact-shift receipt association, server settlement, variance reason, closure ownership and pending-payment controls were not changed. Their source contracts remain; no financial RPC mutation was run in this investigation because no migration was cleared. **Authorization:** the authenticated historical RPC positive path was exercised in a synthetic clone; a direct drop caused an error under the same role. Other allowed/denied closing scenarios were **NOT RUN**, not inferred from source or a privileged bypass. This is a failed removal gate, not an accepted local implementation. Full-history replay remains blocked at Phase 2A per CAPSTONE-MIG-01; no attempt was made to repair it here.

## 6. Exact gate to revisit and next candidate

To revisit these columns: the business owner must settle whether exceptional Manager attestation exists or must be retained; monitor/identify `get_closed_cashier_shifts` consumers and any service-role writer; review a versioned or otherwise compatible historical-RPC response contract; verify no new nonnull approval values and preserve any that appear; test Cashier/Manager history and positive/negative role matrix against that exact contract in a disposable current-schema clone; prepare a guarded, rollback-backed migration without `CASCADE`; and resolve the independent clean-history/recovery gates before any hosted review. No new archive table or null placeholder fields are proposed merely to force a reduction.

**Next bounded structural candidate (investigation only):** `public.payments.rejection_reason` versus `notes`, already flagged in DB-01 as possibly overlapping. Determine their distinct structured/free-text and historical payment-audit responsibilities before any proposed deletion. No work on that pair began here.

## 7. Verification and changed files

| Check | Result |
| --- | --- |
| Hosted definitions, six-row aggregate, FK/index/RLS/grant/function catalog and RPC telemetry | **PASS**, read-only |
| Canonical web/Rider source and historical migration dependency search | **PASS** for searched repositories; external clients **BLOCKED** |
| Disposable baseline authenticated RPC | **PASS**, empty authorized page |
| Direct drop of either field with unchanged RPC | **FAIL as removal hypothesis**, expected `undefined_column` regression |
| Savepoint/transaction restoration and no surviving fixture | **PASS** |
| New migration, financial close/settlement and signed-in cross-module flows | **NOT RUN**, no cleared deletion |
| Full chronological migration replay | **NOT RUN** here; previously **FAIL** at Phase 2A |

**Repository files changed:** this report, `qa/CAPSTONE-DB-ARCH-01-DEPENDENCY-PROBE.sql` (disposable QA evidence), and an append to `qa/CASHIER-MANUAL-FINDINGS-20261030.md`. No active migration, historical migration, DB-03A evidence, application file or standalone Rider file changed. No hosted DDL, hosted business-row write or deletion occurred.

The uniquely named disposable container and its tmpfs database were removed. The temporary dump inside the existing integration container was removed. Automatic command review **rejected deletion** of the exact host-side schema-only dump at `C:\Users\Janmari\AppData\Local\Temp\rrj_arch01_schema_only.dump` with reason `blocked by policy`; that one temporary file remains. It contains schema definitions only, not business rows, and is outside the repository. No unrelated container or volume was removed.
