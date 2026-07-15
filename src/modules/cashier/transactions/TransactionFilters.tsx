import { RotateCcw, Search } from "lucide-react";
import type { CashierShift, PaymentMethod, TransactionStatus } from "../types";
import {
  CashierButton,
  CashierInput,
  CashierSelect,
  Label,
} from "../components/CashierUI";

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

  return (
    <section
      className="cashier-filter-bar rrj-card p-4"
      aria-label="Advanced transaction filters"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-foreground">
            Advanced filters
          </h2>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Filters use linked transaction, receipt, shift, payment, and order
            records.
          </p>
        </div>
        <CashierButton variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </CashierButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <Label htmlFor="txn-search">Search records</Label>
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
            <option>Refunded</option>
            <option>Voided</option>
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
    </section>
  );
}
