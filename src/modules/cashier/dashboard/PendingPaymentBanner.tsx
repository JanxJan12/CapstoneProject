import { AlertTriangle, CheckCircle2, Clock3, CreditCard } from "lucide-react";
import { formatMoney } from "../constants";
import { useCashierMetrics } from "../hooks/useCashierMetrics";
import { CashierButton } from "../components/CashierUI";

export function PendingPaymentBanner({ onVerify }: { onVerify: () => void }) {
  const metrics = useCashierMetrics();
  const clear = metrics.pendingPayments === 0;

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-[0_8px_24px_rgba(67,42,23,0.04)] sm:flex-row sm:items-center ${clear ? "border-emerald-200 bg-emerald-50/80" : "border-amber-300/70 bg-gradient-to-r from-amber-50 to-orange-50"}`}
      aria-live="polite"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${clear ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}
      >
        {clear ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <AlertTriangle className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-black text-foreground">
          {clear
            ? "No payments awaiting verification."
            : `${metrics.pendingPayments} payment${metrics.pendingPayments === 1 ? "" : "s"} need attention`}
        </h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-muted-foreground">
          {clear ? (
            <span>The GCash verification queue is clear.</span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3" /> Oldest waiting{" "}
                {metrics.oldestPendingMinutes} min
              </span>
              <span className="inline-flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Total pending{" "}
                {formatMoney(metrics.pendingAmount)}
              </span>
            </>
          )}
        </div>
      </div>
      {!clear && (
        <CashierButton className="min-h-11 shrink-0" onClick={onVerify}>
          Verify Now
        </CashierButton>
      )}
    </section>
  );
}
