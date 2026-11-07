import {
  Banknote,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Printer,
} from "lucide-react";
import {
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "../constants";
import type { CashierShift, Order, Payment, Transaction } from "../types";
import { CashierButton, Drawer, StatusBadge } from "../components";
import { getBasketQuantity, getReceiptNumber } from "./transactionRecords";
import { basketSubtotalDisagrees, recordedBasketChoices, recordedBasketLine } from "./basketPresentation";
import { FinancialLine } from "./TransactionDetailCards";

export function TransactionDetailDrawer({
  transaction,
  order,
  payment,
  shift,
  open,
  onOpenChange,
  onReprint,
  onViewOrder,
}: {
  transaction?: Transaction;
  order?: Order;
  payment?: Payment;
  shift?: CashierShift;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint: (transaction: Transaction) => void;
  onViewOrder?: () => void;
}) {
  if (!transaction) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} size="lg">
      <DialogHeader className="sticky top-0 z-10 border-b border-border/80 bg-white/95 px-4 py-3.5 pr-14 shadow-[0_4px_14px_rgba(36,26,19,0.05)] backdrop-blur-xl sm:px-5">
        <DialogClose asChild>
          <CashierButton variant="ghost" className="min-h-11 self-start px-2">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to transactions
          </CashierButton>
        </DialogClose>
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="font-mono text-lg font-black text-primary">
            {getReceiptNumber(transaction)}
          </DialogTitle>
          <StatusBadge status={transaction.status} />
        </div>
        <DialogDescription>
          {formatDateTime(transaction.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 p-4 sm:p-5">
        <section className="rrj-card grid gap-x-5 gap-y-3 p-4 sm:grid-cols-2" aria-label="Transaction overview">
          <Overview label="Order" value={transaction.orderId} />
          <Overview label="Recorded amount" value={formatMoney(transaction.amount)} />
          <Overview label="Cashier" value={transaction.cashierName} />
          <Overview label="Payment method" value={transaction.method} />
          <Overview label="Order status" value={order?.status ?? "Unavailable"} />
          <Overview label="Shift terminal" value={shift?.terminal ?? "Unavailable"} />
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
                value={order ? formatMoney(order.subtotal) : "Unavailable"}
              />
              {order?.type === "Delivery" && order.deliveryFee !== undefined && Number.isFinite(order.deliveryFee) && order.deliveryFee > 0 ? (
                <FinancialLine label="Delivery fee" value={formatMoney(order.deliveryFee)} />
              ) : null}
              {order?.taxAmount ? <FinancialLine label="Tax" value={formatMoney(order.taxAmount)} /> : null}
              <FinancialLine
                label={transaction.status === "Voided" ? "Voided recorded amount" : "Transaction amount"}
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
              {payment?.referenceNumber && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Reference: <strong>{payment.referenceNumber}</strong>
                </p>
              )}
              <div className="mt-3">{payment ? <StatusBadge status={payment.status} /> : <span className="text-xs text-muted-foreground">Payment record unavailable</span>}</div>
            </div>
          </div>
          {transaction.status === "Voided" && (
            <div className="border-t border-border bg-red-50/60 px-4 py-3 text-xs text-red-800">
              <strong>{transaction.status}:</strong>{" "}
              {transaction.voidReason ?? "Reason not recorded."} This receipt is excluded from completed revenue.
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Basket · {getBasketQuantity(order)}{" "}
              {getBasketQuantity(order) === 1 ? "item" : "items"}
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {order?.customerName ?? transaction.customerName}
            </span>
          </div>
          <div className="rrj-card overflow-hidden">
            {order && basketSubtotalDisagrees(order) ? <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Recorded item totals differ from the recorded order subtotal. Review the original sale; amounts have not been changed.</p> : null}
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
                    {recordedBasketChoices(item).length ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {recordedBasketChoices(item).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <strong className="text-sm">
                    {recordedBasketLine(item) === undefined ? "Amount unavailable" : formatMoney(recordedBasketLine(item)!)}
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

        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap gap-2 border-t border-border/80 bg-[#f8f4ef]/95 px-4 py-3 backdrop-blur-xl sm:-mx-5 sm:-mb-5 sm:justify-end sm:px-5">
          {onViewOrder ? (
            <CashierButton variant="secondary" onClick={onViewOrder}>View linked order</CashierButton>
          ) : (
            <span className="self-center text-xs text-muted-foreground">Linked order details are unavailable to this Cashier.</span>
          )}
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

function Overview({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className="break-words text-sm font-bold">{value}</p></div>;
}
