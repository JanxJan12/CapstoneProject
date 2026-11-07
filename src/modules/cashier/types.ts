export type CashierPageId =
  | "dashboard"
  | "pending-payments"
  | "walkin-pos"
  | "order-list"
  | "transactions"
  | "orders-receipts"
  | "shift-settlement";

export type OrderType = "Dine-in" | "Take-out" | "Delivery";
export type OrderChannel = "online" | "walk_in";
export type OrderStatus =
  | "Awaiting Payment"
  | "Confirmed"
  | "Preparing"
  | "Ready"
  | "Waiting for Rider"
  | "Rider Accepted"
  | "Picked Up"
  | "Out for Delivery"
  | "Delivered"
  | "Completed"
  | "Cancelled";
export type PaymentMethod = "Cash" | "GCash";
export type PaymentStatus =
  | "Unknown"
  | "Unpaid"
  | "Pending"
  | "Verified"
  | "Rejected"
  | "Voided";
export type TransactionStatus = "Completed" | "Refunded" | "Voided";
export type ShiftStatus = "Open" | "Pending Review" | "Closed";
export type RiderAvailability = "Available" | "Assigned" | "Offline";

export interface CashierUser {
  id: string;
  name: string;
  terminal: string;
}

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  aliases?: string[];
  imageUrl?: string;
  category: string;
  description: string;
  price: number;
  withoutRicePrice?: number;
  withRiceAvailable?: boolean;
  withoutRiceAvailable?: boolean;
  available: boolean;
  preparationMinutes?: number;
  drinkChoiceGroups?: DrinkChoiceGroup[];
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface DrinkChoiceGroup {
  id: string;
  name: string;
  selection: "single" | "multiple";
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: OrderItemModifier[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Stored order_items.line_total when available; preserves the historical line amount. */
  lineTotal?: number;
  note?: string;
  modifiers?: OrderItemModifier[];
  mealOption?: "with_rice" | "without_rice";
}

export interface OrderTimelineEvent {
  id: string;
  status: OrderStatus;
  label: string;
  timestamp: string;
  actor: string;
}

export interface Order {
  id: string;

  /**
   * PostgreSQL orders.id UUID.
   * Present for orders loaded from Supabase.
   * Local/demo orders may not have one yet.
   */
  databaseId?: string;

  /** PostgreSQL orders.order_channel for database-backed orders. */
  orderChannel?: OrderChannel;

  customerName: string;
  contactNumber: string;
  deliveryAddress?: string;
  landmark?: string;
  type: OrderType;
  items: OrderItem[];
  subtotal: number;
  /** Recorded orders.delivery_fee; absent for orders without a stored fee. */
  deliveryFee?: number;
  taxAmount?: number;
  total: number;
  paymentId?: string;
  transactionId?: string;
  paymentMethod: PaymentMethod | "Unknown";
  paymentStatus: PaymentStatus;
  /** An owned sale exists, but its financial records did not reconcile. */
  paymentResolutionUncertain?: boolean;
  status: OrderStatus;
  assignedRider?: string;
  riderStatus?: string;
  riderAssignmentKnown?: boolean;
  riderAssignmentId?: string;
  riderAssignmentStatus?:
    | "offered"
    | "accepted"
    | "rejected"
    | "picked_up"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";
  riderAssignedAt?: string;
  riderAssignmentUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
  cashierId?: string;
  shiftId?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  timeline: OrderTimelineEvent[];
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  submittedAmount: number;
  /** Actual cash_received, distinct from submittedAmount's legacy amount fallback. */
  cashReceived?: number;
  status: PaymentStatus;
  referenceNumber?: string;
  proofLabel?: string;
  proofUrl?: string;
  proofImagePath?: string;
  senderName?: string;
  receiverName?: string;
  uploadedBy?: string;
  uploadedAt: string;
  updatedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  rejectionNotes?: string;
}

export interface Transaction {
  id: string;
  receiptNumber?: string;
  orderId: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  status: TransactionStatus;
  cashierId: string;
  cashierName: string;
  shiftId: string;
  paymentId: string;
  createdAt: string;
  voidReason?: string;
  refundAmount?: number;
}

export interface CashierShift {
  id: string;
  cashierId: string;
  cashierName: string;
  terminal: string;
  openingCash: number;
  startedAt: string;
  endedAt?: string;
  actualCash?: number;
  expectedCash?: number;
  variance?: number;
  pendingPaymentCountAtClose?: number;
  status: ShiftStatus;
}

export interface Rider {
  id: string;
  name: string;
  availability: RiderAvailability;
  currentOrderId?: string;
}

export type NotificationKind =
  | "payment_submitted"
  | "kitchen_ready"
  | "order_delayed"
  | "no_rider"
  | "rider_accepted"
  | "shift_variance"
  | "record_updated";

export interface CashierNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  customerVisible?: boolean;
  kind: NotificationKind;
  page: CashierPageId;
  intent?: CashierNavigationIntent;
  orderId?: string;
}

export type ActivityKind =
  | "payment_verified"
  | "payment_rejected"
  | "walkin_created"
  | "kitchen_ready"
  | "rider_accepted"
  | "transaction_completed"
  | "order_cancelled"
  | "shift_started"
  | "shift_closed";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  orderId?: string;
  transactionId?: string;
  actor: string;
  timestamp: string;
}

export interface HeldOrder {
  id: string;
  customerName?: string;
  contactNumber?: string;
  deliveryAddress?: string;
  type: OrderType;
  items: OrderItem[];
  heldAt: string;
}

export interface CashierState {
  version: number;
  cashier: CashierUser;
  menuItems: MenuItem[];
  orders: Order[];
  payments: Payment[];
  transactions: Transaction[];
  shifts: CashierShift[];
  riders: Rider[];
  notifications: CashierNotification[];
  activities: ActivityEvent[];
  heldOrders: HeldOrder[];
  delayedThresholdMinutes: number;
}

export interface WalkInOrderInput {
  customerName?: string;
  contactNumber?: string;
  deliveryAddress?: string;
  type: OrderType;
  items: Array<
    Pick<
      OrderItem,
      "menuItemId" | "name" | "unitPrice" | "quantity" | "note" | "modifiers" | "mealOption"
    >
  >;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  gcashReference?: string;
}

export interface OrderOperationalEditInput {
  customerName: string;
  contactNumber: string;
  deliveryAddress?: string;
}

export interface CashierNavigationIntent {
  workspaceView?: "orders" | "receipts";
  orderId?: string;
  transactionId?: string;
  statuses?: OrderStatus[];
  orderTypes?: OrderType[];
  transactionStatuses?: TransactionStatus[];
  paymentMethods?: PaymentMethod[];
  today?: boolean;
  focusSearch?: boolean;
  openFirstReady?: boolean;
  openMostRecentReceipt?: boolean;
  search?: string;
  paymentOrderId?: string;
}

export interface ShiftTotals {
  cashSales: number;
  gcashSales: number;
  refunds: number;
  cashRefunds: number;
  voids: number;
  transactionCount: number;
  ordersProcessed: number;
  expectedCash: number;
}

export interface ShiftClosureInput {
  actualCash: number;
}

export type CashierQueueStage =
  | "payment_pending"
  | "payment_resubmission"
  | "kitchen_queue"
  | "preparing"
  | "ready_for_handoff"
  | "rider_assignment"
  | "rider_assigned"
  | "picked_up"
  | "out_for_delivery";

export type CashierQueueNextAction =
  "verify_payment" | "release_order" | "view_details";

export type CashierQueuePriority = 1 | 2 | 3;

export interface CashierActionQueueItem {
  orderId: string;
  createdAt: string;
  customerName: string;
  orderType: OrderType;
  totalAmount: number;
  currentStage: string;
  stage: CashierQueueStage;
  nextAction: CashierQueueNextAction;
  waitingMinutes: number;
  isDelayed: boolean;
  orderAgeReview: boolean;
  priority: CashierQueuePriority;
  orderStatus: OrderStatus;
  stageStartedAt: string;
  paymentId?: string;
}

export interface CashierShiftSummary {
  shiftId?: string;
  isActive: boolean;
  cashierName: string;
  terminal: string;
  startedAt?: string;
  expectedDrawer: number;
  pendingPaymentCount: number;
}

export interface CashierAttentionSummary {
  pendingPayments: number;
  readyOrders: number;
  delayedOrders: number;
  agingOrders: number;
  kitchenQueued: number;
  preparingOrders: number;
  waitingForRider: number;
  deliveryInProgress: number;
  actionRequired: number;
  allActive: number;
  olderBacklog: number;
}

export type CashierQueueView =
  "action_required" | "current_orders" | "ready_for_handoff" | "older_backlog" | "all_active";

export type CashierAttentionFilter = "payments" | "ready" | "delayed";
