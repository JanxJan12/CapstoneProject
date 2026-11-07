# Customer module comprehensive audit — 22 October 2026

## Executive assessment and method

The active Customer application supports guest menu browsing, a session cart, Google sign-in for checkout, server-authoritative order creation, GCash proof submission, order tracking, history, and profile contact editing. Source, local checks, and read-only hosted catalog/policy queries support that architecture. The module is **not ready for an unqualified Customer acceptance sign-off**: rendered responsive and authenticated journeys were not exercised in this audit. No production order, payment, profile, stock, or other business record was changed.

Evidence tiers below are deliberately distinct. “Source confirmed” means a reachable code path was inspected, not that a user reproduced the behavior in a browser. “Hosted catalog confirmed” means SQL catalog/policy inspection, not an authenticated adversarial session. “Local script PASS” is fixture or static coverage, not a hosted order transaction.

## Active architecture map

`src/app/routes.tsx:49,180` lazily loads `src/modules/customer/index.tsx` at `/customer`. The route allows guest access; `src/app/providers/AuthProvider.tsx` supplies the session and active profile role. `CustomerApp` at `index.tsx:5148` owns `page`, cart, detail item, categories, menu, fixed meal prices, and availability state. It renders its own `HomePage` (1099), `MenuPage` (1246), `MenuDetailPage` (1397), `CartPage` (1597), `CheckoutPage` (1842), `TrackingPage` (3233), `HistoryPage` (4398), and `ProfilePage` (4754). These are internal state views, not distinct URLs. `CustNav` (613) handles navigation. Customer status badge and shared image fallback are imported. The similarly named files under `customer/landing`, `menu`, `cart`, `checkout`, and `tracking` export components but have no imports from the active route or `index.tsx`; they are **suspected disconnected/legacy code**, not evidence of a second running journey.

Data flow: public menu categories/items, `get_menu_effective_availability`, `get_fixed_meal_options`, and `get_drink_choices` feed the menu/detail/cart. Cart and checkout retry identifiers use tab-scoped `sessionStorage` (`index.tsx:271-415,5624-5636`). Checkout maps lines to `id`, `qty`, `modifier_ids`, optional `meal_option` and calls `place_customer_order` with a request UUID (`:2152-2214`), then uploads GCash proof and calls `submit_customer_payment` (`:2442-2483`). Tracking and history read `orders`, `order_items`, and `order_status_history`; tracking calls `get_customer_order_payment` and subscribes to Realtime (`:3208,3282-3570`). Profile uses Auth user and own `profiles` row (`:4780-4950`). `src/lib/supabase.ts` configures the client.

## Journey inventory and observed strengths

| Journey | Source-level result | Limit |
|---|---|---|
| Home/menu | Primary menu CTA, category/search/filter, available/unavailable states, retry feedback are present (`:1099-1395`). | No rendered or guest network proof. |
| Detail | Quantity 1–99, configured rice alternatives, drink choices, disabled Add until required choices load/complete (`:1397-1595`). | Out-of-stock drink selection was not browser-tested. |
| Cart | Separate line keys for choices, quantity/removal, preserved unavailable lines and checkout guard (`:1597-1741`). | Session restore and change-of-stock interaction not browser-tested. |
| Checkout | Google OAuth, delivery validation, idempotent request ID, server-confirmed total, proof step, explicit success card (`:1842-3120`). | No hosted order/payment submitted. |
| Tracking/history | Stored `order_items` snapshot labels/prices are read rather than recomputed from current menu (`:3282-3493,4420-4530`); Realtime listener is removed on unmount (`:3529-3570`). | Ownership and reconnect not exercised with real Customer JWT. |
| Profile | Auth user/own profile read, contact edit, validation, loading/error/success states (`:4754-5130`). | No profile update performed. |

Only delivery/GCash is implemented in the active checkout. No dine-in or takeout Customer selector, reorder feature, operating-hours contract, or ETA was verified. These are absent capabilities, not defects without an approved product requirement.

## Focused hosted Supabase inspection (read-only)

Project `zhzluhqvysvsadwuugpa`, 22 October 2026. Catalog queries found `place_customer_order(p_customer_name text,p_contact_number text,p_delivery_address text,p_landmark text,p_items jsonb,p_request_id uuid)`, `submit_customer_payment(p_order_id uuid,p_gcash_reference_number text,p_proof_image_path text)`, and `get_customer_order_payment(p_order_id uuid)` as SECURITY DEFINER, granted EXECUTE to `authenticated`, not `anon`. `get_drink_choices()`, `get_fixed_meal_options()`, and `get_menu_effective_availability()` are callable by `anon` and `authenticated`. The first query used an incorrect name `get_customer_tracking_payment`; source inspection corrected it to `get_customer_order_payment` before the final catalog query. No claim depends on that incorrect name.

RLS is enabled on `orders`, `order_items`, `order_status_history`, `profiles`, `menu_items`, `menu_categories`. The hosted Customer SELECT policies restrict orders by `customer_id = auth.uid()`, and item/status history by an owning order. `profiles` own-select/update policies use `auth.uid()`, and hosted column grants expose only `contact_number` for authenticated UPDATE. Staff/Rider SELECT policies exist for operational use and were not expanded into a system-wide audit. Function text inspection showed the three protected RPCs refer to `auth.uid()` and customer ownership; this does not substitute for hostile-JWT execution. Local reviewed transition SQL sets `v_delivery_fee := 50` and obtains `v_customer_id := auth.uid()` (`supabase/migrations/20261021190000_drink_choices_transition.sql:196-201`); current hosted fee value was not separately invoked in a transaction.

Hosted query found seven active `public.drink_choices` rows, and `to_regclass`/`to_regprocedure` showed the three retired modifier tables and `get_customer_menu_modifiers()` absent. An initial exploratory query against nonexistent `drink_choice_options` failed with SQLSTATE 42P01; the corrected query succeeded. This was a query-name error, not a hosted Customer application test failure.

## Prioritized issue register

Each status is about this audit's verification, not an assertion that all production cases fail.

| ID | Severity / category / journey | Observation and evidence | Impact, cause, remediation, acceptance | Confidence / status |
|---|---|---|---|---|
| CUST-01 | P2 / error handling / menu, tracking, history, profile | Active handlers place raw Supabase `error.message` into visible state: menu `index.tsx:5435-5475`, tracking `:3344-3409`, history `:4452-4507`, profile `:4801-4832`; corresponding views render it. | Technical text can confuse users and expose backend details. Map known failures to plain-language retry/session guidance; log diagnostic detail separately. Acceptance: forced network/permission errors show safe messages and recovery without raw SQL/PostgREST text. | CONFIRMED source path / PARTIAL (rendered error state not reproduced). |
| CUST-02 | P2 / stale presentation / detail/cart | Menu refresh updates cart item fields but detail item only when `available` differs (`index.tsx:5578-5623`). | An open detail can keep an old name/price/rice value after refreshed menu data; cart/server may then show a different amount. Refresh all display and choice fields while preserving deliberate user selection or close invalid detail. Acceptance: Manager-side price/choice change reflected on open detail after refresh, and server confirmation is clear. | CONFIRMED source path / PARTIAL (no live price change performed). |
| CUST-03 | P2 / maintainability / all | Active `index.tsx` is 5,913 lines and contains eight views, cart state, menu hydration, payment upload, Realtime, and profile calls. Separate named screen files appear unimported. | Small changes risk cross-journey regressions and duplicate work. Extract one concern at a time behind unchanged props/contracts; label/archive unused exports only after import verification. Acceptance: active route still renders every journey and focused tests cover extracted behavior. | CONFIRMED source structure / PASS. |
| CUST-04 | P2 / navigation / tracking/recovery | `CustomerApp` tracks page and selected order only in React state (`index.tsx:5178,5637-5645,5700-5715`); `/customer` is the only Customer URL. | Refresh/back/deep link returns to initial view, making an in-progress tracking view harder to recover. Add URL state for safe views/order ID with ownership still enforced by RLS; preserve checkout retry semantics. Acceptance: refresh/back restores menu/history/tracking view without exposing another Customer's order. | CONFIRMED source structure / PARTIAL (browser navigation untested). |
| CUST-05 | P2 / price communication / cart/checkout | UI hardcodes a ₱50 *estimated* delivery fee (`index.tsx:1700-1725,3080-3081`). The reviewed local RPC SQL currently also uses 50; the client explicitly labels this an estimate and later uses confirmed server totals. | If fee policy changes, pre-order display drifts, though server authority remains. Source the estimate from an approved read-only contract or clearly mark fee pending when it cannot be fetched. Acceptance: no fixed client amount silently diverges from the hosted fee; submitted total always uses RPC response. | CONFIRMED maintenance risk / PARTIAL (future drift not a current mismatch). |
| CUST-06 | P2 / reliability / tracking | Realtime subscription refreshes order/history/payment and cleans up on unmount (`index.tsx:3529-3570`); `CHANNEL_ERROR`/`TIMED_OUT` only log to console. No retry/backoff or user-visible stale marker appears in this effect. | A disconnected tab can show stale status until manual refresh/navigation. Add reconnect/focus refresh and an explicit stale/retry state without duplicate listeners. Acceptance: simulated disconnect and reconnect converge to the current owned order and announce the state. | CONFIRMED source path / PARTIAL (network interruption not exercised). |
| CUST-07 | P3 / readability / home | Home uses `text-[9px]` on category/feature copy and `text-xs` on mobile hero description (`index.tsx:1118-1199`). | Small text may be difficult on 320–390 px displays. Increase minimum body/caption sizing while retaining hierarchy; confirm via screenshots and 200% zoom. | LIKELY / NEEDS VERIFICATION (rendered/contrast not measured). |

No P0 or P1 vulnerability was established. The absence of an authenticated browser and adversarial JWT check means a security sign-off is **not** implied by catalog inspection.

Finding count: **0 P0, 0 P1, 6 P2, 1 P3**. Evidence-status count: **1 source-structure PASS, 5 source-path PARTIAL, 1 NEEDS VERIFICATION**. This is separate from the test-result table below. No confirmed Customer test failure was recorded; the one hosted SQL error was an exploratory query using the wrong table name and was corrected.

## Performance, accessibility, and quality

Production build passed with Vite reporting 3,029 modules and a largest displayed JS chunk of 464.40 kB (137.21 kB gzip); mapping that chunk to the Customer route and actual load timing was **NOT MEASURED**. Customer route is lazy-loaded. The module's 5,913-line concentration is a maintainability risk, not proof of poor runtime performance. Menu initial load uses a status region/animated skeleton feedback (`index.tsx:562-603`); earlier “spinner-only” concerns are not treated as current findings. Success feedback is present at `:2748-2810`. Mobile navigation has dialog semantics and keyboard handling (`:926-1060`); reduced-motion preference is referenced in `CustNav` (`:633`). Complete WCAG 2.2 AA, focus trap, contrast, zoom, and keyboard inspection remain unverified without a rendered browser.

## Automated checks and browser coverage

| Check | Result | Exact evidence |
|---|---|---|
| `npm.cmd run typecheck` | PASS | `tsc --noEmit`, exit 0. |
| `npm.cmd run verify:quality` | PASS | 11 non-workflow baseline checks, exit 0. |
| `npm.cmd run build` | PASS | Vite build 3,029 modules, exit 0. |
| `node scripts/verify-customer-drink-cart.mjs` | PASS | Ordinary food, retired choice rejection, required drink, authoritative drink refresh, fixed meal. |
| `node scripts/verify-fixed-meal-cart.mjs` | PASS | POS fixed meal variant separation/merge; relevant cross-contract fixture, not Customer browser proof. |
| `node scripts/verify-drink-choice-cart.mjs` | PASS | POS drink variant separation/merge; relevant cross-contract fixture. |
| Hosted RLS/RPC catalog | PASS (catalog only) | Policies, grants, signatures above. |
| Hosted authenticated order/payment/ownership, actual UI | NOT TESTED | Production transactions prohibited; no authenticated browser/JWT test used. |
| Rendered viewports 320, 360, 390, 430, 768, 1024, 1440; screenshots; keyboard/contrast | BLOCKED | Computer-use `cua.getState()` returned no browser/app surfaces; `createBrowserTab('iab', local URL)` returned `Browser is not available: iab`. No screenshot was produced. |

## Readiness decision and limits

**Conditional for planning; no full Customer acceptance sign-off.** The source/build and focused cart tests pass, and hosted policy/contract catalog looks aligned with the active client. Prioritize CUST-01 and CUST-02, then perform actual guest and authenticated browser acceptance at the seven widths before calling the journey production-ready. This audit did not measure network timing, verify Google OAuth/Storage callbacks, submit a real order/payment, alter product prices/stock, or execute cross-account access attempts. Its recommendations are deliberately Customer-scoped.
