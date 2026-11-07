import { supabase } from "@/lib/supabase";
import type { CashierShift } from "../types";
import type { TransactionFilterValue } from "./TransactionFilters";

export interface HistoryRow {
  id: string;
  receipt_number: string;
  order_id: string;
  payment_id: string;
  shift_id: string;
  cashier_id: string;
  status: "completed" | "voided";
  void_reason: string | null;
  created_at: string;
  order_number: string;
  customer_name: string | null;
  grand_total: number | string;
  subtotal: number | string;
  delivery_fee: number | string;
  tax_amount: number | string;
  payment_method: "cash" | "gcash";
  gcash_reference_number: string | null;
  terminal: string;
}

export const HISTORY_PAGE_SIZE = 50;
export const HISTORY_EXPORT_LIMIT = 5000;
export const HISTORY_CSV_HEADERS = ["Receipt Number", "Order Number", "Transaction Date", "Transaction Time",
  "Customer", "Payment Method", "Status", "Recorded Amount (PHP)"];
const manilaDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function historyCsvRow(row: HistoryRow): string[] {
  const parts = manilaDateTime.formatToParts(new Date(row.created_at));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return [row.receipt_number, row.order_number,
    `${part("year")}-${part("month")}-${part("day")}`,
    `${part("hour")}:${part("minute")}:${part("second")}`,
    row.customer_name ?? "", row.payment_method === "cash" ? "Cash" : "GCash",
    row.status === "completed" ? "Completed" : "Voided", Number(row.grand_total).toFixed(2)];
}

export function historyRpcFilters(filters: TransactionFilterValue) {
  return {
    search: filters.search.trim(),
    method: filters.method === "All" ? "" : filters.method.toLowerCase(),
    status: filters.status === "All" ? "" : filters.status.toLowerCase(),
    from: filters.from, to: filters.to,
    shift: filters.shift === "All" ? "" : filters.shift,
    terminal: filters.terminal === "All" ? "" : filters.terminal,
    customer: filters.customer.trim(),
    orderId: filters.orderId.trim(),
    receiptNumber: filters.receiptNumber.trim(),
  };
}

export async function fetchHistoryPage(
  cashierId: string,
  filters: TransactionFilterValue,
  offset: number,
  limit = HISTORY_PAGE_SIZE,
): Promise<{ rows: HistoryRow[]; total: number }> {
  if (!Number.isSafeInteger(offset) || offset < 0 || limit < 1 || limit > 100) {
    throw new Error("Invalid history page request.");
  }
  const { data, error } = await supabase.rpc("get_cashier_transaction_history", {
    p_limit: limit, p_offset: offset, p_filters: historyRpcFilters(filters),
  });
  if (error) throw new Error(
    ["PGRST202", "42883"].includes(error.code ?? "")
      ? "Transaction history is not available yet. Please try again later."
      : error.message,
  );
  const result = data as { rows?: HistoryRow[]; total?: number } | null;
  if (!result || !Array.isArray(result.rows) || !Number.isSafeInteger(result.total) ||
      result.total! < 0 || result.rows.length > limit ||
      result.rows.some((row) => row.cashier_id !== cashierId ||
        !row.order_number || !row.receipt_number || !row.shift_id ||
        !["completed", "voided"].includes(row.status) ||
        !["cash", "gcash"].includes(row.payment_method) ||
        !Number.isFinite(Number(row.grand_total)))) {
    throw new Error("History returned an incomplete or unauthorized page.");
  }
  return { rows: result.rows, total: result.total! };
}

export async function fetchHistoryShifts(cashierId: string, cashierName: string): Promise<CashierShift[]> {
  const { data, error } = await supabase.from("cashier_shifts")
    .select("id,cashier_id,terminal,opening_cash,started_at,ended_at,status")
    .eq("cashier_id", cashierId).order("started_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    if (row.cashier_id !== cashierId) throw new Error("History shift ownership changed.");
    return {
      id: row.id, cashierId, cashierName, terminal: row.terminal,
      openingCash: Number(row.opening_cash), startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      status: row.status === "open" ? "Open" as const : "Closed" as const,
    };
  });
}
