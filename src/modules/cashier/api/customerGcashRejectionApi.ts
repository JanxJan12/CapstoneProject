import { supabase } from "@/lib/supabase";
import { PAYMENT_REJECTION_REASONS } from "../constants";

interface DatabaseRejectionResult {
  database_order_id: unknown;
  order_number: unknown;
  payment_id: unknown;
  payment_status: unknown;
  order_status: unknown;
  rejection_reason: unknown;
  rejection_notes: unknown;
  rejected_by: unknown;
  rejected_at: unknown;
  updated_at: unknown;
}

export interface CustomerGcashRejectionResult {
  databaseOrderId: string;
  orderNumber: string;
  paymentId: string;
  paymentStatus: "rejected";
  orderStatus: "waiting_payment_verification";
  rejectionReason: string;
  rejectionNotes?: string;
  rejectedBy: string;
  rejectedAt: string;
  updatedAt: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_PATTERN = /^ORD-\d{6}$/;

function requireRecord(
  value: unknown,
): DatabaseRejectionResult {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "The server returned an invalid GCash rejection result.",
    );
  }

  return value as DatabaseRejectionResult;
}

function requireString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `The server returned an invalid ${fieldName}.`,
    );
  }

  return value.trim();
}

function optionalString(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(
      `The server returned an invalid ${fieldName}.`,
    );
  }

  return value.trim() || undefined;
}

function requireUuid(
  value: unknown,
  fieldName: string,
): string {
  const uuid = requireString(value, fieldName);

  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(
      `The server returned an invalid ${fieldName}.`,
    );
  }

  return uuid;
}

function requireTimestamp(
  value: unknown,
  fieldName: string,
): string {
  const timestamp = requireString(value, fieldName);

  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(
      `The server returned an invalid ${fieldName}.`,
    );
  }

  return timestamp;
}

function isAllowedReason(
  value: string,
): value is (typeof PAYMENT_REJECTION_REASONS)[number] {
  return PAYMENT_REJECTION_REASONS.some(
    (reason) => reason === value,
  );
}

function mapRejectionResult(
  value: unknown,
  expectedPaymentId: string,
  expectedReason: string,
  expectedNotes: string | undefined,
): CustomerGcashRejectionResult {
  const row = requireRecord(value);
  const databaseOrderId = requireUuid(
    row.database_order_id,
    "database order ID",
  );
  const orderNumber = requireString(
    row.order_number,
    "order number",
  );
  const paymentId = requireUuid(
    row.payment_id,
    "payment ID",
  );
  const rejectionReason = requireString(
    row.rejection_reason,
    "payment rejection reason",
  );
  const rejectionNotes = optionalString(
    row.rejection_notes,
    "payment rejection notes",
  );
  const rejectedAt = requireTimestamp(
    row.rejected_at,
    "payment rejection timestamp",
  );
  const updatedAt = requireTimestamp(
    row.updated_at,
    "payment update timestamp",
  );

  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    throw new Error(
      "The server returned an invalid order number.",
    );
  }

  if (paymentId !== expectedPaymentId) {
    throw new Error(
      "The server returned a different payment from the rejection request.",
    );
  }

  if (!isAllowedReason(rejectionReason)) {
    throw new Error(
      "The server returned an unsupported payment rejection reason.",
    );
  }

  if (
    rejectionReason !== expectedReason ||
    rejectionNotes !== expectedNotes
  ) {
    throw new Error(
      "The server returned different rejection details from the request.",
    );
  }

  if (row.payment_status !== "rejected") {
    throw new Error(
      "The server did not return a rejected payment status.",
    );
  }

  if (row.order_status !== "waiting_payment_verification") {
    throw new Error(
      "The payment rejection changed the order status unexpectedly.",
    );
  }

  if (rejectedAt !== updatedAt) {
    throw new Error(
      "The server returned inconsistent rejection timestamps.",
    );
  }

  return {
    databaseOrderId,
    orderNumber,
    paymentId,
    paymentStatus: "rejected",
    orderStatus: "waiting_payment_verification",
    rejectionReason,
    rejectionNotes,
    rejectedBy: requireUuid(
      row.rejected_by,
      "rejecting cashier ID",
    ),
    rejectedAt,
    updatedAt,
  };
}

export async function rejectCustomerGcashPayment(
  paymentId: string,
  reason: string,
  notes?: string,
): Promise<CustomerGcashRejectionResult> {
  const normalizedPaymentId = paymentId.trim();
  const normalizedReason = reason.trim();
  const normalizedNotes = notes?.trim() || undefined;

  if (!UUID_PATTERN.test(normalizedPaymentId)) {
    throw new Error("A valid payment ID is required.");
  }

  if (!isAllowedReason(normalizedReason)) {
    throw new Error(
      "Select a valid customer GCash rejection reason.",
    );
  }

  if (normalizedReason === "Other" && !normalizedNotes) {
    throw new Error(
      "Rejection notes are required when the reason is Other.",
    );
  }

  if (normalizedNotes && normalizedNotes.length > 300) {
    throw new Error(
      "Rejection notes must be 300 characters or fewer.",
    );
  }

  const { data, error } = await supabase.rpc(
    "reject_customer_gcash_payment",
    {
      p_payment_id: normalizedPaymentId,
      p_reason: normalizedReason,
      p_notes: normalizedNotes ?? null,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(
      "The server returned an invalid GCash rejection result.",
    );
  }

  return mapRejectionResult(
    data[0],
    normalizedPaymentId,
    normalizedReason,
    normalizedNotes,
  );
}
