import type { CashierPageId } from "./types";

export type OrdersReceiptsView = "orders" | "receipts";

export function resolveCashierPath(pathname: string): {
  page: CashierPageId;
  view: OrdersReceiptsView;
  canonicalPath: string;
} {
  const path = pathname.replace(/\/+$/, "") || "/cashier";
  const legacy = path === "/cashier/order-list" ? "orders" :
    path === "/cashier/transactions" ? "receipts" : undefined;
  if (legacy) return {
    page: "orders-receipts", view: legacy,
    canonicalPath: cashierPathFor("orders-receipts", legacy),
  };
  if (path === "/cashier/orders-receipts/receipts") return {
    page: "orders-receipts", view: "receipts", canonicalPath: path,
  };
  if (path === "/cashier/orders-receipts" || path === "/cashier/orders-receipts/orders") return {
    page: "orders-receipts", view: "orders",
    canonicalPath: cashierPathFor("orders-receipts", "orders"),
  };
  if (path === "/cashier/pending-payments" || path === "/cashier/walkin-pos" ||
      path === "/cashier/shift-settlement") return {
    page: path.slice("/cashier/".length) as CashierPageId,
    view: "orders", canonicalPath: path,
  };
  return { page: "dashboard", view: "orders", canonicalPath: "/cashier" };
}

export function cashierPathFor(page: CashierPageId, view: OrdersReceiptsView = "orders") {
  if (page === "order-list") return "/cashier/orders-receipts/orders";
  if (page === "transactions") return "/cashier/orders-receipts/receipts";
  if (page === "orders-receipts") return `/cashier/orders-receipts/${view}`;
  return page === "dashboard" ? "/cashier" : `/cashier/${page}`;
}
