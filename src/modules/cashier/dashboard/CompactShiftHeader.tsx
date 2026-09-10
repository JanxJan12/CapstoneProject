import { Circle, LogOut } from "lucide-react";
import { formatMoney } from "../constants";
import type { CashierShiftSummary } from "../types";
import { formatShiftDuration } from "../shifts/shiftSettlementUtils";
import { CashierButton } from "../components";

export function CompactShiftHeader({
  summary,
  onEndShift,
}: {
  summary: CashierShiftSummary;
  onEndShift: () => void;
}) {
  return (
    <section
      className="flex min-h-[64px] flex-col gap-2 rounded-2xl border border-[#5e3a25]/15 bg-[#2b1b12] px-4 py-2.5 text-white shadow-[0_8px_22px_rgba(55,31,16,0.1)] sm:flex-row sm:items-center sm:px-5"
      aria-label="Current cashier shift"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] font-bold text-white/70">
        <span
          className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black ${summary.isActive ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-amber-200/20 bg-amber-200/10 text-amber-100"}`}
        >
          <Circle
            className={`h-2 w-2 ${summary.isActive ? "fill-emerald-300" : "fill-amber-200"}`}
            aria-hidden="true"
          />
          {summary.isActive ? "Shift Active" : "Shift not started"}
        </span>
        <span aria-hidden="true" className="text-white/25">
          ·
        </span>
        <span className="truncate text-white/90">{summary.cashierName}</span>
        <span aria-hidden="true" className="text-white/25">
          ·
        </span>
        <span>{summary.terminal}</span>
        {summary.startedAt ? (
          <>
            <span aria-hidden="true" className="text-white/25">
              ·
            </span>
            <span>{formatShiftDuration(summary.startedAt)}</span>
          </>
        ) : null}
        <span className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-white/60 sm:ml-auto">
          Expected drawer
          <strong className="text-xs font-black tracking-normal text-amber-100">
            {summary.isActive ? formatMoney(summary.expectedDrawer) : "—"}
          </strong>
        </span>
      </div>
      <CashierButton
        variant="secondary"
        size="sm"
        className="min-h-9 shrink-0 border-white/15 bg-white/[0.07] text-white shadow-none hover:border-white/25 hover:bg-white/[0.12]"
        disabled={!summary.isActive}
        onClick={onEndShift}
      >
        <LogOut aria-hidden="true" /> End Shift
      </CashierButton>
    </section>
  );
}
