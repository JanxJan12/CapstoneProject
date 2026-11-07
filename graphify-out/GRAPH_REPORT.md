# Graph Report - src  (2026-11-04)

## Corpus Check
- 342 files · ~188,411 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .css 7)

## Summary
- 2114 nodes · 6625 edges · 90 communities (85 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output recorded; semantic agent usage was unavailable, so actual token cost is unknown.

- Graph health: 14 dangling endpoint edges; 1 self-loop; 53 undirected same-endpoint edge collapses. The graph remains usable, but these relationships may be incomplete.
- Manager Inventory Inspector
- Cashier Dialog Components
- Shared Input Components
- Shared UI Primitives
- Cashier Orders Shell
- Manager Inventory Alerts
- Rider Service Flow
- Cashier Status Dashboard
- Inventory Batch Decisions
- Production Delivery Inventory
- Customer Catalog Types
- Sidebar and Sheet UI
- Cashier Sales Services
- Cashier Transaction Views
- Manager Inventory API
- Kitchen Queue Services
- Cashier POS Drafts
- Manager Fulfillment API
- Shared Revenue Types
- Cashier Menu API
- Customer Checkout Recovery
- Cashier Payment Resolution
- Inventory Audit API
- Rider Authentication Screens
- Customer Tracking Payments
- Cashier Transaction Controls
- Cashier Dashboard Components
- Cashier Shift UI
- Cashier Sale Hydration
- Manager Menu and Riders
- Cashier Dashboard Metrics
- Manager Dashboard Notifications
- Rider Screen Badges
- Rider Application Auth
- Customer Order Status
- Manager Route Registry
- Auth Provider and Guards
- Manager Rider Tables
- Auth and Cart Cards
- POS Drink Choices
- Cashier Receipts
- Inventory Date Utilities
- Manager Drink Choices
- Authentication and Profile
- Alerts and Toggles
- Cashier POS Service
- Application Routes
- Menu Bar UI
- Context Menu UI
- Cashier Dashboard Dialogs
- Cashier Constants
- POS Choice Drawer
- Carousel UI
- Form Controls
- Role Constants and Types
- Manager Order Financials
- Cashier Component Registry
- Closed Shift History
- Cashier Order Navigation
- Paid Order Cancellation
- Reports Layout
- Cashier Order Detail
- Drawer UI
- Select UI
- GCash Payment Rejection
- Online Payment API
- POS Order Items
- Common Button Styles
- Chart UI
- Navigation Menu UI
- Inventory Reconciliation
- POS Category Sidebar
- GCash Payment Verification
- Manager Sales Reports
- Walk In Sale API
- POS Order Header
- Customer Design Notes
- Cashier Data Table
- Page Navigation
- Skeleton Loading UI
- Customer Recorded Charges
- Empty State Components
- Hover Card UI
- Customer Menu Browse
- Restaurant Brand Photo
- Scroll Area UI
- Food House Logo
- Customer Category Metadata

## God Nodes (most connected - your core abstractions)
1. `cn()` - 253 edges
2. `formatMoney()` - 75 edges
3. `CashierButton` - 52 edges
4. `Order` - 49 edges
5. `Button()` - 47 edges
6. `StockReceivingPage()` - 44 edges
7. `useAuth()` - 42 edges
8. `supabase` - 41 edges
9. `ManagerRequestsPage()` - 39 edges
10. `useCashierStore()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `SettingsPage()` --calls--> `Button()`  [EXTRACTED]
  modules/manager/settings/SettingsPage.tsx → components/common/Button.tsx
- `SummaryCard()` --calls--> `cn()`  [EXTRACTED]
  modules/cashier/components/Cards.tsx → components/ui/utils.ts
- `Props` --references--> `AccountRole`  [EXTRACTED]
  modules/auth/pages/RiderLoginPage.tsx → data/accountRole.ts
- `RequireAuthProps` --references--> `AccountRole`  [EXTRACTED]
  app/RequireAuth.tsx → data/accountRole.ts
- `ProfileRow` --references--> `AccountRole`  [EXTRACTED]
  app/providers/AuthProvider.tsx → data/accountRole.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared drawer surface** — src_modules_cashier_pos_readme_choicedrawer, src_modules_cashier_pos_readme_paymentpanel, src_modules_cashier_pos_readme_receiptpanel [EXTRACTED 1.00]

## Communities (90 total, 5 thin omitted)

### Community 0 - "Manager Inventory Inspector"
Cohesion: 0.06
Nodes (76): inspectorLabel(), isInspectorAuditId(), ReceivingAccordion(), clearReceivingDraftRequestId(), createEmergencyProductionReceiving(), deleteEmptyReceivingDraft(), getFriendlyReceivingError(), getOrCreateReceivingDraftRequestId() (+68 more)

### Community 1 - "Cashier Dialog Components"
Cohesion: 0.11
Nodes (45): CommandDialog(), Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogTitle(), DrawerProps (+37 more)

### Community 2 - "Shared Input Components"
Cohesion: 0.04
Nodes (30): buttonVariants, Calendar(), Checkbox(), Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps (+22 more)

### Community 3 - "Shared UI Primitives"
Cohesion: 0.06
Nodes (42): AccordionContent(), AccordionItem(), AccordionTrigger(), Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem() (+34 more)

### Community 4 - "Cashier Orders Shell"
Cohesion: 0.08
Nodes (46): AppShell(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+38 more)

### Community 5 - "Manager Inventory Alerts"
Cohesion: 0.12
Nodes (44): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent, AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay (+36 more)

### Community 6 - "Rider Service Flow"
Cohesion: 0.08
Nodes (52): BottomNav(), BottomTab, DeliveryDetailScreen(), DeliveryRequestsTab(), HistoryTab(), HomeTab(), NavAssistScreen(), PendingOfferAcceptance (+44 more)

### Community 7 - "Cashier Status Dashboard"
Cohesion: 0.07
Nodes (47): CashierStatus, STATUS_PRESENTATION, StatusBadgeProps, StatusPresentation, CASHIER_STAGE_DELAY_THRESHOLDS, formatElapsedMinutes(), compactDuration(), FILTER_LABELS (+39 more)

### Community 8 - "Inventory Batch Decisions"
Cohesion: 0.09
Nodes (43): BatchAvailability, batchAvailability(), batchDecision(), getManagerStockMovements(), InventoryTransactionType, ManagerInventoryStock, ManagerStockBatch, ManagerStockDetail (+35 more)

### Community 9 - "Production Delivery Inventory"
Cohesion: 0.10
Nodes (46): AwaitingProductionDelivery, manila, statusLabel, closeInventoryRequestShort(), getInventoryRequestRegister(), issueInventoryRequest(), recordInventoryRequestEvent(), RequestDraftLine (+38 more)

### Community 10 - "Customer Catalog Types"
Cohesion: 0.12
Nodes (41): canAddCurrentCustomerProduct(), currentCustomerProduct(), customerProductPricesChanged(), retainCustomerDrinkSelections(), CartCheckoutButton(), CartPage(), customerDrinkChoiceNames(), customerLineKey() (+33 more)

### Community 11 - "Sidebar and Sheet UI"
Cohesion: 0.06
Nodes (41): Input(), Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+33 more)

### Community 12 - "Cashier Sales Services"
Cohesion: 0.10
Nodes (41): HydratedCashierSale, fetchCashierOnlinePayments(), closeCashierShift(), CloseCashierShiftResult, DatabaseCloseShiftRow, DatabaseOpenShiftRow, fetchOpenCashierShift(), mapOpenCashierShiftRow() (+33 more)

### Community 13 - "Cashier Transaction Views"
Cohesion: 0.10
Nodes (29): formatDateTime(), findAccessibleOrder(), basketSubtotalDisagrees(), recordedBasketChoices(), recordedBasketLine(), TransactionCards(), FinancialLine(), Overview() (+21 more)

### Community 14 - "Manager Inventory API"
Cohesion: 0.17
Nodes (37): adjustInventoryBatchStock(), adjustInventoryStock(), AdjustInventoryStockInput, BatchInventoryMutationInput, getManagerInventoryBatchContext(), getManagerInventoryTransactions(), getManagerStockDetail(), InventoryMutationKind (+29 more)

### Community 15 - "Kitchen Queue Services"
Cohesion: 0.11
Nodes (28): KitchenApp(), KitchenTerminalActivation(), KitchenTerminalLoading(), NAV_GROUPS, COLUMNS, formatFulfillmentType(), formatKitchenStatus(), KitchenQueue() (+20 more)

### Community 16 - "Cashier POS Drafts"
Cohesion: 0.14
Nodes (33): POS_DRAFT_STORAGE_KEY, POS_RECENT_SEARCH_LIMIT, POS_RECENT_SEARCHES_STORAGE_KEY, addCartItem(), calculatePOSTotals(), CartUpdateResult, CashTenderSuggestion, duplicateCartLine() (+25 more)

### Community 17 - "Manager Fulfillment API"
Cohesion: 0.14
Nodes (34): FULFILLMENT_TYPES, ManagerFulfillmentType, ManagerOrderChannel, ManagerOrderFinancials, ManagerOrderItem, ManagerOrderStatusCount, ManagerPaymentMethod, ManagerRecentOrder (+26 more)

### Community 18 - "Shared Revenue Types"
Cohesion: 0.09
Nodes (27): RevenueChartProps, allOrders, customers, inventoryItems, invTransactions, kitchenOrders, orderStatusData, pendingPayments (+19 more)

### Community 19 - "Cashier Menu API"
Cohesion: 0.12
Nodes (28): DatabaseMenuCategoryRow, DatabaseMenuEffectiveAvailabilityRow, DatabaseMenuItemRow, fetchCashierMenuItems(), FixedMealOptionRow, groupDrinkChoices(), loadCashierDrinkChoices(), ModifierRow (+20 more)

### Community 20 - "Customer Checkout Recovery"
Cohesion: 0.13
Nodes (27): CheckoutCustomerProfile, CheckoutPage(), loadCheckoutCustomer(), CustomerQuotedBreakdown(), parsePlacedCustomerOrder(), PendingCustomerPaymentSubmission, PlacedCustomerOrder, clearCustomerDeliveryRetry() (+19 more)

### Community 21 - "Cashier Payment Resolution"
Cohesion: 0.10
Nodes (29): applyCashierOrderPaymentSummaries(), CASHIER_PAYMENT_BATCH_SIZE, CashierOrderPaymentSummary, loadCashierOrderPaymentSummaries(), parseCashierOrderPaymentSummaries(), assertNever(), CancelOrderResult, DatabaseFulfillmentType (+21 more)

### Community 22 - "Inventory Audit API"
Cohesion: 0.13
Nodes (28): codes, getInventoryAuditItems(), getInventoryAudits(), InventoryAuditFinding, InventoryAuditFindingCode, InventoryAuditResult, InventoryAuditRun, mapFinding() (+20 more)

### Community 23 - "Rider Authentication Screens"
Cohesion: 0.14
Nodes (21): ImageWithFallback(), DemoPasswordLogin(), AuthApp(), AuthScreen, SCREEN_TABS, CustomerLoginPage(), Props, ErrorBanner() (+13 more)

### Community 24 - "Customer Tracking Payments"
Cohesion: 0.13
Nodes (20): gcashMerchantConfig, customerTimelineSteps(), customerTimelineStepState(), NON_DELIVERY_ORDER_STEPS, ORDER_STEPS, normalizeCustomerGcashReference(), getPaymentProofExtension(), SubmittedCustomerPayment (+12 more)

### Community 25 - "Cashier Transaction Controls"
Cohesion: 0.15
Nodes (23): CashierButton, CashierSelect, PageHeader(), SearchToolbar(), EDITABLE_ELEMENTS, useSearchShortcut(), CashierOrderListPage(), FilterChip() (+15 more)

### Community 26 - "Cashier Dashboard Components"
Cohesion: 0.15
Nodes (21): EmptyState(), PageHeaderProps, SectionHeader(), SectionHeaderProps, DASHBOARD_CLOCK_REFRESH_MS, formatDateOnly(), formatElapsed(), formatTimeOnly() (+13 more)

### Community 27 - "Cashier Shift UI"
Cohesion: 0.15
Nodes (19): ErrorBanner(), ErrorBannerProps, CompactShiftHeader(), EndShiftDialog(), inspectShiftClosureOutcome(), ShiftSummaryItem(), VarianceIndicator(), ShiftMetrics() (+11 more)

### Community 28 - "Cashier Sale Hydration"
Cohesion: 0.13
Nodes (25): attachRecordedDeliveryFees(), DatabaseCashierSale, DatabaseHistoryEntry, DatabaseOrder, DatabaseOrderItem, DatabasePayment, DatabaseTransaction, fetchCashierSale() (+17 more)

### Community 29 - "Manager Menu and Riders"
Cohesion: 0.22
Nodes (26): createRiderDocumentSignedUrl(), getManagerMenuItems(), getManagerRiderApplication(), ManagerRiderApplication, ManagerRiderApprovalResult, ManagerRiderAvailabilityStatus, mapCustomer(), mapMenuItem() (+18 more)

### Community 30 - "Cashier Dashboard Metrics"
Cohesion: 0.16
Nodes (18): ActionCard(), MetricCard(), ACTIVE_ORDER_STATUSES, formatMoney(), CashierMetrics(), CashierWorkbench(), PendingPaymentBanner(), RestaurantControlLanes() (+10 more)

### Community 31 - "Manager Dashboard Notifications"
Cohesion: 0.14
Nodes (22): getManagerDashboard(), ManagerDailySale, ManagerDashboardData, managerOrderNeedsAttention(), ManagerOrderStatusBadge(), AttentionCard(), currencyFormatter, formatCurrency() (+14 more)

### Community 32 - "Rider Screen Badges"
Cohesion: 0.13
Nodes (17): Badge(), StatusBadge(), ManagerOrderStatus, ManagerPaymentStatus, MANAGER_ORDER_STATUS_PRESENTATION, ManagerPaymentStatusBadge(), PAYMENT_STATUS_PRESENTATION, DeliveryDetail() (+9 more)

### Community 33 - "Rider Application Auth"
Cohesion: 0.13
Nodes (20): ErrorBanner(), FileUploadField(), FileUploadFieldProps, Props, RiderApplicationPage(), TextField(), TextFieldProps, getStatusContent() (+12 more)

### Community 34 - "Customer Order Status"
Cohesion: 0.14
Nodes (19): CustomerStatusBadge(), formatCustomerOrderStatus(), getCustomerOrderStatusPresentation(), NEUTRAL_PRESENTATION, ORDER_STATUS_LABELS, CurrentProduct, CustomerErrorContext, customerErrorMessage() (+11 more)

### Community 35 - "Manager Route Registry"
Cohesion: 0.16
Nodes (22): AdjustmentPage, ClosedShiftHistory, CustomersPage, InventoryAuditPage, InventoryItemDetail, InventoryPage, InvTransactionsPage, MANAGER_NAV_GROUPS (+14 more)

### Community 36 - "Auth Provider and Guards"
Cohesion: 0.18
Nodes (17): AuthContext, AuthContextValue, AuthProvider(), DATABASE_ROLES, getDisplayName(), isDatabaseRole(), ProfileRow, useAuth() (+9 more)

### Community 37 - "Manager Rider Tables"
Cohesion: 0.17
Nodes (18): Table(), Td(), prototypePurchaseOrders, getManagerCustomers(), getManagerRiders(), ManagerCustomer, ManagerRider, ManagerRiderApprovalStatus (+10 more)

### Community 38 - "Auth and Cart Cards"
Cohesion: 0.11
Nodes (8): CartItem, CartPage(), CustNav(), CartItem, CheckoutPrototypePage(), CustNav(), CustNav(), OrderTrackingPage()

### Community 39 - "POS Drink Choices"
Cohesion: 0.16
Nodes (15): drinkChoiceGroupsFor(), MAX_POS_ITEM_QUANTITY, MENU_GRID_OVERSCAN_ROWS, MENU_GRID_ROW_HEIGHT_PX, ChoiceDrawerProps, MealRecommendations(), MenuGridProps, MealRecommendations (+7 more)

### Community 40 - "Cashier Receipts"
Cohesion: 0.24
Nodes (15): OrderTableRowProps, ReceiptContent(), ReceiptPanel(), cents(), optionalPositive(), prepareReceipt(), ReceiptPreparation, ReceiptPresentation (+7 more)

### Community 41 - "Inventory Date Utilities"
Cohesion: 0.23
Nodes (16): Button(), manilaToday(), InventoryRequest, ReceivingDocumentFilters, ReceivingReportSummary, receivingDocumentLabels(), ReceivingDocumentList(), requestWorkflow() (+8 more)

### Community 42 - "Manager Drink Choices"
Cohesion: 0.23
Nodes (16): getManagerDrinkChoices(), ManagerDrinkChoice, parseChoice(), setManagerDrinkChoice(), ManagerMenuItem, getManagerFixedMealOptions(), getManagerMealIngredients(), getManagerMealInventoryCandidates() (+8 more)

### Community 43 - "Authentication and Profile"
Cohesion: 0.15
Nodes (13): AuthenticatingPage, supabase, AuthenticatingPage(), AuthenticationStep, isStaffRole(), STAFF_ROLES, StaffProfile, StaffRole (+5 more)

### Community 44 - "Alerts and Toggles"
Cohesion: 0.14
Nodes (11): Alert(), AlertDescription(), AlertTitle(), alertVariants, Badge(), badgeVariants, ToggleGroup(), ToggleGroupContext (+3 more)

### Community 45 - "Cashier POS Service"
Cohesion: 0.11
Nodes (19): cashierService, ChoiceDrawer, MenuGrid, OrderTypeGate, PaymentPanel, POSCart, posOperations, POSOrderHeader (+11 more)

### Community 46 - "Application Routes"
Cohesion: 0.15
Nodes (11): App(), AuthApp, CashierApp, CustomerApp, KitchenApp, ManagerApp, RiderApp, RouteBoundary() (+3 more)

### Community 47 - "Menu Bar UI"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 48 - "Context Menu UI"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 49 - "Cashier Dashboard Dialogs"
Cohesion: 0.32
Nodes (10): DialogOverlay(), DialogPortal(), Toast, CashierDashboardPage(), CashierDashboardSkeleton(), CashierWorkQueue(), OrderLookupDialog(), RecentReceiptsDialog() (+2 more)

### Community 50 - "Cashier Constants"
Cohesion: 0.12
Nodes (15): CASH_TENDER_ROUNDING_STEPS, CASHIER_CURRENCY, CASHIER_LOCALE, CASHIER_STORAGE_KEY, DATA_REFRESH_FEEDBACK_MS, DINING_TABLES, KITCHEN_STATUSES, OPTIMISTIC_DELAY_MS (+7 more)

### Community 51 - "POS Choice Drawer"
Cohesion: 0.18
Nodes (14): ChoiceDrawer(), ORDER_TYPES, OrderTypeGate(), POSOrderSidebar(), STATE_LABELS, TransactionBar(), POSTransactionState, IDLE (+6 more)

### Community 52 - "Carousel UI"
Cohesion: 0.17
Nodes (14): Button(), Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 53 - "Form Controls"
Cohesion: 0.20
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 54 - "Role Constants and Types"
Cohesion: 0.14
Nodes (12): CASHIER_GROUPS, KITCHEN_GROUPS, MENU_CATEGORIES, ORDER_STEP_MAP, ORDER_TIMELINE, PAGE_LIST, PROTOTYPE_MANAGER_GROUPS, STATUS_MAP (+4 more)

### Community 55 - "Manager Order Financials"
Cohesion: 0.22
Nodes (14): getManagerOrderFinancials(), getManagerOrders(), currencyFormatter, DELIVERY_STEP_MAP, formatCurrency(), formatOrderClock(), formatOrderDate(), formatOrderTime() (+6 more)

### Community 56 - "Cashier Component Registry"
Cohesion: 0.13
Nodes (14): ActionCard, components barrel, ConfirmationDialog, DataTable, Drawer, EmptyState, LoadingSkeleton, MetricCard (+6 more)

### Community 57 - "Closed Shift History"
Cohesion: 0.24
Nodes (12): amount(), ClosedShiftSnapshot, fetchClosedShiftHistory(), HistoryCursor, HistoryQuery, manilaDayStart(), mapRow(), timestamp() (+4 more)

### Community 58 - "Cashier Order Navigation"
Cohesion: 0.35
Nodes (9): cashierHydrationView(), CashierApp(), CashierModule(), cashierPathFor(), OrdersReceiptsView, resolveCashierPath(), OrdersReceiptsPage(), CashierNavigationIntent (+1 more)

### Community 59 - "Paid Order Cancellation"
Cohesion: 0.26
Nodes (11): ManagerOrder, getPaidOrderCancellation(), InventoryDisposition, PaidOrderCancellation, parseSettlement(), RefundMethod, SettlementInput, settlePaidOrderCancellation() (+3 more)

### Community 60 - "Reports Layout"
Cohesion: 0.35
Nodes (6): DesktopFrame(), FrameRow(), MobileFrame(), PageHeader(), ReportsBlueprintPage(), reportTypes

### Community 61 - "Cashier Order Detail"
Cohesion: 0.33
Nodes (9): DialogClose(), Drawer(), OrderDetailInfo(), OrderDetailsDrawer(), Label(), OrderExpandedContent(), getRecordedDeliveryFee(), matchesOrderListView() (+1 more)

### Community 62 - "Drawer UI"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 63 - "Select UI"
Cohesion: 0.20
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 64 - "GCash Payment Rejection"
Cohesion: 0.32
Nodes (11): CustomerGcashRejectionResult, DatabaseRejectionResult, isAllowedReason(), mapRejectionResult(), optionalString(), rejectCustomerGcashPayment(), requireRecord(), requireString() (+3 more)

### Community 65 - "Online Payment API"
Cohesion: 0.35
Nodes (11): DatabaseOnlinePaymentRow, HydratedOnlinePayment, mapOnlinePayment(), mapPaymentStatus(), optionalString(), optionalTimestamp(), optionalUuid(), requireRecord() (+3 more)

### Community 66 - "POS Order Items"
Cohesion: 0.44
Nodes (7): OrderItem, OrderItemProps, OrderReviewDrawer(), POSCart(), POSCartProps, POSCartLine, WalkInOrderType

### Community 67 - "Common Button Styles"
Cohesion: 0.27
Nodes (6): ButtonSize, ButtonVariant, InputField(), StatCard(), ForgotPasswordMobilePage(), ForgotPasswordPage()

### Community 68 - "Chart UI"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 69 - "Navigation Menu UI"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 70 - "Inventory Reconciliation"
Cohesion: 0.27
Nodes (10): ManagerInventoryTransaction, fromScaledQuantity(), INVENTORY_RECONCILIATION_TRANSACTION_LIMIT, InventoryReconciliationReport, InventoryReconciliationRow, InventoryReconciliationStatus, isTransactionSequenceConsistent(), reconcileInventoryBalances() (+2 more)

### Community 71 - "POS Category Sidebar"
Cohesion: 0.31
Nodes (8): MENU_CATEGORIES, CATEGORY_ICONS, CategoryButton(), CategorySidebar, CategorySidebarProps, MenuGrid(), filterMenuItems(), VirtualizedProductGrid

### Community 72 - "GCash Payment Verification"
Cohesion: 0.42
Nodes (8): CustomerGcashVerificationResult, DatabaseVerificationResult, mapVerificationResult(), requireRecord(), requireString(), requireTimestamp(), requireUuid(), verifyCustomerGcashPayment()

### Community 73 - "Manager Sales Reports"
Cohesion: 0.33
Nodes (8): getManagerSalesReport(), ManagerSalesReport, currencyFormatter, formatCurrency(), getDefaultDateRange(), getErrorMessage(), ReportRange, ReportsPage()

### Community 74 - "Walk In Sale API"
Cohesion: 0.43
Nodes (7): createWalkInSale(), DatabaseWalkInSaleRow, mapFulfillmentType(), mapPaymentMethod(), parseOptionalNumber(), parseRequiredNumber(), WalkInSaleResult

### Community 75 - "POS Order Header"
Cohesion: 0.43
Nodes (6): POPULAR_MENU_SEARCHES, Action(), POSOrderHeader(), SearchBar, SearchBarProps, SearchGroup()

### Community 76 - "Customer Design Notes"
Cohesion: 0.25
Nodes (7): Accessible controls and motion, Active customer screens, Authenticated transaction verification, Customer ordering design, Customer visual system, Ordering flow, Preserved transaction contract

### Community 77 - "Cashier Data Table"
Cohesion: 0.33
Nodes (5): DataTable(), DataTableColumn, DataTableProps, FragmentRow(), EmptyStateProps

### Community 78 - "Page Navigation"
Cohesion: 0.47
Nodes (3): PageNav(), SectionDivider(), PageId

### Community 79 - "Skeleton Loading UI"
Cohesion: 0.47
Nodes (4): SidebarMenuSkeleton(), Skeleton(), LoadingSkeleton(), LoadingSkeletonProps

### Community 80 - "Customer Recorded Charges"
Cohesion: 0.53
Nodes (4): CustomerRecordedAmounts, customerRecordedBreakdown(), CUSTOMER_CURRENCY_FORMATTER, CustomerRecordedCharges()

### Community 81 - "Empty State Components"
Cohesion: 0.53
Nodes (4): ConfirmDialog(), EmptyTable(), SystemStates(), Toast()

### Community 84 - "Customer Menu Browse"
Cohesion: 0.50
Nodes (4): menuItems, CartItem, CustNav(), MenuBrowsePage()

### Community 85 - "Restaurant Brand Photo"
Cohesion: 0.40
Nodes (5): Restaurant exterior at night, Nighttime restaurant setting, Illuminated restaurant counter and menu boards, Outdoor dining area with wooden tables and chairs, Overhead string lights

### Community 88 - "Food House Logo"
Cohesion: 0.67
Nodes (3): Established 2021, RRJ's Food-House, RRJ's Food-House logo

## Knowledge Gaps
- **44 isolated node(s):** `IDLE`, `ORDERING`, `ORDER_REVIEW`, `PAYMENT`, `RECEIPT` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 471 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Shared UI Primitives` to `Cashier Dialog Components`, `Shared Input Components`, `Cashier Orders Shell`, `Manager Inventory Alerts`, `Cashier Status Dashboard`, `Sidebar and Sheet UI`, `Cashier Transaction Controls`, `Cashier Dashboard Components`, `Cashier Dashboard Metrics`, `Alerts and Toggles`, `Menu Bar UI`, `Context Menu UI`, `Cashier Dashboard Dialogs`, `Carousel UI`, `Form Controls`, `Cashier Order Detail`, `Drawer UI`, `Select UI`, `Chart UI`, `Navigation Menu UI`, `Cashier Data Table`, `Skeleton Loading UI`, `Hover Card UI`, `Scroll Area UI`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `IDLE`, `ORDERING`, `ORDER_REVIEW` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Manager Inventory Inspector` be split into smaller, more focused modules?**
  _Cohesion score 0.06435498089920658 - nodes in this community are weakly interconnected._
- **Why does `supabase` connect `Authentication and Profile` to `Manager Inventory Inspector`, `Cashier Dialog Components`, `Rider Service Flow`, `Production Delivery Inventory`, `Customer Catalog Types`, `Cashier Sales Services`, `Manager Inventory API`, `Kitchen Queue Services`, `Manager Fulfillment API`, `Cashier Menu API`, `Customer Checkout Recovery`, `Cashier Payment Resolution`, `Inventory Audit API`, `Rider Authentication Screens`, `Customer Tracking Payments`, `Cashier Transaction Controls`, `Cashier Sale Hydration`, `Manager Menu and Riders`, `Rider Application Auth`, `Customer Order Status`, `Auth Provider and Guards`, `Manager Drink Choices`, `Closed Shift History`, `Paid Order Cancellation`, `GCash Payment Rejection`, `Online Payment API`, `GCash Payment Verification`, `Walk In Sale API`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `Cashier Dialog Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11059907834101383 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `Auth Provider and Guards` to `Manager Route Registry`, `Manager Rider Tables`, `Rider Service Flow`, `Customer Catalog Types`, `Manager Drink Choices`, `Manager Dashboard Notifications`, `Cashier Dashboard Dialogs`, `Cashier Menu API`, `Customer Checkout Recovery`, `Manager Order Financials`, `Rider Authentication Screens`, `Cashier Transaction Controls`, `Cashier Order Navigation`, `Cashier Sale Hydration`, `Closed Shift History`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Should `Shared Input Components` be split into smaller, more focused modules?**
  _Cohesion score 0.04426229508196721 - nodes in this community are weakly interconnected._

`graphify-out/` was written into the working tree. If it is not ignored, it appears in `git status`; add it to `.gitignore` or commit only outputs intended for sharing.

