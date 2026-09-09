import type { Order, Payment, Transaction } from "../types";

export interface TransactionAuditEntry {
  id: string;
  label: string;
  timestamp: string;
  actor: string;
  source: "Transaction" | "Order" | "Payment";
}

export function buildTransactionAudit(
  transaction: Transaction,
  order: Order | undefined,
  payment: Payment | undefined,
) {
  const entries: TransactionAuditEntry[] = [
    {
      id: `transaction-${transaction.id}`,
      label: `Transaction recorded as ${transaction.status.toLowerCase()}`,
      timestamp: transaction.createdAt,
      actor: transaction.cashierName,
      source: "Transaction",
    },
    ...(order?.timeline.map((event): TransactionAuditEntry => ({
      id: `order-${event.id}`,
      label: event.label,
      timestamp: event.timestamp,
      actor: event.actor,
      source: "Order",
    })) ?? []),
  ];
  if (payment) {
    entries.push({
      id: `payment-uploaded-${payment.id}`,
      label: `${payment.method} payment record created`,
      timestamp: payment.uploadedAt,
      actor: payment.uploadedBy ?? transaction.customerName,
      source: "Payment",
    });
    if (payment.verifiedAt) {
      entries.push({
        id: `payment-verified-${payment.id}`,
        label: "Payment verified",
        timestamp: payment.verifiedAt,
        actor: transaction.cashierName,
        source: "Payment",
      });
    }
    if (payment.rejectedAt) {
      entries.push({
        id: `payment-rejected-${payment.id}`,
        label: `Payment rejected: ${payment.rejectionReason ?? "Reason not recorded"}`,
        timestamp: payment.rejectedAt,
        actor: transaction.cashierName,
        source: "Payment",
      });
    }
  }
  return entries.sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}
