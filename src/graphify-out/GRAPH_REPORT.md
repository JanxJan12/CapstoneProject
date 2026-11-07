# Graph Report - src  (2026-11-03)

## Corpus Check
- 321 files · ~187,676 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .css 6)

## Summary
- 2076 nodes · 6407 edges · 99 communities (93 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Manager Inventory Adjustments
- Stock Receiving Workflow
- Shared UI Components
- Payment UI Utilities
- Dialogs and Receipts
- Sidebar and Navigation
- Rider Application Workspace
- Cashier Order Types
- React UI Foundations
- Walk In POS Controller
- Cashier Orders Dashboard
- Manager API Mapping
- Customer Tracking Refresh
- Cashier Order Payment Data
- Inventory Audit Reconciliation
- Kitchen Display Queue
- Authentication Landing Screens
- Manager Customer Pages
- Shared Domain Types
- Cashier Store Actions
- Manager Phase Two API
- POS Menu Grid
- Walk In POS Screen
- Customer App Navigation
- Cashier Shift Settlement
- Transaction History Data
- Cashier Store Persistence
- Inventory Detail Presentation
- Rider Application Submission
- Cashier Service Layer
- Cashier Order List
- Inventory Request Workflow
- Cashier Dashboard Data
- Route Authentication Guards
- Cashier Sale Hydration
- Manager Menu Management
- Authentication Session State
- Page Blueprint Navigation
- Toggle Alert Badges
- Manager Orders Dashboard
- Inventory Request Register
- Walk In POS Architecture
- Dropdown App Shell
- Customer Checkout Totals
- Receiving Document Views
- Context Menu Components
- Cashier Order Actions
- Cashier Seed Constants
- Rider Delivery Components
- Carousel UI Components
- Transaction History Screen
- POS Cart Types
- Manager Stock Notifications
- Manager Orders Financials
- Inventory Overview Screen
- Supabase Login Screens
- Form Label Components
- Cashier Work Queue
- Cashier Form Schemas
- Cashier Reusable Components
- Reports Page Layout
- Closed Shift History
- Paid Order Cancellation
- Transaction Detail Drawer
- Drawer UI Components
- Select UI Components
- Customer GCash Rejection
- Online Payment Data
- Customer Quote Presentation
- Manager Sales Reports
- Chart UI Components
- Navigation Menu Components
- Customer Payment Tracking
- Cashier Rider Assignment
- Transaction Export Pipeline
- Inventory Movement History
- Request Document Printing
- Pagination UI Components
- Customer GCash Verification
- Customer Order History
- Walk In Sale Creation
- Cashier Button Components
- Password Recovery Screens
- Accordion UI Components
- One Time Password UI
- Customer Tracking URLs
- System State Components
- Revenue Chart Component
- Resizable UI Components
- Customer Menu Browsing
- Data Table Component
- Restaurant Exterior Image
- Customer Cart Screen
- Customer Checkout Screen
- Customer Order Tracking
- Food House Brand Logo

## God Nodes (most connected - your core abstractions)
1. `cn()` - 253 edges
2. `formatMoney()` - 75 edges
3. `CashierButton` - 52 edges
4. `Order` - 49 edges
5. `Button()` - 47 edges
6. `StockReceivingPage()` - 44 edges
7. `useAuth()` - 40 edges
8. `ManagerRequestsPage()` - 39 edges
9. `supabase` - 35 edges
10. `useCashierStore()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `RequireAuthProps` --references--> `AccountRole`  [EXTRACTED]
  app/RequireAuth.tsx → data/accountRole.ts
- `SummaryCard()` --calls--> `cn()`  [EXTRACTED]
  modules/cashier/components/Cards.tsx → components/ui/utils.ts
- `Props` --references--> `AccountRole`  [EXTRACTED]
  modules/auth/pages/RiderLoginPage.tsx → data/accountRole.ts
- `ProfileRow` --references--> `AccountRole`  [EXTRACTED]
  app/providers/AuthProvider.tsx → data/accountRole.ts
- `AuthApp()` --calls--> `useAuth()`  [EXTRACTED]
  modules/auth/index.tsx → app/providers/AuthProvider.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared drawer surface** — src_modules_cashier_pos_readme_choicedrawer, src_modules_cashier_pos_readme_paymentpanel, src_modules_cashier_pos_readme_receiptpanel [EXTRACTED 1.00]

## Communities (99 total, 6 thin omitted)

### Community 0 - "Manager Inventory Adjustments"
Cohesion: 0.05
Nodes (114): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent, AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay (+106 more)

### Community 1 - "Stock Receiving Workflow"
Cohesion: 0.06
Nodes (76): inspectorLabel(), isInspectorAuditId(), ReceivingAccordion(), clearReceivingDraftRequestId(), createEmergencyProductionReceiving(), deleteEmptyReceivingDraft(), getFriendlyReceivingError(), getOrCreateReceivingDraftRequestId() (+68 more)

### Community 2 - "Shared UI Components"
Cohesion: 0.05
Nodes (48): Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+40 more)

### Community 3 - "Payment UI Utilities"
Cohesion: 0.08
Nodes (35): ActionCard(), MetricCard(), EmptyState(), EmptyStateProps, ErrorBannerProps, PageHeaderProps, SectionHeader(), SectionHeaderProps (+27 more)

### Community 4 - "Dialogs and Receipts"
Cohesion: 0.14
Nodes (37): CommandDialog(), Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogPortal() (+29 more)

### Community 5 - "Sidebar and Navigation"
Cohesion: 0.06
Nodes (45): Input(), Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+37 more)

### Community 6 - "Rider Application Workspace"
Cohesion: 0.08
Nodes (52): BottomNav(), BottomTab, DeliveryDetailScreen(), DeliveryRequestsTab(), HistoryTab(), HomeTab(), NavAssistScreen(), PendingOfferAcceptance (+44 more)

### Community 7 - "Cashier Order Types"
Cohesion: 0.09
Nodes (37): HydratedCashierSale, CashierStatus, STATUS_PRESENTATION, StatusBadge(), StatusBadgeProps, StatusPresentation, ReceiptContent(), ReceiptPanel() (+29 more)

### Community 8 - "React UI Foundations"
Cohesion: 0.05
Nodes (18): buttonVariants, Calendar(), Checkbox(), HoverCardContent(), PopoverContent(), Progress(), RadioGroup(), RadioGroupItem() (+10 more)

### Community 9 - "Walk In POS Controller"
Cohesion: 0.13
Nodes (35): CASH_TENDER_ROUNDING_STEPS, POS_BEST_SELLER_LIMIT, POS_RECENT_SEARCH_LIMIT, POS_TAX_ENABLED, POS_TAX_RATE, addCartItem(), calculatePOSTotals(), CartUpdateResult (+27 more)

### Community 10 - "Cashier Orders Dashboard"
Cohesion: 0.14
Nodes (26): cashierHydrationView(), ErrorBanner(), PageHeader(), Toast, CashierDashboardPage(), CashierDashboardSkeleton(), CashierWorkQueue(), useCashierStore() (+18 more)

### Community 11 - "Manager API Mapping"
Cohesion: 0.14
Nodes (34): FULFILLMENT_TYPES, ManagerFulfillmentType, ManagerOrderChannel, ManagerOrderFinancials, ManagerOrderItem, ManagerOrderStatusCount, ManagerPaymentMethod, ManagerRecentOrder (+26 more)

### Community 12 - "Customer Tracking Refresh"
Cohesion: 0.06
Nodes (30): gcashMerchantConfig, createCustomerTrackingRefreshQueue(), CartItem, CATEGORY_META, CheckoutCustomerProfile, CUSTOMER_CURRENCY_FORMATTER, CustomerAccountData, CustomerDatabaseMenuItem (+22 more)

### Community 13 - "Cashier Order Payment Data"
Cohesion: 0.10
Nodes (31): applyCashierOrderPaymentSummaries(), CASHIER_PAYMENT_BATCH_SIZE, CashierOrderPaymentSummary, loadCashierOrderPaymentSummaries(), parseCashierOrderPaymentSummaries(), assertNever(), CancelOrderResult, DatabaseFulfillmentType (+23 more)

### Community 14 - "Inventory Audit Reconciliation"
Cohesion: 0.13
Nodes (29): Badge(), codes, getInventoryAuditItems(), getInventoryAudits(), InventoryAuditFinding, InventoryAuditFindingCode, InventoryAuditResult, InventoryAuditRun (+21 more)

### Community 15 - "Kitchen Display Queue"
Cohesion: 0.13
Nodes (28): KitchenApp(), KitchenTerminalActivation(), KitchenTerminalLoading(), NAV_GROUPS, COLUMNS, formatFulfillmentType(), formatKitchenStatus(), KitchenQueue() (+20 more)

### Community 16 - "Authentication Landing Screens"
Cohesion: 0.13
Nodes (21): AuthApp, ImageWithFallback(), DemoPasswordLogin(), AuthApp(), AuthScreen, SCREEN_TABS, CustomerLoginPage(), ErrorBanner() (+13 more)

### Community 17 - "Manager Customer Pages"
Cohesion: 0.16
Nodes (21): Button(), ButtonSize, ButtonVariant, Table(), Td(), getManagerCustomers(), ManagerCustomer, ManagerRider (+13 more)

### Community 18 - "Shared Domain Types"
Cohesion: 0.10
Nodes (26): allOrders, customers, inventoryItems, invTransactions, kitchenOrders, orderStatusData, pendingPayments, prototypePurchaseOrders (+18 more)

### Community 19 - "Cashier Store Actions"
Cohesion: 0.15
Nodes (25): fetchCashierOnlinePayments(), closeCashierShift(), CloseCashierShiftResult, DatabaseCloseShiftRow, DatabaseOpenShiftRow, fetchOpenCashierShift(), mapOpenCashierShiftRow(), OpenCashierShiftResult (+17 more)

### Community 20 - "Manager Phase Two API"
Cohesion: 0.21
Nodes (27): createRiderDocumentSignedUrl(), getManagerMenuItems(), getManagerRiderApplication(), getManagerRiders(), ManagerRiderApplication, ManagerRiderApprovalResult, ManagerRiderAvailabilityStatus, mapCustomer() (+19 more)

### Community 21 - "POS Menu Grid"
Cohesion: 0.13
Nodes (20): drinkChoiceGroupsFor(), MENU_CATEGORIES, MENU_GRID_OVERSCAN_ROWS, MENU_GRID_ROW_HEIGHT_PX, CATEGORY_ICONS, CategoryButton(), CategorySidebar, CategorySidebarProps (+12 more)

### Community 22 - "Walk In POS Screen"
Cohesion: 0.12
Nodes (21): POPULAR_MENU_SEARCHES, ChoiceDrawer(), ORDER_TYPES, OrderTypeGate(), Action(), POSOrderHeader(), POSOrderSidebar(), SearchBar (+13 more)

### Community 23 - "Customer App Navigation"
Cohesion: 0.14
Nodes (25): canAddCurrentCustomerProduct(), currentCustomerProduct(), CurrentProduct, CustomerErrorContext, customerErrorMessage(), customerProductPricesChanged(), fallback, isCurrentCustomerMenuResponse() (+17 more)

### Community 24 - "Cashier Shift Settlement"
Cohesion: 0.18
Nodes (16): CompactShiftHeader(), EndShiftDialog(), inspectShiftClosureOutcome(), ShiftSummaryItem(), VarianceIndicator(), ShiftMetrics(), manilaDateTime(), ShiftOverview() (+8 more)

### Community 25 - "Transaction History Data"
Cohesion: 0.15
Nodes (20): EDITABLE_ELEMENTS, useSearchShortcut(), fetchHistoryPage(), fetchHistoryShifts(), HISTORY_CSV_HEADERS, HISTORY_EXPORT_LIMIT, HISTORY_PAGE_SIZE, historyCsvRow() (+12 more)

### Community 26 - "Cashier Store Persistence"
Cohesion: 0.16
Nodes (21): DatabaseMenuCategoryRow, DatabaseMenuEffectiveAvailabilityRow, DatabaseMenuItemRow, fetchCashierMenuItems(), FixedMealOptionRow, groupDrinkChoices(), loadCashierDrinkChoices(), ModifierRow (+13 more)

### Community 27 - "Inventory Detail Presentation"
Cohesion: 0.20
Nodes (19): BatchAvailability, batchAvailability(), batchDecision(), ManagerStockBatch, ManagerStockDetail, ManagerStockMovement, BatchCard(), InventoryBatchList() (+11 more)

### Community 28 - "Rider Application Submission"
Cohesion: 0.13
Nodes (20): ErrorBanner(), FileUploadField(), FileUploadFieldProps, Props, RiderApplicationPage(), TextField(), TextFieldProps, getStatusContent() (+12 more)

### Community 29 - "Cashier Service Layer"
Cohesion: 0.20
Nodes (17): MAX_ACTIVITY_RECORDS, markNotificationRead(), markNotificationsRead(), reconcileCashierNotifications(), holdOrder(), removeHeldOrder(), addActivity(), cloneState() (+9 more)

### Community 30 - "Cashier Order List"
Cohesion: 0.19
Nodes (21): ORDER_REFRESH_INTERVAL_MS, PAGE_SIZE, SEARCH_FOCUS_DELAY_MS, BaseOrderSort, compareByKey(), compareFallback(), elapsedOrderMinutes(), getItemsSummary() (+13 more)

### Community 31 - "Inventory Request Workflow"
Cohesion: 0.18
Nodes (21): defaultNeeded(), downloadPng(), downloadText(), errorText(), fromManilaInput(), guidanceLabel(), ManagerRequestsPage(), manila() (+13 more)

### Community 32 - "Cashier Dashboard Data"
Cohesion: 0.18
Nodes (19): CASHIER_STAGE_DELAY_THRESHOLDS, DASHBOARD_CLOCK_REFRESH_MS, isOlderCashierOrder(), partitionCashierWorkQueue(), selectCashierQueueView(), useCashierDashboard(), getCashierActionQueue(), getCashierShiftSummary() (+11 more)

### Community 33 - "Route Authentication Guards"
Cohesion: 0.15
Nodes (15): useAuth(), MAINTENANCE_MODE, RequireAuth(), RequireAuthProps, useLogout(), getErrorMessage(), RouteErrorPage(), CashierApp (+7 more)

### Community 34 - "Cashier Sale Hydration"
Cohesion: 0.17
Nodes (20): attachRecordedDeliveryFees(), DatabaseCashierSale, DatabaseHistoryEntry, DatabaseOrder, DatabaseOrderItem, DatabasePayment, DatabaseTransaction, fetchCashierSale() (+12 more)

### Community 35 - "Manager Menu Management"
Cohesion: 0.23
Nodes (16): getManagerDrinkChoices(), ManagerDrinkChoice, parseChoice(), setManagerDrinkChoice(), ManagerMenuItem, getManagerFixedMealOptions(), getManagerMealIngredients(), getManagerMealInventoryCandidates() (+8 more)

### Community 36 - "Authentication Session State"
Cohesion: 0.19
Nodes (12): App(), AuthContext, AuthContextValue, AuthProvider(), DATABASE_ROLES, getDisplayName(), isDatabaseRole(), ProfileRow (+4 more)

### Community 37 - "Page Blueprint Navigation"
Cohesion: 0.12
Nodes (14): PageNav(), CASHIER_GROUPS, KITCHEN_GROUPS, MENU_CATEGORIES, ORDER_STEP_MAP, ORDER_TIMELINE, PAGE_LIST, PROTOTYPE_MANAGER_GROUPS (+6 more)

### Community 38 - "Toggle Alert Badges"
Cohesion: 0.14
Nodes (11): Alert(), AlertDescription(), AlertTitle(), alertVariants, Badge(), badgeVariants, ToggleGroup(), ToggleGroupContext (+3 more)

### Community 39 - "Manager Orders Dashboard"
Cohesion: 0.16
Nodes (17): ManagerDailySale, ManagerDashboardData, ManagerOrderStatus, ManagerPaymentStatus, MANAGER_ORDER_STATUS_PRESENTATION, managerOrderNeedsAttention(), ManagerOrderStatusBadge(), PAYMENT_STATUS_PRESENTATION (+9 more)

### Community 40 - "Inventory Request Register"
Cohesion: 0.20
Nodes (15): AwaitingProductionDelivery, manila, statusLabel, closeInventoryRequestShort(), getInventoryRequestRegister(), issueInventoryRequest(), recordInventoryRequestEvent(), RequestDraftLine (+7 more)

### Community 41 - "Walk In POS Architecture"
Cohesion: 0.11
Nodes (19): cashierService, ChoiceDrawer, MenuGrid, OrderTypeGate, PaymentPanel, POSCart, posOperations, POSOrderHeader (+11 more)

### Community 42 - "Dropdown App Shell"
Cohesion: 0.18
Nodes (11): AppShell(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+3 more)

### Community 43 - "Customer Checkout Totals"
Cohesion: 0.14
Nodes (17): customerQuotedAmountRows(), CartCheckoutButton(), CartPage(), CheckoutPage(), loadCheckoutCustomer(), clearCustomerDeliveryRetry(), clearCustomerOrderRequestId(), CustomerCheckoutFeedbackError (+9 more)

### Community 44 - "Receiving Document Views"
Cohesion: 0.22
Nodes (15): InventoryRequest, ReceivingDocumentFilters, ReceivingReportSummary, receivingDocumentLabels(), ReceivingDocumentList(), requestWorkflow(), manilaDateTime, initialFilters (+7 more)

### Community 45 - "Context Menu Components"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 46 - "Cashier Order Actions"
Cohesion: 0.24
Nodes (14): DropdownMenuTrigger(), CashierIconButton, OrderCards(), canCancelCashierOrder(), getOrderWaitingPresentation(), getRiderStatus(), OrderSortDescriptor, OrderSortKey (+6 more)

### Community 47 - "Cashier Seed Constants"
Cohesion: 0.14
Nodes (15): CASHIER_CURRENCY, CASHIER_LOCALE, CASHIER_STATE_VERSION, CASHIER_STORAGE_KEY, CASHIER_TERMINAL, DATA_REFRESH_FEEDBACK_MS, DEFAULT_DELAY_THRESHOLD_MINUTES, DINING_TABLES (+7 more)

### Community 48 - "Rider Delivery Components"
Cohesion: 0.21
Nodes (10): StatusBadge(), DeliveryDetail(), DeliveryHistory(), tabs, DeliveryRequests(), tabs, RiderHome(), tabs (+2 more)

### Community 49 - "Carousel UI Components"
Cohesion: 0.17
Nodes (14): Button(), Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 50 - "Transaction History Screen"
Cohesion: 0.28
Nodes (13): CashierButton, CashierSelect, SearchToolbar(), FilterChip(), OrderFilters(), OrderFilterValue, findAccessibleOrder(), TransactionFilters() (+5 more)

### Community 51 - "POS Cart Types"
Cohesion: 0.31
Nodes (10): MAX_POS_ITEM_QUANTITY, ChoiceDrawerProps, OrderItem, OrderItemProps, OrderReviewDrawer(), POSCart(), POSCartProps, POSCartLine (+2 more)

### Community 52 - "Manager Stock Notifications"
Cohesion: 0.21
Nodes (13): getManagerDashboard(), countLowUsableStock(), getManagerStockSummary(), ManagerInventoryStock, attentionItems(), StockAlert, stockAlerts(), ManagerNotification (+5 more)

### Community 53 - "Manager Orders Financials"
Cohesion: 0.21
Nodes (15): getManagerOrderFinancials(), getManagerOrders(), ManagerPaymentStatusBadge(), currencyFormatter, DELIVERY_STEP_MAP, formatCurrency(), formatOrderClock(), formatOrderDate() (+7 more)

### Community 54 - "Inventory Overview Screen"
Cohesion: 0.22
Nodes (13): ExistingRequestLinks(), InventoryPage(), overviewQuery(), ReadState, StockFilter, stockFilters, StockOverviewCard(), StockOverviewFilters() (+5 more)

### Community 55 - "Supabase Login Screens"
Cohesion: 0.19
Nodes (10): AuthenticatingPage, supabase, AuthenticatingPage(), AuthenticationStep, isStaffRole(), STAFF_ROLES, StaffProfile, StaffRole (+2 more)

### Community 56 - "Form Label Components"
Cohesion: 0.20
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 57 - "Cashier Work Queue"
Cohesion: 0.15
Nodes (13): formatElapsedMinutes(), compactDuration(), FILTER_LABELS, VIEW_LABELS, VISIBLE_VIEWS, waitingLabel(), ActionButtonProps, PrimaryCashierActions() (+5 more)

### Community 58 - "Cashier Form Schemas"
Cohesion: 0.13
Nodes (13): CancellationForm, cancellationSchema, EndShiftForm, endShiftSchema, OrderOperationalEditForm, orderOperationalEditSchema, posSchema, RejectionForm (+5 more)

### Community 59 - "Cashier Reusable Components"
Cohesion: 0.13
Nodes (14): ActionCard, components barrel, ConfirmationDialog, DataTable, Drawer, EmptyState, LoadingSkeleton, MetricCard (+6 more)

### Community 60 - "Reports Page Layout"
Cohesion: 0.30
Nodes (7): DesktopFrame(), FrameRow(), MobileFrame(), PageHeader(), SectionDivider(), ReportsBlueprintPage(), reportTypes

### Community 61 - "Closed Shift History"
Cohesion: 0.24
Nodes (12): amount(), ClosedShiftSnapshot, fetchClosedShiftHistory(), HistoryCursor, HistoryQuery, manilaDayStart(), mapRow(), timestamp() (+4 more)

### Community 62 - "Paid Order Cancellation"
Cohesion: 0.26
Nodes (11): ManagerOrder, getPaidOrderCancellation(), InventoryDisposition, PaidOrderCancellation, parseSettlement(), RefundMethod, SettlementInput, settlePaidOrderCancellation() (+3 more)

### Community 63 - "Transaction Detail Drawer"
Cohesion: 0.35
Nodes (8): DialogClose(), Drawer(), basketSubtotalDisagrees(), recordedBasketChoices(), recordedBasketLine(), FinancialLine(), Overview(), TransactionDetailDrawer()

### Community 64 - "Drawer UI Components"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 65 - "Select UI Components"
Cohesion: 0.20
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 66 - "Customer GCash Rejection"
Cohesion: 0.32
Nodes (11): CustomerGcashRejectionResult, DatabaseRejectionResult, isAllowedReason(), mapRejectionResult(), optionalString(), rejectCustomerGcashPayment(), requireRecord(), requireString() (+3 more)

### Community 67 - "Online Payment Data"
Cohesion: 0.35
Nodes (11): DatabaseOnlinePaymentRow, HydratedOnlinePayment, mapOnlinePayment(), mapPaymentStatus(), optionalString(), optionalTimestamp(), optionalUuid(), requireRecord() (+3 more)

### Community 68 - "Customer Quote Presentation"
Cohesion: 0.21
Nodes (10): customerMoneyCents(), CustomerRecordedAmounts, customerRecordedBreakdown(), currentCustomerQuote(), CustomerOrderQuote, CustomerQuoteDisplayStatus, customerQuoteDisplayStatus(), customerQuoteStatusCopy (+2 more)

### Community 69 - "Manager Sales Reports"
Cohesion: 0.29
Nodes (9): StatCard(), getManagerSalesReport(), ManagerSalesReport, currencyFormatter, formatCurrency(), getDefaultDateRange(), getErrorMessage(), ReportRange (+1 more)

### Community 70 - "Chart UI Components"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 71 - "Navigation Menu Components"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 72 - "Customer Payment Tracking"
Cohesion: 0.22
Nodes (9): normalizeCustomerGcashReference(), customerPaymentSubmissionIsCurrent(), customerPaymentTrackingState(), PaymentStatus, fetchCustomerTrackingPayment(), getPaymentProofExtension(), isValidServerTimestamp(), parseCustomerTrackingPayment() (+1 more)

### Community 73 - "Cashier Rider Assignment"
Cohesion: 0.29
Nodes (8): isOrderDelayed(), useOrderDetailsDrawer(), applyCashierAssignmentStatuses(), ASSIGNMENT_STATUSES, AssignmentRow, canOfferOrderToRider(), fetchCashierAssignmentStatuses(), labelFor()

### Community 74 - "Transaction Export Pipeline"
Cohesion: 0.24
Nodes (7): buildTransactionExport(), manilaDateTime, recordedAmount(), TRANSACTION_CSV_HEADERS, TRANSACTION_EXPORT_PAGE_SIZE, TransactionExportRecord, filterTransactionRecords()

### Community 75 - "Inventory Movement History"
Cohesion: 0.36
Nodes (8): getManagerStockMovements(), InventoryTransactionType, StockMovementPage, InvTransactionsPage(), TYPES, appendMovementPage(), claimMovementPageLoad(), releaseMovementPageLoad()

### Community 76 - "Request Document Printing"
Cohesion: 0.31
Nodes (9): RequestSnapshot, escapeHtml(), field(), issuedRequestDocument(), manila(), RequestDocumentData, RequestDocumentLine, requestPdfTitle() (+1 more)

### Community 77 - "Pagination UI Components"
Cohesion: 0.28
Nodes (7): Pagination(), PaginationContent(), PaginationEllipsis(), PaginationLink(), PaginationLinkProps, PaginationNext(), PaginationPrevious()

### Community 78 - "Customer GCash Verification"
Cohesion: 0.42
Nodes (8): CustomerGcashVerificationResult, DatabaseVerificationResult, mapVerificationResult(), requireRecord(), requireString(), requireTimestamp(), requireUuid(), verifyCustomerGcashPayment()

### Community 79 - "Customer Order History"
Cohesion: 0.31
Nodes (8): CustomerStatusBadge(), formatCustomerOrderStatus(), getCustomerOrderStatusPresentation(), NEUTRAL_PRESENTATION, ORDER_STATUS_LABELS, customerSnapshotModifierNames(), HistoryPage(), loadCustomerOrders()

### Community 80 - "Walk In Sale Creation"
Cohesion: 0.43
Nodes (7): createWalkInSale(), DatabaseWalkInSaleRow, mapFulfillmentType(), mapPaymentMethod(), parseOptionalNumber(), parseRequiredNumber(), WalkInSaleResult

### Community 81 - "Cashier Button Components"
Cohesion: 0.29
Nodes (6): ButtonSize, ButtonVariant, CashierButtonProps, CashierIconButtonProps, SIZE_STYLES, VARIANT_STYLES

### Community 82 - "Password Recovery Screens"
Cohesion: 0.53
Nodes (3): InputField(), ForgotPasswordMobilePage(), ForgotPasswordPage()

### Community 83 - "Accordion UI Components"
Cohesion: 0.33
Nodes (3): AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 84 - "One Time Password UI"
Cohesion: 0.33
Nodes (3): InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 85 - "Customer Tracking URLs"
Cohesion: 0.53
Nodes (5): CustomerUrlView, customerViewSearch(), isCustomerOrderId(), parseCustomerViewSearch(), views

### Community 86 - "System State Components"
Cohesion: 0.53
Nodes (4): ConfirmDialog(), EmptyTable(), SystemStates(), Toast()

### Community 90 - "Customer Menu Browsing"
Cohesion: 0.50
Nodes (4): menuItems, CartItem, CustNav(), MenuBrowsePage()

### Community 91 - "Data Table Component"
Cohesion: 0.50
Nodes (4): DataTable(), DataTableColumn, DataTableProps, FragmentRow()

### Community 92 - "Restaurant Exterior Image"
Cohesion: 0.40
Nodes (5): Restaurant exterior at night, Nighttime restaurant setting, Illuminated restaurant counter and menu boards, Outdoor dining area with wooden tables and chairs, Overhead string lights

### Community 94 - "Customer Cart Screen"
Cohesion: 0.67
Nodes (3): CartItem, CartPage(), CustNav()

### Community 95 - "Customer Checkout Screen"
Cohesion: 0.67
Nodes (3): CartItem, CheckoutPage(), CustNav()

### Community 98 - "Food House Brand Logo"
Cohesion: 0.67
Nodes (3): Established 2021, RRJ's Food-House, RRJ's Food-House logo

## Knowledge Gaps
- **40 isolated node(s):** `IDLE`, `ORDERING`, `ORDER_REVIEW`, `PAYMENT`, `RECEIPT` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 478 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Shared UI Components` to `Manager Inventory Adjustments`, `Payment UI Utilities`, `Dialogs and Receipts`, `Sidebar and Navigation`, `Cashier Order Types`, `React UI Foundations`, `Toggle Alert Badges`, `Dropdown App Shell`, `Context Menu Components`, `Cashier Order Actions`, `Carousel UI Components`, `Transaction History Screen`, `Form Label Components`, `Transaction Detail Drawer`, `Drawer UI Components`, `Select UI Components`, `Chart UI Components`, `Navigation Menu Components`, `Pagination UI Components`, `Cashier Button Components`, `Accordion UI Components`, `One Time Password UI`, `Resizable UI Components`, `Data Table Component`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `IDLE`, `ORDERING`, `ORDER_REVIEW` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Manager Inventory Adjustments` be split into smaller, more focused modules?**
  _Cohesion score 0.051043530113297556 - nodes in this community are weakly interconnected._
- **Why does `supabase` connect `Supabase Login Screens` to `Manager Inventory Adjustments`, `Stock Receiving Workflow`, `Dialogs and Receipts`, `Rider Application Workspace`, `Manager API Mapping`, `Customer Tracking Refresh`, `Cashier Order Payment Data`, `Inventory Audit Reconciliation`, `Kitchen Display Queue`, `Authentication Landing Screens`, `Manager Customer Pages`, `Cashier Store Actions`, `Manager Phase Two API`, `Transaction History Data`, `Cashier Store Persistence`, `Rider Application Submission`, `Cashier Sale Hydration`, `Manager Menu Management`, `Authentication Session State`, `Inventory Request Register`, `Closed Shift History`, `Paid Order Cancellation`, `Customer GCash Rejection`, `Online Payment Data`, `Cashier Rider Assignment`, `Customer GCash Verification`, `Walk In Sale Creation`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Stock Receiving Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.06435498089920658 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `Route Authentication Guards` to `Manager Inventory Adjustments`, `Manager Menu Management`, `Authentication Session State`, `Rider Application Workspace`, `Manager Orders Dashboard`, `Cashier Rider Assignment`, `Cashier Orders Dashboard`, `Customer Checkout Totals`, `Customer Tracking Refresh`, `Authentication Landing Screens`, `Manager Customer Pages`, `Manager Orders Financials`, `Customer App Navigation`, `Transaction History Data`, `Cashier Store Persistence`, `Closed Shift History`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Shared UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05336538461538461 - nodes in this community are weakly interconnected._

## Extraction metering note

Semantic extraction used collaboration agents whose token usage was unavailable. The recorded 0 input and 0 output tokens reflect missing metering, not zero actual use.

`graphify-out/` was written into the working tree and currently appears as untracked files.
