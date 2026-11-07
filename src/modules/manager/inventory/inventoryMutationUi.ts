import type { ManagerInventoryBatch } from "./inventoryApi";

export const inventoryQuantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 6,
});

export function quantityStep(quantityScale: number): number {
  return 10 ** -quantityScale;
}

export function quantityMatchesScale(
  quantity: number,
  quantityScale: number,
): boolean {
  return quantity === Number(quantity.toFixed(quantityScale));
}

export function isValidInventoryQuantity(
  rawQuantity: string,
  quantityScale: number,
): boolean {
  const parsedQuantity = Number(rawQuantity);

  return (
    rawQuantity.trim() !== "" &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    quantityMatchesScale(parsedQuantity, quantityScale)
  );
}

export function formatInventoryQuantity(value: number, unit: string): string {
  return `${inventoryQuantityFormatter.format(value)} ${unit}`;
}

export function getBatchStatus(
  batch: ManagerInventoryBatch,
  today = manilaToday(),
): "Current" | "Expired" {
  return batch.useByDate !== null && batch.useByDate < today
    ? "Expired"
    : "Current";
}

export function manilaToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
