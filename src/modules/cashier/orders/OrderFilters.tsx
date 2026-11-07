import { useState } from "react";
import {
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ORDER_STATUSES } from "../constants";
import type { OrderStatus, OrderType, PaymentStatus } from "../types";
import {
  CashierButton,
  CashierInput,
  CashierSelect,
  Label,
  SearchToolbar,
} from "../components";

export interface OrderFilterValue {
  search: string;
  type: "All" | OrderType;
  status: "All" | OrderStatus;
  payment: "All" | PaymentStatus;
  from: string;
  to: string;
}


export function OrderFilters({
  value,
  searchRef,
  onChange,
}: {
  value: OrderFilterValue;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: OrderFilterValue) => void;
}) {
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const set = <K extends keyof OrderFilterValue>(
    key: K,
    next: OrderFilterValue[K],
  ) => onChange({ ...value, [key]: next });

  const secondaryFilterCount = [
    value.payment !== "All",
    Boolean(value.from),
    Boolean(value.to),
  ].filter(Boolean).length;

  const hasActiveFilters =
    value.type !== "All" ||
    value.status !== "All" ||
    value.payment !== "All" ||
    Boolean(value.from) ||
    Boolean(value.to);


  const activeFilterCount = [
    value.type !== "All",
    value.status !== "All",
    value.payment !== "All",
    Boolean(value.from),
    Boolean(value.to),
  ].filter(Boolean).length;

  const clearFilters = () =>
    onChange({
      ...value,
      type: "All",
      status: "All",
      payment: "All",
      from: "",
      to: "",
    });

  return (
    <SearchToolbar label="Order filters" className="p-3.5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1.5fr)_minmax(130px,0.65fr)_minmax(160px,0.8fr)_auto] xl:items-end">
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
        <div className="flex items-end gap-2 xl:hidden">
          <CashierButton
            variant="secondary"
            className="flex-1"
            aria-expanded={mobileFiltersOpen}
            aria-controls="order-mobile-filters"
            onClick={() => setMobileFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </CashierButton>
          {hasActiveFilters ? (
            <CashierButton variant="ghost" onClick={clearFilters}>Clear</CashierButton>
          ) : null}
        </div>
        <div id="order-mobile-filters" className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 sm:col-span-2 sm:grid-cols-2 xl:contents`}>
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
        </div>
      </div>

      {hasActiveFilters ? (
        <div
          className={`${mobileFiltersOpen ? "flex" : "hidden"} mt-3 flex-wrap items-center gap-2 border-t border-border/70 pt-3 xl:flex`}
          aria-label="Active order filters"
        >
          <span className="mr-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Active
          </span>
          {value.type !== "All" ? (
            <FilterChip label={value.type} onClear={() => set("type", "All")} />
          ) : null}
          {value.status !== "All" ? (
            <FilterChip
              label={value.status}
              onClear={() => set("status", "All")}
            />
          ) : null}
          {value.payment !== "All" ? (
            <FilterChip label={`Payment: ${value.payment}`} onClear={() => set("payment", "All")} />
          ) : null}

          {value.from ? (
            <FilterChip
              label={`From ${value.from}`}
              onClear={() => set("from", "")}
            />
          ) : null}
          {value.to ? (
            <FilterChip
              label={`To ${value.to}`}
              onClear={() => set("to", "")}
            />
          ) : null}

          <button
            type="button"
            onClick={clearFilters}
            className="cashier-action hidden min-h-8 rounded-lg px-2.5 text-[10px] font-black text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:inline-flex"
          >
            Clear filters
          </button>
        </div>
      ) : null} 

      {moreFiltersOpen ? (
        <div
          id="order-secondary-filters"
          className={`${
            mobileFiltersOpen ? "" : "hidden xl:block"
          } mt-4 border-t border-border/80 pt-4`}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="order-payment-status">
                Payment status
              </Label>
              <CashierSelect
                id="order-payment-status"
                value={value.payment}
                onChange={(event) =>
                  set(
                    "payment",
                    event.target.value as OrderFilterValue["payment"]
                  )
                }
              >
                <option>All</option>
                <option>Unpaid</option>
                <option value="Unknown">
                  Payment status unavailable
                </option>
                <option>Pending</option>
                <option>Verified</option>
                <option>Rejected</option>
              </CashierSelect>
            </div>

            <div>
              <Label htmlFor="order-from">From</Label>
              <CashierInput
                id="order-from"
                type="date"
                value={value.from}
                onChange={(event) =>
                  set("from", event.target.value)
                }
              />
            </div>

            <div>
              <Label htmlFor="order-to">To</Label>
              <CashierInput
                id="order-to"
                type="date"
                value={value.to}
                onChange={(event) =>
                  set("to", event.target.value)
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </SearchToolbar>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label} filter`}
      onClick={onClear}
      className="cashier-action inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 text-[10px] font-black text-primary hover:border-primary/35 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {label}
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}
