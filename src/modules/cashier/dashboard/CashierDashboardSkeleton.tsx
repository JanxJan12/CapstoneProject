import { LoadingSkeleton } from "../components";

export function CashierDashboardSkeleton() {
  return (
    <div
      className="cashier-page cashier-loading-skeleton"
      role="status"
      aria-label="Loading cashier dashboard"
      aria-live="polite"
    >
      <span className="sr-only">Loading cashier dashboard…</span>
      <LoadingSkeleton className="h-[76px] w-full rounded-2xl" />
      <LoadingSkeleton className="h-24 w-full rounded-2xl" />
      <LoadingSkeleton className="h-[50px] w-full rounded-xl" />
      <LoadingSkeleton className="min-h-[360px] flex-1 rounded-2xl" />
    </div>
  );
}
