# Graph Report - manager  (2026-11-04)

## Corpus Check
- 60 files · ~63,704 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 578 nodes · 1706 edges · 11 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9748bdef`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- managerPhase2Api.ts
- managerApi.ts
- ManagerRequestsPage.tsx
- StockReceivingPage.tsx
- InventoryPage.tsx
- AdjustmentPage.tsx
- index.tsx
- inventoryApi.ts
- InventoryReconciliationPanel.tsx
- c_users_janmari_downloads_capstone_project_src_components_common_button_button
- inventoryReconciliation.ts

## God Nodes (most connected - your core abstractions)
1. `StockReceivingPage()` - 33 edges
2. `ManagerRequestsPage()` - 30 edges
3. `ManagerApp()` - 20 edges
4. `formatInventoryQuantity()` - 20 edges
5. `InventoryPage()` - 15 edges
6. `AdjustmentPage()` - 14 edges
7. `WasteSpoilagePage()` - 14 edges
8. `getInventoryRequestRegister()` - 14 edges
9. `OrdersPage()` - 14 edges
10. `mapManagerOrder()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `useManagerNotifications()` --calls--> `getManagerDashboard()`  [EXTRACTED]
  src/modules/manager/notifications/useManagerNotifications.ts → src/modules/manager/api/managerApi.ts
- `ReportsPage()` --calls--> `getManagerSalesReport()`  [EXTRACTED]
  src/modules/manager/reports/ReportsPage.tsx → src/modules/manager/api/managerApi.ts
- `useManagerNotifications()` --calls--> `getManagerRiders()`  [EXTRACTED]
  src/modules/manager/notifications/useManagerNotifications.ts → src/modules/manager/api/managerPhase2Api.ts
- `ManagerDashboard()` --calls--> `countLowUsableStock()`  [EXTRACTED]
  src/modules/manager/dashboard/ManagerDashboard.tsx → src/modules/manager/dashboard/usableStockAttention.ts
- `ManagerDashboard()` --calls--> `getManagerStockSummary()`  [EXTRACTED]
  src/modules/manager/dashboard/ManagerDashboard.tsx → src/modules/manager/inventory/inventoryApi.ts

## Import Cycles
- None detected.

## Communities (11 total, 0 thin omitted)

### Community 0 - "managerPhase2Api.ts"
Cohesion: 0.05
Nodes (62): getManagerDrinkChoices(), ManagerDrinkChoice, parseChoice(), setManagerDrinkChoice(), createRiderDocumentSignedUrl(), getManagerCustomers(), getManagerMenuItems(), getManagerRiderApplication() (+54 more)

### Community 1 - "managerApi.ts"
Cohesion: 0.06
Nodes (67): FULFILLMENT_TYPES, getManagerDashboard(), getManagerOrderFinancials(), getManagerOrders(), getManagerSalesReport(), ManagerDailySale, ManagerDashboardData, ManagerFulfillmentType (+59 more)

### Community 2 - "ManagerRequestsPage.tsx"
Cohesion: 0.08
Nodes (60): AwaitingProductionDelivery, manila, statusLabel, inspectorLabel(), isInspectorAuditId(), closeInventoryRequestShort(), getInventoryRequestRegister(), getRequestProposal() (+52 more)

### Community 3 - "StockReceivingPage.tsx"
Cohesion: 0.08
Nodes (66): ReceivingAccordion(), clearReceivingDraftRequestId(), createEmergencyProductionReceiving(), deleteEmptyReceivingDraft(), getFriendlyReceivingError(), getOrCreateReceivingDraftRequestId(), getReceivingDocuments(), getReceivingPolicyEvidence() (+58 more)

### Community 4 - "InventoryPage.tsx"
Cohesion: 0.07
Nodes (47): countLowUsableStock(), BatchAvailability, batchAvailability(), batchDecision(), getManagerStockMovements(), getManagerStockSummary(), InventoryTransactionType, ManagerInventoryStock (+39 more)

### Community 5 - "AdjustmentPage.tsx"
Cohesion: 0.12
Nodes (32): AdjustmentPage(), BATCH_REASONS, getErrorMessage(), REASONS, clearInventoryMutationRequestId(), getInventoryMutationStorageKey(), getManagerInventory(), getOrCreateInventoryMutationRequestId() (+24 more)

### Community 6 - "index.tsx"
Cohesion: 0.07
Nodes (35): ManagerSalesReport, AdjustmentPage, ClosedShiftHistory, CustomersPage, InventoryAuditPage, InventoryItemDetail, InventoryPage, InvTransactionsPage (+27 more)

### Community 7 - "inventoryApi.ts"
Cohesion: 0.17
Nodes (37): adjustInventoryBatchStock(), adjustInventoryStock(), AdjustInventoryStockInput, BatchInventoryMutationInput, getManagerInventoryBatchContext(), getManagerInventoryTransactions(), getManagerStockDetail(), InventoryMutationKind (+29 more)

### Community 8 - "InventoryReconciliationPanel.tsx"
Cohesion: 0.13
Nodes (28): codes, getInventoryAuditItems(), getInventoryAudits(), InventoryAuditFinding, InventoryAuditFindingCode, InventoryAuditResult, InventoryAuditRun, mapFinding() (+20 more)

### Community 9 - "c_users_janmari_downloads_capstone_project_src_components_common_button_button"
Cohesion: 0.11
Nodes (20): ManagerOrder, getPaidOrderCancellation(), InventoryDisposition, PaidOrderCancellation, parseSettlement(), RefundMethod, SettlementInput, settlePaidOrderCancellation() (+12 more)

### Community 10 - "inventoryReconciliation.ts"
Cohesion: 0.27
Nodes (10): ManagerInventoryTransaction, fromScaledQuantity(), INVENTORY_RECONCILIATION_TRANSACTION_LIMIT, InventoryReconciliationReport, InventoryReconciliationRow, InventoryReconciliationStatus, isTransactionSequenceConsistent(), reconcileInventoryBalances() (+2 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getManagerStockSummary()` connect `InventoryPage.tsx` to `managerApi.ts`, `StockReceivingPage.tsx`, `index.tsx`, `inventoryApi.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `StockReceivingPage()` (e.g. with `createEmptyHeader()` and `loadPendingPost()`) actually correct?**
  _`StockReceivingPage()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `managerPhase2Api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054858934169279 - nodes in this community are weakly interconnected._
- **Why does `getInventoryRequestRegister()` connect `ManagerRequestsPage.tsx` to `StockReceivingPage.tsx`, `InventoryPage.tsx`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `managerApi.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05824561403508772 - nodes in this community are weakly interconnected._
- **Why does `formatInventoryQuantity()` connect `AdjustmentPage.tsx` to `InventoryPage.tsx`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `ManagerRequestsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07525150905432595 - nodes in this community are weakly interconnected._