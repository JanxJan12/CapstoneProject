import { AlertTriangle, PlayCircle, StopCircle } from "lucide-react";
import {
  CashierButton,
  ErrorBanner,
} from "../components";
import { EndShiftDialog } from "./EndShiftDialog";
import { ClosedShiftHistory } from "./ClosedShiftHistory";
import { ShiftOverview } from "./ShiftOverview";
import { StartShiftDialog } from "./StartShiftDialog";
import { useShiftSettlement } from "./useShiftSettlement";

export function ShiftSettlementPage({ onReviewPayments }: { onReviewPayments: () => void }) {
  const settlement = useShiftSettlement();
  const pendingCount = settlement.pendingPayments.length;

  return (
    <div className="cashier-page">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Shift Settlement</h1>
          <p className="mt-1 text-sm text-muted-foreground" role="status">
            {settlement.activeShift ? "Open shift · Review the drawer before closing" : "Open a shift to take walk-in payments"}
          </p>
        </div>
        {settlement.activeShift ? (
          <CashierButton
            variant={pendingCount ? "secondary" : "danger"}
            disabled={Boolean(pendingCount) || settlement.loading}
            title={pendingCount ? "Review the Cashier payment queue before ending the shift" : undefined}
            onClick={settlement.openEndDialog}
          >
            <StopCircle aria-hidden="true" /> Review end shift
          </CashierButton>
        ) : (
          <CashierButton onClick={() => settlement.setStartOpen(true)}>
            <PlayCircle aria-hidden="true" /> Start new shift
          </CashierButton>
        )}
      </header>
      {settlement.error ? (
        <ErrorBanner message={settlement.error} />
      ) : null}
      {settlement.activeShift && pendingCount ? (
        <section
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold">Payment review needs attention</p>
              <p className="mt-0.5 text-xs">{pendingCount} payment{pendingCount === 1 ? "" : "s"} awaiting review before closure.</p>
            </div>
          </div>
          <CashierButton variant="secondary" onClick={onReviewPayments}>
            Review {pendingCount === 1 ? "Payment" : "Payments"}
          </CashierButton>
        </section>
      ) : null}
      {settlement.activeShift ? (
        <ShiftOverview
          shift={settlement.activeShift}
          totals={settlement.shiftTotals}
        />
      ) : null}
      <ClosedShiftHistory refreshKey={settlement.activeShift?.id ?? "closed"} />
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
          shiftId={settlement.activeShift.id}
          openingCash={settlement.activeShift.openingCash}
          totals={settlement.shiftTotals}
          pendingPaymentCount={pendingCount}
          onReviewPayments={onReviewPayments}
          onOpenChange={settlement.setEndOpen}
          onConfirm={settlement.handleEnd}
        />
      ) : null}
    </div>
  );
}
