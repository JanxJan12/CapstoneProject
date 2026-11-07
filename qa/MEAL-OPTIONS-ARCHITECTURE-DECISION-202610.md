# Fixed Meal Options: architecture decision (21 October 2026)

## Scope and confirmed rules

One sellable meal may offer **With Rice** at its normal Manager-maintained price and **Without Rice** at a separately configured, lower price. The default is With Rice. Both choices retain one `menu_items.id`; separate choices are separate order lines. Extra Rice is sold as its own menu item. The database, rather than a submitted browser price, must price each line. Existing order amounts and descriptions remain historical snapshots. No hosted changes are authorized by this decision.

## Targeted dependency map

| Surface | Current contract | Consequence |
| --- | --- | --- |
| Modifier catalog | `menu_modifier_groups`, `menu_modifier_options`, `menu_item_modifier_groups` | Hosted catalog has 6 active groups, 16 options, 27 product links. Eight active products use them. Drink flavor and size include required choices; an `Extra rice` add-on is active on six meals. |
| Manager menu | `MenuManagementPage` calls `get_manager_menu_items` and `set_manager_menu_item_availability` | Current page controls availability only. It has no price editor or active modifier builder. A Manager-only meal configuration action is required. |
| Customer | `src/modules/customer/index.tsx` reads `get_customer_menu_modifiers`, keys cart lines by product and modifier IDs, and sends `modifier_ids` to `place_customer_order` | Customer selection, cart reconciliation, and price preview currently use generic modifiers. |
| Cashier | `menuApi.ts`, `ModifierDrawer.tsx`, POS cart, and `walkInSaleApi.ts` read the same modifier projection and send `modifier_ids` to `create_walk_in_sale` | Cart line identity and receipt review need an explicit meal choice while preserving existing modifiers on other products during transition. |
| Server pricing | Local `20261013105400_customer_modifier_completion.sql` validates selected IDs and prices Customer orders; the baseline `create_walk_in_sale` validates and prices Cashier modifiers | Both order writers need the same constrained meal-choice rule. They must reject arbitrary price input and reject choices on ineligible products. |
| Hosted drift | Hosted `place_customer_order` currently has the older body, while hosted `get_customer_menu_modifiers` and `create_walk_in_sale` exist | The local Customer modifier migration cannot be presumed deployed. A deployment plan must account for this exact live contract before enabling new UI. |
| Order history | `order_items` stores `item_name`, `unit_price`, `line_total`, and legacy `modifiers` JSONB | Those recorded amounts are authoritative history; old rows with no meal choice mean *unspecified*, not With Rice. |
| Kitchen | `get_kds_queue_v2` and Kitchen queue read `order_items.modifiers` | A dedicated meal-choice field must be projected and displayed, or a stable choice snapshot must be included in an existing kitchen-visible field. Kitchen state transitions stay unchanged. |
| Inventory | `assert_inventory_available_for_requested_items` aggregates `menu_ingredients` by product; `deduct_inventory_for_confirmed_order` consumes the same mapping from persisted order items | Both routines currently ignore a line's choice. Any verified rice exclusion requires line-aware availability and issuance. Do not subtract a guessed quantity. |
| Payment and receipt | Order writers snapshot order item prices and aggregate totals; payment, transaction and receipt records use those persisted totals | Preserve all existing discount, tax, payment, idempotency, shift, and receipt behavior. |

Hosted read-only inspection found Chicken Biryani as one active product with normal price 209 and no modifier links. Its only configured ingredient is one chicken item; **no rice ingredient is mapped to it**. Fried Rice and White Rice have separate rice ingredient mappings, which do not establish a Chicken Biryani rice quantity. The menu has White Rice as a separate sellable item, but no product named Extra Rice was found. These observations are not permission to seed, rename, or change prices.

## Decision: minimal dedicated fixed choice (Option B)

Use dedicated nullable configuration on `menu_items`: `without_rice_price numeric(10,2)` for eligibility and alternative price, plus an optional validated `without_rice_inventory_item_id` for a verified recipe exclusion. A null alternative price means an ordinary product. Store the immutable selected choice as a server-generated, namespaced entry in the existing `order_items.modifiers` JSONB snapshot. This is already read by Kitchen, receipts, and historical order detail; no second order-choice storage system is needed. Old snapshots without that entry mean *unspecified*, not With Rice. Add a check that an enabled alternative is nonnegative and strictly below the normal price. No new option group table or generic replacement engine is needed.

The Manager configuration RPC checks `auth.uid()` against an active Manager profile, locks the menu product, validates both prices, and updates normal and alternative prices atomically. Disabling the choice sets the alternative to null. It must prevent enabling the fixed choice on a product that still has active legacy modifier links until that product's choices have an approved transition. A narrow public read contract exposes only eligible active menu product IDs and the two prices to Cashier and Customer. The existing `menu_items.price` remains the standard price.

Both order writers accept a fixed `meal_option` token on each JSON cart line. For an eligible product they default an omitted token to `with_rice` for compatibility, accept only `with_rice` and `without_rice`, and read the current configured price while building the line snapshot. For an ordinary product they reject any meal option and keep its current generic modifier behavior. A meal-choice product cannot also accept generic modifier IDs. Each persisted line stores the canonical choice name in `order_items.modifiers` and its resulting unit/line prices. Neither writer accepts a client-provided price. Price changes after submission affect only future orders; idempotent retries return the original order.

Customer and POS cart keys include the meal choice. A selected line displays its choice and current preview price; existing cart reconciliation rechecks server configuration before checkout. The kitchen query and receipt/order detail projections display the persisted choice and continue to display historical `modifiers` snapshots. The Manager UI uses the term **Meal Options**, with controls shown only while configuring an applicable product.

Option A, using generic modifier rows for rice, offers fewer immediate SQL changes but retains group/option/link tables, allows pricing through a negative adjustment, and leaves the unwanted builder as permanent pricing authority. It also conflicts with the active `Extra rice` add-on and other product choices. A dedicated choice makes the allowed behavior explicit while preserving those legacy paths until a separate retirement decision.

## Inventory boundary

The current product-level availability and confirmed-order issuance cannot distinguish rice choices. Before enabling a product that has a rice ingredient link, the backend must identify that **specific existing ingredient link** and exclude it for only `without_rice` lines in both availability and deduction. The Manager configures an exclusion ID only from a verified `menu_ingredients` link, and the order line snapshots it for later deduction; matching a name such as `Rice` is not authoritative. Chicken Biryani currently has no rice link, so there is no verified quantity to exclude or standard-meal rice quantity to consume. No ingredient record or quantity may be invented. Full rice stock acceptance for that dish remains dependent on a Manager-approved recipe mapping.

## Legacy compatibility and retirement

The client confirmed that the existing choices must keep working during transition. Keep the three modifier tables and their RPCs. Existing drink choices, cooking preferences, add-ons, and submitted legacy option snapshots remain interpretable. A future removal migration must first establish an approved disposition for all 27 live links, replace every active ordering dependency, verify historical order detail rendering, inspect functions/views/triggers/policies/grants/FKs, and pass isolated rollback tests. No `DROP ... CASCADE` is acceptable. Hosted migration ordering must be reconciled at deployment time without blanket pushing pending migrations.

## Expected changes and verification matrix

| Area | Expected change | Focused proof |
| --- | --- | --- |
| Schema/Manager RPC | Two dedicated columns, price check, active-Manager configuration and narrow read | Unauthorized writes denied; valid updates round-trip; invalid prices rejected |
| Order RPCs | Server choice validation and price snapshot in both Customer and Cashier writers | Standard/without/ordinary/invalid/tampered/mixed/idempotent cases |
| Customer/POS | Explicit selector only for eligible meals; choice-safe cart lines | Cart merge, edit, quantity, desktop and narrow mobile |
| Kitchen/receipts | Persisted choice shown beside existing legacy snapshots | New and old order rows; recorded totals unchanged |
| Inventory | Exclude only an approved mapped rice component | Synthetic mapped fixture; no guessed Chicken Biryani quantity |
| Deployment | Exact migration preflight and separately approved hosted apply | Hosted object and authorization checks before app activation |

## Current gate

Pricing, line persistence, and historical financial compatibility have a clear design. The transition rule is confirmed: keep existing choices working. Local fixed-option implementation can proceed alongside them; retirement and any production cutover remain gated. The Chicken Biryani recipe gap blocks a claim of rice inventory accounting for that dish, not the price/choice model.

## 21 October resume checkpoint

The Manager configuration now supports a deliberate recipe addition. An active Manager selects an active inventory item, enters its approved quantity in that item's base unit (up to three decimal places), and saves the fixed meal configuration. The same SQL transaction inserts a **missing** `menu_ingredients` link and records its inventory item ID for Without Rice exclusion. An existing link is reused only at its recorded quantity; this action rejects a different quantity and does not rewrite other recipe links. Nothing is seeded or inferred for Chicken Biryani.

The public fixed-meal projection returns availability for each choice. With Rice checks every mapped ingredient; Without Rice checks every mapped ingredient except the one explicitly configured rice link. It uses `inventory_usable_quantity`, preserving the existing aggregate/batch availability authority. An unconfigured link cannot create a rice deduction or exclusion. Manager setup remains required before claiming that rice consumption for the actual dish is tracked. The live stock quantities and recipe were not changed.

## 21 October hosted compatibility checkpoint

Read-only hosted inspection confirmed the Customer order RPC is the older `{id,qty}` body, while Cashier already validates generic modifiers. The candidate retains both RPC signatures/returns and incorporates the previously local modifier-aware Customer body. Hosted FIFO issuance is batch-aware; a line-by-line body comparison showed the candidate keeps its locking, allocation order, scale checks, replay checks, and ledger writes. The confirmed-order trigger still calls that function. Hosted Kitchen has only `get_kds_queue(uuid,text)`; the local Kitchen client needs the separate additive `20261013162631_kds_queue_modifier_channel_v2.sql` before selected rice options can be seen in its queue.

The Manager RPC now rejects non-finite prices and rice quantities that do not match the inventory item's configured unit precision. A newly added rice recipe link records `menu_ingredients.fixed_meal_added_at`. New order-line snapshots include the verified rice inventory ID; the deduction function uses that snapshot to prevent a newly added link from being applied to old orders on later confirmation or replay. Existing recipe links and their historical behavior remain unchanged. A focused synthetic batch fixture passed FIFO allocation and failure rollback. Full chronological migration replay and authenticated browser acceptance remain unproven. The deployment gate and exact release order are in `qa/MEAL-OPTIONS-HOSTED-DEPLOYMENT-READINESS-202610.md`.

## 21 October combined migration correction

The earlier design description of an optional rice link is superseded for **enabled** fixed choices. A reduced price and verified rice recipe link must now be configured together. The database constraint, Manager RPC, public option projection, Customer/Cashier writers, and Manager form enforce this gate. Both columns remain null for an unconfigured ordinary product; no fixed choice is shown or accepted. Chicken Biryani has not been configured. Existing ordinary sales under its old recipe remain possible, and their rice consumption cannot be claimed as tracked. The combined release evidence and unresolved deployed Customer payload are in the readiness report.
