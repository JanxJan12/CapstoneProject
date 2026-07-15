import {
  CheckCircle2,
  Printer,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatDateTime, formatMoney } from "../constants";
import type { CashierShift, ShiftTotals } from "../types";
import {
  CashierButton,
  CashierDialogContent,
  StatusBadge,
  Toast,
} from "../components";

export function ShiftReportDialog({
  shift,
  totals,
  open,
  onClose,
}: {
  shift?: CashierShift;
  totals?: ShiftTotals;
  open: boolean;
  onClose: () => void;
}) {
  if (!shift || !totals) return null;
  const variance = shift.variance ?? 0;
  const outcome =
    shift.actualCash === undefined
      ? "In progress"
      : variance === 0
        ? "Balanced"
        : variance > 0
          ? "Over"
          : "Short";
  const OutcomeIcon =
    variance === 0 ? CheckCircle2 : variance > 0 ? TrendingUp : TrendingDown;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <CashierDialogContent className="max-w-2xl bg-[#fbf8f4]">
        <DialogHeader>
          <DialogTitle>Printable shift report</DialogTitle>
          <DialogDescription>
            Generated from the recorded shift, transaction, payment, and
            approval records.
          </DialogDescription>
        </DialogHeader>

        <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_14px_35px_rgba(67,42,23,0.1)]">
          <header className="bg-gradient-to-r from-primary to-orange-600 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-widest">
                  RRJ Food-House
                </p>
                <p className="mt-0.5 text-[10px] text-white/70">
                  Official cashier shift report
                </p>
              </div>
              <StatusBadge status={shift.status} />
            </div>
          </header>

          <div className="space-y-5 p-5">
            <section className="grid gap-3 text-xs sm:grid-cols-2">
              <ReportLine label="Shift" value={shift.id} mono />
              <ReportLine label="Terminal" value={shift.terminal} />
              <ReportLine label="Cashier" value={shift.cashierName} />
              <ReportLine
                label="Started"
                value={formatDateTime(shift.startedAt)}
              />
              <ReportLine
                label="Ended"
                value={
                  shift.endedAt ? formatDateTime(shift.endedAt) : "In progress"
                }
              />
              <ReportLine
                label="Manager approval"
                value={shift.managerApprovedBy ?? "Not yet approved"}
              />
            </section>

            <section className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs sm:grid-cols-4">
              <ReportMetric
                label="Opening cash"
                value={formatMoney(shift.openingCash)}
              />
              <ReportMetric
                label="Expected cash"
                value={formatMoney(totals.expectedCash)}
              />
              <ReportMetric
                label="Actual cash"
                value={
                  shift.actualCash !== undefined
                    ? formatMoney(shift.actualCash)
                    : "Not counted"
                }
              />
              <div>
                <p className="text-muted-foreground">Variance</p>
                <p className="mt-1 flex items-center gap-1.5 font-black">
                  <OutcomeIcon className="h-3.5 w-3.5 text-primary" />
                  {outcome} · {formatMoney(variance)}
                </p>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Financial summary
              </h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-3">
                <ReportLine
                  label="Cash sales"
                  value={formatMoney(totals.cashSales)}
                />
                <ReportLine
                  label="GCash summary"
                  value={formatMoney(totals.gcashSales)}
                />
                <ReportLine
                  label="Refund summary"
                  value={formatMoney(totals.refunds)}
                />
                <ReportLine
                  label="Discount summary"
                  value={formatMoney(totals.discounts)}
                />
                <ReportLine
                  label="Void summary"
                  value={formatMoney(totals.voids)}
                />
                <ReportLine
                  label="Transactions"
                  value={String(totals.transactionCount)}
                />
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-3 text-xs">
                <p className="font-black">Variance reason</p>
                <p className="mt-1 text-muted-foreground">
                  {shift.varianceReason ??
                    (variance === 0 ? "No variance" : "Not recorded")}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3 text-xs">
                <p className="font-black">Cashier notes</p>
                <p className="mt-1 text-muted-foreground">
                  {shift.notes ?? "No notes"}
                </p>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Audit trail
              </h3>
              <ol className="space-y-3 border-l border-border pl-5 text-xs">
                <AuditLine
                  title="Shift opened"
                  detail={`${formatDateTime(shift.startedAt)} · ${shift.cashierName}`}
                />
                {shift.managerApprovedAt && (
                  <AuditLine
                    icon={ShieldCheck}
                    title="Settlement approved"
                    detail={`${formatDateTime(shift.managerApprovedAt)} · ${shift.managerApprovedBy}`}
                  />
                )}
                {shift.endedAt && (
                  <AuditLine
                    title={`Shift closed ${outcome.toLowerCase()}`}
                    detail={`${formatDateTime(shift.endedAt)} · Pending payments at close: ${shift.pendingPaymentCountAtClose ?? 0}`}
                  />
                )}
              </ol>
            </section>
          </div>
        </article>

        <DialogFooter>
          <CashierButton
            variant="secondary"
            onClick={() => {
              window.print();
              Toast.success("Shift report sent to the print dialog.");
            }}
          >
            <Printer className="h-4 w-4" />
            Print shift report
          </CashierButton>
          <CashierButton onClick={onClose}>Close report</CashierButton>
        </DialogFooter>
      </CashierDialogContent>
    </Dialog>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function ReportLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <strong className={mono ? "font-mono" : ""}>{value}</strong>
    </div>
  );
}

function AuditLine({
  icon: Icon = CheckCircle2,
  title,
  detail,
}: {
  icon?: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-50 text-primary ring-2 ring-white">
        <Icon className="h-2.5 w-2.5" />
      </span>
      <p className="font-black">{title}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>
    </li>
  );
}
