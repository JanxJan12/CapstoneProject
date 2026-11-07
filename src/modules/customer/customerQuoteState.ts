import { customerMoneyCents } from "./customerFinancialDisplay";

export interface CustomerOrderQuote {
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  grand_total: number;
  calculated_at: string;
  expires_at: string;
  quote_token: string;
  fingerprint: string;
  requestId: string;
}

export function parseCustomerOrderQuote(value: unknown, fingerprint: string,
  requestId: string, now = Date.now()): CustomerOrderQuote {
  if (!value || typeof value !== "object") throw new Error("The server returned an invalid quote.");
  const row = value as Record<string, unknown>;
  const subtotal = customerMoneyCents(row.subtotal);
  const fee = customerMoneyCents(row.delivery_fee);
  const tax = customerMoneyCents(row.tax_amount);
  const total = customerMoneyCents(row.grand_total);
  if ([subtotal, fee, tax, total].some((amount) => amount === null) ||
      subtotal! + fee! + tax! !== total ||
      typeof row.quote_token !== "string" || !row.quote_token ||
      typeof row.expires_at !== "string" || Date.parse(row.expires_at) <= now ||
      typeof row.calculated_at !== "string") {
    throw new Error("The server returned an incomplete quote. Please try again.");
  }
  return { subtotal: subtotal! / 100, delivery_fee: fee! / 100,
    tax_amount: tax! / 100,
    grand_total: total! / 100, calculated_at: row.calculated_at,
    expires_at: row.expires_at, quote_token: row.quote_token, fingerprint, requestId };
}

export function currentCustomerQuote(quote: CustomerOrderQuote | null, fingerprint: string,
  now: number, signedIn: boolean): CustomerOrderQuote | null {
  return signedIn && quote?.fingerprint === fingerprint && Date.parse(quote.expires_at) > now
    ? quote : null;
}

export type CustomerQuoteDisplayStatus =
  | "awaiting" | "calculating" | "quoted" | "expired"
  | "changed" | "failed" | "confirmed";

export const customerQuoteStatusCopy: Record<CustomerQuoteDisplayStatus,
  { label: string; note: string | null }> = {
  awaiting: { label: "Awaiting quote", note: "Enter delivery details to calculate the final price." },
  calculating: { label: "Calculating", note: "Calculating your final price…" },
  quoted: { label: "Quoted", note: "Final price ready for your confirmation." },
  expired: { label: "Quote expired", note: "Calculating a fresh total before confirmation." },
  changed: { label: "Needs review", note: "Your order details changed. Calculating a fresh total." },
  failed: { label: "Unable to calculate", note: "We couldn't calculate the final price. Retry price calculation." },
  confirmed: { label: "Confirmed", note: null },
};

export function customerQuoteDisplayStatus(input: {
  confirmed: boolean;
  requesting: boolean;
  currentQuote: CustomerOrderQuote | null;
  previousQuote: CustomerOrderQuote | null;
  quoteFailed: boolean;
  now: number;
}): CustomerQuoteDisplayStatus {
  if (input.confirmed) return "confirmed";
  if (input.requesting) return "calculating";
  if (input.currentQuote) return "quoted";
  if (input.quoteFailed) return "failed";
  if (input.previousQuote) {
    return Date.parse(input.previousQuote.expires_at) <= input.now ? "expired" : "changed";
  }
  return "awaiting";
}

export function customerQuotedAmountRows(quote: CustomerOrderQuote) {
  return [
    { key: "subtotal", label: "Items subtotal", amount: quote.subtotal, sign: "" },
    { key: "delivery", label: "Delivery fee", amount: quote.delivery_fee, sign: "" },
    ...(quote.tax_amount > 0
      ? [{ key: "tax", label: "Tax", amount: quote.tax_amount, sign: "" }]
      : []),
    { key: "total", label: "Total payable", amount: quote.grand_total, sign: "" },
  ];
}
