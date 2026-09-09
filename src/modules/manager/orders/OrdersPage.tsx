import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MapPin, RefreshCw, Search, X } from "lucide-react";

import { Badge, StatusBadge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
import { ORDER_TIMELINE } from "../../../constants";
import {
  getManagerOrders,
  type ManagerOrder,
  type ManagerOrderStatus,
} from "../api/managerApi";

const ORDER_STATUS_LABELS: Record<ManagerOrderStatus, string> = {
  waiting_payment_verification: "Awaiting Payment",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  waiting_for_rider: "Waiting for Rider",
  rider_accepted: "Rider Accepted",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_BADGE_KEYS: Record<ManagerOrderStatus, string> = {
  waiting_payment_verification: "waiting-payment",
  confirmed: "confirmed",
  preparing: "preparing",
  ready: "ready",
  waiting_for_rider: "waiting-rider",
  rider_accepted: "rider-accepted",
  picked_up: "picked-up",
  out_for_delivery: "out-for-delivery",
  delivered: "delivered",
  completed: "completed",
  cancelled: "cancelled",
  rejected: "rejected",
};

const DELIVERY_STEP_MAP: Partial<Record<ManagerOrderStatus, number>> = {
  waiting_payment_verification: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  waiting_for_rider: 4,
  rider_accepted: 5,
  picked_up: 6,
  out_for_delivery: 7,
  delivered: 8,
  completed: 8,
};

const PICKUP_TIMELINE = [
  "Waiting for Payment",
  "Confirmed",
  "Preparing",
  "Ready",
  "Completed",
];

const PICKUP_STEP_MAP: Partial<Record<ManagerOrderStatus, number>> = {
  waiting_payment_verification: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatOrderTime(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatTitleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load manager orders.";
}

export function OrdersPage() {
  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ManagerOrderStatus | "all">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setOrders(await getManagerOrders());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesSearch =
        !normalizedSearch ||
        order.orderNumber.toLowerCase().includes(normalizedSearch) ||
        order.customerName.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "all" || order.currentStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;
  const timeline =
    selectedOrder?.fulfillmentType === "delivery"
      ? ORDER_TIMELINE
      : PICKUP_TIMELINE;
  const timelineStep = selectedOrder
    ? selectedOrder.fulfillmentType === "delivery"
      ? DELIVERY_STEP_MAP[selectedOrder.currentStatus]
      : PICKUP_STEP_MAP[selectedOrder.currentStatus]
    : undefined;

  return (
    <div className="flex h-full flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Orders</h1>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Read-only order activity from PostgreSQL
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadOrders()}
            loading={loading}
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[190px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number or customer…"
              className="w-full rounded-lg border border-border bg-input-background py-2 pl-8 pr-3 text-xs focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ManagerOrderStatus | "all")
            }
            className="rounded-lg border border-border bg-input-background px-3 py-2 text-xs text-foreground focus:outline-none"
            aria-label="Filter orders by status"
          >
            <option value="all">All statuses</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="rrj-card flex flex-col items-start gap-3 p-4">
            <div>
              <p className="text-xs font-bold text-red-700">
                Orders unavailable
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadOrders()}
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </div>
        ) : (
          <Table
            headers={[
              "Order",
              "Customer",
              "Channel / Type",
              "Total",
              "Status",
              "Rider",
              "Created",
              "",
            ]}
          >
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-xs text-muted-foreground"
                >
                  Loading manager orders…
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-xs text-muted-foreground"
                >
                  {orders.length === 0
                    ? "No orders are available."
                    : "No orders match the current filters."}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                  className={`cursor-pointer hover:bg-muted/30 ${
                    selectedOrder?.id === order.id ? "bg-red-50/40" : ""
                  }`}
                >
                  <Td>
                    <span className="font-mono text-[10px] font-bold text-primary">
                      {order.orderNumber}
                    </span>
                  </Td>
                  <Td className="text-xs font-semibold">
                    {order.customerName}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        variant={
                          order.orderChannel === "online" ? "info" : "neutral"
                        }
                      >
                        {formatTitleCase(order.orderChannel)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTitleCase(order.fulfillmentType)}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-xs font-bold">
                    {formatCurrency(order.grandTotal)}
                  </Td>
                  <Td>
                    <StatusBadge
                      status={STATUS_BADGE_KEYS[order.currentStatus]}
                    />
                  </Td>
                  <Td className="text-[10px] text-muted-foreground">
                    {order.riderName ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-[10px] text-muted-foreground">
                    {formatOrderTime(order.createdAt)}
                  </Td>
                  <Td>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Td>
                </tr>
              ))
            )}
          </Table>
        )}
      </div>

      {selectedOrder && (
        <aside className="flex w-full flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:w-80">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-mono text-xs font-bold text-primary">
                {selectedOrder.orderNumber}
              </p>
              <StatusBadge
                status={STATUS_BADGE_KEYS[selectedOrder.currentStatus]}
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
              aria-label="Close order details"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <p className="mb-1 text-[9px] font-bold uppercase text-muted-foreground">
                Customer
              </p>
              <p className="text-xs font-semibold">
                {selectedOrder.customerName}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {selectedOrder.customerContactNumber ?? "—"}
              </p>
              <p className="mt-0.5 flex gap-1 text-[10px] text-muted-foreground">
                <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />
                {selectedOrder.deliveryAddress ?? "—"}
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[9px] font-bold uppercase text-muted-foreground">
                  Rider
                </p>
                <p className="text-[10px] font-semibold">
                  {selectedOrder.riderName ?? "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[9px] font-bold uppercase text-muted-foreground">
                  Payment
                </p>
                <p className="text-[10px] font-semibold">
                  {selectedOrder.paymentMethod
                    ? `${formatTitleCase(selectedOrder.paymentMethod)} · ${formatTitleCase(
                        selectedOrder.paymentStatus ?? "",
                      )}`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-1 text-[9px] font-bold uppercase text-muted-foreground">
                Items
              </p>
              {selectedOrder.items.length === 0 ? (
                <p className="py-2 text-[10px] text-muted-foreground">
                  No order items were returned.
                </p>
              ) : (
                selectedOrder.items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex justify-between gap-3 border-b border-border py-1 text-[10px] last:border-0"
                  >
                    <span>
                      {item.name}{" "}
                      <span className="font-bold">×{item.quantity}</span>
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                ))
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-xs font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {formatCurrency(selectedOrder.grandTotal)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase text-muted-foreground">
                Current progress
              </p>
              <p className="mb-2 text-[9px] text-muted-foreground">
                Status progression only; not an event history.
              </p>
              {timelineStep === undefined ? (
                <p className="text-[10px] text-muted-foreground">
                  Progression ended with{" "}
                  {ORDER_STATUS_LABELS[selectedOrder.currentStatus]}.
                </p>
              ) : (
                timeline.map((label, index) => (
                  <div key={label} className="flex items-start gap-2">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                          index < timelineStep
                            ? "border-green-500 bg-green-500"
                            : index === timelineStep
                              ? "border-primary bg-primary"
                              : "border-border bg-white"
                        }`}
                      >
                        {index < timelineStep ? (
                          <Check className="h-2.5 w-2.5 text-white" />
                        ) : index === timelineStep ? (
                          <div className="h-1 w-1 rounded-full bg-white" />
                        ) : null}
                      </div>
                      {index < timeline.length - 1 && (
                        <div
                          className={`h-4 w-0.5 ${
                            index < timelineStep ? "bg-green-400" : "bg-border"
                          }`}
                        />
                      )}
                    </div>
                    <p
                      className={`pb-3 text-[10px] leading-tight ${
                        index <= timelineStep
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
