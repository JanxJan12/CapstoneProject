# Customer Checkout quote UI finalization — 2026-10-22

## Summary and final result

**COMPLETE for the scoped frontend correction.** The active Checkout Order Summary now reports the actual quote state. A valid quote displays **Quoted**, the same server-returned subtotal, delivery fee, applicable discount/tax, and total as the green review panel, and a confirmation-ready note. The old request-a-quote instruction and Estimate badge disappear. An expired, changed, or failed quote shows no confirmable stale total. A created order uses the recorded order response and **Confirmed** label. No backend or hosted business data was changed in this task.

## Files changed

| File | Change |
| --- | --- |
| `src/modules/customer/index.tsx` | Shared quoted-amount renderer for the green panel and Order Summary; status badge/copy; quote-failure tracking tied to the current cart/address fingerprint; hides client-estimated line prices after a quote or order; accessible status announcement. |
| `src/modules/customer/customerQuoteState.ts` | Pure quote display-state and shared quoted amount-row derivation from existing quote/order state. |
| `scripts/verify-customer-preorder-quote.mjs` | Deterministic state, zero-fee, discount/tax, and Checkout wiring checks. |
| `qa/customer-quote-ui-browser-202610/` | Isolated local Vite/Supabase fixture, Chrome CDP acceptance script, result JSON, and screenshots. No hosted calls. |
| This report | Scoped implementation and verification evidence. |

Existing uncommitted work was preserved. No disconnected Checkout page, migration, RPC, payment calculation, or operational module was edited.

## State behavior

| State | Checkout summary badge and financial display |
| --- | --- |
| Cart | **Estimate** and client-estimated items subtotal; delivery fee and final total pending. One visible mobile Checkout action. |
| Checkout before quote | **Awaiting quote**; estimated item subtotal, fee and total pending; prompts review before order creation. |
| Quote request in progress | **Calculating**; pending fee/total and calculating note. |
| Valid quote | **Quoted**; green panel and summary render the same server-returned item subtotal, fee (including zero), optional discount/tax, and total payable; short confirmation-ready note. |
| Expired quote | **Quote expired**; quote amount removed, final total pending; Review Final Price action available. |
| Cart/address/selection changed | **Needs review**; stale quote amount removed and a new review required. |
| Quote request failed | **Unable to calculate**; no quote total, delivery error and safe Review Final Price retry. |
| Server-created order | **Confirmed**; summary uses the recorded order response subtotal, fee, and total. GCash payment step remains the next screen. |

The badge has `role="status"`, `aria-live="polite"`, and an accessible price-status label. The existing delivery error retains `role="alert"`. Status updates do not force focus into the sidebar or unexpectedly scroll the form. Currency figures use aligned, nonshrinking amount cells and wrapping labels.

## Financial integrity and order safety

`currentOrderQuote` remains the sole valid-quote check, based on the existing cart/address fingerprint and expiry clock. Both quote displays use one `CustomerQuotedBreakdown` component and one `customerQuotedAmountRows` calculation from that quote object. The confirmation button continues to use `currentOrderQuote.grand_total`. The order-created state uses `placedOrder` or `pendingPaymentSubmission.order` from the server writer response, never a saved quote or client cart total. Client-estimated per-line amounts are hidden from the Checkout summary while a quote or recorded order is shown so they cannot contradict authoritative totals.

The order writer, token, request-ID recovery, stale-quote refresh, amount reconciliation, and payment navigation were not changed. A quote request still does not call the order writer. The rendered synthetic fixture observed **zero** order calls through quote loading, success, invalidation, failure, and expiry; one synthetic order call occurred only after clicking Confirm Order. It made zero payment calls. The backend accepted-price rules remain those deployed as hosted migration `20261022115601`; they were not redeployed or changed here.

## Tests and browser evidence

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Quote state/helper test | **PASS** | `node scripts/verify-customer-preorder-quote.mjs`: awaiting, calculating, quoted, expired, changed, failed, confirmed; cart/address identity; shared amount rows; zero fee; discount/tax; source wiring and stale/retry guards. |
| Existing Customer regressions | **PASS** | `node scripts/verify-customer-batch-1.mjs`, `verify-customer-batch-2.mjs`, `verify-customer-batch-3.mjs`, `verify-customer-drink-cart.mjs`, `verify-fixed-meal-cart.mjs`, `verify-drink-choice-cart.mjs`. |
| TypeScript and quality | **PASS** | `npm.cmd run typecheck`; `npm.cmd run verify:quality` (11 checks). |
| Production build | **PASS** | `npm.cmd run build` (3,034 transformed modules). |
| Scoped whitespace | **PASS** | `git diff --check` on changed Customer source/test paths; Git emitted only its existing LF/CRLF conversion warning. |
| Rendered browser fixture | **PASS** | `node qa/customer-quote-ui-browser-202610/run.mjs`: 14 Chrome screenshots, no external/hosted network requests, no horizontal overflow at 360×800, 390×844, 768×1024, or 1440×900; one visible mobile Cart checkout action. |
| Hosted authenticated browser workflow | **NOT TESTED in this task** | The Chrome run used synthetic quote/order responses. It did not create another hosted order or submit a payment. Prior hosted browser acceptance cited by the request was not repeated. |

The browser fixture exercised no quote, loading, ₱170 quoted, changed, failed/retry, expired, and synthetic confirmed/payment-step states. In its ₱170 quote, both rendered total-payable values were **₱170.00**. A separate synthetic response with zero delivery fee, ₱5 discount, and ₱3 tax rendered **₱118.00** in both places. The sidebar displayed **Quoted** during valid responses and contained no old request instruction. An expired or changed quote displayed no quoted total. The fake RPC recorded zero hosted requests and no payment submission.

Selected actual screenshots: [390×844 quoted](customer-quote-ui-browser-202610/screenshots/quoted-390x844.png), [360×800 quoted](customer-quote-ui-browser-202610/screenshots/quoted-360x800.png), [768×1024 quoted](customer-quote-ui-browser-202610/screenshots/quoted-768x1024.png), [1440×900 quoted](customer-quote-ui-browser-202610/screenshots/quoted-1440x900.png), [390×844 adjusted quote](customer-quote-ui-browser-202610/screenshots/adjusted-quote-390x844.png), [expired](customer-quote-ui-browser-202610/screenshots/quote-expired-390x844.png), and [synthetic confirmed](customer-quote-ui-browser-202610/screenshots/synthetic-confirmed-payment-step-390x844.png). Full machine-readable evidence is in `qa/customer-quote-ui-browser-202610/result.json`. These are fixture-browser screenshots, not hosted financial acceptance.

## Scope and next step

No hosted SQL, order, payment, stock, price, or historical record was changed. No Manager, Cashier, Kitchen, Inventory, or Rider code was edited. The local fixture server and Chrome process were stopped after verification; the existing project Vite server remained available. The focused UI work is complete. The next roadmap item is Customer Module Batch 4 mobile UI/UX work; it was **not started** here.
