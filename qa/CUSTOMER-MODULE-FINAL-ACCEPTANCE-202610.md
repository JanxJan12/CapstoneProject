# RRJ’S FOOD-HOUSE — Customer Module Final Acceptance

**Date:** 2026-10-22  
**Decision:** **CONDITIONALLY ACCEPTED for the Capstone scope.** Full production end-to-end acceptance is **not established**.  
**Scope:** Existing local Customer frontend, read-only hosted project `zhzluhqvysvsadwuugpa`, and synthetic disposable PostgreSQL data. No hosted business record was created or changed.

## A. Executive summary

Current Customer quotation, accepted-price enforcement, duplicate protection, and two-Customer ownership tests passed against actual PostgreSQL functions and RLS policies in a targeted disposable fixture. The locally served Customer guest journey loaded the hosted public menu and correctly required sign-in at checkout. The hosted project has the expected deployed migrations and relevant RPCs and grants. There is no confirmed critical or high-severity Customer release defect in the paths exercised.

The current paid Customer-to-Cashier-to-Kitchen-to-Rider/FIFO lifecycle was **not** executed end to end: the targeted fixture lacks the hosted `submit_customer_payment` RPC, and the task prohibited creating hosted orders/payments. Google sign-in, authenticated hosted browser quote/history/tracking, cross-account Storage retrieval, 200% zoom, spoken screen-reader output, and the native file picker also remain untested. Conditional acceptance means the implemented Capstone module may be presented with these limits; it does not certify live operational readiness.

## B. Previous evidence reused

- [Batch 4 implementation](CUSTOMER-MODULE-BATCH-4-UI-UX-IMPLEMENTATION-202610.md): 78 local synthetic browser screenshots at 320, 360, 390, 430, 768, 1024, and 1440 px; no overflow in tested scenes; navigation focus containment, Escape/focus return, reduced motion, quote UI states, and synthetic proof-file validation passed. Batch 1–3, quote, cart, meal, drink, TypeScript, 11 quality checks, build, and scoped whitespace check passed there. These results were reused because production source was not edited in this acceptance run.
- [Quote deployment readiness and outcome](CUSTOMER-PREORDER-QUOTE-DEPLOYMENT-READINESS-202610.md): hosted version `20261022115601`, scoped postdeployment catalog/grant checks, targeted PostgreSQL quote and Cashier/KDS tests, and explicit payment/FIFO lifecycle limits.
- [Earlier isolated lifecycle](CUSTOMER-MODULE-IMPLEMENTATION.md): the 2026-10-13 synthetic Auth/Storage/order/payment/Cashier/Kitchen/Rider script passed on the then-current system. It predates current quotation and modifier retirement, so it is **historical integration evidence**, not a current end-to-end pass.

## C. Final acceptance matrix

| Area | Result | Evidence and exact boundary |
| --- | --- | --- |
| Guest home/menu/product/cart/sign-in gate | **PASS** | Fresh local Chrome profile at `http://localhost:5173/customer`: 20 cards, 12 unavailable, prices rendered, product opened, item added to cart, Checkout showed “Sign in to continue.” Five screenshots and [result](customer-final-acceptance-202610/guest-result.json). No order was placed. |
| Google sign-in, session persistence, logout | **BLOCKED** | Computer-use inventory exposed no browser/app session; no authorized real Customer browser session was available. Synthetic fixture sign-in is not Google OAuth proof. |
| Cart options, price-change UI, validation | **PARTIAL** | Batch 4 fixture browser and Customer regression scripts passed; hosted catalog currently has seven drink choices and zero configured Fixed Meal Options. Live authenticated selections and current price-change UI against hosted data were not run. No rice quantity was inferred. |
| Quote and confirmed order | **PASS in targeted fixture; hosted execution NOT TESTED** | Actual authenticated PostgreSQL RPCs passed ordinary/quantity/mixed/meal/drink pricing, invalid cases, signed accepted total, snapshots, and idempotency. Hosted RPC existence/grants were read directly; no hosted Customer JWT call/order. |
| History, tracking, profile rendered with real session | **NOT TESTED** | Batch 4 populated synthetic browser views and earlier source/regression checks are supporting evidence only. No real Customer session, existing hosted order view, or profile edit was exercised. |
| Two-Customer RLS, privileged RPC denial | **PASS in targeted fixture** | Actual role/JWT SQL calls: each synthetic Customer read own order/items and zero other order/items; cross-profile edit affected zero rows; Customer Cashier and Manager RPC calls failed; anon read zero orders. Fixture grants were temporarily aligned to directly inspected hosted grants inside a transaction and rolled back. |
| Complete current paid operational lifecycle | **BLOCKED** | Quote-created order/items reached pending payment in disposable PostgreSQL. Fixture lacks `submit_customer_payment`; no legitimate payment verification, Kitchen transition, Rider delivery, or FIFO deduction was run for this order. |
| Network/recovery/concurrency | **PARTIAL** | Current PostgreSQL duplicate same-request and catalog/fee change rejection passed. Prior mounted fixture quote, tracking refresh, stale response, and reconnect checks passed. Real network interruption and hosted session recovery were not run. |
| Responsive/accessibility | **PARTIAL** | Batch 4 seven-width fixture run and six measured text/background ratios passed AA normal-text threshold; 200% browser zoom, spoken screen reader, native OS picker remain untested. |
| Regression/build | **PASS, reused** | Batch 4 commands passed; no production source changed since that evidence. Current focused SQL, Chrome guest, and contrast probes passed. |

## D. Authenticated browser results

No authenticated hosted Customer browser test was executed. The available browser automation used a fresh guest Chrome profile. The observed path was Home → Menu → Product → Cart → Checkout sign-in gate, with zero business writes. Google OAuth entry, authorized profile load, session persistence, logout, quote presentation against hosted data, existing hosted History/Tracking, and expired-session behavior are **NOT TESTED**. The local frontend is the deployment surface; there is no public Customer frontend deployment.

## E. Authorization and financial security

The read-only hosted checks confirmed the target project `zhzluhqvysvsadwuugpa` is active and migration versions `20261021144029` (KDS v2), `20261021144109` (Fixed Meal Options), `20261021154712` (Drink Choices), `20261021194914` (modifier retirement), and `20261022115601` (Customer quote). The quote and confirmed writer exist with `authenticated` execution and `anon` denial; the obsolete six-argument writer denies `authenticated`. `submit_customer_payment`, `get_customer_order_payment`, `get_cashier_sale`, `verify_customer_gcash_payment`, `get_kds_queue_v2`, `get_drink_choices`, and `get_fixed_meal_options` exist. Hosted RLS and own-order policies are enabled for orders/items; payment-proof Storage has an own-user/order policy. These are **catalog/policy reads**, not hosted authenticated execution.

In the **targeted disposable fixture**, `supabase/tests/verify_customer_preorder_quote_local.sql` passed under actual `authenticated` role and JWT claims, including quote read-only behavior, server prices/subtotal/fee/total, line snapshots, required drink choice, With/Without Rice, invalid/missing modifiers and choices, client price override, forged/expired/stale token rejection, other Customer/session rejection, inactive/non-Customer denial, old-writer denial, and request idempotency. [Session probe](customer-final-acceptance-202610/session-probe.sql) independently rejected a changed session. [Ownership probe](customer-final-acceptance-202610/ownership-probe.sql) passed two-Customer order/item isolation, self-contact update versus cross-account denial, signed-out order denial, Cashier receipt RPC denial, and Manager drink-choice RPC denial. It rolled back its ACL alignment and synthetic records. Cross-account tracking through the mounted UI, Storage proof retrieval, recipe/inventory response disclosure, and error-message leakage under a real hosted session remain **NOT TESTED**; function shape/source guards are not substitutes for those executions.

The first database clone came from an **older targeted quote rehearsal** and failed the other-session assertion because its token omitted `session_id`. This was a stale fixture mismatch, not a hosted or current migration failure. The test was rerun on `quote_release_rehearsal_20261022`, which contains the reviewed session-bound quote definitions; both the full quote test and focused session probe passed. Earlier ownership-probe attempts encountered missing SELECT/column UPDATE grants in this clone; matching the directly inspected hosted grants within a rollback transaction resolved fixture setup. These preliminary failures are not product failures. This fixture remains a selected-contract rehearsal, **not a faithful hosted-schema, Auth, Storage, or PostgREST replay**.

## F. Payment and operational lifecycle

The current synthetic flow completed an authenticated quote, acceptance, order creation, persisted order items/prices/total, and duplicate-request recovery. A separate concurrency run created one synthetic order in the disposable database. The fixture has an older synthetic payment and historical receipt, but no current `submit_customer_payment` function. Therefore payment-proof submission, Cashier approval of the newly quoted order, paid Kitchen visibility and status progression, Rider assignment/delivery, FIFO stock effects, final Customer History/Tracking, and receipt reconciliation for this newly quoted order are **BLOCKED at payment submission**. They must not be inferred from pre-quote lifecycle evidence or direct status updates. Historical Cashier receipt and KDS v2 RPC compatibility passed in the earlier targeted quote rehearsal, with the documented distinction that the Kitchen test temporarily marked a synthetic order confirmed and rolled back; it did not exercise approval.

## G. Accessibility

The focused local Chrome contrast probe measured six normal-text pairs in the synthetic quote UI: Home primary CTA **4.73:1**, Menu active filter **17.3:1**, Menu product action **17.3:1**, Product primary action **4.73:1**, Cart estimate badge **6.84:1**, and Checkout field label **16.23:1**. All six exceed 4.5:1; [measurements](customer-final-acceptance-202610/contrast-result.json). This is a sample, not a whole-app WCAG audit; error/success/disabled text, images, gradients, and every state were not measured. Batch 4 tested drawer keyboard behavior, visible focus, and reduced motion in a fixture. **NOT TESTED:** actual 200% browser zoom, spoken screen reader, native file picker, and complete keyboard coverage. Synthetic `DataTransfer` proof selection/invalid-file feedback passed earlier; it does not prove OS picker behavior or upload.

## H. Responsive verification

The earlier Batch 4 78-screenshot fixture set covered Home, Menu, Product, Cart, Checkout, Quote Review, Payment, Tracking, History, and Profile at seven viewport sizes with no measured overflow. This run additionally checked the real local guest route at **390×844**, with document width 390 px and usable checkout sign-in gate. A 320 px viewport result is existing fixture evidence. Viewport resizing is **not** evidence of 200% browser zoom.

## I. Network and concurrency

`node scripts/verify-customer-preorder-quote-concurrency.mjs customer_final_acceptance_current_20261022` **PASS**: simultaneous confirmed calls using the same request returned one order; catalog price change and isolated delivery-fee change rejected stale quotes. The fee definition was restored in the disposable database. The quote SQL test also passed expiry, tampering, cart/term change and old-writer denial. Batch 2 and quote UI fixture tests previously passed tracking URL restoration, pending-refresh order-switch handling, quote invalidation, failure states, and reconnect state logic. Real mounted network failure during menu/quote/order submission, ambiguous hosted order timeout, Realtime disconnect/reconnect, and reload/logout with an authenticated hosted Customer are **NOT TESTED**.

## J. Defects discovered

**No confirmed Customer production release defect was found in the executed checks.** The stale first clone and three missing-grant ownership-probe attempts were test-fixture issues. The guest browser harness initially expected an `/auth` redirect; the product correctly showed an inline sign-in gate, and the harness was corrected. The contrast harness initially could not parse `oklch()` computed color and was corrected. These were not product regressions.

## K. Corrections implemented

Only acceptance harnesses, probes, screenshots/results, and this report were added. No Customer production source, SQL migration, hosted object, or operational module was edited in this acceptance run.

## L. Tests and commands

| Check | Final result |
| --- | --- |
| `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/verify_customer_preorder_quote_local.sql` on `customer_final_acceptance_current_20261022` | **PASS** |
| `psql -X -v ON_ERROR_STOP=1 -f qa/customer-final-acceptance-202610/session-probe.sql` on same clone | **PASS** |
| `psql -X -v ON_ERROR_STOP=1 -f qa/customer-final-acceptance-202610/ownership-probe.sql` on same clone | **PASS**; rollback |
| `node scripts/verify-customer-preorder-quote-concurrency.mjs customer_final_acceptance_current_20261022` | **PASS** |
| `node qa/customer-final-acceptance-202610/guest.mjs` | **PASS**; five local guest screenshots, no hosted writes |
| `node qa/customer-final-acceptance-202610/contrast.mjs` | **PASS**; six measured samples |
| Batch 1–3, quote, cart/meal/drink scripts, quote UI fixture, Batch 4 browser fixture, `npm.cmd run typecheck`, `npm.cmd run verify:quality`, `npm.cmd run build`, scoped `git diff --check` | **PASS in preceding Batch 4 run**, reused unchanged source/evidence; not rerun here |
| Current quote→payment→Cashier→Kitchen→Rider/FIFO whole flow; Google OAuth; authenticated hosted browser; Storage cross-account fetch; 200% zoom; spoken screen reader; native picker | **BLOCKED or NOT TESTED** as detailed above |

## M. Data safety

Hosted actions were project, migration, function/grant/RLS/Storage-policy, and catalog **read-only** checks. The local guest browser read the public menu and did not submit an order or payment. All state-changing quote and RLS tests used synthetic data in disposable PostgreSQL; focused SQL tests rolled back. The concurrency test left one synthetic order only in that disposable clone. No real order, payment, stock, financial record, profile, proof object, or hosted schema was modified. Existing uncommitted repository work was preserved. No migration was deployed.

## N. Remaining limitations and approval boundary

The highest-value remaining test is a **current-system authenticated end-to-end acceptance** with an isolated Supabase Auth/Storage/payment stack that includes the hosted payment RPC and supported Cashier/Kitchen/Rider/FIFO workflow, or a separately authorized safe hosted test plan. Also test live Google OAuth/session/history/tracking, cross-account Storage retrieval, real network recovery, 200% zoom, spoken screen reader, and native file picker. Do not create production orders, payments, or proof objects merely to close this report. Any hosted business-data test or backend change requires separate explicit approval. No approval is needed to use this conditional Capstone classification with its stated limits.

## O. Final decision

**CONDITIONALLY ACCEPTED for Capstone demonstration within the executed boundaries.** Current quote and ownership controls passed in a targeted disposable fixture, hosted signatures/grants were directly read, the local guest path passed, and current responsive/regression evidence is favorable. No exercised test demonstrated a release-blocking Customer defect. **Full production acceptance is withheld** because the current paid operational lifecycle and real authenticated browser/security/accessibility scenarios remain unexecuted. Stop at this verification boundary.
