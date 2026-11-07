import { supabase } from "@/lib/supabase";

export type ReceivingSourceType = "production_team" | "direct_supplier";
export type ReceivingReportStatus = "draft" | "posted";

export interface ReceivingInventoryItem {
  id: string;
  itemName: string;
  unit: string;
  secondaryUnit: string | null;
  quantityOnHand: number;
  quantityScale: number;
  rotationPolicy: "fifo" | "fefo";
  expiryRequired: boolean;
}

export interface ReceivingReportSummary {
  id: string;
  rrNumber: string;
  sourceType: ReceivingSourceType;
  policyClass?: ReceivingPolicyEvidence["classification"];
  sourceReference: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  supplierName: string | null;
  receivedAt: string;
  status: ReceivingReportStatus;
  postedAt: string | null;
  lineCount: number;
  totalDelivered: number;
  totalAccepted: number;
  totalRejected: number;
  updatedAt: string;
}

export interface ReceivingReportItem {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  unit: string;
  secondaryUnit: string | null;
  expiryRequired: boolean;
  rotationPolicy: "fifo" | "fefo";
  purchaseOrderItemId: string | null;
  quantityOrdered: number | null;
  quantityReceived: number | null;
  quantityCancelled: number | null;
  quantityRemaining: number | null;
  secondaryQuantityOrdered: number | null;
  secondaryQuantityReceived: number | null;
  quantityDelivered: number;
  quantityAccepted: number;
  quantityRejected: number;
  secondaryQuantityDelivered: number | null;
  secondaryQuantityAccepted: number | null;
  secondaryQuantityRejected: number | null;
  rejectionReason: string | null;
  sourceLotCode: string | null;
  manufacturedOn: string | null;
  useByDate: string | null;
  batchId: string | null;
  batchCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivingReport {
  id: string;
  rrNumber: string;
  sourceType: ReceivingSourceType;
  sourceReference: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  receivedAt: string;
  receivedBy: string;
  receivedByName: string | null;
  status: ReceivingReportStatus;
  supplierDeliveryReference: string | null;
  postedAt: string | null;
  postedBy: string | null;
  postedByName: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReceivingReportItem[];
}

export interface ReceivingWorkspace {
  reports: ReceivingReportSummary[];
  selectedReport: ReceivingReport | null;
  inventoryItems: ReceivingInventoryItem[];
}

export interface ReceivingDocumentFilters {
  search?: string;
  status?: ReceivingReportStatus | "";
  sourceType?: ReceivingSourceType | "";
  fromDate?: string;
  toDate?: string;
}

export interface ReceivingDocumentPage {
  rows: ReceivingReportSummary[];
  hasMore: boolean;
}

export interface ReceivingDraftHeaderInput {
  requestId?: string;
  reportId?: string;
  sourceType: ReceivingSourceType;
  sourceReference: string;
  purchaseOrderId: string | null;
  receivedAt: string;
  supplierDeliveryReference: string;
}

export interface ReceivingPolicyEvidence {
  classification: "direct_supplier" | "formal_request" | "historical_legacy_request" | "manager_emergency" | "historical_unlinked";
  reason: string | null;
  authorizedByName: string | null;
  authorizedAt: string | null;
  inspectedByName: string | null;
  inspectionNote: string | null;
}

export async function getReceivingPolicyEvidence(reportId: string): Promise<ReceivingPolicyEvidence> {
  const { data, error } = await supabase.rpc("get_receiving_policy_evidence", { p_report_id: reportId });
  if (error) {
    if (import.meta.env.DEV) console.error("Receiving policy evidence read failed", { code: error.code, message: error.message });
    throw new Error(error.code === "PGRST202"
      ? "Receiving details are unavailable because this database has not enabled the required classification service. Ask an administrator to review the Receiving deployment. No report was changed."
      : getFriendlyReceivingError(error.message, "Unable to verify this Receiving document. Try again; editing and posting are unavailable until verification succeeds."));
  }
  const row = requireRecord(data, "receiving policy evidence");
  return {
    classification: requireEnum(
      row.classification,
      RECEIVING_POLICY_CLASSES,
      "receiving classification",
    ),
    reason: optionalString(row.reason, "emergency reason"),
    authorizedByName: optionalString(row.authorized_by_name, "authorizing manager"),
    authorizedAt: optionalTimestamp(row.authorized_at, "authorization time"),
    inspectedByName: optionalString(row.inspected_by_name, "inspector"),
    inspectionNote: optionalString(row.inspection_note, "inspection note"),
  };
}

export async function verifyReceivingPolicyAvailable(): Promise<void> {
  const { data, error } = await supabase.rpc("get_receiving_policy_classes", { p_report_ids: [] });
  if (error) {
    if (import.meta.env.DEV) console.error("Receiving policy availability read failed", { code: error.code, message: error.message });
    throw new Error(error.code === "PGRST202"
      ? "Manager emergency Receiving is unavailable because this database has not enabled the required policy service. Ask an administrator to review the Receiving deployment. No report was changed."
      : getFriendlyReceivingError(error.message, "Unable to verify the Receiving policy. Try again before recording an emergency delivery."));
  }
  if (!Array.isArray(data) || data.length !== 0) {
    throw new Error("The Receiving policy service returned an unexpected result. Emergency recording remains unavailable.");
  }
}

export async function createEmergencyProductionReceiving(input: {
  reportId: string;
  receivedAt: string;
  sourceReference: string;
  reason: string;
  inspectedByName: string;
}): Promise<{ id: string; rrNumber: string }> {
  const { data, error } = await supabase.rpc("create_emergency_production_receiving", {
    p_report_id: input.reportId,
    p_received_at: input.receivedAt,
    p_source_reference: input.sourceReference || null,
    p_reason: input.reason,
    p_inspected_by_name: input.inspectedByName,
  });
  if (error) {
    if (import.meta.env.DEV) console.error("Manager emergency Receiving failed", { code: error.code, message: error.message });
    throw new Error(error.code === "PGRST202"
      ? "Manager emergency Receiving is unavailable on this database. Ask an administrator to review the Receiving deployment. No report was created."
      : getFriendlyReceivingError(error.message, "Unable to record this emergency delivery. Review the details and try again."));
  }
  const row = requireRecord(data, "emergency receiving result");
  return { id: requireUuid(row.id, "receiving report ID"), rrNumber: requireString(row.rr_number, "receiving report number") };
}

export interface ReceivingDraftLineInput {
  reportId: string;
  itemId: string;
  inventoryItemId: string | null;
  purchaseOrderItemId: string | null;
  quantityDelivered: number;
  quantityAccepted: number;
  secondaryQuantityDelivered: number | null;
  secondaryQuantityAccepted: number | null;
  rejectionReason: string;
  sourceLotCode: string;
  manufacturedOn: string | null;
  useByDate: string | null;
}

export interface ReceivingPostResult {
  receivingReportId: string;
  rrNumber: string;
  sourceType: ReceivingSourceType;
  status: "posted";
  lineCount: number;
  batchCount: number;
  transactionCount: number;
  totalAccepted: number;
  postedAt: string;
  postedBy: string;
}

export class ReceivingPostRejectedError extends Error {
  constructor(message: string, public readonly alreadyPosted: boolean) {
    super(message);
    this.name = "ReceivingPostRejectedError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_TYPES = new Set<ReceivingSourceType>([
  "production_team",
  "direct_supplier",
]);
const REPORT_STATUSES = new Set<ReceivingReportStatus>(["draft", "posted"]);
const RECEIVING_POLICY_CLASSES = new Set<ReceivingPolicyEvidence["classification"]>([
  "direct_supplier",
  "formal_request",
  "historical_legacy_request",
  "manager_emergency",
  "historical_unlinked",
]);
const ROTATION_POLICIES = new Set(["fifo", "fefo"] as const);
const DRAFT_REQUEST_KEY = "rrj_manager_receiving_draft_request_v1";

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${name}.`);
  }

  return value as Record<string, unknown>;
}

function requireList(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${name}.`);
  }

  return value;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The server returned an invalid ${name}.`);
  }

  return value.trim();
}

function optionalString(value: unknown, name: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`The server returned an invalid ${name}.`);
  }
  return value.trim() || null;
}

function requireUuid(value: unknown, name: string): string {
  const result = requireString(value, name);
  if (!UUID_PATTERN.test(result)) {
    throw new Error(`The server returned an invalid ${name}.`);
  }
  return result;
}

function optionalUuid(value: unknown, name: string): string | null {
  return value === null || value === undefined
    ? null
    : requireUuid(value, name);
}

function requireNumber(value: unknown, name: string): number {
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new Error(`The server returned an invalid ${name}.`);
  }
  return result;
}

function optionalNumber(value: unknown, name: string): number | null {
  return value === null || value === undefined
    ? null
    : requireNumber(value, name);
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`The server returned an invalid ${name}.`);
  }
  return value;
}

function requireTimestamp(value: unknown, name: string): string {
  const result = requireString(value, name);
  if (Number.isNaN(Date.parse(result))) {
    throw new Error(`The server returned an invalid ${name}.`);
  }
  return result;
}

function optionalTimestamp(value: unknown, name: string): string | null {
  return value === null || value === undefined
    ? null
    : requireTimestamp(value, name);
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  name: string,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`The server returned an unsupported ${name}.`);
  }
  return value as T;
}

function mapInventoryItem(value: unknown): ReceivingInventoryItem {
  const row = requireRecord(value, "receiving inventory item");
  return {
    id: requireUuid(row.id, "inventory item ID"),
    itemName: requireString(row.item_name, "inventory item name"),
    unit: requireString(row.unit, "inventory unit"),
    secondaryUnit: optionalString(row.secondary_unit, "secondary unit"),
    quantityOnHand: requireNumber(row.quantity_on_hand, "quantity on hand"),
    quantityScale: requireNumber(row.quantity_scale, "quantity scale"),
    rotationPolicy: requireEnum(
      row.rotation_policy,
      ROTATION_POLICIES,
      "rotation policy",
    ),
    expiryRequired: requireBoolean(row.expiry_required, "expiry requirement"),
  };
}

function mapReportItem(value: unknown): ReceivingReportItem {
  const row = requireRecord(value, "receiving report item");
  return {
    id: requireUuid(row.id, "receiving report item ID"),
    inventoryItemId: requireUuid(row.inventory_item_id, "inventory item ID"),
    inventoryItemName: requireString(
      row.inventory_item_name,
      "inventory item name",
    ),
    unit: requireString(row.unit, "inventory unit"),
    secondaryUnit: optionalString(row.secondary_unit, "secondary unit"),
    expiryRequired: requireBoolean(row.expiry_required, "expiry requirement"),
    rotationPolicy: requireEnum(
      row.rotation_policy,
      ROTATION_POLICIES,
      "rotation policy",
    ),
    purchaseOrderItemId: optionalUuid(
      row.purchase_order_item_id,
      "purchase order item ID",
    ),
    quantityOrdered: optionalNumber(row.quantity_ordered, "quantity ordered"),
    quantityReceived: optionalNumber(
      row.quantity_received,
      "quantity received",
    ),
    quantityCancelled: optionalNumber(
      row.quantity_cancelled,
      "quantity cancelled",
    ),
    quantityRemaining: optionalNumber(
      row.quantity_remaining,
      "quantity remaining",
    ),
    secondaryQuantityOrdered: optionalNumber(
      row.secondary_quantity_ordered,
      "secondary quantity ordered",
    ),
    secondaryQuantityReceived: optionalNumber(
      row.secondary_quantity_received,
      "secondary quantity received",
    ),
    quantityDelivered: requireNumber(
      row.quantity_delivered,
      "quantity delivered",
    ),
    quantityAccepted: requireNumber(row.quantity_accepted, "quantity accepted"),
    quantityRejected: requireNumber(row.quantity_rejected, "quantity rejected"),
    secondaryQuantityDelivered: optionalNumber(
      row.secondary_quantity_delivered,
      "secondary delivered quantity",
    ),
    secondaryQuantityAccepted: optionalNumber(
      row.secondary_quantity_accepted,
      "secondary accepted quantity",
    ),
    secondaryQuantityRejected: optionalNumber(
      row.secondary_quantity_rejected,
      "secondary rejected quantity",
    ),
    rejectionReason: optionalString(row.rejection_reason, "rejection reason"),
    sourceLotCode: optionalString(row.source_lot_code, "source lot code"),
    manufacturedOn: optionalString(row.manufactured_on, "manufactured date"),
    useByDate: optionalString(row.use_by_date, "use-by date"),
    batchId: optionalUuid(row.batch_id, "batch ID"),
    batchCode: optionalString(row.batch_code, "batch code"),
    createdAt: requireTimestamp(row.created_at, "line creation date"),
    updatedAt: requireTimestamp(row.updated_at, "line update date"),
  };
}

function mapReportSummary(value: unknown): ReceivingReportSummary {
  const row = requireRecord(value, "receiving report summary");
  return {
    id: requireUuid(row.id, "receiving report ID"),
    rrNumber: requireString(row.rr_number, "receiving report number"),
    sourceType: requireEnum(row.source_type, SOURCE_TYPES, "receiving source"),
    sourceReference: optionalString(row.source_reference, "source reference"),
    purchaseOrderId: optionalUuid(row.purchase_order_id, "purchase order ID"),
    purchaseOrderNumber: optionalString(
      row.purchase_order_number,
      "purchase order number",
    ),
    supplierName: optionalString(row.supplier_name, "supplier name"),
    receivedAt: requireTimestamp(row.received_at, "received date"),
    status: requireEnum(row.status, REPORT_STATUSES, "receiving status"),
    postedAt: optionalTimestamp(row.posted_at, "posted date"),
    lineCount: requireNumber(row.line_count, "line count"),
    totalDelivered: requireNumber(row.total_delivered, "total delivered"),
    totalAccepted: requireNumber(row.total_accepted, "total accepted"),
    totalRejected: requireNumber(row.total_rejected, "total rejected"),
    updatedAt: requireTimestamp(row.updated_at, "report update date"),
  };
}

function mapReport(value: unknown): ReceivingReport {
  const row = requireRecord(value, "receiving report");
  return {
    id: requireUuid(row.id, "receiving report ID"),
    rrNumber: requireString(row.rr_number, "receiving report number"),
    sourceType: requireEnum(row.source_type, SOURCE_TYPES, "receiving source"),
    sourceReference: optionalString(row.source_reference, "source reference"),
    purchaseOrderId: optionalUuid(row.purchase_order_id, "purchase order ID"),
    purchaseOrderNumber: optionalString(
      row.purchase_order_number,
      "purchase order number",
    ),
    supplierId: optionalUuid(row.supplier_id, "supplier ID"),
    supplierName: optionalString(row.supplier_name, "supplier name"),
    receivedAt: requireTimestamp(row.received_at, "received date"),
    receivedBy: requireUuid(row.received_by, "receiving actor ID"),
    receivedByName: optionalString(row.received_by_name, "receiving actor name"),
    status: requireEnum(row.status, REPORT_STATUSES, "receiving status"),
    supplierDeliveryReference: optionalString(
      row.supplier_delivery_reference,
      "supplier delivery reference",
    ),
    postedAt: optionalTimestamp(row.posted_at, "posted date"),
    postedBy: optionalUuid(row.posted_by, "posting actor ID"),
    postedByName: optionalString(row.posted_by_name, "posting actor name"),
    createdAt: requireTimestamp(row.created_at, "report creation date"),
    updatedAt: requireTimestamp(row.updated_at, "report update date"),
    items: requireList(row.items, "receiving report items").map(mapReportItem),
  };
}

function getFriendlyReceivingError(message: string, fallback: string): string {
  const value = message.toLowerCase();

  if (
    value.includes("authentication required") ||
    value.includes("active manager")
  ) {
    return "Active Manager access is required for formal receiving.";
  }
  if (value.includes("already posted") || value.includes("only draft")) {
    return "This receiving report has already been posted and is read-only.";
  }
  if (
    value.includes("no longer eligible") ||
    value.includes("remaining quantity")
  ) {
    return "The purchase order changed or no longer has enough remaining quantity. Refresh before continuing.";
  }
  if (value.includes("rejection reason")) {
    return "Enter a rejection reason whenever any delivered quantity is rejected.";
  }
  if (value.includes("expiry-required") || value.includes("use-by")) {
    return "A valid use-by date is required for this inventory item.";
  }
  if (value.includes("manufactured date")) {
    return "The manufactured date cannot be after the use-by date.";
  }
  if (value.includes("secondary")) {
    return "Enter valid secondary quantities independently; no unit conversion is assumed.";
  }
  if (
    value.includes("different details") ||
    value.includes("already been used")
  ) {
    return "This request was already used. Refresh the receiving workspace and try again.";
  }
  if (value.includes("duplicate key") || value.includes("unique constraint")) {
    return "That inventory or purchase-order line is already included in this receiving report.";
  }
  if (value.includes("failed to fetch") || value.includes("network")) {
    return "The receiving service could not be reached. Check your connection and try again.";
  }

  return fallback;
}

export function getOrCreateReceivingDraftRequestId(
  fingerprint: string,
): string {
  try {
    const stored = sessionStorage.getItem(DRAFT_REQUEST_KEY);
    if (stored) {
      const value = JSON.parse(stored) as {
        requestId?: unknown;
        fingerprint?: unknown;
      };
      if (
        typeof value.requestId === "string" &&
        UUID_PATTERN.test(value.requestId) &&
        value.fingerprint === fingerprint
      ) {
        return value.requestId;
      }
    }
  } catch {
    // A fresh request ID remains safe when browser storage is unavailable.
  }

  const requestId = crypto.randomUUID();
  try {
    sessionStorage.setItem(
      DRAFT_REQUEST_KEY,
      JSON.stringify({ requestId, fingerprint }),
    );
  } catch {
    // Continue with the in-memory request ID.
  }
  return requestId;
}

export function clearReceivingDraftRequestId(requestId?: string): void {
  try {
    if (!requestId) {
      sessionStorage.removeItem(DRAFT_REQUEST_KEY);
      return;
    }
    const stored = sessionStorage.getItem(DRAFT_REQUEST_KEY);
    if (!stored) return;
    const value = JSON.parse(stored) as { requestId?: unknown };
    if (value.requestId === requestId) {
      sessionStorage.removeItem(DRAFT_REQUEST_KEY);
    }
  } catch {
    // Storage cleanup is best effort only.
  }
}

export async function getReceivingWorkspace(
  reportId: string | null = null,
): Promise<ReceivingWorkspace> {
  const { data, error } = await supabase.rpc(
    "get_manager_receiving_workspace",
    {
      p_receiving_report_id: reportId,
    },
  );
  if (error) {
    throw new Error(
      getFriendlyReceivingError(
        error.message,
        "Unable to load the receiving workspace. Try again.",
      ),
    );
  }

  const row = requireRecord(data, "receiving workspace");
  return {
    reports: requireList(row.reports, "receiving report list").map(
      mapReportSummary,
    ),
    selectedReport:
      row.selected_report === null || row.selected_report === undefined
        ? null
        : mapReport(row.selected_report),
    inventoryItems: requireList(
      row.inventory_items,
      "receiving inventory list",
    ).map(mapInventoryItem),
  };
}

export async function getReceivingDocuments(
  filters: ReceivingDocumentFilters,
  offset = 0,
  pageSize = 20,
): Promise<ReceivingDocumentPage> {
  const limit = Math.max(1, Math.min(100, Math.trunc(pageSize)));
  const { data, error } = await supabase.rpc(
    "get_manager_receiving_documents",
    {
      p_search: filters.search?.trim() || null,
      p_status: filters.status || null,
      p_source_type: filters.sourceType || null,
      p_from_date: filters.fromDate || null,
      p_to_date: filters.toDate || null,
      p_offset: Math.max(0, Math.trunc(offset)),
      p_limit: limit,
    },
  );
  if (error)
    throw new Error(
      getFriendlyReceivingError(
        error.message,
        "Unable to load receiving documents. Try again.",
      ),
    );
  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid receiving document list.");
  }
  const rows = data.slice(0, limit).map(mapReportSummary);
  if (rows.length) {
    const classificationResult = await supabase.rpc("get_receiving_policy_classes", {
      p_report_ids: rows.map((row) => row.id),
    });
    if (classificationResult.error) {
      if (import.meta.env.DEV) console.error("Receiving classification read failed", { code: classificationResult.error.code, message: classificationResult.error.message });
      if (classificationResult.error.code === "PGRST202") {
        throw new Error(
          "Receiving documents are temporarily unavailable. Ask an administrator to check the Receiving service, then retry.",
        );
      }
      throw new Error(getFriendlyReceivingError(classificationResult.error.message,
        "Unable to verify Receiving documents. Try again; the list cannot be shown until classification succeeds."));
    }
    const requestedIds = new Set(rows.map((row) => row.id));
    const classes = new Map<string, ReceivingPolicyEvidence["classification"]>();
    for (const value of requireList(
      classificationResult.data,
      "receiving classifications",
    )) {
      const entry = requireRecord(value, "receiving classification");
      const id = requireUuid(entry.id, "receiving ID");
      if (!requestedIds.has(id) || classes.has(id)) {
        throw new Error("The server returned inconsistent receiving classifications.");
      }
      classes.set(
        id,
        requireEnum(
          entry.classification,
          RECEIVING_POLICY_CLASSES,
          "receiving classification",
        ),
      );
    }
    for (const row of rows) {
      const policyClass = classes.get(row.id);
      if (!policyClass) {
        throw new Error(
          "The server did not classify every receiving document. The list cannot be shown safely.",
        );
      }
      row.policyClass = policyClass;
    }
  }
  return {
    rows,
    hasMore: data.length > limit,
  };
}

export async function updateReceivingDraft(
  input: ReceivingDraftHeaderInput & { reportId: string },
): Promise<void> {
  const { error } = await supabase.rpc("update_receiving_report_draft", {
    p_receiving_report_id: input.reportId,
    p_source_type: input.sourceType,
    p_source_reference: input.sourceReference || null,
    p_purchase_order_id: input.purchaseOrderId,
    p_received_at: input.receivedAt,
    p_supplier_delivery_reference: null,
  });
  if (error) {
    throw new Error(
      getFriendlyReceivingError(
        error.message,
        "Unable to save the receiving draft. Review the details and try again.",
      ),
    );
  }
}

export async function saveReceivingLine(
  input: ReceivingDraftLineInput,
): Promise<void> {
  const { error } = await supabase.rpc("save_receiving_report_item", {
    p_receiving_report_id: input.reportId,
    p_receiving_report_item_id: input.itemId,
    p_inventory_item_id: input.inventoryItemId,
    p_purchase_order_item_id: input.purchaseOrderItemId,
    p_quantity_delivered: input.quantityDelivered,
    p_quantity_accepted: input.quantityAccepted,
    p_secondary_quantity_delivered: input.secondaryQuantityDelivered,
    p_secondary_quantity_accepted: input.secondaryQuantityAccepted,
    p_rejection_reason: input.rejectionReason || null,
    p_source_lot_code: input.sourceLotCode || null,
    p_manufactured_on: input.manufacturedOn,
    p_use_by_date: input.useByDate,
  });
  if (error) {
    throw new Error(
      getFriendlyReceivingError(
        error.message,
        "Unable to save the receiving line. Review the quantities and try again.",
      ),
    );
  }
}

export async function removeReceivingLine(
  reportId: string,
  itemId: string,
): Promise<void> {
  const { error } = await supabase.rpc("remove_receiving_report_item", {
    p_receiving_report_id: reportId,
    p_receiving_report_item_id: itemId,
  });
  if (error) {
    throw new Error(
      getFriendlyReceivingError(
        error.message,
        "Unable to remove the receiving line. Refresh and try again.",
      ),
    );
  }
}

export async function deleteEmptyReceivingDraft(
  reportId: string,
): Promise<void> {
  const { error } = await supabase.rpc("delete_empty_receiving_report_draft", {
    p_receiving_report_id: reportId,
  });
  if (error) {
    throw new Error(
      getFriendlyReceivingError(
        error.message,
        "Only an empty, unposted receiving draft can be deleted.",
      ),
    );
  }
}

export async function postReceivingReport(
  reportId: string,
): Promise<ReceivingPostResult> {
  const { data, error } = await supabase.rpc("post_receiving_report", {
    p_receiving_report_id: reportId,
  });
  if (error) {
    const message = getFriendlyReceivingError(
      error.message,
      "Unable to post the receiving report. Refresh its details and try again.",
    );
    if (/^[A-Z0-9]{5}$/i.test(error.code ?? "")) {
      throw new ReceivingPostRejectedError(
        message,
        /already posted|only draft/i.test(error.message),
      );
    }
    throw new Error(message);
  }

  const row = requireRecord(data, "receiving posting result");
  return {
    receivingReportId: requireUuid(
      row.receiving_report_id,
      "receiving report ID",
    ),
    rrNumber: requireString(row.rr_number, "receiving report number"),
    sourceType: requireEnum(row.source_type, SOURCE_TYPES, "receiving source"),
    status: "posted",
    lineCount: requireNumber(row.line_count, "line count"),
    batchCount: requireNumber(row.batch_count, "batch count"),
    transactionCount: requireNumber(row.transaction_count, "transaction count"),
    totalAccepted: requireNumber(row.total_accepted, "accepted total"),
    postedAt: requireTimestamp(row.posted_at, "posted date"),
    postedBy: requireUuid(row.posted_by, "posting actor ID"),
  };
}
