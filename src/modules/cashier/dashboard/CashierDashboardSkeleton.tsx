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
      <LoadingSkeleton className="h-[68px] w-full rounded-2xl" />
      <LoadingSkeleton className="h-20 w-full rounded-2xl" />
      <LoadingSkeleton className="h-11 w-full rounded-xl" />
      <LoadingSkeleton className="min-h-[280px] flex-1 rounded-2xl" />
    </div>
  );
}
