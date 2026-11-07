# Cashier manual findings and deferred backlog — 30 Oct 2026

This is an append-only companion to [Adviser manual E2E](ADVISER-MANUAL-E2E-20261029.md). It records the user-led CASH-01–CASH-30 walkthrough and user-approved future Walk-in POS changes. The earlier adviser report's isolated environment gate remains a separate run: that gate did not execute a Cashier sale or a Kitchen/KDS handoff. This document records observations; it makes no code, schema, UI, or Supabase changes and does not re-run business transactions.

## Evidence and result rules

- **PASS (UI)** means the described state was seen in the Cashier interface or Chrome print preview. It is not a database integrity, authorization, cross-module, or financial reconciliation pass.
- **User report** means the current request supplied the result from the earlier CASH-01–CASH-26 conversation. That step-by-step chat and its screenshots are not available in the referenced conversation, so individual earlier CASH numbers and CASH-F numbers are not reconstructed.
- **Screenshot + chat** means the referenced [Capstone Readiness Reconciliation](chatgpt-conversation://6ada572a-df24-83ec-8f42-a8d3892c5e34) contains a screenshot and interpretation for CASH-27–CASH-30. Four images were copied from temporary chat attachments into [cashier-manual-evidence-20261030](cashier-manual-evidence-20261030/) for durable review. Their filenames identify the matching step. No earlier screenshot path was available.
- **Pending** is a backlog entry or unrun test, not an observed failure. Severity indicates impact if confirmed: **High** for money, payment, receipt, or order integrity; **Medium** for workflow ambiguity or operational friction; **Low** for usability review; **Info** for a verified behavior to preserve. No severity here claims a measured production incident.

## Structured finding log

| ID | Screen | Observation and evidence | Severity | Recommendation | Status |
| --- | --- | --- | --- | --- | --- |
| CASH-01–26 / S01 | Walk-in POS, Transaction History, Order List | User reports a completed **hosted** cash sale: **ORD-000075**, **TXN-000054**, **RCP-000054**; 1 × Chicken Bicol Express **₱130**; cash tendered **₱500**, change **₱370**. The sale appeared in Transaction History and Order List. CASH-27–28 screenshots independently show the order, item, ₱130 total, Confirmed fulfillment, and Verified payment in Order List; they do not show the transaction or receipt IDs. | Info | Retain these IDs as the manual sale anchor; reconcile against hosted records in a separately authorized backend test. | **PASS (UI), user report** for sale and History; **PASS (UI), screenshot** for Order List. Backend/KDS **NOT RUN**. |
| CASH-01–26 / S02 | Dashboard / historical order | User reports **ORD-000042** was released with one click and completed. Earlier screenshot/step mapping unavailable. | Medium | Inspect action label, confirmation, allowed status transitions, and audit trail in a later controlled run. | **PASS (UI), user report** for release/completion; backend transitions **NOT RUN**. |
| CASH-01–26 / S03 | Receipt / Chrome print | User reports Chrome printed **two pages**, including the Dashboard, instead of only the receipt. This is an observed print-layout defect, not a claim about printer hardware or the stored receipt. | High | Scope print CSS/content to the receipt and verify single-page output in Chrome print preview and a real print/PDF check. | **FAIL (UI), user report**; fix **pending**. |
| CASH-01–26 / S04 | Dashboard Verify Payments / Pending Payments | User reports Dashboard **Verify Payments = 0** while dedicated Pending Payments showed **ORD-000061 awaiting GCash review**. Whether counters use different filters, stale state, or an incorrect query is unknown. | High | Trace both definitions and refresh timing; inspect ORD-000061 status before changing either count. | **Observed mismatch (UI), user report**; cause **hypothesis / pending investigation**. |
| CASH-01–26 / S05 | Shift Settlement | User reports pending payment blocked shift closing. Displayed opening **₱4,000**, cash sales **₱1,420**, expected **₱5,420**, and shift age **over 219 hours**. Arithmetic is internally consistent (4,000 + 1,420 = 5,420); ledger and other tender reconciliation were not verified. | High | Verify closing guard and totals against authorized backend records; investigate long-running shift policy without closing this shift as part of documentation. | **PASS (UI), user report** for displayed block/totals; close and backend guard **NOT RUN**. |
| CASH-01–26 / S06 | Walk-in POS / Order List | A test order-level instruction persisted into the recorded order display: **“TEST - No spicy sauce”** on ORD-000075. CASH-28 screenshot confirms the displayed note. Its Kitchen/KDS delivery is unknown. | Info | Preserve historical instructions; check KDS visibility during a separate handoff test. | **PASS (UI), screenshot** for Order List; KDS **NOT RUN**. |
| CASH-01–26 / S07 | Walk-in POS | User approved future removal **only within new Walk-in POS** of item notes, order notes, discount controls, and the GCash payment option. The controls' individual behavior was not established by the available evidence. | Medium | Implement later as a bounded POS UI change; preserve customer GCash, historical backend fields, payments, receipts, Order List instructions, and other modules. | **Approved future scope; implementation pending**. |
| CASH-27 / F88–F91 | Order List | [Screenshot](cashier-manual-evidence-20261030/CASH-27-order-list.png) shows Today's Work **1**, All Orders **61**, Older Backlog **28**, ORD-000075 Confirmed/Verified at **₱130**, 10-minute waiting label, search/filters, Export CSV, Refresh, and LIVE badge. This supports list rendering and new-order visibility only. Dashboard and Order List may overlap by design; LIVE behavior and timer updates were not exercised. | Low | Preserve detailed list view; review navigation overlap and verify live refresh, timers, filters, and export separately. | **PASS (UI)** for rendering/order visibility; behaviors **pending**. |
| CASH-28 / F92–F95 | Expanded Order List row | [Screenshot](cashier-manual-evidence-20261030/CASH-28-expanded-order.png) shows ORD-000075 expanded: Walk-in Customer, dine-in, Confirmed/Verified, 1 × Chicken Bicol Express, **₱130** subtotal/total, “Table not assigned,” test instruction, latest timeline, and link to full timeline. The row provides useful detail; table assignment need depends on restaurant workflow. | Low | Preserve expanded details and historical note; review whether table assignment is needed, without making it mandatory on this evidence. | **PASS (UI)** for expansion/details/note; full timeline **NOT RUN**. |
| CASH-29 / F96–F98 | Order List actions | [Screenshot](cashier-manual-evidence-20261030/CASH-29-action-menu.png) shows **Quick view, Edit, Timeline, Cancel** for paid ORD-000075. Quick view may duplicate the expanded row. Visible Edit/Cancel are investigation prompts, not proof of unsafe mutation. | High | Inspect paid-order edit and cancellation authorization, refund, inventory, status, and audit safeguards in controlled tests. Preserve ORD-000075 for KDS handoff. | **PASS (UI)** for menu; Quick view/Timeline/Cancel outcomes **NOT RUN**. |
| CASH-30 / F99–F101 | Edit paid order | [Screenshot](cashier-manual-evidence-20261030/CASH-30-edit-dialog.png) shows Edit for ORD-000075 with customer name, phone, table number, and order instructions. It states items/payment are unchanged and displays no item, quantity, price, total, or payment editor. Existing name and instruction are populated. Visible restriction is useful; server-side restriction and save effects are unknown. | High | Preserve operational-only editing unless business rules change; test save, history, and server enforcement later. The approved Walk-in POS note removal does **not** authorize removing Order List instructions. | **PASS (UI)** for dialog/visible fields; save/backend enforcement **NOT RUN**. |

## Remaining manual and backend work — all NOT RUN in this walkthrough

| ID | Area | Required check | Priority/status |
| --- | --- | --- | --- |
| CASH-P01 | Kitchen/KDS | Independently locate ORD-000075, verify item and instruction, then observe status handoff. Cashier Order List visibility alone does not establish Kitchen delivery. | High — **NOT RUN** |
| CASH-P02 | Hosted backend | Reconcile ORD-000075 / TXN-000054 / RCP-000054, tender/change, payment and receipt rows, and ORD-000042 status/audit history through an authorized read-only review. | High — **NOT RUN** |
| CASH-P03 | Pending Payments | Test rejected-payment save and state propagation, then reconcile Dashboard count against ORD-000061 and the dedicated queue. Avoid changing a real payment merely to complete this log. | High — **NOT RUN** |
| CASH-P04 | Shift Settlement | Test an authorized shift close in a controlled setting, backend pending-payment guard, cash reconciliation, and long-running-shift handling. | High — **NOT RUN** |
| CASH-P05 | Receipts and exports | Verify print fix, receipt-only page, Transaction History and Order List exports, file contents, totals, and permission boundaries. | High — **NOT RUN** |
| CASH-P06 | Edit and actions | Test paid-order edit save, Quick view, full Timeline, cancellation safeguards, and any other order action only with suitable test records. | High — **NOT RUN** |
| CASH-P07 | Search and duplicate behavior | Exercise search/filter details, repeated submissions, duplicate orders/transactions/receipts, refresh/realtime behavior, and idempotency. | High — **NOT RUN** |
| CASH-P08 | Authorization | Verify role and server-side field restrictions for order edit, cancellation, payment decisions, receipts, exports, and shift operations. | High — **NOT RUN** |

The four POS removals and receipt-print correction are **deferred implementation work**. No result in this log authorizes a hosted write, a schema change, or a modification to another module.

## CASHIER-OPT-02 implementation follow-up — 30 Oct 2026

This section supersedes the implementation-pending status of S07; the original observation above remains unchanged. The active Walk-in POS now has no item or order note entry, discount entry, discount summary row, or GCash choice. New walk-in sale payloads use cash and no discount or order note. Restored drafts and reopened held orders reset hidden payment and discount choices to cash and none. Stored historical notes, discounts, GCash payments, receipt display, and the existing database/RPC shape remain available to their existing readers.

Verification status and evidence for this follow-up are recorded with the CASHIER-OPT-02 engineering report. The original S01–S06 observations and P01–P08 outstanding checks remain separate; this change does not establish a new hosted sale, payment reconciliation, physical print, or Kitchen/KDS handoff.

| CASHIER-OPT-02 check | Result and boundary |
| --- | --- |
| TypeScript and production build | **PASS** on the current worktree. |
| Focused POS logic | **PASS**: synthetic ₱130 item accepts ₱130, ₱200, and ₱500 cash with ₱0, ₱70, and ₱370 change; ₱129 is rejected. Legacy GCash and discounted form values are rejected; an old saved draft resumes as cash with no discount or order note. Fixed-meal and drink-choice cart checks pass. |
| Chrome component rendering | **PASS (synthetic local)**: Choice, Review, and Payment panels render without note, discount, or GCash entry controls. Cash tender and change render for all four amounts. [Review](cashier-opt-02-evidence-20261030/review.png) and [₱500 tender](cashier-opt-02-evidence-20261030/payment-500.png) screenshots are retained. |
| New hosted transaction, receipt, and Kitchen/KDS handoff | **NOT RUN**. No hosted business record was changed for this stage. |

Remaining risk: the synthetic panel checks do not exercise an authenticated full POS sale or server-side transaction and Kitchen handoff. P01–P08 remain open as listed above. Stage 3 remains deferred.

## CASHIER-OPT-03 follow-up — 30 Oct 2026

The Stage 3 lifecycle matrix, implementation, and evidence are in [CASHIER-OPT-03 engineering report](CASHIER-OPT-03-20261030.md). This follow-up supersedes the Stage 3-deferred sentence above without changing the original walkthrough evidence.

| Backlog item | Current status |
| --- | --- |
| CASH-29 paid ORD-000075 showed ordinary Cancel | **Fixed in Cashier UI**: paid/verified or transaction-backed orders no longer offer ordinary cancellation; the hosted `cancel_order` financial guard was confirmed read-only. Actual cancellation rejection was **NOT RUN**. |
| ORD-000042 one-click release to Completed | **Fixed UI safeguard**: contextual handoff confirmation added. Hosted audit confirms its earlier Ready → Completed cashier transition was consistent with the release RPC. New browser click path **BLOCKED** by unavailable browser host. |
| CASH-30 paid operational Edit | **Preserved**: customer/contact/table/address/instructions remain within the operational edit RPC; item/payment fields remain outside it. Late Kitchen instruction delivery requires policy/integration clarification. Actual edit save **NOT RUN**. |
| Timeline actor ambiguity | **Improved display**: recorded account ID, exact known Kitchen terminal transition, or honest unknown system/terminal attribution. Historical events unchanged. |
| P01–P08 and hosted acceptance | **Open** except the read-only status/audit corroboration for ORD-000042/075. No hosted state-changing tests, physical print, or Kitchen handoff were performed in this stage. |

## CASHIER-OPT-04 follow-up — 30 Oct 2026

The [OPT-04 engineering report](CASHIER-OPT-04-20261030.md) records the impact map, source definitions, changed files, and regression evidence. This follow-up preserves the original CASH-27 screenshot and user observations above.

| Backlog item | Current outcome |
| --- | --- |
| Dashboard “No orders need attention” alongside overdue Kitchen work | **Corrected in source**: Cashier Actions Today now contains only payment verification and Ready handoff; current Kitchen/Preparing/Rider work and threshold crossings appear as monitoring. Empty text points to ongoing or older work. Browser recheck **BLOCKED**. |
| CASH-27 Today’s Work / All Orders / Older Backlog | **Preserved**: Manila-date views and terminal-history scope remain separate. Older unresolved orders and payments stay discoverable. Older age alone no longer labels an order as current delayed work. |
| Waiting-time and overdue wording | **Corrected in source**: Order List states time since placement and review threshold; Dashboard states time in current stage. Same-status operational edits no longer restart the stage clock. The existing thresholds were not changed. |
| Search and filters | **Improved in source**: Dashboard lookup and Order List share order/customer/phone/item search. Order List gained a payment-status filter, and Needs Payment includes Rejected. Existing combined filters, pagination, refresh, and CSV remain. Browser interactions **BLOCKED**. |
| Raw account UUID in timeline | **Improved in source**: current Cashier name/role is resolved from their authenticated session; other actors retain a neutral label with ID in technical hover detail. Cashier RLS does not authorize arbitrary profile-name resolution. |
| OPT-01/02/03 and P01–P08 | **Preserved in source/regression coverage**; authenticated browser and cross-module acceptance remain open. No hosted order or financial record was changed. |

## CASHIER-OPT-05 follow-up — 30 Oct 2026

The [Shift Settlement engineering report](CASHIER-OPT-05-20261030.md) records the source-of-truth map, pre-edit impact map, code changes, and verification. Original manual observations remain unchanged.

| Backlog item | Current outcome |
| --- | --- |
| CASH-P04 shift close and cash reconciliation | **Improved Cashier UI**: open-shift figures explicitly say estimate; cash/GCash and refund components are separated; two-decimal, nonnegative counts and cent-rounded variance are validated; review invalidates on changed shift/estimate/pending status; repeat clicks and RPC errors are handled. Actual hosted close **NOT RUN**. |
| Pending payment blocker | **Preserved**: restaurant-wide scope is stated and Review Payments action remains available. Other backend checks can still reject closure. |
| Long-running shift | **Preserved warning**: no automatic closure or calendar-day split. Restaurant age policy remains undecided. |
| Historical settlement | **Preserved read-only**: stored snapshot, date filter and pagination code inspected; authenticated browser checks **BLOCKED**. No historical record was altered. |
| Financial definition gap | **Open, separate authorization needed**: browser estimate subtracts local Cash refunds; closure RPC uses verified completed Cash payments. Refund/reversal reconciliation and Manager cross-check require a separate financial contract decision and isolated backend regression. |
| OPT-05 verification | TypeScript, build, and focused Cashier source/fixture regressions **PASS**. Browser control **BLOCKED**; hosted financial mutation **NOT RUN**. |

## CASHIER-FIN-01 follow-up — 30 Oct 2026

The [financial contract reconciliation](CASHIER-FIN-01-20261030.md) supersedes the *hypothesis* in OPT-05 that an active cash refund necessarily causes an extra deduction. The original manual observations and OPT-05 implementation record remain intact.

| Backlog item | FIN-01 outcome |
| --- | --- |
| OPT-05 browser-versus-closure refund formula | **No demonstrated hosted settlement defect.** Active paid cash cancellation requires the original shift open and voids the original payment/receipt. The current-shift browser hydrator reads completed receipts; the closure RPC counts completed receipts with verified payments. Hosted status enum has no `refunded` value, and read-only hosted inspection found zero paid cancellations/voided receipts and zero completed-unverified receipts. A synthetic legacy `Refunded` row or inconsistent completed/unverified row reproduces conditional divergence; neither was observed hosted. |
| Physical drawer and refund timing | **Open policy/data-model gap.** Manager attests a full completed refund with method/reference but no independent payout-drawer or cash-movement record. Same-drawer practice, cash drops/paid-outs, post-close cash refund, and partial refunds require owner policy and separately authorized backend design. No hosted refund or shift close was executed. |
| Saved settlements | **Read-only PASS for current aggregate comparison:** five closed shifts' stored expected amounts equal opening plus current verified completed Cash receipts; active shift's source projection is ₱5,585, not a saved close. Prior local GCash-after-close test showed current receipt projection can change without changing historical snapshot. Hosted post-close mutation test **NOT RUN**. |
| Cashier wording | **Updated in source:** receipt-based estimate and legacy refund classification are explicit; empty legacy refund rows no longer imply a physical payout ledger. No formula or financial RPC changed. Rendered browser check **NOT RUN**. |
| FIN-01 verification | **PASS:** typecheck, build, 23 isolated exact-cent scenarios, focused Cashier regressions, and read-only hosted catalog/aggregate checks. Disposable PostgreSQL RPC replay **BLOCKED** by unavailable Docker engine; hosted financial mutation **NOT RUN**. |

## CASHIER-QA-FINAL-01 follow-up — 30 Oct 2026

The [final Cashier QA report](CASHIER-QA-FINAL-20261030.md) records this audit's current evidence, all six workspaces, cross-module boundaries, test outcomes, and three independent readiness decisions. Earlier manual observations and stage reports remain historical evidence; no hosted business row was changed.

| Backlog item | Final audit outcome |
| --- | --- |
| Current local regressions | **PASS:** TypeScript, production build, Cashier workspace, POS, actions, Dashboard/Order List, Transaction History/export, shift fixtures, and 23 FIN-01 scenarios. `git diff --check` passed with only line-ending warnings. These are source/fixture checks, not authenticated end-to-end proof. |
| CASH-P02 hosted anchor | **Partially corroborated, read-only:** ORD-000075 has verified ₱130 Cash, ₱500 received, completed TXN-000054/RCP-000054, and an open shift; change computes to ₱370. ORD-000042 is completed with verified Cash and a completed receipt. Full item/audit-history review remains. |
| CASH-P03 Dashboard/payment parity | **Source and hosted data agree:** Dashboard payment attention covers all dates; hosted ORD-000061 is still pending GCash and awaiting verification. Current rendered count, proof, and approve/reject transition **BLOCKED/NOT RUN**. |
| CASH-P01, P04–P08 | **Open as authenticated acceptance:** KDS handoff, isolated shift close, current receipt print and downloaded exports, order actions, duplicate/realtime behavior, and role/field authorization. Do not use existing hosted business records to manufacture proof. |
| Browser/print | **BLOCKED:** Computer Use stopped because Chrome's current URL could not be verified confidently. No current desktop/mobile screenshots or print PDF were captured. Earlier Stage 1 print artifacts are historical. |
| Disposable database | **BLOCKED:** local Docker Linux engine unavailable; no isolated RPC replay was run. |
| Confirmed new defects | **None reproduced.** Do not label unexecuted workflows as failures. FIN-01 physical cash paid-out/refund drawer attribution and long-running-shift policy remain separate operational gaps. |
| Functional acceptance | **INSUFFICIENT EVIDENCE** pending current authenticated core workflows. |
| Capstone defense readiness | **CONDITIONAL GO** only after a successful isolated seeded, authenticated desktop/mobile rehearsal covering Cash POS, receipt-only print, KDS handoff, payment decision, release, and settlement. |
| Production readiness | **NO-GO** pending operational authorization/concurrency and drawer-movement acceptance, physical print, and owner policy. This is not a finding of current financial corruption. |

## CASHIER-IA-01 follow-up — 30 Oct 2026

The [Orders & Receipts implementation report](CASHIER-IA-01-20261030.md) records the pre-edit impact map, exact frontend changes, deployed History RPC boundary, tests, and outstanding browser acceptance. Earlier Cashier findings and readiness decisions remain historical and were not overwritten.

| Backlog item | IA-01 outcome |
| --- | --- |
| Primary navigation | **Implemented in source:** one Orders & Receipts destination with Orders and Receipts & Sales tabs. F4/F6 and Dashboard/internal aliases reach the intended view; old `/cashier/order-list` and `/cashier/transactions` URLs resolve to canonical protected paths. |
| Operational and financial capabilities | **Preserved in source:** Order List and History keep separate hooks, filters, actions, pagination, export, receipt detail/reprint, and the authorized paginated historical RPC. No backend or financial contract changed. |
| Contextual links | **Implemented in source and pure checks:** Find receipt uses an on-demand own-history RPC page and exact cashier/order/transaction IDs; View linked order requires exact human/database order IDs in the operational store. Missing/inaccessible financial rows do not create a receipt or reveal another cashier's record. Current authenticated clicks **BLOCKED**. |
| Data loading | **Improved in source:** opening Orders does not mount the historical History query; visited tabs retain local state. The shared Cashier provider's existing operational refresh remains. |
| Local regressions | **PASS:** TypeScript, build, new navigation/authorization-link checks, ten existing Cashier scripts, and disposable PostgreSQL 17 History RPC assertions. Existing Docker integration containers were preserved. |
| Browser and visual acceptance | **BLOCKED:** browser access host unavailable. Desktop/mobile screenshots, focus and Back behavior, live contextual links, current CSV/reprint, and closed-shift History screen need a verified authenticated session. |
| Acceptance | **CONDITIONAL GO for implementation; browser acceptance pending.** This does not supersede CASHIER-QA-FINAL-01's functional/defense/production readiness decisions. |

## CASHIER-DATA-01 — read-model follow-up (30 October 2026)

Local implementation and evidence: [CASHIER-DATA-01-20261030.md](CASHIER-DATA-01-20261030.md). Order List now marks unlinked payment evidence as unknown; Transaction History has a prepared own-Cashier historical page/filter/count/CSV contract, recorded delivery fees, and hosted-supported Completed/Voided presentation. `ORD-000003` and `ORD-000007` remain delivered online orders with no linked payment or receipt in the read-only hosted check; no record was changed. The new RPC migration is **unapplied**, so live History acceptance is **PENDING**. Recheck signed-in Cashier A/B isolation, no-open/closed shifts, CSV parity, details/reprint, and print output after a separately authorized bounded deployment. The browser check in this run was **BLOCKED** by mismatched accessibility/screenshot targeting. Existing CASH-P05/P08 acceptance remains open.

## CASHIER-DATA-01C — pagination hardening follow-up (30 October 2026)

[CASHIER-DATA-01C-20261030.md](CASHIER-DATA-01C-20261030.md) records the correction of the DATA-01B `NULL` page-parameter bypass in the **unapplied** migration. Disposable PostgreSQL 17 direct authenticated calls now prove at most 100 returned rows, exact page/total counts, stable order, `22023` for invalid limit/offset inputs, separate Cashier A/B ownership, and historical closed-shift access without an open shift. Typecheck, build, and focused Cashier checks passed. **Local review GO; hosted deployment remains separately authorized and NOT RUN.** Hosted A/B, browser, CSV, print, and performance acceptance remain open.

## CASHIER-DATA-01D — bounded hosted deployment follow-up (30 October 2026)

[CASHIER-DATA-01D-20261030.md](CASHIER-DATA-01D-20261030.md) records the authorized deployment of only the corrected history RPC SQL to hosted project `zhzluhqvysvsadwuugpa`. Supabase recorded migration version `20261030042437` (name `cashier_owned_transaction_history_read_20261030034730`). Post-apply catalog checks confirmed the owner, definer/search-path settings, reviewed body, and execute grants; read-only role/claim probes confirmed page errors, anonymous/profile denial, stable order, and closed-shift reads. No business row changed. **Deployment COMPLETE; acceptance PARTIAL.** Only one hosted Cashier exists, so real Cashier A/B isolation, signed-in screen and CSV, and receipt/reprint/print checks remain **NOT RUN**.

## CASHIER-RECEIPT-01 — thermal receipt follow-up (30 October 2026)

[CASHIER-RECEIPT-01-20261030.md](CASHIER-RECEIPT-01-20261030.md) records the shared recorded-data receipt model and compact monochrome 80 mm layout. The existing body-level receipt-only print isolation was retained. Chrome produced one 80.1 mm PDF page for each of three synthetic cash, many-item, and GCash fixtures; the long receipt grew vertically, and screen captures show readable wrapping and totals. Typecheck, build, focused POS/history, and dedicated receipt checks **PASS**. Actual signed-in Cashier print preview remains **BLOCKED**; physical thermal printer and 58 mm support are **NOT RUN**. CASH-P05 remains open for authenticated/physical receipt acceptance. No hosted record or backend contract changed.

## CASHIER-RS-01 — Receipts & Sales read-only investigation (30 October 2026)

[CASHIER-RS-01-20261030.md](CASHIER-RS-01-20261030.md) audits the active Cashier-owned historical receipt workspace. It recommends retaining lookup, detail, reprint, filtered CSV, and exact order navigation, while simplifying page-level analytics and the redundant one-choice Cashier filter. Source review found that “Most sold item” and “Average basket” can use incomplete operational-store orders, the detail basket recomputes line amounts despite stored line totals, and audit attribution uses the current Cashier name instead of the recorded payment verifier. These are **confirmed source presentation risks**, not observed hosted financial corruption. Read-only hosted inspection found 42 completed transactions, 0 voids/cancellations, 0 linked order/payment amount mismatches, and the deployed history function's owner/active/sort/ACL guards. Typecheck, build, and focused checks **PASS**. Signed-in Cashier A/B, interactive receipt/CSV, and printer acceptance remain **NOT RUN**; CASH-P05/P08 stay open. This milestone changed documentation only.

## CASHIER-RS-02 — Receipts & Sales implementation (30 October 2026)

[CASHIER-RS-02-20261030.md](CASHIER-RS-02-20261030.md) records the bounded frontend correction. The visible summary now states its page/Completed scope and omits incomplete basket/item rankings. The one-choice Cashier selector is removed while the deployed RPC owner checks and legacy pure export filter contract remain. Historical detail prefers recorded item line totals, shows meal choices/modifiers, hides zero discount, and warns about item/subtotal disagreement. Audit timeline uses recorded account IDs only in expandable details and neutral actor labels in ordinary view. Shift options load once per Cashier session. Typecheck, build, focused Cashier/History/CSV/receipt scripts **PASS** after a legacy-adapter compatibility fix. Authenticated browser checks are **BLOCKED** because browser access host is unavailable; cross-Cashier runtime and physical print remain **NOT RUN**. CASH-P05/P08 stay open. No backend or hosted business record changed.

## CASHIER-SS-01 — Shift Settlement investigation (30 October 2026)

[CASHIER-SS-01-20261030.md](CASHIER-SS-01-20261030.md) maps the active Cashier opening, count, closure, and saved-history path plus read-only hosted schema/RPC evidence. The final server formula is opening cash plus verified completed Cash payments on the exact shift, rounded to cents; GCash stays separate. In this snapshot, one shift was open for about 236 hours, five were closed, and one restaurant-wide pending online GCash request blocked closure. No completed-unverified receipt, cross-owner transaction/shift mismatch, or invalid saved variance was found. These observations do not establish a hosted financial formula defect.

| Backlog item | SS-01 finding and next gate |
| --- | --- |
| Opening float and terminal | **P2 UX / policy:** Start pre-fills ₱4,000 without recorded handoff and permits free-text terminal selection. Require deliberate float confirmation in proposed SS-02; owner must define float and terminal assignment before changing authorization. |
| Pending payment and long shift | **P2 operational:** Backend checks pending online GCash restaurant-wide; current UI blocks count entry while pending. Retain the guard, improve resolution/escalation guidance, and decide long-shift/handover policy. Do not auto-close the current shift. |
| Physical drawer and refunds | **P1 policy-dependent:** no independent cash payout/drop movement record; Manager refund attestation alone does not prove which drawer paid cash. Establish whether cross-drawer payouts occur before considering a new ledger or formula. |
| Stale estimate and history | **P2/P3:** browser expected cash is provisional; server recomputes at closure. Closed expected/count/variance are persisted snapshots, but as-closed Cash/GCash components are not separately stored. Preserve snapshots and improve retry copy; decide whether additional audit facts are required. |
| Regression and access | **PASS:** typecheck, build, focused Cashier scripts, and read-only hosted catalog/aggregate checks. **NOT RUN:** fresh disposable shift/concurrency replay and hosted state changes. **BLOCKED:** current authenticated desktop/mobile browser because Computer Use host was unavailable. Prior screenshots are historical only. |

SS-02 is a proposed Cashier UI and recovery pass, with separate owner decisions for terminal assignment, float handoff, stale pending payments, refund drawer attribution, duration, and discrepancy approval. This investigation changed only this backlog and the SS-01 report; no application code, migration, database object, or hosted business record changed.

## CASHIER-SS-02A — Shift Settlement design (31 October 2026)

[CASHIER-SS-02A-20261031.md](CASHIER-SS-02A-20261031.md) reconciles the owner-approved Cashier-led, end-of-duty settlement policy with the active Shift Settlement contract. The existing server already owns exact-shift verified Cash receipt inclusion, final expected cash, nonzero variance reason, one-open-shift limits, restaurant-wide pending online GCash guard, and saved closure snapshots. A Cashier-only frontend SS-02B can safely improve opening-float entry, cash count/variance hierarchy, blocker guidance, and uncertain-response recovery without changing those rules. It has **not** been implemented in SS-02A.

| Backlog item | SS-02A design result |
| --- | --- |
| Duty completion and long shift | Shift ending is a Cashier-initiated, actual-timestamp event; no schedule/expiry/handover state exists. The current hosted open shift was about 249.9 hours old at the read-only check. Add guidance, not automatic closure; define late handover policy before backend changes. |
| Opening cash and terminal | Remove the unexplained ₱4,000 default in proposed SS-02B and ask the Cashier for the physical float. Terminal is free text with one-open-per-terminal uniqueness, not proof of a physical-drawer assignment. Assignment enforcement needs policy and backend authorization. |
| Pending payment | The RPC checks pending online GCash restaurant-wide, including older/unrelated orders. Local UI counts hydrated Pending rows and can differ from that predicate. Preserve the server block in SS-02B; compare restaurant-wide, shift-scoped, and exception handling only as policy options. |
| Drawer movement | Current Manager refund attestation and receipt void do not identify the physical payout drawer. A movement ledger/formula change is deferred until the owner confirms same-drawer refunds, drops, transfers or paid-outs. |
| Verification | **PASS:** typecheck, build, focused Cashier shift/FIN/history tests and corrected read-only hosted checks. **NOT RUN:** new disposable concurrency replay and current signed-in browser/keyboard/mobile review. The first read-only query **FAIL**ed on a nonexistent column and was corrected; no hosted row was changed. |

Proposed SS-02B increments A–C are frontend presentation/recovery work; historical presentation is optional increment D. Backend/payment-scope, accounting, terminal-authorization, and handover decisions remain separate. This SS-02A task changed documentation only and did not begin SS-02B.

## CASHIER-SS-02B — Shift Settlement frontend implementation (31 October 2026)

[CASHIER-SS-02B-20261031.md](CASHIER-SS-02B-20261031.md) records the Cashier-scoped implementation. Start Shift now requires an intentional opening-cash entry, including explicit ₱0, and rejects amounts with more than two decimals. The active page and close dialog put the provisional Cash drawer estimate, physical count, and Balanced/Shortage/Overage result first; GCash is clearly excluded. Pending-payment wording names the Cashier queue and the separate restaurant-wide server check. The long-shift warning gives end-of-duty guidance without inventing a schedule. Confirmed success displays returned saved values; an uncertain close response triggers read-only shift/history checks and blocks another submission until refresh. Saved closed-shift retrieval and financial formulas were not changed.

| Backlog item | SS-02B status and remaining gate |
| --- | --- |
| Opening amount and precision | **Implemented; focused fixture PASS.** Blank/whitespace/nonnumeric, negative, excess precision and >₱100,000 reject; zero and valid cents accept. Real duplicate-click, backend rejection, and terminal authorization **NOT RUN** in authenticated browser. |
| Count, variance and confirmation | **Implemented; arithmetic fixtures PASS.** Exact/short/over, zero count, exact-shift Cash and GCash exclusion pass locally. Real dialog focus, notes, stale review and saved-result click **NOT RUN**. |
| Pending-payment guidance | **Implemented in source.** Existing local block and server RPC unchanged. Queue freshness, other-Cashier pending ownership and resolution need authenticated/disposable acceptance. |
| Uncertain close response | **Read-only recovery fixture PASS.** Live interrupted-RPC and two-close race **NOT RUN**; no automatic close retry is introduced. |
| Desktop/mobile browser | **BLOCKED for authenticated acceptance:** available Windows browser windows were unrelated Opera pages; no signed-in Cashier target or new screenshot. No hosted financial mutation was attempted. |
| Backend/policy | Cash refund drawer attribution, late handover, terminal assignment, and payment-blocker scope remain deferred to owner policy and separately authorized backend work. No schema/RPC/RLS/hosted row changed. |

Typecheck, build, focused shift/FIN tests and broader Cashier workspace/POS/orders/history/export scripts **PASS**. Local implementation is ready for authenticated browser and isolated RPC acceptance; production readiness is not established by these source checks.

## CASHIER-SS-02C — Shift Settlement usability refinement (31 October 2026)

[CASHIER-SS-02C-20261031.md](CASHIER-SS-02C-20261031.md) records the bounded frontend refinement. The End Shift flow retains its existing nonmutating review and explicit final close stages; buttons now say **Review settlement**, **Back to cash count**, and **Confirm and close shift**. The payment warning is concise with a disclosure distinguishing the Cashier queue from the restaurant-wide server predicate. Essential Cash figures remain visible; secondary explanation/metrics are expandable. Header, notes, scroll area, and footer spacing are reduced without removing count, variance, reason, or notes. No financial contract or hosted record changed.

**PASS:** TypeScript, build, SS-02C source/fixture checks, SS-02B, OPT-05 Shift, FIN-01 (23 local scenarios), POS, OPT-04 workflow, RS-02, IA-01, scoped diff whitespace. **INFERRED:** review has no closure callback; final action retains stale/duplicate/recovery guards, based on source assertions. **PASS (read-only browser):** signed-in local Cashier page showed active shift, provisional Cash estimate, GCash exclusion, and saved history. **BLOCKED:** concurrent user input prevented opening the modal via computer-use. **NOT RUN:** actual dialog interactions, keyboard/responsive inspection, hosted close, and disposable final-close replay. A controlled browser session and disposable settlement fixture remain the acceptance gates.

## CASHIER-DB-01 — comprehensive necessity and elimination audit (31 October 2026)

[Primary report](CASHIER-DB-01-20261031.md) and [column](CASHIER-DB-01-COLUMN-MATRIX-20261031.csv), [object](CASHIER-DB-01-OBJECT-INVENTORY-20261031.csv), and [elimination](CASHIER-DB-01-ELIMINATION-REGISTER-20261031.csv) evidence inventory 20 hosted Cashier-linked tables, 246 columns and 397 scoped catalog objects. Confirmed elimination candidates are two unmounted Cashier shift components, one of each pair of duplicate `profiles` and `riders` timestamp triggers, and one equivalent own-profile SELECT policy after disposable role replay. The old `get_current_shift_walk_in_sales()` RPC has no active web/Rider source caller, but external consumer clearance is still required. Manager approval fields, rejection reason/notes overlap and old discount fields remain conditional or policy-dependent; no financial table or column is confirmed safe to drop.

Current read-only hosted aggregates found 42 completed verified receipts and zero orphan links, owner mismatches, completed/unverified-or-mismatched payments, malformed closed variances or cancelled verified payments. This is a data snapshot, not a live financial/concurrency or authenticated A/B acceptance. Typecheck, build, Cashier workspace regression and 23 FIN-01 synthetic scenarios passed. No implementation, migration, hosted business mutation, shift action or container operation occurred. The first proposed implementation increment is deletion of the two dead source components only, after separate approval and focused regression.

## CASHIER-DB-02A — verified dead-code elimination (31 October 2026)

[Implementation report](CASHIER-DB-02A-20261031.md): independent route, import, export, test and build checks confirmed `ShiftAuditTable` and `ShiftReportDialog` have no active consumer. The table's sole helper `ShiftOutcomeBadge` was also orphaned. All three source files were deleted, and unused report selection/totals were removed from `useShiftSettlement`; shared settlement utilities and live Cashier/Manager history remain. Measured reduction: 3 files and approximately 407 current source lines; post-edit build output remained 93 files and was 1,196 bytes smaller. This is code/bundle-size evidence, not a runtime performance claim.

**PASS:** typecheck, build, Cashier workspace, SS-02B/C, OPT-02/03/04/05, FIN-01, DATA-01, RS-02, recorded receipt, Order List, Transaction History and CSV export focused scripts. **BLOCKED:** no authenticated RRJ Cashier browser window was available for UI inspection. **NOT RUN:** hosted payment/shift mutations, physical printing and disposable integration replay. No database object, migration, financial formula, hosted business row or cross-module source was changed. Database-level candidates remain deferred to separately authorized DB-02B.

## CASHIER-DB-02B — database object elimination validation (31 October 2026)

[Investigation and migration design](CASHIER-DB-02B-20261031.md) independently verified the two hosted duplicate timestamp-trigger pairs and the duplicate own-profile SELECT policy. A disposable PostgreSQL 17 replay passed before/after timestamp updates on profiles and riders, plus positive/negative profile access for Customer, Cashier, Manager, Kitchen, Rider, inactive, unknown/no-claim and anon cases. Proposed first local migration batch is exactly `trg_profiles_set_updated_at`, `trg_riders_set_updated_at`, and `profiles_view_own`; hosted reductions remain **zero** until separately authorized deployment. The existing local October 13 cleanup migration is absent from hosted history and must be reconciled before implementation. Shared `set_updated_at()`, the retained triggers, `profiles_select_own`, Manager visibility and profile update policy remain necessary.

The legacy `get_current_shift_walk_in_sales()` RPC is **RETAIN TEMPORARILY / EXTERNAL CLEARANCE REQUIRED**: hosted `pg_stat_statements` shows **113 PostgREST calls** since its 2026-08-04 reset, despite no active web/Rider source caller or SQL/Cron/Edge reference. Aggregate telemetry cannot identify or date the caller. No RPC drop is approved. **PASS:** hosted read-only catalog/dependency/telemetry inspection, disposable A/B replay, web typecheck/build, Cashier and Rider focused tests. **NOT RUN:** full hosted schema replay, concurrency/performance benchmark, authenticated cross-module acceptance, hosted deployment. **BLOCKED:** legacy caller identity and last-use clearance. Only QA documentation/replay files changed; no hosted schema/business row or application behavior changed.

## CASHIER-DB-03A — controlled local elimination migration (31 October–1 November 2026)

[Local migration and acceptance report](CASHIER-DB-03A-20261031.md): CLI-created `20261031155629_cashier_db_03a_remove_redundant_profile_rider_objects.sql` removes only the two named duplicate timestamp triggers and `profiles_view_own` policy. Its exact guards accept both known trigger states (hosted pair present or both already removed by the earlier local October 13 migration), reject partial/drifted states, and retain all other policies, functions and RPCs. **PASS:** a current-schema clone with 36 public tables applied the migration; timestamp/RLS A/B behavior, catalog fingerprints and restoration of all three definitions passed. Source/fixture regressions passed across Customer, Cashier, Manager/Rider, FIN-01, web build/typecheck and Rider 26/26 tests. **FAIL:** full 71-file history replay stops before DB-03A at the pre-existing Phase 2A recipe FK (`SQLSTATE 23503`, missing inventory item `b467aeba-d158-4c6d-b43b-1b71a60910c4`). The old migration was not rewritten. **NOT RUN:** signed-in hosted application flows, Kitchen/KDS E2E, concurrent benchmarks and deployment. **Decision: LOCAL ACCEPTANCE ONLY**, pending clean-history, ledger, recovery and authenticated acceptance gates. No hosted schema/business record or app code changed.

The disposable schema-clone container was removed. Automatic command review rejected recursive removal of the exact temporary CLI replay directory, which remains under the Windows Temp folder with copied migrations and a schema-only dump; no replay service remains running. See the primary report for its path.

## CAPSTONE-MIG-01 — clean migration replay root cause (1 November 2026)

[Root-cause and remediation design](CAPSTONE-MIG-01-20261031.md): an unchanged Phase 2A migration at position 13/71 inserts 18 recipe links before any of their 10 menu and 12 inventory parent UUIDs are installed by the first 12 migrations. A fresh Supabase PostgreSQL 17 prefix had the validated PKs/FKs but zero category/menu/inventory/recipe rows; running the exact Phase 2A first statement reproduced `23503` at file line 125, `menu_ingredients_inventory_item_id_fkey`, missing Chicken inventory UUID `b467aeba-d158-4c6d-b43b-1b71a60910c4`. Hosted read-only catalog now has all 10/12 parent IDs and 18 recipe pairs, but current rows do not establish pre-Phase-2A provenance. **ROOT CAUSE CONFIRMED:** missing approved historical master-data baseline, not a missing table, key or FK.

Diagnostic copies only, with the first recipe INSERT omitted, reproduced a later `42704` unqualified `cashier_shift_status` return type; qualifying its two declarations in the diagnostic copy reached a later `P0001` requirement for exactly one Chicken/kg row. Neither diagnostic is an approved repair. Preferred next increment is an owner-approved, hashed category/menu/inventory baseline applied only to a new unlinked database after the first 12 unchanged migrations, followed by the unchanged Phase 2A recipe migration and a separately reviewed enum compatibility strategy. **BLOCKED:** provenance/opening-stock approval and complete clean replay. **NOT RUN:** hosted mutation, historical edit, app implementation. Only this QA report and manual findings changed.

## CAPSTONE-DB-ARCH-01 — Cashier shift Manager-approval columns (1 November 2026)

[Focused architecture decision](CAPSTONE-DB-ARCH-01-20261101.md): both `cashier_shifts.manager_approved_by` and `manager_approved_at` remain **RETAIN TEMPORARILY**. The Cashier-owned ordinary close workflow has no Manager approval step or active writer, and hosted aggregates found 0/6 nonnull values for each field. The deployed, authenticated `get_closed_cashier_shifts` RPC nevertheless exposes both fields and reads them from the table; hosted statement statistics show 27 PostgREST calls without client/field attribution. A disposable current-schema clone proved that dropping either column while leaving that RPC intact yields `column s.manager_approved_by/at does not exist` for an authenticated Cashier. The rollback-only probe restored both columns, the FK and empty fixture state. No migration or source edit was made: actual structural reduction is **zero**, preserving the financial and authorization contract. Next gate is business/external-consumer clearance and a reviewed RPC compatibility path, followed by isolated financial and role acceptance. No hosted schema or business record changed.

## CAPSTONE-DB-ARCH-03 — structural selection (1 November 2026)

[Selection report](CAPSTONE-DB-ARCH-03-20261101.md): ranked four bounded opportunities. The best next batch is retirement of the two old Manager-request `p_reason` issue/revise RPC overloads while preserving current writers and historical revision JSON. Active Manager source uses the newer signatures, but hosted workload recorded two old issue-signature calls and two of five revision snapshots contain historical Reason. **No drop is cleared yet**: identify/migrate the old caller and confirm Reason is no longer required for new requests. Discount metadata, table assignment and menu imagery have unresolved business/contract decisions; financial discount amount is retained. Expected reduction after separate clearance and implementation is two functions; actual reduction now is zero. This milestone changed documentation only and made no hosted schema/data write.

## CAPSTONE-DB-ARCH-04 — legacy Manager request RPC clearance (1 November 2026)

[Clearance report](CAPSTONE-DB-ARCH-04-20261101.md): the two old `p_reason` issue/revise overloads are independently **RETAIN TEMPORARILY — EXTERNAL CLEARANCE**. Hosted catalog confirmed four exact signatures, their owner/ACL/definition fingerprints and the adapters' Reason validation plus revision-JSON writes. The current Manager client uses the new signatures. Two authenticated PostgREST-shaped old issue calls remain unattributed; no revise calls were observed, which does not clear unknown external consumers. Five revision snapshots include two nonblank historical Reasons; the register RPC still projects them, although the current Manager page does not render that field. No migration, caller edit, disposable DROP/restoration, hosted schema/data write, or historical rewrite occurred; reductions are **0 local / 0 hosted**. One next gate: obtain an owner-approved supported-client inventory and explicit retirement decision for each old signature, accounting for the two observed issue calls.

## CAPSTONE-DB-GOV-01 — supported-client and RPC retirement governance (1 November 2026)

[Owner-ready proposal](CAPSTONE-DB-GOV-01-20261101.md) distinguishes the owned canonical web source, internal Rider Android APK, active Rider push Edge/Cron integration, local QA utilities, historical builds, and unknown external clients by evidence and deployment status. No published supported-client registry or API sunset policy was found. The old `p_reason` issue/revise overloads remain exposed to authenticated clients; the two cumulative old issue calls cannot identify a caller or last use, and no observed revise calls do not clear external risk. Proposed policy supports owner-approved web/APK releases and registered integrations, with per-signature consumer, history, authorization, notice, owner-risk and separate hosted gates. **No policy was adopted and no RPC became eligible for deletion.** Only governance documentation changed; no hosted or runtime mutation occurred. Next action is owner review of the five concise client, legacy-build, RPC, unknown-caller and approval-authority decisions.
