# Track B — bounded backend performance and reliability (27 October 2026)

## Boundary and decision

Canonical checkout: `C:\Users\Janmari\Downloads\Capstone Project`, already heavily dirty. Hosted Supabase project `zhzluhqvysvsadwuugpa` was **read only**: catalog/statistics `SELECT`, performance advisor, and two bounded `EXPLAIN` statements on SELECT equivalents. There was no hosted `EXPLAIN ANALYZE`, write RPC, migration, deployment, business-data edit, or schema edit. The local database used below is the existing disposable Track A targeted stack; fixture and policy edits ran inside a transaction ending in `ROLLBACK`. Its 34 public tables are not a current full hosted clone (hosted has 36). No historical order research, replay, recovery, or broad audit was done.

**Selected one local optimization:** make the three existing `public.orders` SELECT policies evaluate the statement-constant `auth.uid()` through initPlans. No policy roles, owner predicates, staff eligibility, Rider assignment statuses, table grants, indexes, write policies, RPCs, or frontend code changed. This is one order-read RLS bottleneck shared by Customer, Cashier/Manager, and Rider. The [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) and [advisor 0003](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0003_auth_rls_initplan) describe the row-by-row identity-check cost and initPlan form. The 27 October advisor flagged all three `orders` SELECT policies. Its 27 missing-FK-index and 17 unused-index notices are leads, not evidence to add or drop an index here.

## Measured hosted snapshot

`pg_stat_statements` exists in `extensions`; its reset timestamp is **4 August 2026 04:48:40 UTC**. Counts below are cumulative since then, include past code/fixtures and multiple clients, and cannot be interpreted as a current per-minute rate. `total_ms` is accumulated database execution time, not end-to-end request latency. At inspection, `orders` had an estimated 49 live rows and 16 kB heap; `order_status_history` had 234 rows and 40 kB heap. Small-table sequential scans can be rational. The highest observed paths were:

| Path | Calls | Total / mean / max execution | Interpretation |
| --- | ---: | ---: | --- |
| `rider_push_internal.invoke_worker()` | 9,819 | 136,589.8 / 13.911 / 124.0 ms | Largest cumulative SQL cost; hosted `cron.job` confirms an active `* * * * *` schedule. Scheduler/worker tuning is outside this one local order-read change. |
| `claim_rider_offer_push` PostgREST call | 9,818 | 71,171.6 / 7.249 / 176.0 ms | Related one-minute worker path; zero live rows estimated in its outbox at this snapshot. These two costs may overlap conceptually and should not be added as independent user latency. |
| `get_current_shift_cashier_sales` | 3,213 | 31,598.0 / 9.834 / 1,315.4 ms | Highest measured Cashier read; worth a separate bounded investigation, but no SELECT-equivalent plan/large fixture was established here. |
| `get_cashier_online_payments` (main statement) | 3,018 | 15,491.1 / 5.133 / 705.9 ms | Cashier payment read. |
| Direct `orders` PostgREST statement, top shape | 2,636 | 4,889.1 / 1.855 / 124.1 ms | Active order read with an advisor-confirmed policy scaling issue; second shape had 1,077 calls / 1,160.8 ms. This is the selected measurable, locally reproducible issue, though current hosted mean time is low. |

`pg_stat_user_tables` recorded 19,761 `orders` sequential scans (477,181 tuples read) and 14,448 index scans; `order_status_history` recorded 11,186 sequential scans (881,865 tuples read). These counters do not identify individual callers. All seven `orders` indexes were 16 kB each. Usage: primary key 10,422 scans, `created_at` 3,182, `current_status` 666, `customer_id` 118, order-number 56, `processed_by` 2, request-id 2. No new index is justified at this size. Hosted `EXPLAIN` for a bounded `orders ORDER BY created_at DESC LIMIT 20` SELECT equivalent chose `orders_created_at_idx` (estimated 45 rows); a customer-filtered equivalent chose a sequential scan plus sort (estimated 13 rows). These plans ran under the inspection role, so they do **not** measure authenticated RLS execution.

At the one-time `pg_stat_activity` snapshot: six connections, one active query, **zero current lock waits**. `pg_stat_database` recorded **zero deadlocks**, zero conflicts, 4,408,654 commits, and 12,502 rollbacks since its statistics window (its `stats_reset` was null). This does not prove absence of transient waits or failed application retries. The deployed cancellation/Rider lock-order acceptance and postflight remain documented in `TRACK-B-CANCELLATION-RIDER-FULL-SCHEMA-ACCEPTANCE-20261027.md` and `TRACK-B-CANCELLATION-RIDER-DEPLOYMENT-EXECUTION-20261027.md`; no write-RPC concurrency test was repeated.

## Mounted request frequency and scope

`src/modules/cashier/hooks/CashierStore.tsx` loads orders, shift sales, online payments, open shift, and menu in parallel on initial load and refresh. It refreshes on order INSERT/UPDATE and status-history INSERT events, plus focus/reconnect/manual refresh; those can cause multiple backend reads for one workflow, but the source does not prove an actual duplicate rate. Its assignment status poll is every **15 seconds**, gated by visible tab and eligible pending deliveries, with an in-flight guard. `src/modules/kitchen/queue/KitchenQueue.tsx` polls KDS every **5 seconds**. Customer tracking in `src/modules/customer/index.tsx` uses realtime changes and a **60-second** focus recovery threshold. The order history read has no explicit customer predicate and relies on RLS. The hosted statement counts above are actual accumulated executions; precise current per-user request rates and network latency were **not measured**.

## Local fix and EXPLAIN

Exact new files:

- `supabase/migrations/20261026202747_track_b_orders_read_rls_initplan.sql` — generated by `supabase migration new`; changes only `customers_select_own_orders`, `staff_select_orders`, and `rider_select_assigned_orders` with `ALTER POLICY` and replaces each statement-constant `auth.uid()` with `(select auth.uid())`.
- `supabase/tests/verify_track_b_orders_read_rls_initplan.sql` — disposable 5,000-order fixture (500 owned by Customer) plus one Rider-assigned order; checks authenticated RLS before/after and rolls back all data and DDL.
- This report.

The test ran against the existing disposable local database with `authenticated` role and JWT-subject settings. The representative Customer history-style query selected orders sorted by `created_at` without an explicit owner filter, matching its mounted query shape. Local `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` is safe here because it is a SELECT in the disposable transaction. On the second run: **before** `Index Scan Backward using orders_created_at_idx`, 500 visible rows, 4,501 removed by RLS, execution **3.933 ms**; **after** same index and row counts, Customer check became `customer_id = (InitPlan 23).col1`, execution **0.769 ms**. The earlier run measured **3.144 → 0.725 ms**. Plans also showed fewer reported shared-buffer hits (10,147 → 176 on the second run). Local timing depends on cache and this synthetic distribution; these samples establish a direction and structural initPlan, **not** a hosted speedup claim.

Role visibility in that same transaction: Customer **500 → 500**; active Cashier **5,001 → 5,001**; active Manager **5,001 after**; approved Rider **1 → 1**; inactive Rider **0 after**. The policies' business predicates remain the same. Formal Manager Requests → external Messenger → Receiving → accepted-only posting, Customer checkout, Cashier payments, KDS, and Rider writes were not edited. Production Queue remains retired.

## Verification and limits

| Check | Result |
| --- | --- |
| Hosted catalog, statement/table/index statistics, cron schedule, advisor, lock snapshot, bounded SELECT `EXPLAIN` | **PASS — read only.** |
| Disposable local before/after plan and role visibility; transaction `ROLLBACK` | **PASS.** Two measured runs; no persistent local fixture/policy change. |
| Focused offline Cashier Order List, H-23 Request workflow (40 assertions), Customer financial display | **PASS.** These are source-level checks, not authenticated backend journeys. |
| `npm run typecheck` and `npm run build` on current dirty tree | **PASS.** |
| Hosted deployment or hosted business/RPC/concurrency tests | **NOT RUN** by read-only boundary. |
| Current full-schema clone and authenticated HTTP Customer/Cashier/Manager/Rider acceptance | **NOT RUN.** Local SQL roles/JWT claims cover policy visibility, not GoTrue/PostgREST HTTP or full current schema. |
| Manager Receiving posting, KDS advancement, payment settlement, Rider mutation regression | **NOT RUN.** No relevant write logic changed; no safe current full-schema fixture was established for this bounded task. |

Pre-existing dirty work was preserved. No tracked pre-existing file was changed for this increment. This migration is **local only** and should not be deployed based solely on the synthetic result.

**Next bounded step:** run this exact migration and role/plan test against a current deployed-schema disposable clone, including authenticated HTTP reads for Customer, Cashier, Manager, approved Rider, and inactive Rider, before any separate deployment decision.
