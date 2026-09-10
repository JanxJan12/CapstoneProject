import { useState } from "react";
import {
  ChevronDown,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { ORDER_STATUSES } from "../constants";
import type { OrderStatus, OrderType } from "../types";
import type { BaseOrderSort } from "./orderOperations";
import {
  CashierButton,
  CashierInput,
  CashierSelect,
  Label,
  SearchToolbar,
} from "../components";

export interface OrderFilterValue {
  search: string;
  quick:
    | "All"
    | "Delayed"
    | "Needs Payment"
    | "Kitchen Active"
    | "Needs Rider"
    | "Ready";
  type: "All" | OrderType;
  status: "All" | OrderStatus;
  from: string;
  to: string;
  sort: BaseOrderSort;
}

const QUICK_FILTERS: OrderFilterValue["quick"][] = [
  "All",
  "Delayed",
  "Needs Payment",
  "Kitchen Active",
  "Needs Rider",
  "Ready",
];

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
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const set = <K extends keyof OrderFilterValue>(
    key: K,
    next: OrderFilterValue[K],
  ) => onChange({ ...value, [key]: next });
  const secondaryFilterCount = [
    value.quick !== "All",
    Boolean(value.from),
    Boolean(value.to),
    value.sort !== "operations",
  ].filter(Boolean).length;

  return (
    <SearchToolbar label="Order filters">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(300px,1.5fr)_minmax(150px,0.7fr)_minmax(180px,0.85fr)_auto_auto] xl:items-end">
        <div className="sm:col-span-2 xl:col-span-1">
          <Label htmlFor="order-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <CashierInput
              ref={searchRef}
              id="order-search"
              aria-keyshortcuts="/ Control+F Meta+F"
              value={value.search}
              onChange={(event) => set("search", event.target.value)}
              placeholder="Order, customer, phone, or item"
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
        <div className="flex items-end">
          <CashierButton
            variant="secondary"
            className="w-full"
            aria-expanded={moreFiltersOpen}
            aria-controls="order-secondary-filters"
            onClick={() => setMoreFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            More filters
            {secondaryFilterCount ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-[9px] text-primary">
                {secondaryFilterCount}
              </span>
            ) : null}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${moreFiltersOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </CashierButton>
        </div>
        <div className="flex items-end">
          <CashierButton
            variant="secondary"
            className="w-full"
            loading={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </CashierButton>
        </div>
      </div>

      {moreFiltersOpen ? (
        <div
          id="order-secondary-filters"
          className="mt-4 border-t border-border/80 pt-4"
        >
          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Quick filters"
          >
            <span className="mr-1 text-[9px] font-black uppercase tracking-widest text-foreground/60">
              Quick filter
            </span>
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={value.quick === filter}
                onClick={() => set("quick", filter)}
                className={`min-h-9 rounded-full border px-3 text-[10px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  value.quick === filter
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white text-foreground/65 hover:border-primary/30 hover:text-primary"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="order-sort">Base sort</Label>
              <CashierSelect
                id="order-sort"
                value={value.sort}
                onChange={(event) =>
                  set("sort", event.target.value as OrderFilterValue["sort"])
                }
              >
                <option value="operations">Operations priority</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="total-high">Total: high</option>
                <option value="total-low">Total: low</option>
              </CashierSelect>
            </div>
          </div>
        </div>
      ) : null}
    </SearchToolbar>
  );
}
