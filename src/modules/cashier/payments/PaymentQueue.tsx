import { Clock3, CreditCard } from "lucide-react";
import { formatElapsed, formatMoney } from "../constants";
import type { Order, Payment } from "../types";
import { StatusBadge, EmptyState } from "../components";

export function PaymentQueue({
  payments,
  orders,
  selectedId,
  onSelect,
}: {
  payments: Payment[];
  orders: Order[];
  selectedId?: string;
  onSelect: (paymentId: string) => void;
}) {
  if (!payments.length)
    return (
      <EmptyState
        compact
        icon={CreditCard}
        title="No pending payments"
        description="New customer GCash submissions will appear here automatically."
      />
    );
  return (
    <div className="divide-y divide-border" aria-label="Pending payments">
      {payments.map((payment) => {
        const order = orders.find((entry) => entry.id === payment.orderId);
        if (!order) return null;
        return (
          <button
            key={payment.id}
            type="button"
            aria-pressed={selectedId === payment.id}
            onClick={() => onSelect(payment.id)}
            className={`group min-h-[116px] w-full p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selectedId === payment.id ? "border-l-4 border-l-primary bg-gradient-to-r from-amber-50 to-white shadow-[inset_0_0_0_1px_rgba(184,79,10,0.05)]" : "hover:bg-white hover:shadow-[inset_3px_0_0_rgba(184,79,10,0.18)]"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-black text-primary">
                  {order.id}
                </p>
                <p className="mt-1 text-sm font-black text-foreground">
                  {order.customerName}
                </p>
              </div>
              <StatusBadge status={payment.status} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" />
                {payment.method}
              </span>
              <strong className="text-sm text-foreground">
                {formatMoney(order.total)}
              </strong>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              Uploaded {formatElapsed(payment.uploadedAt)} ago
            </p>
          </button>
        );
      })}
    </div>
  );
}
