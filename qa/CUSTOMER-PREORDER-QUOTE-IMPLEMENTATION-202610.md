# Customer pre-order quote — local implementation, 2026-10-22

## Status

**PARTIAL local verification; hosted deployment NOT performed.** The quote and accepted-price writer are implemented, and the focused database rehearsal passes against a targeted disposable fixture. A faithful hosted-schema replay, rendered browser acceptance, and hosted authenticated runtime acceptance remain untested. Production checkout is unchanged until a separately approved backend cutover and frontend release.

## Pricing contract and implementation

The currently deployed Customer writer prices each canonical `p_items` line from active `menu_items` rows, active required `drink_choices`, and configured Fixed Meal Options. It checks inventory availability and adds the existing fixed ₱50 delivery fee. The online writer applies no discount or tax; those quote fields are `0`. It currently inserts an order at `waiting_payment_verification`, item choice snapshots, and status history. The existing request UUID and advisory transaction lock prevent duplicate orders.

The new local migration extracts that exact pricing and validation loop into `public.customer_order_pricing(jsonb)`. Both `quote_customer_order(text,text,text,text,jsonb,uuid)` and `place_customer_order_confirmed(text,text,text,text,jsonb,uuid,text)` call it. The quote returns subtotal, delivery fee, zero discount and tax, total, calculation time, five-minute expiry, and a signed token. It is `STABLE` and contains no business-data writes, row locks, sequence allocation, or order insertion. The shared pricing function is also `STABLE` and read-only; the existing inventory assertion selects availability without writing. Both use a pinned empty `search_path`. Only the quote and confirmed writer are executable by `authenticated` and `service_role`; the private pricing and terms helpers and private signing key are not Customer-executable. The key is generated once with `extensions.gen_random_bytes(32)` and held in a private RLS-enabled table.

The signed token binds the active Customer ID, Auth session ID, request UUID, normalized name/contact/address/landmark/cart terms, complete server price-and-snapshot hash, and expiry. No client price is trusted. The confirmed writer checks active Customer access and the existing request first for safe replay, verifies token integrity and scope, locks requested menu rows in deterministic order, recalculates pricing and inventory, compares the signed price/snapshot hash, then inserts the order and snapshots in the same transaction. A stale or invalid token raises before order-number allocation and inserts. The existing six-argument Customer writer loses `authenticated`, `anon`, and `PUBLIC` execution; Cashier's distinct `create_walk_in_sale` is untouched. Same-request recovery can return an existing order after quote expiry; the UI compares its recorded amounts with the accepted quote and routes any mismatch to order review rather than payment.

The active Checkout now requests a quote only after required delivery details, Customer authentication, cart validation, and GCash configuration are ready. It displays server subtotal, fee, applicable discount/tax, and total. A separate click on **Confirm Order — [quoted total]** submits the signed token. Cart, choice, local catalog price, delivery-detail, sign-out, and expiry changes hide the prior quote. On server stale rejection it fetches a fresh quote and requires another click. Network uncertainty preserves the existing request identity and recovery behavior. The mobile Cart hides its inline checkout action and retains the sticky action; desktop keeps the inline action. The former “fee confirmed after order creation” copy was corrected.

## Files prepared

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261022120000_customer_preorder_quote.sql` | One pricing policy, quote, confirmed writer, key, ACL cutover |
| `scripts/build-customer-quote-migration.mjs` | Reproducibly extracts the prior writer's pricing loop for the migration |
| `src/modules/customer/index.tsx` | Active Checkout and mobile Cart changes |
| `src/modules/customer/customerQuoteState.ts` | Strict money parsing, total reconciliation, quote validity |
| `supabase/tests/verify_customer_preorder_quote_local.sql` | Authenticated disposable PostgreSQL tests and synthetic fixture additions |
| `scripts/verify-customer-preorder-quote.mjs` | Frontend quote-state tests |
| `scripts/verify-customer-preorder-quote-concurrency.mjs` | Two-request concurrency and synthetic catalog/fee change tests |

**Migration SHA-256:** `D8C6F481B9CECCFF92FF96D54BAF97C9E14AAB36C2163A6FE968F07C86CBDDC1`.

## Direct verification

The Docker engine was restored without changing unrelated containers or volumes. The prior named disposable `codex-meal-customer-qa-20261021` container was started for testing and returned to its stopped state afterward. A fresh `quote_rehearsal_session_20261022` database was cloned from `retirement_b_receipt_20261022`; the exact migration above executed with `ON_ERROR_STOP=1`. The test setup added synthetic Customer accounts, a configured meal/rice ingredient, the hosted-shaped `customer_request_id` column and unique index, and the actual hosted `auth.jwt()` definition (read-only captured), which this older targeted clone lacked. It uses three synthetic menu items, seven drink choices, and an existing synthetic historical receipt. **This is a targeted fixture, not a faithful hosted-schema replay.** Its Cashier, Kitchen, payment, and inventory lifecycle is not a full hosted clone.

| Check | Result | Evidence |
| --- | --- | --- |
| Exact migration application | PASS | Disposable `psql -X -v ON_ERROR_STOP=1 ... -f /tmp/customer_preorder_quote_session.sql` completed all DDL and ACL changes. |
| Ordinary, quantity, mixed, With Rice, Without Rice, drink pricing | PASS | `verify_customer_preorder_quote_local.sql`: ordinary 120+50=170; two drinks 90+50=140; Without Rice 90+50=140; mixed 270+50=320. |
| Required/invalid drink choice, wrong product choice, invalid quantity/address, unavailable product | PASS | Real quote RPC raised expected errors under authenticated Customer context. |
| Malicious unit-price override | PASS | Client `unit_price: 0.01` still quoted catalog subtotal 120. |
| Read-only quote and stale failure | PASS | Order/payment count, stock sum, and order sequence unchanged across quotes and stale rejections. |
| Address, quantity, drink choice, product price, token forgery, expiry | PASS | Real confirmed RPC rejected each before a new order. Expired token was re-signed only inside the privileged disposable fixture. |
| Other Customer and other Auth session | PASS | Same token rejected under another Customer or session ID. |
| Authorization / bypass | PASS | Active Cashier could not quote; `anon` has no quote EXECUTE; `authenticated` has no old six-argument writer EXECUTE. |
| Valid accepted order, recorded totals, snapshot, idempotency | PASS | Exactly one order at 120+50=170 with a stored With Rice snapshot; same request returned that order. Test order transaction rolled back. |
| Concurrent duplicate submissions | PASS | Two separate authenticated database connections using the same Customer session submitted the same request concurrently; both returned the same one synthetic order. |
| Concurrent catalog price update | PASS | Writer waited for the row update, rejected stale terms, and created no order. |
| Delivery fee policy change | PASS, synthetic variation | After quote issuance, the isolated shared pricing function was temporarily changed from 50 to 51, writer rejected the old quote, and the exact function definition was restored. No hosted fee was changed. |
| Customer quote-state helper | PASS | `node scripts/verify-customer-preorder-quote.mjs`: parsing, total reconciliation, invalid/expired response, cart/address identity, sign-out. |
| Existing Customer Batch 1, 2, 3; Customer cart; fixed meal and drink POS cart | PASS | Six existing `node scripts/verify-*.mjs` commands completed (specific names below). |
| TypeScript, quality, production build | PASS | `npm.cmd run typecheck`; `npm.cmd run verify:quality` (11 checks); `npm.cmd run build` (3,034 modules). |
| Scoped whitespace | PASS | `git diff --check -- src/modules/customer/index.tsx`; whole-worktree check reports three pre-existing unrelated whitespace findings. |
| Browser at 360/390/768/1440, screenshots, keyboard/focus | NOT TESTED | Computer-use browser inventory had no browser/app surfaces. No screenshots were fabricated. |
| Cashier walk-in sale and paid Kitchen/FIFO lifecycle | NOT TESTED | The Cashier RPC/source was left untouched; the targeted fixture did not exercise a walk-in sale or paid order lifecycle. |
| Hosted authenticated quote/order and actual payment/KDS/FIFO completion | NOT TESTED | Migration is not deployed; no hosted business records were created. The targeted fixture did not exercise a paid order lifecycle. |

Existing regression commands: `node scripts/verify-customer-batch-1.mjs`, `node scripts/verify-customer-batch-2.mjs`, `node scripts/verify-customer-batch-3.mjs`, `node scripts/verify-customer-drink-cart.mjs`, `node scripts/verify-fixed-meal-cart.mjs`, and `node scripts/verify-drink-choice-cart.mjs`. All exited 0. The disposable backend commands are `docker exec codex-meal-customer-qa-20261021 psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d quote_rehearsal_session_20261022 -f /tmp/customer_preorder_quote_session.sql` (on a fresh clone), then the corresponding `/tmp/verify_customer_preorder_quote_session.sql`, and `node scripts/verify-customer-preorder-quote-concurrency.mjs` (after fixture setup). These local tests do not establish browser, hosted Auth/PostgREST, or full KDS/FIFO acceptance.

## Hosted state and release boundary

Read-only hosted checks on project `zhzluhqvysvsadwuugpa` confirm migration versions `20261021154712` (drink transition) and `20261021194914` (modifier retirement), the old Customer writer and drink choices still present, obsolete modifier tables absent, and both new quote and confirmed writer absent. No hosted SQL was deployed. Prior focused source inspection confirmed the deployed writer uses the pricing loop extracted here; a fresh full hosted-schema replay was not performed.

The first required approval is **deployment of exactly** `supabase/migrations/20261022120000_customer_preorder_quote.sql` to `zhzluhqvysvsadwuugpa`, after rechecking this hash and direct hosted preconditions. Do not run a blanket migration push or replay older local filenames; hosted history versions differ from those filenames. This one migration deliberately revokes the old Customer writer. During backend-first rollout, old frontend clients cannot submit new orders until the updated frontend is released. Use a controlled short maintenance/cutover window: deploy the approved SQL only, verify new RPC signatures/volatility/grants and old-writer denial read-only, then release the prepared frontend. A rollback that simply regrants the old writer would restore the price-confirmation bypass; recovery should keep ordering disabled or roll forward with a corrected migration and frontend. Any subsequent hosted order/payment acceptance requires separate authorization and must not manufacture production transactions.

No Manager, Cashier, Kitchen, Inventory, or Rider source files were changed in this task. No hosted business data or hosted migration history was modified.
The current Customer delivery policy has no zero-fee condition to test; a synthetic zero-fee product case would invent a policy the hosted writer does not have.
