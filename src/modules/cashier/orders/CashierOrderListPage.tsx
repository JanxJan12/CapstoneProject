import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { toast } from "sonner";
import { PAGE_SIZE } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { CashierNavigationIntent, Order } from "../types";
import {
  CashierButton,
  ErrorBanner,
  PageHeading,
} from "../components/CashierUI";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { OrderDetailsDrawer } from "./OrderDetailsDrawer";
import { OrderFilters, type OrderFilterValue } from "./OrderFilters";
import { OrderTable } from "./OrderTable";

const defaultFilters: OrderFilterValue = {
  search: "",
  type: "All",
  status: "All",
  from: "",
  to: "",
  sort: "newest",
};

const todayInputValue = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export function CashierOrderListPage({
  intent,
}: {
  intent?: CashierNavigationIntent;
}) {
  const { state, cancelOrder, recordReceiptReprint } = useCashierStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<OrderFilterValue>(() => ({
    ...defaultFilters,
    search: intent?.search ?? "",
    type: intent?.orderTypes?.length === 1 ? intent.orderTypes[0] : "All",
    status: intent?.statuses?.length === 1 ? intent.statuses[0] : "All",
    from: intent?.today ? todayInputValue() : "",
    to: intent?.today ? todayInputValue() : "",
  }));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order>();
  const [cancelTarget, setCancelTarget] = useState<Order>();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasOpenedReady = useRef(false);
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
      if (ready) setSelected(ready);
      hasOpenedReady.current = true;
    }
  }, [intent, state.orders]);
  const filtered = useMemo(() => {
    const result = state.orders.filter((order) => {
      const query = filters.search.toLowerCase();
      const created = order.createdAt.slice(0, 10);
      const matchesIntent =
        !intent?.statuses?.length || intent.statuses.includes(order.status);
      const matchesIntentType =
        !intent?.orderTypes?.length || intent.orderTypes.includes(order.type);
      return (
        matchesIntent &&
        matchesIntentType &&
        (!query ||
          `${order.id} ${order.customerName}`.toLowerCase().includes(query)) &&
        (filters.type === "All" || order.type === filters.type) &&
        (filters.status === "All" || order.status === filters.status) &&
        (!filters.from || created >= filters.from) &&
        (!filters.to || created <= filters.to)
      );
    });
    return result.sort((a, b) =>
      filters.sort === "oldest"
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : filters.sort === "total-high"
          ? b.total - a.total
          : filters.sort === "total-low"
            ? a.total - b.total
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [state.orders, filters, intent]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [filters, intent]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return;
    setLoading(true);
    setError("");
    try {
      await cancelOrder(cancelTarget.id, reason);
      toast.success(`${cancelTarget.id} cancelled`, {
        description: "The shared order and transaction records were updated.",
      });
      setCancelTarget(undefined);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to cancel the order.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="cashier-page">
      <PageHeading
        title="Order List"
        description={`${filtered.length} matching orders from the shared cashier records`}
        actions={
          <div
            className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700"
            role="status"
          >
            <Radio className="h-3 w-3 animate-pulse" />
            Auto-refresh active
          </div>
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
          window.setTimeout(() => {
            setRefreshing(false);
            toast.success("Order list is up to date");
          }, 350);
        }}
      />
      <section className="rrj-card overflow-hidden">
        <OrderTable
          orders={visible}
          delayedThreshold={state.delayedThresholdMinutes}
          onView={setSelected}
          onPrint={(order) => {
            window.print();
            if (order.transactionId) void recordReceiptReprint(order.id);
            toast.success(
              `${order.transactionId ? "Receipt" : "Order ticket"} sent to the print dialog.`,
            );
          }}
          onCancel={setCancelTarget}
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
        order={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
      />
      {cancelTarget && (
        <CancelOrderDialog
          open={Boolean(cancelTarget)}
          orderId={cancelTarget.id}
          loading={loading}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(undefined);
          }}
          onConfirm={handleCancel}
        />
      )}
    </div>
  );
}
