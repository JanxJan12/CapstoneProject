export interface CustomerRecordedAmounts {
  subtotal?: unknown;
  delivery_fee?: unknown;
  tax_amount?: unknown;
  grand_total?: unknown;
  fulfillment_type?: unknown;
}

/** Parse stored money without turning null, empty text, or NaN into a false zero. */
export function customerMoneyCents(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim()))) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) return null;
  return Math.round(number * 100);
}

export function customerRecordedBreakdown(order: CustomerRecordedAmounts): {
  totalCents: number | null;
  lines: { label: string; cents: number; subtract?: boolean }[] | null;
} {
  const totalCents = customerMoneyCents(order.grand_total);
  const subtotal = customerMoneyCents(order.subtotal);
  const fee = customerMoneyCents(order.delivery_fee);
  const tax = customerMoneyCents(order.tax_amount);
  if (totalCents === null || subtotal === null || fee === null || tax === null ||
      subtotal + fee + tax !== totalCents) return { totalCents, lines: null };
  const lines: { label: string; cents: number; subtract?: boolean }[] = [{ label: "Items subtotal", cents: subtotal }];
  if (order.fulfillment_type === "delivery" || fee !== 0) lines.push({ label: "Delivery fee", cents: fee });
  if (tax > 0) lines.push({ label: "Tax", cents: tax });
  return { totalCents, lines };
}
