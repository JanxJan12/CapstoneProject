import { CheckCircle2, Printer, RefreshCcw } from "lucide-react";
import type { Order, Payment, Transaction } from "../types";
import { ReceiptContent } from "./ReceiptContent";
import { ReceiptPrintDocument } from "./ReceiptPrintDocument";
import { prepareReceipt } from "./receiptPresentation";

export function ReceiptPanel({
  order,
  payment,
  transaction,
  printed,
  onPrint,
  onNewOrder,
}: {
  order: Order;
  payment?: Payment;
  transaction?: Transaction;
  printed: boolean;
  onPrint: () => void;
  onNewOrder: () => void;
}) {
  const prepared = prepareReceipt(order, payment, transaction);
  const printable = prepared.ready && !prepared.receipt.voided;
  return (
    <>
    <section className="pos-receipt-panel flex min-h-0 flex-1 flex-col">
      <header className="pos-panel-header border-b px-4 py-4 text-center">
        <div className="pos-receipt-ready mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-2 text-sm font-black">Payment complete · Kitchen notified</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ReceiptContent
          order={order}
          payment={payment}
          transaction={transaction}
        />
      </div>

      <footer className="pos-panel-footer border-t p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrint}
            disabled={!printable}
            className="pos-secondary-action flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black"
          >
            <Printer className="h-4 w-4" />{" "}
            {printed ? "Reprint Receipt" : "Print Receipt"}
          </button>
          <button
            type="button"
            onClick={onNewOrder}
            className="pos-place-order flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black text-white"
          >
            <RefreshCcw className="h-4 w-4" /> Start New Order
          </button>
        </div>
        <p className="mt-2 text-center text-[9px] font-bold text-[var(--pos-muted)]">
          {!prepared.ready ? prepared.reason : prepared.receipt.voided ? "Voided receipts cannot be printed." : printed ? "Print dialog opened" : "Receipt ready to print"}
        </p>
      </footer>
    </section>
    <ReceiptPrintDocument order={order} payment={payment} transaction={transaction} />
    </>
  );
}
