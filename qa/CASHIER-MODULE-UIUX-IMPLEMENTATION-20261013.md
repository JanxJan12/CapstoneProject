# Cashier UI/UX implementation — 2026-10-13

## Scope and changes

Active `/cashier` pages inspected: dashboard, pending GCash payments, walk-in POS, order list, transactions, and shift settlement. Existing dirty edits were preserved. This pass replaced the POS's code/category-based modifier guesses with the existing `get_customer_menu_modifiers()` catalog projection, applied its required and maximum selection rules in the drawer, and used catalog prices/IDs for selections. It also made payment queue Refresh trigger a real store reload instead of a timed success message, displayed selected modifier snapshots in payment order details, and enlarged key modifier controls to 44 px. Server-side `create_walk_in_sale` remains the pricing and order authority; GCash verification/rejection and private proof access were not changed.

## Evidence

| Result | Check |
| --- | --- |
| PASS | `npm.cmd run typecheck` |
| PASS | `npm.cmd run build` |
| PASS | `npm.cmd run verify:quality` (11 checks) |
| PASS | `node qa/cashier-modifier-contract-20261013.mjs` (8 focused catalog/selection checks) |
| PASS | `node qa/cashier-local-catalog-probe-20261013.mjs` (73 rows from the isolated loopback RPC) |
| PASS | `node qa/cashier-browser-20261013/run-local.mjs` (7 authenticated isolated browser checks: route, three dashboard viewports with no document overflow, POS gate, server catalog and modifier drawer). |
| PASS | `node qa/remaining-modified-order-integration-20261013.mjs`: authenticated isolated Cashier shift start, existing pending GCash proof verification and order confirmation, release to Rider, same-database payment/transaction reconciliation; modified walk-in cash sale, idempotent replay, rejected duplicate modifier, and KDS handoff. Evidence: `qa/remaining-modified-order-integration-20261013.json`. |
| NOT TESTED | Cashier GCash rejection branch, browser-driven sale or verification, receipt printing, and shift close/reconciliation in this pass. Earlier checkpoint evidence is separate. |
| NOT TESTED | Hosted catalog RPC availability, hosted GCash settlement, device and screen reader. |

## Remaining Cashier gate

The modifier projection exists in the preserved isolated database via the local Customer modifier migration. Its hosted availability is not established. The Cashier menu now fails closed with an error if that projection is unavailable, so hosted rollout remains blocked until the migration chain and hosted parity are resolved. The historical pristine replay failure at `20260904000000_inventory_phase_2a_recipe_deduction.sql` remains unchanged. No hosted changes were made.

Screenshots: `qa/cashier-browser-20261013/mobile-dashboard.png`, `tablet-dashboard.png`, `desktop-dashboard.png`, `desktop-pos-gate.png`, `desktop-pos-menu.png`, and `desktop-pos-modifiers.png`. These show isolated authenticated local data and do not establish hosted behavior.
