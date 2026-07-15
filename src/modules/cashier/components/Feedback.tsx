import { AlertCircle } from "lucide-react";

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="cashier-alert cashier-alert-error flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-white px-4 py-3 text-xs font-semibold text-red-800 shadow-sm"
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {message}
      </span>
      {onRetry ? (
        <button
          type="button"
          className="min-h-11 rounded-lg px-3 font-black underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
