import { supabase } from "@/lib/supabase";

import type {
  WalkInOrderInput,
} from "../types";

export interface WalkInSaleResult {
  orderId: string;
  orderNumber: string;

  transactionId: string;
  transactionNumber: string;
  receiptNumber: string;

  paymentId: string;
  shiftId: string;

  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;

  paymentMethod: "Cash" | "GCash";
  cashReceived?: number;
  changeDue?: number;

  status: "Confirmed";
  createdAt: string;
}

interface DatabaseWalkInSaleRow {
  order_id: string;
  order_number: string;

  transaction_id: string;
  transaction_number: string;
  receipt_number: string;

  payment_id: string;
  shift_id: string;

  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  grand_total: number | string;

  payment_method: "cash" | "gcash";

  cash_received:
    | number
    | string
    | null;

  change_due:
    | number
    | string
    | null;

  current_status: "confirmed";
  created_at: string;
}

function mapFulfillmentType(
  type: WalkInOrderInput["type"],
): "dine_in" | "takeout" {
  if (type === "Dine-in") {
    return "dine_in";
  }

  if (type === "Take-out") {
    return "takeout";
  }

  throw new Error(
    "Walk-in POS supports only Dine-in or Take-out orders.",
  );
}

function mapPaymentMethod(
  method: WalkInOrderInput["paymentMethod"],
): "cash" | "gcash" {
  return method === "Cash"
    ? "cash"
    : "gcash";
}

function parseRequiredNumber(
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

function parseOptionalNumber(
  value: number | string | null,
  fieldName: string,
): number | undefined {
  if (value === null) {
    return undefined;
  }

  return parseRequiredNumber(
    value,
    fieldName,
  );
}

export async function createWalkInSale(
  requestId: string,
  input: WalkInOrderInput,
): Promise<WalkInSaleResult> {
  const fulfillmentType =
    mapFulfillmentType(input.type);

  const paymentMethod =
    mapPaymentMethod(
      input.paymentMethod,
    );

  const items = input.items.map(
    (item) => ({
      menu_item_id:
        item.menuItemId,

      quantity:
        item.quantity,

      modifier_ids:
        item.modifiers?.map(
          (modifier) => modifier.id,
        ) ?? [],

      note:
        item.note?.trim() || null,
    }),
  );

  const { data, error } =
    await supabase.rpc(
      "create_walk_in_sale",
      {
        p_request_id:
          requestId,

        p_fulfillment_type:
          fulfillmentType,

        p_customer_name:
          input.customerName?.trim() ||
          null,

        p_contact_number:
          input.contactNumber?.trim() ||
          null,

        p_table_number:
          fulfillmentType === "dine_in"
            ? input.tableNumber?.trim() ||
              null
            : null,

        p_discount_type:
          input.discountType,

        p_discount_reference:
          input.discountReference?.trim() ||
          null,

        p_order_instructions:
          input.orderInstructions?.trim() ||
          null,

        p_payment_method:
          paymentMethod,

        p_cash_received:
          paymentMethod === "cash"
            ? input.amountTendered ??
              null
            : null,

        p_gcash_reference_number:
          paymentMethod === "gcash"
            ? input.gcashReference?.trim() ||
              null
            : null,

        p_items:
          items,
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  const rows =
    (data ?? []) as DatabaseWalkInSaleRow[];

  const row = rows[0];

  if (!row) {
    throw new Error(
      "The sale was created but no sale record was returned.",
    );
  }

  if (
    row.current_status !==
    "confirmed"
  ) {
    throw new Error(
      "The server did not return a confirmed walk-in order.",
    );
  }

  return {
    orderId:
      row.order_id,

    orderNumber:
      row.order_number,

    transactionId:
      row.transaction_id,

    transactionNumber:
      row.transaction_number,

    receiptNumber:
      row.receipt_number,

    paymentId:
      row.payment_id,

    shiftId:
      row.shift_id,

    subtotal:
      parseRequiredNumber(
        row.subtotal,
        "subtotal",
      ),

    discountAmount:
      parseRequiredNumber(
        row.discount_amount,
        "discount amount",
      ),

    taxAmount:
      parseRequiredNumber(
        row.tax_amount,
        "tax amount",
      ),

    grandTotal:
      parseRequiredNumber(
        row.grand_total,
        "grand total",
      ),

    paymentMethod:
      row.payment_method ===
      "cash"
        ? "Cash"
        : "GCash",

    cashReceived:
      parseOptionalNumber(
        row.cash_received,
        "cash received",
      ),

    changeDue:
      parseOptionalNumber(
        row.change_due,
        "change due",
      ),

    status:
      "Confirmed",

    createdAt:
      row.created_at,
  };
}