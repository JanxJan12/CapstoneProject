import { supabase } from "@/lib/supabase";

export type ManagerOrderChannel = "online" | "walk_in";
export type ManagerFulfillmentType = "delivery" | "takeout" | "dine_in";
export type ManagerOrderStatus =
  | "waiting_payment_verification"
  | "confirmed"
  | "preparing"
  | "ready"
  | "waiting_for_rider"
  | "rider_accepted"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"
  | "rejected";
export type ManagerPaymentMethod = "gcash" | "cash";
export type ManagerPaymentStatus =
  "pending" | "verified" | "rejected" | "voided";

export interface ManagerOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ManagerOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerContactNumber: string | null;
  deliveryAddress: string | null;
  orderChannel: ManagerOrderChannel;
  fulfillmentType: ManagerFulfillmentType;
  currentStatus: ManagerOrderStatus;
  grandTotal: number;
  createdAt: string;
  paymentMethod: ManagerPaymentMethod | null;
  paymentStatus: ManagerPaymentStatus | null;
  paymentAmount: number | null;
  riderName: string | null;
  items: ManagerOrderItem[];
}

export interface ManagerDailySale {
  date: string;
  day: string;
  sales: number;
}

export interface ManagerRecentOrder {
  orderNumber: string;
  customerName: string;
  grandTotal: number;
  currentStatus: ManagerOrderStatus;
}

export interface ManagerOrderStatusCount {
  status: ManagerOrderStatus;
  count: number;
}

export interface ManagerDashboardData {
  salesToday: number;
  ordersToday: number;
  pendingPayments: number;
  lowStockCount: number;
  recentOrders: ManagerRecentOrder[];
  orderStatusCounts: ManagerOrderStatusCount[];
  dailySales: ManagerDailySale[];
}

export interface ManagerSalesReport {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topItemName: string | null;
  dailySales: ManagerDailySale[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_IN_MILLISECONDS = 86_400_000;

const ORDER_CHANNELS = new Set<ManagerOrderChannel>(["online", "walk_in"]);
const FULFILLMENT_TYPES = new Set<ManagerFulfillmentType>([
  "delivery",
  "takeout",
  "dine_in",
]);
const ORDER_STATUSES = new Set<ManagerOrderStatus>([
  "waiting_payment_verification",
  "confirmed",
  "preparing",
  "ready",
  "waiting_for_rider",
  "rider_accepted",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "rejected",
]);
const PAYMENT_METHODS = new Set<ManagerPaymentMethod>(["gcash", "cash"]);
const PAYMENT_STATUSES = new Set<ManagerPaymentStatus>([
  "pending",
  "verified",
  "rejected",
  "voided",
]);

function requireRecord(
  value: unknown,
  recordName: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${recordName}.`);
  }

  return value as Record<string, unknown>;
}

function requireArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value.trim();
}

function optionalString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value.trim() || null;
}

function requireUuid(value: unknown, fieldName: string): string {
  const uuid = requireString(value, fieldName);

  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return uuid;
}

function requireNumber(value: unknown, fieldName: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requireNonNegativeNumber(value: unknown, fieldName: string): number {
  const number = requireNumber(value, fieldName);

  if (number < 0) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function optionalNonNegativeNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return requireNonNegativeNumber(value, fieldName);
}

function requireNonNegativeInteger(value: unknown, fieldName: string): number {
  const number = requireNonNegativeNumber(value, fieldName);

  if (!Number.isSafeInteger(number)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requirePositiveInteger(value: unknown, fieldName: string): number {
  const number = requireNonNegativeInteger(value, fieldName);

  if (number < 1) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requireTimestamp(value: unknown, fieldName: string): string {
  const timestamp = requireString(value, fieldName);

  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return timestamp;
}

function requireDate(value: unknown, fieldName: string): string {
  const date = requireString(value, fieldName);
  const parsed = parseDateInput(date, fieldName);

  return parsed.value;
}

function requireEnum<T extends string>(
  value: unknown,
  allowedValues: Set<T>,
  fieldName: string,
): T {
  if (typeof value !== "string" || !allowedValues.has(value as T)) {
    throw new Error(`The server returned an unsupported ${fieldName}.`);
  }

  return value as T;
}

function optionalEnum<T extends string>(
  value: unknown,
  allowedValues: Set<T>,
  fieldName: string,
): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return requireEnum(value, allowedValues, fieldName);
}

function parseDateInput(
  value: string,
  fieldName: string,
): { value: string; timestamp: number } {
  const normalized = value.trim();

  if (!DATE_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return { value: normalized, timestamp };
}

function mapOrderItem(value: unknown): ManagerOrderItem {
  const row = requireRecord(value, "manager order item");

  return {
    name: requireString(row.name, "order item name"),
    quantity: requirePositiveInteger(row.qty, "order item quantity"),
    unitPrice: requireNonNegativeNumber(
      row.unit_price,
      "order item unit price",
    ),
    lineTotal: requireNonNegativeNumber(
      row.line_total,
      "order item line total",
    ),
  };
}

function mapManagerOrder(value: unknown): ManagerOrder {
  const row = requireRecord(value, "manager order");
  const paymentMethod = optionalEnum(
    row.payment_method,
    PAYMENT_METHODS,
    "payment method",
  );
  const paymentStatus = optionalEnum(
    row.payment_status,
    PAYMENT_STATUSES,
    "payment status",
  );
  const paymentAmount = optionalNonNegativeNumber(
    row.payment_amount,
    "payment amount",
  );

  if (
    (paymentMethod === null) !== (paymentStatus === null) ||
    (paymentMethod === null) !== (paymentAmount === null)
  ) {
    throw new Error("The server returned an incomplete order payment record.");
  }

  return {
    id: requireUuid(row.id, "order ID"),
    orderNumber: requireString(row.order_number, "order number"),
    customerName: requireString(row.customer_name, "customer name"),
    customerContactNumber: optionalString(
      row.customer_contact_number,
      "customer contact number",
    ),
    deliveryAddress: optionalString(row.delivery_address, "delivery address"),
    orderChannel: requireEnum(
      row.order_channel,
      ORDER_CHANNELS,
      "order channel",
    ),
    fulfillmentType: requireEnum(
      row.fulfillment_type,
      FULFILLMENT_TYPES,
      "fulfillment type",
    ),
    currentStatus: requireEnum(
      row.current_status,
      ORDER_STATUSES,
      "order status",
    ),
    grandTotal: requireNonNegativeNumber(row.grand_total, "order total"),
    createdAt: requireTimestamp(row.created_at, "order creation date"),
    paymentMethod,
    paymentStatus,
    paymentAmount,
    riderName: optionalString(row.rider_name, "rider name"),
    items: requireArray(row.items, "order items").map(mapOrderItem),
  };
}

function mapDailySale(value: unknown): ManagerDailySale {
  const row = requireRecord(value, "daily sale");

  return {
    date: requireDate(row.date, "daily sale date"),
    day: requireString(row.day, "daily sale label"),
    sales: requireNonNegativeNumber(row.sales, "daily sales amount"),
  };
}

function mapRecentOrder(value: unknown): ManagerRecentOrder {
  const row = requireRecord(value, "recent order");

  return {
    orderNumber: requireString(row.order_number, "recent order number"),
    customerName: requireString(row.customer_name, "recent order customer"),
    grandTotal: requireNonNegativeNumber(row.grand_total, "recent order total"),
    currentStatus: requireEnum(
      row.current_status,
      ORDER_STATUSES,
      "recent order status",
    ),
  };
}

function mapOrderStatusCount(value: unknown): ManagerOrderStatusCount {
  const row = requireRecord(value, "order status count");

  return {
    status: requireEnum(row.status, ORDER_STATUSES, "order status"),
    count: requireNonNegativeInteger(row.count, "order status count"),
  };
}

function mapManagerDashboard(value: unknown): ManagerDashboardData {
  const row = requireRecord(value, "manager dashboard");

  return {
    salesToday: requireNonNegativeNumber(row.sales_today, "sales today"),
    ordersToday: requireNonNegativeInteger(row.orders_today, "orders today"),
    pendingPayments: requireNonNegativeInteger(
      row.pending_payments,
      "pending payments",
    ),
    lowStockCount: requireNonNegativeInteger(
      row.low_stock_count,
      "low stock count",
    ),
    recentOrders: requireArray(row.recent_orders, "recent orders").map(
      mapRecentOrder,
    ),
    orderStatusCounts: requireArray(
      row.order_status_counts,
      "order status counts",
    ).map(mapOrderStatusCount),
    dailySales: requireArray(row.daily_sales, "daily sales").map(mapDailySale),
  };
}

function mapManagerSalesReport(value: unknown): ManagerSalesReport {
  const row = requireRecord(value, "manager sales report");

  return {
    totalRevenue: requireNonNegativeNumber(row.total_revenue, "total revenue"),
    totalOrders: requireNonNegativeInteger(row.total_orders, "total orders"),
    averageOrderValue: requireNonNegativeNumber(
      row.average_order_value,
      "average order value",
    ),
    topItemName: optionalString(row.top_item_name, "top item name"),
    dailySales: requireArray(row.daily_sales, "daily sales").map(mapDailySale),
  };
}

export async function getManagerOrders(limit = 100): Promise<ManagerOrder[]> {
  if (!Number.isFinite(limit)) {
    throw new Error("Manager order limit must be a valid number.");
  }

  const normalizedLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
  const { data, error } = await supabase.rpc("get_manager_orders", {
    p_limit: normalizedLimit,
  });

  if (error) {
    throw new Error(`Unable to load manager orders: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid manager order list.");
  }

  return data.map(mapManagerOrder);
}

export async function getManagerDashboard(): Promise<ManagerDashboardData> {
  const { data, error } = await supabase.rpc("get_manager_dashboard");

  if (error) {
    throw new Error(`Unable to load manager dashboard: ${error.message}`);
  }

  return mapManagerDashboard(data);
}

export async function getManagerSalesReport(
  startDate: string,
  endDate: string,
): Promise<ManagerSalesReport> {
  const start = parseDateInput(startDate, "Start date");
  const end = parseDateInput(endDate, "End date");

  if (end.timestamp < start.timestamp) {
    throw new Error("End date must be on or after start date.");
  }

  if ((end.timestamp - start.timestamp) / DAY_IN_MILLISECONDS > 365) {
    throw new Error("Report date range must not exceed 366 calendar days.");
  }

  const { data, error } = await supabase.rpc("get_manager_sales_report", {
    p_start_date: start.value,
    p_end_date: end.value,
  });

  if (error) {
    throw new Error(`Unable to load manager sales report: ${error.message}`);
  }

  return mapManagerSalesReport(data);
}
