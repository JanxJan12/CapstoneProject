import { supabase } from "@/lib/supabase";

import type {
  Payment,
  PaymentStatus,
} from "../types";

interface DatabaseOnlinePaymentRow {
  payment_id: unknown;
  database_order_id: unknown;
  order_number: unknown;
  amount: unknown;
  payment_method: unknown;
  gcash_reference_number: unknown;
  proof_image_path: unknown;
  payment_status: unknown;
  verified_by: unknown;
  verified_at: unknown;
  rejection_reason: unknown;
  rejection_notes: unknown;
  rejected_by: unknown;
  rejected_at: unknown;
  payment_created_at: unknown;
  payment_updated_at: unknown;
}

export interface HydratedOnlinePayment {
  databaseOrderId: string;
  payment: Payment;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_PATTERN = /^ORD-\d{6}$/;

function requireRecord(
  value: unknown,
): DatabaseOnlinePaymentRow {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "The server returned an invalid online payment record.",
    );
  }

  return value as DatabaseOnlinePaymentRow;
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

function optionalUuid(
  value: unknown,
  fieldName: string,
): string | undefined {
  const uuid = optionalString(value, fieldName);

  if (uuid && !UUID_PATTERN.test(uuid)) {
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

function optionalTimestamp(
  value: unknown,
  fieldName: string,
): string | undefined {
  const timestamp = optionalString(value, fieldName);

  if (timestamp && Number.isNaN(Date.parse(timestamp))) {
    throw new Error(
      `The server returned an invalid ${fieldName}.`,
    );
  }

  return timestamp;
}

function mapPaymentStatus(
  value: unknown,
): PaymentStatus {
  switch (value) {
    case "pending":
      return "Pending";

    case "verified":
      return "Verified";

    case "rejected":
      return "Rejected";

    default:
      throw new Error(
        "The server returned an unsupported online payment status.",
      );
  }
}

function mapOnlinePayment(
  value: unknown,
): HydratedOnlinePayment {
  const row = requireRecord(value);
  const paymentId = requireUuid(
    row.payment_id,
    "payment ID",
  );
  const databaseOrderId = requireUuid(
    row.database_order_id,
    "database order ID",
  );
  const orderNumber = requireString(
    row.order_number,
    "order number",
  );

  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    throw new Error(
      "The server returned an invalid order number.",
    );
  }

  if (row.payment_method !== "gcash") {
    throw new Error(
      "The server returned an unsupported online payment method.",
    );
  }

  const amount = Number(row.amount);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      "The server returned an invalid payment amount.",
    );
  }

  const uploadedAt = requireTimestamp(
    row.payment_created_at,
    "payment creation timestamp",
  );

  const updatedAt = requireTimestamp(
    row.payment_updated_at,
    "payment update timestamp",
  );

  return {
    databaseOrderId,
    payment: {
      id: paymentId,
      orderId: orderNumber,
      method: "GCash",
      amount,
      submittedAmount: amount,
      status: mapPaymentStatus(
        row.payment_status,
      ),
      referenceNumber: requireString(
        row.gcash_reference_number,
        "GCash reference number",
      ),
      proofImagePath: requireString(
        row.proof_image_path,
        "payment proof path",
      ),
      uploadedAt,
      updatedAt,
      verifiedBy: optionalUuid(
        row.verified_by,
        "payment verifier ID",
      ),
      verifiedAt: optionalTimestamp(
        row.verified_at,
        "payment verification timestamp",
      ),
      rejectionReason: optionalString(
        row.rejection_reason,
        "payment rejection reason",
      ),
      rejectionNotes: optionalString(
        row.rejection_notes,
        "payment rejection notes",
      ),
      rejectedBy: optionalUuid(
        row.rejected_by,
        "rejecting cashier ID",
      ),
      rejectedAt: optionalTimestamp(
        row.rejected_at,
        "payment rejection timestamp",
      ),
    },
  };
}

export async function fetchCashierOnlinePayments(): Promise<
  HydratedOnlinePayment[]
> {
  const { data, error } = await supabase.rpc(
    "get_cashier_online_payments",
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The server returned an invalid online payment list.",
    );
  }

  return data.map(mapOnlinePayment);
}
