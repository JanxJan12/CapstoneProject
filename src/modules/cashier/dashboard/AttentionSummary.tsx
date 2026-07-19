import { AlertTriangle } from "lucide-react";
import type { CashierAttentionFilter, CashierAttentionSummary } from "../types";

export function AttentionSummary({
  attention,
  onFilter,
}: {
  attention: CashierAttentionSummary;
  onFilter: (filter: CashierAttentionFilter) => void;
}) {
  if (
    attention.pendingPayments === 0 &&
    attention.readyOrders === 0 &&
    attention.delayedOrders === 0
  ) {
    return null;
  }

  const actions: Array<{
    filter: CashierAttentionFilter;
    count: number;
    singular: string;
    plural: string;
    urgent?: boolean;
  }> = [
    {
      filter: "payments",
      count: attention.pendingPayments,
      singular: "payment",
      plural: "payments",
    },
    {
      filter: "ready",
      count: attention.readyOrders,
      singular: "ready order",
      plural: "ready orders",
    },
    {
      filter: "delayed",
      count: attention.delayedOrders,
      singular: "delayed order",
      plural: "delayed orders",
      urgent: true,
    },
  ];
  const visibleActions = actions.filter((item) => item.count > 0);

  return (
    <section
      className="cashier-alert flex min-h-[50px] flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-amber-200/80 bg-amber-50/75 px-3.5 py-2.5"
      aria-live="polite"
      aria-label="Cashier attention summary"
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-950">
        <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
        Needs attention:
      </span>
      {visibleActions.map((item, index) => (
        <span key={item.filter} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span className="text-amber-900/30" aria-hidden="true">
              ·
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onFilter(item.filter)}
            className={`rounded-md px-1 py-0.5 text-[11px] font-black underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${item.urgent ? "text-red-700" : "text-amber-900"}`}
          >
            {item.count} {item.count === 1 ? item.singular : item.plural}
          </button>
        </span>
      ))}
    </section>
  );
}
