import type { ManagerStockMovement } from "./inventoryApi";
import { formatInventoryQuantity } from "./inventoryMutationUi";
import { manilaDateTime, movementLabel } from "./StockPresentation";

function batchReferenceLabel(movement: ManagerStockMovement): string {
  if (movement.transactionType === "receiving") return "Receiving batches";
  if (movement.transactionType === "issuance") return "Consumed batches";
  return "Recorded batches";
}

export function StockMovementList({
  rows,
  showItem = true,
  onOpenReceipt,
}: {
  rows: ManagerStockMovement[];
  showItem?: boolean;
  onOpenReceipt?: (reference: string) => void;
}) {
  return (
    <ol
      className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
      aria-label="Stock movements"
    >
      {rows.map((movement) => (
        <li key={movement.id} className="min-w-0 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0 flex-1">
              <p className="break-words font-bold text-foreground [overflow-wrap:anywhere]">
                {showItem
                  ? movement.itemName
                  : movementLabel(movement.transactionType)}
              </p>
              <p className="text-sm text-foreground">
                {showItem
                  ? `${movementLabel(movement.transactionType)} · `
                  : ""}
                <time dateTime={movement.createdAt}>
                  {manilaDateTime.format(new Date(movement.createdAt))}
                </time>
              </p>
              <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {movement.performedByName}
              </p>
              {movement.referenceLabel ? <p className="mt-1 break-all text-xs font-semibold text-foreground">
                Reference: {movement.referenceLabel}
                {movement.transactionType === "receiving" && onOpenReceipt ? <button type="button" onClick={() => onOpenReceipt(movement.referenceLabel!)} className="ml-2 min-h-11 text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Open receipt</button> : null}
              </p> : null}
            </div>
            <strong
              className={`whitespace-nowrap text-base font-bold tabular-nums ${movement.quantityChange < 0 ? "text-foreground" : "text-emerald-800"}`}
            >
              {movement.quantityChange > 0 ? "+" : ""}
              {formatInventoryQuantity(movement.quantityChange, movement.unit)}
            </strong>
          </div>
          <details className="mt-1 text-sm">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Details
              <span className="sr-only"> for {movement.itemName} movement</span>
            </summary>
            <dl className="grid min-w-0 gap-x-5 gap-y-2 border-t border-border py-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Balance before
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatInventoryQuantity(
                    movement.quantityBefore,
                    movement.unit,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Balance after</dt>
                <dd className="font-semibold tabular-nums">
                  {formatInventoryQuantity(
                    movement.quantityAfter,
                    movement.unit,
                  )}
                </dd>
              </div>
              {movement.referenceLabel ? (
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Reference</dt>
                  <dd className="break-all">{movement.referenceLabel}</dd>
                </div>
              ) : null}
              {movement.reason ? (
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Reason</dt>
                  <dd className="break-words [overflow-wrap:anywhere]">
                    {movement.reason}
                  </dd>
                </div>
              ) : null}
              {movement.batches.length > 0 ? (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">
                    {batchReferenceLabel(movement)}
                  </dt>
                  <dd>
                    <ul className="space-y-0.5">
                      {movement.batches.map((batch) => (
                        <li
                          key={batch.batchCode}
                          className="break-all font-mono"
                        >
                          {batch.batchCode}:{" "}
                          {formatInventoryQuantity(
                            batch.quantity,
                            movement.unit,
                          )}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Movement ID</dt>
                <dd className="break-all font-mono text-xs">{movement.id}</dd>
              </div>
            </dl>
          </details>
        </li>
      ))}
    </ol>
  );
}
