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
import { SummaryCard } from "../components";
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
  const cards = [
    {
      label: "Opening Cash",
      value: formatMoney(shift.openingCash),
      detail: "Recorded when shift opened",
      icon: Banknote,
      tone: "bg-amber-50 text-primary",
    },
    {
      label: "Expected Cash",
      value: formatMoney(totals.expectedCash),
      detail: `Cash sales ${formatMoney(totals.cashSales)} · cash refunds ${formatMoney(totals.cashRefunds)}`,
      icon: ReceiptText,
      tone: "bg-orange-50 text-primary",
    },
    {
      label: "Actual Cash Count",
      value:
        shift.actualCash !== undefined
          ? formatMoney(shift.actualCash)
          : "Not counted",
      detail: "Physical drawer count",
      icon: Banknote,
      tone: "bg-amber-50 text-primary",
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
    },
    {
      label: "GCash Summary",
      value: formatMoney(totals.gcashSales),
      detail: "Verified digital payments",
      icon: CreditCard,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Refund Summary",
      value: formatMoney(totals.refunds),
      detail: `${formatMoney(totals.cashRefunds)} returned from drawer`,
      icon: RotateCcw,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Discount Summary",
      value: formatMoney(totals.discounts),
      detail: "Completed transactions",
      icon: Percent,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Void Summary",
      value: formatMoney(totals.voids),
      detail: "Retained audit records",
      icon: XCircle,
      tone: "bg-zinc-100 text-zinc-700",
    },
    {
      label: "Transactions Count",
      value: String(totals.transactionCount),
      detail: `${totals.ordersProcessed} orders processed`,
      icon: FileText,
      tone: "bg-orange-50 text-orange-700",
    },
  ];

  return (
    <section
      className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5"
      aria-label="Shift financial summary"
    >
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </section>
  );
}
