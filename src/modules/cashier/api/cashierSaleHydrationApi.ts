import { supabase } from "@/lib/supabase";

import type {
  DiscountType,
  Order,
  OrderItemModifier,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Transaction,
  TransactionStatus,
} from "../types";

interface DatabaseOrder {
  id: string;
  order_number: string;
  processed_by: string | null;
  order_channel: "online" | "walk_in";
  fulfillment_type: "dine_in" | "takeout" | "delivery";
  customer_name: string | null;
  customer_contact_number: string | null;
  delivery_address: string | null;
  landmark: string | null;
  table_number: string | null;
  current_status:
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
  subtotal: number | string;
  discount_type: string | null;
  discount_reference: string | null;
  discount_amount: number | string;
  tax_amount: number | string;
  grand_total: number | string;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface DatabaseOrderItem {
  id: string;
  menu_item_id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  special_instructions: string | null;
  modifiers: unknown;
  created_at: string;
}

interface DatabasePayment {
  id: string;
  order_id: string;
  payment_method: "cash" | "gcash";
  amount: number | string;
  gcash_reference_number: string | null;
  proof_image_path: string | null;
  status: "pending" | "verified" | "rejected" | "voided";
  cash_received: number | string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface DatabaseTransaction {
  id: string;
  transaction_number: string;
  receipt_number: string;
  order_id: string;
  payment_id: string;
  shift_id: string;
  cashier_id: string;
  status: "completed" | "voided";
  void_reason: string | null;
  voided_at: string | null;
  request_id: string;
  created_at: string;
}

interface DatabaseHistoryEntry {
  id: string;
  status: DatabaseOrder["current_status"];
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

interface DatabaseCashierSale {
  order: DatabaseOrder;
  items: DatabaseOrderItem[];
  payment: DatabasePayment;
  transaction: DatabaseTransaction;
  history: DatabaseHistoryEntry[];
}

export interface HydratedCashierSale {
  order: Order;
  payment: Payment;
  transaction: Transaction;
}

function toNumber(
  value: number | string,
  fieldName: string,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `The server returned an invalid ${fieldName}.`,
    );
  }

  return parsed;
}

function mapPaymentMethod(
  method: DatabasePayment["payment_method"],
): PaymentMethod {
  return method === "cash" ? "Cash" : "GCash";
}

function mapPaymentStatus(
  status: DatabasePayment["status"],
): PaymentStatus {
  switch (status) {
    case "pending":
      return "Pending";

    case "verified":
      return "Verified";

    case "rejected":
      return "Rejected";

    case "voided":
      throw new Error(
        "The completed sale returned a voided payment.",
      );
  }
}

function mapTransactionStatus(
  status: DatabaseTransaction["status"],
): TransactionStatus {
  return status === "completed"
    ? "Completed"
    : "Voided";
}

function mapOrderStatus(
  status: DatabaseOrder["current_status"],
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
  }
}

function mapDiscountType(
  value: string | null,
): DiscountType {
  if (
    value === "Senior Citizen" ||
    value === "PWD"
  ) {
    return value;
  }

  return null;
}

function mapModifiers(
  value: unknown,
): OrderItemModifier[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const modifiers: OrderItemModifier[] = [];

  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null
    ) {
      continue;
    }

    const modifier =
      entry as Record<string, unknown>;

    if (
      typeof modifier.id !== "string" ||
      typeof modifier.name !== "string"
    ) {
      continue;
    }

    const price = Number(modifier.price);

    if (!Number.isFinite(price)) {
      continue;
    }

    modifiers.push({
      id: modifier.id,
      name: modifier.name,
      price,
    });
  }

  return modifiers.length
    ? modifiers
    : undefined;
}

function validateDatabaseCashierSale(
  value: unknown,
): DatabaseCashierSale {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "The server returned an invalid cashier sale.",
    );
  }

  const sale =
    value as DatabaseCashierSale;

  if (
    !sale.order ||
    !sale.payment ||
    !sale.transaction ||
    !Array.isArray(sale.items) ||
    !Array.isArray(sale.history)
  ) {
    throw new Error(
      "The server returned an incomplete cashier sale.",
    );
  }

  return sale;
}

function mapFulfillmentType(
  fulfillmentType: DatabaseOrder["fulfillment_type"],
): Order["type"] {
  switch (fulfillmentType) {
    case "dine_in":
      return "Dine-in";

    case "takeout":
      return "Take-out";

    case "delivery":
      return "Delivery";
  }
}

export function mapDatabaseCashierSale(
  saleValue: unknown,
  cashierName: string,
): HydratedCashierSale {
  const sale = validateDatabaseCashierSale(saleValue);

  const paymentMethod =
    mapPaymentMethod(
      sale.payment.payment_method,
    );

  const paymentStatus =
    mapPaymentStatus(
      sale.payment.status,
    );

  const discountAmount =
    toNumber(
      sale.order.discount_amount,
      "discount amount",
    );

  const grandTotal =
    toNumber(
      sale.order.grand_total,
      "grand total",
    );

  const paymentAmount =
    toNumber(
      sale.payment.amount,
      "payment amount",
    );

  const cashReceived =
    sale.payment.cash_received === null
      ? undefined
      : toNumber(
          sale.payment.cash_received,
          "cash received",
        );

  const latestHistoryTimestamp =
    sale.history[
      sale.history.length - 1
    ]?.created_at;

  const orderType = mapFulfillmentType(
    sale.order.fulfillment_type,
  );

  const order: Order = {
    id:
      sale.order.order_number,

    databaseId:
      sale.order.id,

    customerName:
      sale.order.customer_name?.trim() ||
      "Customer",

    contactNumber:
      sale.order.customer_contact_number?.trim() ||
      "—",

    orderChannel:
      sale.order.order_channel,

    deliveryAddress:
      sale.order.delivery_address?.trim() ||
      undefined,

    landmark:
      sale.order.landmark?.trim() ||
      undefined,

    type:
      orderType,

    tableNumber:
      orderType === "Delivery"
        ? undefined
        : sale.order.table_number?.trim() ||
          undefined,

    items:
      sale.items.map((item) => ({
        id:
          item.id,

        menuItemId:
          item.menu_item_id,

        name:
          item.item_name?.trim() ||
          "Menu Item",

        unitPrice:
          toNumber(
            item.unit_price,
            "item unit price",
          ),

        quantity:
          item.quantity,

        note:
          item.special_instructions?.trim() ||
          undefined,

        modifiers:
          mapModifiers(
            item.modifiers,
          ),
      })),

    subtotal:
      toNumber(
        sale.order.subtotal,
        "subtotal",
      ),

    discountType:
      mapDiscountType(
        sale.order.discount_type,
      ),

    discountReference:
      sale.order.discount_reference?.trim() ||
      undefined,

    discountAmount,

    taxAmount:
      toNumber(
        sale.order.tax_amount,
        "tax amount",
      ),

    total:
      grandTotal,

    orderInstructions:
      sale.order.notes?.trim() ||
      undefined,

    paymentId:
      sale.payment.id,

    transactionId:
      sale.transaction.id,

    paymentMethod,

    paymentStatus,

    status:
      mapOrderStatus(
        sale.order.current_status,
      ),

    createdAt:
      sale.order.created_at,

    updatedAt:
      latestHistoryTimestamp ??
      sale.order.confirmed_at ??
      sale.order.created_at,

    cashierId:
      sale.transaction.cashier_id,

    shiftId:
      sale.transaction.shift_id,

    timeline:
      sale.history.map((entry) => ({
        id:
          entry.id,

        status:
          mapOrderStatus(
            entry.status,
          ),

        label:
          entry.notes?.trim() ||
          "Order status updated",

        timestamp:
          entry.created_at,

        actor:
          entry.changed_by
            ? "Staff / Customer"
            : "System",
      })),
  };

  const payment: Payment = {
    id:
      sale.payment.id,

    orderId:
      sale.order.order_number,

    method:
      paymentMethod,

    amount:
      paymentAmount,

    submittedAmount:
      paymentMethod === "Cash"
        ? cashReceived ?? paymentAmount
        : paymentAmount,

    status:
      paymentStatus,

    referenceNumber:
      sale.payment.gcash_reference_number?.trim() ||
      undefined,

    proofImagePath:
      sale.payment.proof_image_path?.trim() ||
      undefined,

    uploadedAt:
      sale.payment.created_at,

    verifiedBy:
      sale.payment.verified_by ??
      undefined,

    verifiedAt:
      sale.payment.verified_at ??
      undefined,

    rejectionReason:
      sale.payment.rejection_reason?.trim() ||
      undefined,

    updatedAt:
      sale.payment.updated_at,
  };

  const transaction: Transaction = {
    id:
      sale.transaction.id,

    transactionNumber:
      sale.transaction.transaction_number,

    receiptNumber:
      sale.transaction.receipt_number,

    orderId:
      sale.order.order_number,

    customerName:
      order.customerName,

    amount:
      grandTotal,

    discountAmount,

    method:
      paymentMethod,

    status:
      mapTransactionStatus(
        sale.transaction.status,
      ),

    cashierId:
      sale.transaction.cashier_id,

    cashierName,

    shiftId:
      sale.transaction.shift_id,

    paymentId:
      sale.payment.id,

    createdAt:
      sale.transaction.created_at,

    voidReason:
      sale.transaction.void_reason?.trim() ||
      undefined,
  };

  return {
    order,
    payment,
    transaction,
  };
}

export async function fetchCashierSale(
  databaseOrderId: string,
  cashierName: string,
): Promise<HydratedCashierSale> {
  const { data, error } =
    await supabase.rpc(
      "get_cashier_sale",
      {
        p_order_id:
          databaseOrderId,
      },
    );

  if (error) {
    throw new Error(error.message);
  }

  return mapDatabaseCashierSale(
    data,
    cashierName,
  );
}

export async function fetchCurrentShiftCashierSales(
  cashierName: string,
): Promise<HydratedCashierSale[]> {
  const { data, error } = await supabase.rpc(
    "get_current_shift_cashier_sales",
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The server returned an invalid current-shift cashier sale list.",
    );
  }

  return data.map((sale) =>
    mapDatabaseCashierSale(
      sale,
      cashierName,
    ),
  );
}
