export type CustomerUrlView = "home" | "menu" | "cart" | "checkout" | "tracking" | "history" | "profile";

const views = new Set<CustomerUrlView>(["home", "menu", "cart", "checkout", "tracking", "history", "profile"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCustomerOrderId(value: string): boolean {
  return uuid.test(value);
}

export function customerViewSearch(view: CustomerUrlView, orderId?: string | null): string {
  const query = new URLSearchParams({ view });
  if (view === "tracking" && orderId && isCustomerOrderId(orderId)) query.set("order", orderId.toLowerCase());
  return `?${query.toString()}`;
}

export function parseCustomerViewSearch(search: string): {
  view: CustomerUrlView | null;
  orderId: string | null;
  invalid: boolean;
  fallback: CustomerUrlView;
  canonical: string;
} {
  if (!search || search === "?") return { view: null, orderId: null, invalid: false, fallback: "home", canonical: "" };
  const query = new URLSearchParams(search);
  const rawView = query.get("view");
  const rawOrder = query.get("order");
  const fallback: CustomerUrlView = rawView === "tracking" || rawOrder !== null ? "history" : "home";
  if (query.getAll("view").length !== 1 || query.getAll("order").length > 1 ||
      [...query.keys()].some((key) => key !== "view" && key !== "order") ||
      !rawView || !views.has(rawView as CustomerUrlView) ||
      (rawOrder !== null && (rawView !== "tracking" || !isCustomerOrderId(rawOrder)))) {
    return { view: null, orderId: null, invalid: true, fallback, canonical: customerViewSearch(fallback) };
  }
  const view = rawView as CustomerUrlView;
  const orderId = rawOrder?.toLowerCase() ?? null;
  return { view, orderId, invalid: false, fallback, canonical: customerViewSearch(view, orderId) };
}
