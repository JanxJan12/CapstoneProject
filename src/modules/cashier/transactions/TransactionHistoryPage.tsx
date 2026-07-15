import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useCashierStore } from "../hooks/CashierStore";
import type { CashierNavigationIntent, Transaction } from "../types";
import { CashierButton, PageHeading } from "../components/CashierUI";
import { ReceiptDialog } from "../pos/ReceiptDialog";
import { TransactionDetailDrawer } from "./TransactionDetailDrawer";
import {
  TransactionFilters,
  type TransactionFilterValue,
} from "./TransactionFilters";
import {
  getBasketQuantity,
  getReceiptNumber,
} from "./transactionRecords";
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
  terminal: "All",
  customer: "",
  orderId: "",
  receiptNumber: "",
};

const todayInputValue = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const csvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

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
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>();
  const [receiptTransactionId, setReceiptTransactionId] = useState<string>();
  const openedRecent = useRef(false);

  const shiftMap = useMemo(
    () => new Map(state.shifts.map((shift) => [shift.id, shift])),
    [state.shifts],
  );
  const orderMap = useMemo(
    () => new Map(state.orders.map((order) => [order.id, order])),
    [state.orders],
  );
  const paymentMap = useMemo(
    () => new Map(state.payments.map((payment) => [payment.id, payment])),
    [state.payments],
  );

  const filtered = useMemo(
    () =>
      state.transactions
        .filter((transaction) => {
          const query = filters.search.trim().toLowerCase();
          const customer = filters.customer.trim().toLowerCase();
          const orderQuery = filters.orderId.trim().toLowerCase();
          const receiptQuery = filters.receiptNumber.trim().toLowerCase();
          const created = transaction.createdAt.slice(0, 10);
          const shift = shiftMap.get(transaction.shiftId);
          const payment = paymentMap.get(transaction.paymentId);
          const receiptNumber = getReceiptNumber(transaction);
          const searchable =
            `${transaction.id} ${receiptNumber} ${payment?.referenceNumber ?? ""}`.toLowerCase();
          return (
            (!query || searchable.includes(query)) &&
            (filters.method === "All" ||
              transaction.method === filters.method) &&
            (filters.status === "All" ||
              transaction.status === filters.status) &&
            (!filters.from || created >= filters.from) &&
            (!filters.to || created <= filters.to) &&
            (filters.cashier === "All" ||
              transaction.cashierName === filters.cashier) &&
            (filters.shift === "All" ||
              transaction.shiftId === filters.shift) &&
            (filters.terminal === "All" ||
              shift?.terminal === filters.terminal) &&
            (!customer ||
              transaction.customerName.toLowerCase().includes(customer)) &&
            (!orderQuery ||
              transaction.orderId.toLowerCase().includes(orderQuery)) &&
            (!receiptQuery ||
              receiptNumber.toLowerCase().includes(receiptQuery))
          );
        })
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        ),
    [state.transactions, filters, shiftMap, paymentMap],
  );

  useEffect(() => {
    if (intent?.openMostRecentReceipt && !openedRecent.current) {
      const recent = state.transactions.find(
        (transaction) => transaction.status === "Completed",
      );
      if (recent) setReceiptTransactionId(recent.id);
      openedRecent.current = true;
    }
  }, [intent, state.transactions]);

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

  const selectedTransaction = state.transactions.find(
    (transaction) => transaction.id === selectedTransactionId,
  );
  const selectedOrder = selectedTransaction
    ? orderMap.get(selectedTransaction.orderId)
    : undefined;
  const selectedPayment = selectedTransaction
    ? paymentMap.get(selectedTransaction.paymentId)
    : undefined;
  const selectedShift = selectedTransaction
    ? shiftMap.get(selectedTransaction.shiftId)
    : undefined;
  const receiptTransaction = state.transactions.find(
    (transaction) => transaction.id === receiptTransactionId,
  );
  const receiptOrder = receiptTransaction
    ? orderMap.get(receiptTransaction.orderId)
    : undefined;
  const receiptPayment = receiptTransaction
    ? paymentMap.get(receiptTransaction.paymentId)
    : undefined;

  const openReceipt = (transaction: Transaction) => {
    if (!orderMap.has(transaction.orderId)) {
      toast.error("The linked order record is unavailable for this receipt.");
      return;
    }
    setReceiptTransactionId(transaction.id);
  };

  const exportCsv = () => {
    const headers = [
      "Receipt Number",
      "Transaction ID",
      "Order ID",
      "Customer",
      "Phone",
      "Items",
      "Basket Quantity",
      "Amount",
      "Discount",
      "Refund",
      "Payment",
      "Payment Reference",
      "Status",
      "Cashier",
      "Shift",
      "Terminal",
      "Date and Time",
    ];
    const rows = filtered.map((transaction) => {
      const order = orderMap.get(transaction.orderId);
      const payment = paymentMap.get(transaction.paymentId);
      const shift = shiftMap.get(transaction.shiftId);
      return [
        getReceiptNumber(transaction),
        transaction.id,
        transaction.orderId,
        transaction.customerName,
        order?.contactNumber ?? "",
        order?.items
          .map((item) => `${item.quantity}x ${item.name}`)
          .join("; ") ?? "",
        getBasketQuantity(order),
        transaction.amount.toFixed(2),
        transaction.discountAmount.toFixed(2),
        (transaction.refundAmount ?? 0).toFixed(2),
        transaction.method,
        payment?.referenceNumber ?? "",
        transaction.status,
        transaction.cashierName,
        transaction.shiftId,
        shift?.terminal ?? "",
        transaction.createdAt,
      ]
        .map(csvCell)
        .join(",");
    });
    const csv = [headers.map(csvCell).join(","), ...rows].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rrj-transactions-${todayInputValue()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} linked transaction records exported.`);
  };

  return (
    <div className="cashier-page">
      <PageHeading
        title="Transaction History"
        description="Financial summaries, receipts, and audit trails linked to recorded orders, payments, shifts, and terminals"
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
              onClick={() => {
                window.print();
                toast.success(
                  "Filtered transaction report sent to the print dialog.",
                );
              }}
            >
              <Printer className="h-4 w-4" />
              Print
            </CashierButton>
          </>
        }
      />
      <TransactionSummary transactions={filtered} orders={state.orders} />
      <TransactionFilters
        value={filters}
        searchRef={searchRef}
        shifts={state.shifts}
        cashiers={[
          ...new Set(
            state.transactions.map((transaction) => transaction.cashierName),
          ),
        ]}
        terminals={[...new Set(state.shifts.map((shift) => shift.terminal))]}
        onChange={setFilters}
        onReset={() => setFilters(defaults)}
      />
      <section className="rrj-card overflow-hidden">
        <TransactionTable
          transactions={filtered}
          orders={state.orders}
          shifts={state.shifts}
          onView={(transaction) => setSelectedTransactionId(transaction.id)}
          onPrint={openReceipt}
        />
        <div className="cashier-table-footer flex flex-col gap-1 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{filtered.length} linked transaction records</span>
          <strong className="text-foreground">
            Summary cards and exports use these filtered records
          </strong>
        </div>
      </section>
      <TransactionDetailDrawer
        transaction={selectedTransaction}
        order={selectedOrder}
        payment={selectedPayment}
        shift={selectedShift}
        activities={state.activities}
        open={Boolean(selectedTransaction)}
        onOpenChange={(open) => {
          if (!open) setSelectedTransactionId(undefined);
        }}
        onReprint={openReceipt}
      />
      <ReceiptDialog
        order={receiptOrder}
        payment={receiptPayment}
        transaction={receiptTransaction}
        open={Boolean(receiptTransaction && receiptOrder)}
        onClose={() => setReceiptTransactionId(undefined)}
        onPrint={() =>
          receiptOrder ? recordReceiptReprint(receiptOrder.id) : undefined
        }
      />
    </div>
  );
}
