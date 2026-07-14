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
    <section className="relative overflow-hidden rounded-[22px] border border-orange-300/15 bg-[#2b1b12] text-white shadow-[0_22px_55px_rgba(55,31,16,0.2)] ring-1 ring-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(249,115,22,0.24),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/10 bg-orange-400/5" />
      <div className="absolute -bottom-24 right-32 h-56 w-56 rounded-full border border-orange-300/10" />
      <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div className="flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${activeShift ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}`}
              >
                <Circle
                  className={`h-2 w-2 ${activeShift ? "fill-emerald-300 text-emerald-300" : "fill-amber-300 text-amber-300"}`}
                />
                {activeShift ? "Shift Active" : "Shift Closed"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
                {state.cashier.terminal}
              </span>
            </div>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-orange-200/90">
              RRJ Food-House Cashier Operations
            </p>
            <h1 className="mt-2.5 max-w-2xl text-[28px] font-black leading-[1.12] tracking-[-0.035em] text-white sm:text-[34px]">
              Orders, payments, kitchen handoff, and settlement in one connected
              workspace.
            </h1>
            <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-white/60">
              Every cashier action updates the same order, payment, transaction,
              and shift records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CashierButton
              className="bg-white from-white to-white text-[#2b1b12] shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-amber-50 hover:from-amber-50 hover:to-white"
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
              className="border border-white/15 bg-white/10 from-white/10 to-white/5 text-white shadow-none backdrop-blur-sm hover:border-white/25 hover:bg-white/15 hover:from-white/15 hover:to-white/10"
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
        <div className="grid grid-cols-2 gap-3 self-stretch">
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
              year: "numeric",
            })}
          />
          <HeroDatum
            icon={Clock3}
            label="Shift Duration"
            value={elapsed(activeShift?.startedAt)}
            detail={
              activeShift
                ? `Started ${new Date(activeShift.startedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`
                : "Start a new shift to transact"
            }
          />
          <HeroDatum
            label="Cashier on Duty"
            value={state.cashier.name}
            detail={state.cashier.terminal}
            small
          />
          <HeroDatum
            icon={Banknote}
            label="Cash Drawer"
            value={activeShift ? formatMoney(shiftTotals.expectedCash) : "—"}
            detail={activeShift ? "Expected drawer amount" : "No open drawer"}
            accent
          />
        </div>
      </div>
    </section>
  );
}

function HeroDatum({
  label,
  value,
  detail,
  icon: Icon,
  small,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ElementType;
  small?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`group rounded-2xl border p-4 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/20 ${accent ? "border-emerald-300/20 bg-emerald-300/10" : "border-white/10 bg-white/[0.075]"}`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.17em] text-white/40">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-amber-200" />}
        <p
          className={`${small ? "text-base" : "text-xl sm:text-2xl"} truncate font-black tracking-tight text-white`}
        >
          {value}
        </p>
      </div>
      <p className="mt-1 truncate text-[10px] font-semibold text-white/50">
        {detail}
      </p>
    </div>
  );
}
