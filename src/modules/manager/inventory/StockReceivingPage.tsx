import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, CheckCircle } from "lucide-react";
import { Button } from "../../../components/common/Button";
import {
  getManagerInventory,
  receiveInventoryStock,
  type InventoryStockChangeResult,
  type ManagerInventoryItem,
} from "./inventoryApi";
import {
  InventoryWorkspaceNav,
  type InventoryWorkspacePage,
} from "./InventoryWorkspaceNav";

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function StockReceivingPage({
  onNavigate,
}: {
  onNavigate: (page: InventoryWorkspacePage) => void;
}) {
  const [items, setItems] = useState<ManagerInventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState<InventoryStockChangeResult | null>(null);

  const loadInventory = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    setLoadError("");

    try {
      setItems(await getManagerInventory());
    } catch (caught) {
      setItems([]);
      setLoadError(
        getErrorMessage(caught, "Unable to load manager inventory."),
      );
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const selectedItem = items.find((item) => item.id === selectedItemId);
  const parsedQuantity = Number(quantity);
  const quantityIsValid =
    quantity.trim() !== "" &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0;
  const canSubmit =
    Boolean(selectedItem?.isActive) && quantityIsValid && !isSaving;

  const resetForm = () => {
    setSelectedItemId("");
    setQuantity("");
    setReason("");
    setSaveError("");
    setResult(null);
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!selectedItem?.isActive) {
      setSaveError("Select an active inventory item.");
      return;
    }

    if (!quantityIsValid) {
      setSaveError("Quantity received must be greater than zero.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setResult(null);

    try {
      const authoritativeResult = await receiveInventoryStock({
        inventoryItemId: selectedItem.id,
        quantity: parsedQuantity,
        reason,
      });

      setResult(authoritativeResult);
      setSelectedItemId("");
      setQuantity("");
      setReason("");
      await loadInventory(false);
    } catch (caught) {
      setSaveError(
        getErrorMessage(caught, "Unable to receive inventory stock."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="inventory-workspace-page max-w-4xl">
      <header className="manager-page-header mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-green-200 bg-green-50">
          <ArrowDownToLine className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">
            Stock Receiving
          </h1>
          <p className="text-xs text-muted-foreground">
            Record incoming inventory stock
          </p>
        </div>
      </header>

      <InventoryWorkspaceNav active="stock-receiving" onNavigate={onNavigate} />

      {result ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            Stock received and confirmed by PostgreSQL.
          </div>
          <p className="mt-1 text-xs">
            {result.itemName} · Transaction {result.transactionId}
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-green-700">
                Before
              </p>
              <p className="mt-1 font-bold">
                {quantityFormatter.format(result.quantityBefore)} {result.unit}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-green-700">
                Received
              </p>
              <p className="mt-1 font-bold">
                +{quantityFormatter.format(result.quantityChange)} {result.unit}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-green-700">
                After
              </p>
              <p className="mt-1 font-bold">
                {quantityFormatter.format(result.quantityAfter)} {result.unit}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <p>{loadError}</p>
          <div className="mt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadInventory()}
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : null}

      {!isLoading && !loadError && items.length === 0 ? (
        <div className="mb-4 rounded-xl border border-border bg-card px-4 py-4 text-xs text-muted-foreground">
          No inventory items were returned by PostgreSQL.
        </div>
      ) : null}

      {saveError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {saveError}
        </div>
      ) : null}

      <div className="inventory-action-form rounded-2xl border border-border bg-card p-4 shadow-[0_8px_22px_rgba(67,42,23,0.035)]">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="receiving-inventory-item"
              className="text-xs font-semibold text-foreground"
            >
              Inventory Item
            </label>
            <select
              id="receiving-inventory-item"
              value={selectedItemId}
              disabled={isLoading || isSaving || Boolean(loadError)}
              onChange={(event) => {
                setSelectedItemId(event.target.value);
                setSaveError("");
                setResult(null);
              }}
              className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {isLoading ? "Loading inventory…" : "Select inventory item…"}
              </option>
              {items.map((item) => (
                <option key={item.id} value={item.id} disabled={!item.isActive}>
                  {item.itemName}
                  {!item.isActive ? " (Inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedItem ? (
            <div className="rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-xs sm:col-span-2">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <span className="text-muted-foreground">Current Stock:</span>{" "}
                  <span className="font-bold">
                    {quantityFormatter.format(selectedItem.quantityOnHand)}{" "}
                    {selectedItem.unit}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reorder Level:</span>{" "}
                  <span className="font-bold">
                    {quantityFormatter.format(selectedItem.reorderLevel)}{" "}
                    {selectedItem.unit}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="receiving-quantity"
              className="text-xs font-semibold text-foreground"
            >
              Quantity Received
            </label>
            <input
              id="receiving-quantity"
              type="number"
              min="0.001"
              step="any"
              placeholder="0"
              value={quantity}
              disabled={isSaving}
              onChange={(event) => {
                setQuantity(event.target.value);
                setSaveError("");
                setResult(null);
              }}
              className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            {quantity && !quantityIsValid ? (
              <p className="text-[10px] text-red-600">
                Enter a quantity greater than zero.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Unit</span>
            <div className="rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              {selectedItem?.unit ?? "Select an item"}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="receiving-reason"
              className="text-xs font-semibold text-foreground"
            >
              Reason / Notes (optional)
            </label>
            <textarea
              id="receiving-reason"
              rows={2}
              maxLength={300}
              placeholder="Remarks about the received stock…"
              value={reason}
              disabled={isSaving}
              onChange={(event) => {
                setReason(event.target.value);
                setSaveError("");
                setResult(null);
              }}
              className="resize-none rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {reason.trim().length}/300
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={isSaving}
            onClick={resetForm}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isSaving}
            disabled={!canSubmit}
            onClick={() => void handleSave()}
          >
            <ArrowDownToLine className="h-4 w-4" />
            {isSaving ? "Recording…" : "Record Stock Received"}
          </Button>
        </div>
      </div>
    </div>
  );
}
