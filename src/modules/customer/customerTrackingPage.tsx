import { supabase } from "@/lib/supabase";
import { gcashMerchantConfig } from "@/config/paymentConfig";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Upload, Check, Loader2, X, MapPin } from "lucide-react";
import { customerErrorMessage } from "./customerBatch1";
import { createCustomerTrackingRefreshQueue } from "./customerTrackingRefresh";
import {
  fetchCustomerTrackingPayment,
  isValidServerTimestamp,
  type CustomerTrackingHistoryRow,
  type CustomerTrackingOrderRow,
  type CustomerTrackingPaymentRow,
} from "./customerTrackingApi";
import { customerMoneyCents } from "./customerFinancialDisplay";
import { CustomerRecordedCharges, formatCustomerCurrency } from "./customerRecordedCharges";
import { customerSnapshotModifierNames } from "./customerOrderItemPresentation";
import { getPaymentProofExtension } from "./customerPaymentProof";
import type { SubmittedCustomerPayment } from "./customerPaymentSubmission";
import { customerTimelineSteps, customerTimelineStepState } from "./customerOrderSteps";
import { normalizeCustomerGcashReference } from "./customerPaymentInput";
import { customerPaymentSubmissionIsCurrent, customerPaymentTrackingState } from "./customerPaymentTrackingState";

interface CustomerOrderItemRow {
  order_id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  modifiers: unknown;
}

export function TrackingPage({
  nav,
  onNav,
  orderId,
  customerId,
}: {
  nav: ReactNode;
  onNav: (page: "history") => void;
  orderId: string | null;
  customerId: string;
}) {
  const [order, setOrder] =
    useState<CustomerTrackingOrderRow | null>(
      null,
    );
  const [orderItems, setOrderItems] = useState<CustomerOrderItemRow[]>([]);

  const [statusHistory, setStatusHistory] =
    useState<CustomerTrackingHistoryRow[]>([]);

  const [payment, setPayment] =
    useState<CustomerTrackingPaymentRow | null>(null);

  const [resubmissionReference, setResubmissionReference] =
    useState("");

  const [resubmissionProof, setResubmissionProof] =
    useState<File | null>(null);

  const [resubmissionProofError, setResubmissionProofError] =
    useState<string | null>(null);

  const [resubmissionError, setResubmissionError] =
    useState<string | null>(null);

  const [resubmissionSuccess, setResubmissionSuccess] =
    useState<{ message: string; paymentUpdatedAt: string } | null>(null);

  const [resubmittingPayment, setResubmittingPayment] =
    useState(false);

  const [uploadedResubmission, setUploadedResubmission] =
    useState<{
      fileKey: string;
      proofImagePath: string;
    } | null>(null);

  const resubmissionProofInputRef =
    useRef<HTMLInputElement | null>(null);


  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"checking" | "connected" | "reconnecting" | "offline" | "unavailable">("checking");
  const [stale, setStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    const refreshQueue = createCustomerTrackingRefreshQueue();
    let trackedId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0, lastRefresh = 0, needsRefresh = false;
    const removeChannel = () => {
      const previous = channel; channel = null;
      if (previous) void supabase.removeChannel(previous);
    };
    const connect = (id: string) => {
      if (!active || channel || !navigator.onLine) return;
      setSyncState("checking");
      const next = supabase.channel(`customer-order-tracking-${id}`);
      channel = next
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => { void refresh(); })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${id}` }, () => { void refresh(); })
        .subscribe((status) => {
          if (!active || channel !== next) return;
          if (status === "SUBSCRIBED") {
            attempts = 0; setSyncState("connected"); void refresh();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setSyncState(navigator.onLine ? "reconnecting" : "offline"); setStale(true);
            removeChannel();
            if (timer) clearTimeout(timer);
            if (attempts < 3) {
              attempts += 1;
              timer = setTimeout(() => { timer = null; connect(id); }, attempts * 5000);
            } else if (navigator.onLine) {
              setSyncState("unavailable");
            }
          }
        });
    };
    const refresh = () => refreshQueue.request(async () => {
      if (!active) return;
      setRefreshing(true);
      try {
        let query = supabase.from("orders").select("id,order_number,current_status,fulfillment_type,subtotal,delivery_fee,tax_amount,grand_total,created_at");
        if (orderId) query = query.eq("id", orderId);
        const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
        if (!active) return;
        if (error) throw error;
        const selected = ((data ?? []) as CustomerTrackingOrderRow[])[0] ?? null;
        if (!selected) {
          setUnavailable(Boolean(orderId)); setOrder(null); setOrderItems([]);
          setStatusHistory([]); setPayment(null); setStale(false); setLastUpdatedAt(null);
          trackedId = null; removeChannel(); return;
        }
        const [history, selectedPayment, items] = await Promise.all([
          supabase.from("order_status_history").select("status,notes,created_at").eq("order_id", selected.id).order("created_at", { ascending: true }),
          fetchCustomerTrackingPayment(selected.id),
          supabase.from("order_items").select("order_id,item_name,quantity,unit_price,line_total,modifiers").eq("order_id", selected.id).order("created_at", { ascending: true }),
        ]);
        if (!active) return;
        if (history.error || items.error) throw history.error ?? items.error;
        setOrder(selected); setOrderItems((items.data ?? []) as CustomerOrderItemRow[]);
        setStatusHistory((history.data ?? []) as CustomerTrackingHistoryRow[]);
        setPayment(selectedPayment); setUnavailable(false); setErrorMessage(null); setStale(false);
        setLastUpdatedAt(Date.now()); lastRefresh = Date.now(); needsRefresh = false;
        if (trackedId !== selected.id) { trackedId = selected.id; removeChannel(); connect(selected.id); }
      } catch (error) {
        if (active) {
          setErrorMessage(customerErrorMessage(error, "tracking")); setStale(true);
          needsRefresh = true;
          setSyncState((current) => !navigator.onLine ? "offline" : current === "connected" ? current : "unavailable");
        }
      } finally {
        if (active) {
          setLoading(false); setRefreshing(false);
        }
      }
    });
    refreshRef.current = () => { void refresh(); };
    const recover = () => {
      if (!active || document.visibilityState === "hidden") return;
      if (timer) { clearTimeout(timer); timer = null; }
      if (trackedId && !channel) connect(trackedId);
      if (needsRefresh || Date.now() - lastRefresh > 60_000) void refresh();
    };
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    void refresh();
    return () => {
      active = false; refreshRef.current = () => {};
      refreshQueue.dispose();
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      removeChannel();
    };
  }, [orderId, customerId]);

  useEffect(() => {
    setResubmissionReference("");
    setResubmissionProof(null);
    setResubmissionProofError(null);
    setResubmissionError(null);
    setResubmissionSuccess(null);
    setUploadedResubmission(null);

    if (resubmissionProofInputRef.current) {
      resubmissionProofInputRef.current.value = "";
    }
  }, [order?.id]);

  const handleResubmissionProofChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;

    setResubmissionProof(null);
    setResubmissionProofError(null);
    setResubmissionError(null);
    setResubmissionSuccess(null);
    setUploadedResubmission(null);

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setResubmissionProofError(
        "Upload a JPG or PNG payment screenshot.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResubmissionProofError(
        "The payment screenshot must not exceed 5 MB.",
      );
      event.target.value = "";
      return;
    }

    setResubmissionProof(file);
  };

  const handlePaymentResubmission = async () => {
    if (
      !order ||
      order.current_status !== "waiting_payment_verification" ||
      (payment !== null && payment.payment_status !== "rejected") ||
      stale || errorMessage
    ) {
      setResubmissionError(
        "Refresh this order before submitting a payment.",
      );
      return;
    }

    const { value: normalizedReference, error: referenceError } =
      normalizeCustomerGcashReference(resubmissionReference);

    setResubmissionError(null);
    setResubmissionSuccess(null);

    if (referenceError) {
      setResubmissionError(referenceError);
      return;
    }

    if (!resubmissionProof) {
      setResubmissionError("Upload a GCash payment screenshot.");
      return;
    }

    setResubmittingPayment(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || user.id !== customerId) {
        throw new Error(
          "Your signed-in customer account could not be confirmed. Sign in and try again.",
        );
      }

      // Recheck the owned order and payment before uploading a proof for a stale view.
      const { data: currentOrder, error: currentOrderError } = await supabase
        .from("orders")
        .select("id,current_status,grand_total")
        .eq("id", order.id)
        .single();
      const currentPayment = await fetchCustomerTrackingPayment(order.id);
      if (currentOrderError || !customerPaymentSubmissionIsCurrent(
        order, payment, currentOrder, currentPayment,
      )) {
        void refreshRef.current();
        throw new Error("This order's payment status changed. Refresh and review it before trying again.");
      }

      const fileKey = [
        resubmissionProof.name,
        resubmissionProof.type,
        resubmissionProof.size,
        resubmissionProof.lastModified,
      ].join(":");

      let proofImagePath =
        uploadedResubmission?.fileKey === fileKey
          ? uploadedResubmission.proofImagePath
          : null;

      if (!proofImagePath) {
        proofImagePath = [
          user.id,
          order.id,
          `${crypto.randomUUID()}.${getPaymentProofExtension(
            resubmissionProof,
          )}`,
        ].join("/");

        const { error: uploadError } =
          await supabase.storage
            .from("payment-proofs")
            .upload(
              proofImagePath,
              resubmissionProof,
              {
                cacheControl: "3600",
                contentType: resubmissionProof.type,
                upsert: false,
              },
            );

        if (uploadError) {
          throw new Error(
            `The new payment screenshot could not be uploaded: ${uploadError.message}`,
          );
        }

        setUploadedResubmission({
          fileKey,
          proofImagePath,
        });
      }

      const { data: paymentData, error: paymentError } =
        await supabase.rpc(
          "submit_customer_payment",
          {
            p_order_id: order.id,
            p_gcash_reference_number: normalizedReference,
            p_proof_image_path: proofImagePath,
          },
        );

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      const paymentResult =
        Array.isArray(paymentData) && paymentData.length === 1
          ? (paymentData[0] as Partial<SubmittedCustomerPayment>)
          : null;

      if (
        !paymentResult ||
        (payment !== null && paymentResult.payment_id !== payment.payment_id) ||
        paymentResult.order_id !== order.id ||
        paymentResult.payment_method !== "gcash" ||
        paymentResult.status !== "pending" ||
        typeof paymentResult.gcash_reference_number !== "string" ||
        paymentResult.gcash_reference_number.trim() !==
          normalizedReference ||
        paymentResult.proof_image_path !== proofImagePath ||
        Number(paymentResult.amount) !== Number(order.grand_total) ||
        (payment !== null && paymentResult.created_at !== payment.created_at) ||
        (payment === null && !isValidServerTimestamp(paymentResult.created_at))
      ) {
        throw new Error(
          "The server returned an invalid payment submission confirmation.",
        );
      }

      const [
        refreshedOrderResult,
        refreshedHistoryResult,
        refreshedPayment,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(
            `
              id,
              order_number,
              current_status,
              fulfillment_type,
              subtotal,
              delivery_fee,
              tax_amount,
              grand_total,
              created_at
            `,
          )
          .eq("id", order.id)
          .single<CustomerTrackingOrderRow>(),
        supabase
          .from("order_status_history")
          .select(
            `
              status,
              notes,
              created_at
            `,
          )
          .eq("order_id", order.id)
          .order("created_at", { ascending: true }),
        fetchCustomerTrackingPayment(order.id),
      ]);

      if (refreshedOrderResult.error) {
        throw new Error(refreshedOrderResult.error.message);
      }

      if (refreshedHistoryResult.error) {
        throw new Error(refreshedHistoryResult.error.message);
      }

      if (
        !refreshedPayment ||
        (payment !== null && refreshedPayment.payment_id !== payment.payment_id) ||
        refreshedOrderResult.data.current_status !== "waiting_payment_verification" ||
        refreshedPayment.payment_status !== "pending" ||
        refreshedPayment.gcash_reference_number !== normalizedReference ||
        refreshedPayment.amount !== Number(order.grand_total)
      ) {
        throw new Error(
          "The refreshed payment does not confirm the pending submission.",
        );
      }

      setOrder(refreshedOrderResult.data);
      setStatusHistory(
        (refreshedHistoryResult.data ??
          []) as CustomerTrackingHistoryRow[],
      );
      setPayment(refreshedPayment);
      setResubmissionReference("");
      setResubmissionProof(null);
      setUploadedResubmission(null);
      setResubmissionSuccess({
        message: payment ? "Payment resubmitted and awaiting verification" : "Payment submitted and awaiting verification",
        paymentUpdatedAt: refreshedPayment.updated_at,
      });

      if (resubmissionProofInputRef.current) {
        resubmissionProofInputRef.current.value = "";
      }
    } catch (error) {
      console.error(
        "Unable to resubmit customer payment:",
        error,
      );

      setResubmissionError(customerErrorMessage(error, "payment"));
    } finally {
      setResubmittingPayment(false);
    }
  };

  const historyByStatus = new Map(
    statusHistory.map((history) => [
      history.status,
      history,
    ]),
  );

  const isCancelled =
    order?.current_status === "cancelled";

  const isRejected =
    order?.current_status === "rejected";

  const isCompleted =
    order?.current_status === "completed";

  const isDelivered =
  order?.current_status === "delivered";

  const paymentPresentation = customerPaymentTrackingState(
    order?.current_status ?? null, payment?.payment_status ?? null,
    !stale && !errorMessage,
  );
  const paymentNeedsResubmission = paymentPresentation.needsResubmission;
  const paymentNotSubmitted = paymentPresentation.notSubmitted;
  const canEnterPayment = gcashMerchantConfig.isConfigured &&
    !stale && !errorMessage && (paymentNotSubmitted || paymentNeedsResubmission);

  useEffect(() => {
    if (order?.current_status !== "waiting_payment_verification" ||
      payment?.payment_status !== "pending" ||
      payment.updated_at !== resubmissionSuccess?.paymentUpdatedAt) {
      setResubmissionSuccess(null);
    }
  }, [order?.current_status, payment?.payment_status, payment?.updated_at, resubmissionSuccess?.paymentUpdatedAt]);

  const formattedPlacedDate =
    order
      ? new Date(
          order.created_at,
        ).toLocaleString(
          "en-PH",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          },
        )
      : "";

  const formattedOrderStatus = order
    ? order.current_status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "";

  const trackingSteps = order
    ? customerTimelineSteps(order.fulfillment_type, order.current_status)
    : [];
  const currentTrackingStepIndex = order
    ? trackingSteps.findIndex(
        (trackingStep) => trackingStep.status === order.current_status,
      )
    : -1;

  const nextTrackingStep =
    currentTrackingStepIndex >= 0 &&
    currentTrackingStepIndex < trackingSteps.length - 1
      ? trackingSteps[currentTrackingStepIndex + 1]
      : null;

  const paymentStatusLabel = paymentPresentation.statusLabel;

  const nextStepLabel = paymentNeedsResubmission
    ? "Resubmit your GCash payment for verification."
    : isCancelled || isRejected
      ? "This order has no further steps."
      : isCompleted || isDelivered
        ? "This order is complete."
        : order?.current_status === "waiting_payment_verification" && payment?.payment_status === "pending"
          ? "Cashier verification is needed before order preparation."
          : order?.current_status === "waiting_payment_verification" && !payment
            ? "Submit your GCash payment to continue."
        : nextTrackingStep
          ? `Next: ${nextTrackingStep.label}`
          : "Watch this page for the next status update.";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {nav}

      <div className="customer-storefront customer-tracking-screen flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-5 flex items-end justify-between gap-3 sm:mb-7">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Your order
              </h1>

            </div>

            <button
              type="button"
              onClick={() => onNav("history")}
              className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm hover:bg-muted"
            >
              All Orders
            </button>
          </div>

          <div className="customer-tracking-sync mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            <span className="flex flex-wrap gap-x-3 gap-y-1"><span>{syncState === "connected" ? "Updates connected" : syncState === "offline" ? "Temporarily offline" : syncState === "reconnecting" ? "Reconnecting" : syncState === "unavailable" ? "Unable to refresh" : "Checking for updates"}</span>
              {refreshing && !loading ? <span>Updating</span> : null}
              {lastUpdatedAt ? <span>{`Last updated ${new Date(lastUpdatedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`}</span> : null}
            </span>
            <button type="button" onClick={() => refreshRef.current()} disabled={refreshing}
              className="min-h-11 rounded-xl border border-border px-4 font-bold text-foreground hover:bg-muted disabled:opacity-60">
              Refresh status
            </button>
          </div>
          {stale && order && (
            <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              The latest status could not be confirmed. Showing the last update. Refresh when your connection returns.
            </p>
          )}
          {loading && !order && (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-border bg-card px-5 py-8">
              <div className="flex flex-col items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-primary"><Loader2 className="h-5 w-5 animate-spin" /></span>

                <p className="text-base font-bold text-foreground">
                  Loading order…
                </p>
              </div>
            </div>
          )}

          {!loading && errorMessage && !order && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-base font-bold text-red-700">
                Unable to load order
              </p>

              <p className="mt-1 text-sm leading-5 text-red-600">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={() => refreshRef.current()}
                className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading &&
            !errorMessage &&
            !order && (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/75 px-6 py-9 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-primary"><MapPin className="h-5 w-5" /></span>

                <p className="text-base font-bold text-foreground">
                  {unavailable ? "Order unavailable" : "No order to track"}
                </p>

                <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
                  {unavailable ? "This order could not be found or accessed. Choose an order from your history." : "Place an order first or choose one from your order history."}
                </p>

                <button
                  type="button"
                  onClick={() => onNav("history")}
                  className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-amber-800"
                >
                  View Orders
                </button>
              </div>
            )}

          {order && (
              <article className="customer-tracking-order mb-5 overflow-hidden rounded-xl border border-border bg-card">
                <section aria-label="Order overview" className="customer-tracking-lead p-5 sm:p-6">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Order status</p>
                    <h2 className={`mt-2 text-3xl ${isCancelled || isRejected ? "text-red-800" : isCompleted || isDelivered ? "text-emerald-800" : "text-foreground"}`}>
                      {isCompleted ? "Completed" : formattedOrderStatus}
                    </h2>
                    <p className="mt-4 text-sm font-semibold text-muted-foreground">What happens next</p>
                    <p className="mt-1 text-base font-semibold text-foreground">{nextStepLabel}</p>
                  </div>
                  <dl className="customer-tracking-facts">
                    <div><dt>Payment status</dt><dd className={payment?.payment_status === "rejected" ? "text-red-800" : payment?.payment_status === "verified" ? "text-emerald-800" : "text-foreground"}>{paymentStatusLabel}</dd></div>
                    <div><dt>Service type</dt><dd className="capitalize">{order.fulfillment_type.replace(/_/g, " ")}</dd></div>
                  </dl>
                </section>
                {/* Order receipt */}
                <div className="customer-tracking-record grid gap-4 border-b border-border bg-background px-4 py-4 text-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
                  <div>
                    <p className="mb-1 text-sm font-semibold text-muted-foreground">
                      Order number
                    </p>

                    <p className="font-mono text-lg font-bold text-foreground">
                      {order.order_number}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Placed {formattedPlacedDate}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="mb-1 text-sm font-semibold text-muted-foreground">
                      Server-confirmed total
                    </p>

                    <p className="text-lg font-bold text-foreground">
                      {customerMoneyCents(order.grand_total) === null ? "Unavailable" : formatCustomerCurrency(order.grand_total)}
                    </p>

                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {resubmissionSuccess && paymentPresentation.showPendingNotice && payment?.updated_at === resubmissionSuccess.paymentUpdatedAt && (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />

                      <p className="text-sm font-bold text-emerald-800">
                        {resubmissionSuccess.message}
                      </p>
                    </div>
                  )}

                  {canEnterPayment && (
                    <div className="customer-tracking-payment mb-6 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        {paymentNeedsResubmission ? <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" /> : <Upload className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />}

                        <div>
                          <p className="text-sm font-extrabold text-red-800">
                            {paymentNeedsResubmission ? "Payment needs resubmission" : "Pay for this order"}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-red-700">
                            {paymentNeedsResubmission ? "Confirm your GCash reference and upload a new payment screenshot for this same order." : gcashMerchantConfig.isDemo ? "Use a fictional DEMO reference and synthetic screenshot. Do not send money." : "Send the server-confirmed amount below, then submit your GCash reference and receipt screenshot for this order."}
                          </p>
                        </div>
                      </div>

                      {paymentNotSubmitted && <div className="mt-4 rounded-lg border border-red-100 bg-white/70 p-3 text-sm">
                        <p className="flex flex-wrap justify-between gap-2 font-bold"><span>{order.order_number}</span><span>{formatCustomerCurrency(order.grand_total)}</span></p>
                        <p className="mt-1">{gcashMerchantConfig.isDemo ? "DEMO ONLY — DO NOT PAY" : "Send payment to this merchant"}: <span className="font-semibold">{gcashMerchantConfig.name}</span> <span className="whitespace-nowrap">{gcashMerchantConfig.number}</span></p>
                      </div>}
                      {paymentNeedsResubmission && payment && <dl className="mt-4 grid gap-2 rounded-lg border border-red-100 bg-white/70 p-3 text-xs">
                        <div>
                          <dt className="font-bold text-muted-foreground">
                            Rejection reason
                          </dt>
                          <dd className="mt-0.5 font-semibold text-foreground">
                            {payment.rejection_reason}
                          </dd>
                        </div>

                        {payment.rejection_notes && (
                          <div>
                            <dt className="font-bold text-muted-foreground">
                              Cashier notes
                            </dt>
                            <dd className="mt-0.5 whitespace-pre-wrap text-foreground">
                              {payment.rejection_notes}
                            </dd>
                          </div>
                        )}
                      </dl>}

                      <div className="mt-4 grid gap-4">
                      <label className="grid gap-1.5 text-xs font-bold text-foreground">
                        GCash reference number
                        <input
                          type="text"
                          value={resubmissionReference}
                          inputMode="text"
                          autoCapitalize="off"
                          spellCheck={false}
                          disabled={resubmittingPayment}
                          onChange={(event) => {
                            setResubmissionReference(event.target.value);
                            setResubmissionError(null);
                            setResubmissionSuccess(null);
                          }}
                          placeholder="Enter the GCash reference number"
                          className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                        />
                        <span className="text-xs font-medium text-muted-foreground">Use the reference shown on your GCash receipt (up to 100 characters).</span>
                      </label>

                        <div>
                          <p className="mb-1.5 text-xs font-bold text-foreground">
                            {paymentNeedsResubmission ? "New payment proof" : "Payment proof"}
                          </p>

                          <input
                            ref={resubmissionProofInputRef}
                            type="file"
                            accept="image/jpeg,image/png"
                            disabled={resubmittingPayment}
                            onChange={handleResubmissionProofChange}
                            className="sr-only"
                          />

                          <button
                            type="button"
                            disabled={resubmittingPayment}
                            onClick={() =>
                              resubmissionProofInputRef.current?.click()
                            }
                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-red-300 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Upload className="h-4 w-4" />
                            {resubmissionProof
                              ? resubmissionProof.name
                              : "Choose JPG or PNG proof (max 5 MB)"}
                          </button>

                          {resubmissionProof && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {(resubmissionProof.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}

                          {resubmissionProofError && (
                            <p className="mt-1 text-xs font-semibold text-red-700">
                              {resubmissionProofError}
                            </p>
                          )}
                        </div>

                        {resubmissionError && (
                          <p className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">
                            {resubmissionError}
                          </p>
                        )}

                        <button
                          type="button"
                          disabled={
                            resubmittingPayment ||
                            !resubmissionReference.trim() ||
                            !resubmissionProof ||
                            Boolean(resubmissionProofError)
                          }
                          onClick={() => void handlePaymentResubmission()}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resubmittingPayment && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {resubmittingPayment
                            ? "Submitting…"
                            : paymentNeedsResubmission ? "Resubmit Payment" : "Submit Payment"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {!isCancelled &&
                    !isRejected && (
                      <section aria-labelledby="order-progress-heading" className="customer-tracking-timeline mb-5 rounded-2xl border border-border bg-background/70 p-4 sm:p-5">
                        <div className="mb-4 sm:mb-5">
                          <h2 id="order-progress-heading" className="text-lg font-extrabold text-foreground">Order progress</h2>
                        </div>
                        {trackingSteps.map(
                          (
                            trackingStep,
                            index,
                          ) => {
                            const history =
                              historyByStatus.get(
                                trackingStep.status,
                              );

                            const wasReached =
                              Boolean(history);
                            const { isCurrent, isComplete } = customerTimelineStepState(
                              order.current_status, trackingStep.status, wasReached,
                            );

                            return (
                              <div
                                key={
                                  trackingStep.status
                                }
                                className="flex items-start gap-2.5 sm:gap-4"
                              >
                                <div className="flex flex-col items-center">
                                  <div
                                    className={[
                                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 sm:h-8 sm:w-8",

                                      isComplete
                                        ? "border-green-500 bg-green-500"
                                        : isCurrent
                                          ? "border-primary bg-primary"
                                          : "border-border bg-white",
                                    ].join(" ")}
                                  >
                                    {isComplete ? (
                                      <Check className="h-3.5 w-3.5 text-white" />
                                    ) : isCurrent ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-foreground" />
                                    ) : null}
                                  </div>

                                  {index < trackingSteps.length - 1 && (
                                    <div
                                      className={`mt-1 h-5 w-0.5 sm:h-7 ${
                                        isComplete
                                          ? "bg-green-400"
                                          : "bg-border"
                                      }`}
                                    />
                                  )}
                                </div>

                                <div className="min-w-0 pb-2 sm:pb-4">
                                  <p
                                  className={`text-sm font-semibold ${
                                      wasReached || isCurrent
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {
                                      trackingStep.label
                                    }
                                  </p>

                                  {history && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {new Date(
                                        history.created_at,
                                      ).toLocaleString(
                                        "en-PH",
                                        {
                                          month:
                                            "short",
                                          day: "numeric",
                                          hour:
                                            "numeric",
                                          minute:
                                            "2-digit",
                                        },
                                      )}
                                    </p>
                                  )}

                                {isCurrent && (
                                  <p className="mt-0.5 text-xs font-semibold text-primary">
                                    {isComplete ? "Completed" : "In progress…"}
                                  </p>
                                )}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </section>
                    )}
                  <section aria-label="Ordered items" className="customer-tracking-items mb-5 rounded-xl border border-border bg-background p-4">
                    <h2 className="mb-3 text-sm font-extrabold">Ordered items</h2>
                    {orderItems.map((item, index) => (
                      <div key={`${item.order_id}-${index}`} className="flex justify-between gap-3 py-1 text-sm">
                        <div><span className="font-bold">{item.quantity}× {item.item_name ?? "Menu item"}</span>
                          {customerMoneyCents(item.unit_price) !== null ? <p className="text-xs text-muted-foreground">{formatCustomerCurrency(item.unit_price)} each</p> : null}
                          {customerSnapshotModifierNames(item.modifiers) ? <p className="text-xs text-muted-foreground">{customerSnapshotModifierNames(item.modifiers)}</p> : null}</div>
                        <span>{formatCustomerCurrency(item.line_total)}</span>
                      </div>
                    ))}
                  </section>
                  <div className="mb-5"><CustomerRecordedCharges order={order} /></div>
                </div>
              </article>
            )}
        </div>
      </div>
    </div>
  );
}
