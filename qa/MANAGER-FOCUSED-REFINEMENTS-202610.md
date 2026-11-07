# Manager focused refinements — 23 October 2026

**Final disposition:** **FRONTEND ACCEPTED — POLICY PENDING.** The initial checkpoint below is retained for context; the final verification and current decision are at the end of this report.

## Initial checkpoint decision (before final verification)

| Refinement | Result | Reason |
| --- | --- | --- |
| Inventory Request quantity precision | **PARTIAL** | The local calculation, draft, review, details, and export code is corrected and focused checks pass. A current rendered request flow and synthetic issuance were not executed. |
| Meal Options product eligibility | **PARTIAL** | The selector is narrowed to active Viands products, excludes known drink-choice products, opens without a selection, and handles an empty list. The database does not expose a general approved-meal flag or reject every nonmeal configuration, so category membership is a UX classification rather than authoritative approval. |

At that checkpoint, the focused milestone could not close as fully accepted. No migration, deployment, hosted business write, request issuance, Receiving post, meal save, or drink save had occurred.

## Confirmed contracts and causes

- `inventory_items.quantity_scale` is constrained to **0–3**, per inventory item and base unit. Inventory quantities and issued request lines use PostgreSQL `numeric(12,3)`; the Manager issue/revision RPC requires a positive quantity at the item's scale, caps it at `999999999.999`, calculates the provisional gap with PostgreSQL numeric subtraction, and requires an override reason when the requested amount differs. Posted accepted quantities and outstanding request deductions remain server computed. Liters/kilograms may have fractional scale; pieces, bottles, and packs follow their own item scale rather than a unit-name assumption. Source: `20261004160118_inventory_master_data_foundation.sql`, `20261012181744_manager_inventory_request_documents.sql`, `20261018204755_remove_inventory_request_reason.sql`.
- The old UI subtracted JavaScript `Number` values, allowing `0.06000000000000005` and `0.039999999999999925` into suggested gaps and prefilled draft values. Draft review, issued details, Copy/Download Text, PNG, and PDF then rendered raw numbers. The browser could show a shorter editable value than the number actually held by the draft.
- Menu Management previously opened the first menu product automatically and offered **all** products. The Manager menu read supplies category name and active state; the dedicated drink read supplies drink product IDs. The Foodhouse menu seed classifies its configured meal products under `Viands`. `get_manager_fixed_meal_options()` returns all products, without an eligibility flag. The current `set_manager_fixed_meal_option` checks active Manager authorization, price precision/order, drink-choice conflicts for enabling Without Rice, active inventory, and approved rice quantity/recipe consistency, but has **no general Viands/meal eligibility check**. These are source-contract findings, not a live attempted invalid save.

## Changes in this assignment

| File | Change |
| --- | --- |
| `src/modules/manager/inventory/requestQuantity.ts` | Calculate suggestions in integer minor units at each item's scale; format valid quantities without binary tails or trailing zeros; leave unexpected or invalid precision visible. |
| `src/modules/manager/inventory/ManagerRequestsPage.tsx` | Use the corrected suggestion for new drafts and matching unsaved suggestions; format gap explanations, review, historical requested/fulfillment quantities, and text/PNG output. Keep submitted `line.quantity` and stored snapshots numeric and unmodified. |
| `src/modules/manager/inventory/requestDocument.ts` | Use the same display formatter in browser print/Save as PDF. |
| `src/modules/manager/menu/mealEligibility.ts` | Offer active Viands products and exclude any product with drink choices. This is a conservative UI filter based on existing reads, not a server approval flag. |
| `src/modules/manager/menu/MenuManagementPage.tsx` | Open the selector at `Select an eligible meal`, render an empty state, and gate form/save to the filtered list. Existing pricing, rice mapping/quantity, authorization call, and Drink Choices flow remain in place. |
| `scripts/verify-manager-focused-refinements.mjs` | Focused synthetic math, display, selector, serialization-shape, and actual PDF HTML assertions. |

Before → after examples: Soy Sauce `0.06000000000000005 L` → `0.06 L`; Vinegar `0.039999999999999925 L` → `0.04 L`, including the prefilled numeric draft. A manually entered `0.0399` on a three-place item remains visible and fails existing precision validation. Small legitimate `0.003 kg` remains `0.003 kg`; integer-scale examples remain whole numbers. Historical snapshots are formatted for display only. Buko Juice/Softdrinks and unrelated menu categories disappear from the Meal Options selector; a Viands product such as Chicken Biryani can be selected for configuration without being silently enabled for rice choices.

## Verification

| Check | Result |
| --- | --- |
| `node --experimental-strip-types scripts/verify-manager-focused-refinements.mjs` | **PASS**: two artifact cases, fractional/integer examples, invalid precision visibility, JSON number shape, eligibility/empty list, selector wiring, and generated PDF HTML. An initial test-harness attempt using the local `typescript` runtime API failed because that package exposes no transpile API; the harness was corrected to Node's type stripper and reran successfully. |
| `node scripts/verify-h23-request-workflow.mjs` | **PASS**, 40 offline request-workflow checks. |
| `npm.cmd run typecheck` | **PASS**. |
| `npm.cmd run verify:quality` | **PASS**, 11 existing checks. |
| `npm.cmd run build` | **PASS**, Vite production bundle. |
| Existing synthetic Manager browser fixture | **BLOCKED** before render: its pre-existing mock omits `setManagerRiderApprovalStatus` and `getManagerRiderApplication` required by unrelated Rider components. No desktop/mobile render or browser export/issue claim is made. The fixture was restored to its original content after the attempt. |
| Authenticated hosted Manager operation, actual issue/revision/Receiving, invalid meal save | **NOT TESTED**; no hosted writes were authorized. |

The corrected suggestion is serialized as the same JavaScript number placed in the draft and sent unchanged as `p_lines`; server numeric validation and authoritative gap calculation remain intact. This is source and synthetic evidence, **not** an executed issued-request persistence or hosted stock invariant. Existing backend/RLS/RPC and Customer, Cashier, Kitchen, and Drink Choices code were not changed.

## Worktree and limit

The repository was already extensively modified. In particular, `ManagerRequestsPage.tsx` and `requestDocument.ts` were pre-existing untracked work; this assignment edited them in place without resetting or staging anything. `MenuManagementPage.tsx` already contained uncommitted Meal Options, Drink Choices, and Manager session work; the diff against `HEAD` includes that earlier work. Only the six source/test files listed above and this report belong to this assignment. The existing synthetic fixture and unrelated modifications were preserved.

The remaining approval question is a product/backend eligibility contract: the current category and drink-choice reads cannot distinguish every Viands product that the restaurant approves for With Rice / Without Rice, and the Manager writer can still accept an unrelated product if called outside this UI. A separately authorized decision and backend change would be required for a definitive authoritative eligibility PASS. The rendered and disposable issuance checks below supersede the earlier verification gap; no hosted transaction is implied.

## Final Verification and Acceptance Closure

### Starting state and procedure

The worktree still had extensive unrelated dirty work. The prior request page/document files and this report were untracked; the Menu page was already modified. No existing file was reset, stashed, or staged. The previous browser harness could not render because its broad entry imports Rider components whose test mock lacks `setManagerRiderApprovalStatus` and `getManagerRiderApplication`. Those Rider dependencies were avoided with a new Manager-only fixture entry; Rider code and the pre-existing broad fixture were not changed. A test-only Supabase proxy throws if accessed, and the Chrome harness asserts every browser request is local and read-only.

Verification ran against (1) actual Manager React components with synthetic API data at **390×844, 768×1024, and 1280×900**, (2) existing focused scripts and build, and (3) a newly created PostgreSQL 17.11 container with no published port, network, or mounted volume. The database fixture installed the **exact** `inventory_request_manager_required`, `get_inventory_request_proposal`, `issue_inventory_request` (current five-argument signature), and `get_inventory_request_register` function bodies from the repository migrations. It reconstructed only their required tables and used an aggregate-only usable-stock helper for synthetic non-batch items. This was a **targeted disposable contract fixture, not a faithful hosted-schema replay**. All new issues ran inside rollback transactions. No hosted inspection or authenticated hosted execution was performed in this final pass.

Commands executed: `npx.cmd vite --config scripts/fixtures/manager-focused.config.ts` while running `node scripts/verify-manager-focused-browser.mjs`; `docker run -d --name codex-manager-focused-qa-20261023 --network none -e POSTGRES_PASSWORD=local_test_only public.ecr.aws/supabase/postgres:17.11.0.004` followed by `node --experimental-strip-types scripts/verify-manager-focused-db.mjs`; `node --experimental-strip-types scripts/verify-manager-focused-refinements.mjs`; `node scripts/verify-h23-request-workflow.mjs`; `node scripts/verify-fixed-meal-cart.mjs`; `npm.cmd run typecheck`; `npm.cmd run verify:quality`; and `npm.cmd run build`. The assignment-owned browser server was stopped and the assignment-owned container removed after the checks; unrelated containers and volumes were untouched.

### Results by evidence level

| Check and evidence level | Result | Observed result / limit |
| --- | --- | --- |
| Synthetic UI rendering — Requests desktop/mobile/tablet | **PASS** | Prefilled Soy Sauce `0.06 L`, Vinegar `0.04 L`, and integer Food packs `3 packs`; gap explanations and Review Request had no binary tails. `0.0399 L` was rejected with the existing three-decimal message; `0.04 L` proceeded to review. No document-level horizontal overflow at the three widths. |
| Synthetic UI rendering — historical request and exports | **PASS** | Historical detail displayed `0.04 L`; Download Text contained `Soy Sauce — 0.04 L`; PNG download completed from the same document text. The prior focused verifier also executed `requestPrintHtml` and asserted `0.04` in generated PDF/print HTML. A physical print dialog and saved PDF image were **NOT TESTED**. The rendered historical row was a mock, not a database read. |
| Disposable database-backed execution — prepare → issue → read back | **PASS** | The actual proposal RPC returned synthetic numeric values. The shared TypeScript suggestion helper produced `0.06 L`, `0.04 L`, and `3 packs`; those were serialized as JSON numbers and passed as `p_lines` to the actual Manager issue RPC under an authenticated role/JWT context. Stored line quantities, `issue_input`, immutable revision snapshot, and register JSON matched. Same-ID retry retained the reference with one issue event. A synthetic historical snapshot retained its original number and `2 bottles`, and stock quantities were unchanged. All new issues rolled back. |
| Disposable database-backed execution — denial | **PASS** | The actual issue RPC rejected unsupported `0.0399 L`; a Cashier profile was denied. Neither attempt left a new request. The fixture's minimal schema and helper limit this to the scoped Request contract. |
| Synthetic UI rendering — Meal Options | **PASS** | Selector initially had the exact placeholder and no selection; only active synthetic Viands appeared. Buko Juice, Softdrinks, White Rice, and an inactive viand were absent. Selecting Chicken Biryani showed standard `209.00` with no rice option enabled; attempting Without Rice without a mapping produced the existing approval message. Selecting another configured viand loaded its own `145.00`/`120.00` prices and existing `0.2 kg` fixture recipe. Clearing the selector removed the save form. The empty-list state displayed a clear message. The fixture's recipe amount is synthetic and is **not** an approved Chicken Biryani amount. |
| Synthetic UI rendering — Drink Choices | **PASS** | Flavor and size rows displayed existing `15`, `0`, and `10` adjustments and active states. Price and active controls responded locally; a three-decimal adjustment was rejected by existing save validation. No save RPC or hosted drink change was made, so server-side save behavior is **NOT TESTED** in this pass. |
| Static code review — authority | **PASS within scoped frontend behavior** | Active Manager session gating, meal price/rice validation, and the dedicated Drink Choices path remain in place. No production source, RPC, grant, RLS, or migration was changed in this final pass. Existing SQL lacks a universal approved-meal predicate. |
| Automated focused tests | **PASS** | `verify-manager-focused-refinements.mjs`; `verify-h23-request-workflow.mjs` (40 checks); `verify-fixed-meal-cart.mjs`; new focused browser and database scripts. |
| TypeScript / quality / production build | **PASS / PASS / PASS** | `npm.cmd run typecheck`; `npm.cmd run verify:quality` (11 checks); `npm.cmd run build`. |
| Hosted read-only inspection / authenticated hosted execution | **NOT TESTED / NOT TESTED** | No hosted call or hosted business record write was required or performed. |

Screenshots and browser summary are in `qa/manager-focused-rendered-20261023/` (`menu-selected-390.png`, `requests-edit-390.png`, `requests-390.png`, matching tablet/desktop shots, and `result.json`). The downloaded synthetic TXT/PNG files are in its `downloads/` subdirectory. Screenshots show a local test fixture, not hosted authentication or data.

### Test-only files and final decision

This verification added `scripts/fixtures/manager-focused.html`, `manager-focused.tsx`, `manager-focused.config.ts`, `manager-focused-mocks.ts`, `manager-focused-supabase.ts`, `scripts/verify-manager-focused-browser.mjs`, `scripts/verify-manager-focused-db.mjs`, and `supabase/tests/manager_request_precision_disposable_setup.sql`, plus the evidence folder and this report update. They isolate the already implemented Manager screens from unrelated Rider fixture imports and exercise the actual Request SQL bodies. The prior production implementation files were inspected, not edited in this final pass.

**Inventory Quantity Precision: PASS** for the scoped local UI and targeted database contract. **Meal Options Frontend Eligibility: PASS** for its implemented predicate and interactions. **Authoritative Meal Eligibility: PENDING OWNER POLICY — OUT OF SCOPE.** The owner has not defined a universal eligible-meal rule, and the backend does not expose or enforce one. This policy limit is not a failed frontend test. **Final milestone disposition: FRONTEND ACCEPTED — POLICY PENDING.** No migration, deployment, hosted data change, inventory movement, or actual meal/drink configuration occurred.
