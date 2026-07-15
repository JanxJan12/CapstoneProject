import { useEffect, useState } from "react";
import {
  Banknote,
  Circle,
  Clock3,
  LogOut,
  MapPin,
  MonitorSmartphone,
  UserRound,
} from "lucide-react";
import { formatDateTime, formatMoney } from "../constants";
import { CashierButton } from "../components/CashierUI";
import { useCashierStore } from "../hooks/CashierStore";

const shiftDuration = (startedAt?: string) => {
  if (!startedAt) return "—";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000),
  );
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

export function ShiftSummaryHero({
  onEndShift,
}: {
  onEndShift: () => void;
}) {
  const { state, activeShift, shiftTotals } = useCashierStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const actualCash = activeShift?.actualCash;
  const variance =
    actualCash === undefined ? undefined : actualCash - shiftTotals.expectedCash;
  const drawerStatus = !activeShift
    ? "Shift not started"
    : variance === undefined
      ? "Count pending"
      : variance === 0
        ? "Balanced"
        : "Variance detected";

  return (
    <section className="cashier-compact-hero relative overflow-hidden rounded-[20px] border border-orange-300/15 bg-[#2b1b12] text-white shadow-[0_18px_42px_rgba(55,31,16,0.18)] ring-1 ring-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(249,115,22,0.25),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%)]" />
      <div className="relative p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${activeShift ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}`}
              >
                <Circle
                  className={`h-2 w-2 ${activeShift ? "fill-emerald-300 text-emerald-300" : "fill-amber-300 text-amber-300"}`}
                />
                {activeShift ? "Shift Active" : "Shift not started"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/65">
                <MapPin className="h-3 w-3" /> Front Counter
              </span>
            </div>
            <h1 className="mt-3 text-[22px] font-black leading-tight tracking-[-0.035em] sm:text-[26px]">
              Cashier operations at a glance
            </h1>
            <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-5 text-white/55">
              Payment, kitchen, handoff, delivery, and drawer signals from the
              same live shift records.
            </p>
          </div>
          <CashierButton
            variant="danger"
            className="min-h-12 shrink-0 border border-red-300/25 bg-red-500/15 from-red-500/15 to-red-600/10 text-red-50 shadow-none hover:bg-red-500/25 hover:from-red-500/25 hover:to-red-600/15"
            disabled={!activeShift}
            onClick={onEndShift}
          >
            <LogOut className="h-4 w-4" /> End Shift
          </CashierButton>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <HeroDatum
            icon={Clock3}
            label="Current time"
            value={now.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}
            detail={now.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <HeroDatum
            icon={Clock3}
            label="Shift duration"
            value={shiftDuration(activeShift?.startedAt)}
            detail={
              activeShift
                ? `Started ${formatDateTime(activeShift.startedAt)}`
                : "No active shift"
            }
          />
          <HeroDatum
            icon={UserRound}
            label="Cashier on duty"
            value={state.cashier.name}
            detail={activeShift?.id ?? "No shift ID"}
          />
          <HeroDatum
            icon={MonitorSmartphone}
            label="Terminal name"
            value={activeShift?.terminal ?? state.cashier.terminal}
            detail="Front Counter"
          />
          <HeroDatum
            icon={Banknote}
            label="Expected drawer"
            value={activeShift ? formatMoney(shiftTotals.expectedCash) : "—"}
            detail={`Opening cash ${formatMoney(activeShift?.openingCash ?? 0)}`}
            accent
          />
          <HeroDatum
            icon={Banknote}
            label="Actual drawer"
            value={
              actualCash === undefined ? "Not counted" : formatMoney(actualCash)
            }
            detail={drawerStatus}
            warning={variance !== undefined && variance !== 0}
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
  accent,
  warning,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`min-h-[112px] rounded-2xl border p-3.5 backdrop-blur-md ${warning ? "border-red-300/25 bg-red-400/10" : accent ? "border-emerald-300/20 bg-emerald-300/10" : "border-white/10 bg-white/[0.07]"}`}
    >
      <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-white/42">
        <Icon className="h-3.5 w-3.5 text-amber-200" /> {label}
      </p>
      <p className="mt-2 break-words text-[15px] font-black leading-5 tracking-tight text-white">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-[9px] font-semibold leading-4 text-white/50">
        {detail}
      </p>
    </div>
  );
}
