import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { CashierButton, ErrorBanner } from "../../cashier/components";

import {
  formatElapsed,
  formatMoney,
} from "../../cashier/constants";

import {
  advanceKdsOrder,
  fetchKdsQueue,
  loadKdsSession,
  KdsTerminalError,
  type KdsFulfillmentType,
  type KdsOrderStatus,
  type KdsQueueTicket,
} from "../services/kdsTerminalService";

const COLUMNS: KdsOrderStatus[] = ["confirmed", "preparing", "ready"];

export function KitchenQueue({ onAccessLost }: { onAccessLost: () => void }) {
  const [tickets, setTickets] = useState<KdsQueueTicket[]>([]);

  const [loadingQueue, setLoadingQueue] = useState(true);

  const [loadingId, setLoadingId] = useState<string>();

  const [error, setError] = useState("");
  const refreshInFlight = useRef(false);
  const loadVersion = useRef(0);
  const advanceInFlight = useRef(new Set<string>());

  const loadQueue = useCallback(async (force = false): Promise<boolean> => {
    if (refreshInFlight.current && !force) return false;
    const version = ++loadVersion.current;
    refreshInFlight.current = true;
    setLoadingQueue(true);
    const credential = loadKdsSession();

    if (!credential) {
      setTickets([]);
      setLoadingQueue(false);
      refreshInFlight.current = false;
      onAccessLost();
      return false;
    }

    setError("");

    try {
      const queue = await fetchKdsQueue(credential);

      if (version === loadVersion.current) setTickets(queue);
      return version === loadVersion.current;
    } catch (caught) {
      if (version === loadVersion.current) {
        setTickets([]);
        if (caught instanceof KdsTerminalError && caught.kind === "credential") {
          onAccessLost();
        } else {
          setError(caught instanceof KdsTerminalError ? caught.message : "The kitchen queue is unavailable. Check the connection and try again.");
        }
      }
      return false;
    } finally {
      if (version === loadVersion.current) {
        setLoadingQueue(false);
        refreshInFlight.current = false;
      }
    }
  }, [onAccessLost]);

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
    if (advanceInFlight.current.has(ticket.databaseId)) return;
    const credential = loadKdsSession();

    if (!credential) {
      setTickets([]);
      onAccessLost();
      return;
    }

    advanceInFlight.current.add(ticket.databaseId);
    setLoadingId(ticket.databaseId);
    setError("");

    try {
      const result = await advanceKdsOrder(credential, ticket.databaseId, ticket.status );

      const nextStatus = result.currentStatus === "preparing" ? "preparing"
        : result.currentStatus === "waiting_for_rider" ? "ready and offered to a rider" : "ready";

      /*
       * Reload from PostgreSQL after the mutation.
       *
       * We do not manually move the card in React because
       * PostgreSQL remains the source of truth.
       */
      const refreshed = await loadQueue(true);
      if (refreshed) {
        toast.success(`${ticket.orderNumber} ${ticket.status === "ready" ? "checked" : `marked ${nextStatus}`}`, {
          description: result.currentStatus === "waiting_for_rider"
            ? "The order was offered to an eligible rider. Pickup still requires the rider's confirmation."
            : result.currentStatus === "ready" && ticket.fulfillmentType === "delivery" && ticket.orderChannel === "online"
              ? "No eligible rider is available. The order remains in Ready; retry the offer here when a rider is available."
              : result.currentStatus === "ready"
                ? "The order is ready for the next handoff."
                : "Kitchen preparation has started.",
        });
      } else {
        setError("The order update was accepted, but the current queue could not be loaded. Refresh before taking another action.");
      }
    } catch (caught) {
      setTickets([]);
      if (caught instanceof KdsTerminalError && caught.kind === "credential") {
        onAccessLost();
      } else if (caught instanceof KdsTerminalError && caught.kind === "conflict") {
        const refreshed = await loadQueue(true);
        if (refreshed) setError(caught.message);
      } else {
        const refreshed = await loadQueue(true);
        if (refreshed) setError("The order update could not be confirmed. Review its current status before trying again.");
      }
    } finally {
      advanceInFlight.current.delete(ticket.databaseId);
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

      <div className="kitchen-board grid items-start gap-4" aria-busy={loadingQueue}>
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
  const ready = ticket.status === "ready";

  const status = formatKitchenStatus(ticket.status);

  return (
    <article
      aria-label={`${ticket.orderNumber}, ${status}`}
      className="kitchen-ticket rounded-xl border border-border bg-white p-4"
    >
      <div className="kitchen-ticket-heading flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="kitchen-order-number font-mono text-xl font-bold tracking-tight text-foreground">
            {ticket.orderNumber}
          </h3>

          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {ticket.orderChannel === "walk_in" ? "Walk-in" : "Online"} · {formatFulfillmentType(ticket.fulfillmentType)}
          </p>
        </div>

        <div
          className={`kitchen-timer rounded-lg bg-slate-100 text-slate-700 ${ready ? "px-2.5 py-1.5" : "px-3 py-2"}`}
        >
          <p
            className={`flex items-center gap-2 tabular-nums ${
              ready ? "text-sm font-semibold" : "text-xl font-bold"
            }`}
          >
            <Clock3
              className={`${ready ? "h-4 w-4" : "h-5 w-5"} shrink-0`}
              aria-hidden="true"
            />
            {formatElapsed(ticket.createdAt)}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              ready ? "font-medium text-slate-500" : "font-semibold"
            }`}
          >
            Since ordered
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

              {item.modifiers.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-sm text-foreground" aria-label={`Selected options for ${item.name}`}>
                  {item.modifiers.map((modifier) => (
                    <li key={modifier.id}>+ {modifier.name}{modifier.price > 0 ? ` (${formatMoney(modifier.price)})` : ""}</li>
                  ))}
                </ul>
              ) : null}

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
        ) : ticket.fulfillmentType === "delivery" && ticket.orderChannel === "online" ? (
          <div className="space-y-2">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-900">
              Preparation finished · no rider offer yet. Keep this ticket visible until an offer succeeds.
            </p>
            <CashierButton className="min-h-12 w-full" loading={loading} disabled={loading}
              loadingLabel="Checking riders…" onClick={onAdvance}>
              Retry rider offer
            </CashierButton>
          </div>
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
