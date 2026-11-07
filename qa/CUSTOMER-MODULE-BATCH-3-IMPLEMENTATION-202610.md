# Customer Module Batch 3 implementation — 22 October 2026

## A. Executive summary and status

**PARTIAL.** Customer Cart and pre-submit Checkout no longer assert a client-fixed delivery fee or payable total. After order creation, Checkout still uses the exact `place_customer_order` response. Order History and Tracking now show recorded subtotal, fee, discount, and tax only when those stored components reconcile with the stored final total; otherwise they preserve the final total and say the breakdown is unavailable. A precise fee before order creation is blocked by the absence of a read-only Customer quote contract. Rendered browser and authenticated Customer API acceptance were unavailable in this run.

## B. Actual financial contracts

Read-only hosted inspection of project `zhzluhqvysvsadwuugpa` confirmed `public.orders` columns `subtotal`, `delivery_fee`, `discount_amount`, `tax_amount`, and `grand_total` (numeric), plus `fulfillment_type`; `public.order_items` has recorded `unit_price`, `line_total`, quantity, item name, and option snapshot. `place_customer_order(p_customer_name, p_contact_number, p_delivery_address, p_landmark, p_items, p_request_id)` returns `subtotal`, `delivery_fee`, `grand_total`, status and identity. Its hosted definition currently sets a 50-peso delivery fee and inserts the resulting stored order values. This is **server implementation evidence**, not a stable quote endpoint or permission to embed 50 in the frontend. A public Customer quote or fee-only RPC was not found in the inspected function catalog.

`orders` has RLS enabled and an authenticated Customer SELECT policy limited to `customer_id = auth.uid()`. The management connector's read-only SQL check establishes the stored schema and example values; it is not a Customer-JWT query or a proof of browser authorization. The active Customer History and Tracking use Supabase table reads under the signed-in session. The ordering RPC remains the authority for submitted amounts; no client total override was introduced. Payment amount/status are separate from order total and were not relabeled as charges.

| Amount | Source and classification |
|---|---|
| Cart item subtotal | Current Customer cart prices and selected choices; **client estimate**, subject to Batch 1 reconciliation and server repricing. |
| Pre-submit delivery fee and final total | **Unknown**; no read-only Customer quote contract. Displayed as pending. |
| Post-create Checkout subtotal, delivery fee, total | **Server-confirmed** `place_customer_order` response. The component breakdown is shown only when subtotal + fee equals the returned total. |
| History/Tracking components and total | **Historical stored order fields**. Components are shown only when subtotal + fee − discount + tax equals the stored total. A missing/invalid component or mismatch hides the breakdown, not the recorded total. |
| Item names, choices, unit prices and line totals | **Historical `order_items` snapshots**, never read from the current menu for past orders. |

## C. Changes by screen

- **Cart:** Shows estimated **Items subtotal**. Delivery fee is “Confirmed when order is created” and final total is pending. The mobile summary shows the same subtotal and a short pending-fee note. The prior `subtotal + 50` and fixed fee display are removed.
- **Checkout:** Before creation, uses the same pending fee/total wording. After the RPC returns, uses its confirmed subtotal, fee and total. If a future server response contains an unexplained adjustment, it retains the confirmed total but does not present a contradictory two-component breakdown. The order/payment submission sequence and existing retry/idempotency behavior were not edited.
- **Order History:** Selects the stored financial fields and fulfillment type. The existing prominent order total remains the stored `grand_total`. A compact recorded-charge section shows reconciled components; missing/ambiguous records get neutral text. Stored item names, quantities, choice labels and line amounts remain unchanged in the display.
- **Order Tracking:** The active guarded refresh and its payment resubmission refresh both select stored financial fields. The recorded-charge section sits beside the existing item summary. Batch 2 status, timeline, stale snapshot, and subscription behavior remain in place. The recorded total remains prominent even if its breakdown is unavailable.

The Customer-local helper parses money in cents, distinguishes a confirmed zero from null or invalid data, and checks reconciliation before exposing labels. It uses the stored grand total directly, never recomputes and substitutes a new total. A zero delivery fee is displayed for a delivery order when it is explicitly stored; pickup/dine-in with a stored zero omit the inapplicable fee row.

## D. Example order reconciliation

The authorized read-only management SQL query for `ORD-000061` selected only order number, fulfillment, monetary fields, and the sum of stored line totals. It returned: delivery; stored subtotal **₱120.00**; stored delivery fee **₱50.00**; discount **₱0.00**; tax **₱0.00**; stored grand total **₱170.00**; stored line sum **₱120.00**. Thus the 50-peso difference in this specific order is independently supported by its stored `delivery_fee`, not inferred from subtraction. No customer-identifying fields were queried or recorded here. No historical row was changed.

## E. Files changed

- `src/modules/customer/index.tsx` — active Customer-only Cart, Checkout, History and Tracking presentation/data selection. This file was already dirty; earlier work was preserved.
- `src/modules/customer/customerFinancialDisplay.ts` — small stored-money and reconciled-breakdown helper.
- `scripts/verify-customer-batch-3.mjs` — synthetic financial-data and source-guard checks.
- This report.

## F. Tests and evidence

| Command/check | Final result | Evidence and limit |
|---|---|---|
| Read-only hosted `information_schema`, `pg_proc`, RLS-policy, and `ORD-000061` SELECT queries | **PASS** | Direct schema/RPC/record evidence through the management connector; no Customer JWT exercise. |
| `node scripts/verify-customer-batch-3.mjs` | **PASS** | Synthetic parsing, known/unknown/zero fee, discount/tax, pickup, mismatch, invalid amount and source guards. Does not mount React or call hosted order APIs. |
| `node scripts/verify-customer-batch-1.mjs` | **PASS** | Existing safe-error and price/availability reconciliation checks. |
| `node scripts/verify-customer-batch-2.mjs` | **PASS** | Existing URL and refresh-queue checks. |
| `node scripts/verify-customer-drink-cart.mjs` | **PASS** | Existing Customer ordinary food, required drink, refreshed choices and fixed-meal cart checks. |
| `node scripts/verify-fixed-meal-cart.mjs` | **PASS** | Existing POS compatibility fixture. |
| `node scripts/verify-drink-choice-cart.mjs` | **PASS** | Existing POS compatibility fixture. |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit`, exit 0. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11 checks, exit 0. |
| `npm.cmd run build` | **PASS** | Vite build, 3,033 modules, exit 0. |
| `git diff --check -- src/modules/customer/index.tsx` plus trailing-whitespace scan of new files | **PASS** | Scoped check; Git emitted only its LF/CRLF working-copy warning. |

Historical unit prices and choice snapshots remain selected from `order_items`; the new deterministic helper test does not execute their rendered React presentation. No backend Customer order/payment submission was run. No duplicate fee is added to any submitted amount: no new mutation payload or total calculation was introduced.

## G. Browser verification

**NOT TESTED.** `cua.getState()` returned `apps: []`, `browsers: []`. Cart, Checkout, History and Tracking were not rendered at 360×800, 390×844, 768×1024 or 1440×900 during this run. There are no new screenshots, keyboard/focus results, or measured overflow results. Earlier Batch 2 screenshots are not claimed as Batch 3 evidence.

## H. Financial integrity and scope

Only Customer presentation, a Customer-local helper/test, and this report changed. No hosted order, payment, price, discount, stock, fee configuration, migration, or operational module was modified. The hosted SQL calls above were SELECT-only and excluded private customer fields. Existing dirty worktree changes remain in place.

## I. Remaining limitations and next approval

The existing ordering RPC creates an order before returning a confirmed fee. A precise pre-submit fee/total would require a separately reviewed **read-only Customer quote contract** tied to the same server pricing and eligibility rules. That backend change was not authorized and was not attempted. Authenticated Customer-JWT reads and browser presentation still need acceptance using an isolated account/order fixture. The next roadmap item is Batch 4's measured mobile text and visual polish; it was not started.
