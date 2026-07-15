import { useState } from "react";
import {
  Banknote,
  Clock3,
  CreditCard,
  FileText,
  Percent,
  PlayCircle,
  Printer,
  ReceiptText,
  RotateCcw,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { calculateShiftTotals } from "../services/cashierService";
import { formatDateTime, formatMoney } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import {
  CashierButton,
  CashierStatusBadge,
  EmptyState,
  ErrorBanner,
  PageHeading,
  SectionHeading,
} from "../components/CashierUI";
import { EndShiftDialog } from "./EndShiftDialog";
import { StartShiftDialog } from "./StartShiftDialog";

const duration = (start: string, end?: string) => {
  const minutes = Math.max(
    0,
    Math.floor(
      ((end ? new Date(end).getTime() : Date.now()) -
        new Date(start).getTime()) /
        60_000,
    ),
  );
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export function ShiftSettlementPage() {
  const { state, activeShift, shiftTotals, startShift, endShift } =
    useCashierStore();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleStart = async (openingCash: number, terminal: string) => {
    setLoading(true);
    setError("");
    try {
      await startShift(openingCash, terminal);
      setStartOpen(false);
      toast.success("Shift started", {
        description: "The cash drawer is open for new transactions.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start shift.",
      );
    } finally {
      setLoading(false);
    }
  };
  const handleEnd = async (actualCash: number, notes?: string) => {
    setLoading(true);
    setError("");
    try {
      await endShift(actualCash, notes);
      setEndOpen(false);
      toast.success("Shift settled", {
        description:
          "New transactions are blocked until another shift is started.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to settle shift.",
      );
    } finally {
      setLoading(false);
    }
  };
  const latest = activeShift ?? state.shifts[0];
  const totals = latest ? calculateShiftTotals(state, latest.id) : shiftTotals;
  return (
    <div className="cashier-page">
      <PageHeading
        title="Shift Settlement"
        description="Open, count, and close the cashier drawer with a preserved audit record"
        actions={
          activeShift ? (
            <CashierButton variant="danger" onClick={() => setEndOpen(true)}>
              <StopCircle className="h-4 w-4" />
              End shift
            </CashierButton>
          ) : (
            <CashierButton onClick={() => setStartOpen(true)}>
              <PlayCircle className="h-4 w-4" />
              Start new shift
            </CashierButton>
          )
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => setError("")} />}
      {latest ? (
        <>
          <section
            className={`relative overflow-hidden rounded-[20px] border shadow-[0_14px_35px_rgba(67,42,23,0.08)] ${activeShift ? "border-orange-300/20 bg-gradient-to-r from-[#2b1b12] to-[#4a2817] text-white" : "border-border bg-card"}`}
          >
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`font-mono text-sm font-black ${activeShift ? "text-orange-200" : "text-primary"}`}
                  >
                    {latest.id}
                  </p>
                  <CashierStatusBadge status={latest.status} />
                </div>
                <p className="mt-2 text-xl font-black tracking-tight">
                  {latest.cashierName}
                </p>
                <p
                  className={`mt-1 text-xs ${activeShift ? "text-white/55" : "text-muted-foreground"}`}
                >
                  {latest.terminal} · Started {formatDateTime(latest.startedAt)}
                </p>
              </div>
              <div
                className={`rounded-2xl border px-5 py-4 ${activeShift ? "border-white/15 bg-white/10 backdrop-blur-sm" : "border-border bg-white"}`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${activeShift ? "text-white/45" : "text-muted-foreground"}`}
                >
                  Shift duration
                </p>
                <p className="mt-1 flex items-center gap-2 text-xl font-black">
                  <Clock3 className="h-5 w-5 text-primary" />
                  {duration(latest.startedAt, latest.endedAt)}
                </p>
              </div>
            </div>
          </section>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              icon={Banknote}
              label="Cash sales"
              value={formatMoney(totals.cashSales)}
              detail={`Opening cash ${formatMoney(latest.openingCash)}`}
            />
            <Metric
              icon={CreditCard}
              label="GCash sales"
              value={formatMoney(totals.gcashSales)}
              detail="Verified digital payments"
            />
            <Metric
              icon={RotateCcw}
              label="Refunds & voids"
              value={formatMoney(totals.refunds + totals.voids)}
              detail={`${formatMoney(totals.refunds)} refunds`}
            />
            <Metric
              icon={Percent}
              label="Discounts"
              value={formatMoney(totals.discounts)}
              detail="Senior Citizen and PWD"
            />
            <Metric
              icon={ReceiptText}
              label="Expected drawer"
              value={formatMoney(totals.expectedCash)}
              detail="Opening + cash − refunds"
            />
            <Metric
              icon={FileText}
              label="Transactions"
              value={String(totals.transactionCount)}
              detail={`${totals.ordersProcessed} orders processed`}
            />
            {latest.actualCash !== undefined && (
              <Metric
                icon={Banknote}
                label="Actual cash"
                value={formatMoney(latest.actualCash)}
                detail={`Variance ${formatMoney(latest.variance ?? 0)}`}
              />
            )}
          </div>
          {!activeShift && (
            <section className="rrj-card bg-gradient-to-r from-white to-amber-50/30 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-black">
                    Printable shift summary
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Closed{" "}
                    {latest.endedAt ? formatDateTime(latest.endedAt) : "—"} ·{" "}
                    {latest.notes || "No settlement notes"}
                  </p>
                </div>
                <CashierButton
                  variant="secondary"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Print shift summary
                </CashierButton>
              </div>
            </section>
          )}
        </>
      ) : (
        <EmptyState
          icon={Banknote}
          title="No shift records yet"
          description="Start a shift to open the cash drawer and begin recording transactions."
        />
      )}
      <section className="rrj-card overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <SectionHeading
            title="Settlement history"
            description="Auditable drawer sessions, counts, and variance outcomes"
          />
        </div>
        <div className="overflow-x-auto">
          <table
            className="rrj-table w-full min-w-[720px]"
            aria-label="Cashier settlement history"
          >
            <thead>
              <tr className="bg-gradient-to-r from-[#f7f1ea] to-[#fbf8f4]">
                {[
                  "Shift",
                  "Cashier",
                  "Terminal",
                  "Started",
                  "Ended",
                  "Expected",
                  "Variance",
                  "Status",
                ].map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-3 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {state.shifts.map((shift) => (
                <tr key={shift.id} className="text-xs">
                  <td className="px-3 py-3 font-mono text-[10px] text-primary">
                    {shift.id}
                  </td>
                  <td className="px-3 py-3 font-bold">{shift.cashierName}</td>
                  <td className="px-3 py-3">{shift.terminal}</td>
                  <td className="px-3 py-3 text-[10px] text-muted-foreground">
                    {formatDateTime(shift.startedAt)}
                  </td>
                  <td className="px-3 py-3 text-[10px] text-muted-foreground">
                    {shift.endedAt ? formatDateTime(shift.endedAt) : "—"}
                  </td>
                  <td className="px-3 py-3 font-bold">
                    {shift.expectedCash !== undefined
                      ? formatMoney(shift.expectedCash)
                      : "In progress"}
                  </td>
                  <td className="px-3 py-3 font-bold">
                    {shift.variance !== undefined
                      ? formatMoney(shift.variance)
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <CashierStatusBadge status={shift.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <StartShiftDialog
        open={startOpen}
        loading={loading}
        cashierName={state.cashier.name}
        defaultTerminal={state.cashier.terminal}
        onOpenChange={setStartOpen}
        onConfirm={handleStart}
      />
      {activeShift && (
        <EndShiftDialog
          open={endOpen}
          loading={loading}
          totals={shiftTotals}
          onOpenChange={setEndOpen}
          onConfirm={handleEnd}
        />
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rrj-card rrj-card-hover group p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 text-primary ring-1 ring-primary/10 transition-transform group-hover:scale-105">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}
