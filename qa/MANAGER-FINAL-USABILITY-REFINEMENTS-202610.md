# Final Manager usability refinements — 23 October 2026

## Scope and starting state

The working tree was already heavily modified. `OrdersPage.tsx` was modified, while `ManagerRequestsPage.tsx`, `ReplenishmentPage.tsx`, `requestWorkflow.ts`, and the focused Manager browser fixture were untracked before this task. All prior work was retained. No reset, migration, deployment, hosted write, or business-record change was performed.

The active Manager Inventory Requests view is `ManagerRequestsPage.tsx`; it embeds `ReplenishmentPage.tsx` for legacy single-item requests. The active Orders view is `OrdersPage.tsx`. The H-23 request workflow QA and Manager Phase 1 order RPC were reviewed before editing.

## Confirmed findings and corrections

| Area | Before | After / contract preserved |
| --- | --- | --- |
| Formal Requests | Register displayed status, Manila needed time and outstanding line count, but did not call out a passed needed time. Detail showed posted Receiving count and linked documents lower on the page. | `Past needed date` is derived only for `issued` or `partially_received` requests with remaining quantity and a needed timestamp before the current instant. It does not change status or fulfillment. The register gives the existing Receiving next step; detail calls out the passed date beside status, while retaining linked draft/posted Receiving and per-item quantities. Time comparison uses the stored timestamp instant; display uses Asia/Manila. A 30-second UI timer refreshes the cue. |
| Order Details | Stored item lines and authoritative `grand_total` were shown without an explanation for the observed gap. `get_manager_orders` returns line snapshots and total but does not project `subtotal`, `discount_amount`, `tax_amount`, or `delivery_fee`. | When an authorized Manager opens an order, a read-only `orders` selection requests those stored financial fields by order ID. Existing `staff_select_orders` RLS and authenticated table grant in the repository permit active Manager reads. The panel displays stored subtotal, nonzero discount/tax/fee, and the original Manager RPC total. It does not infer a fee from a difference or use current menu prices. If the read fails or its total conflicts with the RPC result, the panel says the breakdown is unavailable and keeps the recorded RPC total. |
| Legacy Requests | Expanded section repeated “Historical” headings and showed Phase 7B terminology; empty queue occupied a full card. | Collapsed summary is `Legacy Requests`; the short description identifies older single-item requests. Expanded Manager view says `Single-item requests` and uses a compact `No legacy requests.` state. Existing row statuses, detail history, refresh, and `Start/Open Receiving` actions remain in place. Production-mode wording and actions remain unchanged. |

## Files changed for this task

- `src/modules/manager/inventory/requestWorkflow.ts`
- `src/modules/manager/inventory/ManagerRequestsPage.tsx`
- `src/modules/manager/inventory/ReplenishmentPage.tsx`
- `src/modules/manager/api/managerApi.ts`
- `src/modules/manager/orders/OrdersPage.tsx`
- `scripts/verify-manager-usability.mjs`
- `scripts/verify-manager-usability-browser.mjs`
- `scripts/fixtures/manager-focused.config.ts`
- `scripts/fixtures/manager-focused.tsx`
- `scripts/fixtures/manager-focused-mocks.ts`
- `qa/manager-usability-rendered-20261023/` (synthetic browser screenshots and result JSON)
- This report.

## Focused verification

| Check | Result | Evidence |
| --- | --- | --- |
| Request timing and workflow | PASS | `node --experimental-strip-types scripts/verify-manager-usability.mjs`: 10 assertions for future/exact/past Manila midnight, partial, fulfilled, closed, invalid timestamp, draft, two posted Receivings, and unchanged remaining quantity. |
| Existing request workflow contract | PASS | `node --experimental-strip-types scripts/verify-h23-request-workflow.mjs`: 40 checks. |
| Rendered Manager fixture | PASS | `node scripts/verify-manager-usability-browser.mjs`: 6 rendered cases at 390px and 1280px, plus unavailable-financial-detail fallback. Register has two overdue cues (issued and partial), none for future or fulfilled; partial detail shows two posted Receiving documents. Legacy section is collapsed by default, empty state is compact, and a pending legacy row still offers Start Receiving. Delivery order shows stored ₱120 subtotal, ₱50 fee and ₱170 total; dine-in and zero-fee delivery show ₱120 total without a fee line. Browser recorded no exceptions, external requests, or writes. Screenshots and machine result are in `qa/manager-usability-rendered-20261023/`. |
| TypeScript | PASS | `npm.cmd run typecheck`. |
| Production build | PASS | `npm.cmd run build`. |

The browser fixture supplies synthetic Manager API objects, including synthetic stored financial snapshots. It verifies rendering and UI behavior, not live Supabase RLS or direct table selection. The source SQL shows the required `orders` columns, active staff SELECT policy, and authenticated grant; an authenticated hosted Manager read was **not exercised**. No real order, payment, stock, Receiving action, or historical record was changed. The legacy Receiving action was rendered but not clicked. No live data, pricing recalculation, or historical receipt was used as test data.

## Disposition

**Locally accepted for the three scoped UI refinements.** The remaining runtime acceptance check is an authorized Manager opening a real order read-only and confirming that the stored breakdown is returned under current hosted RLS. Until then, the UI safely retains the recorded total and states when the breakdown is unavailable. There is no backend change required by this implementation, and no migration or deployment was performed.
