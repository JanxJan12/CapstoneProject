import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { CashierButton, EmptyState } from "../components";
import { formatMoney } from "../constants";
import type {
  CashierActionQueueItem,
  CashierAttentionFilter,
  CashierAttentionSummary,
  CashierQueueView,
  Order,
} from "../types";

const VIEW_LABELS: Record<CashierQueueView, string> = {
  action_required: "Action Required",
  all_active: "All Active",
  ready_for_handoff: "Ready for Handoff",
};

const FILTER_LABELS: Record<CashierAttentionFilter, string> = {
  payments: "Payment pending",
  ready: "Ready for handoff",
  delayed: "Delayed exceptions",
};

export function CashierWorkQueue({
  items,
  attention,
  view,
  attentionFilter,
  orders,
  loadingOrderId,
  onViewChange,
  onClearAttentionFilter,
  onSelect,
  onVerify,
  onRelease,
}: {
  items: CashierActionQueueItem[];
  attention: CashierAttentionSummary;
  view: CashierQueueView;
  attentionFilter?: CashierAttentionFilter;
  orders: Order[];
  loadingOrderId?: string;
  onViewChange: (view: CashierQueueView) => void;
  onClearAttentionFilter: () => void;
  onSelect: (order: Order) => void;
  onVerify: (order: Order) => void;
  onRelease: (order: Order) => void;
}) {
  const visibleItems = useMemo(() => {
    let next = items;

    if (view === "action_required") {
      next = next.filter(
        (item) => item.nextAction !== "view_details" || item.isDelayed,
      );
    } else if (view === "ready_for_handoff") {
      next = next.filter((item) => item.nextAction === "release_order");
    }

    if (attentionFilter === "payments") {
      next = next.filter((item) => item.nextAction === "verify_payment");
    } else if (attentionFilter === "ready") {
      next = next.filter((item) => item.nextAction === "release_order");
    } else if (attentionFilter === "delayed") {
      next = next.filter((item) => item.isDelayed);
    }

    return next;
  }, [attentionFilter, items, view]);

  const tabCounts: Record<CashierQueueView, number> = {
    action_required: attention.actionRequired,
    all_active: attention.allActive,
    ready_for_handoff: attention.readyOrders,
  };

  return (
    <section
      className="rrj-card flex min-h-[360px] flex-1 flex-col overflow-hidden"
      aria-labelledby="cashier-work-queue-title"
    >
      <div className="border-b border-border/80 bg-[#fffaf5]/65 px-3.5 py-3 sm:px-5">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2
              id="cashier-work-queue-title"
              className="text-sm font-black tracking-tight text-foreground"
            >
              Cashier Work Queue
            </h2>
            <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
              Current state, waiting time, and the next cashier action
            </p>
          </div>
          <div
            className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1"
            role="tablist"
            aria-label="Cashier work queue views"
          >
            {(Object.keys(VIEW_LABELS) as CashierQueueView[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={view === tab}
                onClick={() => onViewChange(tab)}
                className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-[10px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${view === tab ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:bg-white/60 hover:text-foreground"}`}
              >
                {VIEW_LABELS[tab]} {tabCounts[tab]}
              </button>
            ))}
          </div>
        </div>
        {attentionFilter ? (
          <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-primary">
            <span>Filtered: {FILTER_LABELS[attentionFilter]}</span>
            <button
              type="button"
              onClick={onClearAttentionFilter}
              className="rounded-md px-1.5 py-0.5 text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Clear filter
            </button>
          </div>
        ) : null}
      </div>

      {visibleItems.length === 0 ? (
        <div className="grid flex-1 place-items-center p-5">
          <EmptyState
            icon={CheckCircle2}
            title="No orders in this view"
            description="Choose another queue tab or wait for the next cashier action."
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-border/80 overflow-y-auto">
          {visibleItems.map((item) => {
            const order = orders.find((entry) => entry.id === item.orderId);
            if (!order) return null;

            const actionLabel =
              item.nextAction === "verify_payment"
                ? "Verify Payment"
                : item.nextAction === "release_order"
                  ? "Release Order"
                  : item.isDelayed
                    ? "Review Delay"
                    : "View Details";

            return (
              <article
                key={item.orderId}
                className={`grid min-h-[76px] gap-2.5 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 ${item.isDelayed ? "border-l-4 border-l-red-500 bg-red-50/45" : "border-l-4 border-l-transparent hover:bg-amber-50/25"}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(order)}
                  className="min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={`Open details for ${item.orderId}, ${item.customerName}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <strong className="font-mono text-[11px] text-primary">
                          {item.orderId}
                        </strong>
                        <span className="truncate text-[11px] font-black text-foreground">
                          {item.customerName}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold text-muted-foreground">
                        <span>{item.orderType}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            item.isDelayed
                              ? "font-black text-red-700"
                              : "font-bold text-foreground/75"
                          }
                        >
                          {item.currentStage}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Waiting {item.waitingMinutes} min
                          {item.isDelayed ? " · Delayed" : ""}
                        </span>
                      </span>
                    </span>
                    <strong className="shrink-0 text-xs font-black text-foreground sm:hidden">
                      {formatMoney(item.totalAmount)}
                    </strong>
                  </span>
                </button>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <strong className="hidden min-w-[82px] text-right text-xs font-black text-foreground sm:block">
                    {formatMoney(item.totalAmount)}
                  </strong>
                  <CashierButton
                    variant={
                      item.nextAction === "view_details"
                        ? "secondary"
                        : "primary"
                    }
                    size="sm"
                    className="min-w-[122px]"
                    loading={loadingOrderId === item.orderId}
                    loadingLabel="Working…"
                    onClick={() => {
                      if (item.nextAction === "verify_payment") onVerify(order);
                      else if (item.nextAction === "release_order")
                        onRelease(order);
                      else onSelect(order);
                    }}
                  >
                    {item.isDelayed && item.nextAction === "view_details" ? (
                      <AlertTriangle aria-hidden="true" />
                    ) : (
                      <ArrowRight aria-hidden="true" />
                    )}
                    {actionLabel}
                  </CashierButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
