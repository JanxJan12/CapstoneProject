import { createRoot } from "react-dom/client";
import { StockReceivingPage } from "../../src/modules/manager/inventory/StockReceivingPage";
import "../../src/styles/tailwind.css";
import "../../src/styles/theme.css";

const query = new URLSearchParams(location.search);
const initialReportId = query.get("populated") === "draft"
  ? "77777777-7777-4777-8777-777777777777"
  : query.get("populated") === "posted"
    ? "33333333-3333-4333-8333-333333333333"
    : undefined;

createRoot(document.getElementById("root")!).render(
  <main className="min-h-screen bg-background p-3 text-foreground sm:p-6">
    <StockReceivingPage initialReportId={initialReportId}
      onOpenRequest={(id) => { (window as Window & { __openedRequest?: string }).__openedRequest = id; }}
      onOpenItem={(id) => { (window as Window & { __openedItem?: string }).__openedItem = id; }}
      onOpenMovements={(id, receipt) => { (window as Window & { __openedMovements?: string }).__openedMovements = `${id}:${receipt}`; }}
      onOpenStockOverview={() => { (window as Window & { __openedStock?: boolean }).__openedStock = true; }} />
  </main>,
);
