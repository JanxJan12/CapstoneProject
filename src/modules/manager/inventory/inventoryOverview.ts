import type { ManagerInventoryStock } from "./inventoryApi";

export type StockAlert = "usable-out" | "low-usable" | "expired-on-hand";

export function stockAlerts(stock: ManagerInventoryStock): StockAlert[] {
  const alerts: StockAlert[] = [];
  if (stock.isActive) {
    if (stock.usableQuantity <= 0) alerts.push("usable-out");
    else if (stock.usableQuantity <= stock.reorderLevel)
      alerts.push("low-usable");
  }
  if (stock.expiredQuantity > 0) alerts.push("expired-on-hand");
  return alerts;
}

export function attentionItems(stocks: ManagerInventoryStock[]) {
  return stocks
    .map((stock) => ({ stock, alerts: stockAlerts(stock) }))
    .filter((row) => row.alerts.length > 0)
    .sort((left, right) => {
      const rank = (alerts: StockAlert[]) =>
        alerts.includes("usable-out")
          ? 0
          : alerts.includes("low-usable")
            ? 1
            : 2;
      return (
        rank(left.alerts) - rank(right.alerts) ||
        left.stock.itemName.localeCompare(right.stock.itemName)
      );
    });
}

