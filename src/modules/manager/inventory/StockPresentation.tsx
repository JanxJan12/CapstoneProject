import type {
  ManagerInventoryStock,
  ManagerStockMovement,
} from "./inventoryApi";
import { formatInventoryQuantity } from "./inventoryMutationUi";

export const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
export const manilaDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function stockStatus(stock: ManagerInventoryStock): string {
  if (!stock.isActive) return "Inactive";
  if (stock.usableQuantity <= 0) return "Usable out of stock";
  if (stock.usableQuantity <= stock.reorderLevel) return "Low usable stock";
  return "Usable stock available";
}

export function movementLabel(
  type: ManagerStockMovement["transactionType"],
): string {
  return {
    receiving: "Receiving",
    restock: "Restock",
    issuance: "Sale / Issuance",
    waste: "Waste",
    adjustment: "Adjustment",
    opening_balance: "Opening Balance",
  }[type];
}

export function StockQuantities({ stock }: { stock: ManagerInventoryStock }) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-muted/50 p-3">
        <dt className="text-xs text-muted-foreground">Physical / on hand</dt>
        <dd className="mt-1 font-bold tabular-nums">
          {formatInventoryQuantity(stock.physicalQuantity, stock.unit)}
        </dd>
      </div>
      <div className="rounded-xl bg-emerald-50 p-3">
        <dt className="text-xs text-emerald-800">Usable</dt>
        <dd className="mt-1 font-bold tabular-nums text-emerald-900">
          {formatInventoryQuantity(stock.usableQuantity, stock.unit)}
        </dd>
      </div>
      {stock.batchConsumptionEnabled && stock.expiryRequired ? (
        <div className="rounded-xl bg-amber-50 p-3">
          <dt className="text-xs text-amber-800">Expired, still physical</dt>
          <dd className="mt-1 font-bold tabular-nums text-amber-900">
            {formatInventoryQuantity(stock.expiredQuantity, stock.unit)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
