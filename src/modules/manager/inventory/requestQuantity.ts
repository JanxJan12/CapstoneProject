import type { RequestProposalItem } from "./inventoryRequestApi";

// Proposal values are PostgreSQL numeric quantities with the item's base-unit scale.
// Subtract their integer minor units so binary floating-point tails never enter a draft.
export function suggestedRequestQuantity(row: RequestProposalItem): number {
  const factor = 10 ** row.quantity_scale;
  const values = [row.reorder_level, row.valid_at_need, row.outstanding];
  if (values.some((value) => !Number.isFinite(value) ||
    Math.abs(value * factor - Math.round(value * factor)) > 1e-6)) {
    // An unexpected proposal precision must remain visible for review.
    return Math.max(0, row.reorder_level - row.valid_at_need - row.outstanding);
  }
  return Math.max(0, Math.round(row.reorder_level * factor) -
    Math.round(row.valid_at_need * factor) - Math.round(row.outstanding * factor)) / factor;
}

export function formatRequestQuantity(quantity: number, scale = 3): string {
  if (!Number.isFinite(quantity)) return String(quantity);
  const rounded = Number(quantity.toFixed(scale));
  // Do not hide an invalid manually entered quantity by rounding its display.
  return Math.abs(quantity - rounded) <= 1e-10 ? String(rounded) : String(quantity);
}

// Normalize display only after editing finishes. Preserve the entered precision.
export function normalizeRequestQuantityInput(raw: string): string {
  const trimmed = raw.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return raw;
  const [whole, fraction] = trimmed.split(".");
  const normalizedWhole = (whole || "0").replace(/^0+(?=\d)/, "");
  return fraction === undefined ? normalizedWhole : `${normalizedWhole}.${fraction}`;
}
