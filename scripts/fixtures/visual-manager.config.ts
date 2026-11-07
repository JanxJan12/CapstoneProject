import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(__dirname, "../..");
const mocks = path.resolve(__dirname, "visual-manager-mocks.ts");
const localSupabase = path.resolve(__dirname, "manager-focused-supabase.ts");

export default defineConfig({
  root,
  envDir: false,
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  optimizeDeps: { entries: ["scripts/fixtures/visual-manager.html"] },
  plugins: [
    {
      name: "visual-manager-local-fixture",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer) return;
        const from = importer.replaceAll("\\", "/");
        if (source.includes("/app/providers/AuthProvider") && from.endsWith("ManagerDashboard.tsx")) return mocks;
        if (["ManagerDashboard.tsx", "InventoryPage.tsx", "InventoryItemDetail.tsx", "ManagerRequestsPage.tsx", "StockReceivingPage.tsx", "AwaitingProductionDelivery.tsx", "ReplenishmentPage.tsx", "ReceivingDocumentList.tsx", "InvTransactionsPage.tsx", "WasteSpoilagePage.tsx", "AdjustmentPage.tsx", "InventoryAuditPage.tsx", "MenuManagementPage.tsx", "ReportsPage.tsx", "RidersPage.tsx"].some((name) => from.endsWith(name)) &&
            ["../api/managerApi", "../api/managerPhase2Api", "../api/mealOptionsApi", "../api/drinkChoicesApi", "../inventory/inventoryApi", "./inventoryApi", "./inventoryRequestApi", "./receivingApi", "./replenishmentApi"].includes(source)) return mocks;
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: { alias: [
    { find: "@/app/providers/AuthProvider", replacement: mocks },
    { find: "@/lib/supabase", replacement: localSupabase },
    { find: "@", replacement: path.resolve(root, "src") },
  ] },
});
