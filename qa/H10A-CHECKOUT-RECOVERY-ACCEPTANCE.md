# H-10A Checkout recovery acceptance — 2026-10-16 (Manila)

**Original H-10A attempt: BLOCKED. H-10B continuation: PASS for isolated local acceptance on 2026-10-16.** The preserved stack was recovered without resetting it. The H-10B [report](H10B-LOCAL-RELIABILITY-AND-RECOVERY.md), [sanitized JSON](H10B-LOCAL-RELIABILITY-AND-RECOVERY.json), [browser result](h10a-browser-20261016/result.json), and [SQL audit](h10b-browser-20261016/sql-audit.json) close the browser/SQL cases below. This section retains the original blocked-attempt evidence as history.

## H-10B closure of H-10A acceptance

**PASS:** Fresh authenticated Chrome committed `ORD-000062` (orders 29→30), independent SQL confirmed it before CDP dropped the HTTP 200 response, and the same tab refreshed with the same customer, request ID, delivery fields, explanation, and **Retry & Check Order** button. Retry returned `ORD-000062` with orders still 30. A second disposable `ORD-000063` (30→31) supported rendered different-customer/unrelated-request isolation and confirmed that one synthetic payment clears recovery storage. Final SQL found one row per request, unchanged ₱175 item and two modifier snapshots, no duplicate receipts, stock movements or assignments, and one pending synthetic payment only for `ORD-000063`. The final order count is **31**. Hosted deployment remains NO-GO separately.

## Existing checkpoint and attempted execution

- Reviewed `H10-WORKFLOW-UX-FINDINGS.md`, `H10-WORKFLOW-UX-IMPLEMENTATION.md`, `H10-WORKFLOW-UX-REGRESSION.md`, and `H09E-POSTCOMMIT-IDEMPOTENCY-20261015.md`. H-09E already proved a committed order with a deliberately lost HTTP response and same-ID replay; it is prior evidence, not a new H-10A pass.
- A normal `docker desktop start --timeout 120` recovered the preserved `rrj_h09_order_flow_20261015` stack briefly. Local Auth returned HTTP 200 and an independent `docker exec ... psql` read returned **29 orders**. The existing H-10 synthetic `ORD-000029` and its prior checkpoint were not altered.
- The first focused H-10A harness attempt stopped at its read-only local Supabase status preflight (`Demo stack unavailable`). After another normal Desktop start, a second attempt opened fresh Chrome on the Customer sign-in page, entered the preserved synthetic local account, and submitted the login form. The rendered page stayed at **“Signing in…”** until the Customer-route wait timed out. It never reached Checkout, made a checkout request, or created a new order. Auth checks also timed out and Docker API calls hung or returned HTTP 500. A normal `docker desktop restart --timeout 120` failed to stop Docker Desktop processes (`context deadline exceeded`). No forced stop, stack reset, volume deletion, or replacement database was used.

## Confirmed application issue and correction

Code review showed that Checkout restored delivery fields after a response-loss refresh, but restored neither the uncertainty explanation nor the **Retry & Check Order** label. The label was derived only from live `deliveryError`, which a page reload cleared. In `src/modules/customer/index.tsx`, the narrow correction records `responseUnknown` in the same customer and request-bound tab draft only for a network response error and restores the existing explanation on reload. Known server errors do not receive the uncertainty message. The draft remains guarded by the authenticated customer ID and matching stored request ID, and the existing successful-payment/progress clearing paths remain in place.

## Acceptance results

| Check | Result | Evidence |
| --- | --- | --- |
| Preserved stack recovery and baseline SQL | **PASS, briefly** | Auth HTTP 200; 29 orders observed before test. |
| New authenticated Chrome order, successful commit, response drop | **BLOCKED** | First preflight timed out; second Chrome sign-in remained at “Signing in…” and timed out before Checkout. |
| Explanation and **Retry & Check Order** after refresh | **BLOCKED** | Source correction built; no new rendered-browser proof. |
| Same customer/request ID and restored delivery details | **BLOCKED** | No new browser request. |
| One existing order returned, purchase-time price/modifier exactness, no duplicate payment/receipt/stock/assignment | **BLOCKED** | No H-10A order exists to reconcile; final stack SQL unavailable. |
| Different-customer and unrelated-request draft isolation; appropriate clearing | **BLOCKED** | Code guard reviewed, browser scenarios unavailable. |
| Typecheck / production build / 11 quality checks | **PASS** | `npm.cmd run typecheck`, `npm.cmd run build` (3,017 modules), `npm.cmd run verify:quality` exited 0. |
| Canonical migration bytes | **PASS** | 52/52 SHA-256 hashes matched the preserved manifest. |
| Hosted Supabase, real GCash, physical Rider | **NOT TESTED** | Outside this isolated test. |

The prior [H-10 response-loss screenshot](h10-browser-20261015/postcommit-lost-response-error.png) documents `ORD-000029` before this correction. **No new H-10A screenshots were captured.** The focused harness for a rerun is `.tmp/h09-stack-20261015/h10a-recovery.mjs`; it requires stable Docker/Auth and must produce new screenshots and SQL evidence before acceptance can be marked PASS.

**Observed database state:** 29 orders at the brief successful SQL baseline; no new H-10A checkout request was sent; final count could not be independently read after Docker became unresponsive. No H-10A correlation ID or order number was generated. The earlier `ORD-000029` request ID is retained in `h10-browser-20261015/commit-checkpoint.json` and must not be treated as a completed H-10A retry.

**Files changed for H-10A:** `src/modules/customer/index.tsx`, `.tmp/h09-stack-20261015/h10a-recovery.mjs`, this Markdown and JSON report, and `qa/H10-WORKFLOW-UX-REGRESSION.md`. No migrations, Rider files, hosted resources, accounting rules, or Manager dispatch behavior changed. The isolated stack, volumes, backups, dirty worktree, and earlier evidence remain preserved. Hosted release remains NO-GO under the existing gates.
