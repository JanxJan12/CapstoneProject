import { Skeleton } from "../../../app/components/ui/skeleton";

export function CashierDashboardSkeleton() {
  return (
    <div
      className="cashier-page"
      role="status"
      aria-label="Loading cashier dashboard"
      aria-live="polite"
    >
      <span className="sr-only">Loading cashier dashboard…</span>
      <Skeleton className="h-56 w-full rounded-[20px]" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-[116px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 2xl:grid-cols-[1.3fr_0.7fr]">
        <Skeleton className="h-[580px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}
