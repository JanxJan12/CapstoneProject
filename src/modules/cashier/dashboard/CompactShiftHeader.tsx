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
      className="flex min-h-[76px] flex-col gap-3 rounded-2xl border border-[#5e3a25]/15 bg-[#2b1b12] px-4 py-3 text-white shadow-[0_10px_28px_rgba(55,31,16,0.12)] sm:flex-row sm:items-center sm:justify-between sm:px-5"
      aria-label="Current cashier shift"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-bold text-white/72">
          <span
            className={`inline-flex items-center gap-1.5 font-black ${summary.isActive ? "text-emerald-300" : "text-amber-200"}`}
          >
            <Circle
              className={`h-2.5 w-2.5 ${summary.isActive ? "fill-emerald-300" : "fill-amber-200"}`}
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
        </div>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Expected drawer{" "}
          <strong className="ml-1 text-sm font-black tracking-normal text-amber-100">
            {summary.isActive ? formatMoney(summary.expectedDrawer) : "—"}
          </strong>
        </p>
      </div>
      <CashierButton
        variant="secondary"
        size="sm"
        className="min-h-10 shrink-0 border-white/15 bg-white/[0.07] text-white shadow-none hover:border-white/25 hover:bg-white/[0.12]"
        disabled={!summary.isActive}
        onClick={onEndShift}
      >
        <LogOut aria-hidden="true" /> End Shift
      </CashierButton>
    </section>
  );
}
