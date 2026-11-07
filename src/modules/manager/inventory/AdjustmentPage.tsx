import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Sliders } from "lucide-react";
import { Button } from "../../../components/common/Button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  adjustInventoryStock,
  adjustInventoryBatchStock,
  clearInventoryMutationRequestId,
  getManagerInventory,
  getManagerInventoryBatchContext,
  getOrCreateInventoryMutationRequestId,
  type InventoryStockChangeResult,
  type ManagerInventoryBatchContext,
  type ManagerInventoryItem,
} from "./inventoryApi";
import { InventoryBatchSelect } from "./InventoryBatchSelect";
import { InventoryItemSelect } from "./InventoryItemSelect";
import {
  InventoryMutationResult,
  InventoryMutationSummary,
} from "./InventoryMutationSummary";
import { InventoryQuantityInput } from "./InventoryQuantityInput";
import { isValidInventoryQuantity } from "./inventoryMutationUi";

const REASONS = [
  "Physical count correction",
  "System error correction",
  "Other",
];
const BATCH_REASONS = [
  "Physical count correction",
  "System error correction",
  "Other",
];

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function AdjustmentPage({
  initialItemId,
  onBackToItem,
}: {
  initialItemId?: string;
  onBackToItem?: () => void;
}) {
  const [items, setItems] = useState<ManagerInventoryItem[]>([]);
  const [batchContexts, setBatchContexts] = useState<
    ManagerInventoryBatchContext[]
  >([]);
  const [selectedItemId, setSelectedItemId] = useState(initialItemId ?? "");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">(
    "add",
  );
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [postingError, setPostingError] = useState(false);
  const [result, setResult] = useState<InventoryStockChangeResult | null>(null);
  const submitting = useRef(false);

  const loadInventory = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    setLoadError("");

    try {
      const [inventory, contexts] = await Promise.all([
        getManagerInventory(),
        getManagerInventoryBatchContext(),
      ]);
      setItems(inventory);
      setBatchContexts(contexts);
    } catch (caught) {
      setItems([]);
      setBatchContexts([]);
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
  const batchContext = batchContexts.find(
    (context) => context.inventoryItemId === selectedItemId,
  );
  const selectedBatch = batchContext?.batches.find(
    (batch) => batch.id === selectedBatchId,
  );
  const parsedQuantity = Number(quantity);
  const quantityScale = batchContext?.quantityScale ?? 3;
  const quantityIsValid =
    Boolean(batchContext) && isValidInventoryQuantity(quantity, quantityScale);
  const normalizedReason = reason.trim();
  const normalizedNote = note.trim();
  const combinedReason = normalizedReason
    ? `${normalizedReason}${normalizedNote ? `: ${normalizedNote}` : ""}`
    : normalizedNote;
  const reasonIsValid =
    normalizedReason.length > 0 && combinedReason.length <= 300;
  const signedQuantityChange =
    adjustmentType === "add" ? parsedQuantity : -parsedQuantity;
  const quantityFitsAvailableStock =
    adjustmentType === "add" ||
    (quantityIsValid &&
      parsedQuantity <=
        (batchContext?.batchConsumptionEnabled
          ? (selectedBatch?.quantityOnHand ?? 0)
          : (selectedItem?.quantityOnHand ?? 0)));
  const quantityError = quantity
    ? !quantityIsValid
      ? `Enter a positive quantity with at most ${quantityScale} decimal places.`
      : !quantityFitsAvailableStock
        ? `Decrease cannot exceed the displayed ${batchContext?.batchConsumptionEnabled ? "batch" : "item"} stock.`
        : undefined
    : undefined;
  const canSubmit =
    Boolean(selectedItem?.isActive) &&
    (!batchContext?.batchConsumptionEnabled || Boolean(selectedBatch)) &&
    quantityIsValid &&
    quantityFitsAvailableStock &&
    reasonIsValid &&
    !isSaving;

  const resetForm = () => {
    clearInventoryMutationRequestId("adjustment");

    setSelectedItemId(initialItemId ?? "");
    setSelectedBatchId("");
    setAdjustmentType("add");
    setQuantity("");
    setReason("");
    setNote("");
    setSaveError("");
    setPostingError(false);
    setResult(null);
  };

  const openConfirmation = () => {
    setPostingError(false);
    if (!selectedItem?.isActive) {
      setSaveError("Select an active inventory item.");
      return;
    }

    if (batchContext?.batchConsumptionEnabled && !selectedBatch) {
      setSaveError("Select the physical batch being corrected.");
      return;
    }

    if (!quantityIsValid) {
      setSaveError(
        `Enter a positive quantity with at most ${quantityScale} decimal places.`,
      );
      return;
    }

    if (adjustmentType === "subtract" && !quantityFitsAvailableStock) {
      setSaveError(
        "The correction exceeds the displayed physical stock. Refresh inventory.",
      );
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

    setSaveError("");
    setIsConfirmationOpen(true);
  };

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!selectedItem?.isActive || !canSubmit || submitting.current) {
      return;
    }
    submitting.current = true;

    const requestFingerprint = JSON.stringify({
      operation: "adjustment",
      inventoryItemId: selectedItem.id,
      inventoryBatchId: batchContext?.batchConsumptionEnabled
        ? selectedBatchId
        : null,
      expectedBatchQuantity: selectedBatch?.quantityOnHand ?? null,
      quantityChange: signedQuantityChange,
      reason: batchContext?.batchConsumptionEnabled
        ? normalizedReason
        : combinedReason,
      notes: batchContext?.batchConsumptionEnabled ? normalizedNote : null,
    });

    const requestId = getOrCreateInventoryMutationRequestId(
      "adjustment",
      requestFingerprint,
    );

    setIsSaving(true);
    setSaveError("");
    setPostingError(false);
    setResult(null);

    try {
      const authoritativeResult =
        batchContext?.batchConsumptionEnabled && selectedBatch
          ? await adjustInventoryBatchStock({
              inventoryItemId: selectedItem.id,
              inventoryBatchId: selectedBatch.id,
              expectedBatchQuantity: selectedBatch.quantityOnHand,
              quantityChange: signedQuantityChange,
              reason: normalizedReason,
              notes: normalizedNote,
              requestId,
            })
          : await adjustInventoryStock({
              inventoryItemId: selectedItem.id,
              quantityChange: signedQuantityChange,
              reason: combinedReason,
              requestId,
            });

      clearInventoryMutationRequestId("adjustment", requestId);

      setResult(authoritativeResult);
      setSelectedItemId("");
      setSelectedBatchId("");
      setAdjustmentType("add");
      setQuantity("");
      setReason("");
      setNote("");
      setIsConfirmationOpen(false);

      await loadInventory(false);
    } catch (caught) {
      const message = getErrorMessage(
        caught,
        "Unable to adjust inventory stock.",
      ).replace("Inventory was refreshed;", "Refresh inventory;");
      setSaveError(message);
      setPostingError(true);
      setIsConfirmationOpen(false);
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="inventory-workspace-page manager-support-page manager-adjustment-page max-w-4xl [&_button]:min-h-11 [&_select]:min-h-11!">
      <header className="manager-page-header mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="manager-page-context">Inventory / Adjustments</p>
          {onBackToItem ? (
            <button
              type="button"
              onClick={onBackToItem}
              className="mb-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              ← Item stock
            </button>
          ) : null}
          <h1 className="text-base font-bold text-foreground">
            Inventory Adjustment
          </h1>
          <p className="text-sm text-muted-foreground">
            Correct a verified stock difference.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isSaving}
          loading={isLoading}
          onClick={() => void loadInventory()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </header>
      <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Use Adjustments only for verified stock discrepancies. Receiving and
        Waste have their own workflows.
      </p>

      {result ? (
        <InventoryMutationResult
          result={result}
          title="Inventory adjustment recorded"
          changeLabel="Adjustment"
        />
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
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

      {isLoading ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Loading inventory items and physical batches…
        </p>
      ) : null}

      {!isLoading && !loadError && items.length === 0 ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-border bg-card px-4 py-4 text-xs text-muted-foreground"
        >
          No inventory items are available. Refresh to check again.
        </div>
      ) : null}

      {saveError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          <p className="font-semibold">
            {postingError
              ? "Adjustment posting not confirmed"
              : "Review the form"}
          </p>
          <p className="mt-1">{saveError}</p>
          {postingError ? (
            <p className="mt-2">
              If the connection was interrupted after confirmation, check Stock
              Movements before trying again. Keep the item, batch, direction,
              quantity and reason unchanged to reuse this request. Resetting or
              changing them starts a different request.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="inventory-action-form rounded-2xl border border-border bg-card p-4 shadow-[0_8px_22px_rgba(67,42,23,0.035)]">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InventoryItemSelect
            id="adjustment-inventory-item"
            items={items}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            batchContext={batchContext}
            isLoading={isLoading}
            disabled={isLoading || isSaving || Boolean(loadError)}
            onChange={(id) => {
              if (
                id !== selectedItemId &&
                (selectedBatchId || quantity || reason || note) &&
                !window.confirm(
                  "Changing the inventory item clears the entered quantity, reason, and notes. Continue?",
                )
              )
                return;
              setSelectedItemId(id);
              setSelectedBatchId("");
              setQuantity("");
              setReason("");
              setNote("");
              setSaveError("");
              setPostingError(false);
              setResult(null);
            }}
          />

          {selectedItem && batchContext?.batchConsumptionEnabled ? (
            <InventoryBatchSelect
              id="adjustment-inventory-batch"
              batches={batchContext.batches}
              selectedBatchId={selectedBatchId}
              onChange={(id) => {
                setSelectedBatchId(id);
                setSaveError("");
                setPostingError(false);
                setResult(null);
              }}
              disabled={isSaving}
              unit={selectedItem.unit}
            />
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              Direction
            </span>
            <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/60 p-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setAdjustmentType("add");
                  setSaveError("");
                  setPostingError(false);
                  setResult(null);
                }}
                aria-pressed={adjustmentType === "add"}
                className={`min-h-11 rounded-md border border-transparent px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                  adjustmentType === "add"
                    ? "bg-card text-foreground shadow-[0_1px_3px_rgba(67,42,23,0.14)]"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                }`}
              >
                Increase
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setAdjustmentType("subtract");
                  setSaveError("");
                  setPostingError(false);
                  setResult(null);
                }}
                aria-pressed={adjustmentType === "subtract"}
                className={`min-h-11 rounded-md border border-transparent px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                  adjustmentType === "subtract"
                    ? "bg-card text-foreground shadow-[0_1px_3px_rgba(67,42,23,0.14)]"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                }`}
              >
                Decrease
              </button>
            </div>
          </div>

          <InventoryQuantityInput
            id="adjustment-quantity"
            label="Adjustment quantity"
            value={quantity}
            unit={selectedItem?.unit}
            quantityScale={quantityScale}
            error={quantityError}
            disabled={
              isSaving ||
              !selectedItem ||
              (Boolean(batchContext?.batchConsumptionEnabled) && !selectedBatch)
            }
            onChange={(value) => {
              setQuantity(value);
              setSaveError("");
              setPostingError(false);
              setResult(null);
            }}
          />

          <p className="text-xs text-muted-foreground sm:col-span-2">
            Enter the amount to add or subtract, not the target balance. An
            increase changes existing stock; it does not create a Receiving
            batch.
          </p>

          <div className="sm:col-span-2">
            <div className="flex flex-col gap-1.5">
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
                required
                onChange={(event) => {
                  setReason(event.target.value);
                  setSaveError("");
                  setPostingError(false);
                  setResult(null);
                }}
                className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Select reason…</option>
                {(batchContext?.batchConsumptionEnabled
                  ? BATCH_REASONS
                  : REASONS
                ).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="sm:col-span-2">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Additional details {note.trim() ? "— added" : "(optional)"}
            </summary>
            <div className="flex flex-col gap-1.5 pb-2">
              <label
                htmlFor="adjustment-note"
                className="text-xs font-semibold text-foreground"
              >
                Notes
              </label>
              <textarea
                id="adjustment-note"
                rows={2}
                maxLength={300}
                placeholder="Additional details about this adjustment…"
                value={note}
                disabled={isSaving}
                onChange={(event) => {
                  setNote(event.target.value);
                  setSaveError("");
                  setPostingError(false);
                  setResult(null);
                }}
                className="resize-none rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p
                className={`text-right text-[10px] ${
                  combinedReason.length > 300
                    ? "font-semibold text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                {combinedReason.length}/300 characters in the recorded reason
              </p>
            </div>
          </details>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            disabled={isSaving}
            onClick={resetForm}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
            disabled={
              isLoading || isSaving || Boolean(loadError) || items.length === 0
            }
            onClick={openConfirmation}
          >
            Review Adjustment
          </Button>
        </div>
      </div>

      <AlertDialog
        open={isConfirmationOpen}
        onOpenChange={(open) => {
          if (!isSaving) {
            setIsConfirmationOpen(open);
          }
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6">
          <AlertDialogHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Sliders className="h-5 w-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle>Confirm this stock adjustment?</AlertDialogTitle>
            <AlertDialogDescription className="leading-5">
              This records a stock correction. Review the selected item,
              direction, amount, reason and projected balance before confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedItem ? (
            <InventoryMutationSummary
              item={selectedItem}
              batch={selectedBatch}
              quantityChange={signedQuantityChange}
              operationLabel={
                adjustmentType === "add" ? "Increase" : "Decrease"
              }
              reason={combinedReason}
              compact
            />
          ) : null}

          <p className="text-xs text-muted-foreground">
            The current balance is checked again when you confirm.{" "}
            {selectedBatch
              ? "A positive adjustment changes only the selected existing batch."
              : "Standard stock is adjusted against the item's aggregate balance."}
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel
              className="min-h-11 w-full sm:w-auto"
              disabled={isSaving}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={(event) => void handleConfirm(event)}
              className="min-h-11 w-full bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600 sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sliders className="h-4 w-4" />
              )}
              {isSaving ? "Saving…" : "Confirm Adjustment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
