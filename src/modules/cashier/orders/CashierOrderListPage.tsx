import {
  ChevronLeft,
  ChevronRight,
  Download,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { CashierButton, ErrorBanner, PageHeader } from "../components";
import { PAGE_SIZE } from "../constants";
import type { CashierNavigationIntent } from "../types";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { EditOrderDialog } from "./EditOrderDialog";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";
import { OrderFilters } from "./OrderFilters";
import { OrderTable } from "./OrderTable";
import { useOrderList } from "./useOrderList";

export function CashierOrderListPage({
  intent,
}: {
  intent?: CashierNavigationIntent;
}) {
  const orders = useOrderList(intent);

  return (
    <div className="cashier-page">
      <PageHeader
        title="Order List"
        description={`${orders.filtered.length} matching orders in the central operations queue`}
        actions={
          <>
            <CashierButton
              variant="secondary"
              size="sm"
              onClick={() => orders.exportCsv()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </CashierButton>
            <div
              className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700"
              role="status"
            >
              <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" />
              Live updates
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
      <OrderFilters
        value={orders.filters}
        searchRef={orders.searchRef}
        refreshing={orders.refreshing}
        onChange={orders.setFilters}
        onRefresh={orders.refresh}
      />
      <section className="rrj-card overflow-hidden">
        {orders.selectedOrders.length ? (
          <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black">
                {orders.selectedOrders.length} orders selected
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
                onClick={() => orders.exportCsv(true)}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export selected
              </CashierButton>
              <CashierButton
                variant="danger"
                size="sm"
                disabled={!orders.cancellableSelected.length}
                onClick={() => orders.setBulkCancelOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Cancel
              </CashierButton>
              <CashierButton
                variant="ghost"
                size="sm"
                onClick={() => orders.setSelectedIds(new Set())}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Clear
              </CashierButton>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-1 border-b border-border bg-white px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Delayed active orders always stay at the top.</span>
          <span>
            Click a column to sort; Shift-click adds up to three sort levels.
          </span>
        </div>
        <OrderTable
          orders={orders.visible}
          delayedThreshold={orders.state.delayedThresholdMinutes}
          now={orders.now}
          sorts={orders.sorts}
          selectedIds={orders.selectedIds}
          expandedIds={orders.expandedIds}
          onSort={orders.handleSort}
          onToggleSelect={orders.toggleSelection}
          onToggleSelectAll={orders.toggleSelectAll}
          onToggleExpand={orders.toggleExpansion}
          onView={(order) => orders.setDrawerOrderId(order.id)}
          onEdit={orders.setEditTarget}
          onCancel={orders.setCancelTarget}
        />
        <div className="cashier-table-footer flex flex-col gap-2 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing{" "}
            {orders.visible.length ? (orders.page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(orders.page * PAGE_SIZE, orders.filtered.length)} of{" "}
            {orders.filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <CashierButton
              variant="secondary"
              size="sm"
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
              size="sm"
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
        open={Boolean(orders.drawerOrder)}
        onOpenChange={(open) => {
          if (!open) orders.setDrawerOrderId(undefined);
        }}
      />
      <EditOrderDialog
        order={orders.editTarget}
        open={Boolean(orders.editTarget)}
        loading={orders.loading}
        onOpenChange={(open) => !open && orders.setEditTarget(undefined)}
        onConfirm={orders.handleEdit}
      />
      {orders.cancelTarget ? (
        <CancelOrderDialog
          open
          orderId={orders.cancelTarget.id}
          loading={orders.loading}
          onOpenChange={(open) => !open && orders.setCancelTarget(undefined)}
          onConfirm={orders.handleCancel}
        />
      ) : null}
      <CancelOrderDialog
        open={orders.bulkCancelOpen}
        orderId={`${orders.cancellableSelected.length} selected orders`}
        loading={orders.loading}
        onOpenChange={orders.setBulkCancelOpen}
        onConfirm={orders.handleBulkCancel}
      />
    </div>
  );
}
