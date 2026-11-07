import { CreditCard } from "lucide-react";
import { formatDateTime, formatMoney } from "../constants";
import type { Order, Payment } from "../types";
import { CashierButton, EmptyState } from "../components";
import { ProofViewer } from "./ProofViewer";

export function PaymentDetails({
  payment,
  order,
  shiftOpen,
  actionsDisabled = false,
  onVerify,
  onReject,
}: {
  payment?: Payment;
  order?: Order;
  shiftOpen: boolean;
  actionsDisabled?: boolean;
  onVerify: () => void;
  onReject: () => void;
}) {
  if (!payment || !order) {
    return (
      <EmptyState
        compact
        icon={CreditCard}
        title="Select a payment"
        description="Choose a submission from the queue."
      />
    );
  }

  const canRejectWithoutShift = Boolean(
    payment.proofImagePath && order.databaseId && order.orderChannel === "online",
  );
  const uploadedBy = payment.uploadedBy ?? payment.senderName ?? order.customerName;
  const hasUploadedProof = Boolean(payment.proofImagePath || payment.proofUrl);
  const submittedAtValid = Number.isFinite(new Date(payment.uploadedAt).getTime());
  const amountsMatch = Math.round(order.total * 100) === Math.round(payment.amount * 100);

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className="font-mono text-base font-black text-primary">{order.id}</p>
          <p className="break-words text-lg font-bold text-foreground">{order.customerName}</p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {payment.method} submission
        </p>
      </div>

      <div className="payment-review-grid grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
        <div className="payment-proof-column min-w-0">
          <ProofViewer payment={payment} />
        </div>

        <aside className="min-w-0">
          <section className="rounded-xl border border-border bg-white p-3.5" aria-label="Payment details">
            <dl className="flex flex-wrap items-end gap-x-5 gap-y-2">
              <div className="min-w-0">
                <dt className="text-sm font-bold text-muted-foreground">Amount to verify</dt>
                <dd className="mt-1 break-words text-2xl font-black text-foreground">{formatMoney(order.total)}</dd>
              </div>
              {!amountsMatch ? (
                <div className="min-w-0">
                  <dt className="text-sm font-bold text-amber-800">Customer claimed</dt>
                  <dd className="mt-1 break-words text-lg font-black text-amber-900">{formatMoney(payment.amount)}</dd>
                </div>
              ) : null}
            </dl>
            {!amountsMatch ? (
              <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-sm font-bold text-amber-900">
                Amount mismatch — review the claimed amount before deciding.
              </p>
            ) : null}

            <dl className="mt-3 grid gap-x-3 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <dt className="font-semibold text-muted-foreground">GCash reference</dt>
                <dd className="mt-0.5 break-all font-mono text-base font-black text-foreground">
                  {payment.referenceNumber ?? "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Submitted</dt>
                <dd className="font-bold text-foreground">
                  {submittedAtValid ? formatDateTime(payment.uploadedAt) : "Date unavailable"}
                </dd>
              </div>
              {uploadedBy !== order.customerName ? <div>
                <dt className="font-semibold text-muted-foreground">Uploaded by</dt>
                <dd className="break-words font-bold text-foreground">{uploadedBy}</dd>
              </div> : null}
              {!hasUploadedProof ? <div><dt className="font-semibold text-muted-foreground">Proof</dt><dd className="font-bold text-foreground">No screenshot uploaded</dd></div> : null}
            </dl>

            <details className="mt-3 border-t border-border">
              <summary className="flex min-h-11 cursor-pointer items-center py-2 text-sm font-black text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                Order items ({order.items.length})
              </summary>
              <div className="border-t border-border">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0">
                    <span className="min-w-0 break-words">
                      <strong>{item.quantity} × {item.name}</strong>
                      {item.note ? <span className="block text-muted-foreground">{item.note}</span> : null}
                      {item.modifiers?.length ? (
                        <span className="block text-muted-foreground">
                          {item.modifiers.map((modifier) => modifier.name).join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <strong className="shrink-0">{formatMoney(item.unitPrice * item.quantity)}</strong>
                  </div>
                ))}
              </div>
            </details>
          </section>
        </aside>
      </div>

      <div className="payment-review-actions sticky bottom-0 z-10 space-y-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        {!shiftOpen ? (
          <p className="text-sm font-semibold text-muted-foreground">
            {canRejectWithoutShift
              ? "Start a shift to verify. Secure rejection is still available."
              : "Start a shift before processing this payment."}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <CashierButton
            variant="danger"
            className="bg-none bg-red-50 text-sm text-red-700 shadow-none hover:bg-red-100"
            disabled={actionsDisabled || (!shiftOpen && !canRejectWithoutShift)}
            onClick={onReject}
          >
            Reject
          </CashierButton>
          <CashierButton
            className="min-w-40 text-sm"
            disabled={actionsDisabled || !shiftOpen}
            onClick={onVerify}
          >
            Verify payment
          </CashierButton>
        </div>
      </div>
    </div>
  );
}
