import { supabase } from "@/lib/supabase";
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderTimelineEvent,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from "../types";

type DatabaseOrderStatus =
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

type DatabaseFulfillmentType =
  | "delivery"
  | "takeout"
  | "dine_in";

type DatabaseOrderChannel = "online" | "walk_in";

interface DatabaseOrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  processed_by: string | null;
  order_channel: DatabaseOrderChannel;
  fulfillment_type: DatabaseFulfillmentType;
  customer_name: string | null;
  customer_contact_number: string | null;
  delivery_address: string | null;
  landmark: string | null;
  current_status: DatabaseOrderStatus;
  subtotal: number | string;
  delivery_fee: number | string;
  grand_total: number | string;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface DatabaseOrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  special_instructions: string | null;
  created_at: string;
}

interface DatabaseOrderHistoryRow {
  id: string;
  order_id: string;
  status: DatabaseOrderStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Loads orders that the currently authenticated cashier/manager
 * is permitted to read through Supabase RLS.
 *
 * The returned records are converted into the existing cashier
 * Order model so the current cashier UI can be reused.
 */
interface ConfirmOrderResult {
  order_id: string;
  order_number: string;
  current_status: DatabaseOrderStatus;
  confirmed_at: string;
  processed_by: string;
}

interface ReleaseReadyOrderResult {
  order_id: string;
  order_number: string;
  previous_status: DatabaseOrderStatus;
  current_status: DatabaseOrderStatus;
}

interface OfferRiderResult {
  assignment_id: string;
  order_id: string;
  order_number: string;
  rider_id: string;
  assignment_status: "offered";
  assigned_at: string;
}

export async function confirmCashierOrder(
  databaseOrderId: string,
  notes?: string,
): Promise<ConfirmOrderResult> {
  const normalizedId = databaseOrderId.trim();

  if (!normalizedId) {
    throw new Error(
      "This order does not have a valid database ID.",
    );
  }

  const { data, error } = await supabase.rpc(
    "confirm_order",
    {
      p_order_id: normalizedId,
      p_notes: notes?.trim() || null,
    },
  );

  if (error) {
    throw new Error(
      `Unable to confirm order: ${error.message}`,
    );
  }

  const result = (
    data as ConfirmOrderResult[] | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The order was confirmed but no updated order record was returned.",
    );
  }

  return result;
}

export async function releaseReadyCashierOrder(
  databaseOrderId: string,
  notes?: string,
): Promise<ReleaseReadyOrderResult> {
  const normalizedId = databaseOrderId.trim();

  if (!normalizedId) {
    throw new Error(
      "This order does not have a valid database ID.",
    );
  }

  const { data, error } = await supabase.rpc(
    "release_ready_order",
    {
      p_order_id: normalizedId,
      p_notes: notes?.trim() || null,
    },
  );

  if (error) {
    throw new Error(
      `Unable to release ready order: ${error.message}`,
    );
  }

  const result = (
    data as ReleaseReadyOrderResult[] | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The order was released, but no updated order record was returned.",
    );
  }

  return result;
}

export async function offerOrderToNextRider(
  databaseOrderId: string,
): Promise<OfferRiderResult> {
  const normalizedId = databaseOrderId.trim();

  if (!normalizedId) {
    throw new Error(
      "This order does not have a valid database ID.",
    );
  }

  const { data, error } = await supabase.rpc(
    "offer_order_to_next_rider",
    {
      p_order_id: normalizedId,
    },
  );

  if (error) {
    throw new Error(
      `Unable to assign rider: ${error.message}`,
    );
  }

  const result = (
    data as OfferRiderResult[] | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The rider assignment was created, but no assignment record was returned.",
    );
  }

  return result;
}

export async function fetchCashierOrders(): Promise<Order[]> {
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_id,
      processed_by,
      order_channel,
      fulfillment_type,
      customer_name,
      customer_contact_number,
      delivery_address,
      landmark,
      current_status,
      subtotal,
      delivery_fee,
      grand_total,
      notes,
      confirmed_at,
      created_at,
      completed_at,
      cancelled_at
    `)
    .order("created_at", { ascending: false });

  if (orderError) {
    throw new Error(
      `Unable to load cashier orders: ${orderError.message}`,
    );
  }

  const orders = (orderData ?? []) as DatabaseOrderRow[];

  if (!orders.length) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);

  const [
    { data: itemData, error: itemError },
    { data: historyData, error: historyError },
  ] = await Promise.all([
    supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        menu_item_id,
        item_name,
        quantity,
        unit_price,
        line_total,
        special_instructions,
        created_at
      `)
      .in("order_id", orderIds)
      .order("created_at", { ascending: true }),

    supabase
      .from("order_status_history")
      .select(`
        id,
        order_id,
        status,
        changed_by,
        notes,
        created_at
      `)
      .in("order_id", orderIds)
      .order("created_at", { ascending: true }),
  ]);

  if (itemError) {
    throw new Error(
      `Unable to load cashier order items: ${itemError.message}`,
    );
  }

  if (historyError) {
    throw new Error(
      `Unable to load cashier order history: ${historyError.message}`,
    );
  }

  const items = (itemData ?? []) as DatabaseOrderItemRow[];
  const history =
    (historyData ?? []) as DatabaseOrderHistoryRow[];

  const itemsByOrder = groupItemsByOrder(items);
  const historyByOrder = groupHistoryByOrder(history);

  return orders.map((order) =>
    mapDatabaseOrderToCashierOrder(
      order,
      itemsByOrder.get(order.id) ?? [],
      historyByOrder.get(order.id) ?? [],
    ),
  );
}

function mapDatabaseOrderToCashierOrder(
  order: DatabaseOrderRow,
  items: DatabaseOrderItemRow[],
  history: DatabaseOrderHistoryRow[],
): Order {
  const mappedTimeline = history.map(mapTimelineEvent);

  const latestTimelineTimestamp =
    mappedTimeline[mappedTimeline.length - 1]?.timestamp;

  return {
    // Human-readable number used throughout the existing cashier UI.
    id: order.order_number,

    // Real PostgreSQL orders.id UUID used for RPC/database operations.
    databaseId: order.id,

    customerName:
      order.customer_name?.trim() || "Walk-in Customer",

    contactNumber:
      order.customer_contact_number?.trim() || "—",

    deliveryAddress:
      order.delivery_address?.trim() || undefined,

    type: mapFulfillmentType(order.fulfillment_type),

    items: items.map(mapOrderItem),

    subtotal: toNumber(order.subtotal),

    discountType: null,

    discountAmount: 0,

    taxAmount: 0,

    total: toNumber(order.grand_total),

    orderInstructions:
      order.notes?.trim() || undefined,

    paymentMethod: mapPaymentMethod(order.order_channel),

    paymentStatus: mapPaymentStatus(order.current_status),

    status: mapOrderStatus(order.current_status),

    riderStatus: mapRiderStatus(order.current_status),

    createdAt: order.created_at,

    updatedAt:
      latestTimelineTimestamp ??
      order.confirmed_at ??
      order.created_at,

    cashierId: order.processed_by ?? undefined,

    cancelledAt:
      order.cancelled_at ?? undefined,

    timeline: mappedTimeline,
  };
}

function mapOrderItem(
  item: DatabaseOrderItemRow,
): OrderItem {
  return {
    id: item.id,
    menuItemId: item.menu_item_id ?? "",
    name: item.item_name?.trim() || "Menu Item",
    unitPrice: toNumber(item.unit_price),
    quantity: item.quantity,
    note:
      item.special_instructions?.trim() || undefined,
  };
}

function mapTimelineEvent(
  history: DatabaseOrderHistoryRow,
): OrderTimelineEvent {
  return {
    id: history.id,
    status: mapOrderStatus(history.status),
    label:
      history.notes?.trim() ||
      getDefaultTimelineLabel(history.status),
    timestamp: history.created_at,
    actor: history.changed_by ? "Staff / Customer" : "System",
  };
}

function mapOrderStatus(
  status: DatabaseOrderStatus,
): OrderStatus {
  switch (status) {
    case "waiting_payment_verification":
      return "Awaiting Payment";

    case "confirmed":
      return "Confirmed";

    case "preparing":
      return "Preparing";

    case "ready":
      return "Ready";

    case "waiting_for_rider":
      return "Waiting for Rider";

    case "rider_accepted":
      return "Rider Accepted";

    case "picked_up":
      return "Picked Up";

    case "out_for_delivery":
      return "Out for Delivery";

    case "delivered":
      return "Delivered";

    case "completed":
      return "Completed";

    case "cancelled":
    case "rejected":
      return "Cancelled";

    default:
      return assertNever(status);
  }
}

function mapFulfillmentType(
  fulfillmentType: DatabaseFulfillmentType,
): OrderType {
  switch (fulfillmentType) {
    case "delivery":
      return "Delivery";

    case "takeout":
      return "Take-out";

    case "dine_in":
      return "Dine-in";

    default:
      return assertNever(fulfillmentType);
  }
}

function mapPaymentMethod(
  orderChannel: DatabaseOrderChannel,
): PaymentMethod {
  /*
   * Temporary compatibility mapping.
   *
   * Current online customer checkout is represented as GCash
   * in the existing cashier UI. This will be replaced when
   * PayMongo/payment records become the source of truth.
   */
  return orderChannel === "online" ? "GCash" : "Cash";
}

function mapPaymentStatus(
  status: DatabaseOrderStatus,
): PaymentStatus {
  if (status === "waiting_payment_verification") {
    return "Pending";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Verified";
}

function mapRiderStatus(
  status: DatabaseOrderStatus,
): string | undefined {
  switch (status) {
    case "waiting_for_rider":
      return "Waiting assignment";

    case "rider_accepted":
      return "Assigned";

    case "picked_up":
      return "Picked Up";

    case "out_for_delivery":
      return "Out for Delivery";

    case "delivered":
      return "Delivered";

    default:
      return undefined;
  }
}

function getDefaultTimelineLabel(
  status: DatabaseOrderStatus,
): string {
  switch (status) {
    case "waiting_payment_verification":
      return "Order created and waiting for payment verification";

    case "confirmed":
      return "Order confirmed";

    case "preparing":
      return "Kitchen started preparation";

    case "ready":
      return "Order is ready";

    case "waiting_for_rider":
      return "Waiting for rider assignment";

    case "rider_accepted":
      return "Rider accepted the delivery";

    case "picked_up":
      return "Order picked up";

    case "out_for_delivery":
      return "Order is out for delivery";

    case "delivered":
      return "Order delivered";

    case "completed":
      return "Order completed";

    case "cancelled":
      return "Order cancelled";

    case "rejected":
      return "Order rejected";

    default:
      return assertNever(status);
  }
}

function groupItemsByOrder(
  items: DatabaseOrderItemRow[],
): Map<string, DatabaseOrderItemRow[]> {
  const grouped = new Map<
    string,
    DatabaseOrderItemRow[]
  >();

  for (const item of items) {
    const current = grouped.get(item.order_id) ?? [];
    current.push(item);
    grouped.set(item.order_id, current);
  }

  return grouped;
}

function groupHistoryByOrder(
  history: DatabaseOrderHistoryRow[],
): Map<string, DatabaseOrderHistoryRow[]> {
  const grouped = new Map<
    string,
    DatabaseOrderHistoryRow[]
  >();

  for (const entry of history) {
    const current = grouped.get(entry.order_id) ?? [];
    current.push(entry);
    grouped.set(entry.order_id, current);
  }

  return grouped;
}

function toNumber(value: number | string): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported database value: ${String(value)}`);
}