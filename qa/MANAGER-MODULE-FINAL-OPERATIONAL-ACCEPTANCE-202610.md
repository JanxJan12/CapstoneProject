# RRJ’S FOOD-HOUSE — Manager final operational acceptance

**Assessment:** 2026-10-23 (Asia/Manila), canonical dirty worktree and hosted project `zhzluhqvysvsadwuugpa`. **Decision: CONDITIONALLY ACCEPTED for the verified Capstone Manager scope.** No confirmed P0/P1 application defect was found. Current authenticated hosted Manager use, full role execution, and end-to-end financial report output remain unverified; this is **not** production acceptance. No hosted business row was changed.

## A–C. Scope, evidence reused, and decision basis

The active Manager module has Dashboard, Orders, Menu, Stock Overview/detail, formal Requests, Receiving, Stock Movements, Waste, Adjustments, Inventory Audit, Riders, Customers, Reports, Shift Audit, and KDS Settings. Its 15 destinations were rechecked below. General employee-role administration is **not mounted**, so it is outside this current-scope acceptance rather than a presumed failed workflow. Ordinary product/category CRUD is excluded: [MGR-01](MANAGER-MENU-ADMINISTRATION-POLICY-202610.md) remains technically assessed and awaiting restaurant policy. Existing menu availability, meal, and drink controls are within scope.

| Area | Existing evidence and environment | Applicability / remaining runtime gap | Consequence |
| --- | --- | --- | --- |
| Request → Receiving → stock | [2026-10-12 authenticated GoTrue/PostgREST](MAIN-MANAGER-AUTHENTICATED-E2E-20261012.md) and [browser journey](MAIN-MANAGER-AUTHENTICATED-BROWSER-E2E-20261012.md); [2026-10-14 lifecycle](MANAGER-REQUEST-LIFECYCLE-REGRESSION-20261014.md); [2026-10-16 H-16](H16-INVENTORY-WORKFLOW-ACCEPTANCE.md) | **PREVIOUSLY VERIFIED** in disposable snapshots; source smoke and hosted read-only aggregates rechecked today. No current hosted posting was attempted. | Strong isolated core-workflow evidence; hosted operation still unproven. |
| Dashboard usable stock | [Batch 1](MANAGER-MODULE-BATCH-1-IMPLEMENTATION-202610.md), 2026-10-23 calculation and synthetic browser; current calculation rerun | **CURRENTLY VERIFIED** for source/fixture calculation, **NOT TESTED** with hosted Manager JWT. | Separate physical and usable signals remain present. |
| Manager responsive shell | [Batch 2](MANAGER-MODULE-BATCH-2-IMPLEMENTATION-202610.md), 45 synthetic renders at eight widths; current source still has `relative` sidebar | **PREVIOUSLY VERIFIED** for local fixture; no new current authenticated render or 200% zoom. | Measured zero horizontal page pan in fixture remains applicable to same shell source. |
| Financial semantics | [H-07 isolated reconciliation](FINANCIAL-RECONCILIATION-REGRESSION.md), current hosted function bodies and new aggregate queries | **PARTIAL**: current hosted data classification reconciled independently, but actual hosted Manager RPC response/UI and shift-period comparison were not executed. | No observed material misstatement; full financial acceptance remains limited. |
| Menu, Riders, staff | [Manager audit](MANAGER-MODULE-COMPREHENSIVE-AUDIT-202610.md) and Batch 2 synthetic views; current source/contract checks | **PARTIAL**: current hosted writes, role denial across all roles, documents/approvals, and Manager session not exercised. Staff CRUD is not an active destination. | Do not claim hosted mutation or staff-administration acceptance. |

This decision uses the brief's conditional category: substantial executed local core evidence, current read-only invariants, passing focused regressions, and no confirmed high-severity defect. It does **not** use source checks or fixture renders as proof of hosted authenticated behavior.

## D and N. New checks executed on 2026-10-23

All shell commands below ran in `C:\Users\Janmari\Downloads\Capstone Project` against the existing local worktree. These are contract/calculation checks unless explicitly described as browser or database execution.

| Exact command | Environment | Result |
| --- | --- | --- |
| `node --experimental-strip-types scripts/verify-manager-batch-1.mjs` | Local calculation/decoder cases | **PASS**, 17 cases, including physical-sufficient/usable-low and malformed inputs. |
| `node --experimental-strip-types scripts/verify-h22-inventory-overview.mjs` | Local source/calculation verifier | **PASS**, 21 assertions. |
| `node scripts/verify-h23-request-workflow.mjs` | Local source contract | **PASS**, 40 checks. |
| `node scripts/verify-manager-riders-workspace.mjs` | Local source contract | **PASS**, 26 assertions. |
| `node scripts/verify-receiving-posting.mjs` | Local SQL/source contract inspection; no SQL applied | **PASS**, 42/42 checks. |
| `node scripts/verify-manager-shell-navigation.mjs` | Local source/fixture verifier | **PASS**, 21/21. Its own short-lived Vite server exited. |
| `node scripts/verify-h24-manager-navigation.mjs` | Local source verifier | **PASS**, 15 unique mounted destinations and navigation assertions. |
| `node scripts/verify-manager-inventory-workspace.mjs` | Local synthetic fixture/source verifier | **PASS**, 36/36; transient Vite dependency-scan messages appeared while its short-lived server closed, as in [Batch 2](MANAGER-MODULE-BATCH-2-IMPLEMENTATION-202610.md#L61); exit code 0. |
| `node scripts/verify-controlled-foodhouse-inventory-menu-configuration.mjs` | Local SQL/source contract inspection; no SQL applied | **PASS**, 55/55 checks. |
| `npm.cmd run typecheck` | Local TypeScript | **PASS**, exit 0. |
| `npm.cmd run verify:quality` | Local nonworkflow baseline | **PASS**, 11 checks. |
| `npm.cmd run build` | Local production build | **PASS**, 3,036 modules transformed. |
| `git diff --check -- src/modules/manager src/components/layout/AppShell.tsx` | Current pre-existing dirty tracked diff | **FAIL**, one trailing-whitespace line at `src/modules/manager/inventory/InventoryPage.tsx:826`; CRLF warnings were also emitted. This is a nonblocking formatting issue, not a demonstrated workflow defect; no source was edited. |

Direct hosted **SELECT/catalog queries** were executed through the Supabase connector for `zhzluhqvysvsadwuugpa`; no application JWT or Manager RPC call was made. The queries independently grouped payment/order status, computed Manager's fulfillment-date verified-payment projection, counted Cashier completed receipts, inspected function grants/body guard text, compared active inventory physical/usable and batch totals, and reconciled posted receiving lines to linked batches/ledger. The exact read-only SQL and returned aggregate fields are preserved in [the query appendix](MANAGER-MODULE-FINAL-OPERATIONAL-ACCEPTANCE-202610-QUERIES.sql); these are hosted catalog/data checks, not an authenticated UI session. An initial financial SELECT referenced nonexistent `cashier_transactions.total_amount` and returned SQL error `42703`; schema inspection showed receipts link `payment_id`, and the corrected payment join succeeded. No business data changed. No focused application test failed.

## E, J, and L. Authentication and authorization

The [2026-10-12 disposable GoTrue/API test](MAIN-MANAGER-AUTHENTICATED-E2E-20261012.md) signed in synthetic Manager and Cashier identities, executed Manager issue/post and Cashier denials, and denied Cashier profile-role elevation. The [connected local browser](MAIN-MANAGER-AUTHENTICATED-BROWSER-E2E-20261012.md) restored a synthetic Manager session through the real `AuthProvider`, navigated the route, and reloaded a posted receipt. These are **PREVIOUSLY VERIFIED** for that disposable schema, not current hosted OAuth or current hosted authorization. The current Manager route/source still requires `RequireAuth role="manager"`.

Today's hosted catalog shows `anon` lacks EXECUTE and `authenticated` has EXECUTE on sampled Dashboard, Report, stock summary, issue, post, menu setting, and rider read RPCs. Selected function definitions contain active-Manager profile guards. This is **SOURCE/HOSTED-CATALOG VERIFIED**, not runtime denial for Customer, Cashier, Rider, inactive Manager, or an unapproved Manager. Hosted Manager sign-in, Google OAuth, session persistence, sign-out, route denial for each role, private Rider document access, staff/rider approval, waste/adjustment, and Manager report RPC execution were **NOT TESTED** today. No authorized hosted account/session was supplied. The brief prohibits creating or changing hosted accounts.

## F and G. Request, Receiving, Dashboard, and inventory integrity

Previous isolated authenticated execution showed one explicit issue creating one formal request, a linked draft with no stock movement, one post creating accepted-only batches/ledger, a read-only posted receipt, and duplicate-post denial without second stock effect. In [the 2026-10-14 two-receipt run](MANAGER-REQUEST-LIFECYCLE-REGRESSION-20261014.md), cumulative Chicken +4 and Rice +2 matched four linked batches and four receiving entries; actual Messenger communication and physical inspection were outside that synthetic proof. H-16 independently recorded **10 local API/SQL PASS, 0 FAIL, 49 NOT RUN**, including a partial accepted-only receipt and duplicate-post denial. These were not rerun today.

Today's **read-only hosted** inventory projection found **18 active items**, **0 negative physical**, **0 negative usable**, and **0 active batch-managed item/batch balance mismatch**. Physical low-stock count was **10**, and the Batch 1 usable-attention rule also counted **10**; no current item had physical above threshold but usable at/below threshold. The synthetic Batch 1 case did test that distinction (physical 12, usable 3, minimum 8). Hosted `get_manager_dashboard` uses physical `quantity_on_hand <= reorder_level`; the new usable card uses the stock-summary RPC and Stock Overview classification. Today's hosted posted-receiving check found **one posted production-team receipt**, **two lines**, **8.000 accepted = 8.000 linked batch initial = 8.000 linked receiving-ledger delta**, with exactly one batch and one movement per line. This establishes these aggregate invariants on current data; it does not prove a new hosted post or every historical movement chain. Dashboard data was independently projected, not viewed under Manager login.

Stock list/detail, units, batch eligibility, movement timestamps/history, retry, and pagination have prior local source/fixture coverage in the [audit](MANAGER-MODULE-COMPREHENSIVE-AUDIT-202610.md#L39), [Batch 2](MANAGER-MODULE-BATCH-2-IMPLEMENTATION-202610.md), and current workspace verifier. No current authenticated hosted Inventory UI, stale-read race, negative adjustment, or FIFO allocation was executed in this final pass.

## H. Financial reconciliation and report meaning

Hosted `get_manager_dashboard` and `get_manager_sales_report` definitions use **verified payments on successfully fulfilled orders**, dated by Manila fulfillment date (`completed_at` for non-delivery; latest delivered assignment for delivery). Report `total_orders` counts dated successful fulfillments, and average order value divides revenue by fulfilled orders with verified payment. Cashier completed receipts and all currently verified payments are a different grain; pending/rejected payments contribute no collected or Manager fulfilled amount. The function bodies and [metric matrix](FINANCIAL-METRIC-DEFINITION-MATRIX.md) support these semantics.

Today's independent hosted aggregates, on Manila **2026-10-23**, are:

| Classification | Current result | Interpretation |
| --- | ---: | --- |
| Orders total / created today | 49 / 0 | Dashboard today order count projects 0 for the current Manila day. |
| Payment rows: verified / pending / rejected | 28 / 1 / 1 | Pending ₱170 and rejected ₱170 are excluded from collected/fulfilled totals. |
| Currently verified payment amount | ₱4,055 | Current-state payment collection projection; not itself Manager fulfilled revenue. |
| Completed Cashier receipts linked to verified payments | 28 / ₱4,055 | Agrees with currently verified payment amount in this snapshot; receipt-date filters were not exercised today. |
| Fulfilled orders with completion timestamp / with verified payment | 21 / 19 | An order count is not the payment-row count. |
| Verified payments on dated fulfilled orders | ₱2,785 | Manager all-period fulfillment-based projection, **not** a direct authenticated report RPC result. |
| Verified fulfilled amount today | ₱0 | Independent projection for Manila 2026-10-23, not a UI render. |
| Paid but not fulfilled amount | ₱1,270 | ₱170 confirmed delivery + ₱240 confirmed dine-in + ₱860 ready dine-in; exactly ₱4,055 − ₱2,785. |
| Multiple verified payments per order / paid-cancellation rows | 0 / 0 | No observed duplicate-payment inflation or settled paid cancellation in this hosted snapshot. |
| Cashier shifts | 5 closed / 1 open | Shift-level totals/date filters were not reconciled against each shift's saved settlement. |

The prior **₱1,020 collection / ₱880 fulfilled** figures belong to [the 2026-10-14 disposable H-07 fixture](FINANCIAL-RECONCILIATION-REGRESSION.md), where the ₱140 difference was a paid unfulfilled order. They must not be presented as current hosted figures or as a current hosted refund. H-07 also executed a synthetic paid-cancellation/void and shift scenario. Current hosted data has **zero** paid-cancellation rows, so real refund classification and closed-shift historical projection after cancellation cannot be validated from today's records. The isolated [closed-shift regression](H08C-HISTORICAL-SHIFT-REGRESSION.md) established snapshot versus current-receipt divergence after a later void; the owner has not approved a new net-sales or refund-period policy. The hosted report response, its date filter UI, top-item result, and shift-period reconciliation remain **NOT TESTED** today. Financial reporting is **PARTIALLY RECONCILED**, with the observed collection/fulfillment difference explained and no observed misclassification in the queried snapshot.

## I, K, and J. Menu, other Manager controls, and relevant integrations

The mounted Menu supports listing/search/category chips, price display, manual availability, existing Fixed Meal Options, and existing Drink Choices. [MGR-01](MANAGER-MENU-ADMINISTRATION-POLICY-202610.md) excludes unapproved ordinary product/category editing from this gate. Availability remains manual plus stock-derived effective state; Customer/Cashier use active catalog/choice/meal reads, and the quote writer prices from the server. Historical `order_items` store name, unit price, line total, and choice snapshot. These are source/schema contracts and prior focused fixture evidence; no hosted menu toggle, meal/drink mutation, Customer cart, Cashier sale, or Kitchen ticket was created today.

Riders has a mounted Manager review/status workspace and source verifier **26 PASS**. Customer directory is read-only. KDS terminal Settings and Shift Audit are mounted. General employee account/role administration has no active Manager page. Rider approval/status, private signed-document retrieval, KDS terminal provisioning, and staff role changes were **NOT TESTED** in this final pass. Their absence from today's runtime evidence is a limitation; no approval/status was changed. Existing [audit scope](MANAGER-MODULE-COMPREHENSIVE-AUDIT-202610.md#L61) and menu authority report remain the boundary, rather than adding new functionality to pass acceptance.

## M. Browser and accessibility

[Batch 2 synthetic fixture](MANAGER-MODULE-BATCH-2-IMPLEMENTATION-202610.md#L31) executed **45 renders across eight widths** on active page components with zero document-level horizontal scroll reach. It exercised menu table internal scroll, mobile drawer focus restoration, and a rider confirmation dialog without submitting changes. Current source still contains the corrected Manager desktop sidebar `relative` class. The [earlier disposable authenticated browser](MAIN-MANAGER-AUTHENTICATED-BROWSER-E2E-20261012.md) completed the request/Receiving journey but predates Batch 1/2 and did not test current hosted UI. No fresh authenticated browser session was available for this pass; hosted Google OAuth, keyboard-only full journey, 200% zoom, screen reader, and physical-device behavior are **NOT TESTED**. Synthetic fixture results are not hosted browser acceptance.

## O–R. Defects, data safety, and closure

**Confirmed P0/P1 defects:** none in executed checks. **Nonblocking local check failure:** existing trailing whitespace at `InventoryPage.tsx:826` made the scoped `git diff --check` fail; it was not modified in this acceptance task. **Known policy limitations:** MGR-01 menu master-data authority and owner financial terminology/closed-shift presentation are unresolved decisions, not newly established product failures. No new application code, migration, grant, RLS policy, hosted account, request, receipt, order, payment, stock, menu, staff, rider, or Storage record was changed. Only this QA report and its read-only query appendix were added. No new disposable container, volume, or persistent fixture was created, so there is no assignment-owned environment to tear down.

**Final decision: CONDITIONALLY ACCEPTED. Close the Manager development milestone conditionally for the verified Capstone scope.** Carry forward three explicit verification limits into overall integration/defense readiness: (1) authenticated current Manager UI and role/OAuth acceptance; (2) actual hosted Manager report/shift output against same-period authoritative records; (3) live operational external/physical processes, which synthetic request/receiving runs cannot prove. Do not treat this as permission for hosted writes, production release, new menu authority, or changes to financial policy. No new feature batch or comprehensive audit is required by this decision.
