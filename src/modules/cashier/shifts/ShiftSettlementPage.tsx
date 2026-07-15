import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Percent,
  PlayCircle,
  Printer,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  StopCircle,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { calculateShiftTotals } from "../services/cashierService";
import { formatDateTime, formatMoney } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { CashierShift, ShiftClosureInput } from "../types";
import {
  CashierButton,
  CashierStatusBadge,
  EmptyState,
  ErrorBanner,
  PageHeading,
  SectionHeading,
} from "../components/CashierUI";
import { EndShiftDialog } from "./EndShiftDialog";
import { ShiftReportDialog } from "./ShiftReportDialog";
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

const varianceOutcome = (shift: CashierShift) => {
  if (shift.actualCash === undefined || shift.variance === undefined)
    return "In progress";
  if (shift.variance === 0) return "Balanced";
  return shift.variance > 0 ? "Over" : "Short";
};

export function ShiftSettlementPage() {
  const { state, activeShift, shiftTotals, startShift, endShift } =
    useCashierStore();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [reportShiftId, setReportShiftId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pendingPayments = state.payments.filter(
    (payment) => payment.status === "Pending",
  );

  const handleStart = async (openingCash: number, terminal: string) => {
    setLoading(true);
    setError("");
    try {
      await startShift(openingCash, terminal);
      setStartOpen(false);
      toast.success("Shift started", {
        description:
          "The opening cash and terminal were recorded in the audit trail.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start shift.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async (input: ShiftClosureInput) => {
    setLoading(true);
    setError("");
    try {
      await endShift(input);
      setEndOpen(false);
      toast.success("Shift settled and closed", {
        description:
          "The manager approval and closing audit record were saved.",
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
  const reportShift = state.shifts.find((shift) => shift.id === reportShiftId);
  const reportTotals = reportShift
    ? calculateShiftTotals(state, reportShift.id)
    : undefined;
  const latestOutcome = latest ? varianceOutcome(latest) : "In progress";

  return (
    <div className="cashier-page">
      <PageHeading
        title="Shift Settlement"
        description="Complete cashier opening, drawer count, manager approval, variance review, and closing audit workflow"
        actions={
          activeShift ? (
            <CashierButton
              variant="danger"
              title={
                pendingPayments.length
                  ? "Resolve all pending payments before ending the shift"
                  : undefined
              }
              onClick={() => {
                if (pendingPayments.length) {
                  toast.warning("Shift closure is blocked", {
                    description: `Resolve ${pendingPayments.length} pending payment${pendingPayments.length === 1 ? "" : "s"} before closing the drawer.`,
                  });
                }
                setEndOpen(true);
              }}
            >
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

      {activeShift && pendingPayments.length > 0 && (
        <section
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-black">Shift closure blocked</p>
              <p className="mt-1 text-[11px]">
                {pendingPayments.length} pending payment
                {pendingPayments.length === 1 ? "" : "s"} must be verified or
                rejected first.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest">
            {pendingPayments.length} unresolved
          </span>
        </section>
      )}

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
                  {!activeShift && <ShiftOutcomeBadge shift={latest} />}
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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
            <Metric
              icon={Banknote}
              label="Opening Cash"
              value={formatMoney(latest.openingCash)}
              detail="Recorded when shift opened"
            />
            <Metric
              icon={ReceiptText}
              label="Expected Cash"
              value={formatMoney(totals.expectedCash)}
              detail={`Cash sales ${formatMoney(totals.cashSales)} · cash refunds ${formatMoney(totals.cashRefunds)}`}
            />
            <Metric
              icon={Banknote}
              label="Actual Cash Count"
              value={
                latest.actualCash !== undefined
                  ? formatMoney(latest.actualCash)
                  : "Not counted"
              }
              detail="Physical drawer count"
            />
            <Metric
              icon={
                latestOutcome === "Short"
                  ? TrendingDown
                  : latestOutcome === "Over"
                    ? TrendingUp
                    : CheckCircle2
              }
              label="Variance"
              value={
                latest.variance !== undefined
                  ? formatMoney(latest.variance)
                  : "Pending count"
              }
              detail={latestOutcome}
              tone={
                latestOutcome === "Short"
                  ? "red"
                  : latestOutcome === "Over"
                    ? "blue"
                    : latestOutcome === "Balanced"
                      ? "green"
                      : "neutral"
              }
            />
            <Metric
              icon={CreditCard}
              label="GCash Summary"
              value={formatMoney(totals.gcashSales)}
              detail="Verified digital payments"
            />
            <Metric
              icon={RotateCcw}
              label="Refund Summary"
              value={formatMoney(totals.refunds)}
              detail={`${formatMoney(totals.cashRefunds)} returned from drawer`}
            />
            <Metric
              icon={Percent}
              label="Discount Summary"
              value={formatMoney(totals.discounts)}
              detail="Completed transactions"
            />
            <Metric
              icon={XCircle}
              label="Void Summary"
              value={formatMoney(totals.voids)}
              detail="Retained audit records"
            />
            <Metric
              icon={FileText}
              label="Transactions Count"
              value={String(totals.transactionCount)}
              detail={`${totals.ordersProcessed} orders processed`}
            />
          </div>

          {!activeShift && (
            <section className="rrj-card bg-gradient-to-r from-white to-amber-50/30 p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Manager approval
                  </p>
                  <p className="mt-2 text-sm font-black">
                    {latest.managerApprovedBy ?? "Approval not recorded"}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {latest.managerApprovedAt
                      ? formatDateTime(latest.managerApprovedAt)
                      : "Historical shift record"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Closing audit notes
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {latest.varianceReason ??
                      (latestOutcome === "Balanced"
                        ? "No variance"
                        : "Reason not recorded")}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {latest.notes || "No cashier notes"}
                  </p>
                </div>
                <CashierButton
                  variant="secondary"
                  onClick={() => setReportShiftId(latest.id)}
                >
                  <Printer className="h-4 w-4" />
                  Generate shift report
                </CashierButton>
              </div>
            </section>
          )}
        </>
      ) : (
        <EmptyState
          icon={Banknote}
          title="No shift records yet"
          description="Start a shift to record opening cash and begin the cashier audit trail."
        />
      )}

      <section className="rrj-card overflow-hidden">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <SectionHeading
            title="Settlement audit trail"
            description="Drawer counts, variance outcomes, approvals, and printable reports"
          />
        </div>
        <div className="overflow-x-auto">
          <table
            className="rrj-table w-full min-w-[1250px]"
            aria-label="Cashier settlement audit trail"
          >
            <thead>
              <tr className="bg-gradient-to-r from-[#f7f1ea] to-[#fbf8f4]">
                {[
                  "Shift",
                  "Cashier",
                  "Opening",
                  "Expected",
                  "Actual",
                  "Variance",
                  "Outcome",
                  "Manager Approval",
                  "Status",
                  "Report",
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
                  <td className="px-3 py-3">
                    <p className="font-mono text-[10px] font-black text-primary">
                      {shift.id}
                    </p>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {shift.terminal}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-bold">{shift.cashierName}</td>
                  <td className="px-3 py-3 font-bold">
                    {formatMoney(shift.openingCash)}
                  </td>
                  <td className="px-3 py-3 font-bold">
                    {shift.expectedCash !== undefined
                      ? formatMoney(shift.expectedCash)
                      : "In progress"}
                  </td>
                  <td className="px-3 py-3 font-bold">
                    {shift.actualCash !== undefined
                      ? formatMoney(shift.actualCash)
                      : "—"}
                  </td>
                  <td className="px-3 py-3 font-bold">
                    {shift.variance !== undefined
                      ? formatMoney(shift.variance)
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <ShiftOutcomeBadge shift={shift} />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-bold">
                      {shift.managerApprovedBy ?? "—"}
                    </p>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {shift.managerApprovedAt
                        ? formatDateTime(shift.managerApprovedAt)
                        : "Not recorded"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <CashierStatusBadge status={shift.status} />
                  </td>
                  <td className="px-3 py-3">
                    <CashierButton
                      variant="secondary"
                      size="sm"
                      disabled={!shift.endedAt}
                      onClick={() => setReportShiftId(shift.id)}
                    >
                      <Printer className="h-3 w-3" />
                      Print
                    </CashierButton>
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
          pendingPaymentCount={pendingPayments.length}
          onOpenChange={setEndOpen}
          onConfirm={handleEnd}
        />
      )}
      <ShiftReportDialog
        shift={reportShift}
        totals={reportTotals}
        open={Boolean(reportShift)}
        onClose={() => setReportShiftId(undefined)}
      />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "green" | "blue" | "red";
}) {
  const tones = {
    neutral: "from-amber-50 to-orange-50 text-primary ring-primary/10",
    green: "from-emerald-50 to-green-50 text-emerald-700 ring-emerald-200",
    blue: "from-blue-50 to-sky-50 text-blue-700 ring-blue-200",
    red: "from-red-50 to-rose-50 text-red-700 ring-red-200",
  };
  return (
    <div className="rrj-card rrj-card-hover group p-4">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ring-1 transition-transform group-hover:scale-105 ${tones[tone]}`}
      >
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

function ShiftOutcomeBadge({ shift }: { shift: CashierShift }) {
  const outcome = varianceOutcome(shift);
  const Icon =
    outcome === "Balanced"
      ? CheckCircle2
      : outcome === "Over"
        ? TrendingUp
        : outcome === "Short"
          ? TrendingDown
          : Clock3;
  const tone =
    outcome === "Balanced"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : outcome === "Over"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : outcome === "Short"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {outcome}
    </span>
  );
}
