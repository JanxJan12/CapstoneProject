# Customer Track C.5 — consolidated browser acceptance and regression verification

**Date:** 2026-11-03 (Asia/Manila)  
**Decision:** **PARTIAL acceptance for the Customer module.** The mounted Tracking and History components passed a fresh loopback-only rendered fixture (Tier 2), and source/unit/build checks passed (Tier 1). A signed-in Customer session against an isolated backend with genuine Auth/RLS, Storage, and payment transitions (Tier 3) was **BLOCKED** because the existing disposable Docker stack was unavailable. The results do not establish production payment or end-to-end acceptance.

## 1. Repository state and prior checkpoints

The canonical worktree at `C:\Users\Janmari\Downloads\Capstone Project` was already extensively dirty. Customer source includes the accepted A–B, C.1A, and C.4A work as untracked/modified local files. This task changed **no production application code**. It added only the QA fixture and this report. No reset, stash, commit, migration, hosted write, or interaction with `ORD-000080` occurred.

Reviewed `CUSTOMER-TRACK-AB-SCOPED-REFINEMENT.md`, `CUSTOMER-TRACK-C1-PAYMENT-LIFECYCLE-INVESTIGATION.md`, `CUSTOMER-TRACK-C1A-CORRECTIVE-IMPLEMENTATION.md`, `CUSTOMER-TRACK-C2-RELEASE-HANDOFF-INVESTIGATION.md`, `CUSTOMER-TRACK-C3-DELIVERY-RECEIPT-CONFIRMATION-INVESTIGATION.md`, `CUSTOMER-TRACK-C4-RECEIPT-ORDER-COMPLETION-INVESTIGATION.md`, and `CUSTOMER-TRACK-C4A-TIMELINE-CORRECTIVE-IMPLEMENTATION.md`. Earlier source PASS and guest/synthetic browser evidence remain historical; this run supplies fresh Tier 2 tracking/history evidence. C.4's prior `completed`-as-Delivered finding is corrected by C.4A and was freshly checked in the browser fixture.

## 2. Actual tested application and evidence tiers

`src/modules/customer/index.tsx:10-18,814-831` mounts `customerTrackingPage.tsx` and `customerHistoryPage.tsx`; Checkout is `customerCheckoutPage.tsx`. The old `customer/tracking/OrderTrackingPage.tsx` and `customer/checkout/CheckoutPrototypePage.tsx` are disconnected prototypes. Tracking reads an owned `orders` row, `order_items`, `order_status_history`, and `get_customer_order_payment` (`customerTrackingPage.tsx:126-152`). History reads orders and items (`customerHistoryPage.tsx:55-130`), relying on backend ownership in the integrated app. Payment display uses `customerPaymentTrackingState.ts`; the service-specific timeline uses `customerOrderSteps.ts`. `src/lib/supabase.ts` normally creates the real client from Vite environment variables; it was replaced only inside the QA fixture build.

| Tier | What ran | Boundary |
|---|---|---|
| **1 — source/unit/build** | Typecheck, production build, 14 relevant Customer test groups, source inspection | No rendered signed-in session or real backend transitions. |
| **2 — rendered browser fixture** | Real headless Chrome loaded the actual mounted Tracking/History components with local synthetic read responses, Customer CSS, and a fake demo merchant. Twelve states at four viewports plus refresh/remount and History navigation | No Supabase Auth, RLS, Storage, actual payment RPC, or genuine order rows. Writer RPC and Storage calls in the fixture throw; Chrome blocked all non-loopback requests. External Google Fonts were blocked, so screenshots use fallback fonts. |
| **3 — authenticated integrated browser** | **BLOCKED / NOT RUN** | The existing disposable demo directory and private role card exist, but `docker info` could not connect to `dockerDesktopLinuxEngine`; no local Supabase API listener was present. The normal `.env.local` URL is non-loopback and was not used for this QA browser. No synthetic hosted account/order/payment was created. |

The fixture is in `qa/customer-c5-fixture/`: `vite.config.mjs` aliases only `@/lib/supabase` to `supabaseMock.ts`, `main.tsx` mounts the production Tracking/History components, and `run.mjs` starts loopback Vite and Chrome, blocks non-loopback requests, asserts rendered states, and saves evidence. It is deliberately **not** a simulation of Auth/RLS. Its synthetic order number is `SYN-C5-001`, not a production `ORD-` record.

## 3. Payment scenarios P1–P5

| Scenario | Tier 2 observed result | Classification and limits |
|---|---|---|
| **P1 — waiting, no proof** | Order and “Not submitted” card rendered; “Pay for this order” contained GCash reference, JPG/PNG proof control, recorded total, and Submit Payment. No rejection notice. | **PASS Tier 2 presentation.** Actual upload/submission and own-order RLS **NOT RUN**. |
| **P2 — pending review** | Payment card read “Awaiting Cashier verification”; order remained Waiting Payment Verification; no initial or resubmission action. | **PASS Tier 2 presentation.** No Cashier decision or Kitchen queue inspected live. |
| **P3 — rejected proof** | “Needs resubmission,” rejection reason “Unreadable proof,” notes, new reference/proof controls, and same-order guidance rendered. | **PASS Tier 2 presentation.** Same-payment-row RPC semantics remain source/catalog evidence, not browser execution. |
| **P4 — state changes** | Mock payment changed rejected → pending; Refresh status removed the resubmission notice. After page reload, the persisted fixture state still showed pending and did not resurrect the old notice. | **PASS Tier 2 refresh/remount presentation.** Real Realtime timing and concurrent payment changes **NOT RUN**. |
| **P5 — cancelled** | Cancelled order and “Rejected before cancellation” took precedence; no Pay or resubmission action. | **PASS Tier 2 presentation.** Actual cancellation authority/refund flow **NOT RUN**. |

The fixture never invoked a payment writer, Storage upload, Cashier verification, or rejection. It does not prove a real payment was pending or verified. The normal source still calls the guarded submission path only after ownership/current-state checks (`customerTrackingPage.tsx:237-443`); those guards are covered by the C.1A source tests, not Tier 3 acceptance.

## 4. Timeline scenarios T1–T6

| Scenario | Tier 2 observed result | Classification |
|---|---|---|
| **T1 — completed takeout** | Timeline ended in green **Completed**; no Rider, Picked Up, Out for Delivery, or Delivered row. | **PASS Tier 2.** |
| **T2 — completed dine-in** | Same non-delivery terminal mapping, without Rider stages. | **PASS Tier 2.** |
| **T3 — delivery in progress** | Rider Accepted, Picked Up, Out for Delivery, and Delivered rows appeared in the delivery timeline; future Delivered was not checked. | **PASS Tier 2.** |
| **T4 — delivered** | Delivered row was checked for `current_status='delivered'`; prior Rider stages remained visible. | **PASS Tier 2.** This is Rider completion, not Customer receipt acknowledgement. |
| **T5 — cancelled** | Cancellation card showed and normal fulfillment timeline was hidden. | **PASS Tier 2.** |
| **T6 — pending payment** | Awaiting Cashier verification remained visible; final non-delivery milestone was not checked. | **PASS Tier 2.** |

The fixture renders the actual `customerTimelineSteps` and `customerTimelineStepState` used by Tracking; the focused C.4A unit tests also passed. The fixture uses synthetic history rows appropriate to each state. It cannot prove the server created those history rows or that an authenticated Customer received them.

## 5. Tracks A–B regression and Customer usability

| Area | Evidence and result |
|---|---|
| Checkout wording | **PASS Tier 1 source:** active Checkout contains “Order summary” and “Confirm order”; the retired “Review your quoted total” wording was not found in the active file. Checkout was **NOT RUN in this browser fixture**. |
| Payment reference and proof constraints | **PASS Tier 1 source/tests:** shared input accepts a trimmed nonempty reference up to 100 characters without a fabricated digit rule; both active entry paths restrict JPG/PNG and 5 MiB. **PARTIAL** for actual file-picker/upload browser behavior, which was **NOT RUN**. |
| Service/payment/order cards | **PASS Tier 2:** separate cards rendered at all four widths; “Service type,” “Not submitted,” “Awaiting Cashier verification,” “Needs resubmission,” and cancellation wording matched fixture states. |
| History → Tracking | **PASS Tier 2:** History displayed the synthetic order and its Track Order action returned to Tracking. Genuine owner filtering is **NOT RUN**. |
| Empty/error/loading | **PASS Tier 2 for empty and read-error states:** “No order to track,” “Unable to load order,” and retry control appeared. Loading was transient and not separately captured. Error mapping against actual PostgREST errors is **NOT RUN**. |
| Responsive/focus | **PASS Tier 2 for inspected states:** 48 scenario/viewport assertions at 360, 390, 768, and 1366 px found no document horizontal overflow. Visible All Orders, Refresh status, and Submit Payment controls met the fixture's 44 px minimum height. Payment form and timeline were visually inspected at 390 px. Keyboard focus order, native upload dialog, 200% zoom, screen reader, and device touch interaction are **NOT RUN**. |

## 6. Browser evidence and safety

The successful final command was `node qa/customer-c5-fixture/run.mjs`: **PASS**, 48 state/viewport checks, P4 refresh/remount, History navigation. `qa/customer-c5-fixture/evidence/results.json` records the inspected state labels and checked steps. Screenshots actually generated and visually inspected: `p1-390.png`, `p1-390-detail.png`, `p3-390-detail.png`, `t1-390-detail.png`, and `t4-390-detail.png` in the same evidence directory. The top screenshots show overview cards; detail screenshots show the payment form/rejection and final timelines. The rendered form uses a fake “DEMO ONLY — DO NOT PAY” merchant. No secrets, production customer details, payment proof, or real GCash reference appear in these files.

The browser intercepted and blocked 14 non-loopback requests, all to `https://fonts.googleapis.com/css2` (the same font stylesheet across scenario navigations). No request to hosted Supabase was made through the fixture. Fallback fonts reduce the visual fidelity of typography; they did not obscure the inspected controls or labels. A first harness attempt waited for an older “Track your order” heading while the current mounted page says “Your order”; after correcting the fixture wait, the state checks passed. A later navigation assertion expected “Your orders” in `innerText` but the rendered label was uppercased; the assertion was corrected to the actual “Order history” heading. These were harness expectation errors, not product failures.

## 7. Test commands and results

| Command | Actual result |
|---|---|
| `npm run typecheck` | **PASS**, exit 0. |
| `npm run build` | **PASS**, Vite transformed 3,060 modules and built successfully. |
| `node --experimental-strip-types --test scripts/verify-customer-track-c4a.mjs scripts/verify-customer-track-c1a.mjs scripts/verify-customer-payment-input.mjs scripts/verify-customer-batch-1.mjs scripts/verify-customer-batch-2.mjs scripts/verify-customer-batch-3.mjs scripts/verify-customer-drink-cart.mjs` | **PASS**, 14/14, zero failures. |
| `node qa/customer-c5-fixture/run.mjs` | **PASS Tier 2**, 48 viewport/state assertions, P4 refresh/remount, History navigation, inspected screenshots. |
| `docker info --format '{{.ServerVersion}}'` | **BLOCKED**: Docker Desktop Linux engine pipe unavailable. No stack start/reset was attempted. |

The tests do not demonstrate authenticated Customer login, backend ownership, RLS under JWT claims, private proof access, real payment submission/resubmission, Cashier verification, Kitchen/Rider progression, or hosted/browser end-to-end correctness. The `.env.local` values were only classified as loopback/non-loopback or set; no key or merchant detail was printed or used by the fixture.

## 8. Defects, risks, deferred scope, and acceptance recommendation

**New confirmed P0–P3 product defects:** none found in the executed Tier 1/Tier 2 checks. The current fixture demonstrates the C.4A non-delivery correction and C.1A payment presentation in a browser, within the stated mock-data boundary. It cannot establish that those paths work with real signed-in sessions or live payment records. That is an **evidence gap**, not a demonstrated failure.

**Remaining risks:** Tier 3 authorization/ownership and same-payment-row transition behavior, Storage limits on actual upload, network/reconnect behavior, Checkout rendering and quote confirmation, true order/payment/Rider status synchronization, native picker, focus, zoom, and screen reader. These remain **NOT RUN** or **BLOCKED** by the absent isolated stack. No severity is assigned without an observed defect.

**Deferred cross-module requirements:** C.2/C.3 Cashier “Confirm handoff” wording; C.4 Cashier receipt component-total guard; owner/adviser decision on a Customer sale-receipt copy; optional Customer delivery acknowledgement; Manager successful-deliveries reporting. None was changed or tested as a C.5 acceptance claim.

**Recommendation:** Accept the bounded Customer presentation corrections for demo use with an explicit **PARTIAL** Customer acceptance label. Do not claim authenticated or production payment acceptance. The smallest next action is to restore or provide an isolated Auth/Storage/Postgres browser environment and run the same P1–P5/T1–T6 cases with genuine Customer and cross-account sessions, plus a separate Checkout and upload journey. Stop at this report; no corrective implementation is authorized here.
