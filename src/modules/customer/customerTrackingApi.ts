import { supabase } from "@/lib/supabase";
import { customerErrorMessage } from "./customerBatch1";

export interface CustomerTrackingOrderRow {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_type: string;
  grand_total: number | string;
  subtotal: number | string | null;
  delivery_fee: number | string | null;
  tax_amount: number | string | null;
  created_at: string;
}

export interface CustomerTrackingHistoryRow {
  status: string;
  notes: string | null;
  created_at: string;
}

export interface CustomerTrackingPaymentRow {
  payment_id: string;
  order_id: string;
  amount: number;
  payment_method: "gcash";
  gcash_reference_number: string;
  payment_status: "pending" | "verified" | "rejected" | "voided";
  rejection_reason: string | null;
  rejection_notes: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

const CUSTOMER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidServerTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function parseCustomerTrackingPayment(
  value: unknown,
  expectedOrderId: string,
): CustomerTrackingPaymentRow {
  if (!value || typeof value !== "object") {
    throw new Error("The server returned an invalid payment record.");
  }

  const row = value as Record<string, unknown>;
  const amount = Number(row.amount);
  const paymentStatus = row.payment_status;
  const rejectionReason = row.rejection_reason;
  const rejectionNotes = row.rejection_notes;
  const rejectedAt = row.rejected_at;

  if (
    typeof row.payment_id !== "string" ||
    !CUSTOMER_UUID_PATTERN.test(row.payment_id) ||
    row.order_id !== expectedOrderId ||
    row.payment_method !== "gcash" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    typeof row.gcash_reference_number !== "string" ||
    row.gcash_reference_number.trim().length === 0 ||
    !["pending", "verified", "rejected", "voided"].includes(
      String(paymentStatus),
    ) ||
    (rejectionReason !== null &&
      typeof rejectionReason !== "string") ||
    (rejectionNotes !== null &&
      typeof rejectionNotes !== "string") ||
    (rejectedAt !== null && !isValidServerTimestamp(rejectedAt)) ||
    !isValidServerTimestamp(row.created_at) ||
    !isValidServerTimestamp(row.updated_at)
  ) {
    throw new Error("The server returned malformed payment data.");
  }

  if (
    paymentStatus === "rejected" &&
    (typeof rejectionReason !== "string" ||
      rejectionReason.trim().length === 0 ||
      !isValidServerTimestamp(rejectedAt))
  ) {
    throw new Error("The rejected payment record is incomplete.");
  }

  return {
    payment_id: row.payment_id,
    order_id: expectedOrderId,
    amount,
    payment_method: "gcash",
    gcash_reference_number: row.gcash_reference_number.trim(),
    payment_status: paymentStatus as CustomerTrackingPaymentRow["payment_status"],
    rejection_reason:
      typeof rejectionReason === "string"
        ? rejectionReason.trim()
        : null,
    rejection_notes:
      typeof rejectionNotes === "string" && rejectionNotes.trim()
        ? rejectionNotes.trim()
        : null,
    rejected_at: rejectedAt as string | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchCustomerTrackingPayment(
  orderId: string,
): Promise<CustomerTrackingPaymentRow | null> {
  const { data, error } = await supabase.rpc(
    "get_customer_order_payment",
    { p_order_id: orderId },
  );

  if (error) {
    throw new Error(customerErrorMessage(error, "tracking"));
  }

  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid payment response.");
  }

  if (data.length === 0) {
    return null;
  }

  if (data.length !== 1) {
    throw new Error("The server returned multiple payments for one order.");
  }

  return parseCustomerTrackingPayment(data[0], orderId);
}
