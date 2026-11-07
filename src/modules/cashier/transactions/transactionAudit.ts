import type { Order, Payment, Transaction } from "../types";

export interface TransactionAuditEntry {
  id: string;
  label: string;
  timestamp: string;
  actor: string;
  actorId?: string;
  source: "Transaction" | "Order" | "Payment";
}

export function buildTransactionAudit(
  transaction: Transaction,
  order: Order | undefined,
  payment: Payment | undefined,
) {
  const accountId = (value: string) => /^(?:Account )?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(value.trim())?.[1];
  const recordedOrderActor = (value: string) => {
    const id = accountId(value);
    return id ? { actor: "Recorded account", actorId: id } : { actor: value || "Actor unavailable" };
  };
  const recordedSubmitter = (value?: string) => {
    if (!value?.trim()) return { actor: "Payment submitter unavailable" };
    const id = accountId(value);
    return id ? { actor: "Recorded submitter account", actorId: id } : { actor: value.trim() };
  };
  const entries: TransactionAuditEntry[] = [
    {
      id: `transaction-${transaction.id}`,
      label: `Transaction recorded as ${transaction.status.toLowerCase()}`,
      timestamp: transaction.createdAt,
      actor: "Recording Cashier account",
      actorId: transaction.cashierId,
      source: "Transaction",
    },
    ...(order?.timeline.map((event): TransactionAuditEntry => ({
      id: `order-${event.id}`,
      label: event.label,
      timestamp: event.timestamp,
      ...recordedOrderActor(event.actor),
      source: "Order",
    })) ?? []),
  ];
  if (payment) {
    entries.push({
      id: `payment-uploaded-${payment.id}`,
      label: `${payment.method} payment record created`,
      timestamp: payment.uploadedAt,
      ...recordedSubmitter(payment.uploadedBy),
      source: "Payment",
    });
    if (payment.verifiedAt) {
      entries.push({
        id: `payment-verified-${payment.id}`,
        label: "Payment verified",
        timestamp: payment.verifiedAt,
        actor: payment.verifiedBy ? "Recorded verifier account" : "Verifier unavailable",
        actorId: payment.verifiedBy,
        source: "Payment",
      });
    }
    if (payment.rejectedAt) {
      entries.push({
        id: `payment-rejected-${payment.id}`,
        label: `Payment rejected: ${payment.rejectionReason ?? "Reason not recorded"}`,
        timestamp: payment.rejectedAt,
        actor: payment.rejectedBy ? "Recorded reviewer account" : "Reviewer unavailable",
        actorId: payment.rejectedBy,
        source: "Payment",
      });
    }
  }
  return entries.sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}
