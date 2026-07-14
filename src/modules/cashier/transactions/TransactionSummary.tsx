import {
  Banknote,
  Calculator,
  CreditCard,
  Percent,
  ReceiptText,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { formatMoney } from "../constants";
import type { Transaction } from "../types";

export function TransactionSummary({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const completed = transactions.filter(
    (entry) => entry.status === "Completed",
  );
  const revenue = completed.reduce((sum, entry) => sum + entry.amount, 0);
  const cards = [
    {
      label: "Total Revenue",
      value: formatMoney(revenue),
      detail: `${completed.length} completed`,
      icon: TrendingUp,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Cash Sales",
      value: formatMoney(
        completed
          .filter((entry) => entry.method === "Cash")
          .reduce((sum, entry) => sum + entry.amount, 0),
      ),
      detail: "Filtered cash",
      icon: Banknote,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "GCash Sales",
      value: formatMoney(
        completed
          .filter((entry) => entry.method === "GCash")
          .reduce((sum, entry) => sum + entry.amount, 0),
      ),
      detail: "Filtered GCash",
      icon: CreditCard,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Refunds",
      value: formatMoney(
        transactions
          .filter((entry) => entry.status === "Refunded")
          .reduce(
            (sum, entry) => sum + (entry.refundAmount ?? entry.amount),
            0,
          ),
      ),
      detail: "Returned value",
      icon: RotateCcw,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Voided",
      value: formatMoney(
        transactions
          .filter((entry) => entry.status === "Voided")
          .reduce((sum, entry) => sum + entry.amount, 0),
      ),
      detail: "Audit records",
      icon: ReceiptText,
      tone: "bg-zinc-100 text-zinc-700",
    },
    {
      label: "Discounts",
      value: formatMoney(
        transactions.reduce((sum, entry) => sum + entry.discountAmount, 0),
      ),
      detail: "Senior/PWD only",
      icon: Percent,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Average Value",
      value: formatMoney(completed.length ? revenue / completed.length : 0),
      detail: `${transactions.length} total records`,
      icon: Calculator,
      tone: "bg-orange-50 text-orange-700",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7">
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <div
          key={label}
          className="rrj-card rrj-card-hover group relative overflow-hidden p-3.5"
        >
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/[0.03] transition-transform group-hover:scale-105 ${tone}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-base font-black text-foreground">
            {value}
          </p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">{detail}</p>
        </div>
      ))}
    </div>
  );
}
