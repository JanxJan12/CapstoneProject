# CASHIER-DATA-01C — RPC pagination hardening

**Date:** 30 October 2026, Asia/Manila. **Decision:** local pagination correction **PASS**; eligible for a separate, explicitly authorized bounded deployment review. The migration remains **UNAPPLIED**. No hosted schema, data, financial rule, or UI navigation was changed.

## Scope and exact files changed

- `supabase/migrations/20261030034730_cashier_owned_transaction_history_read.sql` — explicitly rejects `NULL` limit and offset with SQLSTATE `22023`. Existing limits remain 1–100 rows and offset 0–10,000. The active Cashier check, both ownership predicates, deterministic `created_at DESC, id DESC` sort, `SECURITY DEFINER`, empty search path, and execute grants remain as prepared.
- `qa/cashier-data-01-rpc-checks.sql` — adds direct `authenticated` RPC calls with 105 extra closed-shift rows, actual page counts, order checks across a timestamp tie and page boundary, invalid input checks, and a separate Cashier B isolation check.
- `qa/CASHIER-DATA-01C-20261030.md` — this report.
- `qa/CASHIER-MANUAL-FINDINGS-20261030.md` — appended backlog entry.

The existing worktree had extensive unrelated modified and untracked files before this task. Those were preserved. `qa/cashier-data-01-rpc-setup.sql` was read and used unchanged.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Disposable PostgreSQL 17: setup → exact prepared migration → SQL assertions | **PASS** | Docker container was created solely for this test and removed. `psql -v ON_ERROR_STOP=1` completed all three files. |
| Direct authenticated row counts and order | **PASS** | Cashier A had 107 matching closed-shift rows and no open shift. Limit 100 returned exactly 100 rows; offset 100 returned exactly 7, with total 107 on both calls. Limit 1 returned one row. Offset 10,000 returned zero rows with total 107. The combined pages were checked for descending timestamp and UUID tie-break order. |
| Invalid pagination | **PASS** | `NULL`, zero, negative, and 101 limits; `NULL`, negative, and 10,001 offsets each raised `22023`. Thus direct callers cannot turn `LIMIT NULL` into an unbounded page. |
| Authorization and isolation | **PASS locally** | Existing checks deny inactive and anonymous callers; Cashier A cannot search Cashier B's receipt. After the large fixture insert, Cashier B's direct call returned only its one own row. Cashier A's historical rows came from a closed shift without an open shift. |
| Focused Cashier source checks | **PASS** | `node qa/cashier-data-01-read-model.mjs`; `node scripts/verify-cashier-transaction-history.mjs`; `node scripts/verify-cashier-transaction-export.mjs`. |
| TypeScript and production build | **PASS** | `npm.cmd run typecheck`; `npm.cmd run build`. |
| Hosted deployment and authenticated A/B runtime | **NOT RUN** | This task did not connect to or modify hosted Supabase. Previous DATA-01B catalog evidence is not a fresh drift check. |
| Hosted browser, CSV, receipt preview/print, performance timing | **NOT RUN** | These require the separately authorized deployment and suitable authenticated acceptance environment. |
| Full historical migration replay | **NOT RUN** | The disposable test applied the focused fixture and target migration only. |

The first disposable run of the expanded test failed because the fixture insert was attempted under `authenticated`, which lacks direct table INSERT. The test now inserts as the disposable database owner, then switches back to `authenticated` for every direct RPC assertion. The corrected test passed on a fresh container.

## Deployment gate and remaining risk

**Local GO for review; hosted deployment remains NO-GO without separate explicit authorization.** SHA-256 of the corrected migration: `6F28DA33590DAC3E82A08BE4A4ED59B3F2995E4D3A09518C7BFBE3505B4B702D`. Before deployment, recheck hosted schema/function absence, owner and ACL dependencies, and divergent migration history; apply only this reviewed migration through a bounded migration-aware operation. Do not run an unscoped `supabase db push`. After deployment, verify actual authenticated A/B calls, inactive/anonymous denial, closed-shift history, CSV and print, and query performance. The prior DATA-01B rollback order still applies: revert the dependent frontend before dropping this function if rollback is required.

The pagination cap is enforced for direct calls, but offset pagination can still shift during concurrent writes. The CSV client checks total stability but cannot detect equal-count reorder. This is a separate consistency limitation, not a reason to loosen the server-side bound.
