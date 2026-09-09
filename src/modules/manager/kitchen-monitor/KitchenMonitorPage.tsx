import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Database, RefreshCw } from "lucide-react";

import { StatusBadge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import {
  getManagerOrders,
  type ManagerOrder,
  type ManagerOrderStatus,
} from "../api/managerApi";

type KitchenStatus = Extract<
  ManagerOrderStatus,
  "confirmed" | "preparing" | "ready"
>;

const COLUMNS: {
  status: KitchenStatus;
  label: string;
  headerClassName: string;
}[] = [
  {
    status: "confirmed",
    label: "Confirmed",
    headerClassName: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    status: "preparing",
    label: "Preparing",
    headerClassName: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    status: "ready",
    label: "Ready",
    headerClassName: "border-violet-200 bg-violet-50 text-violet-700",
  },
];

const KITCHEN_STATUSES = new Set<ManagerOrderStatus>(
  COLUMNS.map((column) => column.status),
);

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load the manager kitchen monitor.";
}

function formatElapsed(createdAt: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function elapsedClassName(createdAt: string): string {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
  );

  if (minutes >= 30) {
    return "border-red-200 bg-red-100 text-red-700";
  }

  if (minutes >= 15) {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }

  return "border-green-200 bg-green-100 text-green-700";
}

function formatTitleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function KitchenMonitorPage() {
  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const managerOrders = await getManagerOrders(500);
      setOrders(
        managerOrders.filter((order) =>
          KITCHEN_STATUSES.has(order.currentStatus),
        ),
      );
    } catch (loadError) {
      setOrders([]);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      ),
    [orders],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">
            Kitchen Monitor
          </h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Read-only PostgreSQL queue; kitchen actions remain in the secured KDS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[9px] font-bold text-muted-foreground sm:inline-flex">
            <Database className="h-3 w-3" /> {orders.length} active
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadQueue()}
            loading={loading}
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2">
        {COLUMNS.map((column) => {
          const columnOrders = sortedOrders.filter(
            (order) => order.currentStatus === column.status,
          );

          return (
            <section
              key={column.status}
              className="flex w-[240px] flex-shrink-0 flex-col gap-2 overflow-hidden sm:w-auto sm:flex-1"
            >
              <div
                className={`flex flex-shrink-0 items-center justify-between rounded-lg border px-3 py-1.5 ${column.headerClassName}`}
              >
                <span className="text-[11px] font-bold">{column.label}</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1 text-[9px] font-bold">
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {columnOrders.map((order) => (
                  <article
                    key={order.id}
                    className="flex-shrink-0 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="mb-1.5 flex justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold text-primary">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${elapsedClassName(
                          order.createdAt,
                        )}`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {formatElapsed(order.createdAt)}
                      </span>
                    </div>

                    <div className="mb-1.5 flex flex-wrap gap-1">
                      <StatusBadge
                        status={
                          order.orderChannel === "walk_in"
                            ? "walk-in"
                            : "delivery"
                        }
                      />
                      <span className="self-center text-[9px] font-semibold text-muted-foreground">
                        {formatTitleCase(order.fulfillmentType)}
                      </span>
                    </div>

                    <p className="mb-2 text-[11px] font-semibold text-foreground">
                      {order.customerName}
                    </p>

                    <div className="flex flex-col gap-1">
                      {order.items.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">
                          No order items were returned.
                        </p>
                      ) : (
                        order.items.map((item, index) => (
                          <div
                            key={`${item.name}-${index}`}
                            className="flex justify-between gap-2 text-[10px]"
                          >
                            <span className="text-muted-foreground">
                              {item.name}
                            </span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">
                              ×{item.quantity}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                ))}

                {columnOrders.length === 0 ? (
                  <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border text-[11px] text-muted-foreground">
                    {loading ? "Loading orders…" : "No orders"}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
