import type { CashierShift, Order, Payment, Transaction } from "../types";

export const getReceiptNumber = (transaction: Transaction) =>
  transaction.receiptNumber ?? transaction.id.replace(/^TXN-/, "RCP-");

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
