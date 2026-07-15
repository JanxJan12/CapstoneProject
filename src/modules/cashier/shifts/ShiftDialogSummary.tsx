import { CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { formatMoney } from "../constants";
import type { ShiftVarianceOutcome } from "./shiftSettlementUtils";

export function ShiftSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-black text-foreground">{value}</p>
    </div>
  );
}

export function VarianceIndicator({
  variance,
  outcome,
}: {
  variance: number;
  outcome: Exclude<ShiftVarianceOutcome, "In progress">;
}) {
  const Icon =
    variance === 0 ? CheckCircle2 : variance > 0 ? TrendingUp : TrendingDown;
  const tone =
    variance === 0
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : variance > 0
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-red-200 bg-red-50 text-red-800";
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 ${tone}`}
    >
      <span className="flex items-center gap-2 text-sm font-black">
        <Icon className="h-4 w-4" aria-hidden="true" /> {outcome}
      </span>
      <span className="text-sm font-black">{formatMoney(variance)}</span>
    </div>
  );
}
