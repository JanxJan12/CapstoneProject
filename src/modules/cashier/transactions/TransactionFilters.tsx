import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { CashierShift, PaymentMethod, TransactionStatus } from "../types";
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
  status: "All" | TransactionStatus;
  from: string;
  to: string;
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
  cashiers,
  terminals,
  onChange,
  onReset,
}: {
  value: TransactionFilterValue;
  searchRef: React.RefObject<HTMLInputElement | null>;
  shifts: CashierShift[];
  cashiers: string[];
  terminals: string[];
  onChange: (value: TransactionFilterValue) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof TransactionFilterValue>(
    key: K,
    next: TransactionFilterValue[K],
  ) => onChange({ ...value, [key]: next });
  const secondaryFilterCount = [
    Boolean(value.from),
    Boolean(value.to),
    value.cashier !== "All",
    value.shift !== "All",
    value.terminal !== "All",
    Boolean(value.customer),
    Boolean(value.orderId),
    Boolean(value.receiptNumber),
  ].filter(Boolean).length;

  return (
    <SearchToolbar label="Transaction filters">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(320px,1.6fr)_minmax(150px,0.65fr)_minmax(180px,0.75fr)_auto] xl:items-end">
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
              placeholder="Transaction or payment reference"
              className="pl-9"
            />
          </div>
        </div>
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
          </CashierSelect>
        </div>
        <div className="flex items-end">
          <CashierButton variant="ghost" className="w-full" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </CashierButton>
        </div>
      </div>

      <details className="group mt-3 border-t border-border/70 pt-3">
        <summary className="cashier-action inline-flex min-h-9 cursor-pointer list-none select-none items-center justify-center gap-2 rounded-[10px] border border-border bg-white px-3 text-[11px] font-black text-foreground shadow-sm transition-all hover:border-primary/25 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          More filters
          {secondaryFilterCount ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1 text-[9px] text-primary">
              {secondaryFilterCount}
            </span>
          ) : null}
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div
          id="transaction-secondary-filters"
          className="mt-3 rounded-xl border border-border/70 bg-white/55 p-3.5"
        >
          <div className="mb-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground/65">
              Advanced filters
            </h2>
            <p className="mt-1 text-[9px] text-muted-foreground">
              Narrow linked receipt, shift, terminal, cashier, customer, and
              order records.
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
              <Label htmlFor="txn-cashier">Cashier</Label>
              <CashierSelect
                id="txn-cashier"
                value={value.cashier}
                onChange={(event) => set("cashier", event.target.value)}
              >
                <option>All</option>
                {cashiers.map((cashier) => (
                  <option key={cashier}>{cashier}</option>
                ))}
              </CashierSelect>
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
                    {shift.id}
                  </option>
                ))}
              </CashierSelect>
            </div>
            <div>
              <Label htmlFor="txn-terminal">Terminal</Label>
              <CashierSelect
                id="txn-terminal"
                value={value.terminal}
                onChange={(event) => set("terminal", event.target.value)}
              >
                <option>All</option>
                {terminals.map((terminal) => (
                  <option key={terminal}>{terminal}</option>
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
            <div>
              <Label htmlFor="txn-receipt">Receipt number</Label>
              <CashierInput
                id="txn-receipt"
                value={value.receiptNumber}
                onChange={(event) => set("receiptNumber", event.target.value)}
                placeholder="RCP-4108"
              />
            </div>
          </div>
        </div>
      </details>
    </SearchToolbar>
  );
}
