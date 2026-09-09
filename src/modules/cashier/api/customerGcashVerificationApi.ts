import { supabase } from "@/lib/supabase";

interface DatabaseVerificationResult {
  database_order_id: unknown;
  order_number: unknown;
  payment_id: unknown;
  request_id: unknown;
  transaction_id: unknown;
  transaction_number: unknown;
  receipt_number: unknown;
  shift_id: unknown;
  cashier_id: unknown;
  payment_status: unknown;
  order_status: unknown;
  verified_at: unknown;
  created_at: unknown;
}

export interface CustomerGcashVerificationResult {
  databaseOrderId: string;
  orderNumber: string;
  paymentId: string;
  requestId: string;
  transactionId: string;
  transactionNumber: string;
  receiptNumber: string;
  shiftId: string;
  cashierId: string;
  paymentStatus: "verified";
  orderStatus: "confirmed";
  verifiedAt: string;
  createdAt: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_PATTERN = /^ORD-\d{6}$/;
const TRANSACTION_NUMBER_PATTERN = /^TXN-\d{6}$/;
const RECEIPT_NUMBER_PATTERN = /^RCP-\d{6}$/;

function requireRecord(
  value: unknown,
): DatabaseVerificationResult {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "The server returned an invalid GCash verification result.",
    );
  }

  return value as DatabaseVerificationResult;
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

function mapVerificationResult(
  value: unknown,
  expectedRequestId: string,
  expectedPaymentId: string,
): CustomerGcashVerificationResult {
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
  const requestId = requireUuid(
    row.request_id,
    "verification request ID",
  );
  const transactionId = requireUuid(
    row.transaction_id,
    "transaction ID",
  );
  const transactionNumber = requireString(
    row.transaction_number,
    "transaction number",
  );
  const receiptNumber = requireString(
    row.receipt_number,
    "receipt number",
  );
  const shiftId = requireUuid(
    row.shift_id,
    "cashier shift ID",
  );
  const cashierId = requireUuid(
    row.cashier_id,
    "cashier ID",
  );

  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    throw new Error(
      "The server returned an invalid order number.",
    );
  }

  if (!TRANSACTION_NUMBER_PATTERN.test(transactionNumber)) {
    throw new Error(
      "The server returned an invalid transaction number.",
    );
  }

  if (!RECEIPT_NUMBER_PATTERN.test(receiptNumber)) {
    throw new Error(
      "The server returned an invalid receipt number.",
    );
  }

  if (transactionNumber.slice(4) !== receiptNumber.slice(4)) {
    throw new Error(
      "The server returned transaction and receipt numbers from different sequences.",
    );
  }

  if (paymentId !== expectedPaymentId) {
    throw new Error(
      "The server returned a different payment from the verification request.",
    );
  }

  if (requestId !== expectedRequestId) {
    throw new Error(
      "The server returned a different verification request ID.",
    );
  }

  if (row.payment_status !== "verified") {
    throw new Error(
      "The server did not return a verified payment status.",
    );
  }

  if (row.order_status !== "confirmed") {
    throw new Error(
      "The server did not return a confirmed order status.",
    );
  }

  return {
    databaseOrderId,
    orderNumber,
    paymentId,
    requestId,
    transactionId,
    transactionNumber,
    receiptNumber,
    shiftId,
    cashierId,
    paymentStatus: "verified",
    orderStatus: "confirmed",
    verifiedAt: requireTimestamp(
      row.verified_at,
      "payment verification timestamp",
    ),
    createdAt: requireTimestamp(
      row.created_at,
      "transaction creation timestamp",
    ),
  };
}

export async function verifyCustomerGcashPayment(
  requestId: string,
  paymentId: string,
): Promise<CustomerGcashVerificationResult> {
  const normalizedRequestId = requestId.trim();
  const normalizedPaymentId = paymentId.trim();

  if (!UUID_PATTERN.test(normalizedRequestId)) {
    throw new Error(
      "A valid verification request ID is required.",
    );
  }

  if (!UUID_PATTERN.test(normalizedPaymentId)) {
    throw new Error(
      "A valid payment ID is required.",
    );
  }

  const { data, error } = await supabase.rpc(
    "verify_customer_gcash_payment",
    {
      p_request_id: normalizedRequestId,
      p_payment_id: normalizedPaymentId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(
      "The server returned an invalid GCash verification result.",
    );
  }

  return mapVerificationResult(
    data[0],
    normalizedRequestId,
    normalizedPaymentId,
  );
}
