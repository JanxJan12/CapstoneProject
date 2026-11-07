import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "../components";
import {
  ORDER_REFRESH_INTERVAL_MS,
  PAGE_SIZE,
  SEARCH_FOCUS_DELAY_MS,
} from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import type {
  CashierNavigationIntent,
  Order,
} from "../types";
import { currentLocalDate, downloadCsv, manilaDate } from "../utils/exportUtils";
import type { OrderFilterValue } from "./OrderFilters";
import {
  elapsedOrderMinutes,
  canCancelCashierOrder,
  getItemsSummary,
  matchesOrderSearch,
  matchesOrderPaymentStatus,
  getKitchenStatus,
  getOrderPriority,
  getRiderStatus,
  matchesOrderListView,
  sortOperationalOrders,
  type OrderListView,
  type OrderSortDescriptor,
  type OrderSortKey,
} from "./orderOperations";

export const DEFAULT_ORDER_FILTERS: OrderFilterValue = {
  search: "",
  type: "All",
  status: "All",
  payment: "All",
  from: "",
  to: "",
};

const ORDER_CSV_HEADERS = [
  "Order Number",
  "Customer",
  "Phone",
  "Items",
  "Order Type",
  "Kitchen Status",
  "Payment Status",
  "Rider Status",
  "Elapsed Time (Minutes)",
  "Priority",
  "Total",
] as const;

export function useOrderList(intent?: CashierNavigationIntent, active = true) {
  const {
    state,
    cancelOrder,
    databaseLoading,
    databaseError,
    refreshDatabaseState,
  } = useCashierStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const focusedIntent = useRef<CashierNavigationIntent | undefined>(undefined);
  const hasOpenedReady = useRef(false);
  const openedOrderIntent = useRef<CashierNavigationIntent | undefined>(undefined);
  const [filters, setFilters] = useState<OrderFilterValue>(() => ({
    ...DEFAULT_ORDER_FILTERS,
    search: intent?.search ?? "",
    type: intent?.orderTypes?.length === 1 ? intent.orderTypes[0] : "All",
    status: intent?.statuses?.length === 1 ? intent.statuses[0] : "All",
  }));
  const [view, setView] = useState<OrderListView>(intent?.search && !intent.today ? "all" : "today");
  const [sorts, setSorts] = useState<OrderSortDescriptor[]>([]);
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [drawerOrderId, setDrawerOrderId] = useState<string>();
  const [cancelTarget, setCancelTarget] = useState<Order>();
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancellationNeedsRefresh, setCancellationNeedsRefresh] = useState(false);
  const cancellationRefreshStarted = useRef(false);
  const actionInFlight = useRef(false);
  useSearchShortcut(searchRef, "/", active);

  useEffect(() => {
    if (!cancellationNeedsRefresh) return;
    if (databaseLoading) {
      cancellationRefreshStarted.current = true;
    } else if (cancellationRefreshStarted.current && !databaseError) {
      cancellationRefreshStarted.current = false;
      setCancellationNeedsRefresh(false);
      setCancelTarget(undefined);
      setBulkCancelOpen(false);
      setError("");
      const cancellableIds = new Set(state.orders.filter((order) =>
        canCancelCashierOrder(order),
      ).map((order) => order.id));
      const remaining = [...selectedIds].filter((id) => cancellableIds.has(id));
      setSelectedIds(new Set(remaining));
    }
  }, [cancellationNeedsRefresh, databaseLoading, databaseError, state.orders, selectedIds]);

  const reconcileCancellation = useCallback((message: string) => {
    cancellationRefreshStarted.current = false;
    setCancellationNeedsRefresh(true);
    setError(message);
    Toast.error(message);
    refreshDatabaseState();
  }, [refreshDatabaseState]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      ORDER_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (intent?.focusSearch && active && focusedIntent.current !== intent) {
      const timer = window.setTimeout(
        () => {
          focusedIntent.current = intent;
          searchRef.current?.focus();
        },
        SEARCH_FOCUS_DELAY_MS,
      );
      return () => window.clearTimeout(timer);
    }
  }, [intent, active]);
  useEffect(() => {
    if (!intent?.openFirstReady || hasOpenedReady.current) return;
    setDrawerOrderId(
      state.orders.find((entry) => entry.status === "Ready" &&
        !(entry.type === "Delivery" && entry.orderChannel === "online"))?.id,
    );
    hasOpenedReady.current = true;
  }, [intent, state.orders]);
  useEffect(() => {
    if (!intent?.orderId || openedOrderIntent.current === intent) return;
    const target = state.orders.find((order) =>
      order.id === intent.orderId || order.databaseId === intent.orderId,
    );
    if (target) {
      openedOrderIntent.current = intent;
      setView("all");
      setDrawerOrderId(target.id);
    }
  }, [intent, state.orders]);

  const matching = useMemo(() => {
    const result = state.orders.filter((order) => {
      const created = manilaDate(order.createdAt);

      return (
        (!intent?.statuses?.length || intent.statuses.includes(order.status)) &&
        (!intent?.orderTypes?.length ||
          intent.orderTypes.includes(order.type)) &&
        matchesOrderSearch(order, filters.search) &&
        (filters.type === "All" || order.type === filters.type) &&
        (filters.status === "All" || order.status === filters.status) &&
        matchesOrderPaymentStatus(order, filters.payment) &&
        (!filters.from || created >= filters.from) &&
        (!filters.to || created <= filters.to)
      );
    });
    return result;
  }, [filters, intent, state.orders]);

  const viewCounts = useMemo(() => ({
    today: matching.filter((order) => matchesOrderListView(order, "today", now)).length,
    all: matching.length,
    older: matching.filter((order) => matchesOrderListView(order, "older", now)).length,
  }), [matching, now]);
  const filtered = useMemo(() => sortOperationalOrders(
    matching.filter((order) => matchesOrderListView(order, view, now)),
    sorts,
    state.delayedThresholdMinutes,
    now,
    "operations",
  ), [matching, view, sorts, state.delayedThresholdMinutes, now]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedOrders = state.orders.filter((order) =>
    selectedIds.has(order.id),
  );
  const cancellableSelected = selectedOrders.filter((order) =>
    canCancelCashierOrder(order),
  );
  useEffect(() => setPage(1), [filters, intent, sorts, view]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const handleSort = useCallback((key: OrderSortKey, additive: boolean) => {
    setSorts((current) => {
      const existing = current.find((sort) => sort.key === key);
      const direction = existing?.direction === "asc" ? "desc" : "asc";
      if (!additive) return [{ key, direction }];
      if (!existing)
        return [...current, { key, direction: "asc" as const }].slice(-3);
      return current.map((sort) =>
        sort.key === key ? { ...sort, direction } : sort,
      );
    });
  }, []);
  const handleCancel = useCallback(
    async (reason: string) => {
      if (!cancelTarget) throw new Error("Select an order to cancel.");
      const latestTarget = state.orders.find((order) => order.id === cancelTarget.id);
      if (!latestTarget || !canCancelCashierOrder(latestTarget)) {
        throw new Error("This order is no longer eligible for ordinary cancellation. Refresh its status and payment.");
      }
      if (actionInFlight.current || loading || cancellationNeedsRefresh || databaseLoading || databaseError) {
        throw new Error("Wait for the order list to refresh before cancelling again.");
      }
      actionInFlight.current = true;
      setLoading(true);
      setError("");
      try {
        await cancelOrder(cancelTarget.id, reason);
        Toast.success(`${cancelTarget.id} cancelled`, {
          description:
            "Order, rider availability, and operational records were updated.",
        });
        setCancelTarget(undefined);
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : "The request could not be confirmed.";
        const message = `${detail} Refresh ${cancelTarget.id} before trying again.`;
        reconcileCancellation(message);
        throw new Error(message, { cause: caught });
      } finally {
        actionInFlight.current = false;
        setLoading(false);
      }
    },
    [cancelOrder, cancelTarget, state.orders, loading, cancellationNeedsRefresh, databaseLoading, databaseError, reconcileCancellation],
  );
  const handleBulkCancel = useCallback(
    async (reason: string) => {
      if (!cancellableSelected.length) throw new Error("No selected orders can be cancelled.");
      if (actionInFlight.current || loading || cancellationNeedsRefresh || databaseLoading || databaseError) {
        throw new Error("Wait for the order list to refresh before cancelling again.");
      }
      actionInFlight.current = true;
      setLoading(true);
      setError("");
      let confirmed = 0;
      try {
        for (const order of cancellableSelected) {
          await cancelOrder(order.id, reason);
          confirmed += 1;
        }
        const skipped = selectedOrders.length - cancellableSelected.length;
        Toast.success(`${cancellableSelected.length} orders cancelled`, {
          description: skipped
            ? `${skipped} non-cancellable orders were skipped.`
            : "Operational records were updated in real time.",
        });
        setBulkCancelOpen(false);
        setSelectedIds(new Set());
      } catch (caught) {
        const message = `${confirmed} of ${cancellableSelected.length} cancellations confirmed. The next order may also have been cancelled. Wait for the order list to refresh before trying again.`;
        reconcileCancellation(message);
        throw new Error(message, { cause: caught });
      } finally {
        actionInFlight.current = false;
        setLoading(false);
      }
    },
    [cancelOrder, cancellableSelected, selectedOrders.length, loading, cancellationNeedsRefresh, databaseLoading, databaseError, reconcileCancellation],
  );
  const exportCsv = useCallback(
    (selectedOnly = false) => {
      const orders =
        selectedOnly && selectedOrders.length ? selectedOrders : filtered;
      const rows = orders.map((order) => [
        order.id,
        order.customerName,
        order.contactNumber,
        getItemsSummary(order),
        order.type,
        getKitchenStatus(order),
        order.paymentStatus,
        getRiderStatus(order),
        elapsedOrderMinutes(order, now),
        getOrderPriority(order, state.delayedThresholdMinutes, now),
        order.total.toFixed(2),
      ]);
      downloadCsv(
        `rrj-orders-${currentLocalDate()}.csv`,
        ORDER_CSV_HEADERS,
        rows,
      );
      Toast.success(`${orders.length} order records exported.`);
    },
    [filtered, now, selectedOrders, state.delayedThresholdMinutes],
  );
  const toggleSelection = useCallback((orderId: string) => {
    setSelectedIds((current) => toggleSetEntry(current, orderId));
  }, []);
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = visible.every((order) => next.has(order.id));
      visible.forEach((order) =>
        allSelected ? next.delete(order.id) : next.add(order.id),
      );
      return next;
    });
  }, [visible]);

  return {
    state: state,
    filters,
    setFilters,
    view,
    setView,
    viewCounts,
    searchRef,
    sorts,
    page,
    setPage,
    now,
    filtered,
    visible,
    pages,
    selectedIds,
    selectedOrders,
    cancellableSelected,
    drawerOrder: state.orders.find((order) => order.id === drawerOrderId),
    cancelTarget,
    bulkCancelOpen,
    loading,
    cancellationBlocked: cancellationNeedsRefresh || databaseLoading || Boolean(databaseError),
    refreshing: databaseLoading,
    databaseError,
    error,
    setError,
    setDrawerOrderId,
    setCancelTarget,
    setBulkCancelOpen,
    setSelectedIds,
    handleSort,
    handleCancel,
    handleBulkCancel,
    exportCsv,
    toggleSelection,
    toggleSelectAll,
  };
}

function toggleSetEntry(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
