import { formatMoney } from "../constants";
import type { Order, Payment, Transaction } from "../types";
import { prepareReceipt } from "./receiptPresentation";

export function ReceiptContent({ order, payment, transaction }: {
  order: Order;
  payment?: Payment;
  transaction?: Transaction;
}) {
  const prepared = prepareReceipt(order, payment, transaction);
  if (!prepared.ready) {
    return <div className="receipt-unavailable rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
      Receipt unavailable: {prepared.reason}
    </div>;
  }
  const receipt = prepared.receipt;
  return (
    <article className="pos-receipt-paper receipt-paper rounded-xl border border-stone-300 bg-white text-stone-950" aria-label={`Receipt ${receipt.receiptNumber}`}>
      <header className="receipt-brand text-center">
        <strong>RRJ FOOD-HOUSE</strong>
        <span>Cashier Receipt</span>
        {receipt.voided ? <b className="receipt-voided">VOIDED — not a valid sale</b> : null}
      </header>

      <dl className="receipt-metadata receipt-rule">
        <div><dt>Receipt</dt><dd>{receipt.receiptNumber}</dd></div>
        <div><dt>Order</dt><dd>{receipt.orderNumber}</dd></div>
        <div><dt>Date</dt><dd>{receipt.issuedAt}</dd></div>
      </dl>

      <dl className="receipt-service receipt-rule">
        {receipt.customerName ? <div><dt>Customer</dt><dd>{receipt.customerName}</dd></div> : null}
        <div><dt>Service</dt><dd>{receipt.serviceType}</dd></div>
      </dl>

      <div className="receipt-items receipt-rule">
        {receipt.items.map((item) => (
          <div className="receipt-item" key={item.id}>
            <div className="receipt-item-main">
              <span className="receipt-item-quantity">{item.quantity} ×</span>
              <span className="receipt-item-name">{item.name}</span>
              <strong className="receipt-item-amount">{formatMoney(item.amount)}</strong>
            </div>
            {item.choices.length ? <p className="receipt-item-choices">{item.choices.join(" · ")}</p> : null}
          </div>
        ))}
      </div>

      <dl className="receipt-totals receipt-rule">
        <div><dt>Subtotal</dt><dd>{formatMoney(receipt.subtotal)}</dd></div>
        {receipt.deliveryFee !== undefined ? <div><dt>Delivery fee</dt><dd>{formatMoney(receipt.deliveryFee)}</dd></div> : null}
        {receipt.tax !== undefined ? <div><dt>Tax</dt><dd>{formatMoney(receipt.tax)}</dd></div> : null}
        <div className="receipt-grand-total"><dt>Total</dt><dd>{formatMoney(receipt.total)}</dd></div>
      </dl>

      <dl className="receipt-payment receipt-rule">
        <div><dt>Payment</dt><dd>{receipt.method}</dd></div>
        {receipt.method === "Cash" && receipt.cashReceived !== undefined ? (
          <>
            <div><dt>Cash tendered</dt><dd>{formatMoney(receipt.cashReceived)}</dd></div>
            <div><dt>Change</dt><dd>{formatMoney(receipt.change ?? 0)}</dd></div>
          </>
        ) : null}
        {receipt.method === "GCash" ? (
          <>
            {receipt.gcashReference ? <div><dt>Reference</dt><dd>{receipt.gcashReference}</dd></div> : null}
            {receipt.verified ? <div><dt>Status</dt><dd>Verified</dd></div> : null}
          </>
        ) : null}
      </dl>

      <footer className="receipt-footer text-center">
        <strong>Thank you!</strong>
        <span>Please come again.</span>
      </footer>
    </article>
  );
}
