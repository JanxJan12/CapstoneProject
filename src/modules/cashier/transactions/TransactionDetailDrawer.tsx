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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "../constants";
import type { CashierShift, Order, Payment, Transaction } from "../types";
import { CashierButton, Drawer, StatusBadge } from "../components";
import { getBasketQuantity, getReceiptNumber } from "./transactionRecords";
import { buildTransactionAudit } from "./transactionAudit";
import { FinancialLine, TransactionDetailCard } from "./TransactionDetailCards";

export function TransactionDetailDrawer({
  transaction,
  order,
  payment,
  shift,
  open,
  onOpenChange,
  onReprint,
}: {
  transaction?: Transaction;
  order?: Order;
  payment?: Payment;
  shift?: CashierShift;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint: (transaction: Transaction) => void;
}) {
  if (!transaction) return null;

  const auditEntries = buildTransactionAudit(transaction, order, payment);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} size="lg">
      <DialogHeader className="sticky top-0 z-10 border-b border-border/80 bg-white/95 px-4 py-3.5 pr-14 shadow-[0_4px_14px_rgba(36,26,19,0.05)] backdrop-blur-xl sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="font-mono text-lg font-black text-primary">
            {getReceiptNumber(transaction)}
          </DialogTitle>
          <StatusBadge status={transaction.status} />
        </div>
        <DialogDescription>
          {transaction.id} · {formatDateTime(transaction.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 p-4 sm:p-5">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TransactionDetailCard
            icon={ReceiptText}
            label="Order"
            value={transaction.orderId}
          />
          <TransactionDetailCard
            icon={UserRound}
            label="Cashier"
            value={transaction.cashierName}
          />
          <TransactionDetailCard
            icon={CalendarClock}
            label="Shift"
            value={transaction.shiftId}
          />
          <TransactionDetailCard
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
                <StatusBadge
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
                  <span className="cashier-status-badge rounded-full border border-border/70 bg-muted/70 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-muted-foreground shadow-[0_1px_2px_rgba(36,26,19,0.03)]">
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

        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 border-t border-border/80 bg-[#f8f4ef]/95 px-4 py-3 backdrop-blur-xl sm:-mx-5 sm:-mb-5 sm:justify-end sm:px-5">
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
    </Drawer>
  );
}
