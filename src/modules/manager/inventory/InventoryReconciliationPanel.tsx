import { Badge } from "@/components/common/Badge";
import { Table, Td } from "@/components/common/Table";
import type { BadgeVariant } from "@/types";
import type {
  InventoryAuditFinding,
  InventoryAuditFindingCode,
  InventoryAuditRun,
  InventoryAuditResult,
} from "./inventoryAuditApi";

const RESULT: Record<
  InventoryAuditResult,
  { label: string; variant: BadgeVariant }
> = {
  matched: { label: "Matched", variant: "success" },
  mismatch: { label: "Mismatch", variant: "danger" },
  incomplete: { label: "Incomplete", variant: "warning" },
};

const FINDING: Record<InventoryAuditFindingCode, string> = {
  matched: "Book and reconstructed ledger agree.",
  book_ledger_difference:
    "Recorded book stock differs from the reconstructed ledger.",
  no_history: "No movement history is available for this item.",
  ambiguous_order:
    "Movements share a timestamp, so their order cannot be proven.",
  invalid_arithmetic:
    "A movement's before, change and after quantities disagree.",
  sequence_gap: "Consecutive movement balances do not connect.",
};

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

function quantity(value: number, unit: string): string {
  return `${quantityFormatter.format(value)} ${unit}`;
}

function variance(row: InventoryAuditFinding): string | null {
  if (row.ledgerQuantity === null) return null;
  const value =
    Math.round((row.bookQuantity - row.ledgerQuantity) * 1000) / 1000;
  return `${value > 0 ? "+" : ""}${quantity(value, row.recordedUnit)}`;
}

function FindingStatus({ row }: { row: InventoryAuditFinding }) {
  const presentation = RESULT[row.result];
  return (
    <div>
      <Badge variant={presentation.variant}>{presentation.label}</Badge>
      {row.result !== "matched" ? (
        <details className="mt-0.5 text-xs text-muted-foreground">
          <summary className="min-h-11 cursor-pointer rounded text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Why {row.result}?
          </summary>
          <p className="max-w-xs leading-5">{FINDING[row.findingCode]}</p>
        </details>
      ) : null}
    </div>
  );
}

export function InventoryReconciliationPanel({
  run,
  rows,
  isLoading,
  error,
  onOpenItem,
}: {
  run: InventoryAuditRun | null;
  rows: InventoryAuditFinding[];
  isLoading: boolean;
  error: string;
  onOpenItem: (itemId: string) => void;
}) {
  return (
    <section
      aria-label="Inventory audit results"
      className="manager-audit-panel mt-4 overflow-hidden rounded-xl border border-border bg-card"
    >
      {isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Loading audit results…
        </p>
      ) : error ? (
        <p
          role="alert"
          className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : !run ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No saved audits yet. Run an audit to compare recorded stock with its
          ledger.
        </p>
      ) : (
        <>
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-foreground">
              {dateFormatter.format(new Date(run.completedAt))}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="success">{run.matchedCount} matched</Badge>
              <Badge variant={run.mismatchCount ? "danger" : "neutral"}>
                {run.mismatchCount} mismatch
              </Badge>
              <Badge variant={run.incompleteCount ? "warning" : "neutral"}>
                {run.incompleteCount} incomplete
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {run.totalItems} items evaluated · {run.movementRowsExamined}{" "}
              movement rows examined
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4">
              <details className="text-xs leading-5 text-muted-foreground">
                <summary className="min-h-11 cursor-pointer rounded text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  How results are determined
                </summary>
                <p className="max-w-3xl pb-1">
                  Matched means saved book stock agrees with a reconstructed
                  recorded ledger. Mismatch means those values differ.
                  Incomplete means movement evidence cannot support a reliable
                  ledger total. Unreceived requests are excluded from stock.
                  Item names, units and quantities below are snapshots from this
                  run.
                </p>
              </details>
              <details className="text-xs leading-5 text-muted-foreground">
                <summary className="min-h-11 cursor-pointer rounded text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  Audit details
                </summary>
                <dl className="pb-1 [overflow-wrap:anywhere]">
                  <div>
                    <dt className="inline font-medium">Audit ID: </dt>
                    <dd className="inline">{run.id}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Manager ID: </dt>
                    <dd className="inline">{run.performedBy}</dd>
                  </div>
                </dl>
              </details>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              This audit evaluated no inventory items.
            </p>
          ) : (
            <>
              <div
                className="space-y-2 px-3 py-2 sm:hidden"
                aria-label="Audit items"
              >
                {rows.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-lg border border-border p-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenItem(row.inventoryItemId)}
                        aria-label={`View item details for ${row.itemName}`}
                        className="min-h-11 min-w-0 flex-1 break-words rounded text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [overflow-wrap:anywhere]"
                      >
                        {row.itemName}
                      </button>
                      <FindingStatus row={row} />
                    </div>
                    <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Book</dt>
                        <dd className="tabular-nums">
                          {quantity(row.bookQuantity, row.recordedUnit)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Ledger
                        </dt>
                        <dd className="tabular-nums">
                          {row.ledgerQuantity === null ? (
                            <span aria-label="Ledger unavailable">—</span>
                          ) : (
                            quantity(row.ledgerQuantity, row.recordedUnit)
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Variance
                        </dt>
                        <dd className="tabular-nums">
                          {variance(row) ?? (
                            <span aria-label="Variance unavailable">—</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Movements
                        </dt>
                        <dd className="tabular-nums">{row.movementCount}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="manager-audit-results-table hidden sm:block">
                <Table
                  headers={[
                    "Item",
                    "Book",
                    "Ledger",
                    "Variance",
                    "Movements",
                    "Result",
                  ]}
                >
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <button
                          type="button"
                          onClick={() => onOpenItem(row.inventoryItemId)}
                          aria-label={`View item details for ${row.itemName}`}
                          className="min-h-11 max-w-full break-words rounded text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [overflow-wrap:anywhere]"
                        >
                          {row.itemName}
                        </button>
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {quantity(row.bookQuantity, row.recordedUnit)}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {row.ledgerQuantity === null ? (
                          <span aria-label="Ledger unavailable">—</span>
                        ) : (
                          quantity(row.ledgerQuantity, row.recordedUnit)
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {variance(row) ?? (
                          <span aria-label="Variance unavailable">—</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {row.movementCount}
                      </Td>
                      <Td>
                        <FindingStatus row={row} />
                      </Td>
                    </tr>
                  ))}
                </Table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
