import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CANCELLABLE_STATUSES, PAGE_SIZE } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type {
  CashierNavigationIntent,
  Order,
  OrderOperationalEditInput,
} from "../types";
import {
  CashierButton,
  ErrorBanner,
  PageHeading,
} from "../components/CashierUI";
import { AssignRiderDialog } from "./AssignRiderDialog";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { EditOrderDialog } from "./EditOrderDialog";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";
import { OrderFilters, type OrderFilterValue } from "./OrderFilters";
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
import { OrderTable } from "./OrderTable";

const defaultFilters: OrderFilterValue = {
  search: "",
  quick: "All",
  type: "All",
  status: "All",
  from: "",
  to: "",
  sort: "operations",
};

const todayInputValue = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const csvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

export function CashierOrderListPage({
  intent,
}: {
  intent?: CashierNavigationIntent;
}) {
  const {
    state,
    cancelOrder,
    updateOrder,
    assignRider,
    duplicateOrder,
    recordReceiptReprint,
  } = useCashierStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<OrderFilterValue>(() => ({
    ...defaultFilters,
    search: intent?.search ?? "",
    type: intent?.orderTypes?.length === 1 ? intent.orderTypes[0] : "All",
    status: intent?.statuses?.length === 1 ? intent.statuses[0] : "All",
    from: intent?.today ? todayInputValue() : "",
    to: intent?.today ? todayInputValue() : "",
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
  const hasOpenedReady = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (intent?.focusSearch)
      window.setTimeout(() => searchRef.current?.focus(), 100);
  }, [intent]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "/" && !editing && !target.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (intent?.openFirstReady && !hasOpenedReady.current) {
      const ready = state.orders.find((entry) => entry.status === "Ready");
      if (ready) setDrawerOrderId(ready.id);
      hasOpenedReady.current = true;
    }
  }, [intent, state.orders]);

  const filtered = useMemo(() => {
    const result = state.orders.filter((order) => {
      const query = filters.search.trim().toLowerCase();
      const created = order.createdAt.slice(0, 10);
      const searchText =
        `${order.id} ${order.customerName} ${order.contactNumber} ${getItemsSummary(order)} ${order.type}`.toLowerCase();
      const matchesIntent =
        !intent?.statuses?.length || intent.statuses.includes(order.status);
      const matchesIntentType =
        !intent?.orderTypes?.length || intent.orderTypes.includes(order.type);
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
        matchesIntent &&
        matchesIntentType &&
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
    state.orders,
    state.delayedThresholdMinutes,
    filters,
    intent,
    now,
    sorts,
  ]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const drawerOrder = state.orders.find((order) => order.id === drawerOrderId);
  const selectedOrders = state.orders.filter((order) =>
    selectedIds.has(order.id),
  );
  const cancellableSelected = selectedOrders.filter((order) =>
    CANCELLABLE_STATUSES.includes(order.status),
  );

  useEffect(() => {
    setPage(1);
  }, [filters, intent, sorts]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const reportError = (caught: unknown, fallback: string) => {
    const message = caught instanceof Error ? caught.message : fallback;
    setError(message);
    toast.error(message);
  };

  const handleSort = (key: OrderSortKey, additive: boolean) => {
    setSorts((current) => {
      const existing = current.find((sort) => sort.key === key);
      const nextDirection: OrderSortDescriptor["direction"] =
        existing?.direction === "asc" ? "desc" : "asc";
      if (!additive) return [{ key, direction: nextDirection }];
      if (!existing)
        return [...current, { key, direction: "asc" as const }].slice(-3);
      return current.map((sort) =>
        sort.key === key ? { ...sort, direction: nextDirection } : sort,
      );
    });
  };

  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return;
    setLoading(true);
    setError("");
    try {
      await cancelOrder(cancelTarget.id, reason);
      toast.success(`${cancelTarget.id} cancelled`, {
        description:
          "Order, rider availability, and operational records were updated.",
      });
      setCancelTarget(undefined);
    } catch (caught) {
      reportError(caught, "Unable to cancel the order.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCancel = async (reason: string) => {
    if (!cancellableSelected.length) return;
    setLoading(true);
    setError("");
    try {
      for (const order of cancellableSelected) {
        await cancelOrder(order.id, reason);
      }
      const skipped = selectedOrders.length - cancellableSelected.length;
      toast.success(`${cancellableSelected.length} orders cancelled`, {
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
  };

  const handleEdit = async (input: OrderOperationalEditInput) => {
    if (!editTarget) return;
    setLoading(true);
    setError("");
    try {
      await updateOrder(editTarget.id, input);
      toast.success(`${editTarget.id} updated`);
      setEditTarget(undefined);
    } catch (caught) {
      reportError(caught, "Unable to update the order.");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRider = async (riderId: string) => {
    if (!riderTarget) return;
    setLoading(true);
    setError("");
    try {
      await assignRider(riderTarget.id, riderId);
      toast.success(`Rider assigned to ${riderTarget.id}`);
      setRiderTarget(undefined);
    } catch (caught) {
      reportError(caught, "Unable to assign the rider.");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (order: Order) => {
    setError("");
    try {
      const duplicate = await duplicateOrder(order.id);
      setExpandedIds((current) => new Set(current).add(duplicate.id));
      toast.success(`${duplicate.id} created`, {
        description: `Duplicated from ${order.id} and queued for payment.`,
      });
    } catch (caught) {
      reportError(caught, "Unable to duplicate the order.");
    }
  };

  const handlePrint = (order: Order) => {
    window.print();
    if (order.transactionId) void recordReceiptReprint(order.id);
    toast.success(
      `${order.transactionId ? "Receipt" : "Order ticket"} sent to the print dialog.`,
    );
  };

  const handleBulkPrint = async () => {
    window.print();
    await Promise.all(
      selectedOrders
        .filter((order) => order.transactionId)
        .map((order) => recordReceiptReprint(order.id)),
    );
    toast.success(
      `${selectedOrders.length} selected order records prepared for printing.`,
    );
  };

  const exportCsv = (selectedOnly = false) => {
    const orders =
      selectedOnly && selectedOrders.length ? selectedOrders : filtered;
    const headers = [
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
    ];
    const rows = orders.map((order) =>
      [
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
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob(
      [[headers.map(csvCell).join(","), ...rows].join("\r\n")],
      {
        type: "text/csv;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rrj-orders-${todayInputValue()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${orders.length} order records exported.`);
  };

  return (
    <div className="cashier-page">
      <PageHeading
        title="Order List"
        description={`${filtered.length} matching orders in the central operations queue`}
        actions={
          <>
            <CashierButton
              variant="secondary"
              size="sm"
              onClick={() => exportCsv()}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </CashierButton>
            <div
              className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700"
              role="status"
            >
              <Radio className="h-3 w-3 animate-pulse" />
              Live updates
            </div>
          </>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => setError("")} />}
      <OrderFilters
        value={filters}
        searchRef={searchRef}
        refreshing={refreshing}
        onChange={setFilters}
        onRefresh={() => {
          setRefreshing(true);
          setNow(Date.now());
          window.setTimeout(() => {
            setRefreshing(false);
            toast.success("Order operations are up to date");
          }, 350);
        }}
      />
      <section className="rrj-card overflow-hidden">
        {selectedOrders.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black">
                {selectedOrders.length} orders selected
              </p>
              <p className="text-[10px] text-muted-foreground">
                Bulk actions apply across pages. Non-cancellable orders are
                skipped.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CashierButton
                variant="secondary"
                size="sm"
                onClick={handleBulkPrint}
              >
                <Printer className="h-4 w-4" />
                Print
              </CashierButton>
              <CashierButton
                variant="secondary"
                size="sm"
                onClick={() => exportCsv(true)}
              >
                <Download className="h-4 w-4" />
                Export selected
              </CashierButton>
              <CashierButton
                variant="danger"
                size="sm"
                disabled={!cancellableSelected.length}
                onClick={() => setBulkCancelOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Cancel
              </CashierButton>
              <CashierButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4" />
                Clear
              </CashierButton>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1 border-b border-border bg-white px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Delayed active orders always stay at the top.</span>
          <span>
            Click a column to sort; Shift-click to add up to three sort levels.
          </span>
        </div>
        <OrderTable
          orders={visible}
          delayedThreshold={state.delayedThresholdMinutes}
          now={now}
          sorts={sorts}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          onSort={handleSort}
          onToggleSelect={(orderId) =>
            setSelectedIds((current) => {
              const next = new Set(current);
              if (next.has(orderId)) next.delete(orderId);
              else next.add(orderId);
              return next;
            })
          }
          onToggleSelectAll={() =>
            setSelectedIds((current) => {
              const next = new Set(current);
              const allSelected = visible.every((order) => next.has(order.id));
              visible.forEach((order) =>
                allSelected ? next.delete(order.id) : next.add(order.id),
              );
              return next;
            })
          }
          onToggleExpand={(orderId) =>
            setExpandedIds((current) => {
              const next = new Set(current);
              if (next.has(orderId)) next.delete(orderId);
              else next.add(orderId);
              return next;
            })
          }
          onView={(order) => setDrawerOrderId(order.id)}
          onEdit={setEditTarget}
          onPrint={handlePrint}
          onAssignRider={setRiderTarget}
          onCancel={setCancelTarget}
          onDuplicate={(order) => void handleDuplicate(order)}
        />
        <div className="cashier-table-footer flex flex-col gap-2 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {visible.length ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <CashierButton
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </CashierButton>
            <strong className="text-foreground">
              Page {page} of {pages}
            </strong>
            <CashierButton
              variant="secondary"
              size="sm"
              disabled={page === pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </CashierButton>
          </div>
        </div>
      </section>
      <OrderDetailsDrawer
        order={drawerOrder}
        open={Boolean(drawerOrder)}
        onOpenChange={(open) => {
          if (!open) setDrawerOrderId(undefined);
        }}
      />
      <EditOrderDialog
        order={editTarget}
        open={Boolean(editTarget)}
        loading={loading}
        onOpenChange={(open) => !open && setEditTarget(undefined)}
        onConfirm={handleEdit}
      />
      <AssignRiderDialog
        order={riderTarget}
        riders={state.riders}
        open={Boolean(riderTarget)}
        loading={loading}
        onOpenChange={(open) => !open && setRiderTarget(undefined)}
        onConfirm={handleAssignRider}
      />
      {cancelTarget && (
        <CancelOrderDialog
          open={Boolean(cancelTarget)}
          orderId={cancelTarget.id}
          loading={loading}
          onOpenChange={(open) => !open && setCancelTarget(undefined)}
          onConfirm={handleCancel}
        />
      )}
      <CancelOrderDialog
        open={bulkCancelOpen}
        orderId={`${cancellableSelected.length} selected orders`}
        loading={loading}
        onOpenChange={setBulkCancelOpen}
        onConfirm={handleBulkCancel}
      />
    </div>
  );
}
