# RRJ’S FOOD-HOUSE Customer Module implementation QA

Date: 2026-10-13 (Asia/Manila)

## 2026-10-13 Customer modifier completion: PASS on isolated local stack

**Customer closure: PASS for the isolated local implementation and end-to-end regression.** The active Customer UI now loads an active-only modifier catalog through the narrow `get_customer_menu_modifiers()` RPC, requires group selections, stores separate cart lines by dish and option set, rechecks options before checkout, and sends `modifier_ids` to the six-argument order RPC. Cart, checkout, history, and tracking show modifier-inclusive prices or server snapshots. Existing saved carts are retained and checked against the current catalog; changed or invalid selections block checkout with a review message. The checkout still treats the server return as the final payment amount.

The new versioned migration is `supabase/migrations/20261013105400_customer_modifier_completion.sql`. It preserves the RPC signature, authorization, idempotency lock/replay, inventory quantity aggregation, delivery fee, payment hooks, and order history. It prices each variant from active server options and stores `{id,name,price}` in `order_items.modifiers`. Duplicate, disabled, misassigned, malformed, excessive, and missing required selections are rejected. Old `{id,qty}` callers remain valid for dishes with no mandatory selections; dishes with mandatory groups fail closed until the caller supplies a selection. This avoids silently choosing or charging for an option on an old client's behalf. The read RPC grants only `EXECUTE` to browser roles; direct modifier-table `SELECT` remains denied.

| Verification | Result | Evidence / limit |
| --- | --- | --- |
| Isolated migration application | **PASS** | Applied directly with `psql` only to verified `supabase_db_isolated-stack` at `127.0.0.1:56321`; 6 groups, 16 options, 27 associations. This synthetic stack has no `supabase_migrations.schema_migrations`, so migration-history replay was **NOT TESTED**. No hosted SQL was executed. |
| Modifier SQL regression | **PASS** | `supabase/tests/verify_customer_modifiers_local.sql` ran in a rollback transaction: two variants, authoritative subtotal/fee, stored line prices and modifier snapshots, idempotent replay, and rejection of duplicate, misassigned, over-limit, mandatory-missing, malformed, and 100-quantity selections. |
| Existing authenticated cross-module API flow | **PASS** | `node qa/recovery-auth-order-rider-e2e-20261013.mjs`: Customer order and replay, local Storage proof and payment, cashier verification, KDS, Rider, and database reconciliation. Synthetic local records only. |
| Authenticated rendered Customer flow | **PASS** | `node qa/customer-browser-20261013/run-local.mjs`; [result.json](<C:/Users/Janmari/Downloads/Capstone Project/qa/customer-browser-20261013/local-authenticated/result.json>). Chrome signed into a synthetic customer on the isolated local stack, selected Extra rice for Adobong Manok, placed an order, uploaded synthetic proof, submitted payment, showed Extra rice in tracking, and reconciled order, line, payment, and option snapshot in the same local database. Desktop screenshots are in that directory. |
| Responsive mock browser regression | **PASS** | `node qa/customer-browser-20261013/run.mjs after`; [result.json](<C:/Users/Janmari/Downloads/Capstone Project/qa/customer-browser-20261013/after/result.json>). 390×844, 768×1024, 1440×900; required modifier blocked incomplete add, adjusted cart price and persistence, availability retry, checkout validation, mock payment and tracking. Screenshots are in `after/`. The mock portion is UI evidence only. |
| App checks | **PASS** | Typecheck, production build (3,015 modules), 11 quality checks, and `git diff --check` for the Customer source. |

**NOT TESTED:** Hosted deployment or hosted migration; real GCash settlement; hardware device behavior; fresh clean migration replay into a newly built stack. No hosted project `zhzluhqvysvsadwuugpa` mutation, synthetic hosted order, or broad database cleanup occurred. The local completion permits Manager UI/UX implementation next; production readiness requires a separate deployment and recovery decision.

## Prior 2026-10-13 checkpoint (superseded): BLOCKED

The active Customer route in `src/app/routes.tsx` imports `src/modules/customer/index.tsx`. The existing responsive Customer implementation and its previous QA evidence below were retained. This continuation changed this report only; it did not change Customer, Manager, shared application, or database source.

**FAIL / contract gap:** The isolated local database on `127.0.0.1:56321` is running and contains 6 `menu_modifier_groups`, 16 `menu_modifier_options`, and 27 `menu_item_modifier_groups` associations. A read-only `pg_proc` inspection confirmed that the live six-argument `public.place_customer_order(text,text,text,text,jsonb,uuid)` reads `id` and `qty` from each item but has no `modifier` or `modifier_ids` logic. This matches the latest checked-in definition in `supabase/migrations/20260914020000_harden_customer_order_idempotency.sql`: it groups quantities by menu item, prices only `menu_items.price`, and inserts `order_items` without modifier selections. The older `20260825183637_remote_schema.sql` snapshot contains a different five-argument modifier-aware function; the later migration replaced it. The current active checkout submits only `{ id, qty }` and cannot truthfully charge or persist selected modifiers through the validated RPC.

**NOT TESTED:** Modifier selection, required/optional and single/multiple validation, modifier repricing, modifier cart identity/persistence, modifier order-line summary, refresh reconciliation, modifier-inclusive final totals, and modifier-inclusive cash/GCash order/payment flows. A browser mock could simulate these screens but would not repair the missing server contract. No modifier UI or mock-only payload was shipped because it would allow a customer to select priced options that the server ignores.

**PASS / existing baseline rechecked in this continuation:** `npm.cmd run typecheck` (exit 0), `npm.cmd run build` (exit 0; 3,015 modules), and `npm.cmd run verify:quality` (exit 0; 11 checks). The viewport and transactional results below remain evidence from the preceding QA pass; they were not rerun after this contract finding. No synthetic hosted orders or payments were created in this continuation.

**Customer completion: FAIL / incomplete. Manager implementation: NOT STARTED.** The requested sequence allows Manager work only after verified Customer completion. A modifier-aware, server-authoritative order RPC contract would be required before the Customer selector, functional integration tests, and module closeout can proceed. No database migration or hosted change was made.

## Scope and changed files

The existing Customer implementation was preserved. The active module is `src/modules/customer/index.tsx`; `src/modules/customer/components/CustomerStatusBadge.tsx` supplies its shared status presentation. The previously changed Customer source includes responsive layout, menu loading and retry feedback, availability refresh handling, cart quantity bounds, checkout validation, server-confirmed totals, payment retry messaging, and tracking presentation. The disconnected `src/modules/customer/checkout/CheckoutPage.tsx` is not used as the active checkout.

The preceding browser QA continuation changed only `qa/customer-browser-20261013/run.mjs` to extend the separate localhost Chrome headless checks and created this report. The browser harness files are `qa/customer-browser-20261013/{index.html,main.tsx,auth.ts,supabase.ts,vite.config.mjs,run.mjs}`. Its `auth.ts` and `supabase.ts` are local mock adapters; they do not provide authenticated backend proof. No unrelated module or database contract was edited in that preceding continuation.

## Browser boundary and results

The existing browser connector could not confidently establish Chrome’s URL, so it was not used. `run.mjs` launches a separate installed Chrome headless process with a fresh temporary profile, connects only to its own DevTools port, checks that the page target starts with the explicitly configured `http://127.0.0.1:58430/qa/customer-browser-20261013/index.html`, and closes that process. Vite used `qa/customer-browser-20261013/vite.config.mjs` with `127.0.0.1`, fixed port `58430`, `envDir: false`, local mock aliases, and fixed synthetic merchant details. The browser flow made no hosted order or payment call.

Command: `npx.cmd vite --config qa/customer-browser-20261013/vite.config.mjs --host 127.0.0.1`, then `node qa/customer-browser-20261013/run.mjs after`. Final browser run **PASS**, exit 0; machine-readable result: `qa/customer-browser-20261013/after/result.json`.

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Home and menu at 390×844, 768×1024, 1440×900 | **PASS** | Rendered active `CustomerApp`; menu browsing succeeded at each size. Root scroll width was 390, 758, and 1430 px respectively, with no horizontal overflow. |
| Cart and checkout at mobile and tablet sizes | **PASS** | Both screens rendered and remained within each viewport; screenshots below. Desktop cart and checkout also rendered. |
| Cart synchronization and quantity limit | **PASS in mock browser** | One item persisted to session storage; increase/decrease updated it; 105 increase clicks capped quantity at 99 and disabled the increase button. |
| Availability refresh and checkout gate | **PASS in mock browser** | Simulated availability RPC failure kept the customer in the cart and created zero orders; retry recovered and entered checkout. |
| Checkout validation | **PASS in mock browser** | Missing address and invalid Philippine mobile number blocked the order RPC. Valid details produced one mock order and a server-confirmed total. |
| Payment validation, confirmation, tracking | **PASS in mock browser** | Missing reference and proof blocked submission. A generated local PNG was selected; one mock payment submission displayed confirmation and navigated to tracking for the same synthetic order. This is UI behavior, not a real GCash payment. |
| Modifiers | **NOT TESTED / functional gap** | The active Customer source has no modifier selector or `modifier_ids` in its order payload. The isolated local database has 6 modifier groups, 16 options, and 27 item associations, but this UI cannot exercise them. Adding support needs a separate Customer-scoped implementation and server-authoritative price/cart-line review; this run did not change the order contract or pretend the feature passed. |

No new Customer visual defect was confirmed in the tested screens, so no production UI source edit was made in this continuation. The mock browser does not prove live Auth, RLS, Storage policy, realtime delivery, GCash transfer, or a customer session against the isolated stack.

## Isolated transactional proof

`node qa/recovery-auth-order-rider-e2e-20261013.mjs` **PASS**, exit 0. The existing script first verifies the unlinked isolated local Supabase API is exactly `http://127.0.0.1:56321` and the expected local database container is running; it refuses another API. It creates synthetic local test identities and data there only. The run passed customer order placement and idempotent replay, authenticated proof upload and payment submission/replay, cashier-only verification denial for the customer, cashier verification and receipt/replay, KDS and Rider status transitions, and final same-database order/payment/cashier/assignment/history reconciliation. No synthetic hosted order was created. This API/RPC proof is separate from the mock browser proof and does not claim authenticated rendered Customer UI on the local Supabase stack.

## Actual screenshots

The PNGs below exist and were verified by file size and SHA-256 after the final browser run. Absolute artifact root: `C:\Users\Janmari\Downloads\Capstone Project\qa\customer-browser-20261013`.

| Screen | Before file | After file |
| --- | --- | --- |
| Mobile home | `before/mobile-home.png` | `after/mobile-home.png` |
| Mobile menu | `before/mobile-menu.png` | `after/mobile-menu.png` |
| Tablet home | `before/tablet-home.png` | `after/tablet-home.png` |
| Tablet menu | `before/tablet-menu.png` | `after/tablet-menu.png` |
| Desktop home | `before/desktop-home.png` | `after/desktop-home.png` |
| Desktop menu | `before/desktop-menu.png` | `after/desktop-menu.png` |
| Desktop cart | `before/desktop-cart.png` | `after/desktop-cart.png` |
| Desktop checkout | `before/desktop-checkout.png` | `after/desktop-checkout.png` |

Additional actual after screenshots: `after/mobile-cart.png`, `after/mobile-checkout.png`, `after/tablet-cart.png`, `after/tablet-checkout.png`, `after/desktop-payment.png`, `after/desktop-confirmation.png`, and `after/desktop-tracking.png`. The earlier `before` set was already present at this checkpoint; this continuation did not reproduce its prior source revision. The before/after pairs therefore document captured states, not a measured improvement attributable to this continuation. The desktop home before/after SHA-256 matches exactly (`63D55C196A40E8EAAC1A73E669120C0F06B635CEDC7348385347FD5AAE5ADB0E`).

## Final checks

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | **PASS**, exit 0 |
| `npm.cmd run build` | **PASS**, exit 0; Vite transformed 3,015 modules |
| `npm.cmd run verify:quality` | **PASS**, exit 0; all 11 checks |
| `git diff --check -- src/modules/customer/index.tsx` | **PASS**; Git emitted only its LF/CRLF conversion warning |

Outstanding: modifier selection is absent from the active Customer UI; authenticated rendered Customer UI against the isolated Supabase stack, mobile device hardware behavior, and real GCash settlement were **NOT TESTED** in this run. No hosted deployment or production readiness claim follows from these results.
