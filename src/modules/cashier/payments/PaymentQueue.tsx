import { Clock3, CreditCard } from "lucide-react";
import { formatDateTime, formatElapsed, formatMoney } from "../constants";
import type { Order, Payment } from "../types";
import { EmptyState } from "../components";

export function PaymentQueue({
  payments,
  orders,
  selectedId,
  onSelect,
  disabled = false,
}: {
  payments: Payment[];
  orders: Order[];
  selectedId?: string;
  onSelect: (paymentId: string) => void;
  disabled?: boolean;
}) {
  if (!payments.length)
    return (
      <EmptyState
        compact
        icon={CreditCard}
        title="No pending payments"
        description="New GCash submissions will appear here."
      />
    );
  return (
    <div className="divide-y divide-border" aria-label="Pending payments">
      {payments.map((payment) => {
        const order = orders.find((entry) => entry.id === payment.orderId);
        if (!order) return null;
        const elapsed = formatElapsed(payment.uploadedAt);
        const submittedAtValid = Number.isFinite(new Date(payment.uploadedAt).getTime());
        const submitted = elapsed === "Just now" || elapsed === "Time unavailable"
          ? elapsed
          : `${elapsed} ago`;
        return (
          <button
            key={payment.id}
            type="button"
            disabled={disabled}
            aria-pressed={selectedId === payment.id}
            onClick={() => onSelect(payment.id)}
            className={`group min-h-[88px] w-full px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selectedId === payment.id ? "border-l-4 border-l-primary bg-amber-50" : "border-l-4 border-l-transparent hover:bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-black text-primary">
                  {order.id}
                </p>
                <p className="mt-1 truncate text-base font-black text-foreground" title={order.customerName}>
                  {order.customerName}
                </p>
              </div>
              <strong className="shrink-0 whitespace-nowrap text-base font-black text-foreground">
                {formatMoney(payment.amount)}
              </strong>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-muted-foreground" title={submittedAtValid ? formatDateTime(payment.uploadedAt) : undefined}>
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Submitted {submitted}
            </p>
          </button>
        );
      })}
    </div>
  );
}
