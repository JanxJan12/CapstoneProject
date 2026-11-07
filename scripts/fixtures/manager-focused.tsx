import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/layout/AppShell";
import { MANAGER_NAV_GROUPS } from "../../src/modules/manager";
import { MenuManagementPage } from "../../src/modules/manager/menu/MenuManagementPage";
import { ManagerRequestsPage } from "../../src/modules/manager/inventory/ManagerRequestsPage";
import { OrdersPage } from "../../src/modules/manager/orders/OrdersPage";
import { exportSnapshot } from "./manager-focused-mocks";
import { issuedRequestDocument, requestPrintHtml } from "../../src/modules/manager/inventory/requestDocument";
import "../../src/styles/tailwind.css";
import "../../src/styles/theme.css";

const page = new URLSearchParams(location.search).get("page");
if (page === "print" || page === "printDraft") {
  document.open();
  document.write(requestPrintHtml(page === "printDraft" ? {
    identifier: "synthetic-draft", revision: 3, status: "Draft · Not issued", priority: "scheduled",
    neededAt: "Oct 24, 2026, 8:00 AM", destination: "Production", draft: true,
    lines: [{ id: "11111111-1111-4111-8111-000000000001", name: "Synthetic draft line", quantity: 1.5, unit: "kg" }],
  } : issuedRequestDocument(exportSnapshot(2, new URLSearchParams(location.search).has("longExport")))));
  document.close();
} else {
  const params = new URLSearchParams(location.search);
  const content = page === "menu" ? <MenuManagementPage /> : page === "orders" ? <OrdersPage /> : <ManagerRequestsPage initialHistory={page === "export" || ["history", "splitWorkspace", "splitEmpty"].some((key) => params.has(key))} initialRequestId={page === "export" ? "synthetic-export" : params.get("request") ?? undefined} onDirtyChange={(dirty) => { (window as Window & { __requestDraftDirty?: boolean }).__requestDraftDirty = dirty; }} onReceive={(id) => { (window as Window & { __openedReceipt?: string | null }).__openedReceipt = id; }} onReceiveLegacy={() => {}} />;
  createRoot(document.getElementById("root")!).render(
    params.has("visualShell")
      ? <AppShell groups={MANAGER_NAV_GROUPS} active="replenishment" onSelect={() => undefined} user={{ name: "Fixture Manager", role: "Manager" }}>{content}</AppShell>
      : <main className="mx-auto max-w-6xl p-3 sm:p-6">{content}</main>,
  );
}
