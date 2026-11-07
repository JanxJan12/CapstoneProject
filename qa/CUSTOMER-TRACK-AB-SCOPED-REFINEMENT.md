# Customer Track A–B scoped refinement — 2026-11-03

## Executive summary

**PASS for the bounded Customer source change; PARTIAL for rendered acceptance.** The active Customer checkout now calls its quote panel **Order summary**, uses **Confirm order** for the order-writing action, and explains the GCash reference field consistently on first submission and resubmission. The initial submission now checks the backend's 100-character limit before upload. Tracking names the selected fulfillment method **Service type**, identifies Cashier verification as the payment gate, and tells a customer without a payment claim to submit one. The existing order, payment, Storage, quote, and lifecycle writers were left intact. Browser access was unavailable, so rendered changes were not newly verified.

## Current architecture and active screens

`src/app/routes.tsx` loads `CustomerApp` at the Customer route. `src/modules/customer/index.tsx` owns the active landing, menu and item customization, cart, checkout, order tracking, history, and profile views; it uses local Customer helpers for quote state, financial display, status badges, URL state, and cart checks. `src/modules/customer/checkout/CheckoutPage.tsx`, `landing/LandingPage.tsx`, `menu/MenuBrowsePage.tsx`, `cart/CartPage.tsx`, and `tracking/OrderTrackingPage.tsx` are disconnected prototypes and were not edited. The active checkout calls `quote_customer_order`, then `place_customer_order_confirmed` only after confirming a current quote. The resulting order is stored for the GCash step; proof is uploaded to private `payment-proofs`, then `submit_customer_payment` records the claim. Tracking and history read the customer's authoritative order/payment records, with status updates from the existing refresh path.

Previous evidence reviewed: `qa/CUSTOMER-QUOTE-UI-FINALIZATION-202610.md`, `qa/CUSTOMER-MODULE-FINAL-ACCEPTANCE-202610.md`, and the Customer Batch reports. Those checks establish earlier fixture and guest-browser coverage, not fresh browser acceptance of this patch.

## Adviser feedback reconciliation

| Requested item | Classification and result | Finding / correction |
| --- | --- | --- |
| Replace active “Take Order” | **NOT APPLICABLE** | No active Customer instance exists. Staff wording was untouched. |
| Rename quote section | **PASS — confirmed issue corrected** | The active green panel said “Review your quoted total”; it now says “Order summary.” The server quote amounts and review step remain. |
| Commit action wording | **PASS — partially implemented, completed** | The existing action already separated price review from order creation. Its quoted-state button now says “Confirm order”; the redundant note under it was shortened. |
| Readability and mobile accessibility | **PARTIAL** | Existing responsive/focus work and 44–48 px controls were retained. Reference help, service wording, and pending-payment guidance improved. Fresh desktop/mobile rendering, zoom, and screen-reader checks were unavailable. |
| GCash reference standardization | **PASS — partially implemented, completed** | Both Customer entry paths use one trim-and-length check, the “GCash reference number” label, visible help, and text keyboard hints. No unsupported character or digit rule was invented. |
| Payment-proof limits | **PASS — already implemented** | Both file pickers accept one JPG/PNG and reject invalid MIME or files over 5 MiB with visible errors. The hosted private bucket confirms those limits. No compression, bucket, or policy change was needed. |
| Order, payment, service cards | **PASS — partially implemented, completed** | Cards still show separate authoritative order/payment states. “Fulfillment” became “Service type”; pending payment now names Cashier verification. |
| Payment-pending presentation | **PASS — partially implemented, completed** | Existing submitted/rejected/resubmit/verified states remain. Tracking now describes the pending Cashier gate and the missing-payment next step without implying Kitchen progress. |
| Customer confirms receipt, Release, Manager list, receipt format | **BLOCKED for implementation** | These need separate lifecycle or artifact decisions below. |

## Exact files changed and before/after behavior

| File | Change |
| --- | --- |
| `src/modules/customer/index.tsx` | Customer-only copy, reference validation wiring and hints, status/service wording. |
| `src/modules/customer/customerPaymentInput.ts` | Shared trim and 100-character validation for first submission and resubmission. |
| `scripts/verify-customer-payment-input.mjs` | Focused boundary tests using the actual helper. |
| This report | Findings, decisions, tests, and limits. |

Before: first payment submission checked only blank references, so a reference over 100 characters could be uploaded before the RPC rejected it. After: both submission paths reject it before any upload; surrounding whitespace is removed for the RPC. The active picker already gave JPG/PNG and 5 MiB feedback. The quote still shows items subtotal, delivery fee, total payable, and any server-returned adjustment through the shared `CustomerQuotedBreakdown` renderer. Quote invalidation, requote, order creation, and retry semantics did not change.

## GCash reference contract

Read-only hosted inspection of `public.submit_customer_payment(uuid,text,text)` found `btrim`, nonempty, `char_length <= 100`, and case-insensitive duplicate/idempotency matching. The `payments.gcash_reference_number` column is `varchar(100)` with a normalized unique index. Neither hosted RPC nor the inspected Cashier read/verification path requires a fixed digit count or disallows punctuation. The UI therefore uses a text keyboard (`inputMode="text"`, autocapitalization and spellcheck off), trims surrounding whitespace, and rejects only blank or over-100-character values. The field has no HTML `maxLength`, so accidental outer spaces do not prevent an otherwise valid 100-character reference from being entered and trimmed. This retains legitimate existing values and lets the backend own uniqueness and payment decisions.

## Payment-proof constraints and access

Read-only hosted `storage.buckets` inspection confirmed `payment-proofs`: `public=false`, `file_size_limit=5242880`, `allowed_mime_types={image/jpeg,image/png}`. Local `supabase/config.toml` agrees. Both active file inputs accept JPG/PNG, check the selected file's MIME and size, and display an explicit rejection message. Each submission uses one selected file and a private `<customer-id>/<order-id>/<random-file>` object path, `upsert:false`, before calling `submit_customer_payment`; resubmission requires a new file and can retry its already uploaded path. The RPC verifies ownership and object existence. Cashier continues to view private proof through its existing short-lived signed URL. Storage bytes, native picker, upload failure/retry, and cross-role access were not exercised live in this run.

## Status-card decisions

| Card | Decision | Rationale |
| --- | --- | --- |
| Order status | **Keep** | `orders.current_status` is the operational stage. Waiting for payment verification must not appear as preparing or delivered. |
| Payment status | **Simplify** | `payments.status` is a separate verification decision. The pending label now says “Awaiting Cashier verification”; rejection and verified labels remain distinct. |
| Fulfillment | **Simplify** | The value is the recorded `fulfillment_type`, not a stage. “Service type” works for both delivery and pickup; the card remains useful in mixed order history. |

The demonstration's waiting order and pending payment are two records for the same gate, but each card answers a distinct question. The next-step message explains the consequence once. No persisted enum, status writer, or order progression rule changed.

## Readability and responsive findings

Source review found clear existing menu/cart/checkout sections, quoted versus estimated totals, touch-sized primary actions, visible input errors, focus styles, and reduced-motion CSS. Concrete copy gaps were the technical quote heading, duplicate quote instruction, ambiguous “Fulfillment,” and generic pending-payment wording. These were corrected without broad CSS changes. Earlier Batch 4 fixture screenshots covered seven viewport sizes, and earlier guest/quote browser checks covered mobile and desktop; those are prior evidence. This run could not inspect fresh screenshots or native mobile navigation/dialog interaction because the browser access host returned **“The browser access host is unavailable.”**

## Deferred workflow decisions

| Topic | Existing dependency and decision |
| --- | --- |
| Customer “Confirm received” | Rider `complete_rider_delivery` owns delivered completion and proof. No Customer acknowledgment contract was found in the active Customer flow. Define whether acknowledgment confirms handoff, closes a dispute window, or changes an authoritative status before adding a button/RPC. |
| Release | Cashier calls `release_ready_order`; it is the Cashier handoff after Kitchen readiness. Customer tracking reads the resulting order status. No release or Rider semantics were changed. |
| Manager successful deliveries | Depends on the agreed delivered/acknowledged definition and Manager reporting authority. No Manager work was started. |
| Receipt format | Cashier has `ReceiptPrintDocument` and transaction receipt numbers; Customer tracking has recorded-charge display. The intended artifact and fields must be specified before either is edited. |

## Verification and limits

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | **PASS** after final source edits. |
| `npm.cmd run build` | **PASS** after final source edits (3,043 modules). |
| `node scripts/verify-customer-payment-input.mjs` | **PASS**: trimmed punctuation, blank, 100 and 101 characters. |
| `node scripts/verify-customer-preorder-quote.mjs` | **PASS**: quote state, shared amounts, invalidation and source guards. |
| `node scripts/verify-customer-batch-1.mjs`, `verify-customer-batch-2.mjs`, `verify-customer-batch-3.mjs`, `verify-customer-drink-cart.mjs` | **PASS**. |
| Fresh browser: landing/menu, cart/checkout, quote/confirm, reference/proof, status, mobile/touch | **NOT RUN**: browser access host unavailable; no rendered PASS claimed. |
| Hosted signed-in payment, Cashier verification, real order, `ORD-000080`, native picker, Store proof access | **NOT RUN** by scope. |

## Financial and cross-module safeguards; remaining risks

Only Customer source, a Customer test, and this QA artifact changed in this task. No Cashier, Manager, Kitchen, Rider, SQL, RPC, RLS, Storage policy, hosted configuration, hosted order, payment, stock, or proof object was changed. Server quote and recorded totals still determine amounts. The upload continues under the authenticated customer/order path, while the RPC owns ownership and duplicate checks. A valid reference may contain punctuation because the current backend allows it; any narrower business format needs an explicit contract decision. Browser interaction, real upload/retry, device keyboard behavior, and payment status across authenticated sessions remain unverified in this run. Existing dirty worktree changes were preserved.

## Recommended next Customer milestone

Run isolated authenticated browser acceptance of the edited checkout and tracking at desktop and mobile widths, including synthetic proof validation and rejected-payment resubmission, without creating hosted production claims. Decide the delivery acknowledgment meaning and intended receipt artifact separately before Track C or cross-module implementation.
