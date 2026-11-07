import type { RequestProposalItem } from "./inventoryRequestApi";

// Validate the complete RPC projection once, before any Manager view can use it.
export function validRequestProposal(rows: unknown): rows is RequestProposalItem[] {
  if (!Array.isArray(rows)) return false;
  const ids = new Set<string>();
  return rows.every((value: unknown) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id || ids.has(row.id)) return false;
    ids.add(row.id);
    const scale = row.quantity_scale;
    return typeof row.name === "string" && Boolean(row.name) &&
      typeof row.unit === "string" && Boolean(row.unit) &&
      typeof row.expiry_verified === "boolean" &&
      typeof scale === "number" && Number.isInteger(scale) && scale >= 0 && scale <= 6 &&
      [row.reorder_level, row.usable_now, row.valid_at_need, row.outstanding].every(
        (amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0,
      );
  });
}
