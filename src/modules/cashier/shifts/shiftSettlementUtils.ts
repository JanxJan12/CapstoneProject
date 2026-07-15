import type { CashierShift } from "../types";

export type ShiftVarianceOutcome =
  "Balanced" | "Over" | "Short" | "In progress";

export function formatShiftDuration(start: string, end?: string) {
  const minutes = Math.max(
    0,
    Math.floor(
      ((end ? new Date(end).getTime() : Date.now()) -
        new Date(start).getTime()) /
        60_000,
    ),
  );
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function getVarianceOutcome(shift: CashierShift): ShiftVarianceOutcome {
  if (shift.actualCash === undefined || shift.variance === undefined) {
    return "In progress";
  }
  if (shift.variance === 0) return "Balanced";
  return shift.variance > 0 ? "Over" : "Short";
}

export const getVarianceOutcomeFromAmount = (
  variance: number,
): Exclude<ShiftVarianceOutcome, "In progress"> =>
  variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short";
