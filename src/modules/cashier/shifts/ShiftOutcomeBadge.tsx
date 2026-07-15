import { CheckCircle2, Clock3, TrendingDown, TrendingUp } from "lucide-react";
import type { CashierShift } from "../types";
import {
  getVarianceOutcome,
  type ShiftVarianceOutcome,
} from "./shiftSettlementUtils";

const PRESENTATION: Record<
  ShiftVarianceOutcome,
  { icon: typeof Clock3; className: string }
> = {
  Balanced: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  Over: {
    icon: TrendingUp,
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  Short: {
    icon: TrendingDown,
    className: "border-red-200 bg-red-50 text-red-800",
  },
  "In progress": {
    icon: Clock3,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
};

export function ShiftOutcomeBadge({ shift }: { shift: CashierShift }) {
  const outcome = getVarianceOutcome(shift);
  const presentation = PRESENTATION[outcome];
  const Icon = presentation.icon;
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${presentation.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {outcome}
    </span>
  );
}
