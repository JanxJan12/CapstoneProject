# CASHIER-QA-FINAL-01 — final stabilization and acceptance audit

**Date:** 30 October 2026, Asia/Manila. **Scope:** active Cashier frontend, read-only hosted catalog and financial aggregates, existing local regressions. This audit created documentation only. It did not call a state-changing RPC, edit a hosted record, close a shift, or change a database or another module.

## Executive summary and evidence boundary

The current TypeScript check, production build, and nine focused Cashier checks passed. Read-only hosted inspection found one pending GCash payment (ORD-000061), 42 verified payments, 42 completed receipts, and five closed plus one open shift. ORD-000075 remains a verified ₱130 cash sale with ₱500 tender, TXN-000054, and RCP-000054. No new Cashier defect was reproduced. These results establish source and stored-data consistency for the inspected cases; they do **not** establish current authenticated interaction or end-to-end financial behavior.

Computer Use stopped when it could not determine Chrome's current URL confidently enough to enforce its browser policy. No further UI automation was attempted. Current authenticated browser, desktop/mobile, receipt print preview, and physical print are **BLOCKED**. The local Docker Linux engine was unavailable, so disposable database RPC replay is **BLOCKED**. The earlier user-led sale and Stage 1 print PDFs remain historical evidence, not a current browser PASS.

Baseline read: [manual findings](CASHIER-MANUAL-FINDINGS-20261030.md), [adviser E2E](ADVISER-MANUAL-E2E-20261029.md), [OPT-03](CASHIER-OPT-03-20261030.md), [OPT-04](CASHIER-OPT-04-20261030.md), [OPT-05](CASHIER-OPT-05-20261030.md), [FIN-01](CASHIER-FIN-01-20261030.md), OPT-01 print artifacts, OPT-02 POS regression, active Cashier code, and current worktree. The worktree had 345 dirty entries before this audit; they were preserved.

## Active architecture and six-workspace coverage

`src/modules/cashier/index.tsx` mounts Dashboard, Pending Payments, Walk-in POS, Order List, Transaction History, and Shift Settlement under `CashierProvider`. Store/hydration state feeds read views; action APIs call named Supabase RPCs. Client eligibility and validation aid operation; server RPCs remain the financial and authorization boundary. Source inspection below is **not** rendered or transaction acceptance.

| Workspace | Current evidence | Result and limit |
| --- | --- | --- |
| Dashboard | Action queue partitions current/older unresolved orders by Manila date. Payment attention and shortcut use all pending payment actions; ready handoff is distinguished from Kitchen/Rider monitoring. Shift summary, search, filters, age labels, and loading/error paths were inspected; workspace regression passed. | **PASS (source/fixture)**. Actual count, timer, navigation, terminal ownership, empty/loading/error rendering at desktop/mobile **BLOCKED (browser)**. |
| Pending Payments | Pending queue filters `Pending` records and refreshes authoritative online payments on mount. Verify/reject dialogs and stale-version recovery paths were inspected. Hosted ORD-000061 is pending GCash in `waiting_payment_verification`. | **PASS (read-only data and source agreement)**. Proof rendering, decision outcomes, rejection requirement, concurrent/duplicate handling, Dashboard visual parity, and shift-close blocker **NOT RUN as hosted actions**; browser **BLOCKED**. |
| Walk-in POS | Active payment panel offers cash tender/change; operations require cash, zero new discount, and enough tender. Cart/menu, legacy-draft compatibility, sale API and receipt/Kitchen path inspected. OPT-02 regression passed. | **PASS (source/fixture)** for ₱130 exact/excess/insufficient cases covered by the regression. Actual authenticated sale, menu availability refresh, receipt generation, and Kitchen handoff **NOT RUN** this audit. No active note, discount, or GCash entry control was found in the new-sale UI; legacy fields remain in contracts. |
| Order List | Today's Work, All Orders, Older Backlog, combined filters, search, pagination/export, detail/timeline, edit/cancel/release eligibility and action regressions inspected. | **PASS (source/fixture)**. Authenticated navigation, CSV content, operational edit save, release and cancellation **BLOCKED/NOT RUN**. |
| Transaction History | Receipt/order labels, cash/GCash classification, detail/audit fields, filters, CSV export and reprint wiring inspected. Three focused History checks passed. Hosted receipt IDs are populated. | **PASS (source/fixture and read-only identifiers)**. Rendered receipt selection, downloaded CSV, and actual print preview **BLOCKED**. |
| Shift Settlement | Open estimate, verified cash/GCash distinction, amount and variance validation, pending blocker, stale review, close confirmation, RPC error and historical snapshot paths inspected. OPT-05 and FIN-01 fixtures passed. | **PASS (source/fixture and hosted aggregate integrity)**. Actual close/count, long-shift interaction, stored snapshot under post-close mutation and mobile presentation **NOT RUN/BLOCKED**. |

## Stage acceptance and financial reconciliation

| Stage | Current audit conclusion |
| --- | --- |
| OPT-01 | Receipt content is portaled directly under `body`; print CSS hides other body children and gives the receipt 72 mm width. Readable receipt/order identifiers appear in receipt selection. **PASS (source)**; Chrome one-page/receipt-only output **BLOCKED**. Existing PDFs are prior-run evidence only. |
| OPT-02 | New Walk-in POS retains cash tender and change while the active UI has no note, discount, or GCash controls. Legacy fields are still parsed/stored for compatibility. Focused regression **PASS**; current authenticated sale **NOT RUN**. |
| OPT-03 | Paid ordinary Cancel is gated; ready release has confirmation; operational edit is limited to nonfinancial fields in Cashier source. Action eligibility regression **PASS**; actual RPC outcomes **NOT RUN**. |
| OPT-04 | All-date pending-payment action fixes the earlier Dashboard mismatch without altering ORD-000061. Kitchen/Rider monitoring is separate from Cashier actions. Workflow and Order List checks **PASS**; browser parity **BLOCKED**. |
| OPT-05 | Shift estimate/count/variance and review safeguards remain in source. Shift fixtures **PASS**; authenticated close **NOT RUN**. |
| FIN-01 | 23 exact-cent scenarios **PASS**. The legacy client `Refunded` and completed-but-unverified fixture divergences remain conditional; neither is present in current hosted receipts. No proven hosted settlement formula defect was found. Physical paid-outs and refund drawer attribution remain policy/data-model gaps. |

## Cross-module, financial, and security checks

| Boundary | Evidence and result |
| --- | --- |
| Customer → Cashier | Customer source creates/submits GCash proof and exposes `waiting_payment_verification`; Cashier has pending-review RPC paths. Hosted ORD-000061 corroborates a pending order/payment pair. **PASS (source/read-only pair)**; live proof submission and subsequent status propagation **NOT RUN**. |
| Cashier → Kitchen/KDS | `create_walk_in_sale` and verified payment feed paid orders; KDS source reads confirmed/preparing/ready orders and preserves `special_instructions`. ORD-000075 is confirmed and paid. **PASS (source/read-only order)**; independent KDS reception and progression **NOT RUN**. |
| Cashier ↔ Manager | FIN-01 traced active paid cancellation/refund and closed-shift snapshot contracts; this audit found no cancelled order with a verified payment or completed receipt. **PASS (read-only consistency)**; actual refund, reporting and concurrent close **NOT RUN**. |
| Cashier ↔ Rider | Cashier release source targets `waiting_for_rider` for Delivery; Rider source owns assignment, pickup and delivery progression. **PASS (source boundary)**; hosted handoff/assignment **NOT RUN**. |

Fresh hosted read-only checks: payments `pending=1`, `rejected=1`, `verified=42`; transactions `completed=42`; shifts `closed=5`, `open=1`. Counts were zero for completed receipts without verified payment, transaction rows missing order/shift, completed receipts missing readable IDs, closed snapshots missing count/expected/variance or failing `variance = actual − expected`, and cancelled orders retaining a verified payment or completed receipt. ORD-000075 is `confirmed`, ₱130 cash verified with ₱500 received and completed TXN/RCP-000054; computed change is ₱370. ORD-000042 is completed with a verified ₱120 cash payment and completed receipt. These aggregate checks are a snapshot, not full ledger reconstruction or proof of a future refund/close outcome.

The seven relevant hosted RPCs (sale, payment verify/reject, cancel, release, operational edit, close) exist as `SECURITY DEFINER` routines. Catalog text checks found `auth.uid()` and row-locking text in each; sale and verification signatures include request IDs. This is **PASS (catalog presence only)**, not a role-penetration test or proof every branch is authorized/idempotent. Actual negative-role, replay, stale-state, audit-attribution, and concurrent-RPC tests remain **NOT RUN**. No hosted financial operation was invoked.

## Executed regression results

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | **PASS**, exit 0. |
| `npm.cmd run build` | **PASS**, exit 0, 3,040 modules transformed. |
| `node scripts/verify-cashier-workspace.mjs` | **PASS**. |
| `node qa/cashier-opt-02-pos-regression.mjs` | **PASS**; cash/legacy-draft fixture. |
| `node qa/cashier-opt-03-action-regression.mjs` | **PASS**. |
| `node qa/cashier-opt-04-workflow-regression.mjs` | **PASS**. |
| `node scripts/verify-cashier-order-list.mjs` | **PASS**. |
| `node scripts/verify-cashier-transaction-history.mjs` | **PASS**. |
| `node scripts/verify-cashier-transaction-export.mjs` | **PASS**. |
| `node qa/cashier-opt-05-shift-regression.mjs` | **PASS**. |
| `node qa/cashier-fin-01-scenarios.mjs` | **PASS**, 23 scenarios; includes deliberately unsupported/inconsistent fixtures, which are reported as such by the script. |
| `git diff --check -- src/modules/cashier src/styles/theme.css qa/CASHIER-MANUAL-FINDINGS-20261030.md` | **PASS**, exit 0; existing LF→CRLF Git warnings only. |
| Payment decision browser/RPC regression, receipt print, authenticated desktop/mobile | **BLOCKED** by Computer Use URL-safety stop. No current screenshots were captured. |
| Disposable Supabase/PostgreSQL replay | **BLOCKED**; Docker Linux engine pipe unavailable. |
| Hosted payment approval/rejection, sale, release, refund, shift close | **NOT RUN** by data-safety scope. |

Focused scripts and source checks exercise local logic and fixtures; they are not synthetic browser tests. The historical `qa/cashier-browser-regression-20261014.mjs` and `scripts/demo/verify-payment-resubmission.mjs` were not run because their browser/backend preconditions were unavailable and the latter may write business state.

## Confirmed defects, risks, and remediation

**Confirmed new defects:** none reproduced in this audit. The original two-page print and Dashboard payment mismatch were historical user-observed defects with source fixes; current browser acceptance remains blocked. No P0/P1/P2/P3 classification is assigned to an unexecuted behavior.

| ID | Type / priority | Evidence and next requirement |
| --- | --- | --- |
| QA-FINAL-B01 | Acceptance blocker; high | Computer Use stopped on an unverified Chrome URL. Re-run authenticated desktop/mobile navigation and receipt-only single-page print/PDF in a verified safe browser session; capture current screenshots and print artifact. Do not treat prior Stage 1 PDFs as this run's result. |
| QA-FINAL-B02 | Acceptance blocker; high | Docker engine unavailable. In a disposable isolated stack, replay cash exact/excess/insufficient and duplicate request, GCash verify/reject/retry, paid cancel/refund, ready release, close with pending payment, stale review and concurrent close, with authorized/unauthorized roles. Preserve hosted records. |
| QA-FINAL-R01 | Policy/data-model gap; high for production | FIN-01 found no independent cash paid-out/drop ledger or refund payout-drawer attribution. Owner must define same-drawer refund and cash-movement policy before any separately authorized financial-contract design. No current hosted mismatch was proven. |
| QA-FINAL-R02 | Operational risk; medium | A long-running open shift and unresolved payment remain hosted; no age-limit policy is established. Do not close or alter them merely for QA. Decide shift-age operating policy and rehearse closure in isolated data. |
| QA-FINAL-R03 | Integration evidence gap; high | ORD-000075 is paid/confirmed but has not been independently located and advanced in KDS during this audit. Exercise the Customer/KDS/Rider/Manager boundaries with synthetic isolated records and retain order-instruction visibility. |

No speculative UI fix was applied. No known code defect required crossing the Cashier-only boundary. Optional UI refinements should wait for rendered observations.

## Remaining manual acceptance and readiness

The original CASH-P01–P08 list remains open as end-to-end acceptance. **P02 is partially corroborated read-only** here for ORD-000075/TXN-000054/RCP-000054, tender/change, ORD-000042 status, and aggregate relationships; its full item/audit-history review remains. P03 payment decision, P04 closure, P05 current print/export file, P06 actions, P07 duplicate/realtime, and P08 authorization remain unexecuted. P01 KDS handoff is unexecuted. The preexisting report's historical statuses remain unchanged.

| Decision | Result and rationale |
| --- | --- |
| Functional acceptance | **INSUFFICIENT EVIDENCE.** All executed source/fixture/build checks pass and inspected hosted records are consistent, but current authenticated POS, payment decision, Kitchen handoff, receipt print, and close are unverified. |
| Capstone defense readiness | **CONDITIONAL GO.** The demonstrated historical hosted ₱130 cash sale plus current source/fixture results support a controlled rehearsal. Before presenting, use an isolated seeded database, a verified authenticated browser at desktop/mobile widths, a clean test cashier/terminal/open shift, available menu and a synthetic pending GCash order; rehearse ₱130 exact/₱200/₱500/insufficient tender, receipt-only PDF, KDS receipt/ready release, payment decision, and settlement without touching existing hosted business rows. If this rehearsal fails, the decision becomes NO-GO. |
| Production readiness | **NO-GO.** Current payment/order/close authorization and concurrency behavior, physical print, and real drawer movement accounting have not been accepted under operational conditions; FIN-01's cash paid-out/refund attribution policy is unresolved. This is a readiness decision, not a claim of current corruption. |

**Next development action:** first finish the isolated authenticated acceptance matrix and print evidence. Only a reproduced failure should trigger a bounded Cashier patch; the drawer policy/ledger question requires a separate reviewed financial milestone.

**Files changed by this audit:** this report and the appended final section of `qa/CASHIER-MANUAL-FINDINGS-20261030.md`. No source, schema, migration, RLS, or hosted record was intentionally changed.
