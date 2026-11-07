import type { ManagerInventoryStock } from "../inventory/inventoryApi";
import { stockAlerts } from "../inventory/inventoryOverview.ts";

export function countLowUsableStock(rows: ManagerInventoryStock[]): number {
  if (!Array.isArray(rows)) throw new Error("Invalid stock summary");
  let count = 0;
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      typeof row.isActive !== "boolean" ||
      ![row.physicalQuantity, row.usableQuantity, row.reorderLevel].every(
        (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
      )
    ) {
      throw new Error("Invalid stock summary");
    }
    const alerts = stockAlerts(row);
    if (alerts.includes("usable-out") || alerts.includes("low-usable")) count++;
  }
  return count;
}
