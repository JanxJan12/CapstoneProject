import { AlertTriangle } from "lucide-react";
import type {
  CashierAttentionFilter,
  CashierAttentionSummary,
} from "../types";

interface AttentionItem {
  filter: CashierAttentionFilter;
  count: number;
  singular: string;
  plural: string;
  urgent?: boolean;
}

export function AttentionSummary({
  attention,
  onFilter,
}: {
  attention: CashierAttentionSummary;
  onFilter: (filter: CashierAttentionFilter) => void;
}) {
  const items: AttentionItem[] = [
    {
      filter: "payments",
      count: attention.pendingPayments,
      singular: "payment pending",
      plural: "payments pending",
    },
    {
      filter: "ready",
      count: attention.readyOrders,
      singular: "order ready",
      plural: "orders ready",
    },
    {
      filter: "delayed",
      count: attention.delayedOrders,
      singular: "delayed order",
      plural: "delayed orders",
      urgent: true,
    },
  ];

  const visibleItems = items.filter((item) => item.count > 0);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section
      className="
        flex min-h-11 flex-wrap items-center gap-2
        rounded-xl border border-amber-200/70
        bg-amber-50/55 px-3 py-2
        sm:px-4
      "
      aria-live="polite"
      aria-label="Cashier attention summary"
    >
      <span className="mr-1 inline-flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-amber-900">
        <AlertTriangle
          className="h-3.5 w-3.5 text-amber-700"
          aria-hidden="true"
        />
        Attention
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        {visibleItems.map((item) => {
          const label =
            item.count === 1 ? item.singular : item.plural;

          return (
            <button
              key={item.filter}
              type="button"
              onClick={() => onFilter(item.filter)}
              className={[
                "inline-flex min-h-7 items-center gap-1.5 rounded-full",
                "border px-2.5 text-[10px] font-black transition",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-primary focus-visible:ring-offset-1",
                item.urgent
                  ? "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100"
                  : "border-amber-200 bg-white/75 text-amber-900 hover:border-primary/25 hover:bg-white",
              ].join(" ")}
              aria-label={`Filter queue by ${item.count} ${label}`}
            >
              <span
                className={[
                  "inline-flex h-4 min-w-4 items-center justify-center",
                  "rounded-full px-1 text-[9px] text-white",
                  item.urgent ? "bg-red-600" : "bg-primary",
                ].join(" ")}
              >
                {item.count}
              </span>

              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}