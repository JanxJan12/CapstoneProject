import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/common/Button";
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
  clearInventoryMutationRequestId,
  getManagerInventory,
  getManagerInventoryBatchContext,
  getOrCreateInventoryMutationRequestId,
  recordInventoryWaste,
  recordBatchInventoryWaste,
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

const WASTE_REASONS = [
  "Spoiled",
  "Expired",
  "Damaged",
  "Preparation waste",
  "Contaminated",
  "Other",
] as const;

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function WasteSpoilagePage({
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
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [postingError, setPostingError] = useState(false);
  const [result, setResult] = useState<InventoryStockChangeResult | null>(null);
  const submitting = useRef(false);

  const loadInventoryData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    setLoadError("");

    const [inventoryResult, batchContextResult] = await Promise.allSettled([
      getManagerInventory(),
      getManagerInventoryBatchContext(),
    ]);

    if (
      inventoryResult.status === "rejected" ||
      batchContextResult.status === "rejected"
    ) {
      setItems([]);
      setBatchContexts([]);
      setLoadError(
        getErrorMessage(
          inventoryResult.status === "rejected"
            ? inventoryResult.reason
            : batchContextResult.status === "rejected"
              ? batchContextResult.reason
              : null,
          "Unable to load manager inventory and physical batches.",
        ),
      );
    } else {
      setItems(inventoryResult.value);
      setBatchContexts(batchContextResult.value);
    }

    if (showLoading) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventoryData();
  }, [loadInventoryData]);

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
  const quantityFitsAvailableStock =
    Boolean(selectedItem) &&
    quantityIsValid &&
    parsedQuantity <=
      (batchContext?.batchConsumptionEnabled
        ? (selectedBatch?.quantityOnHand ?? 0)
        : (selectedItem?.quantityOnHand ?? 0));
  const normalizedReason = reason.trim();
  const normalizedDetails = details.trim();
  const combinedReason = useMemo(() => {
    if (!normalizedReason) {
      return "";
    }

    if (normalizedReason === "Other") {
      return normalizedDetails ? `Other: ${normalizedDetails}` : "";
    }

    return normalizedDetails
      ? `${normalizedReason}: ${normalizedDetails}`
      : normalizedReason;
  }, [normalizedDetails, normalizedReason]);
  const reasonIsValid =
    combinedReason.length > 0 && combinedReason.length <= 300;
  const quantityError = quantity
    ? !quantityIsValid
      ? `Enter a positive quantity with at most ${quantityScale} decimal places.`
      : !quantityFitsAvailableStock
        ? `Quantity cannot exceed the displayed ${batchContext?.batchConsumptionEnabled ? "batch" : "item"} stock.`
        : undefined
    : undefined;
  const canSubmit =
    Boolean(selectedItem?.isActive) &&
    (!batchContext?.batchConsumptionEnabled || Boolean(selectedBatch)) &&
    quantityIsValid &&
    quantityFitsAvailableStock &&
    reasonIsValid &&
    !isSaving;

  const clearForm = () => {
    clearInventoryMutationRequestId("waste");
    setSelectedItemId(initialItemId ?? "");
    setSelectedBatchId("");
    setQuantity("");
    setReason("");
    setDetails("");
    setSaveError("");
    setPostingError(false);
  };

  const resetForm = () => {
    clearForm();
    setResult(null);
  };

  const openConfirmation = () => {
    setPostingError(false);
    if (!selectedItem?.isActive) {
      setSaveError("Select an active inventory item.");
      return;
    }

    if (!quantityIsValid) {
      setSaveError(
        `Enter a positive quantity with at most ${quantityScale} decimal places.`,
      );
      return;
    }

    if (batchContext?.batchConsumptionEnabled && !selectedBatch) {
      setSaveError("Select the physical batch being disposed.");
      return;
    }

    if (!quantityFitsAvailableStock) {
      setSaveError(
        "Waste quantity cannot exceed the currently displayed stock.",
      );
      return;
    }

    if (!normalizedReason) {
      setSaveError("Select a waste/spoilage reason.");
      return;
    }

    if (normalizedReason === "Other" && !normalizedDetails) {
      setSaveError("Enter a reason when Other is selected.");
      return;
    }

    if (combinedReason.length > 300) {
      setSaveError("Reason and details must not exceed 300 characters total.");
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
      operation: "waste",
      inventoryItemId: selectedItem.id,
      inventoryBatchId: batchContext?.batchConsumptionEnabled
        ? selectedBatchId
        : null,
      expectedBatchQuantity: selectedBatch?.quantityOnHand ?? null,
      quantity: parsedQuantity,
      reason: batchContext?.batchConsumptionEnabled
        ? normalizedReason
        : combinedReason,
      notes: batchContext?.batchConsumptionEnabled ? normalizedDetails : null,
    });
    const requestId = getOrCreateInventoryMutationRequestId(
      "waste",
      requestFingerprint,
    );

    setIsSaving(true);
    setSaveError("");
    setPostingError(false);
    setResult(null);

    try {
      const authoritativeResult =
        batchContext?.batchConsumptionEnabled && selectedBatch
          ? await recordBatchInventoryWaste({
              inventoryItemId: selectedItem.id,
              inventoryBatchId: selectedBatch.id,
              expectedBatchQuantity: selectedBatch.quantityOnHand,
              quantity: parsedQuantity,
              reason: normalizedReason,
              notes: normalizedDetails,
              requestId,
            })
          : await recordInventoryWaste({
              inventoryItemId: selectedItem.id,
              quantity: parsedQuantity,
              reason: combinedReason,
              requestId,
            });

      clearInventoryMutationRequestId("waste", requestId);
      setResult(authoritativeResult);
      setSelectedItemId("");
      setSelectedBatchId("");
      setQuantity("");
      setReason("");
      setDetails("");
      setIsConfirmationOpen(false);

      await loadInventoryData(false);
    } catch (caught) {
      setSaveError(getErrorMessage(caught, "Unable to record waste/spoilage."));
      setPostingError(true);
      setIsConfirmationOpen(false);
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  };

  const detailsField = (
    <div className="flex flex-col gap-1.5 pb-2">
      <label
        htmlFor="waste-details"
        className="text-xs font-semibold text-foreground"
      >
        {reason === "Other" ? "Reason details *" : "Details"}
      </label>
      <textarea
        id="waste-details"
        rows={2}
        maxLength={300}
        placeholder={
          reason === "Other"
            ? "Enter the waste/spoilage reason…"
            : "Add relevant details about the inventory loss…"
        }
        value={details}
        disabled={isSaving}
        required={reason === "Other"}
        onChange={(event) => {
          setDetails(event.target.value);
          setSaveError("");
          setPostingError(false);
          setResult(null);
        }}
        className="resize-none rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
  );

  return (
    <div className="inventory-workspace-page manager-support-page manager-waste-page max-w-4xl [&_button]:min-h-11 [&_select]:min-h-11!">
      <header className="manager-page-header mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="manager-page-context">Inventory / Waste</p>
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
            Waste / Spoilage
          </h1>
          <p className="text-sm text-muted-foreground">
            Record a loss from stock already accepted into inventory.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isSaving}
          loading={isLoading}
          onClick={() => void loadInventoryData()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </header>
      <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Items rejected before Receiving acceptance must not be recorded as
        inventory waste.
      </p>

      {result ? (
        <InventoryMutationResult
          result={result}
          title="Waste/spoilage recorded"
          changeLabel="Waste"
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
              onClick={() => void loadInventoryData()}
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
            {postingError ? "Waste posting not confirmed" : "Review the form"}
          </p>
          <p className="mt-1">{saveError}</p>
          {postingError ? (
            <p className="mt-2">
              If the connection was interrupted after confirmation, check Stock
              Movements before trying again. Keep the item, batch, quantity and
              reason unchanged to reuse this request. Resetting or changing them
              starts a different request.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="inventory-action-form rounded-2xl border border-border bg-card p-4 shadow-[0_8px_22px_rgba(67,42,23,0.035)]">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InventoryItemSelect
            id="waste-inventory-item"
            items={items}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            batchContext={batchContext}
            isLoading={isLoading}
            disabled={isLoading || isSaving || Boolean(loadError)}
            onChange={(id) => {
              if (
                id !== selectedItemId &&
                (selectedBatchId || quantity || reason || details) &&
                !window.confirm(
                  "Changing the inventory item clears the entered quantity, reason, and details. Continue?",
                )
              )
                return;
              setSelectedItemId(id);
              setSelectedBatchId("");
              setQuantity("");
              setReason("");
              setDetails("");
              setSaveError("");
              setPostingError(false);
              setResult(null);
            }}
          />

          {selectedItem && batchContext?.batchConsumptionEnabled ? (
            <InventoryBatchSelect
              id="waste-inventory-batch"
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

          <div className="sm:col-span-2 sm:max-w-xs">
            <InventoryQuantityInput
              id="waste-quantity"
              label="Quantity wasted"
              value={quantity}
              unit={selectedItem?.unit}
              quantityScale={quantityScale}
              error={quantityError}
              disabled={
                isSaving ||
                !selectedItem ||
                (Boolean(batchContext?.batchConsumptionEnabled) &&
                  !selectedBatch)
              }
              onChange={(value) => {
                setQuantity(value);
                setSaveError("");
                setPostingError(false);
                setResult(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="waste-reason"
              className="text-xs font-semibold text-foreground"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              id="waste-reason"
              value={reason}
              disabled={isSaving}
              required
              onChange={(event) => {
                setReason(event.target.value);
                setSaveError("");
                setPostingError(false);
                setResult(null);
              }}
              className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Select reason…</option>
              {WASTE_REASONS.map((wasteReason) => (
                <option key={wasteReason} value={wasteReason}>
                  {wasteReason}
                </option>
              ))}
            </select>
          </div>

          {reason === "Other" ? (
            <div className="sm:col-span-2">{detailsField}</div>
          ) : (
            <details className="sm:col-span-2">
              <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                Additional details {details.trim() ? "— added" : "(optional)"}
              </summary>
              {detailsField}
            </details>
          )}
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
            Review Waste / Spoilage
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
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle>Record this inventory loss?</AlertDialogTitle>
            <AlertDialogDescription className="leading-5">
              This permanently records a stock deduction. Review the batch,
              signed quantity, reason, and projected balance before confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedItem ? (
            <InventoryMutationSummary
              item={selectedItem}
              batch={selectedBatch}
              quantityChange={-parsedQuantity}
              operationLabel="Waste"
              reason={combinedReason}
              compact
            />
          ) : null}

          <p className="text-xs text-muted-foreground">
            The current balance is checked again when you confirm. If another
            stock change happened, this request will be rejected and refreshed.
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
              className="min-h-11 w-full bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isSaving ? "Recording…" : "Confirm Waste / Spoilage"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
