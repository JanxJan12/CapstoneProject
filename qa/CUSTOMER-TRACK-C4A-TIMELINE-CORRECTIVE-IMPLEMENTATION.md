# Customer Track C.4A — Non-delivery timeline correction

**Date:** 2026-11-03 (Asia/Manila)  
**Final classification:** **PASS** for the bounded source correction and executed local checks; **PARTIAL** for full acceptance because authenticated rendered-browser verification was **NOT RUN**.

## Executive summary

The active Customer tracker now selects timeline steps from the persisted fulfillment type and order status. A `takeout` or `dine_in` order uses Waiting for Payment Verification → Confirmed → Preparing → Ready → **Completed**. Delivery retains the established Rider stages and shows **Delivered** only when the authoritative order status is `delivered`. No database status, history event, RPC, payment behavior, or other module was changed.

## Original defect, reproduction, and root cause

The mounted Customer route is `src/modules/customer/index.tsx:10,814-822` → `customerTrackingPage.tsx`; `tracking/OrderTrackingPage.tsx` is a disconnected hard-coded prototype. The C.4 investigation identified the active defect at the old `customerTrackingPage.tsx` completion branch. The tracker used the delivery-only `ORDER_STEPS` for every service type and computed `completedOrderStep = (isCompleted || isDelivered) && trackingStep.status === "delivered"`. For a `takeout` fixture with `current_status='completed'`, no Delivered history, and the Delivered row, that expression evaluated `true` and rendered a green check. The pre-edit reproduction command printed `{"fulfillment":"takeout","status":"completed","step":"delivered","history":false,"renderedGreenCheck":true}`. This was a source-level reproduction; no hosted order was used.

The backend enum uses `delivery`, `takeout`, and `dine_in` as fulfillment types (`supabase/migrations/20260825183637_remote_schema.sql:86-90`). Its non-delivery terminal order status is `completed`; delivery completion is `delivered` after the Rider proof flow (C.2 and C.3 reports). Therefore **Completed** is the supported terminal pickup/non-delivery label. No `picked_up` status was invented for takeout; that existing status belongs to the Rider delivery progression.

## Modified files and corrected mapping

| File | Change |
|---|---|
| `src/modules/customer/customerOrderSteps.ts` | Added a five-step non-delivery timeline ending in `completed`, plus two small pure helpers to choose steps and calculate current/completed visuals. The existing delivery `ORDER_STEPS` array remains intact. |
| `src/modules/customer/customerTrackingPage.tsx` | Uses the selected timeline for next-step copy and rendering; removes the `completed`-means-Delivered shortcut. A terminal step now gets a completed check from its **own current status**. |
| `scripts/verify-customer-track-c4a.mjs` | Added fixture tests for completed takeout, authoritative delivery, in-progress non-delivery, cancellation, pending payment, and mounted-source wiring. |
| `qa/CUSTOMER-TRACK-C4A-TIMELINE-CORRECTIVE-IMPLEMENTATION.md` | Records the correction and verification limits. |

For an unusual `fulfillment_type='delivery'` row whose current status is `completed`, the tracker displays **Completed**, without a Delivered or Rider completion claim. The current backend delivery path normally ends at `delivered`; this conservative presentation avoids inferring delivery from a conflicting terminal value. A real inconsistent row would need separate data investigation, not a UI rewrite.

## Behavior matrix and edge cases

| Service type / status | Timeline result | Terminal indication |
|---|---|---|
| `takeout` / `completed` | Shared preparation stages, then Completed; no Rider or Delivered step | Completed check |
| `dine_in` / `ready` | Shared stages, then future Completed | No completion check |
| `delivery` / `delivered` | Existing nine delivery stages, including acceptance, pickup, transit, Delivered | Delivered check from `current_status='delivered'` |
| `delivery` / `completed` | Shared stages, then Completed; no inferred Delivered | Completed check; anomaly remains visible in the order status |
| `takeout` or `delivery` / `cancelled` or `rejected` | Existing cancellation/rejection presentation takes precedence and hides the normal timeline | No terminal completion claim |
| Any service / `waiting_payment_verification` | Payment guidance remains authoritative | Neither pickup completion nor delivery completion indicated |

The existing order and payment status cards, payment submission/resubmission guards, history timestamps, refresh, stale-state handling, and cancellation messaging were not altered. This fix does not change a payment decision or imply payment from fulfillment.

## Test commands and actual results

| Command / check | Result |
|---|---|
| Pre-edit evaluation of the old completion expression with a completed takeout fixture and no Delivered history | **FAIL reproduced:** old UI would render Delivered checked. |
| `npm run typecheck` | **PASS**, exit 0. |
| `npm run build` | **PASS**, Vite transformed 3,060 modules and built successfully; this proves compilation, not end-to-end fulfillment. |
| `node --experimental-strip-types --test scripts/verify-customer-track-c4a.mjs scripts/verify-customer-track-c1a.mjs scripts/verify-customer-payment-input.mjs scripts/verify-customer-batch-1.mjs scripts/verify-customer-batch-2.mjs scripts/verify-customer-batch-3.mjs scripts/verify-customer-drink-cart.mjs` | **PASS**, 14 tests/groups, 0 failures; all five C.4A cases passed. |
| Source inspection: `rg -n 'ORDER_STEPS|customerTimelineSteps|customerTimelineStepState|completedOrderStep' src/modules/customer/customerTrackingPage.tsx src/modules/customer/customerOrderSteps.ts` | **PASS:** mounted tracker uses the service-aware helper; old shortcut is absent; delivery `ORDER_STEPS` remains unchanged. |

The first post-edit focused run had four passing behavior tests and one failing source-wiring assertion because its regular expression omitted a newline allowed by formatting. The assertion was corrected; the complete final run above passed. That assertion failure was in the test matcher, not a product regression.

## Browser evidence and remaining limits

Authenticated rendered-browser verification is **NOT RUN**: no isolated signed-in Customer fixture was safely available in this run. No production order, including `ORD-000080`, was opened or changed to manufacture the scenario. The pure fixture tests and source wiring establish the mapping and mounted use, but do not establish actual browser rendering, Realtime timing, historical inconsistent-row behavior, or a full payment → Kitchen → Rider journey. Those remain **PARTIAL** acceptance boundaries.

## Unchanged contracts and deferred work

No Supabase migration, RPC, hosted database write, or status-history semantic change occurred. Cashier, Kitchen, Manager, Rider web, and standalone Android source were untouched. The C.4 receipt-design decision remains open; this fix does not add a Customer receipt or acknowledgment. The Cashier receipt arithmetic guard from C.4 and the Cashier “Confirm handoff” wording from C.2/C.3 remain deferred to their separately scoped owners. Track C.5 was not started.

**Stopping point:** The bounded Customer correction and report are complete. An isolated authenticated browser check is the next acceptance activity if that environment becomes available.
