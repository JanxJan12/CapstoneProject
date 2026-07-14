import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageOpen,
} from "lucide-react";
import { cn } from "../../../app/components/ui/utils";
import type {
  OrderStatus,
  PaymentStatus,
  ShiftStatus,
  TransactionStatus,
} from "../types";

type Status = OrderStatus | PaymentStatus | ShiftStatus | TransactionStatus;

const STATUS_STYLE: Record<Status, string> = {
  "Awaiting Payment": "border-amber-200 bg-amber-50 text-amber-800",
  Confirmed: "border-blue-200 bg-blue-50 text-blue-800",
  Preparing: "border-orange-200 bg-orange-50 text-orange-800",
  Ready: "border-violet-200 bg-violet-50 text-violet-800",
  "Waiting for Rider": "border-sky-200 bg-sky-50 text-sky-800",
  "Rider Accepted": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Picked Up": "border-indigo-200 bg-indigo-50 text-indigo-800",
  "Out for Delivery": "border-sky-200 bg-sky-50 text-sky-800",
  Delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Cancelled: "border-red-200 bg-red-50 text-red-800",
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  Verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Rejected: "border-red-200 bg-red-50 text-red-800",
  Refunded: "border-blue-200 bg-blue-50 text-blue-800",
  Voided: "border-zinc-200 bg-zinc-100 text-zinc-700",
  Open: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Pending Review": "border-amber-200 bg-amber-50 text-amber-800",
  Closed: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

export function CashierStatusBadge({
  status,
  delayed = false,
}: {
  status: Status;
  delayed?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] shadow-[0_1px_2px_rgba(36,26,19,0.03)]",
        delayed
          ? "border-red-200 bg-red-50 text-red-800"
          : STATUS_STYLE[status],
      )}
    >
      {delayed ? (
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
      ) : status === "Completed" ||
        status === "Verified" ||
        status === "Closed" ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Clock3 className="h-3 w-3" aria-hidden="true" />
      )}
      {delayed ? "Delayed" : status}
    </span>
  );
}

export function CashierButton({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
}) {
  const variants = {
    primary:
      "bg-gradient-to-r from-primary to-orange-600 text-primary-foreground shadow-[0_6px_16px_rgba(184,79,10,0.18)] hover:-translate-y-0.5 hover:shadow-[0_9px_20px_rgba(184,79,10,0.24)]",
    secondary:
      "border border-border bg-white text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-amber-50/40 hover:shadow-md",
    danger:
      "border border-red-600 bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm hover:-translate-y-0.5 hover:from-red-700 hover:to-red-600 hover:shadow-md",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] px-4 text-xs font-black transition-all duration-200 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(184,79,10,0.1)]" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/75">
            Cashier operations
          </p>
        </div>
        <h1 className="text-2xl font-black tracking-[-0.025em] text-foreground sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs font-medium leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

export const fieldClass =
  "min-h-11 w-full rounded-[11px] border border-border bg-white/90 px-3 text-sm text-foreground shadow-[0_1px_2px_rgba(36,26,19,0.03)] outline-none transition-all placeholder:text-muted-foreground/55 hover:border-primary/25 focus:border-primary/55 focus:bg-white focus:ring-4 focus:ring-primary/10 disabled:bg-muted disabled:text-muted-foreground";

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-600"
    >
      <AlertCircle className="h-3 w-3" />
      {children}
    </p>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-bold text-foreground"
    >
      {children}
    </label>
  );
}

export const CashierInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function CashierInput(props, ref) {
  return (
    <input ref={ref} {...props} className={cn(fieldClass, props.className)} />
  );
});

export function CashierSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldClass, props.className)} />;
}

export function CashierTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cn(fieldClass, "min-h-20 py-3", props.className)}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-gradient-to-b from-amber-50/40 to-white p-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-border">
        <PackageOpen className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-black tracking-tight text-foreground">
        {title}
      </p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-white px-4 py-3 text-xs font-semibold text-red-800 shadow-sm"
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {message}
      </span>
      {onRetry && (
        <button
          className="min-h-11 rounded-lg px-3 font-black underline"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
