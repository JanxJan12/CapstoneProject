import type {
  ManagerInventoryBatchContext,
  ManagerInventoryItem,
} from "./inventoryApi";
import { formatInventoryQuantity } from "./inventoryMutationUi";

export function InventoryItemSelect({
  id,
  items,
  selectedItemId,
  selectedItem,
  batchContext,
  onChange,
  disabled,
  isLoading,
}: {
  id: string;
  items: ManagerInventoryItem[];
  selectedItemId: string;
  selectedItem: ManagerInventoryItem | undefined;
  batchContext: ManagerInventoryBatchContext | undefined;
  onChange: (id: string) => void;
  disabled: boolean;
  isLoading: boolean;
}) {
  const descriptionId = `${id}-description`;

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        Inventory item <span className="text-red-500">*</span>
      </label>
      <select
        id={id}
        value={selectedItemId}
        disabled={disabled}
        aria-describedby={selectedItem ? descriptionId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">
          {isLoading ? "Loading inventory…" : "Select inventory item…"}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id} disabled={!item.isActive}>
            {item.itemName} —{" "}
            {formatInventoryQuantity(item.quantityOnHand, item.unit)}
            {!item.isActive ? " (Inactive)" : ""}
          </option>
        ))}
      </select>

      {selectedItem ? (
        <div
          id={descriptionId}
          className="mt-1 grid gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <div className="min-w-0">
            <p className="break-words font-bold text-foreground [overflow-wrap:anywhere]">
              {selectedItem.itemName}
            </p>
            <p className="mt-1 text-muted-foreground">
              {batchContext?.batchConsumptionEnabled
                ? "Batch-tracked stock"
                : "Standard stock"}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Total item stock
            </p>
            <p className="mt-0.5 text-base font-black text-foreground">
              {formatInventoryQuantity(
                selectedItem.quantityOnHand,
                selectedItem.unit,
              )}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
