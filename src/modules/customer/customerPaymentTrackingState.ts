type PaymentStatus = "pending" | "verified" | "rejected" | "voided";

export function customerPaymentTrackingState(
  orderStatus: string | null,
  paymentStatus: PaymentStatus | null,
  fresh: boolean,
) {
  const waiting = orderStatus === "waiting_payment_verification";
  const cancelled = orderStatus === "cancelled" || orderStatus === "rejected";
  const notSubmitted = waiting && paymentStatus === null && fresh;
  const needsResubmission = waiting && paymentStatus === "rejected";
  const statusLabel = paymentStatus === "verified" ? "Verified"
    : paymentStatus === "voided" ? "Refund recorded"
    : paymentStatus === "rejected" ? cancelled ? "Rejected before cancellation" : "Needs resubmission"
    : paymentStatus === "pending" ? "Awaiting Cashier verification"
    : notSubmitted ? "Not submitted" : "Not available";
  return {
    notSubmitted,
    needsResubmission,
    showPendingNotice: waiting && paymentStatus === "pending",
    statusLabel,
  };
}

export function customerPaymentSubmissionIsCurrent(
  viewedOrder: { id: string; grand_total: number | string },
  viewedPayment: { payment_id: string } | null,
  currentOrder: { id: string; current_status: string; grand_total: number | string } | null,
  currentPayment: { payment_id: string; payment_status: PaymentStatus } | null,
) {
  return currentOrder?.id === viewedOrder.id &&
    currentOrder.current_status === "waiting_payment_verification" &&
    Number.isFinite(Number(currentOrder.grand_total)) &&
    Number(currentOrder.grand_total) === Number(viewedOrder.grand_total) &&
    (viewedPayment === null ? currentPayment === null :
      currentPayment?.payment_id === viewedPayment.payment_id &&
      currentPayment.payment_status === "rejected");
}
