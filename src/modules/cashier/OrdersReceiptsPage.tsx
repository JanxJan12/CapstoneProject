import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CashierOrderListPage } from "./orders/CashierOrderListPage";
import { TransactionHistoryPage } from "./transactions/TransactionHistoryPage";
import type { CashierNavigationIntent, CashierPageId } from "./types";
import type { OrdersReceiptsView } from "./ordersReceiptsNavigation";

export function OrdersReceiptsPage({ view, intent, onNavigate }: {
  view: OrdersReceiptsView;
  intent?: CashierNavigationIntent;
  onNavigate: (page: CashierPageId, intent?: CashierNavigationIntent) => void;
}) {
  const [visited, setVisited] = useState({ orders: view === "orders", receipts: view === "receipts" });
  const ordersTab = useRef<HTMLButtonElement>(null);
  const receiptsTab = useRef<HTMLButtonElement>(null);
  const previousView = useRef(view);
  const ordersIntent = useRef<CashierNavigationIntent | undefined>(undefined);
  const receiptsIntent = useRef<CashierNavigationIntent | undefined>(undefined);
  if (intent && Object.keys(intent).some((key) => key !== "workspaceView")) {
    if (view === "orders") ordersIntent.current = intent;
    else receiptsIntent.current = intent;
  }

  useEffect(() => {
    setVisited((current) => ({ ...current, [view]: true }));
    if (previousView.current !== view) {
      (view === "orders" ? ordersTab : receiptsTab).current?.focus();
      previousView.current = view;
    }
  }, [view]);

  const switchView = (next: OrdersReceiptsView) => {
    if (next !== view) onNavigate("orders-receipts", { workspaceView: next });
  };
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, from: OrdersReceiptsView) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "orders" : event.key === "End" ? "receipts" :
      from === "orders" ? "receipts" : "orders";
    switchView(next);
    (next === "orders" ? ordersTab : receiptsTab).current?.focus();
  };

  return (
    <div className="cashier-page">
      <header className="border-b border-border/70 pb-3">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Orders &amp; Receipts</h1>
      </header>
      <div role="tablist" aria-label="Orders and receipts views" className="flex w-full gap-1 rounded-xl border border-border bg-white p-1 sm:w-fit">
        <button ref={ordersTab} id="cashier-orders-tab" type="button" role="tab"
          aria-selected={view === "orders"} aria-controls="cashier-orders-panel"
          tabIndex={view === "orders" ? 0 : -1}
          onClick={() => switchView("orders")}
          onKeyDown={(event) => handleTabKey(event, "orders")}
          className={`min-h-11 flex-1 rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none ${view === "orders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          Orders
        </button>
        <button ref={receiptsTab} id="cashier-receipts-tab" type="button" role="tab"
          aria-selected={view === "receipts"} aria-controls="cashier-receipts-panel"
          tabIndex={view === "receipts" ? 0 : -1}
          onClick={() => switchView("receipts")}
          onKeyDown={(event) => handleTabKey(event, "receipts")}
          className={`min-h-11 flex-1 rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none ${view === "receipts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          Receipts &amp; sales
        </button>
      </div>
      <div id="cashier-orders-panel" role="tabpanel" aria-labelledby="cashier-orders-tab" hidden={view !== "orders"}>
        {(visited.orders || view === "orders") ? (
          <CashierOrderListPage active={view === "orders"} embedded
            intent={ordersIntent.current}
            onViewReceipt={(transactionId) => onNavigate("orders-receipts", { workspaceView: "receipts", transactionId })} />
        ) : null}
      </div>
      <div id="cashier-receipts-panel" role="tabpanel" aria-labelledby="cashier-receipts-tab" hidden={view !== "receipts"}>
        {(visited.receipts || view === "receipts") ? (
          <TransactionHistoryPage active={view === "receipts"} embedded
            intent={receiptsIntent.current}
            onViewOrder={(orderId) => onNavigate("orders-receipts", { workspaceView: "orders", orderId })} />
        ) : null}
      </div>
    </div>
  );
}
