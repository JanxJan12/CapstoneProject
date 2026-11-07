# H-10 workflow UX regression — 2026-10-15 (Manila)

## H-10B final local acceptance — 2026-10-16 (Manila)

**PASS in the preserved isolated stack:** The [H-10B report](H10B-LOCAL-RELIABILITY-AND-RECOVERY.md) and [JSON](H10B-LOCAL-RELIABILITY-AND-RECOVERY.json) record Docker/WSL resource diagnosis, reversible relief, fresh authenticated Chrome response loss after SQL-confirmed commit, same-tab refresh with restored delivery details and **Retry & Check Order**, one-row replay, second-customer/unrelated-request isolation, payment-progression clearing, and final SQL exactness. Orders moved **29→30→31** across the two disposable H-10 orders, with no third order from the isolation run. Seven selected screenshots are linked in the H-10B report. The three temporarily stopped analytics containers were restored and responded at the final immediate health check. Typecheck, build, all 11 quality checks, and 52/52 canonical migration hashes passed. Long-term stability with 94 simultaneous containers and hosted release remain separate from this local PASS.

## H-10A continuation — 2026-10-16 (Manila)

**BLOCKED:** The preserved local stack briefly recovered (Auth HTTP 200, independent SQL count 29), then Docker/Auth became unresponsive. The first H-10A harness attempt stopped at stack status. A second opened fresh Chrome and submitted the synthetic Customer login, but the rendered page stayed at **“Signing in…”** until timeout. Neither attempt made a checkout request or captured a new screenshot. The earlier [post-commit error screenshot](h10-browser-20261015/postcommit-lost-response-error.png) remains evidence only for the prior `ORD-000029` attempt. The [H-10A report](H10A-CHECKOUT-RECOVERY-ACCEPTANCE.md) and [sanitized JSON](H10A-CHECKOUT-RECOVERY-ACCEPTANCE.json) record exact results and the retry boundary.

Source review confirmed that a refresh restored delivery fields but lost the response uncertainty state and **Retry & Check Order** label. The narrowly scoped `src/modules/customer/index.tsx` change persists that state only for network response errors and restores the existing explanation for the same authenticated customer/request draft. `npm.cmd run typecheck`, `npm.cmd run build` (3,017 modules), and `npm.cmd run verify:quality` (11 checks) passed; 52/52 canonical migration hashes matched. Browser replay, account isolation, appropriate clearing, and final SQL exactness remain **BLOCKED**, not PASS. A normal Docker Desktop restart failed with `context deadline exceeded`; existing stacks and volumes were preserved.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | **PASS** | `npm.cmd run typecheck` exited 0. |
| Production build | **PASS** | `npm.cmd run build` exited 0; Vite transformed 3,017 modules. |
| Focused quality baseline | **PASS** | `npm.cmd run verify:quality`: 11 checks. |
| Authenticated Chrome, response lost after commit | **PASS for error presentation and commit checkpoint** | Preserved synthetic stack, fresh Chrome, Customer sign-in and sample modifier cart. `ORD-000029` committed with HTTP 200 at the intercepted response stage; independent SQL saw orders **28→29**, `₱225.00` and the expected one-item modifier snapshot before the response was closed. The new [screenshot](h10-browser-20261015/postcommit-lost-response-error.png) shows the uncertainty guidance. The test was run before the final retry-button text adjustment. |
| Restore details, same-ID replay, post-retry SQL | **BLOCKED** | The first browser attempt stopped after refresh because its expected Cart control was unavailable; it did not complete the replay. Later attempts could not finish local Auth loading or obtain the stack status. Docker engine inspection and SQL intermittently hung/returned HTTP 500. The direct-Checkout recovery and final button label have not been verified in a fresh browser. |
| Permission denial, cross-role navigation, Cashier/Kitchen/Manager/Rider handoff | **NOT TESTED in H-10** | Existing H-09 evidence remains separate. No H-10 server permission or workflow rule changed. |
| Hosted Supabase, real payment, physical Rider device | **NOT TESTED** | Hosted remained read-only; release remains NO-GO under existing gates. |

`qa/h10-browser-20261015/commit-checkpoint.json` records the synthetic order request identity, commit and purchase-time item snapshot. `ORD-000029` is a retained synthetic local fixture from the interrupted attempt. No claim of successful H-10 post-refresh replay is made. The focused harness should be rerun when the preserved H-09 stack is healthy, then verify restored name/contact/address/landmark, unchanged request ID, one order row and unchanged payment/receipt/stock/assignment counts. Do not reset the stack to obtain this result.

A normal `docker desktop restart --timeout 120` was attempted to recover the engine. It exited with `Failed to stop Docker Desktop ... processes still running ... context deadline exceeded`. No forced process termination, volume deletion, database reset, or replacement stack followed. The engine and preserved stack require a health check before the remaining replay can run.

`docker desktop start --timeout 120` then reported `Starting Docker Desktop`. The preserved DB and Auth briefly recovered: DB reported 29 orders with `ORD-000029` last, and Auth returned HTTP 200. A subsequent Chrome run still stalled at local sign-in, the next stack status call failed, and a later SQL check hung. H-10 did not claim sustained stack recovery.
