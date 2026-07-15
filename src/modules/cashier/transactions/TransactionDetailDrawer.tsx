import {
  Banknote,
  CalendarClock,
  CreditCard,
  Printer,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatDateTime, formatMoney } from "../constants";
import type {
  ActivityEvent,
  CashierShift,
  Order,
  Payment,
  Transaction,
} from "../types";
import {
  CashierButton,
  CashierDialogContent,
  CashierStatusBadge,
} from "../components/CashierUI";
import { getBasketQuantity, getReceiptNumber } from "./transactionRecords";

interface AuditEntry {
  id: string;
  label: string;
  timestamp: string;
  actor: string;
  source: string;
}

export function TransactionDetailDrawer({
  transaction,
  order,
  payment,
  shift,
  activities,
  open,
  onOpenChange,
  onReprint,
}: {
  transaction?: Transaction;
  order?: Order;
  payment?: Payment;
  shift?: CashierShift;
  activities: ActivityEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint: (transaction: Transaction) => void;
}) {
  if (!transaction) return null;

  const auditEntries: AuditEntry[] = [
    {
      id: `transaction-${transaction.id}`,
      label: `Transaction recorded as ${transaction.status.toLowerCase()}`,
      timestamp: transaction.createdAt,
      actor: transaction.cashierName,
      source: "Transaction",
    },
    ...(order?.timeline.map((event) => ({
      id: `order-${event.id}`,
      label: event.label,
      timestamp: event.timestamp,
      actor: event.actor,
      source: "Order",
    })) ?? []),
    ...activities
      .filter(
        (activity) =>
          activity.transactionId === transaction.id ||
          activity.orderId === transaction.orderId,
      )
      .map((activity) => ({
        id: `activity-${activity.id}`,
        label: activity.message,
        timestamp: activity.timestamp,
        actor: activity.actor,
        source: "Audit",
      })),
    ...(payment
      ? [
          {
            id: `payment-uploaded-${payment.id}`,
            label: `${payment.method} payment record created`,
            timestamp: payment.uploadedAt,
            actor: payment.uploadedBy ?? transaction.customerName,
            source: "Payment",
          },
          ...(payment.verifiedAt
            ? [
                {
                  id: `payment-verified-${payment.id}`,
                  label: "Payment verified",
                  timestamp: payment.verifiedAt,
                  actor: transaction.cashierName,
                  source: "Payment",
                },
              ]
            : []),
          ...(payment.rejectedAt
            ? [
                {
                  id: `payment-rejected-${payment.id}`,
                  label: `Payment rejected: ${payment.rejectionReason ?? "Reason not recorded"}`,
                  timestamp: payment.rejectedAt,
                  actor: transaction.cashierName,
                  source: "Payment",
                },
              ]
            : []),
        ]
      : []),
  ].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CashierDialogContent className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-[#f8f4ef] p-0 shadow-[-18px_0_50px_rgba(36,26,19,0.16)] sm:max-w-2xl">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-white/95 p-5 pr-14 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-mono text-lg font-black text-primary">
              {getReceiptNumber(transaction)}
            </DialogTitle>
            <CashierStatusBadge status={transaction.status} />
          </div>
          <DialogDescription>
            {transaction.id} · {formatDateTime(transaction.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailCard
              icon={ReceiptText}
              label="Order"
              value={transaction.orderId}
            />
            <DetailCard
              icon={UserRound}
              label="Cashier"
              value={transaction.cashierName}
            />
            <DetailCard
              icon={CalendarClock}
              label="Shift"
              value={transaction.shiftId}
            />
            <DetailCard
              icon={ShieldCheck}
              label="Terminal"
              value={shift?.terminal ?? "Unlinked"}
            />
          </section>

          <section className="rrj-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Financial detail
              </h3>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr]">
              <div className="space-y-2 text-xs">
                <FinancialLine
                  label="Order subtotal"
                  value={formatMoney(order?.subtotal ?? transaction.amount)}
                />
                <FinancialLine
                  label="Discount"
                  value={`−${formatMoney(transaction.discountAmount)}`}
                  tone="text-emerald-700"
                />
                {transaction.refundAmount !== undefined && (
                  <FinancialLine
                    label="Refund"
                    value={`−${formatMoney(transaction.refundAmount)}`}
                    tone="text-blue-700"
                  />
                )}
                <FinancialLine
                  label="Transaction amount"
                  value={formatMoney(transaction.amount)}
                  strong
                />
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="flex items-center gap-2 text-sm font-black">
                  {transaction.method === "Cash" ? (
                    <Banknote className="h-4 w-4 text-primary" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-primary" />
                  )}
                  {transaction.method}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Payment record: <strong>{payment?.id ?? "Unlinked"}</strong>
                </p>
                {payment?.referenceNumber && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Reference: <strong>{payment.referenceNumber}</strong>
                  </p>
                )}
                <div className="mt-3">
                  <CashierStatusBadge
                    status={
                      payment?.status ??
                      (transaction.status === "Completed"
                        ? "Verified"
                        : "Rejected")
                    }
                  />
                </div>
              </div>
            </div>
            {(transaction.voidReason || transaction.status === "Refunded") && (
              <div className="border-t border-border bg-red-50/60 px-4 py-3 text-xs text-red-800">
                <strong>{transaction.status}:</strong>{" "}
                {transaction.voidReason ??
                  "Refund recorded against this transaction."}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Basket · {getBasketQuantity(order)} items
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {order?.customerName ?? transaction.customerName}
              </span>
            </div>
            <div className="rrj-card overflow-hidden">
              {order?.items.length ? (
                order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-bold">
                        {item.quantity} × {item.name}
                      </p>
                      {item.modifiers?.length ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {item.modifiers
                            .map((modifier) => modifier.name)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <strong className="text-sm">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="p-4 text-xs text-muted-foreground">
                  The linked order item record is unavailable.
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
              Audit timeline
            </h3>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {auditEntries.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-amber-50" />
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {entry.label}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-muted-foreground">
                      {entry.source}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDateTime(entry.timestamp)} · {entry.actor}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-[#f8f4ef]/95 py-3 backdrop-blur-xl">
            <CashierButton
              variant="secondary"
              disabled={transaction.status !== "Completed" || !order}
              onClick={() => onReprint(transaction)}
            >
              <Printer className="h-4 w-4" />
              Receipt reprint
            </CashierButton>
          </div>
        </div>
      </CashierDialogContent>
    </Dialog>
  );
}

function DetailCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rrj-card p-3">
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black" title={value}>
        {value}
      </p>
    </div>
  );
}

function FinancialLine({
  label,
  value,
  tone = "text-foreground",
  strong = false,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${strong ? "border-t border-border pt-2 text-sm font-black" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${tone}`}>{value}</span>
    </div>
  );
}
