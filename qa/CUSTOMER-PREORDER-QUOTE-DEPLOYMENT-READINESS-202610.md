# Customer pre-order quotation — deployment readiness, 2026-10-22

## A. Executive decision

**DEPLOYED under the user's subsequent explicit approval.** The reviewed migration was applied to the specified hosted project as version `20261022115601`, then its objects, grants, and relevant pre/post financial totals were checked read-only. The updated local Customer Vite app was restarted on port 5173 and serves the new quote/confirmed calls. Existing tabs still require a manual refresh; no browser tabs were accessible to refresh automatically. The postdeployment evidence at the end of this report supersedes the former GO recommendation below. Disposable fixture and hosted runtime evidence remain distinct.

## B. Exact migration identity and scope

| Item | Verified value |
| --- | --- |
| Target | `zhzluhqvysvsadwuugpa` (`RRJS-Foodhouse-Final`, ACTIVE_HEALTHY) |
| File | `supabase/migrations/20261022120000_customer_preorder_quote.sql` |
| SHA-256 | `D8C6F481B9CECCFF92FF96D54BAF97C9E14AAB36C2163A6FE968F07C86CBDDC1` (`Get-FileHash -Algorithm SHA256`; copied disposable file hash matched) |
| Hosted state | **DEPLOYED** as `20261022115601 customer_preorder_quote`; quote/confirmed RPCs and the private signing table are present. The earlier absence check was part of the preflight. |
| Last hosted history | `20261021194914 retire_legacy_menu_modifier_tables`; KDS v2 `20261021144029`, Fixed Meals `20261021144109`, Drink Choices `20261021154712` |

The exact SQL creates `customer_quote_private` and its RLS-enabled `signing_key` table with one generated 32-byte secret; creates `public.customer_order_pricing(jsonb)`, `customer_quote_terms(text,text,text,text,jsonb)`, `quote_customer_order(text,text,text,text,jsonb,uuid)`, and `place_customer_order_confirmed(text,text,text,text,jsonb,uuid,text)`; grants the two public RPCs to `authenticated` and `service_role`; and revokes `PUBLIC`, `anon`, and `authenticated` execution of the old six-argument writer. The private schema/key and two internal helpers are not executable by browser roles. It does not change existing business tables or rows, drop the old function, replay earlier migrations, or alter Cashier/Kitchen/Inventory objects. The generated secret is internal configuration, not an order or financial record.

## C. Direct hosted compatibility checks

Read-only Supabase catalog inspection was run against the exact project. The old and only `place_customer_order(text,text,text,text,jsonb,uuid)` overload is `SECURITY DEFINER`, `VOLATILE`, granted to `authenticated` and `service_role`, denied to `anon`; `authenticated` is not a member of `service_role`. Its whitespace-normalized `prosrc` exactly matches the local Drink Choices transition writer. No other public/auth function source calls that old writer. The planned revoke therefore removes the Customer browser route while preserving a privileged service role route. It does not change Cashier's separate writer.

| Existing hosted contract | Direct observation |
| --- | --- |
| Customer catalog | Active/available `menu_items`, `get_menu_effective_availability()`, `get_fixed_meal_options()`, `get_drink_choices()` present; the three getter RPCs allow `anon`, `authenticated`, `service_role`. |
| Customer payment/retrieval | `submit_customer_payment(uuid,text,text)` and `get_customer_order_payment(uuid)` present, executable by `authenticated`/`service_role`, denied to `anon`; Customer-own order and order-item SELECT RLS policies present. |
| Cashier | `create_walk_in_sale(uuid,fulfillment_type,text,text,text,text,text,text,payment_method,numeric,text,jsonb)` and `get_cashier_sale(uuid)` present, executable by `authenticated`/`service_role`, denied to `anon`. |
| Kitchen | `get_kds_queue_v2(uuid,text)` present, `SECURITY DEFINER`, terminal credential checked in its implementation; grants to `anon`, `authenticated`, `service_role` are unchanged. |
| Shared DB requirements | `auth.uid()`, `auth.jwt()`, pgcrypto `digest`, `hmac`, `gen_random_bytes`, order number sequence, inventory assertion/usable quantity helpers, order/payment/item/status relations, relevant FKs and constraints present. `orders.customer_request_id` has its unique partial index. No order/order-item triggers were found. |
| Retired modifier objects | Generic modifier tables absent; `drink_choices` exists. No restoration is needed. |

The hosted writer and the new common pricing loop both use catalog `menu_items.price`, required active drink choices plus their price adjustment, configured With Rice/Without Rice values, positive integer quantity validation, menu/inventory availability checks, rounding to two decimals, and the existing fixed **₱50 delivery fee**. Online discount and tax remain zero. The recorded subtotal, fee, and grand total fields already exist. The Cashier sale has its own discount/tax/payment rules and does not call the Customer writer. Hosted `assert_inventory_available_for_requested_items(jsonb)` is declared `VOLATILE` but its inspected body performs reads/raises only; its usable-quantity dependency is `STABLE`. This is source/catalog evidence, not a live hosted quotation call.

## D. Disposable rehearsal and transactional evidence

The named disposable container was returned to its original stopped state after verification; unrelated containers and volumes were left untouched.

The named `codex-meal-customer-qa-20261021` container was started without changing unrelated containers or volumes. Fresh database `quote_release_rehearsal_20261022` was cloned from the earlier post-retirement synthetic receipt fixture. The clone has three synthetic menu items, seven drink choices, a synthetic historical sale/receipt, and actual local definitions of the old Customer writer, Cashier sale/receipt, drink/fixed getters, availability helper, and KDS v2. Their whitespace-normalized function bodies were compared with hosted definitions and matched. The older clone lacked hosted `auth.jwt()` and `orders.customer_request_id`/unique index; `customer_preorder_quote_hosted_shape_prelude.sql` installed those **fixture-only** from the hosted shape. The hosted `submit_customer_payment` implementation remains absent in this clone. This is a **targeted fixture with selected hosted-matched contracts**, not a faithful hosted-schema replay or full Supabase Auth/PostgREST reconstruction. No real customer or financial data was copied.

The unchanged migration was executed with `psql -X -1 -v ON_ERROR_STOP=1` (one transaction) against the fresh clone. It completed without ownership/dependency errors. Post-migration catalog checks: quote and confirmed RPCs `SECURITY DEFINER` with `authenticated`/`service_role` access; old writer service-role-only; pricing and terms helpers denied to browser roles. No shared Cashier/KDS functions were removed. The disposable `verify_customer_preorder_quote_local.sql` completed with `ON_ERROR_STOP=1` and a final rollback. It used real `authenticated` role and JWT claims in database calls, not mocked RPC responses.

| Focused check | Result and execution evidence |
| --- | --- |
| Read-only quote, accepted order, authoritative prices | **PASS** — ordinary, quantity, mixed cart, With Rice, Without Rice, required drink choice, malicious client price override, subtotal/₱50 fee/total, persisted line snapshot and idempotent same request. Quote left order/payment counts, stock sum, and order sequence unchanged. |
| Invalid/security/stale cases | **PASS** — invalid quantity/address/choice, unavailable item, changed address/quantity/drink/product price, forged/expired token, cross-Customer/session token, inactive/non-Customer and `anon` denial, old writer denial. Stale/invalid cases produced no new order or payment. |
| Concurrency | **PASS** — `node scripts/verify-customer-preorder-quote-concurrency.mjs quote_release_rehearsal_20261022`: two simultaneous confirmed calls returned one order; concurrent catalog price change was rejected with no order; isolated fee-policy change from 50 to 51 rejected the old quote and was restored. |
| Cashier sale | **PASS in fixture** — actual `create_walk_in_sale` under authenticated active Cashier with open shift wrote a synthetic order, verified payment, and transaction/receipt, asserted in the same transaction, then rolled back. The first probe's direct assertion failed on Cashier's intended `payments` SELECT denial; the corrected privileged assertion passed. The sale RPC itself succeeded on both probes. |
| Historical Cashier receipt | **PASS in fixture** — actual authenticated `get_cashier_sale` preserved original receipt number, stored legacy modifier label, unit/line prices, grand total, and payment amount after this migration. |
| KDS v2 | **PASS in fixture** — an actual terminal-authenticated `get_kds_queue_v2` projected a synthetic quote-created order temporarily marked confirmed, with online channel and persisted items; the state change was rolled back. This does not exercise payment approval. |
| Inventory/FIFO | **PARTIAL** — quote inventory availability and no-stock-movement assertions passed; `node scripts/verify-fifo-batch-aware-sales-consumption.mjs` passed 67/67 source-contract checks. A paid confirmed order followed through real batch deduction was **NOT TESTED** in this clone. |
| Customer payment lifecycle | **NOT TESTED** in the disposable clone: the older fixture lacks the hosted `submit_customer_payment` RPC. Hosted signature/grant exists, but no hosted payment was created. |

No final migration or application test failed. The one initial Cashier assertion was a test-harness privilege error, corrected without changing product code. No hosted business records were touched.

## E. Security and financial integrity

The quote function is `STABLE`, reads catalog/availability, and contains no `INSERT`, `UPDATE`, `DELETE`, sequence allocation, or business-row lock. Runtime fixture counts/sequence/stock confirmed read-only behavior for tested paths. It checks an active Customer profile and uses a short-lived HMAC token bound to Customer UUID, Auth session ID, request UUID, normalized order terms, and server price/item snapshot. The confirmed writer checks identity and existing-request recovery, verifies the token, locks requested menu rows, recalculates with the same pricing function, and compares the signed snapshot before inserting. The disposable tests exercised stale/forged/expired/cross-principal rejection and no partial order/payment. Runtime hosted Auth/PostgREST enforcement remains untested until separately authorized deployment. The migration's exact old-writer revoke prevents authenticated Customer calls to bypass acceptance; it does not grant the private key or costing access.

## F. Frontend and controlled cutover

The active `src/modules/customer/index.tsx` calls `quote_customer_order` first and `place_customer_order_confirmed` only after a separate amount confirmation. It contains no active old-writer call. Its canonical cart lines carry `id`, `qty`, `modifier_ids`, and optional `meal_option`. Missing quote RPC fails before order creation and preserves the cart. Cart/address/session/expiry changes invalidate the displayed quote. A stale response refreshes the quote and requires another click. Ambiguous order responses retain the same request UUID; the UI does not silently issue a new request, and payment starts only after a confirmed order response and amount reconciliation.

The frontend is **local-only**: there is no public Customer deployment/CDN to switch or invalidate. An old open tab or cached old bundle may continue calling the six-argument writer; after the grant revoke it receives a permission error and cannot create a new order. A pre-revoke call already executing can finish, so operators must check for an existing order before retrying an ambiguous checkout. A refreshed new bundle before backend migration gets a missing-RPC quote error and creates no order. A checkout paused before the cutover must refresh and request a new quote. Existing orders remain eligible for the unchanged payment submission path. The unavoidable consequence is a brief inability for old sessions to place **new** orders until the updated local app is active/refreshed. No automatic tab invalidation is available.

**Executable sequence after separate approval:**

1. Announce a short Customer ordering pause; finish/reconcile in-flight checkouts and keep the current local frontend source/build available. Record a safe backup/recovery point through the existing deployment operator process. Do not accept new old-client checkouts during the change.
2. Reconfirm target project, exact SHA-256, migration history/absence, required objects/signatures/grants, old writer body, and fee policy with read-only catalog SQL. Stop on material drift.
3. Run **only** this reviewed SQL in one transaction using the controlled migration procedure. Do not `supabase db push`, replay prior migrations, or repair unrelated history. Record the **actual hosted migration version** assigned by the tool; it may differ from the filename.
4. Before reopening checkout, read-only verify new function signatures/volatility/ACLs, private schema/key access, old writer denial for `authenticated`/`anon` and retained `service_role`, unchanged fixed/drink/KDS/Cashier/payment contracts, and migration history. Do not call hosted order or payment writers.
5. Activate the already prepared local Customer frontend, restart/serve the updated build, and require users with open checkout tabs to refresh and obtain a new quote. Reopen ordering after RPC checks and local app availability. Any future authenticated hosted quote acceptance or real transaction test requires separate authorization; rendered browser acceptance is still pending.

## G. Recovery

- **Failure before transaction commit:** the SQL transaction rolls back; confirm history/object/grant state read-only before resuming the old frontend or retrying this same reviewed migration.
- **Migration committed but frontend old/unavailable, or old tabs remain:** keep the pause, restore the prepared local frontend service, refresh sessions, and have users request new quotes. Do not regrant the old Customer writer, which would reopen price-confirmation bypass.
- **Quote RPC errors:** keep new ordering paused, inspect read-only database/API diagnostics, and prepare a separately reviewed forward correction if needed. Existing orders/payment retrieval paths are unchanged by this SQL.
- **Ambiguous submit:** query the existing order by the same request identity through the established Customer recovery flow; do not issue a different request UUID or payment against an unconfirmed amount.
- **Post-commit SQL defect:** do not assume a blind rollback is safe. Preserve the denied old writer, assess the committed objects and key, and review a narrow forward fix before execution.

## H. Browser acceptance and focused local regressions

Computer-use inventory returned no browser or app surfaces. The 360×800, 390×844, 768×1024, and 1440×900 rendered states, screenshots, focus, overflow, and button hit areas are **NOT TESTED**; no visual evidence is claimed. No local browser session was available for authenticated disposable checkout. This is a remaining acceptance limitation, not a demonstrated database blocker.

All commands below exited 0 unless noted:

| Command | Result |
| --- | --- |
| `node scripts/verify-customer-preorder-quote.mjs` | PASS quote parsing/reconciliation/invalidation |
| `node scripts/verify-customer-batch-1.mjs`; `-batch-2.mjs`; `-batch-3.mjs` | PASS each |
| `node scripts/verify-customer-drink-cart.mjs`; `node scripts/verify-fixed-meal-cart.mjs`; `node scripts/verify-drink-choice-cart.mjs` | PASS each |
| `node scripts/verify-cashier-workspace.mjs` | PASS |
| `node scripts/verify-fifo-batch-aware-sales-consumption.mjs` | PASS 67/67 source-contract checks; not a live FIFO lifecycle |
| `npm.cmd run typecheck`; `npm.cmd run verify:quality`; `npm.cmd run build` | PASS; quality 11 checks, Vite built 3,034 modules |
| `git diff --check --` scoped Customer and quote fixture/script files | PASS; Git emitted a line-ending conversion warning for Customer index, not a whitespace failure |

## I. Unchanged systems and limits

The reviewed SQL does not alter Manager, Cashier, Kitchen, Inventory, Rider, historical order/payment rows, prices, stock, or Cashier shifts. The disposable fixture's synthetic business writes remained local; rollback was used for the scoped SQL tests. Direct hosted checks were catalog/history reads only. Cashier and KDS execution passed in the targeted clone, but full paid Customer → Cashier → Kitchen → FIFO behavior, hosted authenticated RPC execution, and rendered browser acceptance remain **NOT TESTED**. No claim of production lifecycle acceptance follows from the fixture.

## J. Required approval

The user subsequently approved this exact migration and coordinated local frontend cutover. It was applied once as hosted version `20261022115601`. That approval did not extend to blanket migration push, unrelated history repair, hosted test orders/payments/stock changes, public frontend deployment, or other modules. Those excluded actions were not performed.

## K. Authorized hosted cutover and direct postdeployment verification

**Execution:** The project list identified `zhzluhqvysvsadwuugpa` as `RRJS-Foodhouse-Final`, ACTIVE_HEALTHY. Immediately before execution, hosted migration history ended at `20261021194914 retire_legacy_menu_modifier_tables`; no quote migration/object existed. The old writer had exactly one six-argument overload, body fingerprint `49f018a86fb930fb20531d4a94c6a4a5` after whitespace normalization, with `authenticated` and `service_role` execution. Fixed Meals, Drink Choices, KDS v2, Cashier sale, and Customer payment dependencies were present. The exact local file SHA-256 was rechecked as `D8C6F481B9CECCFF92FF96D54BAF97C9E14AAB36C2163A6FE968F07C86CBDDC1`. Current local Customer source typechecked and built (3,034 modules); port 5173 served it. The project-specific Vite process was then stopped and port 5173 was confirmed closed for the temporary ordering pause. No unrelated container, volume, or server was stopped.

The Supabase `apply_migration` call was made **once**, with project ID `zhzluhqvysvsadwuugpa`, name `customer_preorder_quote`, and the exact file body. It returned `success:true`; the hosted migration ledger records **`20261022115601 customer_preorder_quote`**. No `db push`, prior migration replay, history repair, or other hosted SQL mutation was used. The reviewed DDL and privilege changes were rehearsed in one disposable transaction beforehand; the hosted tool returned success, but its response did not separately expose a transaction trace.

| Hosted check after commit | Direct read-only result |
| --- | --- |
| New quote | `quote_customer_order(text,text,text,text,jsonb,uuid)` present, `STABLE SECURITY DEFINER`, `anon=false`, `authenticated=true`, `service_role=true`. |
| Accepted writer | `place_customer_order_confirmed(text,text,text,text,jsonb,uuid,text)` present, `VOLATILE SECURITY DEFINER`, same expected grants. |
| Old writer bypass | `place_customer_order(text,text,text,text,jsonb,uuid)` remains the sole old overload; `anon=false`, **`authenticated=false`**, `service_role=true`. |
| Private internals | `customer_order_pricing(jsonb)` and `customer_quote_terms(text,text,text,text,jsonb)` present; `anon`/`authenticated` lack EXECUTE. Signing key table exists, RLS enabled, one key row; `authenticated` lacks schema USAGE and key SELECT. |
| Drink pricing | `get_drink_choices()` returned all **seven** expected rows: Coke/Sprite/Royal flavor choices at ₱0; Regular at ₱0 and Large at ₱15 for Softdrinks and Buko Juice. |
| Fixed Meal Options | `get_fixed_meal_options()` remains callable with the same grants/signature. It returned **zero rows**, matching zero currently configured `menu_items` with both Without Rice fields set. This is hosted catalog state, not a claim that an option was exercised live. |
| Customer menu/retrieval/payment | `get_menu_effective_availability()` returned 20 rows; Customer-own SELECT policies for orders/order items and `get_customer_order_payment(uuid)`/`submit_customer_payment(uuid,text,text)` signatures/grants remain present. No hosted payment call was made. |
| Cashier/Kitchen | `create_walk_in_sale(...)`, `get_cashier_sale(uuid)`, and `get_kds_queue_v2(uuid,text)` retained their expected signatures and grants. No hosted sale or KDS terminal call was made. |
| Historical business totals | Before and after: **48 orders**, subtotal sum **₱6,030.00**, grand-total sum **₱7,580.00**; **30 payments**, amount sum **₱4,395.00**; **18 inventory items**, quantity sum **204.057**. These aggregate comparisons and the DDL-only reviewed SQL support no change from this deployment; per-row historical hashes were not captured. |

**Local frontend activation:** After secure hosted grant checks, the local Vite app was restarted and reported ready at `http://localhost:5173/`. An HTTP read of its served Customer module returned 200 and contained `quote_customer_order` and `place_customer_order_confirmed`, with no active `supabase.rpc("place_customer_order")` call. Automatic background launch through `Start-Process` was rejected by the execution policy; running `npm.cmd run dev` in a retained command session succeeded. No public Customer frontend deployment exists. Browser inventories exposed no Customer tabs (`apps:[]`, `browsers:[]`; the Windows native pipe was unavailable), so **existing tabs could not be refreshed or enumerated**. Users with open Customer tabs must reload to use the new calls. Their old writer calls are now denied rather than allowed to bypass a quote.

**Remaining NOT TESTED:** authenticated hosted quote execution through PostgREST, a real accepted Customer order, payment submission, paid Kitchen/FIFO lifecycle, actual open-tab refresh, and rendered viewport acceptance. None was simulated or performed against hosted business data. The controlled database cutover and local server activation are complete; manual refresh of any existing Customer tab remains an operator/user action.
