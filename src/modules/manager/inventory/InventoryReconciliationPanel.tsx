import { AlertTriangle, CheckCircle, History, Scale } from "lucide-react";

import { Badge } from "@/components/common/Badge";
import { Table, Td } from "@/components/common/Table";
import type { BadgeVariant } from "@/types";
import type {
  InventoryReconciliationReport,
  InventoryReconciliationStatus,
} from "./inventoryReconciliation";

const STATUS_PRESENTATION: Record<
  InventoryReconciliationStatus,
  { label: string; variant: BadgeVariant; priority: number }
> = {
  mismatch: { label: "Mismatch", variant: "danger", priority: 0 },
  "insufficient-history": {
    label: "Insufficient history",
    variant: "warning",
    priority: 1,
  },
  matched: { label: "Reconciled", variant: "success", priority: 2 },
};

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatQuantity(value: number, unit: string): string {
  return `${quantityFormatter.format(value)} ${unit}`;
}

function formatVariance(value: number | null, unit: string): string {
  if (value === null) {
    return "—";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${quantityFormatter.format(value)} ${unit}`;
}

export function InventoryReconciliationPanel({
  report,
  isLoading,
  error,
}: {
  report: InventoryReconciliationReport | null;
  isLoading: boolean;
  error: string;
}) {
  const sortedRows = report
    ? [...report.rows].sort((left, right) => {
        const statusDifference =
          STATUS_PRESENTATION[left.status].priority -
          STATUS_PRESENTATION[right.status].priority;

        return statusDifference || left.itemName.localeCompare(right.itemName);
      })
    : [];

  return (
    <section
      aria-labelledby="inventory-reconciliation-heading"
      className="mt-4 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <h2
              id="inventory-reconciliation-heading"
              className="text-sm font-extrabold text-foreground"
            >
              Inventory reconciliation
            </h2>
            <p className="mt-0.5 max-w-3xl text-xs leading-5 text-muted-foreground">
              Read-only comparison of current stock, the latest transaction
              balance, and the recorded ledger. Ledger totals start from the
              earliest recorded quantity before; no zero opening balance is
              assumed.
            </p>
          </div>
        </div>

        {report ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="neutral">
              {report.returnedTransactionCount} ledger rows
            </Badge>
            <Badge variant="success">{report.matchedCount} reconciled</Badge>
            <Badge variant={report.mismatchCount > 0 ? "danger" : "neutral"}>
              {report.mismatchCount} mismatch
            </Badge>
            <Badge
              variant={
                report.insufficientHistoryCount > 0 ? "warning" : "neutral"
              }
            >
              {report.insufficientHistoryCount} incomplete
            </Badge>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Loading reconciliation data…
        </div>
      ) : error ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : !report || report.rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No inventory balances are available to reconcile.
        </div>
      ) : (
        <>
          {!report.hasCompleteTransactionHistory ? (
            <div className="m-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
              <History className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                The manager transaction read reached its{" "}
                {report.transactionLimit}
                -row limit. Latest balances can still be compared, but complete
                ledger totals are marked as insufficient history.
              </p>
            </div>
          ) : null}

          {report.mismatchCount > 0 ? (
            <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                {report.mismatchCount} item
                {report.mismatchCount === 1 ? "" : "s"} require review. This
                report does not change stock or repair transaction history.
              </p>
            </div>
          ) : report.insufficientHistoryCount === 0 ? (
            <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-800">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>All inventory balances reconcile with the recorded ledger.</p>
            </div>
          ) : null}

          <Table
            headers={[
              "Item",
              "Current",
              "Latest Transaction",
              "Ledger Total",
              "Variance",
              "Result",
            ]}
          >
            {sortedRows.map((row) => {
              const presentation = STATUS_PRESENTATION[row.status];

              return (
                <tr key={row.inventoryItemId}>
                  <Td>
                    <p className="text-sm font-bold text-foreground">
                      {row.itemName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.observedTransactionCount} transaction
                      {row.observedTransactionCount === 1 ? "" : "s"} read
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap text-sm font-bold tabular-nums text-foreground">
                    {formatQuantity(row.currentQuantity, row.unit)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {row.latestTransactionQuantity === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <>
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {formatQuantity(
                            row.latestTransactionQuantity,
                            row.unit,
                          )}
                        </p>
                        {row.latestTransactionAt ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateTimeFormatter.format(
                              new Date(row.latestTransactionAt),
                            )}
                          </p>
                        ) : null}
                      </>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-sm tabular-nums text-foreground">
                    {row.reconstructedLedgerQuantity === null
                      ? "Not available"
                      : formatQuantity(
                          row.reconstructedLedgerQuantity,
                          row.unit,
                        )}
                  </Td>
                  <Td
                    className={
                      "whitespace-nowrap text-sm font-bold tabular-nums " +
                      (row.varianceFromLatestTransaction === null ||
                      row.varianceFromLatestTransaction === 0
                        ? "text-muted-foreground"
                        : "text-red-700")
                    }
                  >
                    {formatVariance(
                      row.varianceFromLatestTransaction,
                      row.unit,
                    )}
                  </Td>
                  <Td className="max-w-[330px]">
                    <Badge variant={presentation.variant}>
                      {presentation.label}
                    </Badge>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {row.details}
                    </p>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </>
      )}
    </section>
  );
}
