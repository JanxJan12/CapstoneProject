import type { CashierShift, CashierState, ShiftTotals } from "../types";
import {
  addActivity,
  cloneState,
  requireOpenShift,
  timestampNow,
} from "./serviceUtils";

export function startShift(
  current: CashierState,
  openingCash: number,
  terminal: string,
): CashierState {
  const state = cloneState(current);
  if (state.shifts.some((entry) => entry.status === "Open"))
    throw new Error("A cashier shift is already open.");
  const timestamp = timestampNow();
  const shift: CashierShift = {
    id: `SHIFT-${Date.now()}`,
    cashierId: state.cashier.id,
    cashierName: state.cashier.name,
    terminal,
    openingCash,
    startedAt: timestamp,
    status: "Open",
  };
  state.shifts.unshift(shift);
  state.cashier.terminal = terminal;
  addActivity(
    state,
    "shift_started",
    `${state.cashier.name} started a shift at ${terminal}`,
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
  const voids = transactions
    .filter((entry) => entry.status === "Voided")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const discounts = transactions.reduce(
    (sum, entry) => sum + entry.discountAmount,
    0,
  );
  return {
    cashSales,
    gcashSales,
    refunds,
    voids,
    discounts,
    transactionCount: transactions.length,
    ordersProcessed: new Set(transactions.map((entry) => entry.orderId)).size,
    expectedCash: shift.openingCash + cashSales - refunds,
  };
}

export function endShift(
  current: CashierState,
  actualCash: number,
  notes?: string,
): CashierState {
  const state = cloneState(current);
  const shift = requireOpenShift(state);
  const totals = calculateShiftTotals(state, shift.id);
  const variance = actualCash - totals.expectedCash;
  if (variance !== 0 && !notes?.trim())
    throw new Error("Notes are required when the drawer has a variance.");
  shift.actualCash = actualCash;
  shift.expectedCash = totals.expectedCash;
  shift.variance = variance;
  shift.notes = notes;
  shift.endedAt = timestampNow();
  shift.status = variance === 0 ? "Closed" : "Pending Review";
  addActivity(
    state,
    "shift_closed",
    `${state.cashier.name} ended the shift with ${variance === 0 ? "no variance" : "a recorded variance"}`,
  );
  return state;
}
