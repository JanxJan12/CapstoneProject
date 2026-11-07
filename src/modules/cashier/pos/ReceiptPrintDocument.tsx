import { createPortal } from "react-dom";
import type { Order, Payment, Transaction } from "../types";
import { ReceiptContent } from "./ReceiptContent";
import { prepareReceipt } from "./receiptPresentation";

export function ReceiptPrintDocument({
  order,
  payment,
  transaction,
}: {
  order: Order;
  payment?: Payment;
  transaction?: Transaction;
}) {
  const prepared = prepareReceipt(order, payment, transaction);
  if (!prepared.ready || prepared.receipt.voided) return null;
  return createPortal(
    <div className="cashier-print-receipt" aria-hidden="true">
      <ReceiptContent order={order} payment={payment} transaction={transaction} />
    </div>,
    document.body,
  );
}
