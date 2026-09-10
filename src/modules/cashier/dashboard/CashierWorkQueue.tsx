import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { CashierButton } from "../components";
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
  actionsEnabled,
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
  actionsEnabled: boolean;
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
        (item) =>
          item.nextAction !== "view_details" || item.isDelayed,
      );
    } else if (view === "ready_for_handoff") {
      next = next.filter(
        (item) => item.nextAction === "release_order",
      );
    }

    if (attentionFilter === "payments") {
      next = next.filter(
        (item) => item.nextAction === "verify_payment",
      );
    } else if (attentionFilter === "ready") {
      next = next.filter(
        (item) => item.nextAction === "release_order",
      );
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

  const emptyState = useMemo(() => {
    if (attentionFilter === "payments") {
      return {
        title: "No payment-pending orders",
        description:
          "There are currently no orders waiting for payment verification.",
      };
    }

    if (attentionFilter === "ready") {
      return {
        title: "No orders ready for handoff",
        description:
          "Orders will appear here once they are ready to be released.",
      };
    }

    if (attentionFilter === "delayed") {
      return {
        title: "No delayed orders",
        description:
          "There are currently no delayed orders requiring review.",
      };
    }

    if (view === "action_required") {
      return {
        title: "No orders need attention",
        description:
          "There are no pending cashier actions at the moment.",
      };
    }

    if (view === "ready_for_handoff") {
      return {
        title: "No orders ready for handoff",
        description:
          "Prepared orders will appear here when they are ready to release.",
      };
    }

    return {
      title: "No active orders",
      description:
        "New orders will appear here when cashier processing begins.",
    };
  }, [attentionFilter, view]);

  const canResetEmptyState =
    Boolean(attentionFilter) || view !== "all_active";

  const resetEmptyState = () => {
    if (attentionFilter) {
      onClearAttentionFilter();
      return;
    }

    onViewChange("all_active");
  };

  return (
    <section
      className="rrj-card overflow-hidden"
      aria-labelledby="cashier-work-queue-title"
    >
      <div className="border-b border-border/80 bg-[#fffaf5]/65 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2
              id="cashier-work-queue-title"
              className="text-[15px] font-black tracking-tight text-foreground"
            >
              Cashier Work Queue
            </h2>

            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
              Review active orders and complete the next required action.
            </p>
          </div>

          <div
            className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1"
            role="tablist"
            aria-label="Cashier work queue views"
          >
            {(Object.keys(VIEW_LABELS) as CashierQueueView[]).map(
              (tab) => {
                const selected = view === tab;

                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => onViewChange(tab)}
                    className={[
                      "flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg",
                      "px-3 text-[10px] font-black transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected
                        ? "bg-white text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-white/60 hover:text-foreground",
                    ].join(" ")}
                  >
                    <span>{VIEW_LABELS[tab]}</span>

                    <span
                      className={[
                        "inline-flex min-w-5 items-center justify-center rounded-full",
                        "px-1.5 py-0.5 text-[9px]",
                        selected
                          ? "bg-primary/10 text-primary"
                          : "bg-black/5 text-muted-foreground",
                      ].join(" ")}
                    >
                      {tabCounts[tab]}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {attentionFilter ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground">
              Active filter
            </span>

            <button
              type="button"
              onClick={onClearAttentionFilter}
              className="
                inline-flex min-h-8 items-center gap-2 rounded-full
                border border-primary/20 bg-primary/5
                px-3 text-[10px] font-black text-primary
                transition hover:bg-primary/10
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-primary
              "
              aria-label={`Clear ${FILTER_LABELS[attentionFilter]} filter`}
            >
              {FILTER_LABELS[attentionFilter]}
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex min-h-[154px] flex-col items-center justify-center px-6 py-6 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white shadow-sm">
            <CheckCircle2
              className="h-4.5 w-4.5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <h3 className="mt-3 text-sm font-black text-foreground">
            {emptyState.title}
          </h3>

          <p className="mt-1.5 max-w-sm text-[11px] font-medium leading-5 text-muted-foreground">
            {emptyState.description}
          </p>

          {canResetEmptyState ? (
            <CashierButton
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={resetEmptyState}
            >
              {attentionFilter
                ? "Clear filter"
                : "View all active orders"}
            </CashierButton>
          ) : null}
        </div>
      ) : (
        <div className="max-h-[520px] divide-y divide-border/80 overflow-y-auto">
          {visibleItems.map((item) => {
            const order = orders.find(
              (entry) => entry.id === item.orderId,
            );

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
                className={[
                  "grid min-h-[74px] gap-2.5 px-4 py-3",
                  "transition-colors sm:grid-cols-[minmax(0,1fr)_auto]",
                  "sm:items-center sm:px-5",
                  item.isDelayed
                    ? "border-l-4 border-l-red-500 bg-red-50/45"
                    : "border-l-4 border-l-transparent hover:bg-amber-50/25",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(order)}
                  className="
                    min-w-0 rounded-lg text-left
                    focus-visible:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-primary
                    focus-visible:ring-offset-2
                  "
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
                    className="min-w-[116px]"
                    disabled={
                      item.nextAction !== "view_details" &&
                      !actionsEnabled
                    }
                    loading={loadingOrderId === item.orderId}
                    loadingLabel="Working…"
                    onClick={() => {
                      if (item.nextAction === "verify_payment") {
                        onVerify(order);
                      } else if (
                        item.nextAction === "release_order"
                      ) {
                        onRelease(order);
                      } else {
                        onSelect(order);
                      }
                    }}
                  >
                    {item.isDelayed &&
                    item.nextAction === "view_details" ? (
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
