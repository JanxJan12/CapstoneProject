import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "../components";
import {
  CANCELLABLE_STATUSES,
  DATA_REFRESH_FEEDBACK_MS,
  ORDER_REFRESH_INTERVAL_MS,
  PAGE_SIZE,
  SEARCH_FOCUS_DELAY_MS,
} from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import type {
  CashierNavigationIntent,
  Order,
  OrderOperationalEditInput,
} from "../types";
import { currentLocalDate, downloadCsv } from "../utils/exportUtils";
import type { OrderFilterValue } from "./OrderFilters";
import {
  elapsedOrderMinutes,
  getItemsSummary,
  getKitchenStatus,
  getOrderPriority,
  getRiderStatus,
  isOrderDelayed,
  sortOperationalOrders,
  type OrderSortDescriptor,
  type OrderSortKey,
} from "./orderOperations";

export const DEFAULT_ORDER_FILTERS: OrderFilterValue = {
  search: "",
  quick: "All",
  type: "All",
  status: "All",
  from: "",
  to: "",
  sort: "operations",
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

export function useOrderList(intent?: CashierNavigationIntent) {
  const {
    state,
    cancelOrder,
    updateOrder,
    assignRider,
    duplicateOrder,
    recordReceiptReprint,
  } = useCashierStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const hasOpenedReady = useRef(false);
  const [filters, setFilters] = useState<OrderFilterValue>(() => ({
    ...DEFAULT_ORDER_FILTERS,
    search: intent?.search ?? "",
    type: intent?.orderTypes?.length === 1 ? intent.orderTypes[0] : "All",
    status: intent?.statuses?.length === 1 ? intent.statuses[0] : "All",
    from: intent?.today ? currentLocalDate() : "",
    to: intent?.today ? currentLocalDate() : "",
  }));
  const [sorts, setSorts] = useState<OrderSortDescriptor[]>([]);
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [drawerOrderId, setDrawerOrderId] = useState<string>();
  const [cancelTarget, setCancelTarget] = useState<Order>();
  const [editTarget, setEditTarget] = useState<Order>();
  const [riderTarget, setRiderTarget] = useState<Order>();
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  useSearchShortcut(searchRef);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      ORDER_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (intent?.focusSearch) {
      window.setTimeout(
        () => searchRef.current?.focus(),
        SEARCH_FOCUS_DELAY_MS,
      );
    }
  }, [intent]);
  useEffect(() => {
    if (!intent?.openFirstReady || hasOpenedReady.current) return;
    setDrawerOrderId(
      state.orders.find((entry) => entry.status === "Ready")?.id,
    );
    hasOpenedReady.current = true;
  }, [intent, state.orders]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const result = state.orders.filter((order) => {
      const created = order.createdAt.slice(0, 10);
      const searchText =
        `${order.id} ${order.customerName} ${order.contactNumber} ${getItemsSummary(order)} ${order.type}`.toLowerCase();
      const matchesQuick =
        filters.quick === "All" ||
        (filters.quick === "Delayed" &&
          isOrderDelayed(order, state.delayedThresholdMinutes, now)) ||
        (filters.quick === "Needs Payment" &&
          order.paymentStatus === "Pending") ||
        (filters.quick === "Kitchen Active" &&
          ["Confirmed", "Preparing", "Ready"].includes(order.status)) ||
        (filters.quick === "Needs Rider" &&
          order.type === "Delivery" &&
          getRiderStatus(order) === "Unassigned") ||
        (filters.quick === "Ready" && order.status === "Ready");
      return (
        (!intent?.statuses?.length || intent.statuses.includes(order.status)) &&
        (!intent?.orderTypes?.length ||
          intent.orderTypes.includes(order.type)) &&
        matchesQuick &&
        (!query || searchText.includes(query)) &&
        (filters.type === "All" || order.type === filters.type) &&
        (filters.status === "All" || order.status === filters.status) &&
        (!filters.from || created >= filters.from) &&
        (!filters.to || created <= filters.to)
      );
    });
    return sortOperationalOrders(
      result,
      sorts,
      state.delayedThresholdMinutes,
      now,
      filters.sort,
    );
  }, [
    filters,
    intent,
    now,
    sorts,
    state.delayedThresholdMinutes,
    state.orders,
  ]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedOrders = state.orders.filter((order) =>
    selectedIds.has(order.id),
  );
  const cancellableSelected = selectedOrders.filter((order) =>
    CANCELLABLE_STATUSES.includes(order.status),
  );
  useEffect(() => setPage(1), [filters, intent, sorts]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const reportError = useCallback((caught: unknown, fallback: string) => {
    const message = caught instanceof Error ? caught.message : fallback;
    setError(message);
    Toast.error(message);
  }, []);
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
      if (!cancelTarget) return;
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
        reportError(caught, "Unable to cancel the order.");
      } finally {
        setLoading(false);
      }
    },
    [cancelOrder, cancelTarget, reportError],
  );
  const handleBulkCancel = useCallback(
    async (reason: string) => {
      if (!cancellableSelected.length) return;
      setLoading(true);
      setError("");
      try {
        for (const order of cancellableSelected) {
          await cancelOrder(order.id, reason);
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
        reportError(caught, "Unable to complete the bulk cancellation.");
      } finally {
        setLoading(false);
      }
    },
    [cancelOrder, cancellableSelected, reportError, selectedOrders.length],
  );
  const handleEdit = useCallback(
    async (input: OrderOperationalEditInput) => {
      if (!editTarget) return;
      setLoading(true);
      setError("");
      try {
        await updateOrder(editTarget.id, input);
        Toast.success(`${editTarget.id} updated`);
        setEditTarget(undefined);
      } catch (caught) {
        reportError(caught, "Unable to update the order.");
      } finally {
        setLoading(false);
      }
    },
    [editTarget, reportError, updateOrder],
  );
  const handleAssignRider = useCallback(
    async (riderId: string) => {
      if (!riderTarget) return;
      setLoading(true);
      setError("");
      try {
        await assignRider(riderTarget.id, riderId);
        Toast.success(`Rider assigned to ${riderTarget.id}`);
        setRiderTarget(undefined);
      } catch (caught) {
        reportError(caught, "Unable to assign the rider.");
      } finally {
        setLoading(false);
      }
    },
    [assignRider, reportError, riderTarget],
  );
  const handleDuplicate = useCallback(
    async (order: Order) => {
      setError("");
      try {
        const duplicate = await duplicateOrder(order.id);
        setExpandedIds((current) => new Set(current).add(duplicate.id));
        Toast.success(`${duplicate.id} created`, {
          description: `Duplicated from ${order.id} and queued for payment.`,
        });
      } catch (caught) {
        reportError(caught, "Unable to duplicate the order.");
      }
    },
    [duplicateOrder, reportError],
  );
  const handlePrint = useCallback(
    (order: Order) => {
      window.print();
      if (order.transactionId) void recordReceiptReprint(order.id);
      Toast.success(
        `${order.transactionId ? "Receipt" : "Order ticket"} sent to the print dialog.`,
      );
    },
    [recordReceiptReprint],
  );
  const handleBulkPrint = useCallback(async () => {
    window.print();
    await Promise.all(
      selectedOrders
        .filter((order) => order.transactionId)
        .map((order) => recordReceiptReprint(order.id)),
    );
    Toast.success(
      `${selectedOrders.length} selected order records prepared for printing.`,
    );
  }, [recordReceiptReprint, selectedOrders]);
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
  const refresh = useCallback(() => {
    setRefreshing(true);
    setNow(Date.now());
    window.setTimeout(() => {
      setRefreshing(false);
      Toast.success("Order operations are up to date");
    }, DATA_REFRESH_FEEDBACK_MS);
  }, []);
  const toggleSelection = useCallback((orderId: string) => {
    setSelectedIds((current) => toggleSetEntry(current, orderId));
  }, []);
  const toggleExpansion = useCallback((orderId: string) => {
    setExpandedIds((current) => toggleSetEntry(current, orderId));
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
    searchRef,
    sorts,
    page,
    setPage,
    now,
    filtered,
    visible,
    pages,
    selectedIds,
    expandedIds,
    selectedOrders,
    cancellableSelected,
    drawerOrder: state.orders.find((order) => order.id === drawerOrderId),
    cancelTarget,
    editTarget,
    riderTarget,
    bulkCancelOpen,
    loading,
    refreshing,
    error,
    setError,
    setDrawerOrderId,
    setCancelTarget,
    setEditTarget,
    setRiderTarget,
    setBulkCancelOpen,
    setSelectedIds,
    handleSort,
    handleCancel,
    handleBulkCancel,
    handleEdit,
    handleAssignRider,
    handleDuplicate,
    handlePrint,
    handleBulkPrint,
    exportCsv,
    refresh,
    toggleSelection,
    toggleExpansion,
    toggleSelectAll,
  };
}

function toggleSetEntry(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
