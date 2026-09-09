import { formatDateTime, formatMoney } from "../constants";
import type { Order, Payment, Transaction } from "../types";
import { getReceiptNumber } from "../transactions/transactionRecords";

export function ReceiptContent({
  order,
  payment,
  transaction,
}: {
  order: Order;
  payment?: Payment;
  transaction?: Transaction;
}) {
  const change =
    payment?.method === "Cash"
      ? Math.max(0, (payment.submittedAmount ?? 0) - order.total)
      : 0;
  const receiptNumber = transaction
    ? getReceiptNumber(transaction)
    : (order.transactionId?.replace(/^TXN-/, "RCP-") ?? order.id);

  return (
    <div className="pos-receipt-paper overflow-hidden rounded-2xl border bg-white">
      <div className="bg-gradient-to-r from-primary to-orange-600 px-5 py-4 text-center text-white">
        <p className="text-sm font-black uppercase tracking-widest">
          RRJ Food-House
        </p>
        <p className="mt-0.5 text-[10px] text-white/70">
          Official cashier receipt
        </p>
      </div>
      <div className="p-5 text-[#2b2119]">
        <div className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Receipt number
          </p>
          <p className="mt-1 font-mono text-sm font-black text-primary">
            {receiptNumber}
          </p>
        </div>
        <div className="mb-3 flex justify-between text-[10px] text-muted-foreground">
          <span> {transaction?.transactionNumber ?? transaction?.id ?? order.transactionId ?? order.id} </span>
          <span>
            {formatDateTime(transaction?.createdAt ?? order.createdAt)}
          </span>
        </div>
        <div className="mb-3 rounded-lg bg-muted/45 px-3 py-2 text-[10px]">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Customer</span>
            <strong>{order.customerName}</strong>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-muted-foreground">Order</span>
            <strong>
              {order.type}
              {order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
            </strong>
          </div>
          {order.type === "Delivery" ? (
            <>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Contact</span>
                <strong>{order.contactNumber}</strong>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Address</span>
                <strong className="max-w-56 text-right">
                  {order.deliveryAddress}
                </strong>
              </div>
            </>
          ) : null}
        </div>
        {order.items.map((item) => (
          <div key={item.id} className="py-1 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {item.quantity} × {item.name}
              </span>
              <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
            </div>
            {item.modifiers?.length ? (
              <p className="mt-0.5 pl-3 text-[9px] text-muted-foreground">
                {item.modifiers.map((modifier) => modifier.name).join(", ")}
              </p>
            ) : null}
          </div>
        ))}
        {order.discountAmount > 0 ? (
          <div className="mt-2 flex justify-between text-xs text-emerald-700">
            <span>{order.discountType} discount</span>
            <strong>−{formatMoney(order.discountAmount)}</strong>
          </div>
        ) : null}
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-black">
          <span>Total</span>
          <span className="text-primary">{formatMoney(order.total)}</span>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          <div className="flex justify-between">
            <span>{order.paymentMethod}</span>
            <span>
              {payment?.referenceNumber ??
                formatMoney(payment?.submittedAmount ?? order.total)}
            </span>
          </div>
          {payment?.method === "Cash" ? (
            <div className="mt-1 flex justify-between">
              <span>Change</span>
              <span>{formatMoney(change)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
