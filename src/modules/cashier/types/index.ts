export type CashierPageId =
  | "dashboard"
  | "pending-payments"
  | "walkin-pos"
  | "order-list"
  | "transactions"
  | "shift-settlement";

export type OrderType = "Dine-in" | "Take-out" | "Delivery";
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
export type PaymentStatus = "Pending" | "Verified" | "Rejected";
export type TransactionStatus = "Completed" | "Refunded" | "Voided";
export type ShiftStatus = "Open" | "Pending Review" | "Closed";
export type DiscountType = "Senior Citizen" | "PWD" | null;
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
  available: boolean;
  preparationMinutes?: number;
  inventoryRemaining?: number;
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  selection: "single" | "multiple";
  required: boolean;
  options: OrderItemModifier[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  note?: string;
  modifiers?: OrderItemModifier[];
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
  customerName: string;
  contactNumber: string;
  deliveryAddress?: string;
  type: OrderType;
  tableNumber?: string;
  items: OrderItem[];
  subtotal: number;
  discountType: DiscountType;
  discountReference?: string;
  discountAmount: number;
  taxAmount?: number;
  total: number;
  orderInstructions?: string;
  paymentId?: string;
  transactionId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  assignedRider?: string;
  riderStatus?: string;
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
  status: PaymentStatus;
  referenceNumber?: string;
  proofLabel?: string;
  proofUrl?: string;
  senderName?: string;
  receiverName?: string;
  uploadedBy?: string;
  uploadedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  rejectionNotes?: string;
  overrideMismatch?: boolean;
}

export interface Transaction {
  id: string;
  receiptNumber?: string;
  orderId: string;
  customerName: string;
  amount: number;
  discountAmount: number;
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
  varianceReason?: string;
  notes?: string;
  managerApprovedBy?: string;
  managerApprovedAt?: string;
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
  | "receipt_reprinted"
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
  tableNumber?: string;
  items: OrderItem[];
  discountType: DiscountType;
  discountReference?: string;
  orderInstructions?: string;
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
  tableNumber?: string;
  items: Array<
    Pick<
      OrderItem,
      "menuItemId" | "name" | "unitPrice" | "quantity" | "note" | "modifiers"
    >
  >;
  discountType: DiscountType;
  discountReference?: string;
  orderInstructions?: string;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  gcashReference?: string;
}

export interface OrderOperationalEditInput {
  customerName: string;
  contactNumber: string;
  tableNumber?: string;
  deliveryAddress?: string;
  orderInstructions?: string;
}

export interface CashierNavigationIntent {
  statuses?: OrderStatus[];
  orderTypes?: OrderType[];
  transactionStatuses?: TransactionStatus[];
  paymentMethods?: PaymentMethod[];
  today?: boolean;
  focusSearch?: boolean;
  openFirstReady?: boolean;
  openMostRecentReceipt?: boolean;
  search?: string;
}

export interface ShiftTotals {
  cashSales: number;
  gcashSales: number;
  refunds: number;
  cashRefunds: number;
  voids: number;
  discounts: number;
  transactionCount: number;
  ordersProcessed: number;
  expectedCash: number;
}

export interface ShiftClosureInput {
  actualCash: number;
  varianceReason?: string;
  notes?: string;
  managerName: string;
  managerApproved: boolean;
}
