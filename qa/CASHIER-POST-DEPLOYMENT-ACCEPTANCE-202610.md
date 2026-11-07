# Cashier post-deployment acceptance — 2026-10-21

## Executive summary

| Task | Result | Basis |
| --- | --- | --- |
| A — P1 migration history | **PASS for the two P1 versions** | Repository filenames now match the two authoritative hosted versions; supported migration list shows both as applied. Other pre-existing history drift remains. |
| B — Authenticated Cashier acceptance | **BLOCKED** | No browser or authenticated Cashier session was available. The browser inventory was empty and opening an in-app browser returned `Browser is not available: iab`. No sign-in page could be reached. |

Final Cashier browser acceptance remains pending. This run performed only read-only hosted queries, a local filename reconciliation, and documentation changes. It deployed no SQL and made no business-data changes.

## A. Migration-history reconciliation

Linked CLI project ref and `.env.local` Supabase URL both resolved to `zhzluhqvysvsadwuugpa`. The worktree contained extensive unrelated pre-existing modifications and untracked files; these were preserved. The full local migration directory had no collision at either hosted P1 version.

| P1 migration | Local version before | Hosted version | Hosted stored SQL MD5 | Current local file SHA-256 |
| --- | --- | --- | --- | --- |
| Pending-payment shift closure | `20261021143000` | `20261021053249` | `ba5a18d8d3049aeb1768dab7490b81ad` | `c1e7c70635f90360ccd21d8d3005f1a0cfc2e77584b6b6bb301be5150f7bb2f1` |
| Active-profile direct reads | `20261021143100` | `20261021053310` | `863670667a96a8dcb38eec9a747309c6` | `ec46e343f1debd397e8c0bbe6253daa982b64aefadda299ee4b67beec5be9b5c` |

Each hosted migration has one stored SQL statement. The hosted statement matched its canonical local file exactly after excluding the local file's single final newline (both MD5 and SHA-256 matched). The two P1 migrations sort in the same order before the local `20261021120000_restore_closed_cashier_shifts_rpc.sql`; that RPC has no dependency on either P1 migration, and neither P1 file refers to it. The closure migration depends on earlier Cashier/payment schema, and the policy migration depends on earlier profile and financial tables. The rename therefore preserves the executable SQL order for a fresh installation.

**Strategy:** repository reconciliation. Renamed only:

- `20261021143000_cashier_pending_payment_shift_closure.sql` → `20261021053249_cashier_pending_payment_shift_closure.sql`
- `20261021143100_cashier_active_profile_direct_reads.sql` → `20261021053310_cashier_active_profile_direct_reads.sql`

File bytes stayed unchanged. The P1 readiness report now points to the current paths while retaining its historical execution narrative. No migration metadata repair, migration SQL replay, live push, or unrelated history edit occurred.

Before the rename, `supabase migration list --linked` showed the two local P1 versions and the two hosted versions as separate rows. Afterward it showed `20261021053249 | 20261021053249` and `20261021053310 | 20261021053310`, with no old P1 local rows. A read-only hosted history query found exactly those two P1 records and no entries at the old versions. The hosted close function, payment trigger, two active-profile SELECT policies, grants, and six-argument closed-shift RPC remained present after reconciliation. The hosted migration list showed the same unrelated records as before.

CLI `supabase db push --linked --dry-run` explicitly printed that migrations would **not** be pushed, then stopped before producing a plan because nine older remote migration versions are absent locally: `20261019103144`, `20261019205801`, `20261019221405`, `20261020003215`, `20261020003218`, `20261020004843`, `20261020172715`, `20261020174353`, and `20261020201031`. The P1 versions were not in that error list. Other local-only migrations also remain, including `20261021120000`. The dry run cannot establish that a future push is safe overall; the unrelated history drift requires a separate scoped decision. Its suggested repair command was **not** run. One post-rename `migration list` attempt failed with remote CLI login SQLSTATE `28P01`; a single retry succeeded and produced the aligned P1 rows.

## B. Authenticated Cashier workspace checks

The local Vite server started at `http://127.0.0.1:5173/` with the configured hosted project URL. The available computer/browser inventory contained no browsers or apps. An attempt to open the Cashier route in the in-app browser failed before the page loaded. The task-created Vite server was stopped. No Cashier sign-in workflow or authenticated network request could be performed. No account credentials, role state, or client storage were changed.

| Workspace | Read-only interaction planned | Expected | Observed | Result |
| --- | --- | --- | --- | --- |
| Dashboard | Open, inspect shift and queue | Authorized shift and attention state render | No browser session | **NOT TESTED** |
| Pending Payments | View queue, filters, proof/detail controls | Pending GCash visible without mutation | No browser session | **NOT TESTED** |
| Order List | View tabs, filters, details | Orders render and controls navigate | No browser session | **NOT TESTED** |
| Transaction History | View cards/table and read-only receipt preview | Transactions and receipt preview render | No browser session | **NOT TESTED** |
| Shift Settlement | View active shift, closure blocker, saved shifts/details | Open shift and five historical records accessible to authorized Cashier | No browser session | **NOT TESTED** |
| Auth/error handling | Inspect Cashier requests and console | No unexpected 401, 403, or PostgREST errors | No authenticated requests or console | **NOT TESTED** |

## C. Supabase integration evidence

Read-only hosted catalog checks on `zhzluhqvysvsadwuugpa` found:

- `close_cashier_shift(numeric,text,text)`: `SECURITY DEFINER`, `search_path=public, pg_temp`, authenticated EXECUTE granted, anon EXECUTE denied, pending online GCash guard present.
- `lock_pending_gcash_for_shift_closure()`: security invoker, anon and authenticated EXECUTE denied; its `payments` trigger covers INSERT and updates of `status` or `payment_method` when the new payment is pending GCash.
- `cashier_shifts_select_staff` and `cashier_transactions_select_staff`: sole policies on their tables; both SELECT policies require an active current profile and limit Cashiers to own rows while retaining active Manager access.
- `get_closed_cashier_shifts` exists with six arguments, security invoker, authenticated EXECUTE granted and anon denied. **An authenticated RPC response was not tested.**
- One open shift, five closed shifts, one pending online GCash payment, and 28 Cashier transactions were present in a final read-only aggregate. These counts establish current presence, not a before/after financial-data diff.

No authenticated browser/API calls were possible; 401/403/PostgREST runtime behavior remains **NOT TESTED**. No deactivated-user or cross-Cashier JWT test was performed in this hosted acceptance pass.

## D. Responsive spot-check

| Viewport | Order cards, transaction cards, tabs/filters, drawer back controls, receipt preview, desktop tables | Result |
| --- | --- | --- |
| 360 × 800 | Browser unavailable | **NOT TESTED** |
| 390 × 840 | Browser unavailable | **NOT TESTED** |
| 1366 × 768 | Browser unavailable | **NOT TESTED** |

## E. Financial safety and limitations

This run issued no order, payment, shift, receipt, or other business-record mutation; it created no receipt, submitted no cash count, closed no shift, and deployed no new SQL. Hosted record counts were observed once after reconciliation, so changes by other actors during this run cannot be excluded by a before/after comparison. The existing open shift and pending online GCash item were still present at that observation.

The P1 migration mismatch is resolved. The older migration-history discrepancies are pre-existing and outside this task. The authenticated Cashier runtime and responsive checks remain blocked by browser/session availability, not by an observed application authorization failure.

**Recommendation:** accept Task A as reconciled for the two P1 versions. Keep final Cashier runtime acceptance open until an existing active Cashier session can be used to complete the bounded read-only browser checks. Do not run a live migration push while the unrelated history mismatch remains unresolved.

## Manual Authenticated Cashier Browser Acceptance — October 21, 2026

This dated addendum records the owner's supplied manual screenshot observations after the P1 deployment. The earlier agent-run browser inventory and **NOT TESTED** rows above remain an accurate account of that separate attempt. Screenshots support rendered data and controls; this addendum does not claim that this agent inspected authenticated network responses or exercised financial mutations.

| Workspace | Supplied manual screenshot observation | Scope |
| --- | --- | --- |
| Dashboard | **PASS — rendered view.** Active shift, operations/work queue, pending-payment notice, expected drawer balance ₱4,240.00. | No shift action exercised. |
| Pending Payments | **PASS — rendered view.** One pending online GCash submission; `ORD-000061` remained pending; proof image and payment details displayed. | Approval and rejection **NOT TESTED** in this acceptance. |
| Order List | **PASS — rendered view.** Three current orders with statuses and totals; `ORD-000061` still awaited payment; desktop table usable. | Filters and order actions **NOT TESTED** in this acceptance. |
| Transaction History | **PASS — rendered view.** Two completed Cash records, `RCP-000041` and `RCP-000042`, each ₱120.00; completed-sales summary ₱240.00. Pending GCash was excluded. | Receipt printing and live CSV download **NOT TESTED**. |
| Shift Settlement | **PASS — rendered view.** Open shift, ₱4,000.00 opening cash, ₱4,240.00 expected cash, actual cash not counted, one pending-payment closure blocker, five saved closed shifts, expanded details and audit identifiers. | Browser shift closure and server denial **NOT TESTED**. |

### Transaction History Export CSV repair evidence

Source tracing found that the old click handler exported only the currently hydrated `state.transactions` array, which is repopulated from the current-shift sales RPC; it had no independent historical paging and could therefore omit older authorized records. It also exported contact/internal identifiers and had no formula protection or retrieval failure feedback. The corrected handler pages the active Cashier's RLS-governed `cashier_transactions` and linked order/shift rows. Hosted catalog inspection showed `payments` has no direct SELECT policy, so each payment is read through the existing active-Cashier, own-sale `get_cashier_sale` RPC and cross-checked against its transaction. The handler checks profile and count before/after, applies existing filters, uses recorded order totals and transaction classifications, serializes an eight-column UTF-8 CSV with formula protection, and reports loading/empty/error states. No hosted SQL changed.

| Verification | Result | Evidence boundary |
| --- | --- | --- |
| TypeScript typecheck | **PASS** | Local source check. |
| Cashier quality baseline | **PASS** — 11 checks | Existing local script. |
| Transaction History focused script | **PASS** | Existing synthetic filters/summary/audit checks. |
| New export-focused script | **PASS** | Synthetic two-row output, filters, Manila dates, 501-row paging, count mismatch, mocked RLS-scoped query/own-sale RPC links and denial paths, duplicate gate, CSV parse/escaping/formula protection, and download initiation/cleanup scheduling. |
| Authenticated hosted export download | **NOT TESTED** | No browser/session in this agent's environment. The owner's screenshots predate this export correction. |

The previously completed disposable PostgreSQL P1 authorization and four concurrency cases remain separate evidence in `CASHIER-P1-SECURITY-HARDENING-202610.md`. Read-only hosted SQL checks in this report verified deployed objects, while the owner's screenshots establish rendered Cashier views. Neither constitutes a production penetration test or a live payment/closure test. Physical receipt printing, hosted JWT/PostgREST role-denial scenarios, and the deferred P2 closed-settlement snapshot guard remain outside this pass.
