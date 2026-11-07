import { formatMoney } from "../constants";
import type { CashierShift, ShiftTotals } from "../types";
import { getVarianceOutcome } from "./shiftSettlementUtils";

export function ShiftMetrics({ shift, totals }: { shift: CashierShift; totals: ShiftTotals }) {
  const closed = shift.status === "Closed";
  const expectedCash = closed ? shift.expectedCash : totals.expectedCash;
  const outcome = getVarianceOutcome(shift);

  return (
    <section className="rrj-card overflow-hidden p-0" aria-label="Cash reconciliation">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-bold">Cash drawer</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 px-4 py-4 text-sm sm:px-5">
        <div>
          <p className="text-xs text-muted-foreground">Opening cash</p>
          <p className="mt-1 font-semibold tabular-nums">{formatMoney(shift.openingCash)}</p>
        </div>
        {!closed && <div>
          <p className="text-xs text-muted-foreground">Completed Cash receipts</p>
          <p className="mt-1 font-semibold tabular-nums">{formatMoney(totals.cashSales)}</p>
        </div>}
      </div>
      <div className="border-t border-border bg-muted/20 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold text-muted-foreground">
          {closed ? "Expected cash at closure" : "Expected cash · estimate"}
        </p>
        <p className="mt-1 text-2xl font-black tabular-nums">
          {expectedCash === undefined ? "Not recorded" : formatMoney(expectedCash)}
        </p>
        {!closed && <p className="mt-1 text-xs text-muted-foreground">GCash is excluded. The final amount is checked at closure.</p>}
      </div>
      {closed ? (
        <div className="grid grid-cols-2 gap-4 border-t border-border px-4 py-4 text-sm sm:px-5">
          <div><p className="text-xs text-muted-foreground">Actual cash counted</p><p className="mt-1 font-semibold tabular-nums">{shift.actualCash === undefined ? "Not counted" : formatMoney(shift.actualCash)}</p></div>
          <div><p className="text-xs text-muted-foreground">Recorded variance</p><p className="mt-1 font-semibold tabular-nums">{shift.variance === undefined ? "Not recorded" : `${outcome}: ${formatMoney(Math.abs(shift.variance))}`}</p></div>
        </div>
      ) : (
        <details className="border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <summary className="w-fit cursor-pointer font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">How this estimate is built</summary>
          <p className="mt-2">Opening {formatMoney(shift.openingCash)} + completed Cash receipts {formatMoney(totals.cashSales)}{totals.cashRefunds > 0 ? ` − legacy locally classified refunded rows ${formatMoney(totals.cashRefunds)}` : ""}. GCash receipts {formatMoney(totals.gcashSales)} stay separate. Manager-recorded refunds void their original receipt; this view does not track separate physical cash movements. The server uses verified completed Cash payments for the saved settlement.</p>
        </details>
      )}
    </section>
  );
}
