export const ORDER_STEPS = [
  {
    status: "waiting_payment_verification",
    label: "Waiting for Payment Verification",
  },
  {
    status: "confirmed",
    label: "Confirmed",
  },
  {
    status: "preparing",
    label: "Preparing",
  },
  {
    status: "ready",
    label: "Ready",
  },
  {
    status: "waiting_for_rider",
    label: "Waiting for Rider",
  },
  {
    status: "rider_accepted",
    label: "Rider Accepted",
  },
  {
    status: "picked_up",
    label: "Picked Up",
  },
  {
    status: "out_for_delivery",
    label: "Out for Delivery",
  },
  {
    status: "delivered",
    label: "Delivered",
  },
] as const;

const NON_DELIVERY_ORDER_STEPS = [
  ...ORDER_STEPS.slice(0, 4),
  { status: "completed", label: "Completed" },
] as const;

export function customerTimelineSteps(fulfillmentType: string, currentStatus: string) {
  // A completed order is not evidence of Rider delivery, even if its service
  // type says delivery. The backend uses delivered for that event.
  return fulfillmentType === "delivery" && currentStatus !== "completed"
    ? ORDER_STEPS
    : NON_DELIVERY_ORDER_STEPS;
}

export function customerTimelineStepState(
  currentStatus: string,
  stepStatus: string,
  hasHistory: boolean,
) {
  const isCurrent = currentStatus === stepStatus;
  const isTerminal = stepStatus === "completed" || stepStatus === "delivered";
  return {
    isCurrent,
    isComplete: currentStatus !== "cancelled" && currentStatus !== "rejected" &&
      ((hasHistory && !isCurrent) || (isCurrent && isTerminal)),
  };
}
