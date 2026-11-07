# Graph Report - cashier  (2026-11-04)

## Corpus Check
- 139 files · ~58,873 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 754 nodes · 2702 edges · 17 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9748bdef`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- components/index.ts
- constants/index.ts
- formatMoney
- orderOperations.ts
- ref_react
- cashier/types.ts
- onlinePaymentApi.ts
- useTransactionHistory.ts
- Order
- cashierSaleHydrationApi.ts
- supabaseOrderService.ts
- shiftService.ts
- useCashierActions.ts
- CashierStore.tsx
- ShiftSummaryHero.tsx
- CashierProvider
- walkInSaleApi.ts

## God Nodes (most connected - your core abstractions)
1. `formatMoney()` - 73 edges
2. `Order` - 49 edges
3. `CashierButton` - 45 edges
4. `useCashierStore()` - 35 edges
5. `useCashierActions()` - 27 edges
6. `useWalkInPOSController()` - 27 edges
7. `formatDateTime()` - 25 edges
8. `OrderDetailsDrawer()` - 23 edges
9. `EmptyState()` - 22 edges
10. `Payment` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Cashier reusable components` --references--> `MetricCard()`  [INFERRED]
  src/modules/cashier/components/README.md → src/modules/cashier/components/Cards.tsx
- `Cashier reusable components` --references--> `SummaryCard()`  [INFERRED]
  src/modules/cashier/components/README.md → src/modules/cashier/components/Cards.tsx
- `Cashier reusable components` --references--> `ConfirmationDialog()`  [INFERRED]
  src/modules/cashier/components/README.md → src/modules/cashier/components/ConfirmationDialog.tsx
- `Cashier reusable components` --references--> `Drawer()`  [INFERRED]
  src/modules/cashier/components/README.md → src/modules/cashier/components/Drawer.tsx
- `Cashier reusable components` --references--> `EmptyState()`  [INFERRED]
  src/modules/cashier/components/README.md → src/modules/cashier/components/EmptyState.tsx

## Import Cycles
- None detected.

## Communities (17 total, 0 thin omitted)

### Community 0 - "components/index.ts"
Cohesion: 0.07
Nodes (63): CashierButton, EmptyState(), CashierInput, CashierSelect, CashierTextarea, fieldClass, FieldError(), Label() (+55 more)

### Community 1 - "constants/index.ts"
Cohesion: 0.06
Nodes (70): drinkChoiceGroupsFor(), CASH_TENDER_ROUNDING_STEPS, CASHIER_CURRENCY, CASHIER_LOCALE, DATA_REFRESH_FEEDBACK_MS, DINING_TABLES, KITCHEN_STATUSES, MAX_POS_ITEM_QUANTITY (+62 more)

### Community 2 - "formatMoney"
Cohesion: 0.06
Nodes (52): cashierHydrationView(), MetricCard(), ConfirmationDialog(), ErrorBanner(), ErrorBannerProps, ACTIVE_ORDER_STATUSES, formatCompactMoney(), formatMoney() (+44 more)

### Community 3 - "orderOperations.ts"
Cohesion: 0.07
Nodes (49): formatElapsed(), minutesSince(), ORDER_REFRESH_INTERVAL_MS, PAGE_SIZE, SEARCH_FOCUS_DELAY_MS, LiveOrderQueue(), QueueFact(), isToday() (+41 more)

### Community 4 - "ref_react"
Cohesion: 0.05
Nodes (30): ButtonSize, ButtonVariant, CashierButtonProps, CashierIconButton, CashierIconButtonProps, SIZE_STYLES, VARIANT_STYLES, ActionCard() (+22 more)

### Community 5 - "cashier/types.ts"
Cohesion: 0.07
Nodes (47): CashierStatus, STATUS_PRESENTATION, StatusBadgeProps, StatusPresentation, CASHIER_STAGE_DELAY_THRESHOLDS, formatElapsedMinutes(), CashierWorkQueue(), compactDuration() (+39 more)

### Community 6 - "onlinePaymentApi.ts"
Cohesion: 0.07
Nodes (41): CustomerGcashRejectionResult, DatabaseRejectionResult, isAllowedReason(), mapRejectionResult(), optionalString(), rejectCustomerGcashPayment(), requireRecord(), requireString() (+33 more)

### Community 7 - "useTransactionHistory.ts"
Cohesion: 0.09
Nodes (32): PageHeader(), Toast, EDITABLE_ELEMENTS, useSearchShortcut(), CashierOrderListPage(), findAccessibleOrder(), selectAuthorizedReceipt(), OrdersReceiptsView (+24 more)

### Community 8 - "Order"
Cohesion: 0.12
Nodes (27): Drawer(), ReceiptContent(), ReceiptDialog(), ReceiptPanel(), cents(), optionalPositive(), prepareReceipt(), ReceiptPreparation (+19 more)

### Community 9 - "cashierSaleHydrationApi.ts"
Cohesion: 0.09
Nodes (35): attachRecordedDeliveryFees(), DatabaseCashierSale, DatabaseHistoryEntry, DatabaseOrder, DatabaseOrderItem, DatabasePayment, DatabaseTransaction, fetchCashierSale() (+27 more)

### Community 10 - "supabaseOrderService.ts"
Cohesion: 0.09
Nodes (36): applyCashierAssignmentStatuses(), ASSIGNMENT_STATUSES, AssignmentRow, fetchCashierAssignmentStatuses(), labelFor(), applyCashierOrderPaymentSummaries(), CASHIER_PAYMENT_BATCH_SIZE, CashierOrderPaymentSummary (+28 more)

### Community 11 - "shiftService.ts"
Cohesion: 0.22
Nodes (16): MAX_ACTIVITY_RECORDS, markNotificationRead(), markNotificationsRead(), holdOrder(), removeHeldOrder(), addActivity(), cloneState(), nextEventId() (+8 more)

### Community 12 - "useCashierActions.ts"
Cohesion: 0.19
Nodes (17): fetchCashierOnlinePayments(), closeCashierShift(), DatabaseCloseShiftRow, DatabaseOpenShiftRow, fetchOpenCashierShift(), mapOpenCashierShiftRow(), OpenCashierShiftResult, startCashierShift() (+9 more)

### Community 13 - "CashierStore.tsx"
Cohesion: 0.21
Nodes (16): HydratedCashierSale, CloseCashierShiftResult, CashierStore, EMPTY_SHIFT_TOTALS, mergeAuthoritativePayments(), mergeDatabaseRefresh(), mergePaymentMetadata(), CashierActions (+8 more)

### Community 14 - "ShiftSummaryHero.tsx"
Cohesion: 0.28
Nodes (11): DASHBOARD_CLOCK_REFRESH_MS, formatDateOnly(), formatTimeOnly(), HeroDatum(), ShiftSummaryHero(), ShiftMetrics(), manilaDateTime(), ShiftOverview() (+3 more)

### Community 15 - "CashierProvider"
Cohesion: 0.23
Nodes (11): CASHIER_STATE_VERSION, CASHIER_STORAGE_KEY, CASHIER_TERMINAL, DEFAULT_DELAY_THRESHOLD_MINUTES, loadCashierPreferences(), loadCashierState(), saveCashierState(), CashierProvider() (+3 more)

### Community 16 - "walkInSaleApi.ts"
Cohesion: 0.43
Nodes (7): createWalkInSale(), DatabaseWalkInSaleRow, mapFulfillmentType(), mapPaymentMethod(), parseOptionalNumber(), parseRequiredNumber(), WalkInSaleResult

## Knowledge Gaps
- **5 isolated node(s):** `IDLE`, `ORDERING`, `ORDER_REVIEW`, `PAYMENT`, `RECEIPT`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 150 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `formatMoney()` connect `formatMoney` to `components/index.ts`, `constants/index.ts`, `orderOperations.ts`, `cashier/types.ts`, `Order`, `cashierSaleHydrationApi.ts`, `shiftService.ts`, `ShiftSummaryHero.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `IDLE`, `ORDERING`, `ORDER_REVIEW` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `components/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0661128418137764 - nodes in this community are weakly interconnected._
- **Why does `Order` connect `Order` to `components/index.ts`, `constants/index.ts`, `orderOperations.ts`, `cashier/types.ts`, `useTransactionHistory.ts`, `cashierSaleHydrationApi.ts`, `supabaseOrderService.ts`, `CashierStore.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `constants/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05789009697325889 - nodes in this community are weakly interconnected._
- **Why does `CashierButton` connect `components/index.ts` to `formatMoney`, `ref_react`, `cashier/types.ts`, `useTransactionHistory.ts`, `Order`, `ShiftSummaryHero.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `formatMoney` be split into smaller, more focused modules?**
  _Cohesion score 0.059720869847452125 - nodes in this community are weakly interconnected._