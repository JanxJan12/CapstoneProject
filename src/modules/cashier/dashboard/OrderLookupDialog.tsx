import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, XIcon } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { CashierInput, StatusBadge, EmptyState } from "../components";
import { formatMoney } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order } from "../types";
import { matchesOrderSearch } from "../orders/orderOperations";

export function OrderLookupDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (order: Order) => void;
}) {
  const { state } = useCashierStore();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    if (!query.trim()) {
      return state.orders.slice(0, 6);
    }

    return state.orders
      .filter((order) => matchesOrderSearch(order, query))
      .slice(0, 8);
  }, [query, state.orders]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);

        if (!value) {
          setQuery("");
        }
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content
            data-testid="order-lookup-dialog"
            className="pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#fffdf9] shadow-[0_24px_70px_rgba(36,26,19,0.22)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Close
              className="absolute right-3.5 top-3.5 z-10 rounded-[10px] p-2 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Close order search"
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
            {/* Fixed header */}
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
              <DialogTitle>Search all orders</DialogTitle>

              <DialogDescription>
                Find an order by number, customer, phone, or item.
              </DialogDescription>
            </DialogHeader>

            {/* Fixed search field */}
            <div className="shrink-0 border-b border-border px-6 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <CashierInput
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ORD-2046, Walk-in, or 0917…"
                  className="pl-9"
                  aria-label="Search all orders"
                />
              </div>
            </div>

            {/* Scrollable results */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              <div className="space-y-2">
                {matches.length > 0 ? (
                  matches.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => {
                        onSelect(order);
                        onOpenChange(false);
                      }}
                      className="
                    flex min-h-[64px] w-full items-center gap-3
                    rounded-xl border border-border bg-white px-3
                    text-left transition
                    hover:border-primary/25 hover:bg-amber-50/35
                    focus-visible:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-primary
                  "
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <strong className="font-mono text-xs text-primary">
                            {order.id}
                          </strong>

                          <StatusBadge status={order.status} />
                        </span>

                        <span className="mt-1 block truncate text-[10px] font-semibold text-muted-foreground">
                          {order.customerName} · {order.type} ·{" "}
                          {order.contactNumber}
                        </span>
                      </span>

                      <strong className="shrink-0 text-xs">
                        {formatMoney(order.total)}
                      </strong>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon={Search}
                    title="No matching order"
                    description="Check the order ID, name, or contact number and try again."
                  />
                )}
              </div>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
