import { supabase } from "@/lib/supabase";

export type InventoryStockStatus = "healthy" | "reorder-soon" | "critical";

export type InventoryTransactionType =
  "receiving" | "issuance" | "restock" | "waste" | "adjustment";

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
  transactionType: "receiving" | "adjustment";
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface ReceiveInventoryStockInput {
  inventoryItemId: string;
  quantity: number;
  reason?: string;
}

export interface AdjustInventoryStockInput {
  inventoryItemId: string;
  quantityChange: number;
  reason: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRANSACTION_TYPES = new Set<InventoryTransactionType>([
  "receiving",
  "issuance",
  "restock",
  "waste",
  "adjustment",
]);

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
  expectedType: "receiving" | "adjustment",
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
  };
}

function validateInventoryItemId(inventoryItemId: string): string {
  const normalizedId = inventoryItemId.trim();

  if (!UUID_PATTERN.test(normalizedId)) {
    throw new Error("A valid inventory item must be selected.");
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
    throw new Error(`Unable to load manager inventory: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid manager inventory list.");
  }

  return data.map(mapInventoryItem);
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
    throw new Error(`Unable to load inventory transactions: ${error.message}`);
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
}: ReceiveInventoryStockInput): Promise<InventoryStockChangeResult> {
  const normalizedId = validateInventoryItemId(inventoryItemId);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity received must be greater than zero.");
  }

  const normalizedReason = normalizeReason(reason, false);
  const { data, error } = await supabase.rpc("receive_inventory_stock", {
    p_inventory_item_id: normalizedId,
    p_quantity: quantity,
    p_reason: normalizedReason,
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
}: AdjustInventoryStockInput): Promise<InventoryStockChangeResult> {
  const normalizedId = validateInventoryItemId(inventoryItemId);

  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  const normalizedReason = normalizeReason(reason, true);
  const { data, error } = await supabase.rpc("adjust_inventory_stock", {
    p_inventory_item_id: normalizedId,
    p_quantity_change: quantityChange,
    p_reason: normalizedReason,
  });

  if (error) {
    throw new Error(`Unable to adjust inventory stock: ${error.message}`);
  }

  return mapStockChangeResult(data, "adjustment");
}
