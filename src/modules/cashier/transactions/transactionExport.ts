import type { Transaction } from "../types";
import { filterTransactionRecords } from "./transactionRecords";
import type { TransactionFilterValue } from "./TransactionFilters";

export interface TransactionExportRecord {
  id: string;
  receipt_number: string;
  cashier_id: string;
  status: string;
  created_at: string;
  order: { order_number: string; customer_name: string | null; grand_total: number | string } | null;
  payment: { id: string; payment_method: string; gcash_reference_number: string | null } | null;
  shift: { id: string; terminal: string } | null;
}

export const TRANSACTION_EXPORT_PAGE_SIZE = 500;
export function createTransactionExportGate() {
  let busy = false;
  return async <T>(work: () => Promise<T>): Promise<{ started: boolean; value?: T }> => {
    if (busy) return { started: false };
    busy = true;
    try {
      return { started: true, value: await work() };
    } finally {
      busy = false;
    }
  };
}
export const TRANSACTION_CSV_HEADERS = [
  "Receipt Number", "Order Number", "Transaction Date", "Transaction Time",
  "Customer", "Payment Method", "Status", "Amount (PHP)",
] as const;

export async function fetchAllTransactionExportRecords(
  fetchPage: (afterId: string | null, limit: number) => Promise<TransactionExportRecord[]>,
) {
  const records: TransactionExportRecord[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page = await fetchPage(afterId, TRANSACTION_EXPORT_PAGE_SIZE);
    if (page.length > TRANSACTION_EXPORT_PAGE_SIZE) {
      throw new Error("Transaction export page exceeded the requested size.");
    }
    if (page.some((row, index) => row.id <= (index ? page[index - 1].id : afterId ?? ""))) {
      throw new Error("Transaction export pagination was inconsistent.");
    }
    records.push(...page);
    if (page.length < TRANSACTION_EXPORT_PAGE_SIZE) return records;
    afterId = page[page.length - 1].id;
  }
}

export function assertCompleteTransactionExport(before: number, after: number, loaded: number) {
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(after) ||
      before !== after || loaded !== after) {
    throw new Error("Transaction export changed or was incomplete during retrieval.");
  }
}

const manilaDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function recordedAmount(value: number | string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Transaction export received an invalid recorded amount.");
  }
  return amount;
}

export function buildTransactionExport(
  records: TransactionExportRecord[],
  filters: TransactionFilterValue,
  cashier: { id: string; name: string },
) {
  const paymentById = new Map<string, { referenceNumber?: string }>();
  const shiftById = new Map<string, { terminal: string }>();
  const transactionById = new Map<string, TransactionExportRecord>();
  const transactions: Transaction[] = records.map((row) => {
    if (row.cashier_id !== cashier.id || !row.order || !row.payment || !row.shift ||
        !row.receipt_number || !row.order.order_number || !row.created_at ||
        !["completed", "voided"].includes(row.status) ||
        !["cash", "gcash"].includes(row.payment.payment_method)) {
      throw new Error("Transaction export contains an incomplete or unauthorized record.");
    }
    transactionById.set(row.id, row);
    paymentById.set(row.payment.id, { referenceNumber: row.payment.gcash_reference_number ?? undefined });
    shiftById.set(row.shift.id, { terminal: row.shift.terminal });
    return {
      id: row.id,
      receiptNumber: row.receipt_number,
      orderId: row.order.order_number,
      customerName: row.order.customer_name ?? "",
      amount: recordedAmount(row.order.grand_total),
      method: row.payment.payment_method === "cash" ? "Cash" : "GCash",
      status: row.status === "completed" ? "Completed" : "Voided",
      cashierId: row.cashier_id,
      cashierName: cashier.name,
      shiftId: row.shift.id,
      paymentId: row.payment.id,
      createdAt: row.created_at,
    };
  });

  const matched = filterTransactionRecords(transactions, filters, paymentById, shiftById);
  const rows = matched.map((transaction) => {
    const source = transactionById.get(transaction.id)!;
    const parts = manilaDateTime.formatToParts(new Date(transaction.createdAt));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
    return [
      source.receipt_number,
      source.order!.order_number,
      `${part("year")}-${part("month")}-${part("day")}`,
      `${part("hour")}:${part("minute")}:${part("second")}`,
      source.order!.customer_name ?? "",
      transaction.method,
      transaction.status,
      transaction.amount.toFixed(2),
    ];
  });
  return { headers: TRANSACTION_CSV_HEADERS, rows, count: rows.length };
}
