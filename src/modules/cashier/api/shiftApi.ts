import { supabase } from "@/lib/supabase";

export interface OpenCashierShiftResult {
  id: string;
  cashierId: string;
  terminal: string;
  openingCash: number;
  startedAt: string;
}

export type StartCashierShiftResult = OpenCashierShiftResult;

interface DatabaseOpenShiftRow {
  shift_id: string;
  cashier_id: string;
  terminal: string;
  opening_cash: number | string;
  status: "open" | "closed";
  started_at: string;
}

function mapOpenCashierShiftRow(
  row: DatabaseOpenShiftRow,
): OpenCashierShiftResult {
  const parsedOpeningCash = Number(row.opening_cash);

  if (!Number.isFinite(parsedOpeningCash)) {
    throw new Error("The server returned an invalid opening cash amount.");
  }

  if (row.status !== "open") {
    throw new Error("The server did not return an open cashier shift.");
  }

  return {
    id: row.shift_id,
    cashierId: row.cashier_id,
    terminal: row.terminal,
    openingCash: parsedOpeningCash,
    startedAt: row.started_at,
  };
}

export async function fetchOpenCashierShift(): Promise<
  OpenCashierShiftResult | null
> {
  const { data, error } = await supabase.rpc("get_open_cashier_shift");

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as DatabaseOpenShiftRow[];
  const row = rows[0];

  return row ? mapOpenCashierShiftRow(row) : null;
}

export async function startCashierShift(
  openingCash: number,
  terminal: string,
): Promise<StartCashierShiftResult> {
  const { data, error } = await supabase.rpc("start_cashier_shift", {
    p_opening_cash: openingCash,
    p_terminal: terminal,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as DatabaseOpenShiftRow[];
  const row = rows[0];

  if (!row) {
    throw new Error("The shift was started but no shift record was returned.");
  }

  return mapOpenCashierShiftRow(row);
}

export interface CloseCashierShiftResult {
  id: string;
  cashierId: string;
  terminal: string;
  openingCash: number;
  cashSales: number;
  gcashSales: number;
  transactionCount: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  varianceReason?: string;
  startedAt: string;
  endedAt: string;
}

interface DatabaseCloseShiftRow {
  shift_id: string;
  cashier_id: string;
  terminal: string;
  opening_cash: number | string;
  cash_sales: number | string;
  gcash_sales: number | string;
  transaction_count: number | string;
  expected_cash: number | string;
  actual_cash: number | string;
  variance: number | string;
  variance_reason: string | null;
  status: "open" | "closed";
  started_at: string;
  ended_at: string;
}

export async function closeCashierShift(
  actualCash: number,
  varianceReason?: string,
  notes?: string,
): Promise<CloseCashierShiftResult> {
  const { data, error } = await supabase.rpc("close_cashier_shift", {
    p_actual_cash: actualCash,
    p_variance_reason: varianceReason?.trim() || null,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as DatabaseCloseShiftRow[];
  const row = rows[0];

  if (!row) {
    throw new Error("The shift was closed but no shift record was returned.");
  }

  if (row.status !== "closed") {
    throw new Error("The server did not return a closed cashier shift.");
  }

  const openingCash = Number(row.opening_cash);
  const cashSales = Number(row.cash_sales);
  const gcashSales = Number(row.gcash_sales);
  const transactionCount = Number(row.transaction_count);
  const expectedCash = Number(row.expected_cash);
  const actualCashReturned = Number(row.actual_cash);
  const variance = Number(row.variance);

  if (
    !Number.isFinite(openingCash) ||
    !Number.isFinite(cashSales) ||
    !Number.isFinite(gcashSales) ||
    !Number.isFinite(transactionCount) ||
    !Number.isFinite(expectedCash) ||
    !Number.isFinite(actualCashReturned) ||
    !Number.isFinite(variance)
  ) {
    throw new Error("The server returned invalid shift settlement totals.");
  }

  return {
    id: row.shift_id,
    cashierId: row.cashier_id,
    terminal: row.terminal,
    openingCash,
    cashSales,
    gcashSales,
    transactionCount,
    expectedCash,
    actualCash: actualCashReturned,
    variance,
    varianceReason: row.variance_reason ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}
