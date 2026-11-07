import { supabase } from "@/lib/supabase";

export type InventoryStockStatus = "healthy" | "reorder-soon" | "critical";

export type InventoryTransactionType =
  | "receiving"
  | "issuance"
  | "restock"
  | "waste"
  | "adjustment"
  | "opening_balance";

export interface ManagerInventoryStock {
  id: string;
  itemName: string;
  category: string | null;
  unit: string;
  physicalQuantity: number;
  usableQuantity: number;
  expiredQuantity: number;
  reorderLevel: number;
  isActive: boolean;
  batchConsumptionEnabled: boolean;
  expiryRequired: boolean;
  rotationPolicy: "fifo" | "fefo";
  nearestUseBy: string | null;
  updatedAt: string;
}

export interface ManagerStockBatch extends ManagerInventoryBatch {
  status: "current" | "expired";
}

export interface ManagerStockDetail {
  stock: ManagerInventoryStock;
  batches: ManagerStockBatch[];
}

export interface ManagerStockMovement {
  id: string;
  inventoryItemId: string;
  itemName: string;
  unit: string;
  transactionType: InventoryTransactionType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  referenceLabel: string | null;
  batches: Array<{ batchCode: string; quantity: number }>;
  performedByName: string;
  createdAt: string;
}

export interface StockMovementFilters {
  itemId?: string;
  type?: InventoryTransactionType | "";
  fromDate?: string;
  toDate?: string;
}

export interface StockMovementPage {
  rows: ManagerStockMovement[];
  nextCursor: { createdAt: string; id: string } | null;
}

export interface ManagerInventoryItem {
  id: string;
  itemName: string;
  category: string | null;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  isActive: boolean;
  stockStatus: InventoryStockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerInventoryTransaction {
  id: string;
  inventoryItemId: string;
  itemName: string;
  unit: string;
  transactionType: InventoryTransactionType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  orderId: string | null;
  orderNumber: string | null;
  performedBy: string | null;
  performedByName: string;
  createdAt: string;
}

export interface InventoryStockChangeResult {
  transactionId: string;
  inventoryItemId: string;
  itemName: string;
  unit: string;
  transactionType: "receiving" | "adjustment" | "waste";
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  performedBy: string;
  createdAt: string;
  inventoryBatchId?: string;
  batchQuantityBefore?: number;
  batchQuantityAfter?: number;
}

export interface ManagerInventoryBatch {
  id: string;
  batchCode: string;
  receivedAt: string;
  useByDate: string | null;
  quantityOnHand: number;
}

export interface ManagerInventoryBatchContext {
  inventoryItemId: string;
  batchConsumptionEnabled: boolean;
  quantityScale: number;
  batches: ManagerInventoryBatch[];
}

export interface ReceiveInventoryStockInput {
  inventoryItemId: string;
  quantity: number;
  reason?: string;
  requestId: string;
}

export interface AdjustInventoryStockInput {
  inventoryItemId: string;
  quantityChange: number;
  reason: string;
  requestId: string;
}

export interface RecordInventoryWasteInput {
  inventoryItemId: string;
  quantity: number;
  reason: string;
  requestId: string;
}

export interface BatchInventoryMutationInput {
  inventoryItemId: string;
  inventoryBatchId: string;
  expectedBatchQuantity: number;
  reason: string;
  notes?: string;
  requestId: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRANSACTION_TYPES = new Set<InventoryTransactionType>([
  "receiving",
  "issuance",
  "restock",
  "waste",
  "adjustment",
  "opening_balance",
]);

export type InventoryMutationKind = "receiving" | "adjustment" | "waste";

interface StoredInventoryMutationRequest {
  requestId: string;
  fingerprint: string;
}

function getInventoryMutationStorageKey(kind: InventoryMutationKind): string {
  return `rrj_manager_inventory_${kind}_request_v1`;
}

export function getOrCreateInventoryMutationRequestId(
  kind: InventoryMutationKind,
  fingerprint: string,
): string {
  const storageKey = getInventoryMutationStorageKey(kind);

  try {
    const stored = sessionStorage.getItem(storageKey);

    if (stored) {
      const parsed = JSON.parse(
        stored,
      ) as Partial<StoredInventoryMutationRequest>;

      if (
        typeof parsed.requestId === "string" &&
        parsed.requestId.length > 0 &&
        parsed.fingerprint === fingerprint
      ) {
        return parsed.requestId;
      }
    }
  } catch {
    // Create a new request ID below.
  }

  const requestId = crypto.randomUUID();

  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        requestId,
        fingerprint,
      }),
    );
  } catch {
    // Current request can still proceed.
  }

  return requestId;
}

export function clearInventoryMutationRequestId(
  kind: InventoryMutationKind,
  requestId?: string,
): void {
  const storageKey = getInventoryMutationStorageKey(kind);

  if (!requestId) {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore browser storage errors.
    }

    return;
  }

  try {
    const stored = sessionStorage.getItem(storageKey);

    if (!stored) {
      return;
    }

    const parsed = JSON.parse(
      stored,
    ) as Partial<StoredInventoryMutationRequest>;

    if (parsed.requestId === requestId) {
      sessionStorage.removeItem(storageKey);
    }
  } catch {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore browser storage errors.
    }
  }
}

function requireRecord(
  value: unknown,
  recordName: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The server returned an invalid ${recordName}.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value.trim();
}

function optionalString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value.trim() || null;
}

function requireUuid(value: unknown, fieldName: string): string {
  const uuid = requireString(value, fieldName);

  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return uuid;
}

function optionalUuid(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return requireUuid(value, fieldName);
}

function requireNumber(value: unknown, fieldName: string): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requireNonNegativeNumber(value: unknown, fieldName: string): number {
  const number = requireNumber(value, fieldName);

  if (number < 0) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return number;
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return value;
}

function requireTimestamp(value: unknown, fieldName: string): string {
  const timestamp = requireString(value, fieldName);

  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`The server returned an invalid ${fieldName}.`);
  }

  return timestamp;
}

function requireStockStatus(value: unknown): InventoryStockStatus {
  if (value !== "healthy" && value !== "reorder-soon" && value !== "critical") {
    throw new Error("The server returned an unsupported stock status.");
  }

  return value;
}

function requireTransactionType(value: unknown): InventoryTransactionType {
  if (
    typeof value !== "string" ||
    !TRANSACTION_TYPES.has(value as InventoryTransactionType)
  ) {
    throw new Error(
      "The server returned an unsupported inventory transaction type.",
    );
  }

  return value as InventoryTransactionType;
}

function mapInventoryItem(value: unknown): ManagerInventoryItem {
  const row = requireRecord(value, "inventory item");

  return {
    id: requireUuid(row.id, "inventory item ID"),
    itemName: requireString(row.item_name, "inventory item name"),
    category: optionalString(row.inventory_category, "inventory category"),
    unit: requireString(row.unit, "inventory unit"),
    quantityOnHand: requireNonNegativeNumber(
      row.quantity_on_hand,
      "quantity on hand",
    ),
    reorderLevel: requireNonNegativeNumber(row.reorder_level, "reorder level"),
    isActive: requireBoolean(row.is_active, "inventory active state"),
    stockStatus: requireStockStatus(row.stock_status),
    createdAt: requireTimestamp(row.created_at, "inventory creation date"),
    updatedAt: requireTimestamp(row.updated_at, "inventory update date"),
  };
}

function mapInventoryTransaction(value: unknown): ManagerInventoryTransaction {
  const row = requireRecord(value, "inventory transaction");

  return {
    id: requireUuid(row.id, "inventory transaction ID"),
    inventoryItemId: requireUuid(row.inventory_item_id, "inventory item ID"),
    itemName: requireString(row.item_name, "inventory item name"),
    unit: requireString(row.unit, "inventory unit"),
    transactionType: requireTransactionType(row.transaction_type),
    quantityChange: requireNumber(row.quantity_change, "quantity change"),
    quantityBefore: requireNonNegativeNumber(
      row.quantity_before,
      "quantity before",
    ),
    quantityAfter: requireNonNegativeNumber(
      row.quantity_after,
      "quantity after",
    ),
    reason: optionalString(row.reason, "inventory transaction reason"),
    orderId: optionalUuid(row.order_id, "inventory order ID"),
    orderNumber: optionalString(row.order_number, "inventory order number"),
    performedBy: optionalUuid(row.performed_by, "inventory performer ID"),
    performedByName: requireString(
      row.performed_by_name,
      "inventory performer name",
    ),
    createdAt: requireTimestamp(row.created_at, "inventory transaction date"),
  };
}

function mapStockChangeResult(
  value: unknown,
  expectedType: "receiving" | "adjustment" | "waste",
): InventoryStockChangeResult {
  const row = requireRecord(value, "inventory stock change result");
  const transactionType = requireTransactionType(row.transaction_type);

  if (transactionType !== expectedType) {
    throw new Error(
      "The server returned an unexpected inventory transaction type.",
    );
  }

  return {
    transactionId: requireUuid(row.transaction_id, "inventory transaction ID"),
    inventoryItemId: requireUuid(row.inventory_item_id, "inventory item ID"),
    itemName: requireString(row.item_name, "inventory item name"),
    unit: requireString(row.unit, "inventory unit"),
    transactionType,
    quantityChange: requireNumber(row.quantity_change, "quantity change"),
    quantityBefore: requireNonNegativeNumber(
      row.quantity_before,
      "quantity before",
    ),
    quantityAfter: requireNonNegativeNumber(
      row.quantity_after,
      "quantity after",
    ),
    reason: requireString(row.reason, "inventory transaction reason"),
    performedBy: requireUuid(row.performed_by, "inventory performer ID"),
    createdAt: requireTimestamp(row.created_at, "inventory transaction date"),
    ...(row.inventory_batch_id != null
      ? {
          inventoryBatchId: requireUuid(
            row.inventory_batch_id,
            "inventory batch ID",
          ),
          batchQuantityBefore: requireNonNegativeNumber(
            row.batch_quantity_before,
            "batch quantity before",
          ),
          batchQuantityAfter: requireNonNegativeNumber(
            row.batch_quantity_after,
            "batch quantity after",
          ),
        }
      : {}),
  };
}

export async function getManagerInventoryBatchContext(): Promise<
  ManagerInventoryBatchContext[]
> {
  const { data, error } = await supabase.rpc(
    "get_manager_inventory_batch_context",
  );
  if (error) {
    throw new Error(
      "Unable to load physical batches. Check your connection and try again.",
    );
  }
  if (!Array.isArray(data)) {
    throw new Error("The server returned invalid physical batch data.");
  }
  return data.map((value) => {
    const row = requireRecord(value, "inventory batch context");
    if (!Array.isArray(row.batches)) {
      throw new Error("The server returned an invalid physical batch list.");
    }
    return {
      inventoryItemId: requireUuid(row.inventory_item_id, "inventory item ID"),
      batchConsumptionEnabled: requireBoolean(
        row.batch_consumption_enabled,
        "batch policy",
      ),
      quantityScale: requireNonNegativeNumber(
        row.quantity_scale,
        "quantity scale",
      ),
      batches: row.batches.map((batchValue) => {
        const batch = requireRecord(batchValue, "inventory batch");
        return {
          id: requireUuid(batch.id, "inventory batch ID"),
          batchCode: requireString(batch.batch_code, "batch code"),
          receivedAt: requireTimestamp(batch.received_at, "batch receipt date"),
          useByDate: optionalString(batch.use_by_date, "batch use-by date"),
          quantityOnHand: requireNonNegativeNumber(
            batch.quantity_on_hand,
            "batch quantity on hand",
          ),
        };
      }),
    };
  });
}

export async function recordBatchInventoryWaste({
  inventoryItemId,
  inventoryBatchId,
  expectedBatchQuantity,
  reason,
  notes,
  requestId,
  quantity,
}: BatchInventoryMutationInput & {
  quantity: number;
}): Promise<InventoryStockChangeResult> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Waste quantity must be greater than zero.");
  }
  const { data, error } = await supabase.rpc("record_batch_inventory_waste", {
    p_inventory_item_id: validateInventoryItemId(inventoryItemId),
    p_inventory_batch_id: validateInventoryItemId(inventoryBatchId),
    p_quantity: quantity,
    p_expected_batch_quantity: expectedBatchQuantity,
    p_reason: normalizeReason(reason, true),
    p_notes: normalizeReason(notes, false),
    p_request_id: validateInventoryRequestId(requestId),
  });
  if (error) {
    throw new Error(normalizeInventoryMutationError(error.message, "waste"));
  }
  return mapStockChangeResult(data, "waste");
}

export async function adjustInventoryBatchStock({
  inventoryItemId,
  inventoryBatchId,
  expectedBatchQuantity,
  reason,
  notes,
  requestId,
  quantityChange,
}: BatchInventoryMutationInput & {
  quantityChange: number;
}): Promise<InventoryStockChangeResult> {
  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    throw new Error("Adjustment quantity must not be zero.");
  }
  const { data, error } = await supabase.rpc("adjust_inventory_batch_stock", {
    p_inventory_item_id: validateInventoryItemId(inventoryItemId),
    p_inventory_batch_id: validateInventoryItemId(inventoryBatchId),
    p_quantity_change: quantityChange,
    p_expected_batch_quantity: expectedBatchQuantity,
    p_reason: normalizeReason(reason, true),
    p_notes: normalizeReason(notes, false),
    p_request_id: validateInventoryRequestId(requestId),
  });
  if (error) {
    throw new Error(
      normalizeInventoryMutationError(error.message, "adjustment"),
    );
  }
  return mapStockChangeResult(data, "adjustment");
}

function validateInventoryItemId(inventoryItemId: string): string {
  const normalizedId = inventoryItemId.trim();

  if (!UUID_PATTERN.test(normalizedId)) {
    throw new Error("A valid inventory item must be selected.");
  }

  return normalizedId;
}

function validateInventoryRequestId(requestId: string): string {
  const normalizedId = requestId.trim();

  if (!UUID_PATTERN.test(normalizedId)) {
    throw new Error("A valid inventory request ID is required.");
  }

  return normalizedId;
}

function normalizeReason(
  reason: string | undefined,
  required: boolean,
): string | null {
  const normalizedReason = reason?.trim() || null;

  if (required && !normalizedReason) {
    throw new Error("An inventory adjustment reason is required.");
  }

  if (normalizedReason && normalizedReason.length > 300) {
    throw new Error("Inventory reason must not exceed 300 characters.");
  }

  return normalizedReason;
}

export async function getManagerInventory(): Promise<ManagerInventoryItem[]> {
  const { data, error } = await supabase.rpc("get_manager_inventory");

  if (error) {
    throw new Error(
      "Unable to load manager inventory. Check your connection and try again.",
    );
  }

  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid manager inventory list.");
  }

  return data.map(mapInventoryItem);
}

function mapStock(value: unknown): ManagerInventoryStock {
  const row = requireRecord(value, "stock summary");
  const rotationPolicy = requireString(row.rotation_policy, "rotation policy");
  if (rotationPolicy !== "fifo" && rotationPolicy !== "fefo") {
    throw new Error("The server returned an unsupported rotation policy.");
  }
  return {
    id: requireUuid(row.id, "inventory item ID"),
    itemName: requireString(row.item_name, "inventory item name"),
    category: optionalString(row.inventory_category, "inventory category"),
    unit: requireString(row.unit, "inventory unit"),
    physicalQuantity: requireNonNegativeNumber(
      row.physical_quantity,
      "physical stock",
    ),
    usableQuantity: requireNonNegativeNumber(
      row.usable_quantity,
      "usable stock",
    ),
    expiredQuantity: requireNonNegativeNumber(
      row.expired_quantity,
      "expired stock",
    ),
    reorderLevel: requireNonNegativeNumber(row.reorder_level, "reorder level"),
    isActive: requireBoolean(row.is_active, "inventory active state"),
    batchConsumptionEnabled: requireBoolean(
      row.batch_consumption_enabled,
      "batch policy",
    ),
    expiryRequired: requireBoolean(row.expiry_required, "expiry policy"),
    rotationPolicy,
    nearestUseBy: optionalString(row.nearest_use_by, "nearest use-by date"),
    updatedAt: requireTimestamp(row.updated_at, "inventory update date"),
  };
}

export async function getManagerStockSummary(): Promise<
  ManagerInventoryStock[]
> {
  const { data, error } = await supabase.rpc(
    "get_manager_inventory_stock_summary",
  );
  if (error)
    throw new Error(
      "Unable to load stock levels. Check your connection and try again.",
    );
  if (!Array.isArray(data))
    throw new Error("The server returned an invalid stock summary.");
  return data.map(mapStock);
}

export async function getManagerStockDetail(
  itemId: string,
): Promise<ManagerStockDetail> {
  const { data, error } = await supabase.rpc(
    "get_manager_inventory_item_detail",
    {
      p_item_id: validateInventoryItemId(itemId),
    },
  );
  if (error)
    throw new Error(
      "Unable to load item stock. Check your connection and try again.",
    );
  const row = requireRecord(data, "item stock detail");
  if (!Array.isArray(row.batches))
    throw new Error("The server returned an invalid batch list.");
  return {
    stock: mapStock(row.stock),
    batches: row.batches.map((value): ManagerStockBatch => {
      const batch = requireRecord(value, "physical batch");
      const status = requireString(batch.status, "batch status");
      if (status !== "current" && status !== "expired") {
        throw new Error("The server returned an invalid batch status.");
      }
      return {
        id: requireUuid(batch.id, "inventory batch ID"),
        batchCode: requireString(batch.batch_code, "batch code"),
        quantityOnHand: requireNonNegativeNumber(
          batch.quantity_on_hand,
          "batch stock",
        ),
        receivedAt: requireTimestamp(batch.received_at, "batch receipt date"),
        useByDate: optionalString(batch.use_by_date, "batch use-by date"),
        status,
      };
    }),
  };
}

function mapStockMovement(value: unknown): ManagerStockMovement {
  const row = requireRecord(value, "stock movement");
  if (!Array.isArray(row.batches))
    throw new Error("The server returned invalid movement batches.");
  return {
    id: requireUuid(row.id, "movement ID"),
    inventoryItemId: requireUuid(row.inventory_item_id, "inventory item ID"),
    itemName: requireString(row.item_name, "inventory item name"),
    unit: requireString(row.unit, "inventory unit"),
    transactionType: requireTransactionType(row.transaction_type),
    quantityChange: requireNumber(row.quantity_change, "quantity change"),
    quantityBefore: requireNonNegativeNumber(
      row.quantity_before,
      "quantity before",
    ),
    quantityAfter: requireNonNegativeNumber(
      row.quantity_after,
      "quantity after",
    ),
    reason: optionalString(row.reason, "movement reason"),
    referenceLabel: optionalString(row.reference_label, "movement reference"),
    batches: row.batches.map((value) => {
      const batch = requireRecord(value, "movement batch");
      return {
        batchCode: requireString(batch.batch_code, "batch code"),
        quantity: requireNonNegativeNumber(batch.quantity, "batch allocation"),
      };
    }),
    performedByName: requireString(row.performed_by_name, "movement actor"),
    createdAt: requireTimestamp(row.created_at, "movement date"),
  };
}

export async function getManagerStockMovements(
  filters: StockMovementFilters = {},
  cursor: StockMovementPage["nextCursor"] = null,
  pageSize = 20,
): Promise<StockMovementPage> {
  const limit = Math.max(1, Math.min(100, Math.trunc(pageSize)));
  const { data, error } = await supabase.rpc(
    "get_manager_inventory_movements",
    {
      p_item_id: filters.itemId || null,
      p_type: filters.type || null,
      p_from_date: filters.fromDate || null,
      p_to_date: filters.toDate || null,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: limit,
    },
  );
  if (error)
    throw new Error(
      "Unable to load stock movements. Check your connection and try again.",
    );
  if (!Array.isArray(data))
    throw new Error("The server returned an invalid stock movement list.");
  const mapped = data.map(mapStockMovement);
  const rows = mapped.slice(0, limit);
  const last = rows[rows.length - 1];
  return {
    rows,
    nextCursor:
      mapped.length > limit && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
  };
}

export async function getManagerInventoryTransactions(
  limit = 100,
): Promise<ManagerInventoryTransaction[]> {
  if (!Number.isFinite(limit)) {
    throw new Error("Inventory transaction limit must be a valid number.");
  }

  const normalizedLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
  const { data, error } = await supabase.rpc(
    "get_manager_inventory_transactions",
    { p_limit: normalizedLimit },
  );

  if (error) {
    throw new Error(
      "Unable to load inventory history. Check your connection and try again.",
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "The server returned an invalid inventory transaction list.",
    );
  }

  return data.map(mapInventoryTransaction);
}

export async function receiveInventoryStock({
  inventoryItemId,
  quantity,
  reason,
  requestId,
}: ReceiveInventoryStockInput): Promise<InventoryStockChangeResult> {
  const normalizedId = validateInventoryItemId(inventoryItemId);

  const normalizedRequestId = validateInventoryRequestId(requestId);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity received must be greater than zero.");
  }

  const normalizedReason = normalizeReason(reason, false);

  const { data, error } = await supabase.rpc("receive_inventory_stock", {
    p_inventory_item_id: normalizedId,
    p_quantity: quantity,
    p_reason: normalizedReason,
    p_request_id: normalizedRequestId,
  });

  if (error) {
    throw new Error(`Unable to receive inventory stock: ${error.message}`);
  }

  return mapStockChangeResult(data, "receiving");
}

export async function adjustInventoryStock({
  inventoryItemId,
  quantityChange,
  reason,
  requestId,
}: AdjustInventoryStockInput): Promise<InventoryStockChangeResult> {
  const normalizedId = validateInventoryItemId(inventoryItemId);

  const normalizedRequestId = validateInventoryRequestId(requestId);

  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    throw new Error("Adjustment quantity must not be zero.");
  }

  const normalizedReason = normalizeReason(reason, true);

  const { data, error } = await supabase.rpc("adjust_inventory_stock", {
    p_inventory_item_id: normalizedId,
    p_quantity_change: quantityChange,
    p_reason: normalizedReason,
    p_request_id: normalizedRequestId,
  });

  if (error) {
    throw new Error(
      normalizeInventoryMutationError(error.message, "adjustment"),
    );
  }

  return mapStockChangeResult(data, "adjustment");
}

function normalizeInventoryMutationError(
  message: string,
  operation: "adjustment" | "waste",
): string {
  const normalizedMessage = message.toLowerCase();
  const operationLabel =
    operation === "waste" ? "waste/spoilage" : "adjustment";

  if (
    normalizedMessage.includes("authentication required") ||
    normalizedMessage.includes("active manager access required")
  ) {
    return `Active Manager access is required to record this ${operationLabel}.`;
  }

  if (
    normalizedMessage.includes("already used for a different stock mutation")
  ) {
    return "This request was already used for another stock change. Reset the form and try again.";
  }

  if (normalizedMessage.includes("inventory item not found")) {
    return "The selected inventory item no longer exists. Refresh inventory and try again.";
  }

  if (
    normalizedMessage.includes("inactive inventory items") ||
    normalizedMessage.includes("active batch-enabled inventory item")
  ) {
    return `This ${operationLabel} cannot be recorded for the selected inventory item.`;
  }

  if (normalizedMessage.includes("inventory batch not found")) {
    return "The selected physical batch no longer exists. Refresh inventory and choose an available batch.";
  }

  if (
    normalizedMessage.includes("does not belong to the selected inventory item")
  ) {
    return "The selected batch no longer belongs to this item. Refresh inventory and choose again.";
  }

  if (normalizedMessage.includes("batch stock changed")) {
    return "The selected batch balance changed. Inventory was refreshed; review the updated balance and try again.";
  }

  if (
    normalizedMessage.includes("exceeds current physical stock") ||
    normalizedMessage.includes("exceeds available stock") ||
    normalizedMessage.includes("quantity negative")
  ) {
    return "The requested decrease exceeds the current stock. Inventory was refreshed; review the updated balance.";
  }

  if (
    normalizedMessage.includes("quantity_scale") ||
    normalizedMessage.includes("decimal places")
  ) {
    return "The quantity does not match this item's allowed precision. Review the quantity and try again.";
  }

  if (
    normalizedMessage.includes("reason") ||
    normalizedMessage.includes("notes")
  ) {
    return "Review the reason and notes, then try again.";
  }

  return `Unable to record the inventory ${operationLabel}. Check your connection and try again.`;
}

export async function recordInventoryWaste({
  inventoryItemId,
  quantity,
  reason,
  requestId,
}: RecordInventoryWasteInput): Promise<InventoryStockChangeResult> {
  const normalizedId = validateInventoryItemId(inventoryItemId);
  const normalizedRequestId = validateInventoryRequestId(requestId);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Waste quantity must be greater than zero.");
  }

  const normalizedReason = normalizeReason(reason, false);

  if (!normalizedReason) {
    throw new Error("A waste/spoilage reason is required.");
  }

  const { data, error } = await supabase.rpc("record_inventory_waste", {
    p_inventory_item_id: normalizedId,
    p_quantity: quantity,
    p_reason: normalizedReason,
    p_request_id: normalizedRequestId,
  });

  if (error) {
    throw new Error(normalizeInventoryMutationError(error.message, "waste"));
  }

  return mapStockChangeResult(data, "waste");
}
