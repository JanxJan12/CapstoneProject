import { AlertTriangle, Banknote, PlayCircle, StopCircle } from "lucide-react";
import {
  CashierButton,
  EmptyState,
  ErrorBanner,
  PageHeader,
} from "../components";
import { EndShiftDialog } from "./EndShiftDialog";
import { ShiftAuditTable } from "./ShiftAuditTable";
import { ShiftOverview } from "./ShiftOverview";
import { ShiftReportDialog } from "./ShiftReportDialog";
import { StartShiftDialog } from "./StartShiftDialog";
import { useShiftSettlement } from "./useShiftSettlement";

export function ShiftSettlementPage() {
  const settlement = useShiftSettlement();
  const pendingCount = settlement.pendingPayments.length;

  return (
    <div className="cashier-page">
      <PageHeader
        title="Shift Settlement"
        description="Complete cashier opening, drawer count, manager approval, variance review, and closing audit workflow"
        actions={
          settlement.activeShift ? (
            <CashierButton
              variant="danger"
              title={
                pendingCount
                  ? "Resolve all pending payments before ending the shift"
                  : undefined
              }
              onClick={settlement.openEndDialog}
            >
              <StopCircle className="h-4 w-4" aria-hidden="true" /> End shift
            </CashierButton>
          ) : (
            <CashierButton onClick={() => settlement.setStartOpen(true)}>
              <PlayCircle className="h-4 w-4" aria-hidden="true" /> Start new
              shift
            </CashierButton>
          )
        }
      />
      {settlement.error ? (
        <ErrorBanner
          message={settlement.error}
          onRetry={() => settlement.setError("")}
        />
      ) : null}
      {settlement.activeShift && pendingCount ? (
        <section
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-black">Shift closure blocked</p>
              <p className="mt-1 text-[11px]">
                {pendingCount} pending payment{pendingCount === 1 ? "" : "s"}{" "}
                must be verified or rejected first.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest">
            {pendingCount} unresolved
          </span>
        </section>
      ) : null}
      {settlement.latest ? (
        <ShiftOverview
          shift={settlement.latest}
          totals={settlement.totals}
          active={Boolean(settlement.activeShift)}
          onReport={settlement.setReportShiftId}
        />
      ) : (
        <EmptyState
          icon={Banknote}
          title="No shift records yet"
          description="Start a shift to record opening cash and begin the cashier audit trail."
        />
      )}
      <ShiftAuditTable
        shifts={settlement.state.shifts}
        onReport={settlement.setReportShiftId}
      />
      <StartShiftDialog
        open={settlement.startOpen}
        loading={settlement.loading}
        cashierName={settlement.state.cashier.name}
        defaultTerminal={settlement.state.cashier.terminal}
        onOpenChange={settlement.setStartOpen}
        onConfirm={settlement.handleStart}
      />
      {settlement.activeShift ? (
        <EndShiftDialog
          open={settlement.endOpen}
          loading={settlement.loading}
          totals={settlement.shiftTotals}
          pendingPaymentCount={pendingCount}
          onOpenChange={settlement.setEndOpen}
          onConfirm={settlement.handleEnd}
        />
      ) : null}
      <ShiftReportDialog
        shift={settlement.reportShift}
        totals={settlement.reportTotals}
        open={Boolean(settlement.reportShift)}
        onClose={() => settlement.setReportShiftId(undefined)}
      />
    </div>
  );
}
