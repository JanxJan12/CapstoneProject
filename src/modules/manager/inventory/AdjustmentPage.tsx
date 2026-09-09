import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Sliders } from "lucide-react";
import { Button } from "../../../components/common/Button";
import {
  adjustInventoryStock,
  getManagerInventory,
  type InventoryStockChangeResult,
  type ManagerInventoryItem,
} from "./inventoryApi";

const REASONS = [
  "Physical count correction",
  "Damaged stock write-off",
  "Transfer to another branch",
  "System error correction",
  "Opening balance adjustment",
  "Other",
];

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function AdjustmentPage() {
  const [items, setItems] = useState<ManagerInventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">(
    "add",
  );
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
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
  const normalizedReason = reason.trim();
  const normalizedNote = note.trim();
  const combinedReason = normalizedReason
    ? `${normalizedReason}${normalizedNote ? `: ${normalizedNote}` : ""}`
    : normalizedNote;
  const reasonIsValid =
    normalizedReason.length > 0 && combinedReason.length <= 300;
  const signedQuantityChange =
    adjustmentType === "add" ? parsedQuantity : -parsedQuantity;
  const canSubmit =
    Boolean(selectedItem?.isActive) &&
    quantityIsValid &&
    reasonIsValid &&
    !isSaving;

  const resetForm = () => {
    setSelectedItemId("");
    setAdjustmentType("add");
    setQuantity("");
    setReason("");
    setNote("");
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
      setSaveError("Adjustment quantity must be greater than zero.");
      return;
    }

    if (!normalizedReason) {
      setSaveError("An adjustment reason is required.");
      return;
    }

    if (combinedReason.length > 300) {
      setSaveError("Reason and notes must not exceed 300 characters total.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setResult(null);

    try {
      const authoritativeResult = await adjustInventoryStock({
        inventoryItemId: selectedItem.id,
        quantityChange: signedQuantityChange,
        reason: combinedReason,
      });

      setResult(authoritativeResult);
      setSelectedItemId("");
      setAdjustmentType("add");
      setQuantity("");
      setReason("");
      setNote("");
      await loadInventory(false);
    } catch (caught) {
      setSaveError(
        getErrorMessage(caught, "Unable to adjust inventory stock."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50">
          <Sliders className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">
            Inventory Adjustment
          </h1>
          <p className="text-xs text-muted-foreground">
            Correct stock quantities with a reason
          </p>
        </div>
      </div>

      {result ? (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-green-800">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            Inventory adjustment confirmed by PostgreSQL.
          </div>
          <p className="mt-1 text-xs">
            {result.itemName} · Transaction {result.transactionId}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
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
                Change
              </p>
              <p
                className={`mt-1 font-bold ${
                  result.quantityChange >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {result.quantityChange > 0 ? "+" : ""}
                {quantityFormatter.format(result.quantityChange)} {result.unit}
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

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor="adjustment-inventory-item"
              className="text-xs font-semibold text-foreground"
            >
              Inventory Item
            </label>
            <select
              id="adjustment-inventory-item"
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
                  {item.itemName} —{" "}
                  {quantityFormatter.format(item.quantityOnHand)} {item.unit}
                  {!item.isActive ? " (Inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedItem ? (
            <div className="col-span-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs">
              <span className="text-muted-foreground">Current Stock:</span>{" "}
              <span className="font-bold">
                {quantityFormatter.format(selectedItem.quantityOnHand)}{" "}
                {selectedItem.unit}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Adjustment Type
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setAdjustmentType("add");
                  setSaveError("");
                  setResult(null);
                }}
                className={`flex-1 rounded-lg border py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  adjustmentType === "add"
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-border bg-white text-muted-foreground hover:text-foreground"
                }`}
              >
                + Add
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setAdjustmentType("subtract");
                  setSaveError("");
                  setResult(null);
                }}
                className={`flex-1 rounded-lg border py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  adjustmentType === "subtract"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-border bg-white text-muted-foreground hover:text-foreground"
                }`}
              >
                − Subtract
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="adjustment-quantity"
              className="text-xs font-semibold text-foreground"
            >
              Quantity ({selectedItem?.unit ?? "units"})
            </label>
            <input
              id="adjustment-quantity"
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

          {selectedItem && quantityIsValid ? (
            <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs">
              <div>
                <span className="text-muted-foreground">Current:</span>{" "}
                <span className="font-bold">
                  {quantityFormatter.format(selectedItem.quantityOnHand)}{" "}
                  {selectedItem.unit}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Requested Change:</span>{" "}
                <span
                  className={`font-bold ${
                    adjustmentType === "add" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {adjustmentType === "add" ? "+" : "−"}
                  {quantityFormatter.format(parsedQuantity)} {selectedItem.unit}
                </span>
              </div>
              <p className="w-full text-[10px] text-muted-foreground">
                PostgreSQL will validate and return the final stock level.
              </p>
            </div>
          ) : null}

          <div className="col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor="adjustment-reason"
              className="text-xs font-semibold text-foreground"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              id="adjustment-reason"
              value={reason}
              disabled={isSaving}
              onChange={(event) => {
                setReason(event.target.value);
                setSaveError("");
                setResult(null);
              }}
              className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Select reason…</option>
              {REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor="adjustment-note"
              className="text-xs font-semibold text-foreground"
            >
              Notes (optional)
            </label>
            <textarea
              id="adjustment-note"
              rows={3}
              maxLength={300}
              placeholder="Additional details about this adjustment…"
              value={note}
              disabled={isSaving}
              onChange={(event) => {
                setNote(event.target.value);
                setSaveError("");
                setResult(null);
              }}
              className="resize-none rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p
              className={`text-right text-[9px] ${
                combinedReason.length > 300
                  ? "font-semibold text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              {combinedReason.length}/300 characters sent to PostgreSQL
            </p>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="secondary"
            size="md"
            disabled={isSaving}
            onClick={resetForm}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={!canSubmit}
            onClick={() => void handleSave()}
          >
            <Sliders className="h-4 w-4" />
            {isSaving ? "Saving…" : "Save Adjustment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
