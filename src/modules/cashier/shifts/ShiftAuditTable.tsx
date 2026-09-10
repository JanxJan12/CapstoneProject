import { Printer } from "lucide-react";
import { CashierButton, SectionHeading, StatusBadge } from "../components";
import { formatDateTime, formatMoney } from "../constants";
import type { CashierShift } from "../types";
import { ShiftOutcomeBadge } from "./ShiftOutcomeBadge";

const HEADERS = [
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
] as const;

export function ShiftAuditTable({
  shifts,
  onReport,
}: {
  shifts: CashierShift[];
  onReport: (shiftId: string) => void;
}) {
  return (
    <section className="rrj-card overflow-hidden">
      <div className="border-b border-border/80 bg-gradient-to-r from-amber-50/40 to-transparent px-4 py-3.5 sm:px-5">
        <SectionHeading
          title="Settlement Audit Trail"
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
              {HEADERS.map((header) => (
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
            {shifts.map((shift) => (
              <tr key={shift.id} className="text-xs hover:bg-muted/20">
                <td className="px-3 py-3">
                  <p
                    className="max-w-[150px] truncate font-mono text-[10px] font-black text-primary"
                    title={shift.id}
                  >
                    {shift.id}
                  </p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {shift.terminal}
                  </p>
                </td>
                <td className="px-3 py-3 font-bold">{shift.cashierName}</td>
                <MoneyCell value={shift.openingCash} />
                <MoneyCell value={shift.expectedCash} pending="In progress" />
                <MoneyCell value={shift.actualCash} />
                <MoneyCell value={shift.variance} />
                <td className="px-3 py-3">
                  <ShiftOutcomeBadge shift={shift} />
                </td>
                <td className="px-3 py-3">
                  <p className="font-bold">{shift.managerApprovedBy ?? "—"}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {shift.managerApprovedAt
                      ? formatDateTime(shift.managerApprovedAt)
                      : "Not recorded"}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={shift.status} />
                </td>
                <td className="px-3 py-3">
                  <CashierButton
                    variant="secondary"
                    size="sm"
                    disabled={!shift.endedAt}
                    onClick={() => onReport(shift.id)}
                  >
                    <Printer className="h-3 w-3" aria-hidden="true" /> Print
                  </CashierButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MoneyCell({
  value,
  pending = "—",
}: {
  value?: number;
  pending?: string;
}) {
  return (
    <td className="px-3 py-3 font-bold">
      {value !== undefined ? formatMoney(value) : pending}
    </td>
  );
}
