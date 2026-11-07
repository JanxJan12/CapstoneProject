  const ORDER_STATUS_LABELS: Record<string, string> = {
  waiting_payment_verification: "Waiting for Payment Verification",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  waiting_for_rider: "Waiting for Rider",
  rider_accepted: "Rider Accepted",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const NEUTRAL_PRESENTATION = {
  badge: "border-stone-200 bg-stone-100 text-stone-700",
  card: "border-stone-200 bg-card",
  panel: "border-stone-200 bg-stone-50",  
  text: "text-stone-800",
  dot: "bg-stone-500",
};

export function formatCustomerOrderStatus(status: string): string {
  return (
    ORDER_STATUS_LABELS[status] ??
    status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

export function getCustomerOrderStatusPresentation(status: string) {
  if (status === "completed" || status === "delivered") {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      card: "border-emerald-200/80 bg-card",
      panel: "border-emerald-200 bg-emerald-50",
      text: "text-emerald-800",
      dot: "bg-emerald-600",
    };
  }

  if (status === "cancelled" || status === "rejected") {
    return {
      badge: "border-red-200 bg-red-50 text-red-700",
      card: "border-red-200/80 bg-card",
      panel: "border-red-200 bg-red-50",
      text: "text-red-800",
      dot: "bg-red-600",
    };
  }

  if (
    status === "waiting_payment_verification" ||
    status === "waiting_for_rider"
  ) {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      card: "border-amber-200 bg-card",
      panel: "border-amber-200 bg-amber-50",
      text: "text-amber-900",
      dot: "bg-amber-600",
    };
  }

  if (status === "ready") {
    return {
      badge: "border-violet-200 bg-violet-50 text-violet-800",
      card: "border-violet-200 bg-card",
      panel: "border-violet-200 bg-violet-50",
      text: "text-violet-800",
      dot: "bg-violet-600",
    };
  }

  if (
    status === "confirmed" ||
    status === "preparing" ||
    status === "rider_accepted" ||
    status === "picked_up" ||
    status === "out_for_delivery"
  ) {
    return {
      badge: "border-blue-200 bg-blue-50 text-blue-800",
      card: "border-blue-200/80 bg-card",
      panel: "border-blue-200 bg-blue-50",
      text: "text-blue-800",
      dot: "bg-blue-600",
    };
  }

  return NEUTRAL_PRESENTATION;
}

export function CustomerStatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const presentation = getCustomerOrderStatusPresentation(status);

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold ${presentation.badge} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 flex-none rounded-full ${presentation.dot}`}
      />
      <span className="min-w-0 break-words">
        {formatCustomerOrderStatus(status)}
      </span>
    </span>
  );
}
