import {
  AlertTriangle,
  Clock3,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { formatDateTime, formatMoney } from "../constants";
import type { Order, Payment } from "../types";
import {
  CashierButton,
  CashierStatusBadge,
  EmptyState,
} from "../components/CashierUI";
import { ProofViewer } from "./ProofViewer";

export function PaymentDetails({
  payment,
  order,
  shiftOpen,
  onVerify,
  onReject,
}: {
  payment?: Payment;
  order?: Order;
  shiftOpen: boolean;
  onVerify: () => void;
  onReject: () => void;
}) {
  if (!payment || !order)
    return (
      <EmptyState
        title="Select a payment"
        description="Choose a pending GCash submission from the queue to review its proof and order details."
      />
    );
  const mismatch = payment.amount !== payment.submittedAmount;
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-gradient-to-r from-white to-amber-50/45 p-4 shadow-sm">
        <div>
          <p className="font-mono text-sm font-black text-primary">
            {order.id}
          </p>
          <h2 className="mt-1 text-lg font-black text-foreground">
            Payment verification
          </h2>
        </div>
        <CashierStatusBadge status={payment.status} />
      </div>
      {!shiftOpen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
          Start a cashier shift before processing this payment.
        </div>
      )}
      {mismatch && (
        <div
          role="alert"
          className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Amount mismatch: the order total is {formatMoney(payment.amount)},
            but the submitted proof shows {formatMoney(payment.submittedAmount)}
            .
          </span>
        </div>
      )}
      <div className="payment-review-grid grid gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(330px,1.1fr)]">
        <div className="payment-proof-column min-w-0">
          <ProofViewer payment={payment} />
        </div>
        <div className="min-w-0 space-y-4">
          <section className={`grid grid-cols-2 gap-3 rounded-2xl border p-4 shadow-sm ${mismatch ? "border-red-200 bg-red-50/60" : "border-emerald-200 bg-emerald-50/55"}`}>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Order total</p>
              <p className="mt-1 text-xl font-black text-foreground">{formatMoney(payment.amount)}</p>
            </div>
            <div className="border-l border-current/10 pl-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Proof amount</p>
              <p className={`mt-1 text-xl font-black ${mismatch ? "text-red-700" : "text-emerald-700"}`}>{formatMoney(payment.submittedAmount)}</p>
            </div>
            <p className={`col-span-2 text-[10px] font-black ${mismatch ? "text-red-700" : "text-emerald-700"}`}>
              {mismatch ? "Review required · amounts do not match" : "Amounts match · ready for verification"}
            </p>
          </section>
          <section className="grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-[0_8px_24px_rgba(67,42,23,0.04)] sm:grid-cols-2">
            <Detail icon={UserRound} label="Customer" value={order.customerName} />
            <Detail icon={Phone} label="Contact number" value={order.contactNumber} />
            <Detail icon={ReceiptText} label="GCash reference" value={payment.referenceNumber ?? "Not provided"} />
            <Detail icon={Clock3} label="Uploaded" value={formatDateTime(payment.uploadedAt)} />
          </section>
          <section>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order items</p>
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_8px_24px_rgba(67,42,23,0.04)]">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 border-b border-border px-4 py-3 text-xs last:border-0">
                  <span>
                    <strong>{item.quantity} × {item.name}</strong>
                    {item.note && <span className="block text-muted-foreground">{item.note}</span>}
                  </span>
                  <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
                </div>
              ))}
              <div className="flex justify-between bg-muted/30 px-4 py-3 text-sm font-black">
                <span>Order total</span>
                <span className="text-primary">{formatMoney(order.total)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="payment-review-actions sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-background/95 py-3 backdrop-blur sm:flex-row sm:justify-end">
        <CashierButton
          variant="danger"
          disabled={!shiftOpen}
          onClick={onReject}
        >
          Reject payment
        </CashierButton>
        <CashierButton className="min-w-40" disabled={!shiftOpen} onClick={onVerify}>
          Verify payment
        </CashierButton>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
