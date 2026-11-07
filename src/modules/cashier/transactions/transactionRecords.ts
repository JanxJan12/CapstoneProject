import type { CashierShift, Order, Payment, Transaction } from "../types";
import { manilaDate } from "../utils/exportUtils";
import type { TransactionFilterValue } from "./TransactionFilters";

export const getReceiptNumber = (transaction: Transaction) => {
  const receiptNumber = transaction.receiptNumber?.trim();
  if (receiptNumber && /^RCP-\d+$/.test(receiptNumber)) return receiptNumber;

  return "Receipt number unavailable";
};

export const getTransactionOrder = (
  transaction: Transaction,
  orders: Order[],
) => orders.find((order) => order.id === transaction.orderId);

export const getTransactionPayment = (
  transaction: Transaction,
  payments: Payment[],
) => payments.find((payment) => payment.id === transaction.paymentId);

export const getTransactionShift = (
  transaction: Transaction,
  shifts: CashierShift[],
) => shifts.find((shift) => shift.id === transaction.shiftId);

export const getBasketQuantity = (order?: Order) =>
  order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

export function filterTransactionRecords(
  transactions: Transaction[],
  filters: TransactionFilterValue,
  paymentById: Map<string, Pick<Payment, "referenceNumber">>,
  shiftById: Map<string, Pick<CashierShift, "terminal">>,
) {
  const query = filters.search.trim().toLowerCase();
  const customer = filters.customer.trim().toLowerCase();
  const orderQuery = filters.orderId.trim().toLowerCase();
  const receiptQuery = filters.receiptNumber.trim().toLowerCase();
  return transactions.filter((transaction) => {
    const receipt = getReceiptNumber(transaction);
    const payment = paymentById.get(transaction.paymentId);
    const shift = shiftById.get(transaction.shiftId);
    const searchable = `${transaction.id} ${receipt} ${payment?.referenceNumber ?? ""}`.toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (filters.method === "All" || transaction.method === filters.method) &&
      (filters.status === "All" || transaction.status === filters.status) &&
      (!filters.from || manilaDate(transaction.createdAt) >= filters.from) &&
      (!filters.to || manilaDate(transaction.createdAt) <= filters.to) &&
      (filters.cashier === "All" || transaction.cashierName === filters.cashier) &&
      (filters.shift === "All" || transaction.shiftId === filters.shift) &&
      (filters.terminal === "All" || shift?.terminal === filters.terminal) &&
      (!customer || transaction.customerName.toLowerCase().includes(customer)) &&
      (!orderQuery || transaction.orderId.toLowerCase().includes(orderQuery)) &&
      (!receiptQuery || receipt.toLowerCase().includes(receiptQuery))
    );
  }).sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function maskContactNumber(value?: string) {
  const contact = value?.trim();
  if (!contact) return "No linked contact";
  if (contact.length <= 8) {
    return `${contact.slice(0, 2)}•••${contact.slice(-2)}`;
  }
  return `${contact.slice(0, 4)}•••${contact.slice(-4)}`;
}
