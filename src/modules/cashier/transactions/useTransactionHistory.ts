import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "../components";
import { useCashierStore } from "../hooks/CashierStore";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import type { CashierNavigationIntent, Transaction } from "../types";
import { currentLocalDate, downloadCsv } from "../utils/exportUtils";
import type { TransactionFilterValue } from "./TransactionFilters";
import { getBasketQuantity, getReceiptNumber } from "./transactionRecords";

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterValue = {
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

const CSV_HEADERS = [
  "Receipt Number",
  "Transaction ID",
  "Order ID",
  "Customer",
  "Phone",
  "Items",
  "Basket Quantity",
  "Amount",
  "Discount",
  "Payment",
  "Payment Reference",
  "Status",
  "Cashier",
  "Shift",
  "Terminal",
  "Date and Time",
] as const;

export function useTransactionHistory(intent?: CashierNavigationIntent) {
  const { state } = useCashierStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const openedRecent = useRef(false);
  const [filters, setFilters] = useState<TransactionFilterValue>(() => ({
    ...DEFAULT_TRANSACTION_FILTERS,
    method:
      intent?.paymentMethods?.length === 1 ? intent.paymentMethods[0] : "All",
    status:
      intent?.transactionStatuses?.length === 1
        ? intent.transactionStatuses[0]
        : "All",
    from: intent?.today ? currentLocalDate() : "",
    to: intent?.today ? currentLocalDate() : "",
  }));
  const [selectedId, setSelectedId] = useState<string>();
  const [receiptId, setReceiptId] = useState<string>();
  useSearchShortcut(searchRef);

  const shiftById = useMemo(
    () => new Map(state.shifts.map((shift) => [shift.id, shift])),
    [state.shifts],
  );
  const orderById = useMemo(
    () => new Map(state.orders.map((order) => [order.id, order])),
    [state.orders],
  );
  const paymentById = useMemo(
    () => new Map(state.payments.map((payment) => [payment.id, payment])),
    [state.payments],
  );

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const customer = filters.customer.trim().toLowerCase();
    const orderQuery = filters.orderId.trim().toLowerCase();
    const receiptQuery = filters.receiptNumber.trim().toLowerCase();
    return state.transactions
      .filter((transaction) => {
        const receipt = getReceiptNumber(transaction);
        const payment = paymentById.get(transaction.paymentId);
        const shift = shiftById.get(transaction.shiftId);
        const searchable =
          `${transaction.id} ${receipt} ${payment?.referenceNumber ?? ""}`.toLowerCase();
        return (
          (!query || searchable.includes(query)) &&
          (filters.method === "All" || transaction.method === filters.method) &&
          (filters.status === "All" || transaction.status === filters.status) &&
          (!filters.from ||
            transaction.createdAt.slice(0, 10) >= filters.from) &&
          (!filters.to || transaction.createdAt.slice(0, 10) <= filters.to) &&
          (filters.cashier === "All" ||
            transaction.cashierName === filters.cashier) &&
          (filters.shift === "All" || transaction.shiftId === filters.shift) &&
          (filters.terminal === "All" ||
            shift?.terminal === filters.terminal) &&
          (!customer ||
            transaction.customerName.toLowerCase().includes(customer)) &&
          (!orderQuery ||
            transaction.orderId.toLowerCase().includes(orderQuery)) &&
          (!receiptQuery || receipt.toLowerCase().includes(receiptQuery))
        );
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
  }, [filters, paymentById, shiftById, state.transactions]);

  useEffect(() => {
    if (!intent?.openMostRecentReceipt || openedRecent.current) return;
    setReceiptId(
      state.transactions.find((entry) => entry.status === "Completed")?.id,
    );
    openedRecent.current = true;
  }, [intent, state.transactions]);

  const selectedTransaction = state.transactions.find(
    (entry) => entry.id === selectedId,
  );
  const receiptTransaction = state.transactions.find(
    (entry) => entry.id === receiptId,
  );

  const openReceipt = useCallback(
    (transaction: Transaction) => {
      if (!orderById.has(transaction.orderId)) {
        Toast.error("The linked order record is unavailable for this receipt.");
        return;
      }
      setReceiptId(transaction.id);
    },
    [orderById],
  );

  const exportRecords = useCallback(() => {
    const rows = filtered.map((transaction) => {
      const order = orderById.get(transaction.orderId);
      const payment = paymentById.get(transaction.paymentId);
      const shift = shiftById.get(transaction.shiftId);
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
        transaction.method,
        payment?.referenceNumber ?? "",
        transaction.status,
        transaction.cashierName,
        transaction.shiftId,
        shift?.terminal ?? "",
        transaction.createdAt,
      ];
    });
    downloadCsv(
      `rrj-transactions-${currentLocalDate()}.csv`,
      CSV_HEADERS,
      rows,
    );
    Toast.success(`${filtered.length} linked transaction records exported.`);
  }, [filtered, orderById, paymentById, shiftById]);

  const cashiers = useMemo(
    () => [...new Set(state.transactions.map((entry) => entry.cashierName))],
    [state.transactions],
  );
  const terminals = useMemo(
    () => [...new Set(state.shifts.map((shift) => shift.terminal))],
    [state.shifts],
  );

  return {
    state,
    filters,
    setFilters,
    filtered,
    searchRef,
    cashiers,
    terminals,
    selectedTransaction,
    selectedOrder: selectedTransaction
      ? orderById.get(selectedTransaction.orderId)
      : undefined,
    selectedPayment: selectedTransaction
      ? paymentById.get(selectedTransaction.paymentId)
      : undefined,
    selectedShift: selectedTransaction
      ? shiftById.get(selectedTransaction.shiftId)
      : undefined,
    receiptTransaction,
    receiptOrder: receiptTransaction
      ? orderById.get(receiptTransaction.orderId)
      : undefined,
    receiptPayment: receiptTransaction
      ? paymentById.get(receiptTransaction.paymentId)
      : undefined,
    selectTransaction: useCallback(
      (transaction: Transaction) => setSelectedId(transaction.id),
      [],
    ),
    closeTransaction: useCallback(() => setSelectedId(undefined), []),
    closeReceipt: useCallback(() => setReceiptId(undefined), []),
    resetFilters: useCallback(
      () => setFilters(DEFAULT_TRANSACTION_FILTERS),
      [],
    ),
    openReceipt,
    exportRecords,
  };
}
