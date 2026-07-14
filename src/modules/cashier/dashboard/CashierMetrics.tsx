import { CreditCard, DollarSign, Package, Users } from "lucide-react";
import { formatMoney } from "../constants";
import { useCashierMetrics } from "../hooks/useCashierMetrics";

export function CashierMetrics() {
  const metrics = useCashierMetrics();
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric
        label="Pending Payments"
        value={String(metrics.pendingPayments)}
        detail="Requires cashier verification"
        icon={CreditCard}
        tone="bg-amber-100 text-amber-700"
      />
      <Metric
        label="Open Tickets"
        value={String(metrics.openTickets)}
        detail="Across counter, kitchen, and delivery"
        icon={Package}
        tone="bg-blue-100 text-blue-700"
      />
      <Metric
        label="Sales Today"
        value={formatMoney(metrics.salesToday)}
        detail={`${metrics.shiftTotals.transactionCount} transactions this shift`}
        icon={DollarSign}
        tone="bg-emerald-100 text-emerald-700"
      />
      <Metric
        label="Walk-in Orders"
        value={String(metrics.walkInOrders)}
        detail="Dine-in and take-out only"
        icon={Users}
        tone="bg-violet-100 text-violet-700"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rrj-card rrj-card-hover group relative overflow-hidden p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-orange-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-black tracking-[-0.025em] text-foreground">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-black/[0.03] transition-transform group-hover:scale-105 ${tone}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}
