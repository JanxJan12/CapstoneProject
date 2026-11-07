import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/layout/AppShell";
import { MANAGER_NAV_GROUPS } from "../../src/modules/manager";
import { ManagerDashboard } from "../../src/modules/manager/dashboard/ManagerDashboard";
import { InventoryPage } from "../../src/modules/manager/inventory/InventoryPage";
import { InventoryItemDetail } from "../../src/modules/manager/inventory/InventoryItemDetail";
import { ManagerRequestsPage } from "../../src/modules/manager/inventory/ManagerRequestsPage";
import { StockReceivingPage } from "../../src/modules/manager/inventory/StockReceivingPage";
import { InvTransactionsPage } from "../../src/modules/manager/inventory/InvTransactionsPage";
import { WasteSpoilagePage } from "../../src/modules/manager/inventory/WasteSpoilagePage";
import { AdjustmentPage } from "../../src/modules/manager/inventory/AdjustmentPage";
import { InventoryAuditPage } from "../../src/modules/manager/inventory/InventoryAuditPage";
import { MenuManagementPage } from "../../src/modules/manager/menu/MenuManagementPage";
import { ReportsPage } from "../../src/modules/manager/reports/ReportsPage";
import { RidersPage } from "../../src/modules/manager/riders/RidersPage";
import "../../src/styles/tailwind.css";
import "../../src/styles/theme.css";

type Page = "dashboard" | "inventory" | "inventory-item" | "replenishment" | "stock-receiving" | "inv-transactions" | "waste-spoilage" | "adjustment" | "inventory-audit" | "orders" | "menu" | "customers" | "reports" | "settings";
const groups = MANAGER_NAV_GROUPS;

function Fixture() {
  const initial = new URLSearchParams(location.search).get("page") as Page | null;
  const [page, setPage] = useState<Page>(initial && ["dashboard", "inventory", "inventory-item", "replenishment", "stock-receiving", "inv-transactions", "waste-spoilage", "adjustment", "inventory-audit", "menu", "reports", "riders"].includes(initial) ? initial : "dashboard");
  const [requestItemId, setRequestItemId] = useState<string>();
  const [itemId, setItemId] = useState("1");
  const [reportId, setReportId] = useState<string>();
  const [receiptRef, setReceiptRef] = useState("");
  const [receivingSearch, setReceivingSearch] = useState("");
  const query = new URLSearchParams(location.search);
  return <AppShell groups={groups as any} active={page === "inventory-item" ? "inventory" : page} activeTitle={page === "inventory-item" ? "Item Stock" : undefined} onSelect={(next) => { setReceiptRef(""); setReceivingSearch(""); setPage(next as Page); history.replaceState(null, "", `?page=${next}`); }} user={{ name: "Alex Manager", role: "Manager" }}>
    {page === "dashboard" ? <ManagerDashboard onNavigate={setPage} /> : page === "inventory" ? <InventoryPage onNavigate={(next) => setPage(next as Page)} onOpenItem={(nextItemId) => { setItemId(nextItemId); setPage("inventory-item"); }} onOpenReceivingReport={(nextReportId) => { setReportId(nextReportId); setPage("stock-receiving"); }} onPrepareItem={(nextItemId) => { setRequestItemId(nextItemId); setPage("replenishment"); }} /> : page === "inventory-item" ? <InventoryItemDetail itemId={itemId} onBack={() => setPage("inventory")} onNavigate={(next) => setPage(next as Page)} onAction={(next, nextItemId) => { setItemId(nextItemId); setPage(next); }} onOpenReceipt={(reference) => { setReceivingSearch(reference); setReportId(undefined); setPage("stock-receiving"); }} /> : page === "replenishment" ? <ManagerRequestsPage initialItemId={requestItemId} initialHistory={query.has("mgrRec")} initialRequestId={query.has("mgrRec") ? "11111111-1111-4111-8111-000000000004" : undefined} onReceive={(nextReportId) => { setReportId(nextReportId ?? undefined); setPage("stock-receiving"); }} /> : page === "stock-receiving" ? <StockReceivingPage initialReportId={reportId ?? (query.get("populated") ? query.get("populated") === "draft" ? "77777777-7777-4777-8777-777777777777" : "33333333-3333-4333-8333-333333333333" : undefined)} initialReceiptSearch={receivingSearch} onOpenRequest={() => setPage("replenishment")} onOpenItem={(nextItemId) => { setItemId(nextItemId); setPage("inventory-item"); }} onOpenMovements={(nextItemId, reference) => { setItemId(nextItemId); setReceiptRef(reference); setPage("inv-transactions"); }} /> : page === "inv-transactions" ? <InvTransactionsPage initialItemId={itemId} initialReceiptReference={receiptRef} onBackToItem={() => setPage("inventory-item")} onOpenReceipt={(reference) => { setReceivingSearch(reference); setReportId(undefined); setPage("stock-receiving"); }} /> : page === "waste-spoilage" ? <WasteSpoilagePage /> : page === "adjustment" ? <AdjustmentPage /> : page === "inventory-audit" ? <InventoryAuditPage /> : page === "menu" ? <MenuManagementPage /> : page === "reports" ? <ReportsPage /> : page === "riders" ? <RidersPage /> : <p>This route is outside the visual fixture.</p>}
  </AppShell>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.body.dataset.innerWidth = String(innerWidth);
  document.body.dataset.scrollWidth = String(document.documentElement.scrollWidth);
}));
