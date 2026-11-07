import {
  AlertTriangle,
  ArrowRight,
  X,
} from "lucide-react";
import { CashierButton } from "../components";
import { formatElapsedMinutes, formatMoney } from "../constants";
import { selectCashierQueueView, type partitionCashierWorkQueue } from "./workQueuePresentation";
import type {
  CashierAttentionFilter,
  CashierAttentionSummary,
  CashierActionQueueItem,
  CashierQueueView,
  Order,
} from "../types";

function waitingLabel(item: CashierActionQueueItem) {
  switch (item.stage) {
    case "payment_pending": return "Awaiting payment review";
    case "payment_resubmission": return item.currentStage === "Payment resubmission needed"
      ? "Awaiting customer resubmission" : "Awaiting payment";
    case "kitchen_queue": return "In kitchen queue";
    case "preparing": return "In preparation";
    case "ready_for_handoff": return item.nextAction === "release_order"
      ? "Ready for handoff" : "Rider offer pending in Kitchen";
    case "rider_assignment": return "Waiting for rider";
    case "rider_assigned": return "Rider accepted";
    case "picked_up": return "Picked up";
    case "out_for_delivery": return "Out for delivery";
  }
}

function compactDuration(minutes: number) {
  return formatElapsedMinutes(minutes)
    .replace(/(\d+) hr\b/g, "$1h")
    .replace(/(\d+) min\b/g, "$1m");
}

const VISIBLE_VIEWS = [
  "action_required",
  "current_orders",
  "all_active",
] as const satisfies readonly CashierQueueView[];

const VIEW_LABELS: Record<(typeof VISIBLE_VIEWS)[number], string> = {
  action_required: "Needs action",
  current_orders: "Current orders",
  all_active: "All unresolved",
};

const FILTER_LABELS: Record<CashierAttentionFilter, string> = {
  payments: "Payment pending",
  ready: "Ready for handoff",
  delayed: "Past stage threshold",
};

export function CashierWorkQueue({
  queue,
  attention,
  view,
  attentionFilter,
  orders,
  onViewChange,
  onClearAttentionFilter,
  onSelect,
  onVerify,
}: {
  queue: ReturnType<typeof partitionCashierWorkQueue>;
  attention: CashierAttentionSummary;
  view: CashierQueueView;
  attentionFilter?: CashierAttentionFilter;
  orders: Order[];
  onViewChange: (view: CashierQueueView) => void;
  onClearAttentionFilter: () => void;
  onSelect: (order: Order) => void;
  onVerify: (order: Order) => void;
}) {
  const visibleItems = selectCashierQueueView(queue, view, attentionFilter);

  const tabCounts: Record<(typeof VISIBLE_VIEWS)[number], number> = {
    action_required: attention.actionRequired,
    current_orders: queue.current.length,
    all_active: attention.allActive,
  };

  const emptyState = (() => {
    if (attentionFilter === "payments") {
      return {
        title: "No payment-pending orders",
        description:
          "There are currently no orders waiting for payment verification.",
      };
    }

    if (attentionFilter === "ready") {
      return {
        title: "No current orders ready for handoff",
        description:
          "Older ready orders remain available in All unresolved.",
      };
    }

    if (attentionFilter === "delayed") {
      return {
        title: "No current stage delays",
        description:
          "No current orders have passed a configured stage threshold.",
      };
    }

    if (view === "action_required") {
      return {
        title: "Nothing needs action now",
        description: queue.current.length
          ? `${queue.current.length} current order${queue.current.length === 1 ? " is" : "s are"} still in progress.`
          : queue.older.length
            ? `${queue.older.length} older unresolved order${queue.older.length === 1 ? " remains" : "s remain"}.`
            : "New orders will appear here.",
      };
    }

    if (view === "current_orders") {
      return {
        title: "No current orders in progress",
        description: queue.older.length
          ? `${queue.older.length} older unresolved order${queue.older.length === 1 ? " remains" : "s remain"} in the backlog.`
          : "New orders will appear here when they begin processing.",
      };
    }

    return {
      title: "No active orders",
      description:
        "New orders will appear here when cashier processing begins.",
    };
  })();


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
              className="text-lg font-black tracking-tight text-foreground"
            >
              Work queue
            </h2>
          </div>

          {!attentionFilter ? <div
            className="grid w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 xl:w-auto"
            role="group"
            aria-label="Cashier work queue views"
          >
            {VISIBLE_VIEWS.map(
              (tab) => {
                const selected = view === tab;

                return (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onViewChange(tab)}
                    className={[
                      "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg",
                      "px-1.5 text-[13px] font-semibold transition sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3.5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected
                        ? "bg-white text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-white/60 hover:text-foreground",
                    ].join(" ")}
                  >
                    <span className="text-center leading-4">{VIEW_LABELS[tab]}</span>

                    <span
                      className={[
                        "inline-flex min-w-5 items-center justify-center rounded-full",
                        "px-1.5 py-0.5 text-xs font-bold",
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
          </div> : null}
        </div>

        {attentionFilter ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground">
              Active filter · {attentionFilter === "payments" ? "all dates" : "current orders"}
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
        <div className="flex min-h-20 flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h3 className="text-sm font-black text-foreground">{emptyState.title}</h3>
            <p className="mt-1 text-[11px] font-medium leading-4 text-muted-foreground">{emptyState.description}</p>
          </div>
        </div>
      ) : (
        <div className="max-h-[520px] divide-y divide-border/80 overflow-y-auto">
          {visibleItems.map((item) => {
            const order = orders.find(
              (entry) => entry.id === item.orderId,
            );

            if (!order) return null;
            const older = queue.older.includes(item);
            const overdue = !older && (item.isDelayed || item.orderAgeReview);
            const hasStageTime = Number.isFinite(new Date(item.stageStartedAt).getTime());
            const stageLabel = waitingLabel(item);

            const actionLabel =
              item.nextAction === "verify_payment"
                ? "Verify Payment"
                : item.nextAction === "release_order"
                  ? "Review & Release"
                  : item.isDelayed && !older
                    ? "View Status"
                    : "View Details";

            return (
              <article
                key={item.orderId}
                className={[
                  "grid min-h-[80px] gap-2.5 px-4 py-2.5",
                  "transition-colors sm:grid-cols-[minmax(0,1fr)_auto]",
                  "sm:items-center sm:px-5",
                  item.isDelayed && !older
                    ? "border-l-4 border-l-red-500 bg-red-50/45"
                    : "border-l-4 border-l-transparent hover:bg-amber-50/25",
                ].join(" ")}
              >
                <div className="flex min-h-11 min-w-0 items-center text-left">
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <strong className="font-mono text-[13px] text-primary">
                          {item.orderId}
                        </strong>

                        <span className="min-w-0 break-words text-sm font-black text-foreground">
                          {item.customerName}
                        </span>
                      </span>

                      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold leading-5 text-muted-foreground">
                        {older ? (
                          <>
                            <span className="font-black text-amber-800">Older unresolved</span>
                            <span aria-hidden="true">·</span>
                          </>
                        ) : null}
                        <span>{item.orderType}</span>
                        {item.currentStage !== stageLabel ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                item.isDelayed && !older
                                  ? "font-black text-red-700"
                                  : "font-bold text-foreground/75"
                              }
                            >
                              {item.currentStage}
                            </span>
                          </>
                        ) : null}

                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold leading-5 text-muted-foreground">
                        <span>
                          {hasStageTime
                            ? `${stageLabel} · ${compactDuration(item.waitingMinutes)}`
                            : "Stage time unavailable"}
                        </span>
                        {overdue ? (
                          <span
                            className="rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-800"
                            aria-label={item.isDelayed && item.orderAgeReview
                              ? "Overdue: stage and order age review thresholds passed"
                              : item.isDelayed
                                ? "Overdue: stage threshold passed"
                                : "Overdue: order age review threshold passed"}
                          >
                            Overdue
                          </span>
                        ) : null}
                      </span>
                    </span>

                    <strong className="shrink-0 text-sm font-black text-foreground sm:hidden">
                      {formatMoney(item.totalAmount)}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <strong className="hidden min-w-[82px] text-right text-sm font-black text-foreground sm:block">
                    {formatMoney(item.totalAmount)}
                  </strong>

                  <CashierButton
                    variant={
                      item.nextAction === "view_details"
                        ? "secondary"
                        : "primary"
                    }
                    size="md"
                    className="min-w-[170px] min-h-11 w-full text-[13px] sm:w-auto"
                    onClick={() => {
                      if (item.nextAction === "verify_payment") {
                        onVerify(order);
                      } else {
                        onSelect(order);
                      }
                    }}
                  >
                    {item.isDelayed && !older &&
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
