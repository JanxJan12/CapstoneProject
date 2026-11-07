# CASHIER-PAY-RECON-05 — Final migration and Cashier acceptance readiness

Date: 2026-11-03. Hosted deployment: **not authorized and not performed**.

## A. Executive summary

Neither remaining gate passed. A fresh, isolated Supabase CLI replay stopped in the first historical migration before reaching the payment-summary migration. A genuine authenticated Cashier Orders table/drawer session could not be established against that failed local stack. The previously completed RECON-04 disposable SQL role and financial tests remain valid within their stated scope; they do not substitute for these two gates. No new defect in the payment-summary implementation was demonstrated.

## B. Full migration replay

- Environment: Docker Engine 29.9.2; Supabase CLI 2.33.9; PostgreSQL 17 configured by `supabase/config.toml`. A temporary project copy at `C:\Users\Janmari\AppData\Local\Temp\rrj-pay-recon05-20261103` used its own project ID and ports 65320–65329. The repository contains **82** ordered migration files; the temporary copy preserved their names and contents. No canonical project configuration or migration was edited.
- Command: `supabase start --workdir <temporary project> -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`. It initialized a new local database and began applying the first migration.
- **FAIL at migration 1/82:** `20260825183637_remote_schema.sql`, statement 490, `CREATE POLICY customer_read_own_payment_proof ON storage.objects`, SQLSTATE `42P01`: `relation "storage.objects" does not exist`. The CLI stopped its temporary containers. No subsequent migration ran in this clean replay.
- Classification: **pre-existing historical migration-sequence dependency**, before the RECON-03 payment-summary migration. This failure does not demonstrate a defect in `20261102193437_cashier_owned_order_payment_summaries.sql`, but it prevents a full-chain PASS.
- The earlier RECON-04 test applied the payment-summary migration successfully to a separate, empty integration-schema clone and verified its signature, privileges, role behavior, and financial mapping. That was a focused compatibility test, **not** full ordered replay.
- Function creation, permissions, business-record preservation, and unrelated RPC signature comparison across the full clean sequence are **NOT VERIFIED** because execution stopped at the first migration.
- Smallest safe remediation: establish and document a supported, reproducible local Supabase bootstrap in which `storage.objects` exists before the first historical schema migration, then rerun the same 82-file ordered replay. Do not rewrite historical migrations or fabricate migration-ledger entries to obtain a pass.

## C. Authenticated Cashier Orders acceptance

| Requirement | Result |
| --- | --- |
| Genuine Supabase Cashier session against backend containing new RPC | **NOT VERIFIED** |
| Historical closed-shift Cash order: table and drawer agree on Cash · Verified and amount | **NOT VERIFIED** in rendered UI |
| Recent verified Cash order: table and drawer agree | **NOT VERIFIED** in rendered UI |
| Pending online GCash remains Pending | **NOT VERIFIED** in rendered UI |
| Unresolved/conflicting evidence remains non-Verified | **NOT VERIFIED** in rendered UI |
| Separate authenticated Cashier cannot see restricted payment details | **NOT VERIFIED** through Auth/PostgREST/UI |
| Order-number click, search, pagination, loading, failed-RPC behavior | **NOT VERIFIED** in browser |
| Network calls, batching, repeated fetches, console errors | **NOT VERIFIED** in browser; source and synthetic batching checked previously |

The fresh local stack failed before it could provide an Auth/API backend with the pending RPC. The separate existing `rrj_current_contract_integration_2026102` API stack was inspected read-only: its `postgres` database has one Order, one Payment, four Auth users, and **no** `get_cashier_order_payment_summaries(uuid[])` function. It is a shared pre-existing integration environment, so no migration or synthetic payment data was added to it. The RECON-04 database contains the new function but is a database clone, not an Auth/PostgREST stack. The canonical hosted backend was not substituted.

No genuine Cashier session was established for this milestone. The frontend did **not** call the new RPC in a rendered browser. No payment badge or drawer was browser-verified. There are no acceptance screenshots or network captures to report.

## D. Security

RECON-04's isolated SQL role-context fixture passed owner-scoped Cashier A/B checks, Manager/anonymous denial, input bounds, and conservative financial cases. This milestone made no security-policy or payment-table grant change. No elevated credential was embedded in the frontend or used for browser acceptance. The current milestone does **not** claim signed JWT or PostgREST authorization proof, because no suitable isolated Auth/API stack with the new RPC was available. There was no unauthorized hosted financial-data access or hosted write.

## E. Source changes

- Created `qa/CASHIER-PAY-RECON-05-FINAL-READINESS.md` (this report).

No application source, migration, previous QA script, Supabase configuration, or unrelated worktree file was changed. The temporary project copy is outside the repository. The payment-summary migration's current SHA-256 is `1EF09A695D217246F45369921CD1BAD06A853DAA733DE7A8D61E340E04B3B3E1`; it was not modified in this milestone.

## F. Regression results and remaining limits

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `node --experimental-strip-types qa/cashier-pay-recon-03.mjs` | PASS |
| `node scripts/verify-cashier-order-list.mjs` | PASS |
| Focused `git diff --check` | PASS; only pre-existing line-ending warnings |

No RECON-04 disposable SQL rerun was needed because its migration and harness were unchanged. Confirmed payment-summary defects: **none in this milestone**. Environmental/replay blocker: missing `storage.objects` during first historical migration. Authenticated browser blocker: no isolated Auth/API stack with the new RPC. Optional device-specific visual testing remains outside this deployment-readiness gate.

## G. Proposed hosted rollout (not executed)

After both gates pass, review the exact migration/hash and dirty repository diff; verify recovery and rollback prerequisites; deploy only the approved payment-summary migration; read back its function definition and `EXECUTE` grants; run non-mutating authenticated Cashier ownership checks; compare historical Orders table/drawer statuses and pending online GCash; stop or roll back the frontend/function if scope or financial consistency fails. Do not use a repository-wide `db push` against the current migration history.

## H. Final verdict

**BLOCKED — MIGRATION OR AUTHENTICATED ACCEPTANCE INCOMPLETE**

The smallest remaining work is to supply the reproducible Storage bootstrap for clean local migration replay, then use that successfully migrated local Auth/API stack for one genuine signed-in Cashier Orders table/drawer acceptance pass. No hosted deployment is authorized by this report.
