import { supabase } from "@/lib/supabase";

export type InventoryAuditResult = "matched" | "mismatch" | "incomplete";
export type InventoryAuditFindingCode =
  | "matched"
  | "book_ledger_difference"
  | "no_history"
  | "ambiguous_order"
  | "invalid_arithmetic"
  | "sequence_gap";

export interface InventoryAuditRun {
  id: string;
  performedBy: string;
  startedAt: string;
  completedAt: string;
  status: "completed";
  movementRowsExamined: number;
  totalItems: number;
  matchedCount: number;
  mismatchCount: number;
  incompleteCount: number;
}

export interface InventoryAuditFinding {
  id: string;
  auditId: string;
  inventoryItemId: string;
  latestMovementId: string | null;
  itemName: string;
  recordedUnit: string;
  bookQuantity: number;
  ledgerQuantity: number | null;
  result: InventoryAuditResult;
  findingCode: InventoryAuditFindingCode;
  movementCount: number;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid inventory audit response.");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Invalid inventory audit response.");
  }
  return value;
}

function number(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (value === null || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Invalid inventory audit response.");
  }
  return parsed;
}

function mapRun(value: unknown): InventoryAuditRun {
  const row = record(value);
  if (row.status !== "completed") throw new Error("Invalid audit status.");
  return {
    id: string(row.id),
    performedBy: string(row.performed_by),
    startedAt: string(row.started_at),
    completedAt: string(row.completed_at),
    status: "completed",
    movementRowsExamined: number(row.movement_rows_examined),
    totalItems: number(row.total_items),
    matchedCount: number(row.matched_count),
    mismatchCount: number(row.mismatch_count),
    incompleteCount: number(row.incomplete_count),
  };
}

const results: InventoryAuditResult[] = ["matched", "mismatch", "incomplete"];
const codes: InventoryAuditFindingCode[] = [
  "matched",
  "book_ledger_difference",
  "no_history",
  "ambiguous_order",
  "invalid_arithmetic",
  "sequence_gap",
];

function mapFinding(value: unknown): InventoryAuditFinding {
  const row = record(value);
  if (
    !results.includes(row.result as InventoryAuditResult) ||
    !codes.includes(row.finding_code as InventoryAuditFindingCode)
  ) {
    throw new Error("Invalid inventory audit finding.");
  }
  return {
    id: string(row.id),
    auditId: string(row.audit_id),
    inventoryItemId: string(row.inventory_item_id),
    latestMovementId:
      row.latest_movement_id === null ? null : string(row.latest_movement_id),
    itemName: string(row.item_name),
    recordedUnit: string(row.recorded_unit),
    bookQuantity: number(row.book_quantity),
    ledgerQuantity:
      row.ledger_quantity === null ? null : number(row.ledger_quantity),
    result: row.result as InventoryAuditResult,
    findingCode: row.finding_code as InventoryAuditFindingCode,
    movementCount: number(row.movement_count),
  };
}

export async function getInventoryAudits(before?: {
  completedAt: string;
  id: string;
}): Promise<InventoryAuditRun[]> {
  const { data, error } = await supabase.rpc("get_manager_inventory_audits", {
    p_limit: 25,
    p_before_completed_at: before?.completedAt ?? null,
    p_before_id: before?.id ?? null,
  });
  if (error) throw new Error("Unable to load audit history. Try again.");
  if (!Array.isArray(data))
    throw new Error("Invalid inventory audit response.");
  return data.map(mapRun);
}

export async function getInventoryAuditItems(
  auditId: string,
): Promise<InventoryAuditFinding[]> {
  const { data, error } = await supabase.rpc(
    "get_manager_inventory_audit_items",
    { p_audit_id: auditId },
  );
  if (error) throw new Error("Unable to load audit results. Try again.");
  if (!Array.isArray(data))
    throw new Error("Invalid inventory audit response.");
  return data.map(mapFinding);
}

export async function runInventoryAudit(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc(
    "run_manager_inventory_ledger_audit",
    { p_request_id: requestId },
  );
  if (error)
    throw new Error(
      "Audit could not be confirmed. Check history, then retry the same request.",
    );
  return string(data);
}
