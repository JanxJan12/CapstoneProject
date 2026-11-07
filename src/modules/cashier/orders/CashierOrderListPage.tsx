import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { fetchHistoryPage } from "../transactions/historyReadApi";
import { DEFAULT_TRANSACTION_FILTERS } from "../transactions/useTransactionHistory";
import { selectAuthorizedReceipt } from "../ordersReceiptLinks";
import type { Order } from "../types";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { CashierButton, ErrorBanner, PageHeader, Toast } from "../components";
import { PAGE_SIZE } from "../constants";
import type { CashierNavigationIntent } from "../types";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { OrderCards } from "./OrderCards";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";
import { OrderFilters } from "./OrderFilters";
import { OrderTable } from "./OrderTable";
import { useOrderList } from "./useOrderList";

export function CashierOrderListPage({
  intent,
  embedded = false,
  active = true,
  onViewReceipt,
}: {
  intent?: CashierNavigationIntent;
  embedded?: boolean;
  active?: boolean;
  onViewReceipt?: (transactionId: string) => void;
}) {
  const orders = useOrderList(intent, active);
  const { session } = useAuth();
  const findingRef = useRef(false);
  const orderTriggerRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const activeRef = useRef(active);
  const sessionIdRef = useRef(session?.id);
  activeRef.current = active;
  sessionIdRef.current = session?.id;
  const [findingReceipt, setFindingReceipt] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    if (!active) orders.setDrawerOrderId(undefined);
  }, [active, orders.setDrawerOrderId]);
  useEffect(() => { orderTriggerRef.current = null; }, [intent]);
  const openOrder = (order: Order, trigger: HTMLElement) => {
    orderTriggerRef.current = trigger;
    orders.setDrawerOrderId(order.id);
  };
  const findReceipt = async (order: Order) => {
    if (findingRef.current || !onViewReceipt || !session || session.role !== "cashier" || !order.databaseId) return;
    findingRef.current = true;
    setFindingReceipt(true);
    try {
      const filters = { ...DEFAULT_TRANSACTION_FILTERS,
        ...(order.transactionId ? { search: order.transactionId } : { orderId: order.id }) };
      const result = await fetchHistoryPage(session.id, filters, 0, 100);
      if (!mountedRef.current || !activeRef.current || sessionIdRef.current !== session.id) return;
      const linked = selectAuthorizedReceipt(order, session.id, result.rows);
      if (!linked) {
        Toast.info(`No receipt accessible to you was found for ${order.id}.`);
        return;
      }
      orders.setDrawerOrderId(undefined);
      onViewReceipt(linked.id);
    } catch (error) {
      if (mountedRef.current && activeRef.current) {
        Toast.error(error instanceof Error ? error.message : "Unable to check the linked receipt.");
      }
    } finally {
      findingRef.current = false;
      if (mountedRef.current) setFindingReceipt(false);
    }
  };
  const liveState = orders.databaseError
    ? {
        label: "Offline",
        className: "border-red-200 bg-red-50 text-red-700",
      }
    : orders.refreshing
      ? {
          label: "Syncing",
          className: "border-amber-200 bg-amber-50 text-amber-800",
        }
      : {
          label: "Live",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        };

  return (
    <div className="cashier-page">
      <PageHeader
        title={embedded ? "Orders" : "Order List"}
        level={embedded ? 2 : 1}
        description={`${orders.filtered.length} matching orders`}
        actions={
          <>
            <CashierButton
              variant="secondary"
              onClick={() => orders.exportCsv()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </CashierButton>
            <div
              className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-[10px] font-black uppercase tracking-widest ${liveState.className}`}
              role="status"
              aria-live="polite"
            >
              <Radio
                className={`h-3 w-3 ${orders.refreshing ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
              {liveState.label}
            </div>
          </>
        }
      />
      {orders.error ? (
        <ErrorBanner
          message={orders.error}
          onRetry={() => orders.setError("")}
        />
      ) : null}
      {intent?.orderId && !orders.state.orders.some((order) =>
        order.id === intent.orderId || order.databaseId === intent.orderId,
      ) ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The linked order is unavailable to this Cashier.</p> : null}
      <OrderFilters
        value={orders.filters}
        searchRef={orders.searchRef}
        onChange={orders.setFilters}
      />
      <div className="mb-3 flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-white p-1 sm:flex-wrap sm:overflow-visible" aria-label="Order list views">
        {([
          ["today", "Today"],
          ["all", "All orders"],
          ["older", "Older"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-current={orders.view === key ? "page" : undefined}
            onClick={() => orders.setView(key)}
            className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${orders.view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
            {label} <span className="ml-1 tabular-nums opacity-75">{orders.viewCounts[key]}</span>
          </button>
        ))}
      </div>
      <section className="rrj-card overflow-hidden">
        {orders.selectedOrders.length ? (
          <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black">
                {orders.selectedOrders.length} orders selected
              </p>
              <p className="text-[10px] text-muted-foreground">
                Bulk actions apply across views and pages. Non-cancellable orders are
                skipped.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CashierButton
                variant="secondary"
                onClick={() => orders.exportCsv(true)}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export selected
              </CashierButton>
              <CashierButton
                variant="danger"
                disabled={!orders.cancellableSelected.length || orders.cancellationBlocked || orders.loading}
                onClick={() => orders.setBulkCancelOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Cancel
              </CashierButton>
              <CashierButton
                variant="ghost"
                onClick={() => orders.setSelectedIds(new Set())}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Clear
              </CashierButton>
            </div>
          </div>
        ) : null}
        <div className="xl:hidden">
          <OrderCards
            orders={orders.visible}
            delayedThreshold={orders.state.delayedThresholdMinutes}
            now={orders.now}
            selectedIds={orders.selectedIds}
            onToggleSelect={orders.toggleSelection}
            onView={openOrder}
            onCancel={orders.setCancelTarget}
          />
        </div>
        <div className="hidden xl:block">
          <OrderTable
            orders={orders.visible}
            delayedThreshold={orders.state.delayedThresholdMinutes}
            now={orders.now}
            sorts={orders.sorts}
            selectedIds={orders.selectedIds}
            onSort={orders.handleSort}
            onToggleSelect={orders.toggleSelection}
            onToggleSelectAll={orders.toggleSelectAll}
            onView={openOrder}
            onCancel={orders.setCancelTarget}
          />
        </div>
        <div className="cashier-table-footer flex flex-col gap-2 px-3.5 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing{" "}
            {orders.visible.length ? (orders.page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(orders.page * PAGE_SIZE, orders.filtered.length)} of{" "}
            {orders.filtered.length}
          </span>
          <div className="flex items-center gap-2" aria-label="Order pages">
            <CashierButton
              variant="secondary"
              disabled={orders.page === 1}
              onClick={() => orders.setPage((value) => value - 1)}
            >
              <ChevronLeft className="h-3 w-3" aria-hidden="true" />
              Previous
            </CashierButton>
            <strong className="text-foreground">
              Page {orders.page} of {orders.pages}
            </strong>
            <CashierButton
              variant="secondary"
              disabled={orders.page === orders.pages}
              onClick={() => orders.setPage((value) => value + 1)}
            >
              Next
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </CashierButton>
          </div>
        </div>
      </section>
      <OrderDetailsDrawer
        order={orders.drawerOrder}
        onFindReceipt={onViewReceipt ? findReceipt : undefined}
        findingReceipt={findingReceipt}
        onCloseAutoFocus={(event) => {
          const trigger = orderTriggerRef.current;
          orderTriggerRef.current = null;
          if (trigger?.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
        open={Boolean(orders.drawerOrder)}
        onOpenChange={(open) => {
          if (!open) {
            orders.setDrawerOrderId(undefined);
          }
        }}
      />
      {orders.cancelTarget ? (
        <CancelOrderDialog
          open
          orderId={orders.cancelTarget.id}
          loading={orders.loading}
          disabled={orders.cancellationBlocked}
          onOpenChange={(open) => !open && orders.setCancelTarget(undefined)}
          onConfirm={orders.handleCancel}
        />
      ) : null}
      <CancelOrderDialog
        open={orders.bulkCancelOpen}
        orderId={`${orders.cancellableSelected.length} selected orders`}
        loading={orders.loading}
        disabled={orders.cancellationBlocked || !orders.cancellableSelected.length}
        onOpenChange={orders.setBulkCancelOpen}
        onConfirm={orders.handleBulkCancel}
      />
    </div>
  );
}
