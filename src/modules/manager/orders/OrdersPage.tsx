import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  MapPin,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/common/Button";
import { useAuth } from "@/app/providers/AuthProvider";
import { Table, Td } from "@/components/common/Table";
import { ORDER_TIMELINE } from "@/constants";
import {
  getManagerOrders,
  getManagerOrderFinancials,
  type ManagerOrder,
  type ManagerOrderFinancials,
  type ManagerOrderStatus,
} from "../api/managerApi";
import {
  ManagerOrderStatusBadge,
  ManagerPaymentStatusBadge,
  MANAGER_ORDER_STATUS_PRESENTATION,
  managerOrderNeedsAttention,
} from "../components/ManagerStatusBadge";
import { PaidOrderCancellationPanel } from "./PaidOrderCancellationPanel";

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
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("Active manager access required") ||
    message.includes("Authentication required")
  )
    return "Manager access is required to view orders.";
  return "Orders could not be loaded. Check your connection or access, then retry.";
}

function isAccessFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Active manager access required") ||
    message.includes("Authentication required")
  );
}

export function OrdersPage() {
  const { session, loading: authLoading } = useAuth();
  const [storedOrders, setOrders] = useState<ManagerOrder[]>([]);
  const [loadedForSession, setLoadedForSession] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [financials, setFinancials] = useState<{ id: string; values: ManagerOrderFinancials | null; unavailable: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ManagerOrderStatus | "all">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailsRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const requestVersion = useRef(0);
  const orders =
    !authLoading &&
    session?.role === "manager" &&
    session.id === loadedForSession
      ? storedOrders
      : [];
  const openOrderDetails = (id: string, trigger?: HTMLElement) => {
    triggerRef.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setSelectedId(id);
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() =>
        detailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  };

  const loadOrders = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const result = await getManagerOrders();
      if (version === requestVersion.current) {
        setOrders(result);
        setLoadedForSession(session?.id ?? null);
        setLoadedAt(new Date());
      }
    } catch (loadError) {
      if (version === requestVersion.current) {
        if (isAccessFailure(loadError)) {
          setOrders([]);
          setLoadedForSession(null);
          setLoadedAt(null);
          setSelectedId(null);
        }
        setError(getErrorMessage(loadError));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.id || session.role !== "manager") {
      requestVersion.current += 1;
      setOrders([]);
      setLoadedForSession(null);
      setLoadedAt(null);
      setSelectedId(null);
      setError("Manager access is required to view orders.");
      setLoading(false);
      return;
    }
    setOrders([]);
    setLoadedForSession(null);
    setLoadedAt(null);
    setSelectedId(null);
    void loadOrders();
    return () => {
      requestVersion.current += 1;
    };
  }, [authLoading, session?.id, session?.role, loadOrders]);

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
  useEffect(() => {
    if (!selectedOrder || !session?.id || session.role !== "manager") {
      setFinancials(null);
      return;
    }
    let active = true;
    setFinancials(null);
    void getManagerOrderFinancials(selectedOrder.id)
      .then((values) => {
        if (active) setFinancials({ id: selectedOrder.id, values, unavailable: false });
      })
      .catch(() => {
        if (active) setFinancials({ id: selectedOrder.id, values: null, unavailable: true });
      });
    return () => { active = false; };
  }, [selectedOrder?.id, session?.id, session?.role]);
  const selectedFinancials = selectedOrder && financials?.id === selectedOrder.id && financials?.values?.grandTotal === selectedOrder.grandTotal
    ? financials.values : null;
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
    <div className="manager-orders flex h-full min-w-0 flex-col gap-3">
      <header className="manager-page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="manager-page-context">Restaurant Operations / Orders</p>
          <h1 className="text-foreground">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review order, payment, and fulfillment status across the latest
            loaded orders.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={() => void loadOrders()}
          loading={loading}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      <div className="manager-order-filters flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(67,42,23,0.03)] sm:flex-row sm:items-end">
        <label className="relative min-w-0 flex-1 text-xs font-semibold text-muted-foreground">
          Search loaded orders
          <Search
            className="absolute bottom-3.5 left-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order or customer…"
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-input-background py-2 pl-9 pr-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="flex min-w-0 flex-col text-xs font-semibold text-muted-foreground sm:w-48">
          Order status
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ManagerOrderStatus | "all")
            }
            className="mt-1 min-h-11 min-w-0 rounded-lg border border-border bg-input-background px-3 py-2 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        </label>
        {(search || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      {loadedAt && loadedForSession === session?.id && (
        <p className="text-xs text-muted-foreground">
          {filteredOrders.length.toLocaleString("en-PH")} of{" "}
          {orders.length.toLocaleString("en-PH")} loaded orders match. This read
          includes at most the latest 100 orders; search and status filter apply
          only to those loaded records. Last loaded{" "}
          {new Intl.DateTimeFormat("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(loadedAt)}.
        </p>
      )}
      {loading && orders.length > 0 && (
        <p
          className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground"
          role="status"
        >
          Refreshing orders… Previous results remain visible until the read
          finishes.
        </p>
      )}
      {error && orders.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          <span>
            {error} These orders are from the last successful load and may be
            outdated.
          </span>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void loadOrders()}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      )}

      {error && orders.length === 0 ? (
        <div
          role="alert"
          className="rrj-card flex flex-col items-start gap-3 p-4"
        >
          <div>
            <p className="text-sm font-bold text-red-700">Orders unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void loadOrders()}
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:flex-row">
          {selectedId && !selectedOrder && !loading && (
            <p
              className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground"
              role="status"
            >
              The selected order is outside the latest loaded 100 records.
              Select another loaded order to view details.
            </p>
          )}
          <section
            aria-label="Orders on small screens"
            className="grid content-start gap-3 md:hidden"
          >
            {loading && orders.length === 0 ? (
              <p
                role="status"
                className="rounded-xl border border-border bg-card p-4 text-sm"
              >
                Loading manager orders…
              </p>
            ) : filteredOrders.length === 0 ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm">
                {orders.length === 0
                  ? "No orders are available."
                  : "No orders match the current filters."}
              </p>
            ) : (
              filteredOrders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="break-all font-mono text-sm font-bold text-primary">
                        {order.orderNumber}
                      </h2>
                      <p className="mt-1 break-words text-sm font-semibold">
                        {order.customerName}
                      </p>
                    </div>
                    <strong
                      className="break-words text-sm tabular-nums"
                      title="Order total; payment and fulfillment are shown separately"
                    >
                      {formatCurrency(order.grandTotal)}
                    </strong>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Order</span>
                    <ManagerOrderStatusBadge status={order.currentStatus} />
                    <span className="text-xs text-muted-foreground">
                      Payment
                    </span>
                    {order.paymentStatus ? (
                      <ManagerPaymentStatusBadge status={order.paymentStatus} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not recorded
                      </span>
                    )}
                  </div>
                  <p className="mt-3 break-words text-xs text-muted-foreground">
                    {formatTitleCase(order.fulfillmentType)} ·{" "}
                    {formatOrderTime(order.createdAt)}
                    {order.riderName ? ` · Rider ${order.riderName}` : ""}
                  </p>
                  <button
                    type="button"
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={(event) =>
                      openOrderDetails(order.id, event.currentTarget)
                    }
                    aria-expanded={selectedId === order.id}
                  >
                    Details for {order.orderNumber}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </article>
              ))
            )}
          </section>
          <div className="hidden min-w-0 flex-1 md:block">
            <Table
              headers={[
                "Order",
                "Customer",
                "Fulfillment",
                "Order total",
                "Order status",
                "Payment",
                "Rider",
                "Created",
                "",
              ]}
            >
              {loading && orders.length === 0 ? (
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
                      onClick={(event) =>
                        openOrderDetails(order.id, event.currentTarget)
                      }
                      tabIndex={0}
                      aria-selected={selectedOrder?.id === order.id}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openOrderDetails(order.id, event.currentTarget);
                        }
                      }}
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
                          className="block max-w-[11rem] break-words"
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
                            Not recorded
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={
                            "block max-w-[9rem] break-words text-sm " +
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
                          onClick={() => openOrderDetails(order.id)}
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
              ref={detailsRef}
              aria-label={"Details for " + selectedOrder.orderNumber}
              className="manager-order-details order-first flex w-full flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card xl:order-last xl:w-[340px]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                    Order details
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-bold text-primary">
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
                  onClick={() => {
                    setSelectedId(null);
                    requestAnimationFrame(() => {
                      if (triggerRef.current?.isConnected)
                        triggerRef.current.focus();
                    });
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                      <dt className="text-xs text-muted-foreground">
                        Created
                      </dt>
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
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">
                    {selectedOrder.customerName}
                  </p>
                  <p className="mt-0.5 break-all text-sm text-muted-foreground">
                    {selectedOrder.customerContactNumber ?? "—"}
                  </p>
                  {selectedOrder.deliveryAddress && (
                    <p className="mt-2 flex min-w-0 gap-2 text-sm leading-5 text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="min-w-0 break-words">
                        {selectedOrder.deliveryAddress}
                      </span>
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
                        <span className="text-sm text-muted-foreground">
                          Not recorded
                        </span>
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

                <PaidOrderCancellationPanel
                  key={selectedOrder.id}
                  order={selectedOrder}
                  onSettled={loadOrders}
                  actionsAvailable={!loading && !error}
                />

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
                          <span className="min-w-0 break-words text-foreground">
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
                  {selectedFinancials && <div className="mt-2 space-y-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between gap-3"><span>Item subtotal</span><span className="tabular-nums">{formatCurrency(selectedFinancials.subtotal)}</span></div>
                    {selectedFinancials.taxAmount > 0 && <div className="flex justify-between gap-3"><span>Tax</span><span className="tabular-nums">{formatCurrency(selectedFinancials.taxAmount)}</span></div>}
                    {selectedFinancials.deliveryFee > 0 && <div className="flex justify-between gap-3"><span>Delivery fee</span><span className="tabular-nums">{formatCurrency(selectedFinancials.deliveryFee)}</span></div>}
                    {Math.round((selectedFinancials.subtotal + selectedFinancials.taxAmount + selectedFinancials.deliveryFee) * 100) !== Math.round(selectedFinancials.grandTotal * 100) && (
                      <p className="text-xs text-muted-foreground">This historical sale has a recorded total that differs from its listed components.</p>
                    )}
                  </div>}
                  {financials?.id === selectedOrder.id && (!selectedFinancials || financials.unavailable) && <p className="mt-2 text-xs text-muted-foreground">Stored price breakdown unavailable. The order total below is the recorded total; no fee is inferred from item prices.</p>}
                  <div className="mt-1 flex justify-between border-t border-border pt-3 text-sm font-bold">
                    <span>Order total</span>
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
