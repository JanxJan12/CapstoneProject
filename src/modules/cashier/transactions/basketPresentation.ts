import type { Order, OrderItem } from "../types";

/** Prefer the historical line snapshot. A missing snapshot can use only recorded unit price and quantity. */
export function recordedBasketLine(item: OrderItem): number | undefined {
  if (item.lineTotal !== undefined) {
    return Number.isFinite(item.lineTotal) && item.lineTotal >= 0 ? item.lineTotal : undefined;
  }
  const calculated = item.unitPrice * item.quantity;
  return Number.isFinite(calculated) && calculated >= 0 && Number.isInteger(item.quantity) && item.quantity > 0
    ? Math.round(calculated * 100) / 100 : undefined;
}

export function recordedBasketChoices(item: OrderItem): string[] {
  const choices = [
    ...(item.mealOption ? [item.mealOption === "with_rice" ? "With Rice" : "Without Rice"] : []),
    ...(item.modifiers ?? []).map((modifier) => modifier.name.trim()).filter(Boolean),
  ];
  return [...new Map(choices.map((choice) => [choice.toLowerCase(), choice])).values()];
}

export function basketSubtotalDisagrees(order: Order): boolean {
  if (!order.items.length || !Number.isFinite(order.subtotal)) return false;
  const lines = order.items.map(recordedBasketLine);
  if (lines.some((amount) => amount === undefined)) return false;
  return lines.reduce<number>((sum, amount) => sum + Math.round(amount! * 100), 0) !== Math.round(order.subtotal * 100);
}
