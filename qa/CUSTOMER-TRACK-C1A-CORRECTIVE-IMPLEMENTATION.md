# Customer Track C.1A — bounded corrective implementation

**Date:** 2026-11-03 (Asia/Manila)  
**Result:** **PASS** for the three source-level fixes and local synthetic checks; **PARTIAL** for end-to-end acceptance because no authenticated rendered or isolated database payment journey was run.

## Scope and reproduction

Read `qa/CUSTOMER-TRACK-C1-PAYMENT-LIFECYCLE-INVESTIGATION.md` and the mounted Customer implementation in `src/modules/customer/index.tsx` before editing. The source conditions reproduced the three findings: a waiting order with no payment had next-step text but no payment form; a local resubmission-success string rendered regardless of later payment status; and the rejected-payment label ignored order cancellation. No hosted business rows were queried, and no hosted order, payment, proof, or RPC was mutated. `ORD-000080` was not accessed.

## Files and focused diffs

| File | Change |
| --- | --- |
| `src/modules/customer/index.tsx` | Reused the existing Tracking payment reference/proof form and `submit_customer_payment` call for a waiting, owned order with no payment. It shows recorded order number, total, and configured GCash merchant details. Before proof upload it re-reads the owned order and payment, checks the same ID, recorded total, and eligible state; the existing RPC and Storage policy remain authoritative during races. Kept rejected-payment submission on the same payment row. Tied success copy to pending status and the acknowledged payment version, clearing stale local success state on status/version change. Applied cancellation-aware payment wording. |
| `src/modules/customer/customerPaymentTrackingState.ts` | Added small pure presentation and fresh-record eligibility functions for the three state guards. |
| `scripts/verify-customer-track-c1a.mjs` | Added synthetic regressions for no-payment, pending/verified/rejected/voided notice, cancelled/rejected copy, and same-order/amount/payment recheck. |

The tracked `index.tsx` already had extensive unrelated local changes before C.1A. This implementation preserved them. No migration, new payment page, Cashier module, Kitchen/Rider flow, role rule, or database contract changed.

## Evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run build` | **PASS** (Vite built 3,044 modules; exit 0) |
| `node --experimental-strip-types --test scripts/verify-customer-track-c1a.mjs scripts/verify-customer-payment-input.mjs scripts/verify-customer-batch-1.mjs scripts/verify-customer-batch-2.mjs scripts/verify-customer-batch-3.mjs scripts/verify-customer-drink-cart.mjs` | **PASS**, 9 test groups, 0 failures; four new C.1A state/recheck cases plus existing Customer checks |

The synthetic tests confirm that a fresh waiting/no-payment view exposes the payment action, a stale/no-payment view does not, and pending/rejected/cancelled transitions select consistent notices and labels. Rechecking rejects a changed order, total, payment identity, or payment state before upload. Backend ownership, Storage, RPC, and Cashier decision guards were left intact.

## Limitations and classification

**PASS — bounded source implementation.** All three confirmed presentation defects have direct guards in the active Customer Tracking page. Existing Checkout order creation and same-payment resubmission contracts remain in place.

**PARTIAL — runtime acceptance.** No signed-in browser rendering, real proof upload, payment RPC mutation, Realtime transition, or isolated database payment fixture was run. The tests are synthetic state/eligibility checks, so they do not establish live UI layout, keyboard behavior, hosted contract compatibility, or Cashier verification. Hosted deployment and business data were untouched. Track C.2 was not started.
