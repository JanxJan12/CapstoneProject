import { AlertTriangle, Clock3, Printer, ShieldCheck } from "lucide-react";
import { CashierButton, StatusBadge } from "../components";
import { formatDateTime } from "../constants";
import type { CashierShift, ShiftTotals } from "../types";
import { ShiftMetrics } from "./ShiftMetrics";
import { ShiftOutcomeBadge } from "./ShiftOutcomeBadge";
import {
  formatShiftDuration,
  getVarianceOutcome,
} from "./shiftSettlementUtils";

const LONG_OPEN_SHIFT_VISUAL_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export function ShiftOverview({
  shift,
  totals,
  active,
  onReport,
}: {
  shift: CashierShift;
  totals: ShiftTotals;
  active: boolean;
  onReport: (shiftId: string) => void;
}) {
  const outcome = getVarianceOutcome(shift);
  const startedAt = new Date(shift.startedAt).getTime();
  const isLongOpenShift =
    active &&
    Number.isFinite(startedAt) &&
    Date.now() - startedAt >= LONG_OPEN_SHIFT_VISUAL_THRESHOLD_MS;
  return (
    <>
      <section
        className={`relative overflow-hidden rounded-2xl border shadow-[0_8px_24px_rgba(67,42,23,0.06)] ${active ? `bg-gradient-to-r from-[#2b1b12] to-[#4a2817] text-white ${isLongOpenShift ? "border-amber-300/50 ring-1 ring-amber-300/15" : "border-orange-300/20"}` : "border-border bg-card"}`}
      >
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`font-mono text-xs font-black ${active ? "text-orange-200" : "text-primary"}`}
              >
                {shift.id}
              </p>
              <StatusBadge status={shift.status} />
              {!active ? <ShiftOutcomeBadge shift={shift} /> : null}
            </div>
            <p className="mt-1.5 text-base font-black tracking-tight">
              {shift.cashierName}
            </p>
            <p
              className={`mt-1 text-xs ${active ? "text-white/55" : "text-muted-foreground"}`}
            >
              {shift.terminal} · Started {formatDateTime(shift.startedAt)}
            </p>
          </div>
          <div
            className={`rounded-xl border px-4 py-2.5 ${active ? (isLongOpenShift ? "border-amber-300/35 bg-amber-300/10" : "border-white/15 bg-white/10 backdrop-blur-sm") : "border-border bg-white"}`}
            title={
              isLongOpenShift
                ? "This shift has been open for 12 hours or more."
                : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${active ? "text-white/55" : "text-muted-foreground"}`}
              >
                Shift duration
              </p>
              {isLongOpenShift ? (
                <span className="cashier-status-badge inline-flex min-h-6 items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-300/15 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-amber-100">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Long-running shift
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex items-center gap-2 text-base font-black">
              <Clock3
                className={`h-4 w-4 ${active ? "text-orange-200" : "text-primary"}`}
                aria-hidden="true"
              />
              {formatShiftDuration(shift.startedAt, shift.endedAt)}
            </p>
            {isLongOpenShift ? (
              <p className="mt-1.5 text-[9px] font-semibold text-amber-100/75">
                Review the open shift before settlement.
              </p>
            ) : null}
          </div>
        </div>
      </section>
      <ShiftMetrics shift={shift} totals={totals} />
      {!active ? (
        <section className="rrj-card bg-gradient-to-r from-white to-amber-50/30 p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <ShieldCheck
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />{" "}
                Manager approval
              </p>
              <p className="mt-2 text-sm font-black">
                {shift.managerApprovedBy ?? "Approval not recorded"}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {shift.managerApprovedAt
                  ? formatDateTime(shift.managerApprovedAt)
                  : "Historical shift record"}
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Closing audit notes
              </p>
              <p className="mt-2 text-sm font-bold">
                {shift.varianceReason ??
                  (outcome === "Balanced"
                    ? "No variance"
                    : "Reason not recorded")}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {shift.notes || "No cashier notes"}
              </p>
            </div>
            <CashierButton
              variant="secondary"
              onClick={() => onReport(shift.id)}
            >
              <Printer className="h-4 w-4" aria-hidden="true" /> Generate shift
              report
            </CashierButton>
          </div>
        </section>
      ) : null}
    </>
  );
}
