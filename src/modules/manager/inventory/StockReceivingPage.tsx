import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileText,
  FilePlus2,
  Info,
  Loader2,
  Package,
  PackageCheck,
  RefreshCw,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
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
  clearReceivingDraftRequestId,
  createEmergencyProductionReceiving,
  deleteEmptyReceivingDraft,
  getOrCreateReceivingDraftRequestId,
  getReceivingWorkspace,
  getReceivingPolicyEvidence,
  postReceivingReport,
  ReceivingPostRejectedError,
  removeReceivingLine,
  saveReceivingLine,
  updateReceivingDraft,
  verifyReceivingPolicyAvailable,
  type ReceivingDraftHeaderInput,
  type ReceivingPostResult,
  type ReceivingPolicyEvidence,
  type ReceivingReport,
  type ReceivingReportItem,
  type ReceivingSourceType,
  type ReceivingWorkspace,
} from "./receivingApi";
import { UnifiedReceivingDocuments } from "./UnifiedReceivingDocuments";
import { ReceivingAccordion } from "./ReceivingAccordion";
import { inspectorLabel, isInspectorAuditId } from "./inspectorLabel";
import { getManagerStockSummary } from "./inventoryApi";
import type { ReplenishmentRequest } from "./replenishmentApi";
import {
  closeInventoryRequestShort,
  getInventoryRequestRegister,
  startInventoryRequestReceiving,
  type InventoryRequest,
} from "./inventoryRequestApi";

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});
// Keep the server's unit label intact in every Receiving summary.
const receivingQuantity = (value: number, unit: string) =>
  `${quantityFormatter.format(value)} ${unit}`;
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});
const inputClass =
  "min-h-11 rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

interface HeaderForm {
  sourceType: ReceivingSourceType;
  sourceReference: string;
  receivedAt: string;
}

interface LineForm {
  id: string;
  inventoryItemId: string;
  quantityDelivered: string;
  quantityAccepted: string;
  secondaryQuantityDelivered: string;
  secondaryQuantityAccepted: string;
  rejectionReason: string;
  sourceLotCode: string;
  manufacturedOn: string;
  useByDate: string;
}

interface PendingPost {
  reportId: string;
  confirmedResult?: ReceivingPostResult;
  rejectedMessage?: string;
}

const PENDING_POST_KEY = "rrj_manager_receiving_pending_post_v1";

function loadPendingPost(): PendingPost | null {
  try {
    const reportId = sessionStorage.getItem(PENDING_POST_KEY);
    if (
      !reportId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)
    ) {
      return null;
    }
    return { reportId };
  } catch {
    return null;
  }
}

function toDateTimeLocal(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function createEmptyHeader(): HeaderForm {
  return {
    sourceType: "production_team",
    sourceReference: "",
    receivedAt: toDateTimeLocal(new Date()),
  };
}

function createEmptyLine(): LineForm {
  return {
    id: crypto.randomUUID(),
    inventoryItemId: "",
    quantityDelivered: "",
    quantityAccepted: "",
    secondaryQuantityDelivered: "",
    secondaryQuantityAccepted: "",
    rejectionReason: "",
    sourceLotCode: "",
    manufacturedOn: "",
    useByDate: "",
  };
}

function getErrorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function sourceLabel(source: ReceivingSourceType): string {
  return source === "production_team" ? "Production Team" : "Direct Supplier";
}

function policyLabel(classification: ReceivingPolicyEvidence["classification"]): string {
  switch (classification) {
    case "formal_request": return "Formal Request";
    case "historical_legacy_request": return "Historical Request";
    case "historical_unlinked": return "Historical receipt";
    case "manager_emergency": return "Manager emergency";
    case "direct_supplier": return "Supplier purchase order";
  }
}

function reportToHeader(report: ReceivingReport): HeaderForm {
  return {
    sourceType: report.sourceType,
    sourceReference: report.sourceReference ?? "",
    receivedAt: toDateTimeLocal(report.receivedAt),
  };
}

function reportItemToLine(item: ReceivingReportItem): LineForm {
  return {
    id: item.id,
    inventoryItemId: item.inventoryItemId,
    quantityDelivered: String(item.quantityDelivered),
    quantityAccepted: String(item.quantityAccepted),
    secondaryQuantityDelivered:
      item.secondaryQuantityDelivered === null
        ? ""
        : String(item.secondaryQuantityDelivered),
    secondaryQuantityAccepted:
      item.secondaryQuantityAccepted === null
        ? ""
        : String(item.secondaryQuantityAccepted),
    rejectionReason: item.rejectionReason ?? "",
    sourceLotCode: item.sourceLotCode ?? "",
    manufacturedOn: item.manufacturedOn ?? "",
    useByDate: item.useByDate ?? "",
  };
}

export function StockReceivingPage({
  initialItemId,
  initialReportId,
  initialReceiptSearch,
  linkedRequest,
  onBackToItem,
  onOpenRequest,
  onOpenItem,
  onOpenMovements,
  onOpenStockOverview,
  onSelectReport,
}: {
  initialItemId?: string;
  initialReportId?: string;
  initialReceiptSearch?: string;
  linkedRequest?: ReplenishmentRequest;
  onBackToItem?: () => void;
  onOpenRequest?: (requestId: string) => void;
  onOpenItem?: (itemId: string) => void;
  onOpenMovements?: (itemId: string, receiptNumber: string) => void;
  onOpenStockOverview?: () => void;
  onSelectReport?: (reportId: string | null) => void;
}) {
  const [workspace, setWorkspace] = useState<ReceivingWorkspace | null>(null);
  const [stockKinds, setStockKinds] = useState<Map<string, boolean>>(new Map());
  useEffect(() => {
    let active = true;
    void getManagerStockSummary().then((rows) => {
      if (active) setStockKinds(new Map(rows.map((row) => [row.id, row.batchConsumptionEnabled])));
    }).catch(() => { /* Keep the destination neutral when the separate stock read is unavailable. */ });
    return () => { active = false; };
  }, []);
  const stockDestinationLabel = (itemId: string) =>
    stockKinds.has(itemId) ? stockKinds.get(itemId) ? "Stock and batches" : "Standard stock" : "Item stock";
  const [listRevision, setListRevision] = useState(0);
  const [header, setHeader] = useState<HeaderForm>(createEmptyHeader);
  const newDraftBaseline = useRef(header);
  const [line, setLine] = useState<LineForm>(() => ({
    ...createEmptyLine(),
    inventoryItemId: initialItemId ?? "",
  }));
  const [lineItemSelectedByManager, setLineItemSelectedByManager] = useState(false);
  const [lineFieldError, setLineFieldError] = useState<{ id: string; message: string } | null>(null);
  const [lineSaveError, setLineSaveError] = useState("");
  const [isCreating, setIsCreating] = useState(Boolean(initialItemId));
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [view, setView] = useState<"queue" | "workspace">(
    initialReportId || initialItemId ? "workspace" : "queue",
  );
  const [stage, setStage] = useState<"inspect" | "review">("inspect");
  const [itemFilter, setItemFilter] = useState<"all" | "pending" | "saved">("all");
  const [stagedLineForms, setStagedLineForms] = useState<Record<string, LineForm>>({});
  const viewInitialized = useRef(false);
  const [error, setError] = useState("");
  const [failedReportId, setFailedReportId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [postResult, setPostResult] = useState<ReceivingPostResult | null>(
    null,
  );
  const [pendingPost, setPendingPost] = useState<PendingPost | null>(
    loadPendingPost,
  );
  const [shortfallReason, setShortfallReason] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyInspector, setEmergencyInspector] = useState("");
  const [policyEvidence, setPolicyEvidence] =
    useState<ReceivingPolicyEvidence | null>(null);
  const [isStartingNext, setIsStartingNext] = useState(false);
  const [isClosingShort, setIsClosingShort] = useState(false);
  const nextReceiptIdRef = useRef(crypto.randomUUID());
  const [linkedRequestForReport, setLinkedRequestForReport] =
    useState<ReplenishmentRequest | null>(null);
  const [linkedDocument, setLinkedDocument] = useState<InventoryRequest | null>(
    null,
  );
  const postingRef = useRef(false);
  const savingLineRef = useRef(false);
  const [lineSaveStatus, setLineSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const workspaceLoadVersion = useRef(0);
  const loadedReportId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!viewInitialized.current) {
      viewInitialized.current = true;
      return;
    }
    requestAnimationFrame(() => {
      document.getElementById(view === "queue" ? "receiving-queue-heading" : "receiving-workspace-heading")?.focus();
    });
  }, [view]);

  const rememberPendingPost = (outcome: PendingPost | null) => {
    setPendingPost(outcome);
    try {
      if (outcome) {
        sessionStorage.setItem(PENDING_POST_KEY, outcome.reportId);
      } else {
        sessionStorage.removeItem(PENDING_POST_KEY);
      }
    } catch {
      // The in-memory lock still protects this mounted workspace.
    }
  };

  const selectedReport = workspace?.selectedReport ?? null;
  useEffect(() => { setItemFilter("all"); }, [selectedReport?.id]);
  const activeLinkedRequest =
    selectedReport?.id === linkedRequestForReport?.receiving_report_id
      ? linkedRequestForReport
      : selectedReport?.id === initialReportId
        ? linkedRequest
        : undefined;
  const activeLinkedDocument =
    selectedReport?.id &&
    linkedDocument?.receipts.some((receipt) => receipt.id === selectedReport.id)
      ? linkedDocument
      : null;
  const requestItemRows = activeLinkedDocument?.lines.map((requestLine) => {
    const current = (selectedReport?.items ?? []).filter((item) => item.inventoryItemId === requestLine.inventory_item_id);
    return {
      requestLine,
      delivered: current.reduce((sum, item) => sum + item.quantityDelivered, 0),
      accepted: current.reduce((sum, item) => sum + item.quantityAccepted, 0),
      rejected: current.reduce((sum, item) => sum + item.quantityRejected, 0),
      savedCount: current.length,
    };
  }) ?? [];
  const requestedItemsWithSavedLines = requestItemRows.filter(({ savedCount }) => savedCount > 0).length;
  const visibleRequestItems = requestItemRows.filter(({ savedCount }) =>
    itemFilter === "all" || (itemFilter === "saved" ? savedCount > 0 : savedCount === 0),
  );
  const isPosted = selectedReport?.status === "posted";
  const isDraft = selectedReport?.status === "draft";
  const physicalInspector = activeLinkedDocument?.receipts.find(
    (receipt) => receipt.id === selectedReport?.id,
  )?.inspector ?? policyEvidence?.inspectedByName ?? null;
  const postedReceiptDetails = selectedReport && isPosted ? [
    { label: "Source", value: sourceLabel(selectedReport.sourceType) },
    { label: "Received", value: dateFormatter.format(new Date(selectedReport.receivedAt)) },
    { label: "Posted", value: selectedReport.postedAt ? dateFormatter.format(new Date(selectedReport.postedAt)) : null },
    { label: "Recording Manager", value: selectedReport.receivedByName || "Not recorded" },
    { label: "Posting Manager", value: selectedReport.postedByName || "Not recorded" },
    { label: "Physical inspector", value: inspectorLabel(physicalInspector) },
    { label: "Purchase order", value: selectedReport.purchaseOrderNumber },
    { label: "Supplier", value: selectedReport.supplierName },
    { label: "Handoff reference", value: selectedReport.sourceReference },
    { label: "Supplier delivery reference", value: selectedReport.supplierDeliveryReference },
  ] : [];
  const savedHeader = selectedReport ? reportToHeader(selectedReport) : null;
  const hasUnsavedHeader = Boolean(
    isDraft &&
    savedHeader &&
    (Object.keys(header) as (keyof HeaderForm)[]).some(
      (key) => header[key] !== savedHeader[key],
    ),
  );
  const savedLine = selectedReport?.items.find((item) => item.id === line.id);
  const savedLineForm = savedLine ? reportItemToLine(savedLine) : null;
  const lineContentChanged = savedLineForm
    ? (Object.keys(line) as (keyof LineForm)[]).some(
        (key) => line[key] !== savedLineForm[key],
      )
    : [
        line.quantityDelivered,
        line.quantityAccepted,
        line.secondaryQuantityDelivered,
        line.secondaryQuantityAccepted,
        line.rejectionReason,
        line.sourceLotCode,
        line.manufacturedOn,
        line.useByDate,
      ].some((value) => value.trim() !== "");
  const hasUnsavedLine = Boolean(isDraft && (lineItemSelectedByManager || lineContentChanged));
  const hasOtherUnsavedLines = Object.keys(stagedLineForms).length > 0;
  const hasUnsavedNewDraft = isCreating && (
    (Object.keys(header) as (keyof HeaderForm)[]).some(
      (key) => header[key] !== newDraftBaseline.current[key],
    ) || emergencyReason.trim() !== "" || emergencyInspector.trim() !== ""
  );
  const hasUnsavedFollowUp = Boolean(shortfallReason.trim());
  const confirmDiscardChanges = () =>
    !(hasUnsavedHeader || hasUnsavedLine || hasOtherUnsavedLines || hasUnsavedNewDraft || hasUnsavedFollowUp || lineItemSelectedByManager) ||
    window.confirm("Discard unsaved Receiving changes?");
  const confirmDiscardLine = () =>
    !(hasUnsavedLine || lineItemSelectedByManager) ||
    window.confirm("Discard unsaved line edits?");
  const clearLine = () => {
    if (!confirmDiscardLine()) return;
    setLine(createEmptyLine());
    setLineSaveError("");
    setLineItemSelectedByManager(false);
    setStagedLineForms((current) => {
      const next = { ...current };
      delete next[line.inventoryItemId];
      return next;
    });
  };
  useEffect(() => {
    setLineFieldError(null);
    setLineSaveError("");
    setLineSaveStatus("idle");
  }, [line]);
  const fieldError = (id: string) => lineFieldError?.id === id ? lineFieldError.message : undefined;

  const loadWorkspace = useCallback(
    async (reportId: string | null = null, showLoading = true) => {
      const version = ++workspaceLoadVersion.current;
      if (showLoading) setIsLoading(true);
      setError("");
      try {
        const result = await getReceivingWorkspace(reportId);
        const evidence = result.selectedReport
          ? await getReceivingPolicyEvidence(result.selectedReport.id)
          : null;
        const documents =
          evidence?.classification === "formal_request"
            ? await getInventoryRequestRegister()
            : [];
        if (version !== workspaceLoadVersion.current) return null;
        setPolicyEvidence(evidence);
        setWorkspace(result);
        loadedReportId.current = result.selectedReport?.id ?? null;
        setLinkedRequestForReport(null);
        const document =
          documents.find((row) =>
            row.receipts.some(
              (receipt) => receipt.id === result.selectedReport?.id,
            ),
          ) ?? null;
        setLinkedDocument(document);
        setFailedReportId(null);
        setListRevision((value) => value + 1);
        if (result.selectedReport) {
          setHeader(reportToHeader(result.selectedReport));
          setIsCreating(false);
          if (result.selectedReport.status === "draft" && document) {
            const nextItem =
              document.lines.find(
                (item) =>
                  item.remaining > 0 &&
                  !result.selectedReport?.items.some(
                    (saved) => saved.inventoryItemId === item.inventory_item_id,
                  ),
              ) ?? document.lines.find((item) => item.remaining > 0);
            setLine((current) =>
              current.inventoryItemId ||
              current.quantityDelivered ||
              current.quantityAccepted
                ? current
                : {
                    ...current,
                    inventoryItemId: nextItem?.inventory_item_id ?? "",
                  },
            );
          }
          if (
            result.selectedReport.id === initialReportId && linkedRequest
          ) {
            setLine((current) => ({
              ...current,
              inventoryItemId:
                linkedRequest.inventory_item_id,
            }));
          }
        }
        return result;
      } catch (caught) {
        if (version !== workspaceLoadVersion.current) return null;
        setWorkspace(null);
        setPolicyEvidence(null);
        setLinkedRequestForReport(null);
        setLinkedDocument(null);
        // Keep a confirmed posting result if only its follow-up read failed.
        setPostResult((current) =>
          current?.receivingReportId === reportId ? current : null,
        );
        setReviewOpen(false);
        setIsCreating(false);
        setNotice("");
        setFailedReportId(reportId);
        setError(
          getErrorMessage(caught, "Unable to load the receiving workspace."),
        );
        return null;
      } finally {
        if (version === workspaceLoadVersion.current) setIsLoading(false);
      }
    },
    [initialReportId, linkedRequest],
  );

  useEffect(() => {
    if (loadedReportId.current === (initialReportId ?? null)) return;
    if (initialReportId) setView("workspace");
    if (pendingPost) {
      void reconcilePost(pendingPost);
    } else {
      void loadWorkspace(initialReportId ?? null);
    }
  }, [initialReportId, loadWorkspace]);

  const selectedProductionItem = useMemo(
    () =>
      workspace?.inventoryItems.find(
        (item) => item.id === line.inventoryItemId,
      ) ?? null,
    [line.inventoryItemId, workspace?.inventoryItems],
  );
  const selectedLineItem = selectedProductionItem;
  const linkedLine = activeLinkedDocument?.lines.find(
    (item) => item.inventory_item_id === line.inventoryItemId,
  );
  const acceptedInOtherDraftLines = (selectedReport?.items ?? [])
    .filter(
      (item) =>
        item.inventoryItemId === line.inventoryItemId && item.id !== line.id,
    )
    .reduce((sum, item) => sum + item.quantityAccepted, 0);
  const linkedOpenForLine = linkedLine
    ? Math.max(0, linkedLine.remaining - acceptedInOtherDraftLines)
    : null;
  const savedInThisDraft = (selectedReport?.items ?? [])
    .filter((item) => item.inventoryItemId === line.inventoryItemId)
    .reduce((sum, item) => sum + item.quantityAccepted, 0);
  const additionalDraftCapacity = linkedLine
    ? Math.max(0, linkedLine.remaining - savedInThisDraft)
    : null;

  const delivered = Number(line.quantityDelivered);
  const accepted = Number(line.quantityAccepted);
  const rejected =
    Number.isFinite(delivered) && Number.isFinite(accepted)
      ? Math.max(0, delivered - accepted)
      : 0;
  const secondaryDelivered = Number(line.secondaryQuantityDelivered);
  const secondaryAccepted = Number(line.secondaryQuantityAccepted);
  const secondaryRejected =
    Number.isFinite(secondaryDelivered) && Number.isFinite(secondaryAccepted)
      ? Math.max(0, secondaryDelivered - secondaryAccepted)
      : 0;
  const qualityNeedsAttention = Boolean(
    (selectedLineItem?.expiryRequired && !line.useByDate) ||
    ((rejected > 0 || secondaryRejected > 0) && !line.rejectionReason.trim()) ||
    fieldError("line-rejection-reason") || fieldError("line-use-by") || fieldError("line-manufactured"),
  );

  const startNewDraft = () => {
    if (!confirmDiscardChanges()) return;
    clearReceivingDraftRequestId();
    const emptyHeader = createEmptyHeader();
    newDraftBaseline.current = emptyHeader;
    setHeader(emptyHeader);
    setLine(createEmptyLine());
    setLineItemSelectedByManager(false);
    setStagedLineForms({});
    setIsCreating(true);
    setView("workspace");
    setStage("inspect");
    setError("");
    setNotice("");
    setPostResult(null);
    setPolicyEvidence(null);
    setEmergencyReason("");
    setEmergencyInspector("");
    setWorkspace((current) =>
      current ? { ...current, selectedReport: null } : current,
    );
    loadedReportId.current = null;
    onSelectReport?.(null);
  };

  const selectReport = async (reportId: string, alreadyConfirmed = false): Promise<boolean> => {
    if (pendingPost) return false;
    if (!alreadyConfirmed && !confirmDiscardChanges()) return false;
    setLine(createEmptyLine());
    setLineItemSelectedByManager(false);
    setStagedLineForms({});
    setNotice("");
    setPostResult(null);
    const result = await loadWorkspace(reportId);
    if (result?.selectedReport?.id === reportId) {
      setView("workspace");
      setStage("inspect");
      onSelectReport?.(reportId);
      return true;
    }
    return false;
  };

  const normalizedHeader = (): Omit<
    ReceivingDraftHeaderInput,
    "requestId" | "reportId"
  > | null => {
    const receivedDate = new Date(header.receivedAt);
    if (Number.isNaN(receivedDate.getTime())) {
      setError("Choose a valid received date and time.");
      return null;
    }
    return {
      sourceType: header.sourceType,
      sourceReference: header.sourceReference.trim(),
      purchaseOrderId: null,
      receivedAt: receivedDate.toISOString(),
      supplierDeliveryReference: "",
    };
  };

  const saveHeader = async () => {
    if (isSavingHeader) return;
    const input = normalizedHeader();
    if (!input) return;
    setIsSavingHeader(true);
    setError("");
    setNotice("");
    try {
      if (isCreating) {
        if (!emergencyReason.trim() || !emergencyInspector.trim()) {
          setError(
            "For Production delivery without an issued request, enter the Manager emergency reason and physical inspector.",
          );
          return;
        }
        await verifyReceivingPolicyAvailable();
        const fingerprint = JSON.stringify(input);
        const requestId = getOrCreateReceivingDraftRequestId(fingerprint);
        const result = await createEmergencyProductionReceiving({
          reportId: requestId,
          receivedAt: input.receivedAt,
          sourceReference: input.sourceReference,
          reason: emergencyReason.trim(),
          inspectedByName: emergencyInspector.trim(),
        });
        clearReceivingDraftRequestId(requestId);
        setNotice(`${result.rrNumber} was saved as a draft. No stock moved.`);
        const reloaded = await loadWorkspace(result.id, false);
        if (reloaded?.selectedReport?.id === result.id) {
          setStage("inspect");
          onSelectReport?.(result.id);
        }
      } else if (selectedReport) {
        await updateReceivingDraft({ ...input, reportId: selectedReport.id });
        setNotice("Draft details saved. No stock moved.");
        await loadWorkspace(selectedReport.id, false);
      }
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to save the receiving draft."));
    } finally {
      setIsSavingHeader(false);
    }
  };

  const validateLine = (): string | null => {
    if (!selectedLineItem) return "Select an inventory or purchase-order item.";
    if (!Number.isFinite(delivered) || delivered <= 0) {
      return "Delivered quantity must be greater than zero.";
    }
    if (!Number.isFinite(accepted) || accepted < 0 || accepted > delivered) {
      return "Accepted quantity must be between zero and delivered quantity.";
    }
    if (linkedOpenForLine !== null && accepted > linkedOpenForLine) {
      return `Accepted quantity exceeds the ${quantityFormatter.format(linkedOpenForLine)} ${linkedLine?.unit} still open for this request item. Record excess delivered goods as rejected with a reason.`;
    }
    if (
      (rejected > 0 || secondaryRejected > 0) &&
      !line.rejectionReason.trim()
    ) {
      return "Enter a rejection reason whenever any quantity is rejected.";
    }
    if (selectedLineItem.secondaryUnit) {
      if (
        !Number.isFinite(secondaryDelivered) ||
        secondaryDelivered <= 0 ||
        !Number.isFinite(secondaryAccepted) ||
        secondaryAccepted < 0 ||
        secondaryAccepted > secondaryDelivered ||
        (accepted === 0) !== (secondaryAccepted === 0)
      ) {
        return `Enter valid delivered and accepted quantities in ${selectedLineItem.secondaryUnit}; no conversion is assumed.`;
      }
    }
    const effectiveUseBy = line.useByDate;
    if (selectedLineItem.expiryRequired && !effectiveUseBy) {
      return "Enter the item's required use-by date. Follow its configured policy; no universal two-day rule applies.";
    }
    if (
      line.manufacturedOn &&
      effectiveUseBy &&
      line.manufacturedOn > effectiveUseBy
    ) {
      return "The manufactured date cannot be after the use-by date.";
    }
    return null;
  };

  const saveLine = async () => {
    if (!selectedReport || !isDraft || savingLineRef.current) return;
    const validationError = validateLine();
    if (validationError) {
      setLineSaveStatus("failed");
      setLineSaveError(validationError);
      setError(
        `${selectedLineItem?.itemName ?? "Receiving line"}: ${validationError}`,
      );
      const fieldId = !selectedLineItem
        ? "receiving-line-item"
        : !Number.isFinite(delivered) || delivered <= 0
          ? "line-delivered"
          : !Number.isFinite(accepted) ||
              accepted < 0 ||
              accepted > delivered ||
              (linkedOpenForLine !== null && accepted > linkedOpenForLine)
            ? "line-accepted"
            : (rejected > 0 || secondaryRejected > 0) &&
                !line.rejectionReason.trim()
              ? "line-rejection-reason"
              : selectedLineItem?.secondaryUnit &&
                  (!Number.isFinite(secondaryDelivered) || secondaryDelivered <= 0)
                ? "line-secondary-delivered"
                : selectedLineItem?.secondaryUnit &&
                    (!Number.isFinite(secondaryAccepted) ||
                      secondaryAccepted < 0 ||
                      secondaryAccepted > secondaryDelivered ||
                      (accepted === 0) !== (secondaryAccepted === 0))
                  ? "line-secondary-accepted"
                  : line.manufacturedOn &&
                      line.useByDate &&
                      line.manufacturedOn > line.useByDate
                    ? "line-manufactured"
                  : selectedLineItem?.expiryRequired && !line.useByDate
                    ? "line-use-by"
              : "receiving-line-editor";
      setLineFieldError({ id: fieldId, message: validationError });
      requestAnimationFrame(() => document.getElementById(fieldId)?.focus());
      return;
    }
    setLineFieldError(null);
    setLineSaveError("");
    savingLineRef.current = true;
    setLineSaveStatus("saving");
    setIsSavingLine(true);
    setError("");
    setNotice("");
    try {
      await saveReceivingLine({
        reportId: selectedReport.id,
        itemId: line.id,
        inventoryItemId: line.inventoryItemId,
        purchaseOrderItemId: null,
        quantityDelivered: delivered,
        quantityAccepted: accepted,
        secondaryQuantityDelivered: selectedLineItem?.secondaryUnit
          ? secondaryDelivered
          : null,
        secondaryQuantityAccepted: selectedLineItem?.secondaryUnit
          ? secondaryAccepted
          : null,
        rejectionReason: line.rejectionReason.trim(),
        sourceLotCode: line.sourceLotCode.trim(),
        manufacturedOn: line.manufacturedOn || null,
        useByDate: line.useByDate || null,
      });
      setLine({
        ...createEmptyLine(),
        inventoryItemId: activeLinkedRequest?.inventory_item_id ?? "",
      });
      setLineItemSelectedByManager(false);
      setStagedLineForms((current) => {
        const next = { ...current };
        delete next[line.inventoryItemId];
        return next;
      });
      setNotice("Receiving line saved to the draft. No stock moved.");
      await loadWorkspace(selectedReport.id, false);
      setLineSaveStatus("saved");
      focusSection(activeLinkedDocument ? "receiving-items-table" : "receiving-line-editor");
    } catch (caught) {
      setLineSaveStatus("failed");
      const message = getErrorMessage(caught, "Unable to save the receiving line.");
      setError(message);
      setLineSaveError(message);
      requestAnimationFrame(() => document.getElementById("receiving-line-save-error")?.focus());
    } finally {
      savingLineRef.current = false;
      setIsSavingLine(false);
    }
  };

  const removeLine = async (itemId: string) => {
    if (!selectedReport || removingLineId) return;
    const removingItem = selectedReport.items.find((item) => item.id === itemId);
    if (removingItem && ((line.id === itemId && hasUnsavedLine) || stagedLineForms[removingItem.inventoryItemId]) &&
        !window.confirm("Discard unsaved inspection edits and remove this saved line?")) return;
    setRemovingLineId(itemId);
    setError("");
    setNotice("");
    try {
      await removeReceivingLine(selectedReport.id, itemId);
      if (line.id === itemId) {
        setLine(createEmptyLine());
        setLineItemSelectedByManager(false);
      }
      if (removingItem) setStagedLineForms((current) => {
        const next = { ...current };
        delete next[removingItem.inventoryItemId];
        return next;
      });
      setNotice("Line removed from the draft. No stock moved.");
      await loadWorkspace(selectedReport.id, false);
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to remove the receiving line."));
    } finally {
      setRemovingLineId(null);
    }
  };

  const deleteDraft = async () => {
    if (!selectedReport || isDeleting) return;
    if (!confirmDiscardChanges()) return;
    if (!window.confirm(`Delete empty draft ${selectedReport.rrNumber}?`))
      return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteEmptyReceivingDraft(selectedReport.id);
      setNotice(`${selectedReport.rrNumber} was deleted.`);
      setHeader(createEmptyHeader());
      setLine(createEmptyLine());
      setLineItemSelectedByManager(false);
      await loadWorkspace(null, false);
      setView("queue");
      onSelectReport?.(null);
    } catch (caught) {
      setError(getErrorMessage(caught, "Unable to delete the draft."));
    } finally {
      setIsDeleting(false);
    }
  };

  const reconcilePost = async (outcome: PendingPost) => {
    const request = loadWorkspace(outcome.reportId, false);
    const version = workspaceLoadVersion.current;
    const latest = await request;
    if (version !== workspaceLoadVersion.current) return;

    const report = latest?.selectedReport;
    if (report?.id === outcome.reportId && report.status === "posted") {
      rememberPendingPost(null);
      setError("");
      if (outcome.confirmedResult) {
        setPostResult(outcome.confirmedResult);
        setNotice("");
      } else {
        setPostResult(null);
        setNotice(
          `${report.rrNumber} is posted. The document below is read-only.`,
        );
      }
      return;
    }

    if (
      report?.id === outcome.reportId &&
      report.status === "draft" &&
      outcome.rejectedMessage
    ) {
      rememberPendingPost(null);
      setPostResult(null);
      setError(outcome.rejectedMessage);
      return;
    }

    rememberPendingPost(outcome);
    setNotice("");
    if (outcome.confirmedResult) {
      // A confirmed RPC result must not be presented beside a stale draft.
      setWorkspace(null);
      setFailedReportId(outcome.reportId);
      setError(
        "Receiving was posted, but its details could not be refreshed. Refresh to view the posted document.",
      );
    } else {
      if (report?.id !== outcome.reportId) {
        setWorkspace(null);
        setFailedReportId(outcome.reportId);
      }
      setError(
        "The posting result is uncertain. Refresh this receiving report before taking another action. Do not post it again.",
      );
    }
  };

  const postReport = async () => {
    if (
      !selectedReport ||
      selectedReport.status !== "draft" ||
      hasUnsavedHeader ||
      hasUnsavedLine ||
      hasOtherUnsavedLines ||
      postingRef.current ||
      pendingPost
    )
      return;
    const reportId = selectedReport.id;
    postingRef.current = true;
    setIsPosting(true);
    rememberPendingPost({ reportId });
    setError("");
    setNotice("");
    try {
      const result = await postReceivingReport(reportId);
      if (result.receivingReportId !== reportId) {
        throw new Error(
          "The posting response did not match this receiving report.",
        );
      }
      setPostResult(result);
      setReviewOpen(false);
      const outcome = { reportId, confirmedResult: result };
      rememberPendingPost(outcome);
      await reconcilePost(outcome);
    } catch (caught) {
      const rejectedMessage =
        caught instanceof ReceivingPostRejectedError && !caught.alreadyPosted
          ? caught.message
          : undefined;
      setReviewOpen(false);
      const outcome = { reportId, rejectedMessage };
      rememberPendingPost(outcome);
      await reconcilePost(outcome);
    } finally {
      setIsPosting(false);
      postingRef.current = false;
    }
  };

  const startNextDelivery = async () => {
    if (!activeLinkedDocument || isStartingNext)
      return;
    setIsStartingNext(true);
    setError("");
    try {
      const draft = await startInventoryRequestReceiving(
        activeLinkedDocument.id,
        activeLinkedDocument.revision,
        nextReceiptIdRef.current,
      );
      nextReceiptIdRef.current = crypto.randomUUID();
      setLine(createEmptyLine());
      setLineItemSelectedByManager(false);
      setPostResult(null);
      const reloaded = await loadWorkspace(draft.id, false);
      if (reloaded?.selectedReport?.id !== draft.id) {
        setError(
          "The linked receiving draft was created, but its details could not be loaded. Refresh to open the draft before taking another action.",
        );
        return;
      }
      if (reloaded.selectedReport.status !== "draft") {
        setError(
          "The linked Receiving report changed status. Review the current document before taking another action.",
        );
        return;
      }
      setNotice("Next linked receiving draft opened. No stock moved.");
      setView("workspace");
      onSelectReport?.(draft.id);
    } catch (caught) {
      const actionError = getErrorMessage(
        caught,
        "Unable to open the next delivery draft.",
      );
      await loadWorkspace(selectedReport?.id ?? null, false);
      setError(actionError);
    } finally {
      setIsStartingNext(false);
    }
  };

  const closeShortfall = async () => {
    if (!activeLinkedDocument || !shortfallReason.trim() || isClosingShort)
      return;
    if (
      !window.confirm(
        `Close ${activeLinkedDocument.number} with its outstanding quantities?`,
      )
    )
      return;
    setIsClosingShort(true);
    setError("");
    try {
      await closeInventoryRequestShort(
        activeLinkedDocument.id,
        activeLinkedDocument.revision,
        shortfallReason.trim(),
      );
      setShortfallReason("");
      await loadWorkspace(selectedReport?.id ?? null, false);
      setNotice(
        "Request closed with an audited shortfall reason. Stock did not change.",
      );
    } catch (caught) {
      const actionError = getErrorMessage(
        caught,
        "Unable to close the request shortfall.",
      );
      await loadWorkspace(selectedReport?.id ?? null, false);
      setError(actionError);
    } finally {
      setIsClosingShort(false);
    }
  };

  const focusSection = (id: string) => {
    if (id === "receiving-document-details") {
      setStage("inspect");
    } else if (id === "receiving-review") {
      setStage("review");
    } else if (id === "receiving-items-table") {
      setStage("inspect");
    } else if (id === "receiving-line-editor") {
      setStage("inspect");
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const section = document.getElementById(id);
        section?.focus({ preventScroll: true });
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const selectRequestedItem = (inventoryItemId: string) => {
    if (!selectedReport || !isDraft || !activeLinkedDocument) return;
    const saved = selectedReport.items.find((item) => item.inventoryItemId === inventoryItemId);
    if (line.inventoryItemId === inventoryItemId) {
      if (saved && line.id !== saved.id && !hasUnsavedLine) setLine(reportItemToLine(saved));
      focusSection("receiving-line-editor");
      return;
    }
    const nextLine = stagedLineForms[inventoryItemId] ?? (saved ? reportItemToLine(saved) : { ...createEmptyLine(), inventoryItemId });
    setStagedLineForms((current) => {
      const next = { ...current };
      if (line.inventoryItemId && hasUnsavedLine) next[line.inventoryItemId] = line;
      delete next[inventoryItemId];
      return next;
    });
    setLine(nextLine);
    setLineItemSelectedByManager(false);
    setError("");
    focusSection("receiving-line-editor");
  };

  const editLine = (item: ReceivingReportItem) => {
    if (activeLinkedDocument) {
      selectRequestedItem(item.inventoryItemId);
      return;
    }
    if ((hasUnsavedLine || lineItemSelectedByManager) && !window.confirm("Discard unsaved line edits and open this saved line?")) return;
    setLine(reportItemToLine(item));
    setLineItemSelectedByManager(false);
    setError("");
    focusSection("receiving-line-editor");
  };

  return (
    <div className="inventory-workspace-page manager-receiving-page min-w-0 [&_button]:min-h-11 [&_button]:min-w-11">
      <header className="manager-page-header mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="manager-page-context">{view === "workspace" ? "RECEIVING" : "Inventory / Receiving"}</p>
            {onBackToItem ? (
              <button
                type="button"
                onClick={() => {
                  if (confirmDiscardChanges()) onBackToItem();
                }}
                className="mb-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ← Item stock
              </button>
            ) : null}
            <div className="manager-receiving-title-row">
              <h1>{view === "workspace" ? `Receiving · ${selectedReport?.rrNumber ?? (isCreating ? "New draft" : "Document")}` : "Receiving"}</h1>
              {view === "workspace" && selectedReport ? <span className={`manager-receiving-status ${isPosted ? "is-posted" : "is-draft"}`}>{selectedReport.status}</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === "workspace" && selectedReport
                ? <>{activeLinkedDocument ? `${activeLinkedDocument.number} Rev ${activeLinkedDocument.revision} · ` : ""}{sourceLabel(selectedReport.sourceType)} · Received {dateFormatter.format(new Date(selectedReport.receivedAt))}</>
                : "Inspect each delivery, review saved quantities, then post accepted stock."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "workspace" ? (
            <Button variant="secondary" size="sm" onClick={() => { if (confirmDiscardChanges()) { setStagedLineForms({}); setLine(createEmptyLine()); setView("queue"); } }}
              disabled={isPosting || isSavingHeader || isSavingLine || isDeleting || isStartingNext || isClosingShort}>
              ← Back to Receiving Register
            </Button>
          ) : selectedReport || isCreating ? (
            <Button variant="secondary" size="sm" onClick={() => setView("workspace")}>
              Continue {selectedReport?.rrNumber ?? "new receipt"}
            </Button>
          ) : null}
          {view === "workspace" ? <Button
            variant="secondary"
            size="sm"
            disabled={isLoading || isPosting}
            onClick={() => {
              if (pendingPost) void reconcilePost(pendingPost);
              else if (confirmDiscardChanges()) {
                setStagedLineForms({});
                setLine(createEmptyLine());
                void loadWorkspace(selectedReport?.id ?? failedReportId);
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />{" "}
            {pendingPost ? "Check posting" : "Refresh"}
          </Button> : null}
          {view === "workspace" && isDraft ? <Button
            size="sm"
            className="manager-receiving-primary-action"
            disabled={!selectedReport?.items.length || hasUnsavedHeader || hasUnsavedLine || hasOtherUnsavedLines || isSavingHeader || isSavingLine || Boolean(removingLineId) || Boolean(pendingPost)}
            onClick={() => focusSection("receiving-review")}
          >
            <PackageCheck className="h-4 w-4" /> Review &amp; Post Stock
          </Button> : null}
          {view === "queue" ? <Button
            variant="secondary"
            size="sm"
            onClick={startNewDraft}
            disabled={
              isLoading ||
              !workspace ||
              Boolean(pendingPost) ||
              isSavingHeader ||
              isSavingLine ||
              isPosting ||
              isDeleting ||
              isStartingNext ||
              isClosingShort
            }
          >
            <FilePlus2 className="h-4 w-4" /> Supplier or emergency receipt
          </Button> : null}
        </div>
      </header>
      {selectedReport && pendingPost?.reportId === selectedReport.id && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground"
        >
          Posting outcome needs verification · do not post again
        </p>
      )}

      {error ? (
        <div
          role="alert"
          className="mb-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="mb-4 flex gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}
      {activeLinkedRequest ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Linked Production request</p>
          <p>
            {activeLinkedRequest.item_name} · Requested{" "}
            {activeLinkedRequest.quantity} {activeLinkedRequest.unit}
          </p>
          <p className="mt-1 text-xs">
            Record actual delivered and accepted quantities below. The requested
            quantity is a reference, not a received quantity.
          </p>
        </div>
      ) : null}
      {postResult ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-green-300 bg-green-50 px-4 py-4 text-green-900"
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <PackageCheck className="h-5 w-5" /> {postResult.rrNumber} posted
            successfully
          </div>
          <p className="mt-1 text-xs">
            {postResult.lineCount} physical line(s) reviewed;{" "}
            {postResult.batchCount} accepted batch(es) and{" "}
            {postResult.transactionCount} ledger movement(s) created at{" "}
            {dateFormatter.format(new Date(postResult.postedAt))}.
          </p>
          <p className="mt-1 text-xs">
            Posted by {selectedReport?.postedByName || "Not recorded"}. The
            receipt below is read only.
          </p>
          <p className="mt-1 text-xs">Posted receipt: {selectedReport?.rrNumber ?? postResult.rrNumber}. Its immutable details are open below.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onOpenStockOverview ? <Button size="sm" variant="secondary" onClick={() => {
              if (confirmDiscardChanges()) onOpenStockOverview();
            }}>Stock Overview</Button> : null}
            {activeLinkedDocument && onOpenRequest ? (
              <Button size="sm" variant="secondary" onClick={() => {
                if (confirmDiscardChanges()) onOpenRequest(activeLinkedDocument.id);
              }}>
                Original request {activeLinkedDocument.number}
              </Button>
            ) : null}
            {selectedReport?.items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-1 rounded-lg border border-green-200 bg-white px-2 py-1 text-xs">
                <span className="font-semibold">{item.inventoryItemName}: +{quantityFormatter.format(item.quantityAccepted)} {item.unit} accepted</span>
                {onOpenItem ? <Button size="sm" variant="ghost" onClick={() => {
                  if (confirmDiscardChanges()) onOpenItem(item.inventoryItemId);
                }}>{stockDestinationLabel(item.inventoryItemId)}</Button> : null}
                {onOpenMovements ? <Button size="sm" variant="ghost" onClick={() => {
                  if (confirmDiscardChanges()) onOpenMovements(item.inventoryItemId, selectedReport?.rrNumber ?? postResult.rrNumber);
                }}>Movements</Button> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isLoading && !workspace ? (
        <div
          role="status"
          className="flex min-h-64 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground"
        >
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading receiving
          workspace…
        </div>
      ) : (
        <fieldset
          disabled={Boolean(pendingPost)}
          className="m-0 min-w-0 space-y-4 border-0 p-0"
        >
          <div className="manager-receiving-layout">
          <div id="receiving-register-panel" className={view === "queue" ? "min-w-0" : "hidden"}>
            <UnifiedReceivingDocuments
              compact
              autoOpenFirstReceipt={false}
              initialSearch={initialReceiptSearch}
              selectedId={selectedReport?.id ?? null}
              refreshKey={listRevision}
              disabled={Boolean(pendingPost) || isPosting || isSavingHeader || isSavingLine || isDeleting}
              beforeCreate={confirmDiscardChanges}
              onOpenReport={selectReport}
              onSelect={(id) => void selectReport(id)}
            />
          </div>
          <div className={view === "workspace" ? "manager-receiving-document min-w-0 flex flex-col gap-4" : "hidden"} data-stage={isPosted ? "posted" : stage}>
          {view === "workspace" ? <>
          <div className="manager-receiving-receipt-head rounded-xl border border-border bg-background px-4 py-4 shadow-sm">
            <h2 id="receiving-workspace-heading" tabIndex={-1} className="sr-only outline-none">Receiving workspace · {selectedReport?.rrNumber ?? "New draft"}</h2>
            <nav aria-label="Receiving workspace stages" className="manager-receiving-stages text-sm font-semibold">
              {isPosted ? <span aria-current="page" className="inline-flex min-h-11 items-center rounded-lg bg-green-100 px-3 text-green-800">Inspect ✓ <span aria-hidden="true" className="mx-2">→</span> Review ✓ <span aria-hidden="true" className="mx-2">→</span> Post ✓ · Read only</span> : <>
                <button type="button" aria-label="1 · Inspect delivery" aria-current={stage === "inspect" ? "step" : undefined} onClick={() => focusSection(activeLinkedDocument ? "receiving-items-table" : selectedReport ? "receiving-line-editor" : "receiving-document-details")} className="manager-receiving-stage focus-visible:ring-2 focus-visible:ring-primary"><span className="manager-receiving-stage-number">1</span><span><strong>Inspect delivery</strong><small>Record what arrived and inspect each item.</small></span></button>
                <span aria-hidden="true" className="manager-receiving-stage-connector" />
                <button type="button" aria-label="2 · Review" aria-current={stage === "review" ? "step" : undefined} onClick={() => focusSection("receiving-review")} disabled={!selectedReport} className="manager-receiving-stage focus-visible:ring-2 focus-visible:ring-primary"><span className="manager-receiving-stage-number">2</span><span><strong>Review saved lines</strong><small>Confirm all items and quantities are correct.</small></span></button>
                <span aria-hidden="true" className="manager-receiving-stage-connector" />
                <span className="manager-receiving-stage"><span className="manager-receiving-stage-number">3</span><span><strong>Post accepted stock</strong><small>Only accepted quantities enter inventory.</small></span></span>
              </>}
            </nav>
          </div>
          {!workspace ? (
            <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">The document workspace is unavailable. Refresh or return to the queue.</p>
          ) : (
          <>
          {activeLinkedDocument ? (
            <ReceivingAccordion staticContent id="receiving-items-table" ariaLabel="Requested and inspected quantities" title={isPosted ? "Receipt items" : "Items to Receive"} hint={`${requestItemRows.length} items`} className={stage === "inspect" && !isPosted ? "order-2" : "hidden"}>
              <div className="manager-receiving-item-toolbar">
                <p className="text-xs text-muted-foreground">Select an item to record this delivery.</p>
                <label className="sr-only" htmlFor="receiving-item-filter">Filter items to receive</label>
                <select id="receiving-item-filter" value={itemFilter} onChange={(event) => setItemFilter(event.target.value as "all" | "pending" | "saved")}>
                  <option value="all">All items</option>
                  <option value="pending">Pending</option>
                  <option value="saved">Saved</option>
                </select>
              </div>
              <ul className="manager-receiving-item-list">{visibleRequestItems.map(({ requestLine, delivered: savedDelivered, accepted: savedAccepted, savedCount }) => (
                <li key={requestLine.inventory_item_id} className={`manager-receiving-workitem rounded-lg border px-3 py-2 text-xs ${line.inventoryItemId === requestLine.inventory_item_id ? "is-selected border-green-600 bg-green-50/60" : "border-border"}`}>
                  <div className="manager-receiving-workitem-head">
                    <span className="manager-receiving-item-icon" aria-hidden="true"><Package className="h-5 w-5" /></span>
                    <div className="min-w-0"><strong className="block text-sm">{requestLine.name}</strong><span className="text-muted-foreground">{requestLine.unit} · {savedCount ? "Saved in draft" : "Pending"}</span></div>
                    <span className={`manager-receiving-item-status ${savedCount ? "is-saved" : line.inventoryItemId === requestLine.inventory_item_id ? "is-progress" : ""}`}>{savedCount ? "Saved" : line.inventoryItemId === requestLine.inventory_item_id ? "In progress" : "Not started"}</span>
                  </div>
                  <dl className="manager-receiving-workitem-values">
                    <div><dt>Requested</dt><dd>{receivingQuantity(requestLine.quantity, requestLine.unit)}</dd></div>
                    <div><dt>Previously posted</dt><dd>{isPosted ? "See history" : receivingQuantity(requestLine.accepted, requestLine.unit)}</dd></div>
                    <div><dt>Outstanding</dt><dd>{receivingQuantity(requestLine.remaining, requestLine.unit)}</dd></div>
                    <div><dt>Saved in draft</dt><dd>{receivingQuantity(savedAccepted, requestLine.unit)}</dd></div>
                  </dl>
                  {savedDelivered > savedAccepted ? <p className="manager-receiving-item-rejected">{receivingQuantity(savedDelivered - savedAccepted, requestLine.unit)} delivered but not accepted in saved lines</p> : null}
                  {isDraft ? <Button size="sm" variant="secondary" aria-label={`${savedCount ? "Edit" : "Inspect"} ${requestLine.name}`} aria-pressed={line.inventoryItemId === requestLine.inventory_item_id} onClick={() => selectRequestedItem(requestLine.inventory_item_id)}>{savedCount ? "Edit" : "Inspect"}</Button> : null}
                </li>
              ))}</ul>
              {visibleRequestItems.length === 0 ? <p className="manager-receiving-filter-empty">No {itemFilter === "saved" ? "saved" : "pending"} items in this draft.</p> : null}
            </ReceivingAccordion>
          ) : null}
          {activeLinkedDocument ? (
            <ReceivingAccordion staticContent id="receiving-linked-request" title="Linked request & delivery balance" hint={`${activeLinkedDocument.number} · Rev ${activeLinkedDocument.revision}`} className={`manager-receiving-reconciliation order-5 text-sm ${stage === "review" || isPosted ? "" : "hidden"}`}>
              {onOpenRequest ? <Button variant="secondary" size="sm" onClick={() => { if (confirmDiscardChanges()) onOpenRequest(activeLinkedDocument.id); }}>Open linked Request</Button> : null}
              <p className="mt-2 text-xs text-muted-foreground">{activeLinkedDocument.lines.filter((item) => item.remaining > 0).length} item(s) outstanding · {activeLinkedDocument.receipts.length} linked receipt(s).</p>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mt-2 text-xs">
                    Physical inspector:{" "}
                    <strong>
                      {inspectorLabel(physicalInspector)}
                    </strong>{" "}
                    · Recording Manager:{" "}
                    <strong>
                      {selectedReport?.receivedByName || "Not recorded"}
                    </strong>
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {activeLinkedDocument.lines.map((item) => {
                  const receiptLines = (selectedReport?.items ?? []).filter(
                    (saved) => saved.inventoryItemId === item.inventory_item_id,
                  );
                  const deliveredHere = receiptLines.reduce(
                    (sum, saved) => sum + saved.quantityDelivered,
                    0,
                  );
                  const acceptedHere = receiptLines.reduce(
                    (sum, saved) => sum + saved.quantityAccepted,
                    0,
                  );
                  const rejectedHere = receiptLines.reduce(
                    (sum, saved) => sum + saved.quantityRejected,
                    0,
                  );
                  const openBefore = isDraft
                    ? item.remaining
                    : item.remaining + acceptedHere;
                  const notDeliveredHere = Math.max(0, openBefore - deliveredHere);
                  const afterPost = isDraft
                    ? Math.max(0, item.remaining - acceptedHere)
                    : item.remaining;
                  return (
                    <div
                      key={item.inventory_item_id}
                      className="manager-receiving-balance rounded-lg border border-blue-200 bg-white p-3"
                    >
                      <p className="font-semibold">
                        {item.name}{" "}
                        <span className="font-normal text-blue-800">
                          · {item.unit}
                        </span>
                      </p>
                      <dl className="manager-receiving-metrics mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-blue-700">Delivered here</dt>
                          <dd className="font-semibold">
                            {quantityFormatter.format(deliveredHere)} {item.unit}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-blue-700">Accepted here</dt>
                          <dd className="font-semibold text-green-700">
                            {quantityFormatter.format(acceptedHere)} {item.unit}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-blue-700">Rejected here</dt>
                          <dd className="font-semibold text-red-700">
                            {quantityFormatter.format(rejectedHere)} {item.unit}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-blue-700">
                            {isDraft ? "Outstanding if posted" : "Outstanding now"}
                          </dt>
                          <dd className="font-bold">
                            {quantityFormatter.format(afterPost)} {item.unit}
                          </dd>
                        </div>
                      </dl>
                      <details className="mt-3 border-t border-blue-100 pt-2 text-xs">
                        <summary className="min-h-11 cursor-pointer py-3 font-semibold text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          Request balance details
                        </summary>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 pb-2 sm:grid-cols-3">
                          <div><dt className="text-blue-700">Originally requested</dt><dd className="font-semibold">{quantityFormatter.format(item.quantity)} {item.unit}</dd></div>
                          <div><dt className="text-blue-700">{isDraft ? "Previously accepted and posted" : "Accepted and posted to date"}</dt><dd className="font-semibold">{quantityFormatter.format(item.accepted)} {item.unit}</dd></div>
                          <div><dt className="text-blue-700">Open before this receipt</dt><dd className="font-semibold">{quantityFormatter.format(openBefore)} {item.unit}</dd></div>
                          <div><dt className="text-blue-700">Not delivered this visit</dt><dd className="font-semibold">{quantityFormatter.format(notDeliveredHere)} {item.unit}</dd></div>
                        </dl>
                      </details>
                      {isDraft && deliveredHere > item.remaining ? (
                        <p className="mt-2 text-xs font-semibold text-amber-800">
                          Delivered exceeds the open amount by{" "}
                          {quantityFormatter.format(deliveredHere - item.remaining)}{" "}
                          {item.unit}. Excess cannot be accepted into stock; enter
                          it as rejected with a reason.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs">
                A request item absent from this receipt is not delivered, not
                rejected.{" "}
                {activeLinkedDocument.status === "closed_short"
                  ? "This request was closed with a documented shortfall; no further linked delivery can be recorded."
                  : activeLinkedDocument.status === "fulfilled"
                    ? "All requested quantities were accepted and posted. This request is fulfilled."
                    : isPosted
                      ? "This request remains open for another inspected delivery or a documented shortfall closure."
                      : "Once this draft is posted, another linked delivery or a documented shortfall closure can be recorded below while the request remains open."}
              </p>
              {isPosted &&
              (activeLinkedDocument.status === "issued" ||
                activeLinkedDocument.status === "partially_received") &&
              activeLinkedDocument.lines.some((item) => item.remaining > 0) ? (
                <div className="mt-4 space-y-3 border-t border-blue-200 pt-4">
                  <div className="rounded-lg border border-blue-200 bg-white p-3">
                    <h3 className="font-bold">Record another delivery</h3>
                    <p className="mt-1 text-xs">
                      Start only when you personally inspect this delivery. Your authenticated Manager account is recorded as inspector. One linked draft can be open at a time.
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      disabled={
                        activeLinkedDocument.receipts.some(
                          (receipt) => receipt.status === "draft",
                        ) ||
                        isStartingNext ||
                        isClosingShort
                      }
                      loading={isStartingNext}
                      onClick={() => void startNextDelivery()}
                    >
                      Start Receiving
                    </Button>
                  </div>
                  <details className="rounded-lg border border-blue-200 bg-white px-3">
                    <summary className="min-h-11 cursor-pointer py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Close remaining shortfall</summary>
                    <div className="border-t border-border pb-3 pt-2">
                    <p className="mt-1 text-xs">
                      Use only when no further delivery is expected. The reason is
                      audited; closing does not add stock.
                    </p>
                    <label
                      htmlFor="shortfall-reason"
                      className="mt-3 block text-xs font-semibold"
                    >
                      Shortfall reason
                    </label>
                    <input
                      id="shortfall-reason"
                      className={`${inputClass} mt-1 w-full`}
                      value={shortfallReason}
                      onChange={(event) => setShortfallReason(event.target.value)}
                    />
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="secondary"
                      disabled={
                        !shortfallReason.trim() ||
                        activeLinkedDocument.receipts.some(
                          (receipt) => receipt.status === "draft",
                        ) ||
                        isStartingNext ||
                        isClosingShort
                      }
                      loading={isClosingShort}
                      onClick={() => void closeShortfall()}
                    >
                      Review and close shortfall
                    </Button>
                    </div>
                  </details>
                </div>
              ) : null}
            </ReceivingAccordion>
          ) : null}
          {selectedReport ? (
            <ReceivingAccordion staticContent id="receiving-audit-history" title="Audit timeline & receipt history" hint={activeLinkedDocument ? `${activeLinkedDocument.receipts.length} linked receipt(s)` : "Current receipt"} className={isPosted ? "order-6" : "hidden"}>
              {activeLinkedDocument ? (
                <div className="space-y-3 text-xs">
                  <ul className="divide-y divide-border" aria-label="Linked receipt history">
                    {activeLinkedDocument.receipts.map((receipt) => <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span><strong>{receipt.number}</strong> · {receipt.status}{receipt.posted_at ? ` · Posted ${dateFormatter.format(new Date(receipt.posted_at))}` : ""}</span>
                      {receipt.id !== selectedReport.id ? <Button variant="secondary" size="sm" onClick={() => void selectReport(receipt.id)}>Open receipt</Button> : <span className="font-semibold text-primary">Current receipt</span>}
                    </li>)}
                  </ul>
                  {activeLinkedDocument.events.length > 0 ? <ul className="divide-y divide-border" aria-label="Request audit events">{activeLinkedDocument.events.map((event, index) => <li key={`${event.at}-${event.type}-${index}`} className="py-2">{dateFormatter.format(new Date(event.at))} · {event.type} · Rev {event.revision} · {event.actor}</li>)}</ul> : null}
                </div>
              ) : <p className="text-xs text-muted-foreground">Received {dateFormatter.format(new Date(selectedReport.receivedAt))}{selectedReport.postedAt ? ` · Posted ${dateFormatter.format(new Date(selectedReport.postedAt))}` : " · Draft"}. No linked formal-request history is available for this receipt.</p>}
            </ReceivingAccordion>
          ) : null}
          <div className="contents">
            {!selectedReport && !isCreating ? (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <p className="font-semibold">No receipt selected</p>
                <p className="mt-1 text-muted-foreground">
                  Return to the queue to choose a document or start a Production delivery, or use the Manager emergency receipt for an exception.
                </p>
              </div>
            ) : (
              <>
                {selectedReport && isDraft && (!activeLinkedDocument || line.inventoryItemId) ? (
                  <ReceivingAccordion staticContent id="receiving-line-editor" title={`${selectedReport.items.some((item) => item.id === line.id) ? "Edit inspection" : "Inspect item"}${linkedLine || selectedLineItem ? ` — ${linkedLine?.name ?? selectedLineItem?.itemName}` : ""}`} className={stage === "inspect" ? "order-3" : "hidden"}>
                    {fieldError("receiving-line-editor") && (
                      <p role="alert" className="mb-3 text-xs font-semibold text-red-700">{fieldError("receiving-line-editor")}</p>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {!activeLinkedDocument ? <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
                        <label
                          htmlFor="receiving-line-item"
                          className="text-xs font-semibold"
                        >
                          Foodhouse inventory item
                        </label>
                        <select
                          id="receiving-line-item"
                          aria-invalid={Boolean(fieldError("receiving-line-item"))}
                          aria-describedby={fieldError("receiving-line-item") ? "receiving-line-item-error" : undefined}
                          className={inputClass}
                          disabled={Boolean(activeLinkedRequest)}
                          value={line.inventoryItemId}
                          onChange={(event) => {
                            if (!confirmDiscardLine()) return;
                            setLineItemSelectedByManager(true);
                            setLine((current) => ({
                              ...createEmptyLine(),
                              id: current.id,
                              inventoryItemId: event.target.value,
                            }));
                            setError("");
                          }}
                        >
                          <option value="">Select item…</option>
                          {(workspace?.inventoryItems ?? []).map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.itemName} · {item.unit}
                                    {item.secondaryUnit
                                      ? ` / ${item.secondaryUnit}`
                                      : ""}
                                  </option>
                                ))}
                        </select>
                        {fieldError("receiving-line-item") && <p id="receiving-line-item-error" className="text-xs text-red-700">{fieldError("receiving-line-item")}</p>}
                      </div> : null}
                      {selectedLineItem ? (
                        <div className="manager-receiving-inspect-hero sm:col-span-2 lg:col-span-4">
                          <span className="manager-receiving-item-icon" aria-hidden="true"><Package className="h-5 w-5" /></span>
                          <div className="min-w-0">
                            <strong>{linkedLine?.name ?? selectedLineItem.itemName}</strong>
                            <p>Unit: {selectedLineItem.unit} <span aria-hidden="true">|</span> Secondary: {selectedLineItem.secondaryUnit ?? "None"} <span aria-hidden="true">|</span> Rotation: {selectedLineItem.rotationPolicy.toUpperCase()} <span aria-hidden="true">|</span> Expiry: {selectedLineItem.expiryRequired ? "Required" : "Optional"}</p>
                          </div>
                          {selectedReport.items.length > 0 ? <Button variant="ghost" size="sm" onClick={() => focusSection("receiving-saved-lines")}>Saved lines</Button> : null}
                        </div>
                      ) : null}
                      {linkedLine ? (
                        <div className="manager-receiving-selected-summary rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 sm:col-span-2 lg:col-span-4">
                          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div><dt>Requested</dt><dd className="font-bold">{receivingQuantity(linkedLine.quantity, linkedLine.unit)}</dd></div>
                            <div><dt>Previously posted</dt><dd className="font-bold">{receivingQuantity(linkedLine.accepted, linkedLine.unit)}</dd></div>
                            <div><dt>Outstanding</dt><dd className="font-bold">{receivingQuantity(linkedLine.remaining, linkedLine.unit)}</dd></div>
                            <div><dt>Saved in this draft</dt><dd className="font-bold">{receivingQuantity(savedInThisDraft, linkedLine.unit)}</dd></div>
                          </dl>
                          <details className="manager-receiving-capacity-details"><summary>Delivery balance details</summary><p>{line.id ? `${receivingQuantity(linkedOpenForLine ?? 0, linkedLine.unit)} available while editing, including this saved line. ` : `${receivingQuantity(additionalDraftCapacity ?? 0, linkedLine.unit)} additional capacity. `}After posting this draft, {receivingQuantity(Math.max(0, linkedLine.remaining - savedInThisDraft), linkedLine.unit)} would remain outstanding.</p></details>
                          {Number.isFinite(delivered) &&
                          line.quantityDelivered !== "" &&
                          linkedOpenForLine !== null &&
                          delivered > linkedOpenForLine ? (
                            <p className="mt-1 font-semibold text-amber-800">
                              Overdelivery:{" "}
                              {quantityFormatter.format(
                                delivered - linkedOpenForLine,
                              )}{" "}
                              {linkedLine.unit} above the open amount.
                              Acceptance is capped at the open amount; document
                              the excess as rejected with a reason.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <NumberField
                        id="line-delivered"
                        error={fieldError("line-delivered")}
                        label={`Delivered${selectedLineItem ? ` (${selectedLineItem.unit})` : ""}`}
                        value={line.quantityDelivered}
                        onChange={(value) =>
                          setLine((current) => ({
                            ...current,
                            quantityDelivered: value,
                          }))
                        }
                      />
                      <NumberField
                        id="line-accepted"
                        error={fieldError("line-accepted")}
                        label={`Accepted${selectedLineItem ? ` (${selectedLineItem.unit})` : ""}`}
                        value={line.quantityAccepted}
                        onChange={(value) =>
                          setLine((current) => ({
                            ...current,
                            quantityAccepted: value,
                          }))
                        }
                      />
                      <ReadOnlyQuantity
                        label="Rejected"
                        value={rejected}
                        unit={selectedLineItem?.unit}
                        tone={rejected > 0 ? "red" : "neutral"}
                      />
                      {linkedLine && line.quantityDelivered !== "" ? (
                        <ReadOnlyQuantity
                          label="Not delivered this visit"
                          value={Math.max(
                            0,
                            (linkedOpenForLine ?? 0) - delivered,
                          )}
                          unit={linkedLine.unit}
                          tone="neutral"
                        />
                      ) : null}
                      {selectedLineItem?.secondaryUnit ? (
                        <>
                          <NumberField
                            id="line-secondary-delivered"
                            error={fieldError("line-secondary-delivered")}
                            label={`Delivered (${selectedLineItem.secondaryUnit})`}
                            value={line.secondaryQuantityDelivered}
                            onChange={(value) =>
                              setLine((current) => ({
                                ...current,
                                secondaryQuantityDelivered: value,
                              }))
                            }
                          />
                          <NumberField
                            id="line-secondary-accepted"
                            error={fieldError("line-secondary-accepted")}
                            label={`Accepted (${selectedLineItem.secondaryUnit})`}
                            value={line.secondaryQuantityAccepted}
                            onChange={(value) =>
                              setLine((current) => ({
                                ...current,
                                secondaryQuantityAccepted: value,
                              }))
                            }
                          />
                          <ReadOnlyQuantity
                            label={`Rejected (${selectedLineItem.secondaryUnit})`}
                            value={secondaryRejected}
                            unit={selectedLineItem.secondaryUnit}
                            tone={secondaryRejected > 0 ? "red" : "neutral"}
                          />
                        </>
                      ) : null}
                      <p className="manager-receiving-quantity-note sm:col-span-2 lg:col-span-4"><Info aria-hidden="true" className="h-4 w-4" />Only accepted quantities are added to inventory when posted. Saving this line leaves stock unchanged.</p>
                      <details key={`quality-${line.id}-${line.inventoryItemId}`} className="rounded-lg border border-border px-3 sm:col-span-2 lg:col-span-4" onToggle={(event) => { if (qualityNeedsAttention && !event.currentTarget.open) event.currentTarget.open = true; }} ref={(element) => {
                        if (element && !element.dataset.initialized) {
                          element.open = Boolean(selectedLineItem?.expiryRequired || line.rejectionReason || line.sourceLotCode || line.manufacturedOn || line.useByDate || rejected > 0 || secondaryRejected > 0);
                          element.dataset.initialized = "true";
                        }
                        if (element && qualityNeedsAttention) element.open = true;
                      }}>
                        <summary className="min-h-11 cursor-pointer py-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Quality, Lot and Expiry{selectedLineItem?.expiryRequired ? " · expiry required" : ""}{rejected > 0 || secondaryRejected > 0 ? " · rejection reason required" : ""}</summary>
                        <div className="grid gap-3 border-t border-border py-3 sm:grid-cols-2">
                      <TextField
                        id="line-lot"
                        label="Source lot / batch"
                        value={line.sourceLotCode}
                        placeholder="Optional"
                        onChange={(value) =>
                          setLine((current) => ({
                            ...current,
                            sourceLotCode: value,
                          }))
                        }
                      />
                      <DateField
                        id="line-use-by"
                        error={fieldError("line-use-by")}
                        label={`Use by${selectedLineItem?.expiryRequired ? " *" : ""}`}
                        value={line.useByDate}
                        onChange={(value) =>
                          setLine((current) => ({
                            ...current,
                            useByDate: value,
                          }))
                        }
                      />
                      {rejected > 0 || secondaryRejected > 0 || line.rejectionReason ? <TextField
                        id="line-rejection-reason"
                        error={fieldError("line-rejection-reason")}
                        label="Rejection reason"
                        value={line.rejectionReason}
                        placeholder={rejected > 0 || secondaryRejected > 0 ? "Required" : "Optional"}
                        onChange={(value) => setLine((current) => ({ ...current, rejectionReason: value }))}
                      /> : null}
                      <details className="manager-receiving-extra-quality sm:col-span-2 lg:col-span-4" open={Boolean(line.manufacturedOn || fieldError("line-manufactured"))}>
                        <summary>Additional quality details</summary>
                        <div>
                          <DateField
                            id="line-manufactured"
                            error={fieldError("line-manufactured")}
                            label="Manufactured on"
                            value={line.manufacturedOn}
                            onChange={(value) => setLine((current) => ({ ...current, manufacturedOn: value }))}
                          />
                          <p className="text-xs text-muted-foreground">Use the item's recorded expiry policy and actual inspection evidence. Manufactured date, when recorded, cannot be after the use-by date.</p>
                        </div>
                      </details>
                        </div>
                      </details>
                    </div>
                    {lineSaveError ? (
                      <p id="receiving-line-save-error" tabIndex={-1} role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 focus-visible:ring-2 focus-visible:ring-red-700">
                        Line not saved: {lineSaveError}
                      </p>
                    ) : null}
                    <div className="manager-receiving-save-actions mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSavingLine}
                        onClick={clearLine}
                      >
                        {selectedReport.items.some((item) => item.id === line.id) ? "Cancel edit" : "Clear"}
                      </Button>
                      <Button
                        size="sm"
                        className="manager-receiving-primary-action"
                        loading={isSavingLine}
                        onClick={() => void saveLine()}
                      >
                        <Save className="h-4 w-4" /> {isSavingLine ? "Saving…" : selectedReport.items.some((item) => item.id === line.id) ? "Update Saved Line" : "Save Line to Draft"}
                      </Button>
                    </div>
                    <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
                      {lineSaveStatus === "saving" ? "Saving inspection line…" : lineSaveStatus === "saved" ? "Saved to draft. No stock moved." : lineSaveStatus === "failed" ? "Save failed. Review the error above; entered values remain." : ""}
                    </p>
                  </ReceivingAccordion>
                ) : null}

                <div className="manager-receiving-right-rail contents">
          {selectedReport ? (
            <div className="manager-receiving-context rounded-xl border border-border bg-card px-4 py-3 text-xs">
              <div className="manager-receiving-context-heading">
                <h2>{isPosted ? "Receipt Progress" : "Draft Progress"}</h2>
                <span>{activeLinkedDocument ? `${requestedItemsWithSavedLines} of ${requestItemRows.length} items with saved lines` : `${selectedReport.items.length} saved line${selectedReport.items.length === 1 ? "" : "s"}`}</span>
              </div>
              <div className="manager-receiving-progress-tiles">
                <div><ClipboardCheck aria-hidden="true" /><strong>{activeLinkedDocument ? requestItemRows.length : selectedReport.items.length}</strong><span>{activeLinkedDocument ? "Requested items" : "Receipt items"}</span></div>
                <div><FileText aria-hidden="true" /><strong>{selectedReport.items.length}</strong><span>Saved lines</span></div>
                <div><Truck aria-hidden="true" /><strong>{isPosted ? selectedReport.items.filter((item) => item.quantityAccepted > 0).length : 0}</strong><span>Posted to stock</span></div>
                <div><ArrowRightLeft aria-hidden="true" /><strong>{isPosted ? "Posted" : "Draft"}</strong><span>Stock {isPosted ? "updated" : "unchanged"}</span></div>
              </div>
              <p className="manager-receiving-context-status">{isPosted ? "Posted record · read only" : hasUnsavedHeader || hasUnsavedLine || hasOtherUnsavedLines ? "Unsaved changes · save before review" : selectedReport.items.length ? "Saved inspection · ready to review" : "Inspection needed"}</p>
              {isDraft && activeLinkedDocument ? <progress className="manager-receiving-progress mt-2 w-full" value={requestedItemsWithSavedLines} max={Math.max(requestItemRows.length, 1)} aria-label={`${requestedItemsWithSavedLines} of ${requestItemRows.length} requested items with saved receiving lines`} /> : null}
            </div>
          ) : null}
                {selectedReport ? (
                  <ReceivingAccordion staticContent id="receiving-saved-lines" title={isPosted ? "Received Items" : "Saved Receiving Lines"} hint={`${selectedReport.items.length} line(s)`} className={`manager-receiving-lines ${isPosted || stage === "review" ? "order-2" : "order-4"}`}>
                    {isDraft && selectedReport.items.length > 0 && (
                      <p className="mb-3 text-xs text-muted-foreground">Edit a saved line to correct its inspection details.</p>
                    )}
                    {selectedReport.items.length ? (
                      <>
                        {isDraft && stage === "inspect" ? <div className="manager-receiving-saved-compact">
                          <button type="button" className="manager-receiving-review-link" onClick={() => focusSection("receiving-review")}>Review all <ArrowRight className="h-3.5 w-3.5" /></button>
                          <ul>{selectedReport.items.map((item) => <li key={item.id}>
                            <span className="manager-receiving-saved-icon" aria-hidden="true"><Package className="h-4 w-4" /></span>
                            <div className="min-w-0"><strong>{item.inventoryItemName}</strong><span>{receivingQuantity(item.quantityAccepted, item.unit)} accepted{item.quantityRejected > 0 ? ` · ${receivingQuantity(item.quantityRejected, item.unit)} rejected` : ""}</span></div>
                            <Button variant="ghost" size="sm" onClick={() => editLine(item)} aria-label={`Edit ${item.inventoryItemName}`}><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" loading={removingLineId === item.id} onClick={() => void removeLine(item.id)} aria-label={`Remove ${item.inventoryItemName}`}><Trash2 className="h-4 w-4" /></Button>
                          </li>)}</ul>
                        </div> : null}
                        <div className={isPosted ? "hidden" : "manager-receiving-lines-table hidden md:block"}>
                          <Table
                            headers={[
                              "Item",
                              "Requested",
                              "Delivered",
                              "Accepted",
                              "Rejected",
                              "Batch / expiry",
                              ...(!isPosted ? ["Actions"] : []),
                            ]}
                          >
                            {selectedReport.items.map((item) => (
                              <tr key={item.id}>
                                <Td>
                                  <p className="break-words font-semibold">{item.inventoryItemName}</p>
                                  {isPosted ? <div className="mt-1 flex flex-wrap gap-x-3">
                                    {onOpenItem ? <button type="button" onClick={() => {
                                      if (confirmDiscardChanges()) onOpenItem(item.inventoryItemId);
                                    }} className="inline-flex min-h-11 items-center text-left text-xs font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{stockDestinationLabel(item.inventoryItemId)}</button> : null}
                                    {onOpenMovements ? <button type="button" onClick={() => {
                                      if (confirmDiscardChanges()) onOpenMovements(item.inventoryItemId, selectedReport.rrNumber);
                                    }} className="inline-flex min-h-11 items-center text-left text-xs font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Movements</button> : null}
                                  </div> : null}
                                  <details className="mt-1 text-[10px] text-muted-foreground">
                                    <summary className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Item ID</summary>
                                    <code className="break-all">{item.inventoryItemId}</code>
                                  </details>
                                </Td>
                                <Td>{activeLinkedDocument ? (() => { const requestLine = activeLinkedDocument.lines.find((line) => line.inventory_item_id === item.inventoryItemId); return requestLine ? `${quantityFormatter.format(requestLine.quantity)} ${requestLine.unit}` : "—"; })() : "—"}</Td>
                                <Td className="whitespace-nowrap">
                                  {quantityFormatter.format(
                                    item.quantityDelivered,
                                  )}{" "}
                                  {item.unit}
                                  {item.secondaryQuantityDelivered !== null && item.secondaryUnit ? <p className="text-xs text-muted-foreground">{quantityFormatter.format(item.secondaryQuantityDelivered)} {item.secondaryUnit}</p> : null}
                                </Td>
                                <Td className="whitespace-nowrap font-bold text-green-700">
                                  {quantityFormatter.format(
                                    item.quantityAccepted,
                                  )}{" "}
                                  {item.unit}
                                  {item.secondaryQuantityAccepted !== null && item.secondaryUnit ? <p className="text-xs">{quantityFormatter.format(item.secondaryQuantityAccepted)} {item.secondaryUnit}</p> : null}
                                </Td>
                                <Td>
                                  <p className={`whitespace-nowrap font-semibold ${item.quantityRejected > 0 ? "text-red-700" : "text-muted-foreground"}`}>
                                    {quantityFormatter.format(
                                      item.quantityRejected,
                                    )}{" "}
                                    {item.unit}
                                  </p>
                                  {item.secondaryQuantityRejected !== null && item.secondaryUnit ? <p className={`text-xs ${item.secondaryQuantityRejected > 0 ? "text-red-700" : "text-muted-foreground"}`}>{quantityFormatter.format(item.secondaryQuantityRejected)} {item.secondaryUnit}</p> : null}
                                  {item.rejectionReason ? (
                                    <p className="mt-0.5 max-w-44 text-[10px] text-muted-foreground">
                                      {item.rejectionReason}
                                    </p>
                                  ) : null}
                                </Td>
                                <Td>
                                  {item.batchCode ? <p className="max-w-40 break-all text-xs">Batch {item.batchCode}</p> : null}
                                  {item.sourceLotCode ? <p className="max-w-40 break-all text-xs">Lot {item.sourceLotCode}</p> : null}
                                  {item.useByDate ? <p className="text-[10px] text-muted-foreground">Use by {item.useByDate}</p> : null}
                                  {!item.batchCode && !item.sourceLotCode && !item.useByDate ? "—" : null}
                                </Td>
                                {!isPosted ? <Td>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editLine(item)}
                                      >
                                        <Edit3 className="h-3.5 w-3.5" /> Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        loading={removingLineId === item.id}
                                        onClick={() => void removeLine(item.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-600" />{" "}
                                        Remove
                                      </Button>
                                    </div>
                                </Td> : null}
                              </tr>
                            ))}
                          </Table>
                        </div>
                        <div className={isPosted ? "space-y-3" : stage === "inspect" ? "hidden" : "manager-receiving-lines-cards space-y-3 md:hidden"}>
                          {selectedReport.items.map((item) => (
                            <article
                              key={item.id}
                              className="manager-receiving-line-card rounded-xl border border-border p-3 text-sm"
                            >
                              <h3 className="break-words font-bold">{item.inventoryItemName}</h3>
                              <details className="mt-1 text-[10px] text-muted-foreground">
                                <summary className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Item ID</summary>
                                <code className="break-all">{item.inventoryItemId}</code>
                              </details>
                              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                {activeLinkedDocument ? <div><dt className="text-muted-foreground">Requested</dt><dd>{(() => { const requestLine = activeLinkedDocument.lines.find((line) => line.inventory_item_id === item.inventoryItemId); return requestLine ? `${quantityFormatter.format(requestLine.quantity)} ${requestLine.unit}` : "—"; })()}</dd></div> : null}
                                <div>
                                  <dt className="text-muted-foreground">
                                    Delivered
                                  </dt>
                                  <dd>
                                    {quantityFormatter.format(
                                      item.quantityDelivered,
                                    )}{" "}
                                    {item.unit}
                                    {item.secondaryQuantityDelivered !== null && item.secondaryUnit ? <span className="block text-muted-foreground">{quantityFormatter.format(item.secondaryQuantityDelivered)} {item.secondaryUnit}</span> : null}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">
                                    Accepted{" "}
                                    {isPosted
                                      ? "/ stock posted"
                                      : "/ pending stock"}
                                  </dt>
                                  <dd className="font-bold text-green-700">
                                    {quantityFormatter.format(
                                      item.quantityAccepted,
                                    )}{" "}
                                    {item.unit}
                                    {item.secondaryQuantityAccepted !== null && item.secondaryUnit ? <span className="block">{quantityFormatter.format(item.secondaryQuantityAccepted)} {item.secondaryUnit}</span> : null}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">
                                    Rejected
                                  </dt>
                                  <dd className="font-bold">
                                    <span className={item.quantityRejected > 0 ? "text-red-700" : "text-muted-foreground"}>
                                      {quantityFormatter.format(item.quantityRejected)} {item.unit}
                                    </span>
                                    {item.secondaryQuantityRejected !== null && item.secondaryUnit ? <span className={`block ${item.secondaryQuantityRejected > 0 ? "text-red-700" : "text-muted-foreground"}`}>{quantityFormatter.format(item.secondaryQuantityRejected)} {item.secondaryUnit}</span> : null}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">
                                    Lot / batch
                                  </dt>
                                  <dd className="min-w-0 break-all">
                                    {item.batchCode ? `Batch ${item.batchCode}` : item.sourceLotCode ? `Lot ${item.sourceLotCode}` : "—"}
                                  </dd>
                                </div>
                              </dl>
                              {item.batchCode && item.sourceLotCode ? <p className="mt-1 break-all text-xs">Source lot: {item.sourceLotCode}</p> : null}
                              {item.useByDate ? <p className="mt-2 text-xs">Use by: {item.useByDate}</p> : null}
                              {item.rejectionReason ? (
                                <p className="mt-1 text-xs text-red-700">
                                  Rejection: {item.rejectionReason}
                                </p>
                              ) : null}
                              {!isPosted ? (
                                <div className="mt-3 flex gap-2 border-t border-border pt-2">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => editLine(item)}
                                  >
                                    <Edit3 className="h-4 w-4" /> Edit
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={removingLineId === item.id}
                                    onClick={() => void removeLine(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" /> Remove
                                  </Button>
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                        {isPosted ? <div className="mt-4 border-t border-border pt-3 text-xs">
                          <h3 className="font-bold">Stock Changes</h3>
                          <ul className="mt-2 space-y-1">{selectedReport.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2"><span>{item.inventoryItemName}</span><strong className={item.quantityAccepted > 0 ? "text-green-700" : "text-muted-foreground"}>{item.quantityAccepted > 0 ? `+${quantityFormatter.format(item.quantityAccepted)} ${item.unit} posted` : "No stock increase"}</strong></li>)}</ul>
                          <p className="mt-2 text-muted-foreground">Rejected quantities did not enter stock.</p>
                        </div> : null}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                        No lines have been saved to this draft. Inspect the delivered items below, then save each line before review.
                      </div>
                    )}
                  </ReceivingAccordion>
                ) : null}
                {selectedReport && isDraft && stage === "inspect" ? (
                  <div className="manager-receiving-review-action order-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                    <p><strong>{selectedReport.items.length} saved line{selectedReport.items.length === 1 ? "" : "s"}.</strong> Save every inspection before reviewing expected stock changes.</p>
                    <Button size="sm" onClick={() => focusSection("receiving-review")}>Review saved lines →</Button>
                  </div>
                ) : null}
                <ReceivingAccordion staticContent id="receiving-document-details" title={isPosted ? "Receipt details" : "Delivery details"} hint={selectedReport?.status.toUpperCase()} className={stage === "inspect" || isPosted ? isPosted ? "order-4" : selectedReport ? "order-5" : "order-2" : "hidden"}>
                  <div className="manager-receiving-detail-header mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {selectedReport ? "Viewing receipt" : "New receiving document"}
                      </p>
                      <h2 className="mt-1 text-sm font-bold">
                        {selectedReport?.rrNumber ?? "New receiving draft"}
                      </h2>
                      {activeLinkedDocument ? (
                        onOpenRequest ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirmDiscardChanges()) onOpenRequest(activeLinkedDocument.id);
                            }}
                            className="mt-1 inline-flex min-h-11 items-center text-left text-xs font-semibold text-blue-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            Open linked Request {activeLinkedDocument.number} · Rev {activeLinkedDocument.revision}
                          </button>
                        ) : (
                          <p className="mt-1 text-xs font-semibold text-blue-800">
                            Linked Request {activeLinkedDocument.number} · Rev {activeLinkedDocument.revision}
                          </p>
                        )
                      ) : null}
                      <p role="status" className="mt-2 text-xs font-semibold text-muted-foreground">
                        {pendingPost?.reportId === selectedReport?.id
                          ? "Posting result needs verification. Do not post again."
                          : isPosted
                            ? "Posted · accepted quantities added to stock."
                            : isCreating
                              ? "Save this document before adding delivery lines."
                              : "Draft · stock unchanged."}
                      </p>
                    </div>
                    {selectedReport ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${isPosted ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
                      >
                        {selectedReport.status}
                      </span>
                    ) : null}
                  </div>

                  {selectedReport && isDraft ? <dl className="manager-receiving-delivery-summary">
                    <div><dt><Package aria-hidden="true" />Source</dt><dd>{sourceLabel(selectedReport.sourceType)}</dd></div>
                    <div><dt><CalendarDays aria-hidden="true" />Received date and time</dt><dd>{dateFormatter.format(new Date(selectedReport.receivedAt))}</dd></div>
                    <div><dt><FileText aria-hidden="true" />Source / handoff reference</dt><dd>{activeLinkedDocument ? `${activeLinkedDocument.number} Rev ${activeLinkedDocument.revision}` : selectedReport.sourceReference || "—"}</dd></div>
                  </dl> : null}

                  {isPosted && selectedReport ? (
                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-bold">Completed delivery record</h3>
                      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {postedReceiptDetails.map(({ label, value }) => value ? (
                          <div key={label} className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{label}</dt>
                            <dd className="break-words font-semibold">{value}</dd>
                          </div>
                        ) : null)}
                      </dl>
                      {isInspectorAuditId(physicalInspector) ? (
                        <details className="mt-3 text-xs text-muted-foreground">
                          <summary className="min-h-11 cursor-pointer py-2 focus-visible:ring-2 focus-visible:ring-primary">Inspector audit ID</summary>
                          <code className="break-all">{physicalInspector}</code>
                        </details>
                      ) : null}
                      <nav aria-label="Posted receipt destinations" className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                        {activeLinkedDocument && onOpenRequest ? <Button variant="secondary" size="sm" onClick={() => onOpenRequest(activeLinkedDocument.id)}>View Linked Request</Button> : null}
                        {onOpenStockOverview ? <Button variant="secondary" size="sm" onClick={onOpenStockOverview}>View Stock / Batches</Button> : null}
                        {onOpenMovements ? selectedReport.items.map((item) => <Button key={item.id} variant="secondary" size="sm" onClick={() => onOpenMovements(item.inventoryItemId, selectedReport.rrNumber)}>Movements · {item.inventoryItemName}</Button>) : null}
                      </nav>
                    </div>
                  ) : (
                    <details key={selectedReport?.id ?? "new-receipt"} open={isCreating ? true : undefined} className="manager-receiving-secondary-details rounded-lg border border-border">
                      <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {isCreating ? "Delivery fields" : "Edit delivery fields"} · {sourceLabel(header.sourceType)}
                      </summary>
                    <fieldset
                      disabled={isPosted || isSavingHeader}
                      className="grid grid-cols-1 gap-3 border-t border-border p-3 sm:grid-cols-2"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="receiving-source"
                          className="text-xs font-semibold"
                        >
                          Source
                        </label>
                        <select
                          id="receiving-source"
                          className={inputClass}
                          value={header.sourceType}
                          disabled={
                            Boolean(selectedReport?.items.length) ||
                            Boolean(activeLinkedRequest) ||
                            Boolean(activeLinkedDocument) ||
                            policyEvidence?.classification ===
                              "manager_emergency" ||
                            isPosted ||
                            isSavingHeader
                          }
                          onChange={(event) => {
                            if (!confirmDiscardLine()) return;
                            const sourceType = event.target
                              .value as ReceivingSourceType;
                            setHeader((current) => ({
                              ...current,
                              sourceType,
                            }));
                            setLine(createEmptyLine());
                            setLineItemSelectedByManager(false);
                            setError("");
                          }}
                        >
                          <option value="production_team">Production Team</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="receiving-date"
                          className="text-xs font-semibold"
                        >
                          Received date and time
                        </label>
                        <input
                          id="receiving-date"
                          type="datetime-local"
                          className={inputClass}
                          value={header.receivedAt}
                          onChange={(event) =>
                            setHeader((current) => ({
                              ...current,
                              receivedAt: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900 sm:col-span-2">
                        {isCreating
                          ? "Normal Production delivery starts from an issued formal Manager Request. This general form records an exceptional delivery with Manager authorization."
                          : "Production is the physical source. The provenance record below identifies the formal request or emergency exception."}
                      </div>

                      <TextField
                        id="source-reference"
                        label="Source / handoff reference"
                        value={header.sourceReference}
                        placeholder="Dispatch, handoff, or delivery reference"
                        disabled={Boolean(
                          activeLinkedRequest || activeLinkedDocument,
                        )}
                        onChange={(value) =>
                          setHeader((current) => ({
                            ...current,
                            sourceReference: value,
                          }))
                        }
                      />
                      {header.sourceType === "production_team" && isCreating ? (
                        <div className="sm:col-span-2 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                          <h3 className="text-sm font-bold">
                            Manager emergency exception
                          </h3>
                          <p className="text-xs">
                            Record the actual reason and the person who physically
                            inspected the delivery. Your signed-in Manager
                            identity and server time will be kept as immutable
                            authorization evidence. This does not move stock.
                          </p>
                          <label className="block text-xs font-semibold">
                            Emergency reason
                            <textarea
                              className={`${inputClass} mt-1 w-full`}
                              required
                              value={emergencyReason}
                              onChange={(event) =>
                                setEmergencyReason(event.target.value)
                              }
                            />
                          </label>
                          <label className="block text-xs font-semibold">
                            Physical inspector name
                            <input
                              className={`${inputClass} mt-1 w-full`}
                              required
                              value={emergencyInspector}
                              onChange={(event) =>
                                setEmergencyInspector(event.target.value)
                              }
                            />
                          </label>
                        </div>
                      ) : null}
                    </fieldset>
                    </details>
                  )}

                  {policyEvidence ? (
                    <div
                      className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs"
                      aria-label="Receiving provenance"
                    >
                      <p className="font-bold">
                        Provenance:{" "}
                        {policyLabel(policyEvidence.classification)}
                      </p>
                      {policyEvidence.classification === "manager_emergency" ? (
                        <p className="mt-1">
                          Reason: {policyEvidence.reason} · Authorized by{" "}
                          {policyEvidence.authorizedByName} at{" "}
                          {policyEvidence.authorizedAt
                            ? dateFormatter.format(
                                new Date(policyEvidence.authorizedAt),
                              )
                            : "—"}{" "}
                          · Physical inspector: {policyEvidence.inspectedByName}
                        </p>
                      ) : policyEvidence.classification ===
                        "historical_unlinked" ? (
                        <p className="mt-1">
                          Historical Production receipt without a formal request
                          link or emergency authorization record.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {!isPosted ? (
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                      {selectedReport?.items.length === 0 &&
                      !activeLinkedRequest &&
                      policyEvidence?.classification !== "manager_emergency" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={isDeleting}
                          onClick={() => void deleteDraft()}
                        >
                          <Trash2 className="h-4 w-4" /> Delete empty draft
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        loading={isSavingHeader}
                        onClick={() => void saveHeader()}
                      >
                        <Save className="h-4 w-4" />{" "}
                        {isCreating ? "Create Draft" : "Save Draft"}
                      </Button>
                    </div>
                  ) : null}
                </ReceivingAccordion>
                {selectedReport && isDraft && stage === "inspect" ? <div className="manager-receiving-stock-note" role="status">
                  <Info aria-hidden="true" className="h-5 w-5" />
                  <div><strong>Draft stock unchanged</strong><p>Saved quantities stay in this draft. Only accepted quantities will enter inventory after Review and Post.</p></div>
                </div> : null}
                </div>

                {selectedReport && isDraft ? (
                  <ReceivingAccordion staticContent id="receiving-review" title="Review & Post" hint="Confirm saved lines before posting" className={`manager-receiving-post-summary order-3 ${stage === "review" ? "" : "hidden"}`}>
                    <div className="manager-receiving-review-summary grid gap-3 lg:grid-cols-2">
                      <section className="rounded-lg border border-border bg-white p-3 text-xs" aria-label="Expected Stock Changes">
                        <h3 className="font-bold">Expected Stock Changes</h3>
                        {selectedReport.items.length ? <ul className="mt-2 space-y-2">{selectedReport.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-border pt-2"><span>{item.inventoryItemName}</span><strong className={item.quantityAccepted > 0 ? "text-green-700" : "text-muted-foreground"}>{item.quantityAccepted > 0 ? `+${quantityFormatter.format(item.quantityAccepted)} ${item.unit}` : "No stock increase"}</strong></li>)}</ul> : <p className="mt-2 text-muted-foreground">Save an inspection line to preview accepted stock.</p>}
                        <p className="mt-2 text-muted-foreground">Only accepted quantities can enter stock after confirmation.</p>
                      </section>
                      <section className="rounded-lg border border-border bg-white p-3 text-xs" aria-label="Review Checklist">
                        <h3 className="font-bold">Review Checklist</h3>
                        <ul className="mt-2 space-y-2">
                          <li>{selectedReport.items.length ? "✓ Saved inspection lines are available" : "• Save at least one valid inspection line"}</li>
                          <li>{hasUnsavedHeader || hasUnsavedLine || hasOtherUnsavedLines ? "• Save or clear unsaved document and item changes" : "✓ No unsaved changes"}</li>
                          <li>• Manager confirmation is required before posting</li>
                        </ul>
                        <p className="mt-2 text-muted-foreground">The posting service checks final readiness and authorization.</p>
                      </section>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <Button variant="secondary" size="sm" onClick={() => focusSection(activeLinkedDocument ? "receiving-items-table" : "receiving-line-editor")}>← Back to Inspect</Button>
                      <Button
                        size="sm"
                        className="manager-receiving-primary-action"
                        disabled={
                          selectedReport.items.length === 0 ||
                          isPosting ||
                          isSavingHeader ||
                          isSavingLine ||
                          Boolean(removingLineId) ||
                          hasUnsavedHeader ||
                          hasUnsavedLine ||
                          hasOtherUnsavedLines ||
                          Boolean(pendingPost)
                        }
                        onClick={() => setReviewOpen(true)}
                      >
                        <PackageCheck className="h-4 w-4" /> Review & Post
                      </Button>
                    </div>
                  </ReceivingAccordion>
                ) : null}
              </>
            )}
          </div>
          </>
          )}
          </> : null}
          </div>
          </div>
        </fieldset>
      )}

      <AlertDialog
        open={reviewOpen}
        onOpenChange={(open) => !isPosting && setReviewOpen(open)}
      >
        <AlertDialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-white p-4 sm:max-w-xl sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="break-all">
              Post {selectedReport?.rrNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Review the physical count and accepted-only stock change for every
              item. Posting can happen only once. Rejected and undelivered goods
              do not enter stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className="manager-receiving-review min-h-0 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-border bg-muted/40 p-3 text-xs"
            tabIndex={0}
            aria-label="Saved receiving lines to post"
          >
            {activeLinkedDocument ? (
              <p className="break-words">
                <strong>Request:</strong> {activeLinkedDocument.number} · Rev{" "}
                {activeLinkedDocument.revision} · <strong>Inspector:</strong>{" "}
                {inspectorLabel(physicalInspector)}
              </p>
            ) : null}
            <p className="break-all">
              <strong>Posting Manager:</strong> authenticated Manager account ·{" "}
              <strong>Receipt:</strong> {selectedReport?.rrNumber}
            </p>
            {selectedReport ? (
              <p className="break-words">
                <strong>Source:</strong>{" "}
                {sourceLabel(selectedReport.sourceType)}
                {selectedReport.supplierName
                  ? ` · Supplier: ${selectedReport.supplierName}`
                  : ""}
                {selectedReport.supplierDeliveryReference
                  ? ` · Delivery reference: ${selectedReport.supplierDeliveryReference}`
                  : ""}
                {selectedReport.sourceReference
                  ? ` · Source reference: ${selectedReport.sourceReference}`
                  : ""}
                {` · Received ${dateFormatter.format(new Date(selectedReport.receivedAt))}`}
              </p>
            ) : null}
            {(selectedReport?.items ?? []).map((item) => {
              const requestLine = activeLinkedDocument?.lines.find(
                (line) => line.inventory_item_id === item.inventoryItemId,
              );
              const acceptedThisReceipt = (selectedReport?.items ?? [])
                .filter((line) => line.inventoryItemId === item.inventoryItemId)
                .reduce((sum, line) => sum + line.quantityAccepted, 0);
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <p className="break-words font-bold">
                    {item.inventoryItemName}
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                    Item ID {item.inventoryItemId}
                  </p>
                  <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Delivered</dt>
                      <dd className="font-semibold">
                        {quantityFormatter.format(item.quantityDelivered)}{" "}
                        {item.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        Accepted into stock
                      </dt>
                      <dd className="font-bold text-green-700">
                        +{quantityFormatter.format(item.quantityAccepted)}{" "}
                        {item.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        Rejected before acceptance
                      </dt>
                      <dd className={`font-semibold ${item.quantityRejected > 0 ? "text-red-700" : "text-muted-foreground"}`}>
                        {quantityFormatter.format(item.quantityRejected)}{" "}
                        {item.unit}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 break-all text-muted-foreground">
                    Lot {item.sourceLotCode || "none"} · Use by{" "}
                    {item.useByDate || "not set"}
                    {item.rejectionReason
                      ? ` · Rejection: ${item.rejectionReason}`
                      : ""}
                  </p>
                  {requestLine ? (
                    <p className="mt-2 break-words border-t border-border pt-2">
                      Requested {quantityFormatter.format(requestLine.quantity)}{" "}
                      {requestLine.unit} · Already accepted and posted{" "}
                      {quantityFormatter.format(requestLine.accepted)}{" "}
                      {requestLine.unit} · Outstanding if this report posts{" "}
                      {quantityFormatter.format(
                        Math.max(
                          0,
                          requestLine.remaining - acceptedThisReceipt,
                        ),
                      )}{" "}
                      {requestLine.unit}.
                    </p>
                  ) : null}
                </div>
              );
            })}
            {activeLinkedDocument ? (
              <p>
                Only accepted quantities will be added to inventory when this
                Receiving report is successfully posted. Any request amount not
                accepted here stays outstanding. Return to the request for
                another delivery or audited shortfall closure.
              </p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="min-h-11 min-w-11"
              disabled={isPosting}
            >
              Keep Draft
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 min-w-11"
              disabled={isPosting}
              onClick={(event) => {
                event.preventDefault();
                void postReport();
              }}
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4" />
              )}
              {isPosting ? "Posting…" : "Post Receiving"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span id={`${id}-error`} className="text-xs text-red-700">{error}</span>}
    </div>
  );
}

function ReadOnlyQuantity({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit?: string | null;
  tone: "red" | "neutral";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold">{label}</span>
      <div
        className={`${inputClass} bg-muted ${tone === "red" ? "font-bold text-red-700" : "text-muted-foreground"}`}
      >
        {quantityFormatter.format(value)} {unit ?? ""}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span id={`${id}-error`} className="text-xs text-red-700">{error}</span>}
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="date"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span id={`${id}-error`} className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
