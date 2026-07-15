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
      <LoadingSkeleton className="h-56 w-full rounded-[20px]" />
      <LoadingSkeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <LoadingSkeleton key={index} className="h-[116px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 2xl:grid-cols-[1.3fr_0.7fr]">
        <LoadingSkeleton className="h-[580px] rounded-2xl" />
        <LoadingSkeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}
