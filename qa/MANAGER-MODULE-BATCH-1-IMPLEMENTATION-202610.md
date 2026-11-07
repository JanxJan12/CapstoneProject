# Manager Module — Batch 1 Implementation (2026-10-23)

**Status: COMPLETE for local implementation and synthetic verification.** No hosted writes, migration, or business-record changes were made.

## A. Executive summary

The Dashboard previously showed only the physical low-stock count from `get_manager_dashboard()`. It now has a separate **Low usable stock** attention card driven by the existing Manager stock-summary RPC. The original physical count and financial cards still use their original Dashboard result.

## B. Existing stock contract

Read-only hosted catalog inspection for project `zhzluhqvysvsadwuugpa` on 2026-10-23 confirmed `public.get_manager_inventory_stock_summary()` has no arguments and returns `physical_quantity numeric`, `usable_quantity numeric`, `reorder_level numeric`, `is_active boolean`, item identity and unit, plus expiry/batch fields. Physical quantity is `inventory_items.quantity_on_hand`; usable quantity comes from `public.inventory_usable_quantity(item.id)`. The function is `STABLE SECURITY DEFINER`, has an empty fixed search path, and checks `auth.uid()` against an active Manager profile. `anon` has no EXECUTE; `authenticated` has EXECUTE subject to the body guard. No recipe detail is in the returned columns. A hosted role-specific RPC call was **NOT TESTED**.

The existing Stock Overview `stockAlerts()` classifies active items with zero usable quantity as `usable-out`, and active items with positive usable quantity at or below `reorderLevel` as `low-usable`. The Dashboard counts one item if either applies. Zero threshold follows this existing rule: zero usable is out, positive usable is not low. Missing threshold or quantity is invalid, not interpreted as zero. The existing API decoder also requires nonnegative finite numeric fields.

## C. Implementation and D. calculation

- `src/modules/manager/dashboard/ManagerDashboard.tsx`: starts an independent stock-summary read for the active Manager session, shows the separate card, and refreshes it alongside the existing Dashboard read. Stock failures do not block the original Dashboard values. It guards unmounted/session-switched responses and suppresses simultaneous stock requests.
- `src/modules/manager/dashboard/usableStockAttention.ts`: validates the needed fields and counts unique rows with the existing Stock Overview alert classification. It does not derive usable quantity from physical or expired balances.
- `scripts/fixtures/visual-manager.config.ts` and `visual-manager-mocks.ts`: route the new Dashboard read to local synthetic data and add deterministic loading/error/empty/healthy/malformed modes.
- `scripts/verify-manager-batch-1.mjs` and `qa/manager-batch-1-browser-20261023/run.mjs`: focused calculation and rendered-browser checks.

The key synthetic case has physical **12 kg**, usable **3 kg**, and minimum **8 kg**. The Dashboard shows a usable warning even though physical stock is above the minimum. These are fixture values, not hosted restaurant balances.

## E. UI/UX

The new amber **Low usable stock** card is distinct from the red physical **Low stock** card. It shows a placeholder while unknown, loading text during the read, a safe unavailable message and Retry button on failure, and a stale label after a failed refresh with a prior valid count. A genuinely empty returned array says “No inventory items were returned”; a populated response with zero warnings says no active items are at or below the minimum. The existing **Open Stock Monitor** navigation is available on the new card. No new route or inventory mutation was introduced.

## F. Authorization

Direct hosted catalog/function-source checks confirmed the signature, grants, and active-Manager body guard described above. Synthetic browser denial rendered the safe unavailable state and did not expose the fixture error text. Authenticated hosted Manager, Customer, and Cashier RPC execution was **NOT TESTED**; the grant/body inspection alone does not prove their runtime behavior.

## G. Test evidence

| Command or check | Result |
|---|---|
| `node --experimental-strip-types scripts/verify-manager-batch-1.mjs` | **PASS**: 11 classification cases and 6 malformed/incomplete-response rejections, including decimals, zero, at-threshold, mixed units/status, empty, and physical-sufficient/usable-low. |
| `node qa/manager-batch-1-browser-20261023/run.mjs` against isolated local Vite fixture | **PASS**: five responsive renders; loading, success, zero-warning, empty, RPC failure, unauthorized failure, retry, stale refresh, duplicate-request suppression, and Stock Monitor navigation. No hosted request. |
| `npm.cmd run typecheck` | **PASS**. |
| `npm.cmd run verify:quality` | **PASS**, 11 checks. |
| `npm.cmd run build` | **PASS**, 3,036 modules transformed. |
| `node --experimental-strip-types scripts/verify-h22-inventory-overview.mjs` | **PASS**, 21 offline assertions. |
| `node scripts/verify-manager-inventory-workspace.mjs` | **PASS**, 36/36 assertions; its short-lived Vite dependency scan emitted a server-closing warning, but the verifier exited 0. |
| `git diff --check --` scoped changed tracked source/fixture files | **PASS**; Git emitted only a line-ending warning for the existing dirty Dashboard file. |

Early browser-run failures were fixture assertion errors (case-sensitive label regex, button selector, and exact stale-copy match). The assertion code was corrected; the final run passed. No application defect was found by those interim failures.

## H. Browser evidence

Final synthetic Dashboard captures: [360×800](manager-batch-1-browser-20261023/dashboard-360x800-full.png), [390×844](manager-batch-1-browser-20261023/dashboard-390x844-full.png), [768×1024](manager-batch-1-browser-20261023/dashboard-768x1024.png), [1024×768](manager-batch-1-browser-20261023/dashboard-1024x768.png), and [1440×900](manager-batch-1-browser-20261023/dashboard-1440x900.png). [Machine-readable metrics](manager-batch-1-browser-20261023/result.json) record usable count **2 items**, physical card and financial card present, and no attention-card overlap at each width. The mobile full-page capture visibly shows the new card and both existing KPI cards. Retry is a native button and was activated by click; keyboard activation was **NOT TESTED** because the headless CDP key dispatch did not reach the focused control.

At 1024 and 1440, document width remains viewport +70 px and horizontal scroll reach remains **80 px**, exactly matching the prior [pre-change synthetic baseline](manager-audit-browser-20261023/result.json). At 360, 390, and 768 there is no document overflow. Batch 1 added no measured overflow. The existing desktop shell overflow belongs to Batch 2.

## I. Regression protection and J. data safety

The existing physical `dashboard.lowStockCount`, sales, orders, pending payments, daily sales, and report queries were not changed. The fixture renders still show physical low stock **4 items**, verified fulfilled sales **₱12,480.00**, and orders today **32** from the pre-existing synthetic Dashboard response. No production workflow module, inventory quantity, Receiving row, order, payment, stock movement, threshold, or hosted business record was changed. All browser scenarios used a local fixture with dummy Supabase configuration.

## K. Remaining limitations and L. final status

**COMPLETE** for the authorized local Batch 1 scope. The browser and calculation tests use synthetic rows; no current authenticated hosted Manager page or Manager/Customer/Cashier RPC execution was exercised. Actual stock-warning counts on live hosted records were deliberately not queried or asserted. Keyboard Retry activation was not proven. Existing 80 px desktop overflow remains for Batch 2.

**Next step:** Manager Batch 2 — correct the measured 80 px desktop document overflow, under its own authorization.
