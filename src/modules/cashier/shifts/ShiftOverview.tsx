import { AlertTriangle } from "lucide-react";
import type { CashierShift, ShiftTotals } from "../types";
import { ShiftMetrics } from "./ShiftMetrics";
import { formatShiftDuration } from "./shiftSettlementUtils";

const manilaDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function ShiftOverview({ shift, totals }: { shift: CashierShift; totals: ShiftTotals }) {
  const startedAt = new Date(shift.startedAt).getTime();
  const isLongOpenShift = Number.isFinite(startedAt) && Date.now() - startedAt >= 12 * 60 * 60 * 1000;

  return (
    <>
      <section className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5" aria-label="Active shift">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Shift active</p>
            <h2 className="mt-1 text-lg font-bold">{shift.cashierName}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{shift.terminal} · Started {manilaDateTime(shift.startedAt)}</p>
          </div>
          <p className="text-sm font-semibold tabular-nums">{formatShiftDuration(shift.startedAt, shift.endedAt)}</p>
        </div>
        {isLongOpenShift && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800" role="status">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Long-running shift. Settle at the end of duty once closure conditions are met; it stays open until the server confirms closure.</span>
          </p>
        )}
      </section>
      <ShiftMetrics shift={shift} totals={totals} />
    </>
  );
}
