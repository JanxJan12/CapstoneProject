# Customer Module Batch 1 implementation — 22 October 2026

## A. Executive summary and status

**COMPLETE for the authorized local implementation and deterministic checks.** The active Customer module now maps untrusted Supabase errors to bounded, actionable text and resolves an open product detail against the latest successfully loaded catalog. It blocks Add to Cart when a product disappears, becomes unavailable, or its displayed price/meal choice no longer matches current data. Actual rendered/browser acceptance remains **NOT TESTED** because the computer-use runtime had no browser surface. This is not a full Customer Module production acceptance claim.

## B. Files changed

- `src/modules/customer/index.tsx`: active error displays, inline OAuth error, detail/catalog reconciliation, choice refresh, cart notice, stale response guards. This file was already modified in the pre-existing worktree; its earlier work was preserved.
- `src/modules/customer/customerBatch1.ts`: new Customer-local safe-message and product/choice reconciliation helpers.
- `scripts/verify-customer-batch-1.mjs`: new deterministic helper and source-guard checks.
- This report only. No shared, operational-module, migration, or hosted file was edited for Batch 1.

## C. Error handling and recovery

Before: menu, tracking, history, and profile handlers could render raw `error.message`; Google OAuth used `window.alert` with the provider message; an availability failure could show an internal menu-item ID. After: `customerErrorMessage(unknown, context)` returns fixed Customer text for network interruption, expired session, unauthorized access, validation, product unavailability, and unknown failures. Order/payment fallbacks express **uncertainty**, never a definite failed or successful transaction. Existing trusted checkout feedback, same-request ID retry, disabled in-flight submission, and server-confirmed totals remain intact. Menu still offers read-only Try Again; detail now offers Retry menu; profile/history/tracking retain their existing retry UI. OAuth failure appears as an inline alert and clears before another sign-in attempt. Cart and form state are not cleared by these error paths.

The helper does not return any raw SQL, RPC name, object name, stack, or token text. Existing developer diagnostics remain in `console.error`; no analytics call was added. `fetchCustomerTrackingPayment` no longer throws a raw RPC message into the tracking view. Unknown promise rejection from menu loading is caught and shown as a safe menu error rather than an unhandled failed load.

## D. Live product and cart reconciliation

`currentCustomerProduct` resolves the opened product by stable ID from the current `databaseMenuItems` on every render. A removed record retains only its old identity/name for explanation and is forced unavailable; the stale record cannot be added. The Add handler also checks `databaseMenuItemsRef.current` immediately before cart mutation, covering a response arriving just before the next render. It rejects a mismatched price, unavailable item, invalidated rice choice, or an addition exceeding the existing 99-item total rather than silently adding a smaller quantity.

The detail displays a notice after a real base/fixed-meal price change, recalculates the displayed unit and quantity total, and preserves the selected quantity. Fixed-meal selection is not silently switched: if a formerly configured choice disappears, Add is blocked and the Customer is guided back to the menu. Drink choices reload after a successful menu/availability refresh, retain valid selected IDs, discard removed IDs, update selected option prices, and block Add while refresh is pending or required choices are incomplete. Removal of a previously present drink group blocks Add until the item is reopened. A failed choice refresh blocks Add while retaining prior selection state.

The cart merge now compares the fixed-meal price and rice availability fields as well as base price/identity. A refreshed option reconciliation uses the existing `reconcileCustomerCart` and flags any changed line unit price; the cart shows a dismissible review notice. Invalid option lines continue to block checkout. Full-menu requests use a revision check; an older availability response cannot overwrite a newer menu result. Failed refreshes retain the last known catalog and show a safe error; they do not fabricate prices or stock. Backend price, choice, stock, ownership, and transaction checks remain authoritative.

## E. Tests performed and results

| Command / check | Final result | Evidence tier and limit |
|---|---|---|
| `node scripts/verify-customer-batch-1.mjs` | **PASS** | Deterministic utility tests: network/unknown/auth/authorization/validation/unavailable/uncertain messages; no backend text leak; current/removed/changed product; meal/drink selection retention; price/total calculation; stale revision rejection. Source guard assertions cover existing read-only retry, request ID, duplicate-submit guard, and detail quantity state. These are not rendered interaction tests. |
| `node scripts/verify-customer-drink-cart.mjs` | **PASS** | Existing Customer cart: ordinary food, retired-choice rejection, required drink, authoritative drink refresh, fixed meal. |
| `node scripts/verify-fixed-meal-cart.mjs` | **PASS** | Existing POS compatibility fixture: distinct rice choices/merge. Not Customer browser proof. |
| `node scripts/verify-drink-choice-cart.mjs` | **PASS** | Existing POS compatibility fixture: drink variants/authoritative preview. |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit`, exit 0. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11-check quality baseline, exit 0. |
| `npm.cmd run build` | **PASS** | Vite build, 3,030 modules, exit 0. |
| `git diff --check -- src/modules/customer/index.tsx` | **PASS** | Exit 0; Git emitted only its LF/CRLF working-copy warning. |

An intermediate Batch 1 test run **failed** because its “no `setQty`” source assertion also matched the intended quantity-button handler; the assertion was narrowed to quantity state retention and reran PASS. An intermediate typecheck **failed** because the new Add guard did not narrow `fresh` for TypeScript; the explicit presence check fixed it and final typecheck passed. These were Batch 1 development failures, not pre-existing repository failures. No final command above failed.

## F. Browser verification

**NOT TESTED.** `cua.getState()` returned `apps: []` and `browsers: []`; no browser/headless surface was available through the computer-use interface. No 360×800, 390×844, 768×1024, or 1440×900 rendering, focus, overflow, or screenshot evidence was produced. This report does not label source-level checks as visual acceptance. An authenticated checkout/payment interaction was not attempted against hosted Supabase.

## G. Remaining Batch 1 verification risk

The deterministic checks exercise helpers and source guards, but do not drive React effects, a real OAuth callback, Supabase network failures in a browser, or concurrent user clicks. A controlled local browser fixture should verify actual menu retry, open-detail refresh, drink-choice invalidation, cart notice, mobile layout, keyboard focus, and the original checkout idempotency flow before production acceptance. If a network error occurs after an order/payment submission, the existing request/order recovery path needs authenticated fixture verification; no real transaction should be created solely for QA.

## H. Scope compliance

No hosted SQL, business records, price, stock, availability, payment, order, or account was changed. Manager, Cashier, Kitchen, Inventory, and Rider code was untouched. No legacy modifier table/RPC was restored. Pre-existing uncommitted work remains in place. Rollback of this batch is limited to the three Batch 1 source/test additions/edits listed above, while preserving earlier Customer changes in `index.tsx`.

## I. Next step

After browser access is restored, perform the focused rendered acceptance above. The next planned implementation workstream is tracking stale/reconnect feedback and safe view URL state (roadmap Batch 2); it requires separate user prioritization and was not started here.
