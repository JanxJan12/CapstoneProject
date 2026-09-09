import { formatMoney } from "../constants";
import type { CloseCashierShiftResult } from "../api/shiftApi";
import type {
  CashierShift,
  CashierState,
  ShiftTotals,
} from "../types";
import { addActivity, cloneState } from "./serviceUtils";

export function startShift(
  current: CashierState,
  startedShift: Pick<
    CashierShift,
    "id" | "cashierId" | "terminal" | "openingCash" | "startedAt"
  >,
): CashierState {
  const state = cloneState(current);

  // PostgreSQL is authoritative. A successful start_cashier_shift()
  // means any browser-only open shift is stale.
  state.shifts = state.shifts.filter((entry) => entry.status !== "Open");

  const shift: CashierShift = {
    ...startedShift,
    cashierName: state.cashier.name,
    status: "Open",
  };

  state.shifts.unshift(shift);
  state.cashier.terminal = shift.terminal;

  addActivity(
    state,
    "shift_started",
    `${state.cashier.name} started a shift at ${shift.terminal}`,
  );

  return state;
}

export function calculateShiftTotals(
  state: CashierState,
  shiftId: string,
): ShiftTotals {
  const shift = state.shifts.find((entry) => entry.id === shiftId);
  if (!shift)
    return {
      cashSales: 0,
      gcashSales: 0,
      refunds: 0,
      cashRefunds: 0,
      voids: 0,
      discounts: 0,
      transactionCount: 0,
      ordersProcessed: 0,
      expectedCash: 0,
    };
  const transactions = state.transactions.filter(
    (entry) => entry.shiftId === shiftId,
  );
  const completed = transactions.filter(
    (entry) => entry.status === "Completed",
  );
  const cashSales = completed
    .filter((entry) => entry.method === "Cash")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gcashSales = completed
    .filter((entry) => entry.method === "GCash")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const refunds = transactions
    .filter((entry) => entry.status === "Refunded")
    .reduce((sum, entry) => sum + (entry.refundAmount ?? entry.amount), 0);
  const cashRefunds = transactions
    .filter((entry) => entry.status === "Refunded" && entry.method === "Cash")
    .reduce((sum, entry) => sum + (entry.refundAmount ?? entry.amount), 0);
  const voids = transactions
    .filter((entry) => entry.status === "Voided")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const discounts = completed.reduce(
    (sum, entry) => sum + entry.discountAmount,
    0,
  );
  return {
    cashSales,
    gcashSales,
    refunds,
    cashRefunds,
    voids,
    discounts,
    transactionCount: transactions.length,
    ordersProcessed: new Set(transactions.map((entry) => entry.orderId)).size,
    expectedCash: shift.openingCash + cashSales - cashRefunds,
  };
}

export function endShift(
  current: CashierState,
  closedShift: CloseCashierShiftResult,
  notes?: string,
): CashierState {
  const state = cloneState(current);

  const existingIndex = state.shifts.findIndex(
    (entry) =>
      entry.id === closedShift.id ||
      entry.status === "Open",
  );

  const outcome =
    closedShift.variance === 0
      ? "Balanced"
      : closedShift.variance > 0
        ? "Over"
        : "Short";

  const settledShift: CashierShift = {
    id: closedShift.id,
    cashierId: closedShift.cashierId,
    cashierName: state.cashier.name,
    terminal: closedShift.terminal,
    openingCash: closedShift.openingCash,
    startedAt: closedShift.startedAt,
    endedAt: closedShift.endedAt,
    actualCash: closedShift.actualCash,
    expectedCash: closedShift.expectedCash,
    variance: closedShift.variance,
    varianceReason: closedShift.varianceReason,
    notes: notes?.trim() || undefined,
    pendingPaymentCountAtClose: 0,
    status: "Closed",
  };

  if (existingIndex >= 0) {
    state.shifts[existingIndex] = settledShift;
  } else {
    state.shifts.unshift(settledShift);
  }

  addActivity(
    state,
    "shift_closed",
    `${state.cashier.name} ended ${closedShift.id} as ${outcome}`,
  );

  if (closedShift.variance !== 0) {
    state.notifications.unshift({
      id: `NOTE-${Date.now()}`,
      title: "Shift variance detected",
      message: `${closedShift.id} closed ${outcome.toLowerCase()} by ${formatVariance(
        closedShift.variance,
      )}.`,
      createdAt: closedShift.endedAt,
      read: false,
      kind: "shift_variance",
      page: "shift-settlement",
    });
  }

  return state;
}

const formatVariance = (variance: number) => formatMoney(Math.abs(variance));
