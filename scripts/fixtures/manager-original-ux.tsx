import { useState } from "react";
import { createRoot } from "react-dom/client";
import { InventoryPage } from "../../src/modules/manager/inventory/InventoryPage";
import { InvTransactionsPage } from "../../src/modules/manager/inventory/InvTransactionsPage";
import { StockReceivingPage } from "../../src/modules/manager/inventory/StockReceivingPage";
import { InventoryItemDetail } from "../../src/modules/manager/inventory/InventoryItemDetail";
import { ManagerRequestsPage } from "../../src/modules/manager/inventory/ManagerRequestsPage";
import "../../src/styles/tailwind.css";
import "../../src/styles/theme.css";

function Fixture() {
  const [page, setPage] = useState<"inventory" | "inv-transactions" | "stock-receiving" | "inventory-item" | "replenishment">("inventory");
  const [itemId, setItemId] = useState("1");
  const [receiptRef, setReceiptRef] = useState("");
  const [receivingSearch, setReceivingSearch] = useState("");
  const [reportId, setReportId] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const openReceipt = (reference: string) => {
    setReceivingSearch(reference);
    setReportId(undefined);
    setPage("stock-receiving");
  };
  return <main className="min-h-screen min-w-0 bg-background p-3 text-foreground sm:p-6">
    {page === "inventory" ? <InventoryPage
      onNavigate={(next) => { if (next === "inv-transactions" || next === "stock-receiving") setPage(next); }}
      onOpenItem={(next) => { setItemId(next); setPage("inventory-item"); }}
      onOpenReceivingReport={(next) => { setReportId(next); setPage("stock-receiving"); }}
      onOpenReceiptReference={openReceipt}
    /> : page === "inv-transactions" ? <InvTransactionsPage
      initialItemId={itemId} initialReceiptReference={receiptRef} onOpenReceipt={openReceipt}
      onBackToItem={() => setPage("inventory-item")}
    /> : page === "inventory-item" ? <InventoryItemDetail
      itemId={itemId} onBack={() => setPage("inventory")}
      onNavigate={(next) => { if (next === "inv-transactions") setPage(next); }}
      onAction={() => {}} onOpenRequest={() => {}} onOpenReceipt={openReceipt}
    /> : page === "replenishment" ? <ManagerRequestsPage initialHistory initialRequestId={requestId} onReceive={() => {}} onReceiveLegacy={() => {}} />
    : <StockReceivingPage initialReportId={reportId} initialReceiptSearch={receivingSearch}
      onOpenRequest={(next) => { setRequestId(next); setPage("replenishment"); }} onOpenItem={(next) => { setItemId(next); setPage("inventory-item"); }}
      onOpenMovements={(next, reference) => { setItemId(next); setReceiptRef(reference); setPage("inv-transactions"); }}
    />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
