import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useCashierStore } from "../hooks/CashierStore";
import type { CashierNavigationIntent, Order, Transaction } from "../types";
import { CashierButton, PageHeading } from "../components/CashierUI";
import { OrderDetailsDrawer } from "../orders/OrderDetailsDrawer";
import { ReceiptDialog } from "../pos/ReceiptDialog";
import {
  TransactionFilters,
  type TransactionFilterValue,
} from "./TransactionFilters";
import { TransactionSummary } from "./TransactionSummary";
import { TransactionTable } from "./TransactionTable";

const defaults: TransactionFilterValue = {
  search: "",
  method: "All",
  status: "All",
  from: "",
  to: "",
  cashier: "All",
  shift: "All",
};

const todayInputValue = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export function TransactionHistoryPage({
  intent,
}: {
  intent?: CashierNavigationIntent;
}) {
  const { state, recordReceiptReprint } = useCashierStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<TransactionFilterValue>(() => ({
    ...defaults,
    method:
      intent?.paymentMethods?.length === 1 ? intent.paymentMethods[0] : "All",
    status:
      intent?.transactionStatuses?.length === 1
        ? intent.transactionStatuses[0]
        : "All",
    from: intent?.today ? todayInputValue() : "",
    to: intent?.today ? todayInputValue() : "",
  }));
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const openedRecent = useRef(false);
  const filtered = useMemo(
    () =>
      state.transactions
        .filter((transaction) => {
          const query = filters.search.toLowerCase();
          const created = transaction.createdAt.slice(0, 10);
          const matchesIntentStatus =
            !intent?.transactionStatuses?.length ||
            intent.transactionStatuses.includes(transaction.status);
          const matchesIntentMethod =
            !intent?.paymentMethods?.length ||
            intent.paymentMethods.includes(transaction.method);
          return (
            matchesIntentStatus &&
            matchesIntentMethod &&
            (!query ||
              `${transaction.id} ${transaction.orderId} ${transaction.customerName}`
                .toLowerCase()
                .includes(query)) &&
            (filters.method === "All" ||
              transaction.method === filters.method) &&
            (filters.status === "All" ||
              transaction.status === filters.status) &&
            (!filters.from || created >= filters.from) &&
            (!filters.to || created <= filters.to) &&
            (filters.cashier === "All" ||
              transaction.cashierName === filters.cashier) &&
            (filters.shift === "All" || transaction.shiftId === filters.shift)
          );
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [state.transactions, filters, intent],
  );
  useEffect(() => {
    if (intent?.openMostRecentReceipt && !openedRecent.current) {
      const recent = state.transactions.find(
        (entry) => entry.status === "Completed",
      );
      const order = state.orders.find((entry) => entry.id === recent?.orderId);
      if (order) setReceiptOrder(order);
      openedRecent.current = true;
    }
  }, [intent, state]);
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
  const openOrder = (transaction: Transaction, receipt = false) => {
    const order = state.orders.find(
      (entry) => entry.id === transaction.orderId,
    );
    if (receipt) setReceiptOrder(order);
    else setSelectedOrder(order);
  };
  const exportCsv = () => {
    const rows = [
      [
        "Transaction ID",
        "Order ID",
        "Customer",
        "Amount",
        "Method",
        "Status",
        "Cashier",
        "Shift",
        "Date",
      ],
      ...filtered.map((entry) => [
        entry.id,
        entry.orderId,
        entry.customerName,
        entry.amount,
        entry.method,
        entry.status,
        entry.cashierName,
        entry.shiftId,
        entry.createdAt,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rrj-cashier-transactions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Filtered transactions exported.");
  };
  const payment = state.payments.find(
    (entry) => entry.orderId === receiptOrder?.id,
  );
  return (
    <div className="cashier-page">
      <PageHeading
        title="Transaction History"
        description="Filtered summaries, receipt actions, and shift-linked payment records"
        actions={
          <>
            <CashierButton
              variant="secondary"
              disabled={!filtered.length}
              onClick={exportCsv}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </CashierButton>
            <CashierButton
              variant="secondary"
              disabled={!filtered.length}
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Print report
            </CashierButton>
          </>
        }
      />
      <TransactionSummary transactions={filtered} />
      <TransactionFilters
        value={filters}
        searchRef={searchRef}
        shifts={state.shifts}
        cashiers={[
          ...new Set(state.transactions.map((entry) => entry.cashierName)),
        ]}
        onChange={setFilters}
      />
      <section className="rrj-card overflow-hidden">
        <TransactionTable
          transactions={filtered}
          onView={(transaction) => openOrder(transaction)}
          onPrint={(transaction) => {
            openOrder(transaction, true);
            toast.success("Receipt preview opened.");
          }}
        />
        <div className="cashier-table-footer flex flex-col gap-1 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{filtered.length} filtered records</span>
          <strong className="text-foreground">
            Summary totals use these results
          </strong>
        </div>
      </section>
      <OrderDetailsDrawer
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(undefined);
        }}
      />
      <ReceiptDialog
        order={receiptOrder}
        payment={payment}
        open={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(undefined)}
        onPrint={() =>
          receiptOrder ? recordReceiptReprint(receiptOrder.id) : undefined
        }
      />
    </div>
  );
}
