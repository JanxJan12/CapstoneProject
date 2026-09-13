import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { CashierButton, ErrorBanner } from "../../cashier/components";

import {
  DEFAULT_DELAY_THRESHOLD_MINUTES,
  formatElapsed,
  formatMoney,
  minutesSince,
} from "../../cashier/constants";

import {
  advanceKdsOrder,
  fetchKdsQueue,
  loadKdsSession,
  type KdsFulfillmentType,
  type KdsOrderStatus,
  type KdsQueueTicket,
} from "../services/kdsTerminalService";

const COLUMNS: KdsOrderStatus[] = ["confirmed", "preparing", "ready"];

export function KitchenQueue() {
  const [tickets, setTickets] = useState<KdsQueueTicket[]>([]);

  const [loadingQueue, setLoadingQueue] = useState(true);

  const [loadingId, setLoadingId] = useState<string>();

  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    const credential = loadKdsSession();

    if (!credential) {
      setError(
        "Kitchen terminal session is missing. Deactivate and activate the terminal again.",
      );

      setLoadingQueue(false);
      return;
    }

    setError("");

    try {
      const queue = await fetchKdsQueue(credential);

      setTickets(queue);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the kitchen queue.",
      );
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();

    const interval = window.setInterval(() => {
      void loadQueue();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadQueue]);

  const advance = async (ticket: KdsQueueTicket) => {
    const credential = loadKdsSession();

    if (!credential) {
      setError(
        "Kitchen terminal session is missing. Deactivate and activate the terminal again.",
      );
      return;
    }

    setLoadingId(ticket.databaseId);
    setError("");

    try {
      const result = await advanceKdsOrder(credential, ticket.databaseId);

      const nextStatus =
        result.currentStatus === "preparing" ? "Preparing" : "Ready";

      toast.success(
        `${ticket.orderNumber} marked ${nextStatus.toLowerCase()}`,
        {
          description:
            result.currentStatus === "ready"
              ? "The order is ready for the next handoff."
              : "Kitchen preparation has started.",
        },
      );

      /*
       * Reload from PostgreSQL after the mutation.
       *
       * We do not manually move the card in React because
       * PostgreSQL remains the source of truth.
       */
      await loadQueue();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the kitchen ticket.",
      );
    } finally {
      setLoadingId(undefined);
    }
  };

  return (
    <div className="kitchen-queue flex min-w-0 flex-col gap-4">
      <header className="kitchen-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <ChefHat className="h-6 w-6 shrink-0" aria-hidden="true" />
              Kitchen Queue
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Oldest orders first in each queue.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              role="status"
              className="kitchen-queue-health text-sm font-semibold text-muted-foreground"
            >
              {loadingQueue
                ? "Refreshing queue…"
                : error
                  ? "Queue needs attention"
                  : "Queue loaded"}
            </span>

            <span className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-foreground">
              {loadingQueue && !tickets.length
                ? "—"
                : error && !tickets.length
                  ? "—"
                  : tickets.length}{" "}
              active
            </span>

            <CashierButton
              variant="secondary"
              size="sm"
              className="kitchen-secondary-action"
              loadingLabel="Refreshing…"
              loading={loadingQueue}
              disabled={loadingQueue}
              onClick={() => {
                setLoadingQueue(true);
                void loadQueue();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </CashierButton>
          </div>
        </div>
      </header>

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setLoadingQueue(true);
            void loadQueue();
          }}
        />
      ) : null}

      <div className="kitchen-board grid items-start gap-4">
        {COLUMNS.map((status) => {
          const columnTickets = tickets
            .filter((ticket) => ticket.status === status)
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );

          return (
            <section
              key={status}
              data-status={status}
              aria-label={`${formatKitchenStatus(status)} orders`}
              className="kitchen-column min-w-0 overflow-hidden rounded-xl border border-border"
            >
              <div className="kitchen-column-heading flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    {status === "confirmed" ? (
                      <PlayCircle
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : status === "preparing" ? (
                      <ChefHat
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {formatKitchenStatus(status)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status === "confirmed"
                      ? "New kitchen work"
                      : status === "preparing"
                        ? "Preparation in progress"
                        : "Preparation finished"}
                  </p>
                </div>

                <span className="kitchen-column-count flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-lg font-bold tabular-nums">
                  {(loadingQueue || error) && !tickets.length
                    ? "—"
                    : columnTickets.length}
                </span>
              </div>

              <div className="kitchen-column-body space-y-3 p-3">
                {columnTickets.length ? (
                  columnTickets.map((ticket) => (
                    <KitchenTicket
                      key={ticket.databaseId}
                      ticket={ticket}
                      loading={loadingId === ticket.databaseId}
                      onAdvance={() => void advance(ticket)}
                    />
                  ))
                ) : (
                  <div className="kitchen-column-empty" role="status">
                    <p className="text-sm font-semibold">
                      {loadingQueue
                        ? "Loading orders…"
                        : error
                          ? "Queue unavailable"
                          : `No ${formatKitchenStatus(status).toLowerCase()} orders`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {loadingQueue
                        ? "Checking the kitchen queue."
                        : error
                          ? "Check the message above."
                          : status === "confirmed"
                            ? "New kitchen orders will appear here."
                            : status === "preparing"
                              ? "Start an order from Confirmed."
                              : "Orders appear here when marked ready."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KitchenTicket({
  ticket,
  loading,
  onAdvance,
}: {
  ticket: KdsQueueTicket;
  loading: boolean;
  onAdvance: () => void;
}) {
  const delayed =
    minutesSince(ticket.createdAt) > DEFAULT_DELAY_THRESHOLD_MINUTES;

  const ready = ticket.status === "ready";

  const status = formatKitchenStatus(ticket.status);

  return (
    <article
      aria-label={`${ticket.orderNumber}, ${status}`}
      className={`kitchen-ticket rounded-xl border bg-white p-4 ${
        ready && delayed
          ? "border-red-100 bg-red-50/20"
          : delayed
            ? "border-red-300"
            : "border-border"
      }`}
    >
      <div className="kitchen-ticket-heading flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="kitchen-order-number font-mono text-xl font-bold tracking-tight text-foreground">
            {ticket.orderNumber}
          </h3>

          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {formatFulfillmentType(ticket.fulfillmentType)}
          </p>
        </div>

        <div
          className={`kitchen-timer rounded-lg ${
            ready ? "px-2.5 py-1.5" : "px-3 py-2"
          } ${
            ready
              ? delayed
                ? "bg-red-50/50 text-slate-600"
                : "bg-slate-50 text-slate-600"
              : delayed
                ? "bg-red-50 text-red-800"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          <p
            className={`flex items-center gap-2 tabular-nums ${
              ready ? "text-sm font-semibold" : "text-xl font-bold"
            }`}
          >
            {delayed ? (
              <AlertTriangle
                className={`${ready ? "h-4 w-4" : "h-5 w-5"} shrink-0`}
                aria-hidden="true"
              />
            ) : (
              <Clock3
                className={`${ready ? "h-4 w-4" : "h-5 w-5"} shrink-0`}
                aria-hidden="true"
              />
            )}
            {formatElapsed(ticket.createdAt)}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              ready ? "font-medium text-slate-500" : "font-semibold"
            }`}
          >
            {delayed ? "Delayed · since ordered" : "Since ordered"}
          </p>
        </div>
      </div>

      <ul
        className="kitchen-ticket-items mt-4 border-y border-border"
        tabIndex={0}
        aria-label={`Items for ${ticket.orderNumber}`}
      >
        {ticket.items.map((item) => (
          <li
            key={item.id}
            className="kitchen-ticket-item grid gap-x-3 gap-y-1 py-3"
          >
            <strong className="kitchen-item-quantity flex h-9 min-w-9 items-center justify-center rounded-lg bg-slate-100 px-1 text-lg tabular-nums">
              {item.quantity}×
            </strong>
            <div className="min-w-0">
              <span className="text-base font-semibold leading-snug">
                {item.name}
              </span>

              {item.specialInstructions ? (
                <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-900">
                  {item.specialInstructions}
                </p>
              ) : null}
            </div>

            <span className="kitchen-item-price text-xs text-muted-foreground">
              {formatMoney(item.unitPrice * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {ticket.notes ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Order instructions: {ticket.notes}
        </p>
      ) : null}

      <div className="mt-4">
        {ticket.status !== "ready" ? (
          <CashierButton
            className="kitchen-next-action min-h-12 w-full px-3 text-base"
            loadingLabel={
              ticket.status === "confirmed"
                ? "Starting preparation…"
                : "Marking ready…"
            }
            loading={loading}
            disabled={loading}
            onClick={onAdvance}
          >
            {ticket.status === "confirmed" ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}

            {ticket.status === "confirmed" ? "Start Preparing" : "Mark Ready"}
          </CashierButton>
        ) : (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-3 text-base font-bold text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            Preparation finished · awaiting handoff
          </p>
        )}
      </div>
    </article>
  );
}

function formatKitchenStatus(
  status: KdsOrderStatus,
): "Confirmed" | "Preparing" | "Ready" {
  switch (status) {
    case "confirmed":
      return "Confirmed";

    case "preparing":
      return "Preparing";

    case "ready":
      return "Ready";
  }
}

function formatFulfillmentType(type: KdsFulfillmentType) {
  switch (type) {
    case "delivery":
      return "Delivery";

    case "takeout":
      return "Take-out";

    case "dine_in":
      return "Dine-in";
  }
}
