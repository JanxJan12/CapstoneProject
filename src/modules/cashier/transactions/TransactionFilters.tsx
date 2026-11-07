import { useState } from "react";
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { CashierShift, PaymentMethod } from "../types";
import { formatDateTime } from "../constants";
import {
  CashierButton,
  CashierInput,
  CashierSelect,
  Label,
  SearchToolbar,
} from "../components";

export interface TransactionFilterValue {
  search: string;
  method: "All" | PaymentMethod;
  status: "All" | "Completed" | "Voided";
  from: string;
  to: string;
  /** Retained for the legacy pure export adapter; the active owner-scoped UI has no selector. */
  cashier: string;
  shift: string;
  terminal: string;
  customer: string;
  orderId: string;
  receiptNumber: string;
}

export function TransactionFilters({
  value,
  searchRef,
  shifts,
  terminals,
  onChange,
  onReset,
}: {
  value: TransactionFilterValue;
  searchRef: React.RefObject<HTMLInputElement | null>;
  shifts: CashierShift[];
  terminals: string[];
  onChange: (value: TransactionFilterValue) => void;
  onReset: () => void;
}) {
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const set = <K extends keyof TransactionFilterValue>(
    key: K,
    next: TransactionFilterValue[K],
  ) => onChange({ ...value, [key]: next });
  const secondaryFilterCount = [
    Boolean(value.from),
    Boolean(value.to),
    value.shift !== "All",
    Boolean(value.customer),
    Boolean(value.orderId)
  ].filter(Boolean).length;
  const activeFilterCount = secondaryFilterCount + [
    Boolean(value.search.trim()), value.method !== "All", value.status !== "All",
  ].filter(Boolean).length;

  return (
    <SearchToolbar label="Transaction filters" className="p-3.5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1.5fr)_minmax(130px,0.65fr)_minmax(165px,0.75fr)_auto_auto] xl:items-end">
        <div className="sm:col-span-2 xl:col-span-1">
          <Label htmlFor="txn-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <CashierInput
              ref={searchRef}
              id="txn-search"
              aria-keyshortcuts="/"
              value={value.search}
              onChange={(event) => set("search", event.target.value)}
              placeholder="Receipt, transaction ID, or GCash reference"
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex items-end gap-2 xl:hidden">
          <CashierButton
            variant="secondary"
            className="flex-1"
            aria-expanded={mobileFiltersOpen}
            aria-controls="transaction-mobile-filters"
            onClick={() => setMobileFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </CashierButton>
          {activeFilterCount ? (
            <CashierButton variant="ghost" onClick={onReset}>Reset</CashierButton>
          ) : null}
        </div>
        <div id="transaction-mobile-filters" className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 sm:col-span-2 sm:grid-cols-2 xl:contents`}>
        <div>
          <Label htmlFor="txn-method">Payment</Label>
          <CashierSelect
            id="txn-method"
            value={value.method}
            onChange={(event) =>
              set(
                "method",
                event.target.value as TransactionFilterValue["method"],
              )
            }
          >
            <option>All</option>
            <option>Cash</option>
            <option>GCash</option>
          </CashierSelect>
        </div>
        <div>
          <Label htmlFor="txn-status">Transaction status</Label>
          <CashierSelect
            id="txn-status"
            value={value.status}
            onChange={(event) =>
              set(
                "status",
                event.target.value as TransactionFilterValue["status"],
              )
            }
          >
            <option>All</option>
            <option>Completed</option>
            <option>Voided</option>
          </CashierSelect>
        </div>
        <div className="flex items-end">
          <CashierButton
            variant="secondary"
            className="w-full"
            aria-expanded={moreFiltersOpen}
            aria-controls="transaction-secondary-filters"
            onClick={() => setMoreFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
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
          <CashierButton variant="ghost" className="w-full" onClick={onReset} disabled={!activeFilterCount}>
            <RotateCcw className="h-4 w-4" />
            Reset{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </CashierButton>
        </div>
        </div>
      </div>

      {moreFiltersOpen ? (
        <div
          id="transaction-secondary-filters"
          className={`${mobileFiltersOpen ? "" : "hidden xl:block"} mt-3 border-t border-border/70 pt-3`}
        >
          <div className="mb-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground/65">
              Advanced filters
            </h2>
            <p className="mt-1 text-[9px] text-muted-foreground">
              Find transactions by date, shift, customer, or order.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <Label htmlFor="txn-from">Date range from</Label>
              <CashierInput
                id="txn-from"
                type="date"
                value={value.from}
                onChange={(event) => set("from", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="txn-to">Date range to</Label>
              <CashierInput
                id="txn-to"
                type="date"
                value={value.to}
                onChange={(event) => set("to", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="txn-shift">Shift</Label>
              <CashierSelect
                id="txn-shift"
                value={value.shift}
                onChange={(event) => set("shift", event.target.value)}
              >
                <option value="All">All shifts</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.terminal} · {formatDateTime(shift.startedAt)}
                  </option>
                ))}
              </CashierSelect>
            </div>

            <div>
              <Label htmlFor="txn-customer">Customer</Label>
              <CashierInput
                id="txn-customer"
                value={value.customer}
                onChange={(event) => set("customer", event.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label htmlFor="txn-order">Order ID</Label>
              <CashierInput
                id="txn-order"
                value={value.orderId}
                onChange={(event) => set("orderId", event.target.value)}
                placeholder="ORD-2048"
              />
            </div>
          </div>
        </div>
      ) : null}
    </SearchToolbar>
  );
}
