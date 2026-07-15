import { RefreshCw, Search } from "lucide-react";
import { ORDER_STATUSES } from "../constants";
import type { OrderStatus, OrderType } from "../types";
import {
  CashierButton,
  CashierInput,
  CashierSelect,
  Label,
} from "../components/CashierUI";

export interface OrderFilterValue {
  search: string;
  type: "All" | OrderType;
  status: "All" | OrderStatus;
  from: string;
  to: string;
  sort: "newest" | "oldest" | "total-high" | "total-low";
}

export function OrderFilters({
  value,
  searchRef,
  refreshing,
  onChange,
  onRefresh,
}: {
  value: OrderFilterValue;
  searchRef: React.RefObject<HTMLInputElement | null>;
  refreshing: boolean;
  onChange: (value: OrderFilterValue) => void;
  onRefresh: () => void;
}) {
  const set = <K extends keyof OrderFilterValue>(
    key: K,
    next: OrderFilterValue[K],
  ) => onChange({ ...value, [key]: next });
  return (
    <section
      className="cashier-filter-bar rrj-card p-4"
      aria-label="Order filters"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_0.8fr_1fr_0.8fr_0.8fr_0.9fr_auto]">
        <div>
          <Label htmlFor="order-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <CashierInput
              ref={searchRef}
              id="order-search"
              aria-keyshortcuts="/ Control+F Meta+F"
              value={value.search}
              onChange={(event) => set("search", event.target.value)}
              placeholder="Order ID or customer"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="order-type">Order type</Label>
          <CashierSelect
            id="order-type"
            value={value.type}
            onChange={(event) =>
              set("type", event.target.value as OrderFilterValue["type"])
            }
          >
            <option>All</option>
            <option>Dine-in</option>
            <option>Take-out</option>
            <option>Delivery</option>
          </CashierSelect>
        </div>
        <div>
          <Label htmlFor="order-status">Status</Label>
          <CashierSelect
            id="order-status"
            value={value.status}
            onChange={(event) =>
              set("status", event.target.value as OrderFilterValue["status"])
            }
          >
            <option>All</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </CashierSelect>
        </div>
        <div>
          <Label htmlFor="order-from">From</Label>
          <CashierInput
            id="order-from"
            type="date"
            value={value.from}
            onChange={(event) => set("from", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="order-to">To</Label>
          <CashierInput
            id="order-to"
            type="date"
            value={value.to}
            onChange={(event) => set("to", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="order-sort">Sort</Label>
          <CashierSelect
            id="order-sort"
            value={value.sort}
            onChange={(event) =>
              set("sort", event.target.value as OrderFilterValue["sort"])
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="total-high">Total: high</option>
            <option value="total-low">Total: low</option>
          </CashierSelect>
        </div>
        <div className="flex items-end">
          <CashierButton
            variant="secondary"
            loading={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </CashierButton>
        </div>
      </div>
    </section>
  );
}
