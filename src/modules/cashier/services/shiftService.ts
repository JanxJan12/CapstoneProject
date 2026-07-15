import type {
  CashierShift,
  CashierState,
  ShiftClosureInput,
  ShiftTotals,
} from "../types";
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
  input: ShiftClosureInput,
): CashierState {
  const state = cloneState(current);
  const shift = requireOpenShift(state);
  const pendingPayments = state.payments.filter(
    (payment) => payment.status === "Pending",
  );
  if (pendingPayments.length)
    throw new Error(
      `Resolve ${pendingPayments.length} pending payment${pendingPayments.length === 1 ? "" : "s"} before ending the shift.`,
    );
  if (!Number.isFinite(input.actualCash) || input.actualCash < 0)
    throw new Error("Enter a valid actual cash count.");
  const managerName = input.managerName.trim();
  if (!input.managerApproved || !managerName)
    throw new Error("Manager approval is required before ending the shift.");
  const totals = calculateShiftTotals(state, shift.id);
  const variance = input.actualCash - totals.expectedCash;
  const varianceReason = input.varianceReason?.trim();
  if (variance !== 0 && !varianceReason)
    throw new Error("Select a variance reason for an over or short drawer.");
  const outcome = variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short";
  const timestamp = timestampNow();
  shift.actualCash = input.actualCash;
  shift.expectedCash = totals.expectedCash;
  shift.variance = variance;
  shift.varianceReason = varianceReason || undefined;
  shift.notes = input.notes?.trim() || undefined;
  shift.managerApprovedBy = managerName;
  shift.managerApprovedAt = timestamp;
  shift.pendingPaymentCountAtClose = 0;
  shift.endedAt = timestamp;
  shift.status = "Closed";
  addActivity(
    state,
    "shift_closed",
    `${state.cashier.name} ended ${shift.id} as ${outcome}; approved by ${managerName}`,
  );
  if (variance !== 0) {
    state.notifications.unshift({
      id: `NOTE-${Date.now()}`,
      title: "Shift variance detected",
      message: `${shift.id} closed ${outcome.toLowerCase()} by ${formatVariance(variance)} with manager approval.`,
      createdAt: timestamp,
      read: false,
      kind: "shift_variance",
      page: "shift-settlement",
    });
  }
  return state;
}

const formatVariance = (variance: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Math.abs(variance));
