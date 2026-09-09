import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useCashierStore } from "../hooks/CashierStore";
import { CashierButton, ErrorBanner, PageHeader, Toast } from "../components";
import { DATA_REFRESH_FEEDBACK_MS } from "../constants";
import { PaymentDetails } from "./PaymentDetails";
import { PaymentQueue } from "./PaymentQueue";
import { RejectPaymentDialog } from "./RejectPaymentDialog";
import { VerifyPaymentDialog } from "./VerifyPaymentDialog";
import type { CashierNavigationIntent } from "../types";

export function PendingPaymentsPage({
  intent,
}: {
  intent?: CashierNavigationIntent;
}) {
  const { state, activeShift, verifyPayment, rejectPayment } =
    useCashierStore();
  const pending = useMemo(
    () =>
      state.payments
        .filter((entry) => entry.status === "Pending")
        .sort(
          (a, b) =>
            new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
        ),
    [state.payments],
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
useEffect(() => {
  const requestedPayment = intent?.paymentOrderId
    ? pending.find(
        (entry) => entry.orderId === intent.paymentOrderId,
      )
    : undefined;

  if (requestedPayment) {
    if (selectedId !== requestedPayment.id) {
      setSelectedId(requestedPayment.id);
    }
    return;
  }

  if (
    !selectedId ||
    !pending.some((entry) => entry.id === selectedId)
  ) {
    setSelectedId(pending[0]?.id);
  }
}, [intent?.paymentOrderId, pending, selectedId]);
  const payment = pending.find((entry) => entry.id === selectedId);
  const order = state.orders.find((entry) => entry.id === payment?.orderId);
  const nextPendingPaymentId = (currentPaymentId: string) => {
    const currentIndex = pending.findIndex(
      (entry) => entry.id === currentPaymentId,
    );
    return (
      pending[currentIndex + 1]?.id ??
      pending.find((entry) => entry.id !== currentPaymentId)?.id
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      Toast.success("Payment queue is up to date");
    }, DATA_REFRESH_FEEDBACK_MS);
  };

  const handleVerify = async () => {
    if (!order || !payment) return;
    const currentPaymentId = payment.id;
    const nextPaymentId = nextPendingPaymentId(payment.id);
    setLoading(true);
    setError("");
    setVerifyOpen(false);
    setSelectedId(nextPaymentId);
    try {
      await verifyPayment(payment.id);
      Toast.success(`Payment verified for ${order.id}`, {
        description: nextPaymentId
          ? "Order, kitchen, dashboard, reports, and transaction records updated. Next payment opened."
          : "Order, kitchen, dashboard, reports, and transaction records updated. Queue complete.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to verify payment.";
      setSelectedId(currentPaymentId);
      setVerifyOpen(true);
      setError(message);
      Toast.error("Verification failed", { description: message });
    } finally {
      setLoading(false);
    }
  };
  const handleReject = async (reason: string, notes?: string) => {
    if (!order || !payment) return;
    const currentPaymentId = payment.id;
    const nextPaymentId = nextPendingPaymentId(payment.id);
    setLoading(true);
    setError("");
    setRejectOpen(false);
    setSelectedId(nextPaymentId);
    try {
      await rejectPayment(payment.id, reason, notes);
      Toast.success(`Payment rejected for ${order.id}`, {
        description:
          "The customer was notified and the order stayed out of the kitchen queue.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to reject payment.";
      setSelectedId(currentPaymentId);
      setRejectOpen(true);
      setError(message);
      Toast.error("Rejection failed", { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cashier-page">
      <PageHeader
        title="Pending Payments"
        description={`${pending.length} GCash ${pending.length === 1 ? "submission" : "submissions"} awaiting review`}
        actions={
          <CashierButton
            variant="secondary"
            loading={refreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </CashierButton>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => setError("")} />}
      <div
        className="payment-review-shell rrj-card grid min-h-[590px] overflow-hidden lg:grid-cols-[320px_1fr]"
        aria-label="Payment review workspace"
      >
        <aside className="border-b border-border bg-[#fffaf5]/70 lg:border-b-0 lg:border-r">
          <div className="border-b border-border bg-gradient-to-r from-amber-50 to-orange-50/40 px-4 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Payment queue
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Oldest submission shown first
            </p>
          </div>
          <PaymentQueue
            payments={pending}
            orders={state.orders}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="min-w-0">
          <PaymentDetails
            payment={payment}
            order={order}
            shiftOpen={Boolean(activeShift)}
            onVerify={() => setVerifyOpen(true)}
            onReject={() => setRejectOpen(true)}
          />
        </main>
      </div>
      <VerifyPaymentDialog
        open={verifyOpen}
        order={order}
        payment={payment}
        loading={loading}
        onOpenChange={setVerifyOpen}
        onConfirm={handleVerify}
      />
      {order && (
        <RejectPaymentDialog
          open={rejectOpen}
          orderId={order.id}
          loading={loading}
          onOpenChange={setRejectOpen}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
}
