import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import type {
  OrderStatus,
  PaymentStatus,
  ShiftStatus,
  TransactionStatus,
} from "../types";

export type CashierStatus =
  OrderStatus | PaymentStatus | ShiftStatus | TransactionStatus;

type StatusPresentation = { className: string; icon: LucideIcon };

const STATUS_PRESENTATION: Record<CashierStatus, StatusPresentation> = {
  "Awaiting Payment": {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertCircle,
  },
  Confirmed: {
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: Clock3,
  },
  Preparing: {
    className: "border-orange-200 bg-orange-50 text-orange-800",
    icon: Clock3,
  },
  Ready: {
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: Clock3,
  },
  "Waiting for Rider": {
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Clock3,
  },
  "Rider Accepted": {
    className: "border-cyan-200 bg-cyan-50 text-cyan-800",
    icon: Clock3,
  },
  "Picked Up": {
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    icon: Clock3,
  },
  "Out for Delivery": {
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Clock3,
  },
  Delivered: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  Completed: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  Cancelled: {
    className: "border-red-200 bg-red-50 text-red-800",
    icon: XCircle,
  },
  Unpaid: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertCircle,
  },
  Pending: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertCircle,
  },
  Verified: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  Rejected: {
    className: "border-red-200 bg-red-50 text-red-800",
    icon: XCircle,
  },
  Refunded: {
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: Clock3,
  },
  Voided: {
    className: "border-zinc-200 bg-zinc-100 text-zinc-700",
    icon: XCircle,
  },
  Open: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  "Pending Review": {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertCircle,
  },
  Closed: {
    className: "border-zinc-200 bg-zinc-100 text-zinc-700",
    icon: CheckCircle2,
  },
};

export interface StatusBadgeProps {
  status: CashierStatus;
  delayed?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  delayed = false,
  className,
}: StatusBadgeProps) {
  const presentation = STATUS_PRESENTATION[status];
  const Icon = delayed ? AlertCircle : presentation.icon;
  const label = delayed ? "Delayed" : status;

  return (
    <span
      key={`${status}-${delayed ? "delayed" : "current"}`}
      aria-label={delayed ? `Delayed ${status}` : status}
      className={cn(
        "cashier-status-badge inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] shadow-[0_1px_2px_rgba(36,26,19,0.03)]",
        delayed
          ? "border-red-200 bg-red-50 text-red-800"
          : presentation.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
