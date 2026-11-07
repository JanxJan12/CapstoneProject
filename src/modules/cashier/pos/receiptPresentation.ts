import type { Order, Payment, Transaction } from "../types";

export interface ReceiptPresentation {
  receiptNumber: string;
  orderNumber: string;
  issuedAt: string;
  customerName?: string;
  serviceType: Order["type"];
  items: { id: string; quantity: number; name: string; amount: number; choices: string[] }[];
  subtotal: number;
  deliveryFee?: number;
  tax?: number;
  total: number;
  method: "Cash" | "GCash";
  cashReceived?: number;
  change?: number;
  gcashReference?: string;
  verified: boolean;
  voided: boolean;
}

export type ReceiptPreparation =
  | { ready: true; receipt: ReceiptPresentation }
  | { ready: false; reason: string };

const cents = (value: number) => Math.round(value * 100);
const validAmount = (value: number) => Number.isFinite(value) && value >= 0;
const optionalPositive = (value: number | undefined) =>
  value !== undefined && validAmount(value) && value > 0 ? value : undefined;

/** Use recorded sale, payment, and item snapshots; never query today's menu or invent tender. */
export function prepareReceipt(order: Order, payment?: Payment, transaction?: Transaction): ReceiptPreparation {
  if (!transaction || !payment) {
    return { ready: false, reason: "The recorded transaction and payment are needed before printing." };
  }
  const receiptNumber = transaction.receiptNumber?.trim();
  if (!receiptNumber || !/^RCP-\d+$/.test(receiptNumber) ||
      !/^ORD-\d+$/.test(order.id) ||
      transaction.orderId !== order.id || payment.orderId !== order.id ||
      transaction.paymentId !== payment.id) {
    return { ready: false, reason: "The receipt number or linked sale records are incomplete." };
  }
  if (transaction.status !== "Completed" && transaction.status !== "Voided") {
    return { ready: false, reason: "This transaction has no supported receipt status." };
  }
  if (transaction.method !== payment.method || payment.status !== "Verified" ||
      !validAmount(order.total) || !validAmount(order.subtotal) ||
      !validAmount(transaction.amount) || !validAmount(payment.amount) ||
      cents(order.total) !== cents(transaction.amount) ||
      cents(order.total) !== cents(payment.amount)) {
    return { ready: false, reason: "The recorded sale and payment amounts or statuses do not agree." };
  }
  const issued = new Date(transaction.createdAt);
  if (!Number.isFinite(issued.getTime()) || !order.items.length) {
    return { ready: false, reason: "The original sale time or item snapshot is unavailable." };
  }
  const items: ReceiptPresentation["items"] = [];
  for (const item of order.items) {
    const name = item.name.trim();
    const amount = item.lineTotal ?? item.unitPrice * item.quantity;
    if (!name || name === "Menu Item" || !Number.isInteger(item.quantity) || item.quantity < 1 ||
        !validAmount(item.unitPrice) || !validAmount(amount)) {
      return { ready: false, reason: "An original order item is incomplete; printing is unavailable." };
    }
    const choices = [
      ...(item.mealOption ? [item.mealOption === "with_rice" ? "With Rice" : "Without Rice"] : []),
      ...(item.modifiers ?? []).map((modifier) => modifier.name.trim()).filter(Boolean),
    ];
    items.push({ id: item.id, quantity: item.quantity, name, amount,
      choices: [...new Map(choices.map((choice) => [choice.toLowerCase(), choice])).values()] });
  }
  if (items.reduce((sum, item) => sum + cents(item.amount), 0) !== cents(order.subtotal)) {
    return { ready: false, reason: "The recorded item amounts do not agree with the subtotal." };
  }
  const cashReceived = payment.method === "Cash" ? payment.cashReceived : undefined;
  if (cashReceived !== undefined && (!validAmount(cashReceived) || cents(cashReceived) < cents(order.total))) {
    return { ready: false, reason: "The recorded cash tender is less than the sale total." };
  }
  for (const optional of [order.deliveryFee, order.taxAmount]) {
    if (optional !== undefined && !validAmount(optional)) {
      return { ready: false, reason: "A recorded financial component is invalid." };
    }
  }
  return {
    ready: true,
    receipt: {
      receiptNumber,
      orderNumber: order.id,
      issuedAt: new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      }).format(issued),
      customerName: order.customerName.trim() && order.customerName.trim() !== "—"
        ? order.customerName.trim() : undefined,
      serviceType: order.type,
      items,
      subtotal: order.subtotal,
      deliveryFee: optionalPositive(order.deliveryFee),
      tax: optionalPositive(order.taxAmount),
      total: transaction.amount,
      method: payment.method,
      cashReceived,
      change: cashReceived === undefined ? undefined : (cents(cashReceived) - cents(order.total)) / 100,
      gcashReference: payment.method === "GCash" ? payment.referenceNumber?.trim() || undefined : undefined,
      verified: payment.status === "Verified",
      voided: transaction.status === "Voided",
    },
  };
}
