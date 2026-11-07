import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, CalendarDays, ChevronRight, CircleAlert, Clock3, Flag, MoreHorizontal, Package, Plus, RefreshCw, Sparkles, Trash2, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/common/Button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { inspectorLabel, isInspectorAuditId } from "./inspectorLabel";
import {
  closeInventoryRequestShort,
  getInventoryRequestRegister,
  getRequestProposal,
  issueInventoryRequest,
  reviseInventoryRequest,
  type InventoryRequest,
  type RequestDraftLine,
  type RequestPriority,
  type RequestProposalItem,
  type RequestSnapshot,
} from "./inventoryRequestApi";
import { formatRequestQuantity, normalizeRequestQuantityInput, suggestedRequestQuantity } from "./requestQuantity";
import {
  requestEventDetailRows,
  requestEventPresentation,
  requestPastNeededDate,
  requestWorkflow,
} from "./requestWorkflow";
import {
  issuedRequestDocument,
  requestDocumentText,
  requestPrintHtml,
  type RequestDocumentData,
} from "./requestDocument";

const manila = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
const manilaDate = (date: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" }).format(new Date(date));
const defaultNeeded = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const toLocalInput = (iso: string) =>
  new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 16);
const fromManilaInput = (value: string) =>
  new Date(`${value}:00+08:00`).toISOString();
const suggested = suggestedRequestQuantity;
const guidanceLabel = (value: number, scale: number) => Number.isFinite(value) ? formatRequestQuantity(value, scale) : "Unavailable";
const errorText = (caught: unknown) =>
  caught instanceof Error
    ? caught.message
    : "Request failed. Refresh and try again.";
const quantityCorrectionText = (raw: string, item: RequestProposalItem) => {
  if (raw.trim() === "") return "Enter a quantity or 0 to exclude this item.";
  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || quantity < 0) return "Enter 0 or a positive quantity.";
  if (quantity > 0 && Math.abs(quantity * 10 ** item.quantity_scale - Math.round(quantity * 10 ** item.quantity_scale)) > 1e-6)
    return `Use at most ${item.quantity_scale} decimal places.`;
  return "";
};

function RequestSuggestionGuidance({ item, line }: { item: RequestProposalItem; line?: RequestDraftLine }) {
  const gap = suggested(item);
  const coveredByRequests = gap === 0 && item.reorder_level > item.valid_at_need && item.outstanding > 0;
  const primary = item.valid_at_need <= 0 ? "No usable stock"
    : coveredByRequests ? "Open requests"
    : item.reorder_level <= 0 ? "Needs review"
    : gap > 0 ? "Low stock"
    : !item.expiry_verified ? "Needs review" : "At minimum";
  const statusTone = item.valid_at_need <= 0 ? "is-error"
    : coveredByRequests || item.reorder_level <= 0 ? "is-info"
    : gap > 0 ? "is-warning" : !item.expiry_verified ? "is-info" : "is-neutral";
  return <div className="manager-request-suggestion-status text-xs">
    <span className={`manager-request-status-pill ${statusTone}`}>{primary}</span>
    <details className="manager-request-guidance">
      <summary aria-label={`${item.name}: why this suggestion?${coveredByRequests ? " Open requests cover the current shortage." : ""}${!item.expiry_verified ? " Expiry unverified." : ""}`} title={!item.expiry_verified ? "Expiry unverified · open details" : "Why this suggestion?"} className="manager-request-guidance-trigger cursor-pointer rounded-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">ⓘ</summary>
      <div className="manager-request-guidance-detail text-muted-foreground">
        <p>Usable at need: {guidanceLabel(item.valid_at_need, item.quantity_scale)} {item.unit}</p>
        <p>Recorded minimum: {guidanceLabel(item.reorder_level, item.quantity_scale)} {item.unit}</p>
        <p>Open requests: {guidanceLabel(item.outstanding, item.quantity_scale)} {item.unit}</p>
        <p>Provisional gap: {guidanceLabel(gap, item.quantity_scale)} {item.unit}</p>
        {!item.expiry_verified && <p><strong>Expiry unverified.</strong> Confirm it before relying on this stock.</p>}
        {coveredByRequests && <p><strong>Open requests cover the calculated gap.</strong> This stock is still below its recorded minimum until delivery is received.</p>}
        {line && line.quantity > 0 && Math.abs(line.quantity - gap) > 1e-6 && !line.override_reason.trim() && <p>Explain this quantity in Review.</p>}
      </div>
    </details>
  </div>;
}

function SuggestedGapHelp({ mobile = false }: { mobile?: boolean }) {
  return <details className="manager-request-gap-help">
    <summary aria-label="How suggested gaps are calculated" title="How suggested gaps are calculated">{mobile && "Suggested gap "}ⓘ</summary>
    <div className="manager-request-gap-help-detail">Recorded minimum − usable stock at delivery − open formal requests, never below 0. A zero gap can still mean low or no usable stock. Enter a positive Request Qty to include an item.</div>
  </details>;
}

const requestStatus: Record<InventoryRequest["status"], { label: string; description: string }> = {
  issued: { label: "Issued", description: "No accepted quantity has been posted yet." },
  partially_received: { label: "Partially received", description: "Some quantity was accepted and posted; the request remains open." },
  fulfilled: { label: "Fulfilled", description: "All requested quantities were accepted and posted." },
  closed_short: { label: "Closed with shortfall", description: "Closed with a documented shortfall reason; no further receiving on this request." },
};

function downloadText(data: RequestDocumentData) {
  const blob = new Blob([requestDocumentText(data)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.reference}-rev${data.revision}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadPng(data: RequestDocumentData) {
  const sourceLines = requestDocumentText(data).split("\n");
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.font = "26px Arial";
  const maxWidth = canvas.width - 110;
  const lines: string[] = [];
  for (const source of sourceLines) {
    if (!source) { lines.push(""); continue; }
    let current = "";
    for (const word of source.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) { current = candidate; continue; }
      if (current) { lines.push(current); current = ""; }
      for (const character of word) {
        if (context.measureText(current + character).width > maxWidth && current) {
          lines.push(current);
          current = "";
        }
        current += character;
      }
    }
    lines.push(current);
  }
  canvas.height = Math.max(800, 150 + lines.length * 42);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#171717";
  context.font = "26px Arial";
  lines.forEach((line, index) =>
    context.fillText(line, 55, 75 + index * 42),
  );
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.reference}-rev${data.revision}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function printPdf(data: RequestDocumentData) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Allow the print window, then save as PDF.");
  win.document.open();
  win.document.write(requestPrintHtml(data));
  win.document.close();
  win.focus();
  win.requestAnimationFrame(() => win.print());
}

export function ManagerRequestsPage({
  initialItemId,
  initialRequestId,
  initialHistory = false,
  onSelectRequest,
  onDirtyChange,
  onReceive,
}: {
  initialItemId?: string;
  initialRequestId?: string;
  initialHistory?: boolean;
  onSelectRequest?: (
    requestId: string | null,
    workspace: "sheet" | "history",
  ) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onReceive: (reportId: string | null) => void;
}) {
  const [neededInput, setNeededInput] = useState(() => toLocalInput(defaultNeeded()));
  const neededInputRef = useRef(neededInput);
  const loadVersion = useRef(0);
  const registerReadyRef = useRef(false);
  const [priority, setPriority] = useState<RequestPriority>("scheduled");
  const cleanRequestDetails = useRef({ priority, neededInput });
  const [proposal, setProposal] = useState<RequestProposalItem[]>([]);
  const [draft, setDraft] = useState<RequestDraftLine[]>([]);
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [selectedManualId, setSelectedManualId] = useState<string | null>(null);
  const [revisionIds, setRevisionIds] = useState<string[]>([]);
  const [lastRemoved, setLastRemoved] = useState<{ id: string; line?: RequestDraftLine; raw: string } | null>(null);
  const [register, setRegister] = useState<InventoryRequest[]>([]);
  const [registerReady, setRegisterReady] = useState(false);
  const [registerVersion, setRegisterVersion] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [selectedId, setSelectedId] = useState(initialRequestId ?? "");
  const [revisionOf, setRevisionOf] = useState<InventoryRequest | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryRequest["status"] | "">("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const selectionIntentRef = useRef(Boolean(initialRequestId));
  const lastViewedRequestRef = useRef(initialRequestId ?? "");
  const [documentExpanded, setDocumentExpanded] = useState(false);
  const [detailView, setDetailView] = useState<"document" | "history">("document");
  const documentCloseRef = useRef<HTMLButtonElement>(null);
  const documentExpandRef = useRef<HTMLButtonElement>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const clearAllButtonRef = useRef<HTMLButtonElement>(null);
  const [focusQuantityId, setFocusQuantityId] = useState("");
  const [workspace, setWorkspace] = useState<"sheet" | "history">(
    initialRequestId || initialHistory ? "history" : "sheet",
  );
  const [review, setReview] = useState(false);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const editHeadingRef = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [issueId, setIssueId] = useState(() => crypto.randomUUID());
  const [initialItemApplied, setInitialItemApplied] = useState(false);
  const hasUnsavedChanges = draft.length > 0 || manualIds.length > 0 || revisionOf !== null ||
    priority !== cleanRequestDetails.current.priority || neededInput !== cleanRequestDetails.current.neededInput;

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
    return () => onDirtyChange?.(false);
  }, [hasUnsavedChanges, onDirtyChange]);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectRequest = (
    requestId: string,
    nextWorkspace: "sheet" | "history" = "history",
  ) => {
    selectionIntentRef.current = true;
    if (requestId) lastViewedRequestRef.current = requestId;
    setDocumentExpanded(false);
    if (requestId !== selectedId) setCloseReason("");
    setSelectedId(requestId);
    setWorkspace(nextWorkspace);
    onSelectRequest?.(requestId || null, nextWorkspace);
  };

  useEffect(() => {
    if (initialRequestId) lastViewedRequestRef.current = initialRequestId;
    setSelectedId(initialRequestId ?? "");
    setWorkspace(initialRequestId || initialHistory ? "history" : "sheet");
    setDocumentExpanded(false);
    setDetailView("document");
  }, [initialRequestId, initialHistory]);
  useEffect(() => {
    if (documentExpanded) documentCloseRef.current?.focus();
  }, [documentExpanded]);
  useEffect(() => {
    if (!documentExpanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [documentExpanded]);

  const neededAt = useMemo(() => {
    try {
      return fromManilaInput(neededInput);
    } catch {
      return "";
    }
  }, [neededInput]);
  const selected = registerReady && registerVersion === loadVersion.current
    ? register.find((row) => row.id === selectedId) ?? null
    : null;
  const progress = selected ? requestWorkflow(selected) : null;
  const requestLines = draft.filter((line) => line.quantity > 0);
  const previewDocument: RequestDocumentData = {
    identifier: revisionOf?.id ?? issueId,
    reference: revisionOf?.number,
    revision: revisionOf ? revisionOf.revision + 1 : 1,
    status: "Draft · Not issued",
    priority,
    neededAt: neededAt ? manila(neededAt) : "",
    lines: requestLines.map((line) => {
      const item = proposal.find((row) => row.id === line.inventory_item_id);
      return {
        id: line.inventory_item_id,
        name: item?.name ?? "Unavailable item",
        quantity: line.quantity,
        unit: item?.unit ?? "",
        overrideReason: line.override_reason,
      };
    }),
    draft: true,
  };
  const canUseRegister = () =>
    registerReadyRef.current && registerVersion === loadVersion.current;
  const destinations = [...new Set(register.map((row) => row.snapshot.destination).filter(Boolean))].sort();
  const visible = register.filter((row) =>
    (!statusFilter || row.status === statusFilter) &&
    (!destinationFilter || row.snapshot.destination === destinationFilter) &&
    `${row.number} ${row.issued_by_name} ${row.status} ${requestStatus[row.status].label} ${row.snapshot.destination} ${row.lines.map((line) => line.name).join(" ")} ${row.receipts.map((receipt) => receipt.number).join(" ")}`
      .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ).sort((a, b) => sortOrder === "newest" ? Date.parse(b.issued_at) - Date.parse(a.issued_at) : Date.parse(a.issued_at) - Date.parse(b.issued_at));
  const attentionItems = proposal.filter(
    (item) =>
      item.reorder_level > 0 &&
      item.valid_at_need <= item.reorder_level,
  );
  const addable = proposal.filter(
    (item) =>
      !(showSuggestions && attentionItems.some((suggestion) => suggestion.id === item.id)) &&
      !manualIds.includes(item.id) &&
      !revisionIds.includes(item.id) &&
      item.name.toLowerCase().includes(itemSearch.trim().toLowerCase()),
  );
  const itemSuggestions = itemSearch.trim() ? addable.slice(0, 8) : [];
  const allAttentionGapsCovered = attentionItems.length > 0 &&
    attentionItems.every((item) => suggested(item) === 0);
  const coveredShortfallCount = attentionItems.filter((item) =>
    item.valid_at_need < item.reorder_level && item.outstanding > 0 && suggested(item) === 0,
  ).length;
  const suggestedIds = new Set(showSuggestions ? attentionItems.map((item) => item.id) : []);
  const isManualRow = (id: string) => manualIds.includes(id) && !suggestedIds.has(id);
  const reviewItems = [
    ...(showSuggestions ? attentionItems : []),
    ...[...revisionIds, ...manualIds].filter((id, index, ids) => !suggestedIds.has(id) && ids.indexOf(id) === index)
      .map((id) => proposal.find((item) => item.id === id))
      .filter((item): item is RequestProposalItem => Boolean(item)),
  ];
  const unavailableDraft = draft.filter((line) => line.quantity > 0 && !proposal.some((item) => item.id === line.inventory_item_id));
  const removeItem = (item: RequestProposalItem) => {
    if (!isManualRow(item.id)) return;
    const line = draft.find((row) => row.inventory_item_id === item.id);
    setLastRemoved({ id: item.id, line, raw: quantityInputs[item.id] ?? "0" });
    setDraft((rows) => rows.filter((row) => row.inventory_item_id !== item.id));
    setQuantityInputs((inputs) => ({ ...inputs, [item.id]: "0" }));
    setManualIds((ids) => ids.filter((id) => id !== item.id));
    setSelectedManualId(null);
    setError("");
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".manager-request-selection-toolbar .is-undo")?.focus());
  };
  const undoRemove = () => {
    if (!lastRemoved) return;
    const { id, line, raw } = lastRemoved;
    if (line) setDraft((rows) => rows.some((row) => row.inventory_item_id === id) ? rows : [...rows, line]);
    setQuantityInputs((inputs) => ({ ...inputs, [id]: raw }));
    // Retain catalog-add provenance if a refresh has since made the item a suggestion.
    // The current suggestion list still takes precedence over the Remove action.
    setManualIds((ids) => ids.includes(id) ? ids : [...ids, id]);
    setSelectedManualId(id);
    setLastRemoved(null);
    setFocusQuantityId(id);
  };
  const clearRequest = () => {
    setDraft([]);
    setQuantityInputs({});
    setManualIds([]);
    setSelectedManualId(null);
    setRevisionIds([]);
    setLastRemoved(null);
    setReviewAttempted(false);
    setError("");
    setClearOpen(false);
  };
  const clearAllItems = () => {
    clearRequest();
    setShowSuggestions(false);
    setInitialItemApplied(true);
    setItemSearch("");
    setItemSearchOpen(false);
    setClearAllOpen(false);
  };
  const addItem = (item: RequestProposalItem) => {
    if (!fresh || manualIds.includes(item.id) || revisionIds.includes(item.id) || suggestedIds.has(item.id)) return;
    setDraft((rows) => rows.some((line) => line.inventory_item_id === item.id) ? rows : [...rows, { inventory_item_id: item.id, quantity: 0, override_reason: "" }]);
    setQuantityInputs((inputs) => ({ ...inputs, [item.id]: "0" }));
    setManualIds((ids) => ids.includes(item.id) ? ids : [...ids, item.id]);
    setFocusQuantityId(item.id);
    setError("");
    setItemSearch("");
    setItemSearchOpen(false);
    setActiveSuggestion(0);
  };
  useEffect(() => {
    if (!focusQuantityId) return;
    const input = [...document.querySelectorAll<HTMLInputElement>(".manager-request-sheet.is-authoring input[data-request-item-id]")]
      .find((candidate) => candidate.dataset.requestItemId === focusQuantityId && candidate.getClientRects().length > 0);
    input?.focus();
    setFocusQuantityId("");
  }, [draft, focusQuantityId]);

  const load = useCallback(
    async (restoreSuggestions = false) => {
      const version = ++loadVersion.current;
      registerReadyRef.current = false;
      setLoading(true);
      setFresh(false);
      setRegisterReady(false);
      setRegister([]);
      try {
        const needed = fromManilaInput(neededInput);
        const [proposalResult, registerResult] = await Promise.allSettled([
          getRequestProposal(needed),
          getInventoryRequestRegister(),
        ]);
        if (
          version !== loadVersion.current ||
          neededInputRef.current !== neededInput
        )
          return;
        const items = proposalResult.status === "fulfilled" ? proposalResult.value : [];
        const requests = registerResult.status === "fulfilled" ? registerResult.value : [];
        setProposal(items);
        setRegister(requests);
        if (registerResult.status === "fulfilled" && !selectionIntentRef.current && requests.length) {
          const first = [...requests].sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at))[0];
          lastViewedRequestRef.current = first.id;
          setSelectedId(first.id);
        }
        registerReadyRef.current = registerResult.status === "fulfilled";
        setRegisterVersion(version);
        setRegisterReady(registerResult.status === "fulfilled");
        setFresh(proposalResult.status === "fulfilled");
        if (restoreSuggestions && proposalResult.status === "fulfilled") setShowSuggestions(true);
        setError(registerResult.status === "rejected"
          ? `Request history could not be retrieved. Request actions are unavailable until Refresh succeeds. ${errorText(registerResult.reason)}`
          : proposalResult.status === "rejected"
            ? "Stock suggestions are unavailable. Existing requests remain viewable; refresh before preparing or revising a request."
            : "");
        // Suggestions inform the Manager; they never select or issue item lines.
      } catch (caught) {
        if (
          version !== loadVersion.current ||
          neededInputRef.current !== neededInput
        )
          return;
        setProposal([]);
        setRegister([]);
        setRegisterReady(false);
        setError(
          `${errorText(caught)} Current request information could not be retrieved. Request actions and issuing are unavailable until Try again succeeds.`,
        );
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
    },
    [neededInput],
  );

  useEffect(() => {
    void load();
  }, []); // Initial visit only; Refresh is explicit.
  useEffect(() => {
    if (initialItemApplied || !initialItemId) return;
    const item = proposal.find((row) => row.id === initialItemId);
    if (!item) return;
    setDraft((current) =>
      current.some((line) => line.inventory_item_id === initialItemId)
        ? current
        : [...current, { inventory_item_id: initialItemId, quantity: 0, override_reason: "" }],
    );
    setManualIds((ids) => ids.includes(initialItemId) ? ids : [...ids, initialItemId]);
    setInitialItemApplied(true);
  }, [initialItemId, initialItemApplied, proposal]);

  const updateQuantity = (id: string, raw: string) => {
    setError("");
    setQuantityInputs((inputs) => ({ ...inputs, [id]: raw }));
    setDraft((rows) => rows.some((row) => row.inventory_item_id === id)
      ? rows.map((row) => row.inventory_item_id === id ? { ...row, quantity: raw.trim() === "" ? NaN : Number(raw) } : row)
      : [...rows, { inventory_item_id: id, quantity: raw.trim() === "" ? NaN : Number(raw), override_reason: "" }]);
  };
  const finishQuantity = (id: string) => {
    const raw = quantityInputs[id];
    if (raw === undefined) return;
    const normalized = normalizeRequestQuantityInput(raw);
    if (normalized !== raw) updateQuantity(id, normalized);
  };
  const updateReason = (id: string, reason: string) => {
    setError("");
    setDraft((rows) => rows.map((row) => row.inventory_item_id === id ? { ...row, override_reason: reason } : row));
  };
  const validate = (requireReasons: boolean) => {
    if (!fresh || !neededAt || new Date(neededAt).getTime() <= Date.now())
      return "Refresh current stock and enter a future delivery time.";
    if (!requestLines.length) return "Enter a positive Request Qty for at least one item.";
    for (const line of draft) {
      const item = proposal.find((row) => row.id === line.inventory_item_id);
      if (!item) return "An entered item is unavailable. Refresh suggestions or remove it.";
      const correction = quantityCorrectionText(quantityInputs[line.inventory_item_id] ?? String(line.quantity), item);
      if (correction) return `${item.name}: ${correction}`;
      if (requireReasons && line.quantity > 0 && Math.abs(line.quantity - suggested(item)) > 1e-6 && !line.override_reason.trim())
        return `${item.name}: explain the suggested quantity override.`;
    }
    return "";
  };

  const issue = async () => {
    if (!canUseRegister() || !review || busy || loading) return;
    const problem = validate(true);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = revisionOf
        ? await reviseInventoryRequest({
            id: revisionOf.id,
            revision: revisionOf.revision,
            priority,
            neededAt,
            lines: requestLines,
            expected: proposal,
          })
        : await issueInventoryRequest({
            id: issueId,
            priority,
            neededAt,
            lines: requestLines,
            expected: proposal,
          });
      setNotice(
        `${result.request_number} Rev ${"revision" in result ? result.revision : 1} issued. Stock did not change. Export and send it manually.`,
      );
      setReview(false);
      setReviewAttempted(false);
      setRevisionOf(null);
      setDraft([]);
      setQuantityInputs({});
      setManualIds([]);
      setRevisionIds([]);
      setShowSuggestions(false);
      setLastRemoved(null);
      cleanRequestDetails.current = { priority, neededInput };
      setIssueId(crypto.randomUUID());
      await load();
      selectRequest(result.id);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const beginRevision = (row: InventoryRequest) => {
    if (!canUseRegister()) return;
    setRevisionOf(row);
    selectRequest("", "sheet");
    setPriority(row.priority);
    const revisionNeededInput = toLocalInput(row.needed_at);
    neededInputRef.current = revisionNeededInput;
    setNeededInput(revisionNeededInput);
    setFresh(false);
    setQuantityInputs(Object.fromEntries(row.lines.map((line) => [line.inventory_item_id, String(line.quantity)])));
    setManualIds([]);
    setRevisionIds(row.lines.map((line) => line.inventory_item_id));
    setShowSuggestions(false);
    setLastRemoved(null);
    setDraft(
      row.lines.map((line) => ({
        inventory_item_id: line.inventory_item_id,
        quantity: line.quantity,
        override_reason: "",
      })),
    );
    setReview(false);
    setReviewAttempted(false);
    setWorkspace("sheet");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const copySnapshot = async (snapshot: RequestSnapshot) => {
    if (!canUseRegister()) return;
    try {
      await navigator.clipboard.writeText(requestDocumentText(issuedRequestDocument(snapshot)));
      setNotice("Issued request copied. No message was sent.");
    } catch {
      setError("Copy was unavailable. Use Text download or select the issued document.");
    }
  };

  const neededInvalid = !neededAt || new Date(neededAt).getTime() <= now;
  const correctionCount = draft.filter((line) => {
    const item = proposal.find((row) => row.id === line.inventory_item_id);
    return !item || Boolean(quantityCorrectionText(quantityInputs[line.inventory_item_id] ?? String(line.quantity), item));
  }).length + (neededInvalid ? 1 : 0) + (!fresh ? 1 : 0);
  const readyForReview = requestLines.length > 0 && correctionCount === 0 && !loading && !busy;
  const missingOverrideReasons = requestLines.filter((line) => {
    const item = proposal.find((row) => row.id === line.inventory_item_id);
    return item && Math.abs(line.quantity - suggested(item)) > 1e-6 && !line.override_reason.trim();
  }).length;

  return (
    <div className="inventory-workspace-page manager-request-page max-w-7xl min-w-0 space-y-5 [&_button]:min-h-11 [&_button]:min-w-11">
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent className="manager-request-clear-dialog" onCloseAutoFocus={(event) => { event.preventDefault(); (clearButtonRef.current?.disabled ? editHeadingRef.current : clearButtonRef.current)?.focus(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this request?</AlertDialogTitle>
            <AlertDialogDescription>All unsaved item quantities and manually added rows will be removed. Your priority and needed time will stay. Stock suggestions and issued requests will stay.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="manager-request-clear-confirm" onClick={clearRequest}>Clear request</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent className="manager-request-clear-dialog" onCloseAutoFocus={(event) => { event.preventDefault(); (clearAllButtonRef.current ?? editHeadingRef.current)?.focus(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all items?</AlertDialogTitle>
            <AlertDialogDescription>Remove every displayed item, including stock suggestions and manually added items? Your priority and needed time will stay. Use Suggest Items to restore stock suggestions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="manager-request-clear-confirm" onClick={clearAllItems}>Clear all items</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <header className="manager-page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="manager-page-context">Inventory & Supply</p>
          <h1>Inventory Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepare a numbered request, send it externally, then record physical
            deliveries in Receiving.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workspace === "history" ? <button type="button" className="manager-request-header-primary" onClick={() => selectRequest("", "sheet")}><Plus size={16} aria-hidden="true" /> Prepare Request</button>
            : <button type="button" className="manager-request-header-secondary" onClick={() => selectRequest(lastViewedRequestRef.current || visible[0]?.id || "", "history")}>← Back to Requests</button>}
        {workspace === "history" && <Button
          size="sm"
          variant="secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </Button>}
        </div>
      </header>
      <div className="manager-workflow-steps" aria-label="Request and receiving workflow">
        <span><b>01</b><span className="stage-copy"><strong>Prepare</strong><small>Create and review the request</small></span><ChevronRight size={16} aria-hidden="true" /></span>
        <span><b>02</b><span className="stage-copy"><strong>Issue</strong><small>Finalize the formal request</small></span><ChevronRight size={16} aria-hidden="true" /></span>
        <span><b>03</b><span className="stage-copy"><strong>Send via Messenger</strong><small>Send externally and manually</small></span><ChevronRight size={16} aria-hidden="true" /></span>
        <span><b>04</b><span className="stage-copy"><strong>Receive and reconcile</strong><small>Record physical deliveries</small></span></span>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {!loading && !registerReady && (
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"
        >
          {notice}
        </p>
      )}
      {workspace === "sheet" && (() => {
      const renderSheet = (displayReview: boolean) => (
      <section
        aria-label={displayReview ? "Pre-issue request review" : "Unsaved request"}
        role={displayReview ? "dialog" : undefined}
        aria-modal={displayReview || undefined}
        className={`manager-request-sheet rounded-xl border border-border bg-card p-4 ${displayReview ? "is-review" : "is-authoring"}`}
        onKeyDown={displayReview ? (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setReview(false);
            requestAnimationFrame(() => editHeadingRef.current?.focus());
          }
          if (event.key !== "Tab") return;
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
            .filter((node) => node.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === reviewHeadingRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        } : undefined}
      >
        {!displayReview ? <>
        <div className="manager-request-authoring-grid">
          <div className="manager-request-authoring-left">
          <div className="manager-request-authoring-main">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="sr-only">Prepare request</p>
            <h2 ref={editHeadingRef} tabIndex={-1} className="text-lg font-bold">
              {revisionOf
                ? `Prepare ${revisionOf.number} Rev ${revisionOf.revision + 1}`
                : "Unsaved request sheet"}
            </h2>
            <span className="manager-request-draft-badge">Draft · not issued</span>
            {hasUnsavedChanges && <span className="manager-request-unsaved-indicator" role="status">Unsaved changes</span>}
          </div>
          {revisionOf && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setRevisionOf(null);
                setDraft([]);
                setManualIds([]);
                setRevisionIds([]);
                setQuantityInputs({});
                setShowSuggestions(false);
                setLastRemoved(null);
                cleanRequestDetails.current = { priority, neededInput };
              }}
            >
              Cancel revision
            </Button>
          )}
        </div>
        {loading && <p role="status" className="mt-3 text-sm">Loading eligible items…</p>}
        {!loading && fresh && attentionItems.length > 0 && (
          <details className="manager-request-attention mt-3 rounded-lg border px-3 py-1 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <CircleAlert size={17} className="shrink-0" aria-hidden="true" />
               <span className="min-w-0 flex-1">{attentionItems.length} stock alert{attentionItems.length === 1 ? "" : "s"}</span>
              <span className="text-xs font-bold">View details</span><ChevronRight size={16} className="manager-request-attention-chevron shrink-0" aria-hidden="true" />
            </summary>
             <p className="mt-1 text-xs">Usable stock, recorded minimum, and open requests inform each suggestion. All Request Qty fields start at 0.{allAttentionGapsCovered ? " All current suggested gaps are zero." : ""}</p>
            <ul className="manager-request-attention-list mt-2 max-h-60 overflow-y-auto border-t border-amber-200 pt-2 text-xs">
              {attentionItems.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{formatRequestQuantity(item.valid_at_need, item.quantity_scale)} {item.unit} usable at delivery · {formatRequestQuantity(item.outstanding, item.quantity_scale)} {item.unit} in open requests · {suggested(item) > 0 ? `${formatRequestQuantity(suggested(item), item.quantity_scale)} ${item.unit} provisional gap` : "No positive suggestion"}</span></li>)}
            </ul>
          </details>
        )}
        <section aria-labelledby="request-add-item-title" className="manager-request-add-item mt-3 rounded-xl border border-border bg-muted/30 p-3">
        <h3 id="request-add-item-title" className="text-sm font-bold">Add an item</h3>
         <p className="sr-only">Search eligible active items to add a line outside the stock suggestions.</p>
        <div className="manager-request-search relative mt-1">
          <label htmlFor="request-item-search" className="sr-only">Search eligible items</label>
          <input id="request-item-search" type="search" role="combobox" aria-autocomplete="list" aria-controls="request-item-suggestions" aria-expanded={itemSearchOpen && itemSuggestions.length > 0} aria-activedescendant={itemSearchOpen && itemSuggestions.length ? `request-item-option-${activeSuggestion}` : undefined} aria-describedby="request-item-search-help" disabled={!fresh} className="block min-h-11 w-full rounded-lg border border-border px-3" value={itemSearch} onFocus={() => setItemSearchOpen(true)} onChange={(e) => { setItemSearch(e.target.value); setActiveSuggestion(0); setItemSearchOpen(true); }} onKeyDown={(e) => {
            if (e.key === "Escape") { setItemSearchOpen(false); return; }
            if (!itemSuggestions.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setItemSearchOpen(true); setActiveSuggestion((index) => (index + 1) % itemSuggestions.length); }
            if (e.key === "ArrowUp") { e.preventDefault(); setItemSearchOpen(true); setActiveSuggestion((index) => (index - 1 + itemSuggestions.length) % itemSuggestions.length); }
            if (e.key === "Enter" && itemSearchOpen) { e.preventDefault(); addItem(itemSuggestions[activeSuggestion] ?? itemSuggestions[0]); }
          }} onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setItemSearchOpen(false); }} placeholder="Type an item name" />
          <p id="request-item-search-help" className="sr-only">Matching items appear as you type. Use arrow keys and Enter to add, or choose with a pointer.</p>
          {itemSearchOpen && itemSuggestions.length > 0 && <ul id="request-item-suggestions" role="listbox" aria-label="Matching inventory items" className="manager-request-search-results">
            {itemSuggestions.map((item, index) => <li key={item.id} id={`request-item-option-${index}`} role="option" aria-selected={index === activeSuggestion} className={index === activeSuggestion ? "is-active" : ""}>
              <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => addItem(item)}><strong>{item.name}</strong><span>{item.unit} · {suggested(item) > 0 ? `Gap ${formatRequestQuantity(suggested(item), item.quantity_scale)}` : "No suggested gap"}</span></button>
            </li>)}
          </ul>}
        </div>
        {fresh && itemSearch.trim() && addable.length === 0 && <p className="mt-2 text-xs text-muted-foreground" role="status">No eligible items match “{itemSearch}”. Already listed items cannot be added twice.</p>}
        </section>
        <div className="manager-request-section-heading mt-4 flex flex-wrap items-end justify-between gap-2">
          <div className="manager-request-section-copy">
             <h3 className="text-sm font-bold">Items to review</h3>
             <details className="manager-request-sheet-help"><summary>How this sheet works</summary><p>Enter a positive Request Qty to include an item; 0 excludes it. Suggested gaps are guidance only. Manually added rows can be removed and added again. Review any quantity that differs from its suggestion before issue.</p></details>
             {reviewItems.length > 0 && <span className="manager-request-mobile-gap-help"><SuggestedGapHelp mobile /></span>}
          </div>
          <div className="manager-request-section-actions">
           <Button size="sm" variant="secondary" className="manager-request-suggest-action" onClick={() => void load(true)} disabled={loading}>{showSuggestions ? <RefreshCw size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}{showSuggestions ? "Refresh Suggestions" : "Suggest Items"}</Button>
           {(reviewItems.length > 0 || draft.length > 0 || lastRemoved) && <div className="manager-request-selection-toolbar"><span role="status" className="manager-request-selected-summary">Items in request: {requestLines.length}</span>
             <div className="manager-request-toolbar-actions">
               {(draft.length > 0 || manualIds.length > 0) && <button ref={clearButtonRef} type="button" className="manager-request-text-action is-clear" onClick={() => setClearOpen(true)}>Clear request</button>}
               {reviewItems.length > 0 && <button ref={clearAllButtonRef} type="button" className="manager-request-text-action is-clear-all" onClick={() => setClearAllOpen(true)}>Clear All Items</button>}
               {lastRemoved && <button type="button" className="manager-request-text-action is-undo" onClick={undoRemove}>Undo remove</button>}
             </div>
          </div>}
          </div>
        </div>
          </div>
          <div className="manager-request-lines">
         {showSuggestions && allAttentionGapsCovered && <div className="manager-request-covered-notice" role="status"><CircleAlert size={17} aria-hidden="true" /><p><strong>All suggested gaps are 0.</strong> {coveredShortfallCount > 0 ? `Open requests cover the shortage for ${coveredShortfallCount} item${coveredShortfallCount === 1 ? "" : "s"}; usable stock remains low until delivery is received.` : "Current usable stock meets the recorded minimum."} Enter a positive Request Qty only if another request is needed.</p></div>}
         {reviewItems.length > 0 && <p className="manager-request-scroll-hint hidden min-[900px]:block">Scroll table sideways to see all stock values →</p>}<div className="manager-request-table-wrap mt-3 hidden min-[900px]:block" role="region" aria-label="Request items table" tabIndex={0}>
           <table className="manager-document-table manager-request-edit-table w-full text-left text-sm">
            <caption className="sr-only">Stock suggestions and manually added request lines</caption>
            <thead><tr className="border-b"><th className="p-2">Item</th><th className="p-2">Unit</th><th className="p-2">Usable<br />stock</th><th className="p-2">Recorded<br />minimum</th><th className="p-2">Open<br />requests</th><th className="p-2">Suggested<br />gap <SuggestedGapHelp /></th><th className="p-2">Request<br />qty</th><th className="p-2">Status</th></tr></thead>
            <tbody>{reviewItems.length === 0 && <tr><td colSpan={8} className="manager-request-table-empty p-5 text-center"><div className="manager-request-table-empty-content"><Package size={23} aria-hidden="true" /><span>No items yet. Suggest stock items or add an item above.</span></div></td></tr>}{reviewItems.map((item) => {
              const line = draft.find((row) => row.inventory_item_id === item.id);
              const raw = quantityInputs[item.id] ?? "0";
              const correction = line ? quantityCorrectionText(raw, item) : "";
              const manual = isManualRow(item.id);
              return <tr className={`border-b ${line?.quantity ? "has-request-quantity" : ""} ${manual ? "is-manual-row" : ""} ${selectedManualId === item.id && manual ? "is-selected-manual" : ""}`} key={item.id}
                tabIndex={manual ? 0 : undefined} aria-label={manual ? `${item.name}, manually added. Select row to show Remove.` : undefined}
                onClick={manual ? (event) => { if (!(event.target as HTMLElement).closest("input, button, summary, details, select, textarea, a, label")) setSelectedManualId(item.id); } : undefined}
                onKeyDown={manual ? (event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedManualId(item.id); } } : undefined}>
                <td className="p-2 manager-request-manual-item"><span className="manager-request-item-name" title={item.name}>{item.name}</span>{manual && <><span className="sr-only">Added from catalog</span><button type="button" className="manager-request-text-action is-remove manager-request-context-remove" aria-label={`Remove ${item.name} from request`} onClick={(event) => { event.stopPropagation(); removeItem(item); }}><Trash2 size={14} aria-hidden="true" /> Remove</button></>}</td>
                <td className="whitespace-nowrap p-2">{item.unit}</td>
                <td className="p-2 tabular-nums">{guidanceLabel(item.valid_at_need, item.quantity_scale)}</td>
                <td className="p-2 tabular-nums">{guidanceLabel(item.reorder_level, item.quantity_scale)}</td>
                <td className="p-2 tabular-nums">{guidanceLabel(item.outstanding, item.quantity_scale)}</td>
                <td className="p-2 tabular-nums">{guidanceLabel(suggested(item), item.quantity_scale)}</td>
                <td className="p-2"><input data-request-item-id={item.id} aria-label={`${item.name} requested quantity (${item.unit})`} aria-invalid={reviewAttempted && Boolean(correction)} aria-describedby={reviewAttempted && correction ? `request-quantity-${item.id}-desktop` : undefined} type="number" min="0" step={1 / 10 ** item.quantity_scale} className="min-h-11 w-full rounded-lg border border-border px-2" value={raw} onChange={(e) => updateQuantity(item.id, e.target.value)} onBlur={() => finishQuantity(item.id)} />{reviewAttempted && correction && <span id={`request-quantity-${item.id}-desktop`} className="sr-only">{correction}</span>}</td>
                <td className="p-2 text-xs"><RequestSuggestionGuidance item={item} line={line} /></td>
              </tr>;
            })}</tbody>
          </table>
         </div>
        {reviewItems.length > 0 && <div className="manager-request-mobile-lines mt-3 space-y-3 min-[900px]:hidden">
          {reviewItems.map((item) => {
            const line = draft.find((row) => row.inventory_item_id === item.id);
            const raw = quantityInputs[item.id] ?? "0";
            const correction = line ? quantityCorrectionText(raw, item) : "";
            const manual = isManualRow(item.id);
            return <div key={item.id} className={`manager-request-mobile-line ${line?.quantity ? "has-request-quantity" : ""} ${manual ? "is-manual-row" : ""} ${selectedManualId === item.id && manual ? "is-selected-manual" : ""}`}
              tabIndex={manual ? 0 : undefined} aria-label={manual ? `${item.name}, manually added. Select row to show Remove.` : undefined}
              onClick={manual ? (event) => { if (!(event.target as HTMLElement).closest("input, button, summary, details, select, textarea, a, label")) setSelectedManualId(item.id); } : undefined}
              onKeyDown={manual ? (event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedManualId(item.id); } } : undefined}>
              <strong className="block text-sm">{item.name} · {item.unit}</strong>
              <p className="mt-1 text-xs text-muted-foreground">Usable stock {guidanceLabel(item.valid_at_need, item.quantity_scale)} · recorded minimum {guidanceLabel(item.reorder_level, item.quantity_scale)} · open requests {guidanceLabel(item.outstanding, item.quantity_scale)} · suggested gap {guidanceLabel(suggested(item), item.quantity_scale)} {item.unit}</p>
              <RequestSuggestionGuidance item={item} line={line} />
              <label className="mt-3 block text-xs">Request quantity ({item.unit})<input data-request-item-id={item.id} aria-label={`${item.name} requested quantity (${item.unit})`} aria-invalid={reviewAttempted && Boolean(correction)} aria-describedby={reviewAttempted && correction ? `request-quantity-${item.id}-mobile` : undefined} type="number" min="0" step={1 / 10 ** item.quantity_scale} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-3 text-sm" value={raw} onChange={(e) => updateQuantity(item.id, e.target.value)} onBlur={() => finishQuantity(item.id)} />{reviewAttempted && correction && <span id={`request-quantity-${item.id}-mobile`} className="mt-1 block text-xs text-red-700">{correction}</span>}</label>
              {manual && <button type="button" className="manager-request-text-action is-remove manager-request-context-remove mt-1" aria-label={`Remove ${item.name} from request`} onClick={(event) => { event.stopPropagation(); removeItem(item); }}><Trash2 size={14} aria-hidden="true" /> Remove</button>}
            </div>;
          })}
        </div>}
        {unavailableDraft.length > 0 && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">Selected items no longer in the current eligible catalog. Remove them or refresh before review.
          {unavailableDraft.map((line) => <div key={line.inventory_item_id} className="mt-2 flex flex-wrap items-center gap-2"><span className="break-all">{line.inventory_item_id}</span><button type="button" className="min-h-11 font-semibold underline" onClick={() => setDraft((rows) => rows.filter((row) => row.inventory_item_id !== line.inventory_item_id))}>Remove unavailable item</button></div>)}
        </div>}
        {fresh && !reviewItems.length && <div className="manager-request-empty mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground min-[900px]:hidden"><Package size={22} aria-hidden="true" /><strong>No items yet</strong><span>Suggest stock items or add an item above.</span></div>}
          </div>
          </div>
          <aside className="manager-request-authoring-side" aria-label="Request details">
        <div className="manager-request-details grid gap-3">
          <h3 className="text-sm font-bold">Request details</h3>
          <label className="text-sm font-semibold">
            Priority
            <select
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3"
              value={priority}
              onChange={(e) => setPriority(e.target.value as RequestPriority)}
            >
              <option value="scheduled">Scheduled</option>
              <option value="priority">Priority</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Needed date and time
            <input
              type="datetime-local"
              aria-invalid={neededInvalid}
              aria-describedby={neededInvalid ? "request-needed-error" : undefined}
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-input-background px-3"
              value={neededInput}
              onChange={(e) => {
                neededInputRef.current = e.target.value;
                setNeededInput(e.target.value);
                setFresh(false);
                setError("");
              }}
            />
            {neededInvalid && <span id="request-needed-error" className="mt-1 block text-xs text-red-700">Choose a future date and time.</span>}
          </label>
        </div>
        {!fresh && (
          <p className="mt-3 text-sm text-amber-800">
            {showSuggestions ? "Refresh suggestions" : "Suggest items"} for the selected needed time before issue.
          </p>
        )}
        {reviewAttempted && !readyForReview && <p role="status" className="mt-3 text-xs text-muted-foreground">{!requestLines.length ? "Enter a positive Request Qty to review." : `${correctionCount} field${correctionCount === 1 ? "" : "s"} need correction before review.`}</p>}
        <div className="manager-request-actions mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => {
            setReviewAttempted(true);
            const problem = validate(false);
            if (problem) {
              setError(problem);
              requestAnimationFrame(() => {
                const firstInvalid = draft.find((line) => {
                  const item = proposal.find((row) => row.id === line.inventory_item_id);
                  return item && Boolean(quantityCorrectionText(quantityInputs[line.inventory_item_id] ?? String(line.quantity), item));
                });
                const selector = firstInvalid
                  ? `input[data-request-item-id="${firstInvalid.inventory_item_id}"]`
                  : neededInvalid ? '.manager-request-details input[type="datetime-local"]' : undefined;
                if (selector) [...document.querySelectorAll<HTMLInputElement>(selector)]
                  .find((input) => input.getClientRects().length > 0)?.focus();
              });
            }
            else { setError(""); setReview(true); requestAnimationFrame(() => reviewHeadingRef.current?.focus()); }
          }} disabled={busy || loading || !fresh}>Review request</Button>
        </div>
          </aside>
        </div>
        </> : (
          <div className="manager-request-review" aria-labelledby="pre-issue-title">
            <div className="manager-issued-document">
              <div className="manager-issued-document-head">
                <p className="manager-section-eyebrow">RRJ’S FOOD-HOUSE · INVENTORY REQUEST</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="pre-issue-title" ref={reviewHeadingRef} tabIndex={-1} className="text-xl font-extrabold">Review Request</h2>
                  <span className="manager-state-badge is-pending">DRAFT · NOT ISSUED</span>
                </div>
                <button type="button" className="manager-request-review-close" aria-label="Close review" onClick={() => { setReview(false); requestAnimationFrame(() => editHeadingRef.current?.focus()); }}>×</button>
                <p className="mt-2 text-sm">{revisionOf ? `Proposed ${revisionOf.number} · Rev ${revisionOf.revision + 1}` : "New request · reference and creation date assigned on issue"}</p>
              </div>
              <p className="manager-request-review-guidance is-ready" role="status">Review {requestLines.length} item{requestLines.length === 1 ? "" : "s"} before issue.</p>
              <div className="manager-request-document-meta grid gap-3 border-b border-border px-4 py-4 sm:grid-cols-2">
                <div><p className="manager-section-eyebrow">Priority</p><p className="mt-1 font-bold capitalize">{priority}</p></div>
                <div><p className="manager-section-eyebrow">Requested delivery</p><p className="mt-1 font-bold">{neededAt ? manila(neededAt) : "Invalid time"}</p></div>
              </div>
              <div className="manager-request-document-summary px-4 py-3 text-sm"><strong>Requested items</strong></div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="manager-document-table manager-request-review-table w-full text-left text-sm">
                  <caption className="sr-only">Exact quantities in this unsaved request</caption>
                  <thead><tr><th scope="col">Item</th><th scope="col">Unit</th><th scope="col">Suggested gap</th><th scope="col">Request qty</th><th scope="col">Comparison</th><th scope="col">Reason, if different</th></tr></thead>
                  <tbody>{requestLines.map((line) => {
                    const item = proposal.find((row) => row.id === line.inventory_item_id);
                    const isOverride = item && Math.abs(line.quantity - suggested(item)) > 1e-6;
                    return <tr key={line.inventory_item_id}><th scope="row" className="break-words">{item?.name ?? "Unavailable item"}<span className="sr-only">Inventory ID: {line.inventory_item_id}</span></th><td>{item?.unit ?? "—"}</td><td className="tabular-nums">{item ? formatRequestQuantity(suggested(item), item.quantity_scale) : "—"}</td><td className="font-bold tabular-nums">{formatRequestQuantity(line.quantity, item?.quantity_scale)}</td><td><span className={`manager-request-review-status ${isOverride ? "is-override" : "is-match"}`}>{isOverride ? "Different" : "Matches"}</span></td><td>{isOverride && item ? <label className="manager-request-review-reason block text-xs font-normal"><span className="sr-only">Reason for {item.name} quantity difference, required to issue</span><input aria-label={`${item.name} quantity difference reason`} aria-invalid={!line.override_reason.trim()} placeholder="Required to issue" className="block min-h-11 w-full rounded-lg border border-border px-2 text-sm" value={line.override_reason} onChange={(e) => updateReason(item.id, e.target.value)} /></label> : <span className="text-muted-foreground">—</span>}</td></tr>;
                  })}</tbody>
                </table>
              </div>
              <ol className="space-y-2 px-4 py-4 sm:hidden">{requestLines.map((line, index) => {
                const item = proposal.find((row) => row.id === line.inventory_item_id);
                const isOverride = item && Math.abs(line.quantity - suggested(item)) > 1e-6;
                return <li key={line.inventory_item_id} className="manager-request-mobile-line"><div className="flex items-start gap-3"><span className="manager-request-line-number">{index + 1}</span><div className="min-w-0 flex-1"><strong className="block break-words">{item?.name ?? "Unavailable item"}</strong><span className="sr-only">Inventory ID: {line.inventory_item_id}</span><p className="mt-2 text-xs">Suggested gap: <strong>{item ? formatRequestQuantity(suggested(item), item.quantity_scale) : "—"} {item?.unit ?? ""}</strong></p><p className="mt-1 text-xs">Request qty: <strong className="tabular-nums">{formatRequestQuantity(line.quantity, item?.quantity_scale)} {item?.unit ?? "—"}</strong></p><span className={`manager-request-review-status mt-2 ${isOverride ? "is-override" : "is-match"}`}>{isOverride ? "Different" : "Matches"}</span>{isOverride && item && <label className="manager-request-review-reason mt-2 block text-xs"><span>Reason for different quantity <strong>Required to issue</strong></span><input aria-label={`${item.name} quantity difference reason`} aria-invalid={!line.override_reason.trim()} className="mt-1 block min-h-11 w-full rounded-lg border border-border px-2 text-sm" value={line.override_reason} onChange={(e) => updateReason(item.id, e.target.value)} /></label>}</div></div></li>;
              })}</ol>
              <p className="manager-issued-issuer">Draft preview · not issued</p>
            </div>
            {missingOverrideReasons > 0 && <p className="manager-request-review-guidance needs-reasons" role="status">{missingOverrideReasons} item{missingOverrideReasons === 1 ? "" : "s"} need{missingOverrideReasons === 1 ? "s" : ""} a reason for changing the suggested gap before Issue Request.</p>}
            {!fresh && <p role="alert" className="mt-3 text-sm text-amber-800">Suggestions need refresh for this delivery time. Return to edit and refresh before issue.</p>}
            <div className="manager-request-actions mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setReview(false); requestAnimationFrame(() => editHeadingRef.current?.focus()); }}>Back to edit</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => {
                try { printPdf(previewDocument); } catch (caught) { setError(errorText(caught)); }
              }}>Export PDF</Button>
              <Button size="sm" onClick={() => void issue()} loading={busy} disabled={busy || loading || Boolean(validate(true))}>Issue Request</Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Export PDF saves a draft. Issue Request creates the official request reference.</p>
          </div>
        )}
      </section>
      );
      return review ? <><div aria-hidden="true" inert>{renderSheet(false)}</div>{createPortal(<><div className="manager-request-review-backdrop" aria-hidden="true" />{renderSheet(true)}</>, document.body)}</> : renderSheet(false);
      })()}
      {workspace === "history" && <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(280px,34%)_minmax(0,1fr)]">
      <section
        aria-label="Request register"
        className={`manager-request-register min-w-0 rounded-xl border border-border bg-card p-4 ${selected ? "hidden xl:block" : ""}`}
      >
        <h2 className="text-lg font-bold">Request Register</h2>
        <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
          <input
            type="search"
            aria-label="Search requests"
            placeholder="Search request no., item, destination…"
            className="min-h-11 w-full min-w-0 rounded-lg border border-border px-3 text-sm sm:col-span-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="text-xs font-semibold">Status
            <select aria-label="Filter request status" className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-card px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InventoryRequest["status"] | "")}>
              <option value="">All statuses</option>
              {Object.entries(requestStatus).map(([value, state]) => <option key={value} value={value}>{state.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Destination
            <select aria-label="Filter request destination" className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-card px-2 text-sm" value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)}>
              <option value="">All destinations</option>
              {destinations.map((destination) => <option key={destination} value={destination}>{destination}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span role="status">{visible.length} of {register.length} request{register.length === 1 ? "" : "s"}</span>
          <label className="flex items-center gap-2">Sort
            <select aria-label="Sort requests" className="min-h-11 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}>
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
        {selectedId && registerReady && !selected && (
          <p role="alert" className="mt-3 text-sm text-amber-900">
            This request is not in the current authorized register. Choose another request or refresh.
          </p>
        )}
        {loading ? (
          <p role="status">Loading requests…</p>
        ) : !registerReady ? (
          <p role="status" className="mt-4 text-sm">Request history is unavailable until the current register loads.</p>
        ) : !visible.length ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm"><p>{register.length ? "No requests match these filters. Clear the search or choose another status or destination." : "No formal Inventory Requests have been issued yet."}</p>{register.length === 0 && <button type="button" className="mt-3 min-h-11 font-semibold text-primary underline" onClick={() => selectRequest("", "sheet")}>Prepare Request</button>}</div>
        ) : (
          <ul className="manager-request-register-list mt-2 max-h-[min(72vh,760px)] overflow-y-auto pr-1" aria-label="Formal inventory requests">
            {visible.map((row) => {
              return <li key={row.id} className={`manager-request-history-row ${selectedId === row.id ? "is-selected" : ""}`}>
                <button type="button" aria-current={selectedId === row.id ? "true" : undefined} className="manager-request-row" onClick={() => selectRequest(row.id)}>
                  <span className="min-w-0 flex-1 text-left"><span className="flex flex-wrap items-baseline gap-x-2"><strong className="break-all text-sm">{row.number}</strong><small className="whitespace-nowrap">Rev {row.revision}</small></span><span className="mt-0.5 block break-words text-xs text-muted-foreground">{row.snapshot.destination || "Destination not recorded"} · Needed {manilaDate(row.needed_at)}</span></span>
                  <span className="manager-request-status-badge" data-status={row.status}>{requestStatus[row.status].label}</span>
                  <ChevronRight size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>;
            })}
          </ul>        )}
      </section>
      {selected ? (
        <section
          key={selected.id}
          aria-label={`${selected.number} detail`}
          className="manager-request-detail min-w-0 rounded-xl border border-border bg-card p-4"
        >
          <button type="button" className="mb-3 min-h-11 text-sm font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:hidden" onClick={() => selectRequest("")}>← Back to Requests</button>
          {!visible.some((row) => row.id === selected.id) && <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">This selected request is outside the current register filters. Its details remain open.</p>}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="manager-section-eyebrow">Formal inventory request</p>
              <div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="break-all text-xl font-bold sm:text-2xl">{selected.number}</h2><span className="text-xs font-semibold text-muted-foreground">Rev {selected.revision}</span><span className="manager-request-status-badge" data-status={selected.status}>{requestStatus[selected.status].label}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">{requestStatus[selected.status].description}</p>
            </div>
            <details className="manager-request-actions-menu relative">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><MoreHorizontal size={17} aria-hidden="true" /> Actions</summary>
              <div id="request-export-actions" className="manager-export-actions absolute right-0 z-20 mt-1 grid w-[min(19rem,calc(100vw-3rem))] gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">
                <p className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Document</p>
                <button ref={documentExpandRef} type="button" onClick={() => setDocumentExpanded(true)}>View official document</button>
                <button type="button" onClick={() => void copySnapshot(selected.snapshot)}>Copy Text</button>
                <button type="button" onClick={() => { if (canUseRegister()) downloadText(issuedRequestDocument(selected.snapshot)); }}>Download Text</button>
                <button type="button" onClick={() => { if (canUseRegister()) downloadPng(issuedRequestDocument(selected.snapshot)); }}>PNG</button>
                <button type="button" onClick={() => { if (!canUseRegister()) return; try { printPdf(issuedRequestDocument(selected.snapshot)); } catch (caught) { setError(errorText(caught)); } }}>Export PDF</button>
                {(selected.status === "issued" || selected.status === "partially_received") && <div className="mt-1 border-t border-border pt-2">
                  <p className="px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Administrative</p>
                  {selected.receipts.length === 0 && <button type="button" onClick={() => beginRevision(selected)}>Prepare new revision</button>}
                  <label className="mt-2 block px-2 text-xs font-semibold">Shortfall reason
                    <input className="mt-1 block min-h-11 w-full rounded-lg border border-border px-2 text-sm" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
                  </label>
                  <button type="button" title={selected.receipts.some((receipt) => receipt.status === "draft") ? "Finish or cancel the linked Receiving draft first." : !closeReason.trim() ? "Enter a shortfall reason first." : undefined} disabled={!closeReason.trim() || busy || selected.receipts.some((receipt) => receipt.status === "draft")} onClick={() => {
                    if (!canUseRegister() || busy || !closeReason.trim()) return;
                    if (!window.confirm(`Close ${selected.number} with outstanding quantities?`)) return;
                    setBusy(true);
                    void closeInventoryRequestShort(selected.id, selected.revision, closeReason.trim())
                      .then(() => { setNotice("Request closed with documented shortfall. Stock did not change."); setCloseReason(""); return load(); })
                      .catch((caught) => setError(errorText(caught)))
                      .finally(() => setBusy(false));
                  }}>Close with shortfall</button>
                </div>}
              </div>
            </details>
          </div>
          <div role="tablist" aria-label="Selected request views" className="mt-3 flex gap-1 border-b border-border" onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const nextView = event.key === "Home" ? "document" : event.key === "End" ? "history" : detailView === "document" ? "history" : "document";
            setDetailView(nextView);
            event.currentTarget.querySelector<HTMLElement>(nextView === "document" ? "#request-document-tab" : "#request-history-tab")?.focus();
          }}>
            <button type="button" role="tab" tabIndex={detailView === "document" ? 0 : -1} aria-selected={detailView === "document"} id="request-document-tab" aria-controls="request-document-panel" className="manager-request-detail-tab" onClick={() => setDetailView("document")}>Document</button>
            <button type="button" role="tab" tabIndex={detailView === "history" ? 0 : -1} aria-selected={detailView === "history"} id="request-history-tab" aria-controls="request-history-panel" className="manager-request-detail-tab" onClick={() => setDetailView("history")}>History &amp; Audit</button>
          </div>
          {detailView === "document" ? <div role="tabpanel" id="request-document-panel" aria-labelledby="request-document-tab">
          <dl className="manager-request-meta mt-3 grid grid-cols-2 gap-2 border-y border-border py-2 xl:grid-cols-5">
            <div><dt><CalendarDays size={15} aria-hidden="true" /> Issued</dt><dd>{manila(selected.issued_at)}</dd></div>
            <div><dt><Clock3 size={15} aria-hidden="true" /> Needed</dt><dd>{manila(selected.needed_at)}</dd></div>
            <div><dt><UserRound size={15} aria-hidden="true" /> Issued by</dt><dd>{selected.issued_by_name || "Manager not recorded"}</dd></div>
            <div><dt><Flag size={15} aria-hidden="true" /> Priority</dt><dd className="capitalize">{selected.priority}</dd></div>
            <div><dt><Box size={15} aria-hidden="true" /> Destination</dt><dd>{selected.snapshot.destination || "Not recorded"}</dd></div>
          </dl>
          {requestPastNeededDate(selected, now) && <p className="mt-2 text-sm font-semibold text-amber-900">Past needed date · Follow up on the outstanding request.</p>}
          {selected.close_reason && (
            <p className="mt-2 text-sm">
              Shortfall closure: {selected.close_reason}
            </p>
          )}
          <div className="manager-request-summary mt-3 grid gap-2 sm:grid-cols-3" aria-label="Fulfillment summary">
            <div><Package size={18} aria-hidden="true" /><span><small>Requested items</small><strong className="tabular-nums">{selected.lines.length}</strong><small>item lines</small></span></div>
            <div><Truck size={18} aria-hidden="true" /><span><small>Posted deliveries</small><strong className="tabular-nums">{progress?.postedReceipts}</strong><small>Receiving document{progress?.postedReceipts === 1 ? "" : "s"}</small></span></div>
            <div><CircleAlert size={18} aria-hidden="true" /><span><small>{selected.status === "closed_short" ? "Unfilled at closure" : "Still outstanding"}</small><strong className="tabular-nums">{progress?.outstandingLines}</strong><small>item lines</small></span></div>
          </div>
          <div className="manager-request-next-action mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Next action</p><p className="text-xs text-emerald-950">{progress?.next === "draft" ? "Continue the linked Receiving draft; stock is unchanged until posting." : progress?.next === "delivery" ? "Record a physical delivery in Receiving when it arrives." : selected.status === "fulfilled" ? "Review the completed Receiving record." : "Review linked Receiving and request history."}</p></div>
            {progress?.next === "draft" ? (
              <Button size="sm" className="manager-request-primary-action" disabled={busy || !canUseRegister()} onClick={() => onReceive(progress.draftReceipt!.id)}>Resume Receiving</Button>
            ) : progress?.next === "delivery" ? (
              <Button size="sm" className="manager-request-primary-action" disabled={busy || !canUseRegister()} onClick={() => onReceive(null)}>{selected.status === "partially_received" ? "Record Additional Delivery" : "Record Delivery"}</Button>
            ) : selected.status === "fulfilled" && selected.receipts.some((receipt) => receipt.status === "posted") ? (
              <Button size="sm" variant="secondary" disabled={busy || !canUseRegister()} onClick={() => onReceive(selected.receipts.find((receipt) => receipt.status === "posted")!.id)}>View Completed Receipt</Button>
            ) : (
              <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => document.getElementById("request-linked-receipts")?.scrollIntoView({ behavior: "smooth", block: "start" })}>View Receiving History</button>
            )}
          </div>
          <h3 className="mt-4 font-bold">Requested items and fulfillment</h3>
          <div className="mt-3 space-y-3 md:hidden">
            {selected.lines.map((line) => (
              <dl
                className="rounded-lg border border-border p-3 text-sm"
                key={line.inventory_item_id}
              >
                <dt className="mb-2 font-bold">{line.name}</dt>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <dt className="text-muted-foreground">Requested</dt>
                    <dd>
                      {formatRequestQuantity(line.quantity)} {line.unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Accepted / stock posted
                    </dt>
                    <dd>
                      {formatRequestQuantity(line.accepted)} {line.unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Rejected delivered
                    </dt>
                    <dd>
                      {formatRequestQuantity(line.rejected)} {line.unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{selected.status === "closed_short" ? "Unfilled at closure" : "Outstanding"}</dt>
                    <dd>
                      {formatRequestQuantity(line.remaining)} {line.unit}
                    </dd>
                  </div>
                </div>
              </dl>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="manager-request-fulfillment-table w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">#</th>
                  <th className="p-2">Item</th>
                  <th className="p-2">Requested</th>
                  <th className="p-2">Accepted / stock posted</th>
                  <th className="p-2">Rejected delivered</th>
                  <th className="p-2">{selected.status === "closed_short" ? "Unfilled at closure" : "Outstanding"}</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((line, index) => (
                  <tr className="border-b" key={line.inventory_item_id}>
                    <td className="p-2 text-muted-foreground">{index + 1}</td>
                    <td className="p-2">{line.name}</td>
                    <td className="p-2">
                      {formatRequestQuantity(line.quantity)} {line.unit}
                    </td>
                    <td className="p-2">
                      {formatRequestQuantity(line.accepted)} {line.unit}
                    </td>
                    <td className="p-2">
                      {formatRequestQuantity(line.rejected)} {line.unit}
                    </td>
                    <td className="p-2">
                      {formatRequestQuantity(line.remaining)} {line.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Only posted accepted quantities count as stock. Rejected delivered and undelivered quantities are distinct; draft Receiving does not increase inventory. Outstanding is requested minus posted accepted.
          </p>
          {(() => {
            const panel = <>
          {documentExpanded && <div className="fixed inset-0 bg-black/60" style={{ zIndex: 999 }} aria-hidden="true" />}
          <div
            role={documentExpanded ? "dialog" : undefined}
            aria-modal={documentExpanded ? true : undefined}
            aria-label={documentExpanded ? `${selected.number} official request document` : undefined}
            style={documentExpanded ? { zIndex: 1000, backgroundColor: "#fff" } : undefined}
            onKeyDown={documentExpanded ? (event) => {
              if (event.key === "Escape") { setDocumentExpanded(false); requestAnimationFrame(() => documentExpandRef.current?.focus()); }
              if (event.key === "Tab") {
                const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
                if (!focusable.length) return;
                if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
                else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
              }
            } : undefined}
            className={documentExpanded ? "fixed inset-3 z-50 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl md:inset-8" : "mt-4"}
          >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">Official issued document</h3>
            <button ref={documentCloseRef} type="button" autoFocus={documentExpanded} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => { setDocumentExpanded(false); requestAnimationFrame(() => documentExpandRef.current?.focus()); }}>Close full document</button>
          </div>
          <div className="manager-issued-document min-w-0">
            <div className="manager-issued-document-head">
              <p className="manager-section-eyebrow">RRJ’S FOOD-HOUSE · INVENTORY REQUEST</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3>{selected.number} <span>Rev {selected.revision}</span></h3>
                <span className="manager-state-badge is-fulfillment">{requestStatus[selected.status].label}</span>
              </div>
              <p>Official request document · physical deliveries are recorded in Receiving.</p>
            </div>
            <div className="manager-request-document-meta grid gap-3 border-b border-border px-4 py-4 sm:grid-cols-2 2xl:grid-cols-3">
              <div><p className="manager-section-eyebrow">Issued / created</p><p className="mt-1 font-semibold">{manila(selected.snapshot.issued_at)}</p></div>
              {(selected.snapshot.issued_by_name || selected.issued_by_name) && <div><p className="manager-section-eyebrow">Issued by</p><p className="mt-1 break-words font-semibold">{selected.snapshot.issued_by_name || selected.issued_by_name}</p></div>}
              <div><p className="manager-section-eyebrow">Priority</p><p className="mt-1 font-semibold capitalize">{selected.snapshot.priority}</p></div>
              <div><p className="manager-section-eyebrow">Needed</p><p className="mt-1 font-semibold">{manila(selected.snapshot.needed_at)}</p></div>
              {selected.snapshot.destination && <div><p className="manager-section-eyebrow">Destination</p><p className="mt-1 font-semibold">{selected.snapshot.destination}</p></div>}
            </div>
            <div className="manager-request-document-summary flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><strong>Requested items</strong><span>{selected.snapshot.lines.length} item line{selected.snapshot.lines.length === 1 ? "" : "s"} · quantities shown per unit</span></div>
            <div className="hidden overflow-x-auto sm:block"><table className="manager-document-table w-full text-left text-sm"><thead><tr><th scope="col">#</th><th scope="col">Item / ID</th><th scope="col" className="text-right">Quantity</th><th scope="col">Unit</th></tr></thead><tbody>{selected.snapshot.lines.map((line, index) => <tr key={line.inventory_item_id}><td>{index + 1}</td><th scope="row" className="break-words">{line.name}<span className="mt-1 block break-all text-xs font-normal text-muted-foreground">ID: {line.inventory_item_id}</span></th><td className="text-right font-bold tabular-nums">{formatRequestQuantity(line.quantity)}</td><td>{line.unit}</td></tr>)}</tbody></table></div>
            <ol className="space-y-2 px-4 py-4 sm:hidden">{selected.snapshot.lines.map((line, index) => <li key={line.inventory_item_id} className="manager-request-mobile-line"><div className="flex items-start gap-3"><span className="manager-request-line-number">{index + 1}</span><div className="min-w-0 flex-1"><strong className="block break-words">{line.name}</strong><p className="mt-1 break-all text-xs text-muted-foreground">ID: {line.inventory_item_id}</p><p className="mt-1 font-bold tabular-nums">{formatRequestQuantity(line.quantity)} {line.unit}</p></div></div></li>)}</ol>
            <p className="manager-issued-issuer">Request document only · Exporting does not send the request or change stock.</p>
          </div>
          </div>
          </>;
            return documentExpanded ? createPortal(panel, document.body) : null;
          })()}
          <h3 id="request-linked-receipts" className="mt-4 font-bold">Linked Receiving Documents</h3>
          {selected.receipts.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {selected.receipts.map((receipt) => (
                <li key={receipt.id} className="manager-request-receipt-row flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2"><strong className="break-all text-primary">{receipt.number}</strong><span className="manager-request-status-badge" data-status={receipt.status}>{receipt.status === "draft" ? "Draft · stock unchanged" : "Posted · accepted reconciled"}</span></p><p className="mt-0.5 text-xs text-muted-foreground">{inspectorLabel(receipt.inspector)} · {receipt.posted_at ? `Posted ${manila(receipt.posted_at)}` : "Awaiting posting"}</p></div>
                  {!(receipt.status === "draft" && progress?.draftReceipt?.id === receipt.id) && <button className="manager-request-open-receipt" type="button" onClick={() => { if (canUseRegister()) onReceive(receipt.id); }}>{receipt.status === "draft" ? "Resume Receiving" : "View Receipt"}<span className="sr-only"> {receipt.number}</span></button>}
                  {isInspectorAuditId(receipt.inspector) ? <details className="mt-1 text-xs"><summary className="min-h-11 cursor-pointer text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Inspector audit ID</summary><code className="break-all">{receipt.inspector}</code></details> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm">No Receiving document is linked to this request yet.</p>
          )}
          </div> : <div role="tabpanel" id="request-history-panel" aria-labelledby="request-history-tab" className="pt-4">
          <h3 className="font-bold">History &amp; Audit</h3>
          {selected.revisions.length > 1 && (
            <section className="mt-4" aria-label="Previous revision snapshots">
              <h4 className="font-semibold">Previous revision snapshots</h4>
              {selected.revisions
                .filter((row) => row.revision !== selected.revision)
                .map((row) => (
                  <div key={row.revision} className="mt-2">
                    <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                      {requestDocumentText(issuedRequestDocument(row.snapshot))}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (canUseRegister()) downloadText(issuedRequestDocument(row.snapshot));
                      }}
                    >
                      Export Rev {row.revision} text
                    </Button>
                  </div>
                ))}
            </section>
          )}
          <section className="mt-5 rounded-lg border border-border p-3" aria-label="Audit timeline">
            <h4 className="font-bold">Audit timeline ({selected.events.length})</h4>
            {selected.events.length ? (
              <ol className="mt-2 space-y-3 border-l border-border pl-4 text-sm">
                {selected.events.map((event, index) => {
                  const presentation = requestEventPresentation(event);
                  const details = requestEventDetailRows(event.details);
                  return (
                    <li key={`${event.at}-${index}`} className="min-w-0">
                      <p className="font-semibold">{presentation.title}</p>
                      <p className="text-xs text-muted-foreground">Rev {event.revision} · {manila(event.at)} · {event.actor || "Actor not recorded"}</p>
                      <p className="mt-1 text-xs">{presentation.note}</p>
                      <details className="mt-1">
                        <summary className="min-h-11 cursor-pointer text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Event details</summary>
                        <p className="break-all font-mono text-xs">Event code: {event.type}</p>
                        {details.length ? (
                          <dl className="mt-2 grid gap-2 rounded-lg bg-muted p-3 text-xs sm:grid-cols-2">
                            {details.map((detail) => (
                              <div key={detail.key} className="min-w-0">
                                <dt className="font-semibold text-muted-foreground">
                                  {detail.label}
                                </dt>
                                <dd className="mt-0.5 break-words text-foreground">
                                  {detail.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            No additional details were recorded.
                          </p>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="mt-2 text-sm text-muted-foreground">No request events were returned.</p>}
          </section>
          </div>}
        </section>
      ) : <section aria-label="Selected request" className="hidden min-w-0 rounded-xl border border-border bg-card p-6 xl:block"><h2 className="text-lg font-bold">Select a request</h2><p className="mt-2 text-sm text-muted-foreground">Choose a formal request from the register to review its issued document, fulfillment, linked Receiving, and history.</p></section>}
      </div>}
    </div>
  );
}
