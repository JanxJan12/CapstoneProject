import { useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import { useCashierStore } from "../hooks/CashierStore";
import {
  CashierButton,
  EmptyState,
  ErrorBanner,
  Toast,
} from "../components";
import { PaymentDetails } from "./PaymentDetails";
import { PaymentQueue } from "./PaymentQueue";
import { RejectPaymentDialog } from "./RejectPaymentDialog";
import { VerifyPaymentDialog } from "./VerifyPaymentDialog";
import { fetchCashierOnlinePayments } from "../api/onlinePaymentApi";
import type { CashierNavigationIntent } from "../types";

function isStalePaymentAction(error: unknown): boolean {
  return error instanceof Error &&
    (error.message.includes("The customer GCash payment is no longer pending.") ||
      error.message.includes("The order is no longer waiting for payment verification."));
}

type PaymentRecovery = {
  paymentId: string;
  previousVersion?: string;
  status: "checking" | "unknown" | "pending" | "verified" | "rejected";
  pendingVersion?: string;
};

export function PendingPaymentsPage({
  intent,
}: {
  intent?: CashierNavigationIntent;
}) {
  const { state, activeShift, verifyPayment, rejectPayment, refreshDatabaseState, databaseLoading, databaseError } =
    useCashierStore();
  const [staleVersions, setStaleVersions] = useState<Record<string, string | undefined>>({});
  const pending = useMemo(
    () =>
      state.payments
        .filter((entry) =>
          entry.status === "Pending" &&
          (!Object.hasOwn(staleVersions, entry.id) ||
            staleVersions[entry.id] !== entry.updatedAt),
        )
        .sort(
          (a, b) =>
            new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
        ),
    [state.payments, staleVersions],
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<PaymentRecovery | null>(null);
  const [notice, setNotice] = useState("");
  const [pageReady, setPageReady] = useState(false);
  const [pageReadLoading, setPageReadLoading] = useState(true);
  const decisionInFlight = useRef(false);
  const reconciliationInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshPagePayments = async () => {
    if (reconciliationInFlight.current) return;
    reconciliationInFlight.current = true;
    setPageReadLoading(true);
    try {
      const authoritative = await fetchCashierOnlinePayments();
      if (!mounted.current) return;
      const byId = new Map(authoritative.map((entry) => [entry.payment.id, entry.payment]));
      setStaleVersions((versions) => {
        const next = { ...versions };
        for (const entry of state.payments) {
          if (entry.status !== "Pending") continue;
          const current = byId.get(entry.id);
          if (!current || current.status !== "Pending" || current.updatedAt !== entry.updatedAt) {
            next[entry.id] = entry.updatedAt;
          }
        }
        return next;
      });
      setPageReady(true);
      setError("");
      refreshDatabaseState();
    } catch {
      if (!mounted.current) return;
      setPageReady(false);
      setError("The payment queue could not be checked. Refresh its status before taking another action.");
    } finally {
      reconciliationInFlight.current = false;
      if (mounted.current) setPageReadLoading(false);
    }
  };

  useEffect(() => {
    void refreshPagePayments();
    // One fresh read is required each time this page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recovery?.status !== "pending" || !recovery.pendingVersion) return;
    const current = state.payments.find((entry) => entry.id === recovery.paymentId);
    if (current?.status === "Pending" && current.updatedAt === recovery.pendingVersion) {
      setRecovery(null);
      setError("");
      setNotice("The latest payment submission is still pending. Review its proof before deciding.");
    }
  }, [recovery, state.payments]);

  const reconcilePayment = async (paymentId: string, previousVersion?: string) => {
    if (reconciliationInFlight.current) return;
    reconciliationInFlight.current = true;
    setRecovery({ paymentId, previousVersion, status: "checking" });
    setError("");
    setNotice("Checking the payment status. Decisions are unavailable until this read finishes.");
    try {
      const payments = await fetchCashierOnlinePayments();
      if (!mounted.current) return;
      const current = payments.find((entry) => entry.payment.id === paymentId)?.payment;
      if (!current) {
        setRecovery({ paymentId, previousVersion, status: "unknown" });
        setNotice("");
        setError("The payment status could not be found. Refresh its status before taking another action.");
      } else if (current.status === "Verified" || current.status === "Rejected") {
        setStaleVersions((versions) => ({ ...versions, [paymentId]: previousVersion }));
        setRecovery({ paymentId, previousVersion, status: current.status === "Verified" ? "verified" : "rejected" });
        setError("");
        setNotice(`The payment record is ${current.status.toLowerCase()}. The pending decision is no longer available.`);
        refreshDatabaseState();
      } else if (current.updatedAt === previousVersion) {
        setRecovery(null);
        setError("");
        setNotice("The payment is still pending. Review its proof before deciding.");
      } else {
        setStaleVersions((versions) => ({ ...versions, [paymentId]: previousVersion }));
        setRecovery({ paymentId, previousVersion, status: "pending", pendingVersion: current.updatedAt });
        setNotice("");
        setError("A newer payment submission is pending. Refreshing it before another decision.");
        refreshDatabaseState();
      }
    } catch {
      if (!mounted.current) return;
      setRecovery({ paymentId, previousVersion, status: "unknown" });
      setNotice("");
      setError("The payment outcome cannot currently be confirmed. Refresh its status before taking another action.");
    } finally {
      reconciliationInFlight.current = false;
    }
  };

  const decisionBlocked = loading || pageReadLoading || !pageReady || databaseLoading || Boolean(databaseError) ||
    (recovery !== null && recovery.status !== "verified" && recovery.status !== "rejected");
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
    if (!pageReady) {
      void refreshPagePayments();
    } else if (recovery && recovery.status !== "verified" && recovery.status !== "rejected") {
      void reconcilePayment(recovery.paymentId, recovery.previousVersion);
    } else {
      setError("");
      refreshDatabaseState();
    }
  };

  const handleVerify = async () => {
    if (!order || !payment || decisionInFlight.current || decisionBlocked) return;
    decisionInFlight.current = true;
    const currentPaymentId = payment.id;
    const nextPaymentId = nextPendingPaymentId(payment.id);
    setLoading(true);
    setError("");
    setNotice("");
    setVerifyOpen(false);
    setSelectedId(nextPaymentId);
    try {
      await verifyPayment(payment.id);
      if (!mounted.current) return;
      Toast.success(`Payment verified for ${order.id}`, {
        description: nextPaymentId
          ? "Next submission opened."
          : "Queue complete.",
      });
    } catch (caught) {
      if (!mounted.current) return;
      if (isStalePaymentAction(caught)) {
        setStaleVersions((current) => ({ ...current, [currentPaymentId]: payment.updatedAt }));
        refreshDatabaseState();
        Toast.error("Payment changed", { description: "Another cashier has already processed this payment. Refresh the queue." });
        return;
      }
      setSelectedId(currentPaymentId);
      setError("The payment result could not be confirmed. Checking its current status before another decision.");
      await reconcilePayment(currentPaymentId, payment.updatedAt);
    } finally {
      decisionInFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  const handleReject = async (reason: string, notes?: string) => {
    if (!order || !payment || decisionInFlight.current || decisionBlocked) return;
    decisionInFlight.current = true;
    const currentPaymentId = payment.id;
    const nextPaymentId = nextPendingPaymentId(payment.id);
    setLoading(true);
    setError("");
    setNotice("");
    setRejectOpen(false);
    setSelectedId(nextPaymentId);
    try {
      await rejectPayment(payment.id, reason, notes);
      if (!mounted.current) return;
      Toast.success(`Payment rejected for ${order.id}`, {
        description: "Customer notified. The order remains out of the kitchen queue.",
      });
    } catch (caught) {
      if (!mounted.current) return;
      if (isStalePaymentAction(caught)) {
        setStaleVersions((current) => ({ ...current, [currentPaymentId]: payment.updatedAt }));
        refreshDatabaseState();
        Toast.error("Payment changed", { description: "Another cashier has already processed this payment. Refresh the queue." });
        return;
      }
      setSelectedId(currentPaymentId);
      setError("The payment result could not be confirmed. Checking its current status before another decision.");
      await reconcilePayment(currentPaymentId, payment.updatedAt);
    } finally {
      decisionInFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <div className="cashier-page">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Pending Payments</h1>
          <p className="text-sm font-medium text-muted-foreground" role="status">
            {pageReady ? `${pending.length} to review` : "Checking submissions…"}
          </p>
        </div>
          <CashierButton
            variant="secondary"
            loading={pageReadLoading || databaseLoading || recovery?.status === "checking"}
            disabled={pageReadLoading || databaseLoading || recovery?.status === "checking"}
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </CashierButton>
      </header>
      {(error || databaseError) && <ErrorBanner message={error || databaseError} onRetry={handleRefresh} />}
      {notice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">{notice}</p>}
      {pending.length === 0 || !pageReady ? (
        <EmptyState
          compact
          icon={CreditCard}
          title={!pageReady || databaseError ? "Payment queue unavailable" : databaseLoading ? "Updating payment queue" : "No pending payments"}
          description={!pageReady
            ? pageReadLoading ? "Checking the latest payment statuses." : "Refresh the payment queue before reviewing a payment."
            : databaseLoading
            ? "Checking the latest submissions."
            : databaseError
              ? "Try again to load the latest submissions."
              : "New GCash submissions will appear here."}
          className="rrj-card mx-auto min-h-[120px] w-full max-w-xl border-solid border-border bg-white px-4 py-4"
        />
      ) : (
        <div
          className="payment-review-shell rrj-card grid min-h-[440px] overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)]"
          aria-label="Payment review workspace"
        >
          <aside className="max-h-60 overflow-y-auto border-b border-border bg-[#fffaf5]/70 lg:max-h-none lg:border-b-0 lg:border-r">
            <div className="sticky top-0 z-10 border-b border-border bg-[#fffaf5] px-3 py-2.5">
              <p className="text-xs font-black text-foreground">Submissions · {pending.length}</p>
            </div>
            <PaymentQueue
              payments={pending}
              orders={state.orders}
              selectedId={selectedId}
              onSelect={(id) => { if (!decisionBlocked) setSelectedId(id); }}
              disabled={decisionBlocked}
            />
          </aside>
          <main className="min-w-0">
            <PaymentDetails
              payment={payment}
              order={order}
              shiftOpen={Boolean(activeShift)}
              actionsDisabled={decisionBlocked}
              onVerify={() => { if (!decisionBlocked) setVerifyOpen(true); }}
              onReject={() => { if (!decisionBlocked) setRejectOpen(true); }}
            />
          </main>
        </div>
      )}
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