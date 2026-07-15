import { Clock3, Printer, ShieldCheck } from "lucide-react";
import { CashierButton, StatusBadge } from "../components";
import { formatDateTime } from "../constants";
import type { CashierShift, ShiftTotals } from "../types";
import { ShiftMetrics } from "./ShiftMetrics";
import { ShiftOutcomeBadge } from "./ShiftOutcomeBadge";
import {
  formatShiftDuration,
  getVarianceOutcome,
} from "./shiftSettlementUtils";

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
  return (
    <>
      <section
        className={`relative overflow-hidden rounded-[20px] border shadow-[0_14px_35px_rgba(67,42,23,0.08)] ${active ? "border-orange-300/20 bg-gradient-to-r from-[#2b1b12] to-[#4a2817] text-white" : "border-border bg-card"}`}
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`font-mono text-sm font-black ${active ? "text-orange-200" : "text-primary"}`}
              >
                {shift.id}
              </p>
              <StatusBadge status={shift.status} />
              {!active ? <ShiftOutcomeBadge shift={shift} /> : null}
            </div>
            <p className="mt-2 text-xl font-black tracking-tight">
              {shift.cashierName}
            </p>
            <p
              className={`mt-1 text-xs ${active ? "text-white/55" : "text-muted-foreground"}`}
            >
              {shift.terminal} · Started {formatDateTime(shift.startedAt)}
            </p>
          </div>
          <div
            className={`rounded-2xl border px-5 py-4 ${active ? "border-white/15 bg-white/10 backdrop-blur-sm" : "border-border bg-white"}`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-widest ${active ? "text-white/45" : "text-muted-foreground"}`}
            >
              Shift duration
            </p>
            <p className="mt-1 flex items-center gap-2 text-xl font-black">
              <Clock3 className="h-5 w-5 text-primary" aria-hidden="true" />
              {formatShiftDuration(shift.startedAt, shift.endedAt)}
            </p>
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
