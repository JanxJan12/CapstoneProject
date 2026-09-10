import {
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Percent,
  ReceiptText,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { SectionHeading } from "../components";
import { formatMoney } from "../constants";
import type { CashierShift, ShiftTotals } from "../types";
import { getVarianceOutcome } from "./shiftSettlementUtils";

export function ShiftMetrics({
  shift,
  totals,
}: {
  shift: CashierShift;
  totals: ShiftTotals;
}) {
  const outcome = getVarianceOutcome(shift);
  const varianceIcon =
    outcome === "Short"
      ? TrendingDown
      : outcome === "Over"
        ? TrendingUp
        : CheckCircle2;
  const reconciliationMetrics = [
    {
      label: "Opening Cash",
      value: formatMoney(shift.openingCash),
      detail: "Recorded when shift opened",
      icon: Banknote,
      tone: "bg-amber-50 text-amber-700",
      surface: "bg-white",
    },
    {
      label: "Expected Cash",
      value: formatMoney(totals.expectedCash),
      detail: `Cash sales ${formatMoney(totals.cashSales)} · cash refunds ${formatMoney(totals.cashRefunds)}`,
      icon: ReceiptText,
      tone: "bg-orange-50 text-orange-700",
      surface: "bg-orange-50/25",
    },
    {
      label: "Actual Cash",
      value:
        shift.actualCash !== undefined
          ? formatMoney(shift.actualCash)
          : "Not counted",
      detail: "Physical drawer count",
      icon: Banknote,
      tone: "bg-amber-50 text-amber-700",
      surface: "bg-white",
    },
    {
      label: "Variance",
      value:
        shift.variance !== undefined
          ? formatMoney(shift.variance)
          : "Pending count",
      detail: outcome,
      icon: varianceIcon,
      tone:
        outcome === "Short"
          ? "bg-red-50 text-red-700"
          : outcome === "Over"
            ? "bg-blue-50 text-blue-700"
            : "bg-emerald-50 text-emerald-700",
      surface:
        outcome === "Short"
          ? "bg-red-50/35"
          : outcome === "Over"
            ? "bg-blue-50/35"
            : "bg-emerald-50/25",
    },
  ];
  const financialMetrics = [
    {
      label: "GCash",
      value: formatMoney(totals.gcashSales),
      detail: "Verified digital payments",
      icon: CreditCard,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Refunds",
      value: formatMoney(totals.refunds),
      detail: `${formatMoney(totals.cashRefunds)} returned from drawer`,
      icon: RotateCcw,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Discounts",
      value: formatMoney(totals.discounts),
      detail: "Completed transactions",
      icon: Percent,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Voids",
      value: formatMoney(totals.voids),
      detail: "Retained audit records",
      icon: XCircle,
      tone: "bg-zinc-100 text-zinc-700",
    },
    {
      label: "Transaction Count",
      value: String(totals.transactionCount),
      detail: `${totals.ordersProcessed} orders processed`,
      icon: FileText,
      tone: "bg-orange-50 text-orange-700",
    },
  ];

  return (
    <div className="space-y-3">
      <section
        className="rrj-card overflow-hidden border-primary/20 shadow-[0_10px_28px_rgba(67,42,23,0.06)]"
        aria-label="Cash Reconciliation"
      >
        <div className="border-b border-border/80 bg-gradient-to-r from-amber-50/65 to-transparent px-4 py-3.5 sm:px-5">
          <SectionHeading
            title="Cash Reconciliation"
            description="Compare the drawer opening, expected balance, physical count, and resulting variance."
          />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {reconciliationMetrics.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className={`min-w-0 border-border/70 p-4 sm:p-5 ${index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""} ${index === 3 ? "sm:border-t xl:border-t-0" : ""} ${item.surface}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.03] ${item.tone}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p
                  className="mt-2 truncate text-xl font-black tracking-[-0.025em] text-foreground"
                  title={item.value}
                >
                  {item.value}
                </p>
                <p
                  className="mt-1 truncate text-[9px] font-medium text-muted-foreground"
                  title={item.detail}
                >
                  {item.detail}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-2xl border border-border/80 bg-[#fffaf5]/60 px-4 py-3.5 shadow-[0_2px_10px_rgba(67,42,23,0.025)] sm:px-5"
        aria-labelledby="shift-financial-summary-title"
      >
        <div className="mb-3">
          <h2
            id="shift-financial-summary-title"
            className="text-[10px] font-black uppercase tracking-widest text-foreground/65"
          >
            Financial Summary
          </h2>
          <p className="mt-1 text-[9px] text-muted-foreground">
            Supporting digital payment and transaction activity for this shift
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-5">
          {financialMetrics.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="flex min-w-0 items-start gap-2.5 border-border/70 lg:border-l lg:pl-4 lg:first:border-l-0 lg:first:pl-0"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-black/[0.03] ${item.tone}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                  <p
                    className="mt-0.5 truncate text-sm font-black text-foreground"
                    title={item.value}
                  >
                    {item.value}
                  </p>
                  <p
                    className="mt-0.5 truncate text-[9px] text-muted-foreground"
                    title={item.detail}
                  >
                    {item.detail}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
