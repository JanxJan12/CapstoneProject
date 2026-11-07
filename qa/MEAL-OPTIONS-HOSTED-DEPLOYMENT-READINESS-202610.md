# Fixed Meal Options: hosted deployment readiness (21 October 2026)

## A. Executive summary

**Current decision: READY FOR DEPLOYMENT APPROVAL for the two named migrations, subject to a separate release authorization; no hosted deployment was made.** The final section below records a hosted-schema-equivalent rehearsal on disposable PostgreSQL 17.6. Relevant hosted and disposable table structures, constraints, indexes, triggers, policies, grants, authorization helpers, and baseline routine bodies were compared before either candidate was applied. Both proposed migrations and the scoped regressions passed. This is not a full chronological replay or live operational acceptance. The Customer frontend is local-only, and Chicken Biryani still has no approved rice mapping.

## B. Hosted contract comparison

| Contract | Hosted on 21 October | Local candidate / effect |
| --- | --- | --- |
| `place_customer_order(text,text,text,text,jsonb,uuid)` | `SECURITY DEFINER`, search path `public, pg_temp`, same result columns. Accepts `{id,qty}`, groups by product, checks inventory, uses menu price, saves order items without modifier snapshots. | Same signature and result. Uses the local modifier-aware Customer body plus fixed meal choice validation, authoritative price, separate choice lines, and `order_items.modifiers` snapshot. The local `20261013105400_customer_modifier_completion.sql` is absent from hosted history; its body is incorporated here and should not be pushed separately. |
| `create_walk_in_sale(uuid,fulfillment_type,text,text,text,text,text,text,payment_method,numeric,text,jsonb)` | `SECURITY DEFINER`, search path `public, pg_temp`, supports required/priced modifiers and atomic order/payment/transaction recording. | Same signature, arguments, result, and existing financial path. Body comparison found 1,112 of 1,119 hosted body lines unchanged; edits add two local variables, a menu-row `FOR SHARE` lock, and scoped fixed-meal validation/pricing/snapshot logic. |
| `assert_inventory_available_for_requested_items(jsonb)` | Uses `inventory_usable_quantity`, aggregates recipe requirements over cart products. Service role can execute; anon/authenticated cannot. | Same signature/grants. Reads server-built line snapshots and omits only the explicitly selected mapped rice ingredient. Ordinary lines still aggregate all recipe ingredients. |
| `deduct_inventory_for_confirmed_order(uuid)` | Uses inventory item locks, scale checks, usable batch stock, FIFO/FEFO selection, allocations, issuance reconciliation, and replay checks. Called from `order_status_history_deduct_inventory_on_confirmed_trg` on confirmed history. | Same signature/grants and existing allocation path. The requirement query excludes mapped rice for Without Rice and prevents a newly added recipe link from being applied retroactively to old order lines. All later FIFO/FEFO and transaction code is retained. |
| Menu/recipe | `menu_items` has no fixed-meal columns; `menu_ingredients` has unique `(menu_item_id,inventory_item_id)` and positive quantity. `inventory_items.quantity_scale` is 0–3. | Adds two nullable menu columns and nullable `menu_ingredients.fixed_meal_added_at`; no existing row updates. A reduced price and rice recipe link must be configured together. Manager RPC rejects non-finite prices, unsupported precision, active legacy-choice overlap, existing-recipe rewrites, and switching away from a previously Manager-added rice link after re-enabling the choice. |
| Modifiers | `get_customer_menu_modifiers()` is deployed and callable by anon/authenticated. There are 27 active product-group links; Buko Juice size and Softdrinks flavor/size are required. | Tables, read RPC, legacy Cashier modifiers, and historical JSON snapshots remain. Customer modifier selections become server validated and priced; they were previously ignored by the hosted Customer writer. |
| Kitchen | Hosted has terminal-authorized `get_kds_queue(uuid,text)` but no `get_kds_queue_v2`. V1 omits `order_items.modifiers` from ticket items. | Active local Kitchen client calls v2. The separate pending `20261013162631_kds_queue_modifier_channel_v2.sql` wraps v1, preserves its ticket authorization, and projects only display-safe choice/modifier fields. It is a required release prerequisite for Kitchen visibility. |

Relevant `menu_items`, `menu_ingredients`, `inventory_items`, `order_items`, `orders`, and `payments` tables have RLS enabled. Anon and authenticated roles have no direct INSERT/UPDATE grant on these tables. Hosted order-item SELECT policies allow owners and authorized staff; recipe/inventory tables have no direct user SELECT policy. The migration adds no RLS policy or direct table grant. New Manager RPCs check `auth.uid()` against an active Manager profile; the isolated Customer-role call was denied. The public option RPC returns only eligible active item IDs, two prices, and choice availability flags, not stock counts.

The hosted migration ledger contains the inventory and batch authorities through `20261004170254`, restored modifier read RPC at hosted version `20261020174353`, and later Cashier migrations through `20261021053310`. It has no `20261021180000` collision. Several older local versions are absent or recorded under a different hosted version. A normal blanket migration push would include unrelated pending files and is unsuitable.

## C. Inventory compatibility

Hosted Chicken Biryani (`B3`, standard price 209) maps to one `Biryani Chicken - Breast` ingredient at 1 `pcs`, batch enabled. **It has no rice ingredient or approved quantity.** White Rice is a separate product at 35 and maps to 0.15 `kg` Rice; this does not establish Chicken Biryani's serving quantity or authorize renaming that product Extra Rice. No Biryani order rows were found in the focused hosted count at inspection time. The Manager must approve the actual rice item and quantity before rice consumption can be accepted.

With a Manager-created link, the RPC records its activation and the order writers snapshot the verified rice inventory ID. New With Rice lines include it in the normal recipe requirement; Without Rice lines exclude only it. Older lines with no verified mapping snapshot cannot acquire the newly inserted ingredient on later confirmation or replay. Existing recipe links keep their preexisting behavior. Availability uses hosted `inventory_usable_quantity` and the final order assertion aggregates the actual cart; a rice-only shortage can leave Without Rice available, while other mapped shortages block both choices. Confirmed-order deduction retains the hosted FIFO/FEFO allocation and transaction path. There is no parallel stock writer.

## D. Migration review

The combined candidates are `20261013162631_kds_queue_modifier_channel_v2.sql` followed by `20261021180000_fixed_meal_options_contract.sql`. Each runs inside `BEGIN`/`COMMIT`. The latter adds two nullable columns and three constraints on `menu_items`, one nullable provenance column on `menu_ingredients`, creates `get_fixed_meal_options` and four Manager read/configuration RPCs, and replaces the four directly affected functions listed in section B. It does not edit historical orders, payments, shifts, stock balances, modifier tables, triggers, or RLS. The composite FK requires the configured excluded inventory item to remain a real recipe link; the paired-null constraint prevents price-only activation. The new fixed-meal snapshot is stored beside existing modifier snapshots in `order_items.modifiers`; old rows remain readable.

Existing Customer and Cashier order RPC names, argument names/types, and return types are unchanged. The new option read returns booleans for each choice; local Customer and Cashier parsers require those fields. Both clients handle a missing new RPC (`PGRST202`) by showing the existing menu without fixed choices before backend deployment. The main release compatibility risk is an older **deployed** Customer frontend that sends only `{id,qty}` for a product with required drink choices: the new Customer writer correctly enforces those choices, so that frontend could fail checkout. The deployed frontend artifact/payload was **NOT TESTED**. Verify it before backend activation; do not weaken required-choice validation to guess a flavor or size.

## E. Isolated test evidence

| Check | Result | Limit |
| --- | --- | --- |
| Exact migration on disposable PostgreSQL 17.11 | **PASS** | Bootstrapped local baseline with a placeholder `storage.objects` table, batch/PO foundations, and the relevant exact FIFO authority through its confirmed-order deduction definition. The full migration chain was not replayed. |
| `verify_fixed_meal_options_local.sql` | **PASS** | Transaction-scoped synthetic Manager authorization, unconfigured Customer/Cashier choice denial, price-only constraint denial, finite/priced choices, scale rejection, re-enable recipe-link guard, client price tampering, separate lines, payment state and transaction/receipt link, idempotency, legacy modifiers, choice availability, existing-recipe preservation, and pre-mapping order protection. Rolled back. |
| `verify_fixed_meal_fifo_compat_local.sql` | **PASS** | Synthetic batch-enabled rice and other ingredient: Without Rice issued no rice; With Rice plus separate rice allocated 0.35 kg from the earliest batches; a later shortage left no partial issuance. Rolled back. These quantities are test values only. |
| `verify_fixed_meal_kds_compat_local.sql` | **PASS** | Both migrations applied in requested order. V1/v2 ticket count, chronology, and statuses matched; both meal choices, separate Extra Rice, and a required drink flavor appeared. A missing required flavor, bad secret, and inactive terminal were rejected. Rolled back. |
| `node scripts/verify-fixed-meal-cart.mjs` | **PASS** | Choice lines remain distinct, repeated same choice merges, separate rice stays independent. |
| TypeScript, quality, production build | **PASS** | `npm.cmd run typecheck`; `npm.cmd run verify:quality` (11 checks); `npm.cmd run build`. |
| Full hosted-schema/migration replay | **NOT TESTED** | Earlier data-dependent migrations require seeded restaurant records absent from a clean container; a complete chronological replay stopped before those prerequisites. Targeted schema evidence cannot be called full-schema proof. |
| Authenticated browser and real payment/stock flow | **NOT TESTED** | No hosted write, deployed frontend inspection, or real order was authorized. |

All synthetic fixture rows were rolled back; no production data was copied into the local database.

## F. Application compatibility

Manager API arguments match the candidate RPC, including nullable approved quantity. Customer and Cashier both send `meal_option` only for eligible meals, parse server price/availability, and preserve ordinary `modifier_ids`. Cashier order hydration, order review, and receipts use the persisted option name. Kitchen uses the persisted snapshot through KDS v2; hosted v1 alone does not expose it. Static source and build alignment **PASS**; authenticated browser acceptance **NOT TESTED**.

## G. Deployment sequence (requires separate approval)

1. Capture current hosted function definitions, grants, relevant catalog state, and migration versions as recovery evidence. Confirm the actually deployed Customer frontend sends required drink `modifier_ids`; if it does not, hold the fixed-meal migration until a coordinated checkout pause and compatible frontend cutover is reviewed. The old backend ignores modifier IDs, so simply activating the new frontend first would not provide correct modifier pricing during the interval.
2. Apply **only** the reviewed `20261013162631_kds_queue_modifier_channel_v2.sql` through a single-file migration operation; confirm v1 remains and v2 is callable only with a valid terminal credential. Record the hosted assigned version, which may differ from the filename.
3. Apply **only** the reviewed `20261021180000_fixed_meal_options_contract.sql` through a second single-file migration operation. Do not push all pending local migrations. The Customer modifier body is included here; do not separately replay `20261013105400_customer_modifier_completion.sql`.
4. Confirm new columns, exact RPC signatures/ACLs, RLS unchanged, order-writer bodies, and absence of historical row changes. Activate compatible Manager/Customer/Cashier frontend code. Keep fixed choices disabled until Manager pricing and approved recipe configuration are supplied.
5. Accept authenticated Manager authorization, Customer required drinks and both meal choices, Cashier sale/receipt totals, Kitchen ticket labels, shortage behavior, and historical review with scoped non-production test data and an approved test procedure.

No step above was executed on hosted in this assessment.

## H. Recovery plan

Prefer a forward correction while leaving the new columns and stored option snapshots intact. If the frontend misbehaves, return to the prior compatible frontend and stop new Manager fixed-option configuration; preserve the new order writers and deduction logic for any fixed-choice orders already accepted. Before any SQL restore, inspect pending fixed-choice orders and capture the exact then-current function definitions. Restoring the old deduction body while Without Rice orders await confirmation could consume rice incorrectly. Do not delete columns, modifier tables, snapshots, or financial rows as an emergency rollback. Any recovery migration needs separate review and authorization.

## I. Remaining blockers and smallest resolutions

- **Kitchen deployment prerequisite:** the additive v2 wrapper is locally corrected and tested, but hosted lacks it. Review and approve that exact single-file prerequisite before Kitchen acceptance.
- **Deployed Customer frontend unknown:** verify its actual drink payload before replacing the hosted Customer writer; activate a compatible frontend first if necessary.
- **Full replay incomplete:** run a controlled migration-level rehearsal on a sufficiently faithful disposable Supabase stack, or explicitly accept the narrower targeted evidence before deployment approval.
- **Actual Chicken Biryani recipe unknown:** Manager approves the real item, base unit, and serving quantity. Do not use the synthetic fixture values or claim rice consumption is tracked before configuration.
- **Hosted browser/payment acceptance:** perform after separately approved deployment using a scoped test procedure; it is not proven by local SQL or build checks.

## J. Final decision

**PARTIALLY READY.** The Kitchen integration is technically resolved in local source and isolated SQL. Hosted still needs the scoped v2 prerequisite; the deployed Customer payload and full-schema rehearsal remain unresolved. Keep fixed choices disabled until Manager-approved rice mapping and acceptance. No hosted deployment approval is implied by this report.

## K. Kitchen blocker resolution (21 October 2026)

**Root cause and selection.** The mounted `/kitchen` route uses `KitchenQueue` and `fetchKdsQueue`, which calls `get_kds_queue_v2(p_terminal_id uuid,p_terminal_secret text)`. Hosted has only `get_kds_queue(uuid,text)`. Its terminal-authorized result has order ID/number, fulfillment, status, notes, creation time, and item ID/name/quantity/unit price/instructions, but omits `order_channel` and persisted `order_items.modifiers`. It cannot distinguish the two rice choices or show saved drink selections. There is no equivalent deployed RPC. **Option A** is required: retain the pending additive v2 migration, rather than change the active client to v1.

**Correction.** `supabase/migrations/20261013162631_kds_queue_modifier_channel_v2.sql` now applies atomically and wraps the unchanged v1 ticket set. Its `SECURITY DEFINER` function has a fixed empty search path and schema-qualified references. The only added response fields are `order_channel` and each item’s purchase-time modifier display projection (`id`, `name`, numeric `price`); internal rice inventory IDs remain in the stored line snapshot and are not sent to Kitchen. Execution is explicitly granted to `anon`, `authenticated`, and `service_role`, matching hosted v1, but a valid active terminal ID and secret remain necessary because v2 calls v1. This is terminal credential authorization, not a Kitchen profile role. No table grant, RLS policy, status transition, order row, or financial record is changed. The v1 read updates terminal `last_used_at`; v2 inherits that behavior. The Kitchen polls every five seconds and forces a fresh queue read after an advance; no Realtime dependency was found in the active screen.

**Focused evidence.** The exact revised v2 and fixed-meal migrations applied to disposable PostgreSQL 17.11 over the targeted baseline. `verify_fixed_meal_kds_compat_local.sql` **PASS**: valid terminal queue parity with v1, two-ticket chronology/status, With Rice and Without Rice on distinct meal lines, separate Extra Rice and ordinary lines, saved required drink flavor, wrong-secret and inactive-terminal denial, no customer/payment fields or rice inventory IDs in the response, and unchanged stored order-line snapshots. `verify_fixed_meal_options_local.sql` **PASS** again. Both fixtures rolled back. TypeScript **PASS**; 11 quality checks **PASS**; production build **PASS**. A live authenticated Kitchen browser flow, full hosted-schema replay, and real-business rice/FIFO acceptance remain **NOT TESTED**. The synthetic rice quantity is test-only and does not configure Chicken Biryani.

**Files changed in this focused phase:** the pending KDS v2 migration, `supabase/tests/verify_fixed_meal_kds_compat_local.sql`, this report, and `qa/MEAL-OPTIONS-END-TO-END-ACCEPTANCE-202610.md`. The active Kitchen interface and its service were inspected but not edited. Deploy the reviewed KDS v2 file alone before the fixed-meal contract, verify its hosted signature/ACL and terminal denial, then activate compatible frontend code only after checking the deployed Customer required-drink payload. Hosted SQL inspection was read-only; no hosted mutation was made.

## Final Combined Migration Compatibility — October 2026

### A. Executive summary

**PARTIALLY READY for a later approval decision; do not deploy yet.** Both pending migrations executed in the required order on a targeted disposable PostgreSQL 17.11 reconstruction. Focused regressions passed. This phase closed a genuine inventory safety defect: a reduced price alone could previously activate rice choices without a mapped rice recipe. The migration now requires the price and approved rice link together, and both order writers reject an unconfigured choice. The deployed Customer frontend payload remains unverified, and the reconstruction is not a full hosted-schema replay. No hosted data or schema changed.

### B. Hosted Customer contract comparison

| Contract | Verified result | Compatibility |
| --- | --- | --- |
| Hosted Customer RPC | Only `place_customer_order(text,text,text,text,jsonb,uuid)` is deployed. Arguments are `p_customer_name`, `p_contact_number`, `p_delivery_address`, `p_landmark`, `p_items`, `p_request_id`, without defaults. Return is `(order_id,order_number,subtotal,delivery_fee,grand_total,current_status)`. It is `SECURITY DEFINER`, search path `public,pg_temp`, executable by authenticated/service role. It requires an active Customer, validates `{id,qty}`, uses menu prices, calls inventory assertion, groups rows by product, inserts orders/items without modifier snapshots, and initializes `waiting_payment_verification` without a payment row. | Existing `{id,qty}` orders for ordinary products work. Hosted writer ignores `modifier_ids` and `meal_option`. |
| Proposed Customer RPC | Same six arguments, names, types, and return columns; `SECURITY DEFINER` with empty search path and qualified references. It checks active Customer, validates required modifier groups and meal choice, uses catalog prices, asserts stock, preserves idempotency/payment initialization, and stores one canonical snapshot per choice line. | Local updated Customer sends `modifier_ids` and `meal_option` only for eligible meals. Its code and isolated SQL align. |
| Deployed Customer frontend | No trustworthy production URL, manifest, source map, deployment metadata, or connected browser tab was available. Local `dist` is a fresh local build and Git remote is not deployment evidence. | **NOT TESTED.** If it sends only `{id,qty}` for a required drink, the proposed RPC rejects checkout. A synthetic missing-flavor request was rejected, while the selected-flavor request passed. Do not assume backend-first compatibility. |

### C. Combined migration results

Applied locally in order: `20261013162631_kds_queue_modifier_channel_v2.sql`, then `20261021180000_fixed_meal_options_contract.sql`; both **PASS** with no SQL error. KDS adds only `get_kds_queue_v2(uuid,text)` with the active client’s result shape and terminal-gated v1 ticket set. It exposes `order_channel` and display-only stored modifier fields, keeps v1 and `advance_kds_order` unchanged, uses `SECURITY DEFINER`/empty search path, and grants execute to the same three API roles as v1. The fixed-meal migration adds two nullable `menu_items` columns, one nullable recipe provenance column, three constraints, five public/Manager option RPCs, and replaces Customer order, Cashier sale, inventory assertion, and confirmed-order deduction bodies. Customer/Cashier signatures and result shapes remain unchanged. No triggers, policies, modifier tables, historical rows, or direct table grants are altered. Existing drink choice validation is retained and tested.

The disposable catalog confirmed anon/authenticated/service execution on KDS v2 and the public option read; authenticated/service execution on Customer order, Cashier sale, and Manager functions; and service-only direct execution on inventory assertion/deduction. Each Manager function checks an active Manager profile. The Cashier sale rejects a Manager caller, matching the hosted Cashier-only rule.

The revised paired-null constraint and Manager RPC reject a reduced price without a rice link; `get_fixed_meal_options` and both writers also require that link. The Manager UI now asks for the approved item before enabling choices. Once configured, the default omitted choice is With Rice; Without Rice uses the lower server price. The actual Chicken Biryani row starts with both new columns null, so the migrations do not activate its choice.

### D. Isolated verification environment

Disposable `public.ecr.aws/supabase/postgres:17.11.0.004` with repository `20260825183637_remote_schema.sql`, Receiving batch and PO foundations, the exact relevant FIFO authority through its confirmed-order deduction definition, verified quantity-scale/customer-request prerequisites, and a placeholder `storage.objects` table required by the standalone image. The older baseline’s extra five-argument Customer overload was removed **only in the disposable database** to match hosted, which has only six arguments. Relevant menu, modifier, order, payment, Cashier sale, Kitchen v1, batch, inventory, role, and RLS structures were present. This was **targeted contract reconstruction**, not complete chronological/full hosted-schema replay; later unrelated migrations and hosted Auth/Storage/runtime configuration were not reproduced. No hosted records were copied.

### E. Functional regression matrix

| Area | Result | Evidence or limit |
| --- | --- | --- |
| Customer ordinary `{id,qty}`, With Rice, Without Rice, mixed lines, invalid choice, client price | **PASS, isolated** | `verify_fixed_meal_options_local.sql`; server prices and line snapshots checked. |
| Customer required drink, selected flavor, payment state, active Customer authorization | **PASS, isolated** | Missing flavor rejected; selected flavor passed; waiting-payment state and role denial checked. Deployed frontend payload **NOT TESTED**. |
| Cashier mixed choices, totals, separate rice, receipt/payment/transaction linkage, role boundary | **PASS, isolated** | Main SQL fixture; unconfigured choice denied. |
| Kitchen labels, ordinary/Extra Rice lines, order/channel/status, valid/invalid/inactive terminal, snapshot privacy | **PASS, isolated** | `verify_fixed_meal_kds_compat_local.sql` on combined migration order. |
| Rice inclusion/exclusion, other ingredient shortage, FIFO batches, failed issuance rollback | **PASS, synthetic** | Main and `verify_fixed_meal_fifo_compat_local.sql`; quantities are test-only. Actual Biryani stock accounting **NOT TESTED**. |
| POS cart, TypeScript, quality, production build | **PASS** | `node scripts/verify-fixed-meal-cart.mjs`; `npm.cmd run typecheck`; `npm.cmd run verify:quality` (11); `npm.cmd run build`. |
| Hosted Customer browser/checkout, real payment, full hosted-schema replay | **NOT TESTED** | No production checkout or hosted mutation was authorized. |

The three SQL suites rolled back their synthetic fixture rows; the post-test menu fixture count was zero.

### F. Inventory safety decision

The fixed-choice infrastructure can remain inactive after backend installation: Chicken Biryani has no configured reduced price or selected rice link; its option projection returns no choice, and direct Customer/Cashier `meal_option` input is rejected. Manager activation requires the actual inventory item and approved quantity in one transaction. A configured rice shortage makes With Rice unavailable while Without Rice may remain available; other shortages block both. The existing FIFO/FEFO deduction path remains the only stock writer. The Manager read distinguishes missing setup, while the public choice projection omits unconfigured/inactive products and returns availability booleans only for configured products; it does not expose a separate public reason code.

**Existing ordinary Chicken Biryani sales remain possible under their preexisting recipe, which has chicken but no rice mapping.** The migration does not fabricate rice deductions or make that legacy accounting accurate. Do not call actual rice consumption accepted or enable the new choice until the Manager approves and configures the real link. Separate Extra Rice remains its own product and existing inventory rule.

### G. Migration history

Read-only hosted ledger and catalog show neither proposed version `20261013162631` nor `20261021180000`, and neither associated object is present. No matching alternate-version KDS v2 or fixed-meal body was found. The local migration folder has no duplicate 14-digit versions. The hosted ledger does include the restored modifier-read RPC under `20261020174353`; local Customer modifier-completion `20261013105400` is absent, but its needed writer logic is included in the fixed-meal migration. Other local/hosted migration drift remains unrelated and untouched. A blanket `supabase db push` would include extra pending files and is prohibited for this release.

### H. Deployment sequence (separate authorization required)

1. Recheck hosted catalog, migration ledger, live function hashes/signatures/grants, RLS, and an identifiable deployed Customer build. Confirm whether that build sends `modifier_ids` for required drinks. If it does not, hold the fixed-meal migration and plan a controlled Customer checkout pause during backend/frontend cutover; deploying an older frontend against the stricter writer is unsafe. Do not default a required drink choice.
2. Apply **only** the reviewed KDS v2 SQL through a single-file migration operation, recording the hosted-assigned version; verify v1 is intact and v2 signature/grants/terminal denial. Then apply **only** the reviewed fixed-meal SQL in a separate operation. Do not push pending files or replay the older Customer modifier migration.
3. Verify read-only catalog state, exact new constraints/functions/grants, unchanged RLS/triggers, and no historical row updates. Activate compatible Manager/Customer/Cashier/Kitchen frontend builds only against confirmed backend contracts.
4. Manager approves Chicken Biryani’s real rice item and serving quantity, then enables the reduced price and mapping together. Perform separately approved authenticated test orders, payment/receipt, Kitchen, and stock/FIFO acceptance before declaring the feature operational. Legacy modifier retirement remains deferred.

### I. Recovery plan

Failed transactional SQL leaves its own migration unapplied. After a successful install, keep KDS v2 and fixed-meal snapshots/columns if any new orders exist. Pause fixed-choice configuration and frontend activation, inspect exact pending orders and stored snapshots, and prepare a forward correction. Do not restore the old deduction routine for pending Without Rice orders, delete modifiers, rewrite historical prices/payments, or reset the database. If the old deployed Customer frontend lacks required drink IDs, pause its checkout through a separately approved release procedure until a compatible frontend is active; a backend rollback can reintroduce incorrect modifier pricing and rice deduction.

### J. Final readiness decision

**PARTIALLY READY.** The combined migrations and safety gate passed focused isolated testing. Hosted deployment approval still requires evidence of the actual deployed Customer payload or a reviewed checkout cutover, plus explicit acceptance of the targeted-schema test limit. Manager recipe approval remains mandatory before fixed choices or actual rice consumption can be accepted. No hosted deployment or business-data mutation occurred.

## Deployed Customer Payload Compatibility Verification — October 2026 (21 October 2026)

### A. Deployment identification

**NOT ESTABLISHED.** The canonical repository has no authoritative Customer hosting URL, provider, deployment/build ID, or manifest linking a served artifact to Supabase project `zhzluhqvysvsadwuugpa`. Its `.env.local` contains Supabase environment variable names, but those local settings do not identify a deployed build. The checked repository's GitHub remote and local `dist` also do not prove deployment provenance. The available browser inventory had no connected tab or app. The actual Customer URL, environment, build identity, project association, and whether it serves this repository's current Customer implementation remain unknown. The Customer application URL or hosting project plus exact deployment/build ID has been requested from the user; no URL was guessed.

### B. Actual deployed payload

**NOT TESTED.** No served JavaScript, deployment artifact, source map, or authorized deployed browser/network request was available. Therefore the deployed order RPC name, top-level argument names/types, nested `p_items` shape, required choice handling, quantities, meal choice handling, and error behavior were not observed. No hosted checkout or payment request was submitted to obtain a payload.

### C. Contract comparison

| Contract | Evidence | Classification for deployed Customer compatibility |
| --- | --- | --- |
| Actual deployed Customer frontend | No verified URL or artifact; request structure unobserved. | **NOT ESTABLISHED**. |
| Existing hosted Customer RPC | Prior read-only catalog/body inspection found only `place_customer_order(text,text,text,text,jsonb,uuid)`, with named arguments `p_customer_name`, `p_contact_number`, `p_delivery_address`, `p_landmark`, `p_items`, and `p_request_id`. Its item parser accepts `{id,qty}` and ignores extra `modifier_ids`/`meal_option` keys; it does not enforce required choices or price them. | Existing server shape established; deployed caller **NOT ESTABLISHED**. |
| Proposed fixed-meal Customer RPC | The pending SQL keeps the same six argument names/types and result shape. Each JSON item requires UUID `id` and integer `qty` 1–99; `modifier_ids`, when present, must be an array of valid string option IDs. Missing required selections fail. An eligible configured meal accepts `meal_option` as `with_rice` or `without_rice` and defaults omission to `with_rice`; unrelated products reject that key. Prices come from the catalog. | Compatible with the updated local shape in targeted isolated tests; deployed caller **NOT ESTABLISHED**. |
| Updated local Customer frontend | `src/modules/customer/index.tsx` loads `get_customer_menu_modifiers`, checks group min/max before adding to cart, preserves selected option IDs, and calls `place_customer_order` with the six named arguments. `p_items` maps to `{id,qty,modifier_ids,meal_option?}`; ordinary lines send `modifier_ids: []`, and only selected meal lines send `meal_option`. | **COMPATIBLE locally** with the proposed shape; no deployed-build provenance. |
| Existing required drink choices | Prior hosted menu inspection found active modifiers, including required drink flavor/size choices. The proposed SQL checks group minimum/maximum and valid option IDs. | Server preservation established; deployed selection UI and submitted IDs **NOT ESTABLISHED**. |
| Ordinary menu item and new meal choices | Local ordinary lines send an empty modifier array and no meal key. Local configured meal lines use `with_rice`/`without_rice`; the pending SQL recognizes those values and requires an approved rice recipe link before enabling choices. | **COMPATIBLE locally**; deployed meal-choice behavior **NOT ESTABLISHED**. |

Matching RPC names alone cannot establish compatibility: the required nested drink option IDs are the release-critical difference.

### D. Drink modifier compatibility

For the **local** Customer code, modifier groups are fetched from `get_customer_menu_modifiers`, selections are checked against group minimum/maximum before cart addition, selected IDs persist on cart lines, and those IDs become `modifier_ids` in the order request. The proposed writer independently validates required groups and rejects missing or invalid choices. For the **deployed** Customer application, all six behaviors are **NOT TESTED** because its build and payload are unidentified. A deployed build sending only `{id,qty}` for a required drink would be incompatible with the proposed writer. Required validation must remain intact; neither a default flavor nor a duplicate drink product is an acceptable compatibility fix.

### E. Isolated test results

Earlier targeted disposable PostgreSQL tests **PASS** for the updated local shape: selected required drink option accepted; missing required option rejected; ordinary `{id,qty}` accepted where no required group applies; meal choices, option snapshots, pricing, authorization, and payment initialization checked as detailed above. These were synthetic fixtures rolled back after testing. **NOT TESTED:** replay of the *actual deployed* request shape, because no deployed request was observed. **NOT TESTED:** deployed authenticated browser checkout or hosted order/payment flow. No additional synthetic test was run against an assumed production payload.

### F. Local corrections

No application or SQL correction was justified by a proven deployed mismatch. This dated readiness section is the only change for this focused verification. The two prepared migrations, existing modifier tables, and working frontend code remain untouched.

### G. Remaining technical limitations

The immediate compatibility blocker is the missing deployed Customer URL or exact hosting artifact and its Supabase project association. Until identified, the required drink request cannot be inspected or reproduced in a disposable database. The prior targeted database reconstruction is not a full hosted-schema replay. Chicken Biryani's actual rice item and serving quantity still require Manager approval before rice options or rice-consumption acceptance; this is independent of identifying the Customer build.

### H. Deployment readiness

**PARTIALLY READY.** The updated local frontend and proposed backend align in focused isolated tests, but the currently deployed Customer payload is **NOT ESTABLISHED**. Do not install the fixed-meal writer on the assumption that its currently served frontend sends required drink IDs. First obtain the actual Customer URL or hosting project plus exact build ID, verify the served `p_items` shape and project association without submitting an order, then reproduce that observed shape in the disposable test. If the deployed build omits required choices, hold the fixed-meal migration and prepare a coordinated Customer checkout pause and compatible frontend/backend cutover; preserve strict server validation. No hosted migration, frontend deployment, or business-data write was performed in this verification.

## Local-only Customer compatibility completion — 21 October 2026

This section supersedes the deployed-Customer investigation and deployment-payload blocker above. The user confirmed that the Customer frontend is **local-only**; there is no public Customer deployment to identify. The canonical local order call sends `p_items` lines with `id`, `qty`, `modifier_ids`, and `meal_option` only when selected. No public build or hosted browser request is claimed as tested.

The interrupted disposable container was no longer present. A fresh isolated `public.ecr.aws/supabase/postgres:17.11.0.004` container was created with no published port or volume. It received the repository's 2026-08 baseline, the relevant receiving, inventory scale, and FIFO prerequisites, then `20261013162631_kds_queue_modifier_channel_v2.sql` and `20261021180000_fixed_meal_options_contract.sql` in that order. Both candidate migrations **PASS**. The baseline setup needed a placeholder `storage.objects`, one synthetic Chicken identity for a seed-dependent inventory migration, and inert signatures for three unrelated legacy aggregate stock functions so the targeted receiving/FIFO prerequisites could apply. `20261004163102_controlled_foodhouse_inventory_menu_configuration.sql` was **not applied** because its restaurant-specific Viands seed was absent. These accommodations are local to the disposable database and mean this is a **targeted contract fixture, not a faithful hosted-schema or full chronological migration replay**. The actual hosted schema, Auth, Storage, and business records were not copied or mutated.

| Customer compatibility check | Result | Exact isolated evidence |
| --- | --- | --- |
| Ordinary product | **PASS** | Canonical `{id,qty,modifier_ids:[]}` line with quantity 2 returned subtotal 160 at catalog price 80. The earlier main fixture also accepted ordinary legacy `{id,qty}`. |
| Required drink choice | **PASS** | Two drinks with selected Lemon option returned subtotal 130 at server price 65 each; stored line captured ID, name, and price 5. A mixed order stored selected Berry at server price 70. |
| Missing/invalid modifier IDs | **PASS, rejected** | Empty and omitted required drink IDs, unknown ID, duplicate ID, non-array `modifier_ids`, and an option belonging to another product were each denied. The required selection was never defaulted. |
| With Rice and Without Rice | **PASS** | The mixed order stored separate meal lines at 200 and 170, with names, adjustments, and verified rice mapping/exclusion IDs in `order_items.modifiers`. Invalid choice and a meal key on an ordinary product were denied. |
| Mixed cart and authoritative price | **PASS** | One With Rice, two Without Rice, one ordinary product, and one selected drink yielded four persisted lines, subtotal 690 and order grand total 740. Forged `unit_price:1` and `price_adjustment:999` did not affect server prices. |
| Authorization and order state | **PASS** | Active Customer succeeded; Cashier and inactive Customer were denied by the Customer writer; `anon` lacks execute. Customer order began in `waiting_payment_verification` with no payment row. |
| Persisted snapshots | **PASS** | Assertions read back each line's quantity, unit price, line total, and modifier JSON, including both meal choices, selected drink option, and empty ordinary snapshot. |
| Rollback/isolation | **PASS** | `verify_fixed_meal_customer_compat_local.sql` and the existing `verify_fixed_meal_options_local.sql` both exited 0 with `ON_ERROR_STOP=1`; each fixture rolled back. Post-test synthetic Customer menu and order counts were both zero. |
| Faithful hosted-schema replay, authenticated browser, real payment/stock | **NOT TESTED** | Targeted reconstruction cannot prove a full hosted Supabase migration, deployed frontend, real Chicken Biryani recipe, or live order flow. |

There were **no failed assertions** in either completed Customer fixture. The seed-dependent controlled-foodhouse migration failed to apply in the reconstruction because the synthetic baseline lacked the required active Viands category; it was deliberately excluded from this targeted test, not repaired or reported as a passing replay. No hosted SQL was deployed, no hosted business records changed, no rice quantity was inferred, and the legacy modifier tables remain.

**Readiness decision: READY FOR SCOPED DEPLOYMENT APPROVAL REVIEW, not approved for installation or operational acceptance.** The local-only Customer payload and proposed writer now have focused positive and negative compatibility evidence, so a deployed-Customer lookup is no longer a prerequisite. The next approval must explicitly cover the two named single-file migrations in order—KDS v2, then fixed-meal contract—and accept the targeted-fixture limit or require a faithful hosted-schema rehearsal first. Manager approval of the real Chicken Biryani rice item and serving quantity remains required before enabling choices or claiming real stock acceptance. Authenticated live checkout, payment, Kitchen, and inventory acceptance require a separately scoped post-deployment procedure.

## Final Hosted-Schema Rehearsal — October 2026

### A. Executive decision

**READY FOR DEPLOYMENT APPROVAL** for the exact KDS v2 and Fixed Meal Options migrations in that order. This is a hosted-schema-equivalent rehearsal of the relevant contracts, not a full chronological migration replay and not permission to deploy. The two files applied cleanly after a read-only hosted catalog comparison, and all five scoped SQL regressions passed. No hosted schema or business row was changed.

### B. Environment and schema sources

Hosted project `zhzluhqvysvsadwuugpa` reports PostgreSQL 17.6, engine release `17.6.1.147`. The new disposable container used `public.ecr.aws/supabase/postgres:17.6.1.147`, with no published port or mounted volume. The baseline came from the repository's 2026-08 schema and relevant applied local migrations, then read-only hosted catalog definitions and grants were used to align verified differences. A minimal local `storage.objects`/`storage.buckets` scaffold supported historical Storage-dependent migration parsing; it is **not** a full hosted Storage replay. Neither production records nor secrets were copied. The prior `codex-meal-customer-qa-20261021` container predated this phase and was left untouched.

### C. Baseline inventory and fidelity gate

| Hosted object/contract | Disposable baseline comparison | Material result |
| --- | --- | --- |
| `place_customer_order`, `create_walk_in_sale`, inventory assertion/deduction, `inventory_usable_quantity`, `get_kds_queue`, `advance_kds_order`, `get_customer_menu_modifiers`, `close_cashier_shift`, `submit_customer_payment` | Function signatures, security attributes, search paths, and `pg_get_functiondef` MD5 hashes matched hosted exactly before the candidates. Hosted has one six-argument Customer writer and KDS v1 only. | **MATCH**; no unrelated order, FIFO, KDS, or Cashier hotfix would be overwritten by a stale starting body. |
| Relevant public relations, including menu/recipe/modifiers, orders/items/payment/transactions, Cashier shifts, Kitchen terminals, and FIFO batch/ledger tables | Column names/types matched for 15 directly inspected tables; RLS state, constraint definitions, index definitions, and noninternal trigger definitions matched for those tables plus `order_status_history`. The hosted receiving-origin trigger was restored from its verified definition in the disposable database. | **MATCH** for inspected structural contracts. The extra trigger labels only receiving movements; issuance behavior was also tested. |
| Policies, roles, grants, Auth helpers | Relevant order/menu/Cashier policy expressions matched after role-name normalization. The hosted table-grant digest matched after local-only revokes on Cashier and legacy modifier tables; `create_walk_in_sale` anon execute was likewise revoked locally to mirror hosted. `auth.uid`, `auth.role`, and `auth.jwt` definitions were installed from hosted read-only definitions and their hashes matched. Enums matched. | **MATCH** for tested authorization paths; no simplified Auth helper remained. The hosted Cashier P1 restrictions were preserved. |
| Current fixed-option objects | Hosted read-only check found no `get_kds_queue_v2`, `get_fixed_meal_options`, Manager configuration RPC, or fixed-meal menu columns. Neither proposed migration version is in the hosted ledger. | Both candidate migrations are genuinely pending; no equivalent hosted object or timestamp collision was found. |

The compact mismatch record before alignment was: local baseline allowed anon execute on `create_walk_in_sale` and broad direct grants on Cashier/modifier tables; hosted did not. The local baseline lacked the hosted receiving-origin trigger and had older Supabase-image Auth helpers. Those differences were corrected **only in the disposable database** using verified hosted definitions/grants before the acceptance gate. All directly changed objects and their relevant dependencies passed the comparison afterward. The disposable menu contains installation/synthetic rows rather than production rows, so data population and hosted runtime configuration are outside the equivalence claim.

### D. Seed-dependent history

`20260904000000_inventory_phase_2a_recipe_deduction.sql` starts with recipe inserts keyed to historical restaurant UUIDs. Those rows were absent from a clean container, so the exact historical migration failed at its foreign key. Its remaining schema/function portion was applied in a **temporary derived disposable-only SQL file**; the canonical migration was not edited. Read-only hosted routine, table, constraint, index, trigger, and grant comparisons established the resulting relevant schema. This is why the run is not a full chronological replay.

`20261004163102_controlled_foodhouse_inventory_menu_configuration.sql` requires one active `Viands` category and one `Chicken` inventory identity. Those two identities were seeded synthetically with default zero stock in isolation; the exact canonical migration then passed and installed its defined ten products and recipes. Hosted read-only inspection found one active Viands category, one Chicken/kg identity, all ten specified product codes, and no Chicken Biryani rice recipe. This seed is installation/configuration data, not copied historical orders, payments, receipts, or stock balances. The new rice mapping used in tests remained synthetic and rolled back.

### E. Exact migration execution and post-check

`20261013162631_kds_queue_modifier_channel_v2.sql` **PASS**, followed by `20261021180000_fixed_meal_options_contract.sql` **PASS**, each with `psql -v ON_ERROR_STOP=1` and exit 0. SHA-256 hashes of the exact local files were `5CF18B1DEAF9FC5FA35B3F37DD7E4877918BF909FF4C705B4C262F208BC7FB86` and `DEAE9C4670229259ED29571EAABBC61A081AC5B711668ACE2A0DFEC8A9781682`, respectively. No candidate body was altered for this rehearsal.

Afterward, KDS v2 had the active client result columns, retained v1, used `SECURITY DEFINER` with an empty search path, and preserved terminal credential validation. The Customer and Cashier writer argument names/types and result shapes stayed unchanged. The new public option read and Manager configuration RPC had the expected security settings; internal inventory routines remained service-only, and anon remained unable to execute the order writers. Existing KDS v1, advance, shift closure, and Customer payment function hashes were unchanged. The relevant RLS policy and table-grant digests matched their pre-migration values; only the intended three menu constraints and new columns were added among the inspected structures. No historical rows were rewritten.

### F. Regression matrix

| Suite/check | Result | Evidence |
| --- | --- | --- |
| `verify_fixed_meal_options_local.sql` | **PASS** | Unconfigured choice denial, Manager authorization, Customer/Cashier mixed choice and price snapshots, receipt/payment linkage, legacy modifier price, historical idempotency, stock availability, old-order recipe protection. |
| `verify_fixed_meal_customer_compat_local.sql` | **PASS** | Canonical local `id`, `qty`, `modifier_ids`, optional `meal_option`; ordinary and required drink selections; missing/invalid IDs denied; both rice choices, mixed cart, forged prices ignored, persisted line snapshots, inactive/wrong-role denial. |
| `verify_fixed_meal_kds_compat_local.sql` | **PASS** | KDS v1/v2 ticket parity, order/status order, stored rice and drink labels, separate Extra Rice, wrong/inactive terminal denial, display-only projection. |
| `verify_fixed_meal_fifo_compat_local.sql` | **PASS after fixture correction** | The initial test fixture failed the hosted `inventory_batches_origin_reference_chk` because its synthetic legacy-opening batches lacked opening-balance references. The fixture now creates matching rollback-only opening records; Without Rice exclusion, other ingredient issuance, earliest-batch rice allocation, separate rice quantity, and failed-deduction rollback passed. No stock authority was weakened. |
| `verify_cashier_p1_security_hardening.sql` | **PASS** | Pending-payment shift closure and role/financial-read protections retained after both candidates. |
| POS cart, TypeScript, quality, build | **PASS** | `node scripts/verify-fixed-meal-cart.mjs`; `npm.cmd run typecheck`; `npm.cmd run verify:quality` (11 checks); `npm.cmd run build`. |

All SQL suites used synthetic data and rolled back. Post-test counts for their menu, order, and batch identifiers were zero. The final SQL suites had **no failed assertion**; the first FIFO run's fixture constraint error is recorded above rather than hidden.

### G. Remaining limitations

**NOT TESTED:** hosted installation, real authenticated browser/payment/order lifecycle, live Kitchen terminal after deployment, and real Chicken Biryani rice consumption. The local SQL suites exercise authenticated database roles and persisted financial records, but cannot prove hosted Auth, Storage, browser, or payment behavior. The full historical migration chain was not replayed because Phase 2A requires hardcoded restaurant IDs. These are explicit limits of the hosted-schema-equivalent rehearsal, not known defects in either proposed migration. The Customer frontend is local-only; there is no public deployment to inspect. The real Manager-approved rice item and serving quantity are still unavailable, so fixed choices must remain unconfigured after installation.

### H. Migration ledger and scoped deployment control

The hosted ledger has no `20261013162631` or `20261021180000` and no equivalent KDS v2/fixed-option objects. Unrelated local/hosted versions differ, including Manager ledger audit (`20261019095803` local / `20261019103144` hosted), Cashier delivery assignment (`20261020171527` / `20261020172715`), modifier read restoration (`20261020173810` / `20261020174353`), and closed shift restoration (`20261021120000` / `20261020201031`). These aliases and other pending local migrations must not be repaired or replayed as part of this release. A blanket `supabase db push` is unsuitable. A later authorized release should apply only the two reviewed files individually and record the hosted-assigned versions plus object hashes after each.

### I. Rollout and recovery plan

For a separately approved release, capture fresh hosted routine definitions, grants, policy/trigger/index catalog, migration ledger, and backup/recovery reference; recheck the two candidate SHA-256 hashes. Apply only KDS v2, verify its terminal-gated result while preserving v1, then apply only Fixed Meal Options. Verify exact signatures, ACLs, new constraints/columns, unchanged RLS/financial authorities, and the safe unconfigured Chicken Biryani state before activating compatible local frontend code against hosted. Manager configuration of the real rice item/quantity requires its own approval and subsequent authenticated Customer, Cashier, Kitchen, payment, and inventory acceptance. If a candidate transaction fails, stop without applying the next. After a successful installation, preserve stored order snapshots and pending choice orders; favor a reviewed forward correction and never restore old deduction logic over pending Without Rice orders.

### J. Final status and stop point

**READY FOR DEPLOYMENT APPROVAL.** The relevant hosted schema was reconstructed and compared, the scoped SQL and application checks passed, and missing rice configuration leaves the choice inactive while ordinary ordering remains available under its preexisting recipe. This status covers technical approval of the two named migrations only. It does **not** approve deployment, real rice mapping, or operational acceptance. Stop here for explicit approval of the exact two-file rollout and its post-deployment verification procedure.

Cleanup: the new `codex-meal-hosted-rehearsal-20261021` container and its five temporary SQL files were removed after verification. It had no published port or mounted volume. The preexisting `codex-meal-customer-qa-20261021` container was left running, and the Docker volume count remained 45. Existing uncommitted project work was preserved.

## Controlled hosted deployment — 21 October 2026

This section supersedes the predeployment status and stop point above. The user explicitly approved installing only the two reviewed backend migrations on hosted project `zhzluhqvysvsadwuugpa` (`RRJS-Foodhouse-Final`). The project reported healthy PostgreSQL `17.6.1.147`. Immediately before installation, the hosted migration ledger had neither candidate version nor equivalent KDS v2/fixed-option objects or columns. The original KDS v1, Customer/Cashier writers, inventory routines, Cashier shift closure, payment submission, and restored modifier reader were present. Their definitions and access settings were captured by read-only catalog queries. A single-file Supabase `apply_migration` call was used for each exact local SQL body; no blanket migration push, history repair, or unrelated migration was run.

| Applied order | Exact reviewed local file SHA-256 | Hosted ledger version / name | Result |
| --- | --- | --- | --- |
| 1 | `20261013162631_kds_queue_modifier_channel_v2.sql`: `5CF18B1DEAF9FC5FA35B3F37DD7E4877918BF909FF4C705B4C262F208BC7FB86` | `20261021144029` / `kds_queue_modifier_channel_v2` | **PASS**; tool returned success and ledger/object checks confirmed installation. |
| 2 | `20261021180000_fixed_meal_options_contract.sql`: `DEAE9C4670229259ED29571EAABBC61A081AC5B711668ACE2A0DFEC8A9781682` | `20261021144109` / `fixed_meal_options_contract` | **PASS**; tool returned success and ledger/object checks confirmed installation. |

The hosted versions differ from the local filename prefixes. Reconcile this history before any later authorized migration push; do not replay these files under their local versions.

**Read-only post-deployment checks — PASS:** `get_kds_queue_v2(uuid,text)` has the expected eight result columns, including `items jsonb` and `order_channel`; its definition obtains the ticket set through terminal-gated KDS v1 and projects persisted modifier `id`, `name`, and `price` labels. It is `SECURITY DEFINER` with an empty search path and intended API execute grants. KDS v1 definition hash remained `31da6a44405b64c3d4b8d0181edc7b16`. The three new menu constraints are present and validated, and the two nullable menu columns plus recipe provenance column are present. All five public/Manager option RPCs have the expected signatures, result shapes, `SECURITY DEFINER` and empty search path; anon lacks Manager RPC execution. Customer and Cashier writers retain their existing argument/result contracts, are callable by authenticated/service roles but not anon, and the two internal inventory routines remain service-only. The legacy modifier tables remain present with 6 groups, 16 options, and 27 item-group links; the existing modifier reader definition hash remained `5dd080b3ceae1808a22d60816637ad47`. KDS advance, shift closure, payment submission, and inventory-availability definition hashes remained unchanged from predeployment. The pending-GCash shift-closure trigger remains, and the two Cashier financial-read policies still require an active profile; the shift-closure function hash remained `d511f5b685688e26e3bed68ccbcf01a6`. Hosted Chicken Biryani has null reduced price and null rice mapping, and the public fixed-option projection currently returns zero rows. Thus its rice choices remain disabled.

The Customer/Cashier writer and inventory assertion/deduction definition hashes changed as intended in the fixed-meal migration; no hosted order, payment, shift, stock, recipe mapping, or other business record was written by this deployment procedure. The deployment confirms installed schema and contracts, **not** a live user flow. Authenticated browser checkout, required drink choice, Kitchen ticket rendering, payment, and real rice consumption remain **NOT TESTED** on hosted. Do not enable Chicken Biryani choices until a Manager approves and configures the actual rice inventory item and quantity. The next safe step is an authenticated browser read/navigation pass against the local frontend connected to this hosted project, followed by separately authorized transactional acceptance when appropriate; do not create production orders or payment records for that initial pass.

**Deployment status: PASS. Operational acceptance: PARTIAL (live flows NOT TESTED).**
