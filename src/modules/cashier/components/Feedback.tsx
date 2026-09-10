import { AlertCircle } from "lucide-react";

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="cashier-alert cashier-alert-error flex items-center justify-between gap-3 rounded-xl border border-red-200/80 bg-red-50/75 px-3.5 py-2.5 text-[11px] font-semibold leading-4 text-red-800 shadow-[0_2px_8px_rgba(153,27,27,0.04)]"
    >
      <span className="flex min-w-0 items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {message}
      </span>
      {onRetry ? (
        <button
          type="button"
          className="min-h-9 shrink-0 rounded-lg px-3 font-black underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
