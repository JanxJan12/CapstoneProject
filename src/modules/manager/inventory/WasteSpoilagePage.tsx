import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, RefreshCw, Trash2 } from "lucide-react";

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
  getManagerInventoryTransactions,
  getOrCreateInventoryMutationRequestId,
  recordInventoryWaste,
  type InventoryStockChangeResult,
  type ManagerInventoryItem,
} from "./inventoryApi";
import { InventoryReconciliationPanel } from "./InventoryReconciliationPanel";
import {
  INVENTORY_RECONCILIATION_TRANSACTION_LIMIT,
  reconcileInventoryBalances,
  type InventoryReconciliationReport,
} from "./inventoryReconciliation";
import {
  InventoryWorkspaceNav,
  type InventoryWorkspacePage,
} from "./InventoryWorkspaceNav";

const WASTE_REASONS = [
  "Spoiled",
  "Expired",
  "Damaged",
  "Preparation waste",
  "Contaminated",
  "Other",
] as const;

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function WasteSpoilagePage({
  onNavigate,
}: {
  onNavigate: (page: InventoryWorkspacePage) => void;
}) {
  const [items, setItems] = useState<ManagerInventoryItem[]>([]);
  const [reconciliation, setReconciliation] =
    useState<InventoryReconciliationReport | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reconciliationError, setReconciliationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState<InventoryStockChangeResult | null>(null);

  const loadInventoryData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    setLoadError("");
    setReconciliationError("");

    const [inventoryResult, transactionsResult] = await Promise.allSettled([
      getManagerInventory(),
      getManagerInventoryTransactions(
        INVENTORY_RECONCILIATION_TRANSACTION_LIMIT,
      ),
    ]);

    if (inventoryResult.status === "rejected") {
      setItems([]);
      setReconciliation(null);
      setLoadError(
        getErrorMessage(
          inventoryResult.reason,
          "Unable to load manager inventory.",
        ),
      );
    } else {
      setItems(inventoryResult.value);

      if (transactionsResult.status === "rejected") {
        setReconciliation(null);
        setReconciliationError(
          getErrorMessage(
            transactionsResult.reason,
            "Unable to load inventory transactions for reconciliation.",
          ),
        );
      } else {
        setReconciliation(
          reconcileInventoryBalances(
            inventoryResult.value,
            transactionsResult.value,
          ),
        );
      }
    }

    if (showLoading) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventoryData();
  }, [loadInventoryData]);

  const selectedItem = items.find((item) => item.id === selectedItemId);
  const parsedQuantity = Number(quantity);
  const quantityIsValid =
    quantity.trim() !== "" &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0;
  const quantityFitsAvailableStock =
    Boolean(selectedItem) &&
    quantityIsValid &&
    parsedQuantity <= (selectedItem?.quantityOnHand ?? 0);
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
  const canSubmit =
    Boolean(selectedItem?.isActive) &&
    quantityIsValid &&
    quantityFitsAvailableStock &&
    reasonIsValid &&
    !isSaving;

  const clearForm = () => {
    clearInventoryMutationRequestId("waste");
    setSelectedItemId("");
    setQuantity("");
    setReason("");
    setDetails("");
    setSaveError("");
  };

  const resetForm = () => {
    clearForm();
    setResult(null);
  };

  const openConfirmation = () => {
    if (!selectedItem?.isActive) {
      setSaveError("Select an active inventory item.");
      return;
    }

    if (!quantityIsValid) {
      setSaveError("Waste quantity must be greater than zero.");
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

    if (!selectedItem?.isActive || !canSubmit) {
      return;
    }

    const requestFingerprint = JSON.stringify({
      operation: "waste",
      inventoryItemId: selectedItem.id,
      quantity: parsedQuantity,
      reason: combinedReason,
    });
    const requestId = getOrCreateInventoryMutationRequestId(
      "waste",
      requestFingerprint,
    );

    setIsSaving(true);
    setSaveError("");
    setResult(null);

    try {
      const authoritativeResult = await recordInventoryWaste({
        inventoryItemId: selectedItem.id,
        quantity: parsedQuantity,
        reason: combinedReason,
        requestId,
      });

      clearInventoryMutationRequestId("waste", requestId);
      setResult(authoritativeResult);
      setSelectedItemId("");
      setQuantity("");
      setReason("");
      setDetails("");
      setIsConfirmationOpen(false);

      await loadInventoryData(false);
    } catch (caught) {
      setSaveError(getErrorMessage(caught, "Unable to record waste/spoilage."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="inventory-workspace-page max-w-4xl">
      <header className="manager-page-header mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50">
            <Trash2 className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">
              Waste / Spoilage
            </h1>
            <p className="text-xs text-muted-foreground">
              Record unusable stock against aggregate inventory
            </p>
          </div>
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

      <InventoryWorkspaceNav active="waste-spoilage" onNavigate={onNavigate} />

      {result ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            Waste/spoilage recorded and confirmed by PostgreSQL.
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
                Waste
              </p>
              <p className="mt-1 font-bold text-red-700">
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
              onClick={() => void loadInventoryData()}
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
              htmlFor="waste-inventory-item"
              className="text-xs font-semibold text-foreground"
            >
              Inventory Item
            </label>
            <select
              id="waste-inventory-item"
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
            <div className="rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-xs sm:col-span-2">
              <span className="text-muted-foreground">Current Stock:</span>{" "}
              <span className="font-bold">
                {quantityFormatter.format(selectedItem.quantityOnHand)}{" "}
                {selectedItem.unit}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="waste-quantity"
              className="text-xs font-semibold text-foreground"
            >
              Waste Quantity
            </label>
            <input
              id="waste-quantity"
              type="number"
              min="0.001"
              step="0.001"
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
            ) : quantityIsValid && !quantityFitsAvailableStock ? (
              <p className="text-[10px] text-red-600">
                Quantity cannot exceed the displayed stock.
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
              htmlFor="waste-reason"
              className="text-xs font-semibold text-foreground"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              id="waste-reason"
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
              {WASTE_REASONS.map((wasteReason) => (
                <option key={wasteReason} value={wasteReason}>
                  {wasteReason}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="waste-details"
              className="text-xs font-semibold text-foreground"
            >
              {reason === "Other" ? "Reason details *" : "Details (optional)"}
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
              onChange={(event) => {
                setDetails(event.target.value);
                setSaveError("");
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
              {combinedReason.length}/300 characters sent to PostgreSQL
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
            variant="danger"
            size="sm"
            disabled={!canSubmit}
            onClick={openConfirmation}
          >
            <Trash2 className="h-4 w-4" />
            Record Waste / Spoilage
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <InventoryReconciliationPanel
          report={reconciliation}
          isLoading={isLoading}
          error={reconciliationError}
        />
      </div>

      <AlertDialog
        open={isConfirmationOpen}
        onOpenChange={(open) => {
          if (!isSaving) {
            setIsConfirmationOpen(open);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle>Record this inventory loss?</AlertDialogTitle>
            <AlertDialogDescription className="leading-5">
              Record {quantityFormatter.format(parsedQuantity)}{" "}
              {selectedItem?.unit} of {selectedItem?.itemName} as
              waste/spoilage? This permanently decreases aggregate stock.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
            <p>
              <span className="font-semibold">Reason:</span> {combinedReason}
            </p>
            <p className="mt-1">
              PostgreSQL will lock the current balance and reject the request if
              the available stock has changed.
            </p>
          </div>

          {saveError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
              {saveError}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={(event) => void handleConfirm(event)}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
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
