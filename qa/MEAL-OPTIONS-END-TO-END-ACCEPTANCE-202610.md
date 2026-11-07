# Fixed Meal Options local acceptance (21 October 2026)

**Overall: PARTIAL.** The fixed choice is implemented locally and passed focused SQL and cart tests. It has not been deployed to the hosted project or verified in authenticated browsers. No real order, payment, shift, or inventory record was changed.

## Exact local changes

- `supabase/migrations/20261021180000_fixed_meal_options_contract.sql`: two nullable `menu_items` configuration columns; public fixed-price read projection; active-Manager read/configuration RPCs; server-priced Customer and Cashier order creation; a canonical option snapshot in `order_items.modifiers`; verified-ingredient exclusion in availability and confirmed-order issuance. Existing modifier tables and grants remain.
- `supabase/tests/verify_fixed_meal_options_local.sql`: transaction-scoped synthetic role, menu, order, modifier, and recipe checks with `ROLLBACK`. The 0.2 kg synthetic rice quantity is a test fixture only, not an actual Chicken Biryani recipe.
- `src/modules/manager/api/mealOptionsApi.ts`, `src/modules/manager/menu/MenuManagementPage.tsx`: Manager Meal Options configuration, including normal and alternative prices and selection of an existing recipe link if one represents included rice.
- `src/modules/cashier/types.ts`, `src/modules/cashier/api/menuApi.ts`, `src/modules/cashier/api/walkInSaleApi.ts`, `src/modules/cashier/api/cashierSaleHydrationApi.ts`, `src/modules/cashier/pos/ModifierDrawer.tsx`, `src/modules/cashier/pos/OrderItem.tsx`, `src/modules/cashier/pos/ProductCard.tsx`, `src/modules/cashier/pos/ReceiptContent.tsx`, `src/modules/cashier/pos/posOperations.ts`, `src/modules/cashier/pos/useWalkInPOSController.ts`: selector, cart line separation/merge, server payload, historical hydration and receipt display.
- `src/modules/customer/index.tsx`: same selector/prices, saved-cart reconciliation, choice-safe cart lines, checkout payload and review display.
- `scripts/verify-fixed-meal-cart.mjs`: focused POS cart assertions.

## Actual checks

| Scenario / layer | Result | Evidence |
| --- | --- | --- |
| SQL migration parses/applies | **PASS, partial schema** | Applied the exact local migration once with `psql -v ON_ERROR_STOP=1` to a disposable `public.ecr.aws/supabase/postgres:17.11.0.004` container after the 2026-08 baseline and batch foundation. It committed. The baseline stopped at a missing `storage.objects` trigger; this was not a complete migration replay. |
| Manager price and authorization | **PASS, isolated** | SQL test configured 200 standard/170 alternative, rejected 210 alternative and Customer configuration access. Public menu projection returned the configured prices. |
| Customer choice and price | **PASS, isolated** | One synthetic order contained separate 200 With Rice, 170 Without Rice, and 35 separate rice lines; subtotal 405 and three recorded rows. Submitted `unit_price: 1` was ignored. Invalid choice and a choice on an ordinary product were rejected. |
| Cashier choice and price | **PASS, isolated** | Synthetic confirmed sale contained separate 200/170/80 lines, subtotal and total 450. Submitted `unit_price: 1` was ignored; invalid choice rejected; idempotent replay kept the amount. |
| Legacy modifiers | **PASS, isolated** | Synthetic ordinary product with a 10 priced modifier still sold for 90. Manager RPC rejected enabling fixed meal options on that linked product. Hosted live links were not changed. |
| Historical amount and idempotency | **PASS, isolated** | Changing alternative price to 160 after the synthetic order left its recorded 170 line and 405 order subtotal intact; same request ID returned the original total. |
| Mapped rice availability/issuance | **PASS, aggregate fixture** | Synthetic recipe link of 0.2 kg: at zero rice stock, Without Rice order passed and With Rice order failed availability. Confirming Without Rice consumed zero rice; confirming With Rice from 1 kg left 0.8 kg. Test used the baseline's aggregate stock path and conditional temporary compatibility helpers. FIFO/batch issuance is **NOT TESTED**. |
| POS cart merge and separate Extra Rice | **PASS, source test** | `node scripts/verify-fixed-meal-cart.mjs`: different choices stayed separate, repeated Without Rice merged, and the independent rice product remained a third line. |
| TypeScript | **PASS** | `npm.cmd run typecheck` exit 0. |
| Existing quality checks | **PASS** | `npm.cmd run verify:quality`: 11 checks. |
| Production build | **PASS** | `npm.cmd run build` exit 0. Build output is not a deployment. |
| Authenticated Manager, Customer, Cashier and Kitchen browser views | **NOT TESTED** | No disposable PostgREST/Auth/browser stack with this migration was started. |
| Actual Chicken Biryani rice inventory | **BLOCKED** | Hosted recipe has no rice ingredient/quantity. No production recipe was invented or changed. |
| Hosted schema, live orders and receipts | **NOT TESTED** | No hosted migration, application deployment or live test order was authorized. |

The disposable SQL test executes with `BEGIN`/`ROLLBACK`; all order, payment, shift, and stock rows created by it are synthetic and rolled back. The local container's schema is incomplete relative to hosted Supabase, so its PASS results do not establish full migration compatibility, FIFO/batch behavior, or authenticated UI acceptance.

## Deployment and remaining gates

Do not activate the new frontend against the hosted project until the exact backend migration and its preceding local/hosted contract differences have been reviewed and separately approved for controlled deployment. The Customer RPC currently hosted is older than the local modifier-aware body included in this migration. Verify the exact hosted routine bodies, table constraints, grants, migration history, and clean isolated full-schema replay before requesting that approval. Deploy only the reviewed migration, never a blanket push.

The Manager must configure the real lower price. Actual Chicken Biryani rice stock accounting requires a client-approved ingredient mapping and quantity; the synthetic test quantity is not a recommendation. The hosted menu has `White Rice` as a separate sellable product, but no product currently named `Extra Rice`; whether to rename or add one requires a separate menu-data decision. Legacy modifiers stay active during transition as confirmed by the client.

## 21 October resume checkpoint

**Local implementation: PARTIAL acceptance.** The feature code and focused tests are complete for the available isolated schema. Actual hosted configuration, browser workflows, and full batch-aware integration remain unverified. The prior check table above records the earlier implementation pass; this checkpoint covers the additions made on resume.

### Changes in this checkpoint

- `supabase/migrations/20261021180000_fixed_meal_options_contract.sql`: adds choice-specific `with_rice_available`/`without_rice_available` to the public read RPC; adds a Manager-only active inventory candidate read; extends the Manager configuration RPC to insert only an explicitly approved missing rice recipe link, in the same transaction as prices and exclusion ID. Existing recipe quantities cannot be rewritten through this RPC.
- `supabase/tests/verify_fixed_meal_options_local.sql`: asserts the Manager's synthetic recipe insertion, rejects rewriting its quantity, checks rice-only and other-ingredient shortages, and denies a Customer the Manager candidate read. The synthetic 0.2 kg is a test value only.
- `src/modules/manager/api/mealOptionsApi.ts`, `src/modules/manager/menu/MenuManagementPage.tsx`: list active inventory candidates and accept an approved quantity for a new link. Existing links show their saved quantity.
- `src/modules/customer/index.tsx`, `src/modules/cashier/api/menuApi.ts`, `src/modules/cashier/types.ts`, `src/modules/cashier/pos/ModifierDrawer.tsx`, `src/modules/cashier/pos/useWalkInPOSController.ts`: consume per-choice availability and allow a valid Without Rice choice when only the mapped rice item is short.

### Current verification

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Updated migration apply | **PASS, partial schema** | Fresh disposable PostgreSQL 17 container; baseline stopped at absent `storage.objects`, then receipt/batch foundation and a local compatibility `inventory_usable_quantity` helper were applied before this exact migration. The migration committed. This is not full hosted-schema parity. |
| Expanded SQL acceptance | **PASS, isolated** | `psql -v ON_ERROR_STOP=1` completed; Manager synthetic recipe addition and preservation, choice-specific stock availability, unrelated ingredient constraint, Customer/Cashier prices and snapshots, legacy modifier, idempotency and historical amounts passed. Test transaction rolled back; synthetic menu row count afterward was zero. |
| TypeScript, focused cart, quality, build | **PASS** | `npm.cmd run typecheck`, `node scripts/verify-fixed-meal-cart.mjs`, `npm.cmd run verify:quality` (11 checks), `npm.cmd run build` all exited 0 after the resume edits. |
| Authenticated UI and full FIFO/batch issuance | **NOT TESTED** | No authenticated disposable browser stack or full migration replay was run. Aggregate synthetic issuance passed in the partial schema only. |
| Actual Chicken Biryani rice accounting | **BLOCKED** | The Manager has not selected and approved the actual inventory item and serving quantity; no real recipe or inventory quantity was changed. |
| Hosted deployment and real order/payment/receipt | **NOT TESTED** | No hosted SQL or business-data write was made. |

### Deployment sequence and approval gate

The candidate file is `supabase/migrations/20261021180000_fixed_meal_options_contract.sql`. Its existing dependencies include the inventory recipe and usable-quantity authority (`20260904000000_inventory_phase_2a_recipe_deduction.sql`, `20261004170254_fifo_batch_aware_sales_consumption.sql`) and modifier-aware Customer ordering (`20261013105400_customer_modifier_completion.sql`), whose Customer writer body is incorporated into the candidate. Verify these exact contracts and migration history against hosted before any deployment. The safe logical order is prerequisite backend contracts, reviewed fixed-meal migration, then compatible frontend activation; do not run unrelated pending migrations. Separate hosted approval is required. The Manager must subsequently enter the real price, rice item, and serving quantity before rice inventory accounting can be accepted.

The final exact migration and final SQL test were reapplied to a fresh disposable container after removing an unrelated copied function definition. The test again exited 0 and left zero synthetic menu rows after rollback. The task-owned container was stopped. No unrelated pending migration or hosted SQL was run.

## 21 October hosted compatibility checkpoint

The full comparison and release decision are in `qa/MEAL-OPTIONS-HOSTED-DEPLOYMENT-READINESS-202610.md`. Read-only hosted checks confirmed matching Customer/Cashier RPC signatures and the batch-aware inventory contract, but exposed two release gaps: hosted Customer ordering still lacks modifier support, and hosted Kitchen lacks `get_kds_queue_v2`. The fixed-meal migration incorporates the Customer modifier writer; the separate, additive KDS v2 migration remains a required prerequisite. The deployed Customer frontend's actual required-drink payload is **NOT TESTED**.

Local corrections were made only in `supabase/migrations/20261021180000_fixed_meal_options_contract.sql`: finite price rejection, inventory unit-scale validation, and provenance/snapshot protection so a newly added rice mapping cannot retroactively issue rice for an older order. New focused rollback-only tests were added at `supabase/tests/verify_fixed_meal_fifo_compat_local.sql` and `supabase/tests/verify_fixed_meal_kds_compat_local.sql`; `supabase/tests/verify_fixed_meal_options_local.sql` now checks the new guards, historical order behavior, and payment/receipt links with RLS-aware assertions.

| Check | Result | Evidence and limitation |
| --- | --- | --- |
| Hosted catalog, bodies, migrations, RLS/grants | **PASS, read-only** | Queried the project directly; no hosted schema/data write. Candidate version absent, KDS v2 and older local Customer modifier version absent, required drink links still active. |
| Exact candidate SQL in disposable PostgreSQL | **PASS, targeted schema** | Applied after local baseline and targeted inventory/FIFO prerequisites; not a full chronological hosted-schema replay. |
| Meal, batch FIFO, and KDS SQL fixtures | **PASS, isolated** | Three rollback-only tests: choice/pricing/auth, separate rice and FIFO allocations, other ingredient enforcement, failed deduction rollback, old-order recipe protection, Kitchen labels and terminal denial. Fixture menu row count was zero afterward. |
| TypeScript, quality, cart, build | **PASS** | All four scoped commands exited 0 after corrections. |
| Full migration replay, deployed frontend, authenticated browser, actual Biryani recipe | **NOT TESTED / BLOCKED as applicable** | Seed-dependent historical migrations prevented a clean chronological rehearsal; no approved Biryani rice item/quantity or hosted test order was provided. |

No hosted migration was deployed. The next release review must cover `20261013162631_kds_queue_modifier_channel_v2.sql` before `20261021180000_fixed_meal_options_contract.sql`, confirm the deployed Customer payload for required drinks, and approve only single-file migrations. Actual Biryani inventory acceptance remains blocked until Manager configuration.

## 21 October Kitchen blocker resolution checkpoint

The active `/kitchen` queue calls `get_kds_queue_v2(uuid,text)`. Read-only hosted inspection reconfirmed that only terminal-authorized v1 is deployed; v1 omits purchase-time modifier snapshots and order channel. The existing pending v2 migration is therefore required. It was narrowed locally to expose only stored option `id`, `name`, and numeric `price`, leaving internal rice inventory IDs in `order_items.modifiers`. No Kitchen UI or service code changed.

The revised v2 migration and fixed-meal migration applied to a disposable PostgreSQL 17.11 database. The updated rollback-only KDS fixture **PASS** checked v1/v2 ticket parity, two-ticket chronology and status, With Rice/Without Rice labels on distinct lines, Extra Rice as its own line, an ordinary item, required drink flavor, wrong and inactive terminal denial, no extra customer/payment or rice-mapping fields, and unchanged stored snapshots. The main fixed-meal SQL fixture, TypeScript, 11 quality checks, and production build also **PASS**. Authenticated browser Kitchen acceptance, full hosted-schema replay, and actual Manager-approved Chicken Biryani rice consumption remain **NOT TESTED**. Hosted was inspected read-only and not changed. Deployment order remains scoped KDS v2, then fixed-meal contract, with deployed Customer drink-payload compatibility checked before activation.

## 21 October final combined migration checkpoint

KDS v2 followed by the fixed-meal migration applied without error in a targeted disposable PostgreSQL 17.11 reconstruction. This phase found and corrected a price-only activation path: a configured lower price without a rice link could previously display and accept rice choices. The revised database constraint and Manager RPC require price and approved rice mapping together; public reads and both order writers also fail closed. A synthetic old `{id,qty}` Customer order and an unconfigured Cashier choice denial passed. After synthetic Manager configuration, choice pricing, snapshots, Cashier receipts, FIFO issuance/rollback, Kitchen labels, and existing required drink selections passed. A synthetic required drink without `modifier_ids` was rejected, so a deployed frontend with that payload would be incompatible; its actual payload remains **NOT TESTED**. The main, FIFO, and KDS SQL suites, POS cart script, TypeScript, 11 quality checks, and build all **PASS**. The reconstruction used targeted hosted authorities, not a full chronological hosted-schema replay. No hosted write occurred; actual Chicken Biryani rice mapping and stock acceptance remain unapproved.
