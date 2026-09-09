import {
  CalendarDays,
  Clock3,
  CreditCard,
  Hash,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { formatDateOnly, formatMoney, formatTimeOnly } from "../constants";
import type { Order, Payment } from "../types";
import { CashierButton, StatusBadge, EmptyState } from "../components";
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
        compact
        icon={CreditCard}
        title="Select a payment"
        description="Choose a pending GCash submission from the queue to review its proof and order details."
      />
    );
  const canRejectWithoutShift = Boolean(
    payment.proofImagePath &&
      order.databaseId &&
      order.orderChannel === "online",
  );
  const uploadedBy =
    payment.uploadedBy ?? payment.senderName ?? order.customerName;
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="rrj-card flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-white to-amber-50/45 p-4">
        <div>
          <p className="font-mono text-sm font-black text-primary">
            {order.id}
          </p>
          <h2 className="mt-1 text-lg font-black text-foreground">
            Payment verification
          </h2>
        </div>
        <StatusBadge status={payment.status} />
      </div>
      {!shiftOpen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
          {canRejectWithoutShift
            ? "Start a cashier shift before verifying this payment. Secure rejection remains available."
            : "Start a cashier shift before processing this payment."}
        </div>
      )}
      <div className="payment-review-grid grid gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(330px,1.1fr)]">
        <div className="payment-proof-column min-w-0">
          <ProofViewer payment={payment} />
        </div>
        <div className="min-w-0 space-y-4">
          <section
            className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm"
            aria-label="Manual GCash proof review"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Order total
                </p>
                <p className="mt-1 text-xl font-black text-foreground">
                  {formatMoney(order.total)}
                </p>
              </div>
              <div className="sm:border-l sm:border-current/10 sm:pl-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Recorded payment amount
                </p>
                <p className="mt-1 text-xl font-black text-foreground">
                  {formatMoney(payment.amount)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs font-black text-amber-900">
              Proof review: Manual verification required
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-900/90">
              Inspect the screenshot itself, the GCash reference, the amount
              shown in the proof, and the recipient/details before confirming.
            </p>
          </section>
          <section className="rrj-card grid gap-4 p-4 sm:grid-cols-2">
            <Detail
              icon={Hash}
              label="Recorded GCash Reference"
              value={payment.referenceNumber ?? "Not found"}
            />
            <Detail
              icon={UserRound}
              label="Customer"
              value={order.customerName}
            />
            <Detail
              icon={CreditCard}
              label="Recorded Payment Amount"
              value={formatMoney(payment.amount)}
            />
            <Detail
              icon={Upload}
              label="Proof Source"
              value="Customer-uploaded screenshot"
            />
            <Detail
              icon={CalendarDays}
              label="Date"
              value={formatPaymentDate(payment.uploadedAt)}
            />
            <Detail
              icon={Clock3}
              label="Time"
              value={formatPaymentTime(payment.uploadedAt)}
            />
            <Detail icon={Upload} label="Uploaded By" value={uploadedBy} />
            <Detail
              icon={ShieldCheck}
              label="Verification Status"
              value={payment.status}
            />
          </section>
          <section>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Order items
            </p>
            <div className="rrj-card overflow-hidden">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-3 border-b border-border px-4 py-3 text-xs last:border-0"
                >
                  <span>
                    <strong>
                      {item.quantity} × {item.name}
                    </strong>
                    {item.note && (
                      <span className="block text-muted-foreground">
                        {item.note}
                      </span>
                    )}
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
          disabled={!shiftOpen && !canRejectWithoutShift}
          onClick={onReject}
        >
          Reject payment
        </CashierButton>
        <CashierButton
          className="min-w-40"
          disabled={!shiftOpen}
          onClick={onVerify}
        >
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

const formatPaymentDate = formatDateOnly;
const formatPaymentTime = (iso: string) => formatTimeOnly(iso, true);
