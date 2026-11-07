import type {
  InventoryStockChangeResult,
  ManagerInventoryBatch,
  ManagerInventoryItem,
} from "./inventoryApi";
import { formatInventoryQuantity } from "./inventoryMutationUi";

export function InventoryMutationSummary({
  item,
  batch,
  quantityChange,
  operationLabel,
  reason,
  compact = false,
}: {
  item: ManagerInventoryItem;
  batch?: ManagerInventoryBatch;
  quantityChange: number;
  operationLabel: string;
  reason?: string;
  compact?: boolean;
}) {
  const aggregateAfter = item.quantityOnHand + quantityChange;
  const batchAfter = batch ? batch.quantityOnHand + quantityChange : null;
  const isDecrease = quantityChange < 0;

  return (
    <section
      aria-label="Stock impact review"
      aria-live="polite"
      className={`rounded-xl border border-border bg-muted/35 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Stock impact
          </p>
          <p className="mt-1 text-sm font-black text-foreground">
            {item.itemName}
          </p>
        </div>
        {batch ? (
          <p className="text-xs font-semibold text-muted-foreground">
            Batch {batch.batchCode}
          </p>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">
            Standard stock
          </p>
        )}
      </div>

      {batch ? (
        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Selected batch
          </p>
          <p className="mt-1 text-xs font-semibold text-foreground">
            {formatInventoryQuantity(batch.quantityOnHand, item.unit)} →{" "}
            {formatInventoryQuantity(batchAfter ?? 0, item.unit)}
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <BalanceValue
          label="Current total"
          value={formatInventoryQuantity(item.quantityOnHand, item.unit)}
        />
        <BalanceValue
          label={operationLabel}
          value={`${quantityChange > 0 ? "+" : "−"}${formatInventoryQuantity(Math.abs(quantityChange), item.unit)}`}
          className={isDecrease ? "text-red-700" : "text-green-700"}
        />
        <BalanceValue
          label="After"
          value={formatInventoryQuantity(aggregateAfter, item.unit)}
        />
      </div>

      {reason ? (
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Reason:</span>{" "}
          {reason}
        </p>
      ) : null}
    </section>
  );
}

export function InventoryMutationResult({
  result,
  title,
  changeLabel,
}: {
  result: InventoryStockChangeResult;
  title: string;
  changeLabel: string;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-900"
    >
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 break-all text-[10px] text-green-800">
        {result.itemName} · Transaction {result.transactionId}
      </p>
      {result.batchQuantityBefore !== undefined &&
      result.batchQuantityAfter !== undefined ? (
        <p className="mt-2 text-xs font-semibold">
          Selected batch:{" "}
          {formatInventoryQuantity(result.batchQuantityBefore, result.unit)} →{" "}
          {formatInventoryQuantity(result.batchQuantityAfter, result.unit)}
        </p>
      ) : null}
      <div className="mt-2.5 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <BalanceValue
          label="Before"
          value={formatInventoryQuantity(result.quantityBefore, result.unit)}
        />
        <BalanceValue
          label={changeLabel}
          value={`${result.quantityChange > 0 ? "+" : "−"}${formatInventoryQuantity(Math.abs(result.quantityChange), result.unit)}`}
          className={
            result.quantityChange < 0 ? "text-red-700" : "text-green-700"
          }
        />
        <BalanceValue
          label="After"
          value={formatInventoryQuantity(result.quantityAfter, result.unit)}
        />
      </div>
    </section>
  );
}

function BalanceValue({
  label,
  value,
  className = "text-foreground",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-card/80 px-3 py-2 ring-1 ring-border/70">
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-black ${className}`}>{value}</p>
    </div>
  );
}
