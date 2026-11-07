# Cashier UI refinement — 2026-11-01

## Scope and result

The active Cashier routes are `/cashier`, `/cashier/pending-payments`, `/cashier/walkin-pos`, `/cashier/orders-receipts/orders`, `/cashier/orders-receipts/receipts`, and `/cashier/shift-settlement`. Legacy `/cashier/order-list` and `/cashier/transactions` redirect into the combined Orders & Receipts workspace.

The pass shortened repeated labels and explanatory copy, compacted dashboard and payment empty states, clarified payment comparison and decision actions, made receipt and settlement summaries easier to scan, and made the POS service selector visible at phone width. The receipt preview for RCP-000061 was opened read-only and showed ORD-000078, ₱45.00 total, ₱50.00 tendered, and ₱5.00 change.

No migration, database/RPC/auth/RLS change, financial calculation, or other role module was edited. No sale, payment decision, shift mutation, or print action was submitted during verification.

## Source files edited in this pass

- `src/modules/cashier/components/Button.tsx`
- `src/modules/cashier/components/PageHeader.tsx`
- `src/modules/cashier/dashboard/CashierDashboardPage.tsx`
- `src/modules/cashier/dashboard/CashierWorkQueue.tsx`
- `src/modules/cashier/dashboard/CompactShiftHeader.tsx`
- `src/modules/cashier/dashboard/PrimaryCashierActions.tsx`
- `src/modules/cashier/OrdersReceiptsPage.tsx`
- `src/modules/cashier/orders/CashierOrderListPage.tsx`
- `src/modules/cashier/payments/PaymentDetails.tsx`
- `src/modules/cashier/payments/PaymentQueue.tsx`
- `src/modules/cashier/payments/PendingPaymentsPage.tsx`
- `src/modules/cashier/payments/ProofViewer.tsx`
- `src/modules/cashier/payments/RejectPaymentDialog.tsx`
- `src/modules/cashier/pos/OrderTypeGate.tsx`
- `src/modules/cashier/pos/POSOrderHeader.tsx`
- `src/modules/cashier/pos/PaymentPanel.tsx`
- `src/modules/cashier/pos/ReceiptDialog.tsx`
- `src/modules/cashier/pos/ReceiptPanel.tsx`
- `src/modules/cashier/pos/TransactionBar.tsx`
- `src/modules/cashier/shifts/ClosedShiftHistory.tsx`
- `src/modules/cashier/shifts/ShiftMetrics.tsx`
- `src/modules/cashier/shifts/ShiftSettlementPage.tsx`
- `src/modules/cashier/transactions/TransactionHistoryPage.tsx`
- `src/modules/cashier/transactions/TransactionSummary.tsx`
- `src/styles/theme.css` (Cashier/POS selectors only)

## Browser evidence

`qa/cashier-ui-refinement-20261101/` holds desktop (1440 × 900) and phone (390 × 844) screenshots for the dashboard, payment queue, orders, receipt history, POS order-type gate, POS menu, and settlement. It also holds the read-only receipt preview at both widths. All six active workspace views were rendered at phone width with `document.documentElement.scrollWidth === clientWidth` (390 px). The POS service control was initially clipped; after the CSS fix its right edge was 383 px inside the 390 px viewport.

The first payment and history captures were taken during loading and replaced with settled-state captures. There is no reliable before screenshot from the exact dirty-worktree baseline. The pre-edit authenticated Chrome window was minimized, and the isolated browser had not yet completed sign-in.

## Checks and limits

- `npm run typecheck` — pass.
- `npm run build` — pass.
- `npm run verify:quality` — pass (11 checks).
- `node scripts/verify-cashier-workspace.mjs` — pass.
- `node scripts/verify-cashier-order-list.mjs` — pass.
- `node scripts/verify-cashier-transaction-history.mjs` — pass.
- `node qa/cashier-opt-02-pos-regression.mjs` — pass.
- `git diff --check` on edited source files — pass.
- `node qa/cashier-ss-02c-interaction-regression.mjs` — fails on a source-pattern assertion in the unchanged `EndShiftDialog.tsx`; it does not test these UI edits to completion.

Pending Payments was empty in the authenticated browser. Proof inspection, verify/reject confirmation, active-shift settlement, actual POS payment, print output, and fresh before/after browser comparisons remain unverified in this pass.
