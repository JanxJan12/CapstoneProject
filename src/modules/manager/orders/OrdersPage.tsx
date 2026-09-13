import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  MapPin,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/common/Button";
import { Table, Td } from "@/components/common/Table";
import { ORDER_TIMELINE } from "@/constants";
import {
  getManagerOrders,
  type ManagerOrder,
  type ManagerOrderStatus,
} from "../api/managerApi";
import {
  ManagerOrderStatusBadge,
  ManagerPaymentStatusBadge,
  MANAGER_ORDER_STATUS_PRESENTATION,
  managerOrderNeedsAttention,
} from "../components/ManagerStatusBadge";

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

function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatOrderClock(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatOrderTime(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
    <div className="manager-orders flex h-full flex-col gap-3">
      <header className="manager-page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-foreground">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan order, fulfillment, payment, and rider state in one place
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadOrders()}
          loading={loading}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      <div className="manager-order-filters flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-[0_1px_2px_rgba(67,42,23,0.03)] sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order or customer…"
            className="min-h-10 w-full border-0 bg-transparent py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none"
            aria-label="Search orders by order number or customer"
          />
        </div>
        <div className="hidden h-6 w-px bg-border sm:block" />
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as ManagerOrderStatus | "all")
          }
          className="min-h-10 min-w-[180px] border-0 bg-transparent px-3 py-2 text-sm font-semibold text-foreground focus:outline-none"
          aria-label="Filter orders by status"
        >
          <option value="all">All statuses</option>
          {Object.entries(MANAGER_ORDER_STATUS_PRESENTATION).map(
            ([status, presentation]) => (
              <option key={status} value={status}>
                {presentation.label}
              </option>
            ),
          )}
        </select>
        {!loading && !error && (
          <span className="whitespace-nowrap px-2 text-xs font-semibold tabular-nums text-muted-foreground">
            {filteredOrders.length.toLocaleString("en-PH")} of{" "}
            {orders.length.toLocaleString("en-PH")}
          </span>
        )}
      </div>

      {error ? (
        <div className="rrj-card flex flex-col items-start gap-3 p-4">
          <div>
            <p className="text-sm font-bold text-red-700">Orders unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadOrders()}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
          <div className="min-w-0 flex-1">
            <Table
              headers={[
                "Order",
                "Customer",
                "Fulfillment",
                "Total",
                "Order status",
                "Payment",
                "Rider",
                "Created",
                "",
              ]}
            >
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading manager orders…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {orders.length === 0
                      ? "No orders are available."
                      : "No orders match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const needsAttention = managerOrderNeedsAttention(
                    order.currentStatus,
                  );
                  const isRejected =
                    order.currentStatus === "cancelled" ||
                    order.currentStatus === "rejected";

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={
                        "cursor-pointer outline-none " +
                        (selectedOrder?.id === order.id
                          ? "manager-order-row-selected "
                          : "") +
                        (needsAttention
                          ? isRejected
                            ? "manager-order-row-danger"
                            : "manager-order-row-warning"
                          : "")
                      }
                    >
                      <Td className="whitespace-nowrap">
                        <span className="block font-mono text-xs font-bold text-primary">
                          {order.orderNumber}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatTitleCase(order.orderChannel)}
                        </span>
                      </Td>
                      <Td className="font-semibold text-foreground">
                        <span
                          className="block max-w-[11rem] truncate"
                          title={order.customerName}
                        >
                          {order.customerName}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap font-semibold text-foreground">
                        {formatTitleCase(order.fulfillmentType)}
                      </Td>
                      <Td className="whitespace-nowrap font-bold tabular-nums text-foreground">
                        {formatCurrency(order.grandTotal)}
                      </Td>
                      <Td>
                        <ManagerOrderStatusBadge status={order.currentStatus} />
                      </Td>
                      <Td>
                        {order.paymentStatus ? (
                          <div className="flex flex-col items-start gap-1">
                            <ManagerPaymentStatusBadge
                              status={order.paymentStatus}
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {order.paymentMethod
                                ? formatTitleCase(order.paymentMethod)
                                : "Method not recorded"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={
                            "block max-w-[9rem] truncate text-sm " +
                            (order.riderName
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground")
                          }
                          title={order.riderName ?? undefined}
                        >
                          {order.riderName ?? "—"}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="block text-sm font-semibold text-foreground">
                          {formatOrderDate(order.createdAt)}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatOrderClock(order.createdAt)}
                        </span>
                      </Td>
                      <Td>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          onClick={() => setSelectedId(order.id)}
                        >
                          Details <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Td>
                    </tr>
                  );
                })
              )}
            </Table>
          </div>

          {selectedOrder && (
            <aside
              aria-label={"Details for " + selectedOrder.orderNumber}
              className="manager-order-details flex w-full flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card xl:w-[340px]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Order details
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-primary">
                    {selectedOrder.orderNumber}
                  </p>
                  <div className="mt-2">
                    <ManagerOrderStatusBadge
                      status={selectedOrder.currentStatus}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Close order details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <section className="rounded-xl border border-border/80 bg-muted/20 p-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                    Overview
                  </h2>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Fulfillment
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground">
                        {formatTitleCase(selectedOrder.fulfillmentType)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Channel</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground">
                        {formatTitleCase(selectedOrder.orderChannel)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Created</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground">
                        {formatOrderTime(selectedOrder.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                    Customer
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {selectedOrder.customerName}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selectedOrder.customerContactNumber ?? "—"}
                  </p>
                  {selectedOrder.deliveryAddress && (
                    <p className="mt-2 flex gap-2 text-sm leading-5 text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      {selectedOrder.deliveryAddress}
                    </p>
                  )}
                </section>

                <div className="grid grid-cols-2 gap-3">
                  <section className="rounded-xl border border-border/80 p-3">
                    <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                      Payment
                    </h2>
                    <div className="mt-2">
                      {selectedOrder.paymentStatus ? (
                        <ManagerPaymentStatusBadge
                          status={selectedOrder.paymentStatus}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {selectedOrder.paymentMethod
                        ? formatTitleCase(selectedOrder.paymentMethod)
                        : "Method not recorded"}
                    </p>
                    {selectedOrder.paymentAmount !== null && (
                      <p className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
                        {formatCurrency(selectedOrder.paymentAmount)}
                      </p>
                    )}
                  </section>
                  <section className="rounded-xl border border-border/80 p-3">
                    <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                      Rider
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-5 text-foreground">
                      {selectedOrder.riderName ?? "—"}
                    </p>
                  </section>
                </div>

                <section>
                  <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                    Items
                  </h2>
                  {selectedOrder.items.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">
                      No order items were returned.
                    </p>
                  ) : (
                    <div className="mt-2 divide-y divide-border">
                      {selectedOrder.items.map((item, index) => (
                        <div
                          key={item.name + "-" + index}
                          className="flex justify-between gap-3 py-2 text-sm"
                        >
                          <span className="text-foreground">
                            {item.name}{" "}
                            <span className="font-bold">×{item.quantity}</span>
                          </span>
                          <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                            {formatCurrency(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 flex justify-between border-t border-border pt-3 text-sm font-bold">
                    <span>Total</span>
                    <span className="tabular-nums text-primary">
                      {formatCurrency(selectedOrder.grandTotal)}
                    </span>
                  </div>
                </section>

                <section>
                  <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
                    Current progress
                  </h2>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">
                    Status progression only; not an event history.
                  </p>
                  {timelineStep === undefined ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No progress is available for this order state.
                    </p>
                  ) : (
                    <div className="mt-3">
                      {timeline.map((label, index) => (
                        <div key={label} className="flex gap-2.5">
                          <div className="flex flex-col items-center">
                            <div
                              className={
                                "flex h-5 w-5 items-center justify-center rounded-full border " +
                                (index <= timelineStep
                                  ? "border-primary bg-primary text-white"
                                  : "border-border bg-card text-muted-foreground")
                              }
                            >
                              {index < timelineStep ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <span className="text-[9px] font-bold">
                                  {index + 1}
                                </span>
                              )}
                            </div>
                            {index < timeline.length - 1 && (
                              <div
                                className={
                                  "h-5 w-px " +
                                  (index < timelineStep
                                    ? "bg-primary/45"
                                    : "bg-border")
                                }
                              />
                            )}
                          </div>
                          <p
                            className={
                              "pb-3 text-sm leading-5 " +
                              (index <= timelineStep
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground")
                            }
                          >
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
