import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock3,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  CashierButton,
  EmptyState,
  ErrorBanner,
  StatusBadge,
} from "../../cashier/components";

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

const COLUMNS: KdsOrderStatus[] = [
  "confirmed",
  "preparing",
  "ready",
];

export function KitchenQueue() {
  const [tickets, setTickets] = useState<
    KdsQueueTicket[]
  >([]);

  const [loadingQueue, setLoadingQueue] =
    useState(true);

  const [loadingId, setLoadingId] =
    useState<string>();

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
      const queue = await fetchKdsQueue(
        credential,
      );

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

  const advance = async (
    ticket: KdsQueueTicket,
  ) => {
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
      const result = await advanceKdsOrder(
        credential,
        ticket.databaseId,
      );

      const nextStatus =
        result.currentStatus === "preparing"
          ? "Preparing"
          : "Ready";

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
    <div className="kitchen-queue flex flex-col gap-5">
      <header className="kitchen-heading relative overflow-hidden rounded-[22px] border border-orange-200/70 bg-gradient-to-br from-[#fffaf2] via-white to-orange-50/70 p-5 shadow-[0_18px_40px_rgba(95,52,20,0.06)] sm:p-6">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-orange-200/35 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/75">
              <ChefHat className="h-3.5 w-3.5" />
              Kitchen command board
            </p>

            <h1 className="font-['Fraunces'] text-3xl font-bold tracking-[-0.035em]">
              Kitchen Queue
            </h1>

            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">
              Confirmed restaurant orders ready for
              kitchen preparation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]" />
              Kitchen online
            </span>

            <span className="rounded-full border border-border bg-white/80 px-3 py-1.5 text-[10px] font-black text-foreground">
              {tickets.length} active
            </span>

            <CashierButton
              variant="secondary"
              size="sm"
              loading={loadingQueue}
              disabled={loadingQueue}
              onClick={() => {
                setLoadingQueue(true);
                void loadQueue();
              }}
            >
              <RefreshCw
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
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

      <div className="kitchen-board grid gap-4 xl:grid-cols-3">
        {COLUMNS.map((status) => {
          const columnTickets = tickets
            .filter(
              (ticket) =>
                ticket.status === status,
            )
            .sort(
              (a, b) =>
                new Date(
                  a.createdAt,
                ).getTime() -
                new Date(
                  b.createdAt,
                ).getTime(),
            );

          return (
            <section
              key={status}
              data-status={status}
              className="kitchen-column overflow-hidden rounded-2xl border border-border bg-card shadow-[0_16px_36px_rgba(67,42,23,0.055)]"
            >
              <div className="kitchen-column-heading flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-primary" />

                  <h2 className="text-sm font-black">
                    {formatKitchenStatus(status)}
                  </h2>
                </div>

                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-[10px] font-black text-primary">
                  {columnTickets.length}
                </span>
              </div>

              <div className="space-y-3 p-3">
                {columnTickets.length ? (
                  columnTickets.map((ticket) => (
                    <KitchenTicket
                      key={ticket.databaseId}
                      ticket={ticket}
                      loading={
                        loadingId ===
                        ticket.databaseId
                      }
                      onAdvance={() =>
                        void advance(ticket)
                      }
                    />
                  ))
                ) : (
                  <EmptyState
                    title={`No ${formatKitchenStatus(
                      status,
                    ).toLowerCase()} tickets`}
                    description={
                      loadingQueue
                        ? "Loading kitchen tickets..."
                        : "Orders will move here as the kitchen workflow advances."
                    }
                  />
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
    minutesSince(ticket.createdAt) >
    DEFAULT_DELAY_THRESHOLD_MINUTES;

  const status =
    formatKitchenStatus(ticket.status);

  return (
    <article
      className={`kitchen-ticket rounded-xl border p-4 ${
        delayed
          ? "border-red-200 bg-red-50/60"
          : "border-border bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-black text-primary">
            {ticket.orderNumber}
          </p>

          <p className="mt-1 text-xs font-bold">
            {formatFulfillmentType(
              ticket.fulfillmentType,
            )}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={status} />

          {delayed ? (
            <span className="flex items-center gap-1 text-[10px] font-black text-red-700">
              <AlertTriangle className="h-3 w-3" />
              Delayed
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-3 space-y-1 border-y border-border py-3">
        {ticket.items.map((item) => (
          <li
            key={item.id}
            className="flex justify-between gap-3 text-xs"
          >
            <div>
              <span>
                <strong>
                  {item.quantity}×
                </strong>{" "}
                {item.name}
              </span>

              {item.specialInstructions ? (
                <p className="mt-1 text-[10px] font-semibold text-amber-800">
                  {item.specialInstructions}
                </p>
              ) : null}
            </div>

            <span className="shrink-0 text-muted-foreground">
              {formatMoney(
                item.unitPrice *
                  item.quantity,
              )}
            </span>
          </li>
        ))}
      </ul>

      {ticket.notes ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-900">
          Instruction: {ticket.notes}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1 text-[10px] font-bold ${
            delayed
              ? "text-red-700"
              : "text-muted-foreground"
          }`}
        >
          <Clock3 className="h-3 w-3" />

          {formatElapsed(
            ticket.createdAt,
          )}{" "}
          elapsed
        </span>

        {ticket.status !== "ready" ? (
          <CashierButton
            className="min-h-10 px-3"
            loading={loading}
            disabled={loading}
            onClick={onAdvance}
          >
            {ticket.status === "confirmed" ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}

            {ticket.status === "confirmed"
              ? "Start preparing"
              : "Mark ready"}
          </CashierButton>
        ) : null}
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

function formatFulfillmentType(
  type: KdsFulfillmentType,
) {
  switch (type) {
    case "delivery":
      return "Delivery";

    case "takeout":
      return "Take-out";

    case "dine_in":
      return "Dine-in";
  }
}