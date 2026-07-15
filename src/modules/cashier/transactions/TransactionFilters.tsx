import { Search } from "lucide-react";
import type { CashierShift, PaymentMethod, TransactionStatus } from "../types";
import { CashierInput, CashierSelect, Label } from "../components/CashierUI";

export interface TransactionFilterValue {
  search: string;
  method: "All" | PaymentMethod;
  status: "All" | TransactionStatus;
  from: string;
  to: string;
  cashier: string;
  shift: string;
}

export function TransactionFilters({
  value,
  searchRef,
  shifts,
  cashiers,
  onChange,
}: {
  value: TransactionFilterValue;
  searchRef: React.RefObject<HTMLInputElement | null>;
  shifts: CashierShift[];
  cashiers: string[];
  onChange: (value: TransactionFilterValue) => void;
}) {
  const set = <K extends keyof TransactionFilterValue>(
    key: K,
    next: TransactionFilterValue[K],
  ) => onChange({ ...value, [key]: next });
  return (
    <section
      className="cashier-filter-bar rrj-card p-4"
      aria-label="Transaction filters"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.8fr_0.9fr_1fr]">
        <div>
          <Label htmlFor="txn-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <CashierInput
              ref={searchRef}
              id="txn-search"
              aria-keyshortcuts="/"
              value={value.search}
              onChange={(event) => set("search", event.target.value)}
              placeholder="Transaction, order, customer"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="txn-method">Method</Label>
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
          <Label htmlFor="txn-status">Status</Label>
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
          <Label htmlFor="txn-from">From</Label>
          <CashierInput
            id="txn-from"
            type="date"
            value={value.from}
            onChange={(event) => set("from", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="txn-to">To</Label>
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
      </div>
    </section>
  );
}
