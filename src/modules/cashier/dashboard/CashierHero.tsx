import { useEffect, useState } from "react";
import {
  Banknote,
  Circle,
  Clock3,
  CreditCard,
  ShoppingCart,
} from "lucide-react";
import { formatMoney } from "../constants";
import type { CashierPageId } from "../types";
import { CashierButton } from "../components/CashierUI";
import { useCashierStore } from "../hooks/CashierStore";

const elapsed = (startedAt?: string) => {
  if (!startedAt) return "—";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000),
  );
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

export function CashierHero({
  onNavigate,
}: {
  onNavigate: (page: CashierPageId) => void;
}) {
  const { state, activeShift, shiftTotals } = useCashierStore();
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const current = new Date();
  return (
    <section className="cashier-compact-hero relative overflow-hidden rounded-[20px] border border-orange-300/15 bg-[#2b1b12] text-white shadow-[0_18px_42px_rgba(55,31,16,0.18)] ring-1 ring-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(249,115,22,0.24),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />
      <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border border-white/10 bg-orange-400/5" />
      <div className="relative grid grid-cols-2 gap-3 p-4 md:grid-cols-[minmax(280px,1.35fr)_repeat(3,minmax(130px,0.65fr))] md:p-5">
        <div className="col-span-2 flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm md:col-span-1">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${activeShift ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}`}>
                <Circle className={`h-2 w-2 ${activeShift ? "fill-emerald-300 text-emerald-300" : "fill-amber-300 text-amber-300"}`} />
                {activeShift ? "Shift Active" : "Shift Closed"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/65">
                {state.cashier.terminal}
              </span>
            </div>
            <h1 className="mt-3 text-[22px] font-black leading-tight tracking-[-0.035em] text-white sm:text-[25px]">
              Ready for service, {state.cashier.name.split(" ")[0]}.
            </h1>
            <p className="mt-1.5 text-[11px] font-medium text-white/50">
              Start orders, clear payments, and release ready meals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CashierButton
              className="min-h-12 bg-white from-white to-white px-4 text-[#2b1b12] shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-amber-50 hover:from-amber-50 hover:to-white"
              disabled={!activeShift}
              onClick={() => onNavigate("walkin-pos")}
            >
              <ShoppingCart className="h-4 w-4" />
              Start walk-in{" "}
              <kbd className="hidden rounded bg-black/10 px-1.5 py-0.5 text-[9px] sm:inline">
                F2
              </kbd>
            </CashierButton>
            <CashierButton
              className="min-h-12 border border-white/15 bg-white/10 from-white/10 to-white/5 px-4 text-white shadow-none backdrop-blur-sm hover:border-white/25 hover:bg-white/15 hover:from-white/15 hover:to-white/10"
              disabled={!activeShift}
              onClick={() => onNavigate("pending-payments")}
            >
              <CreditCard className="h-4 w-4" />
              Review payments{" "}
              <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[9px] sm:inline">
                F3
              </kbd>
            </CashierButton>
          </div>
        </div>
        <HeroDatum
          label="Current Time"
          value={current.toLocaleTimeString("en-PH", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          detail={current.toLocaleDateString("en-PH", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        />
        <HeroDatum
          icon={Clock3}
          label="Shift Duration"
          value={elapsed(activeShift?.startedAt)}
          detail={activeShift ? "Active counter time" : "No active shift"}
        />
        <HeroDatum
          icon={Banknote}
          label="Expected Drawer"
          value={activeShift ? formatMoney(shiftTotals.expectedCash) : "—"}
          detail={activeShift ? "Opening cash + sales" : "Drawer closed"}
          accent
        />
      </div>
    </section>
  );
}

function HeroDatum({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={`group flex min-h-[128px] flex-col justify-center rounded-2xl border p-4 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/20 ${accent ? "border-emerald-300/20 bg-emerald-300/10" : "border-white/10 bg-white/[0.075]"}`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.17em] text-white/40">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-amber-200" />}
        <p className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
          {value}
        </p>
      </div>
      <p className="mt-1 truncate text-[10px] font-semibold text-white/50">
        {detail}
      </p>
    </div>
  );
}
