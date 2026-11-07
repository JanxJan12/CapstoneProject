import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(__dirname, "../..");
const mocks = path.resolve(__dirname, "manager-original-ux-mocks.ts");
export default defineConfig({
  root, envDir: false,
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  optimizeDeps: { entries: ["scripts/fixtures/manager-original-ux.html"] },
  plugins: [{
    name: "manager-original-ux-local-mocks", enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return;
      const from = importer.replaceAll("\\", "/");
      if (["InventoryPage.tsx", "InventoryItemDetail.tsx", "InvTransactionsPage.tsx", "StockReceivingPage.tsx", "UnifiedReceivingDocuments.tsx", "ReceivingDocumentList.tsx", "AwaitingProductionDelivery.tsx", "ManagerRequestsPage.tsx", "ReplenishmentPage.tsx"].some((name) => from.endsWith(name)) &&
          ["./inventoryApi", "./inventoryRequestApi", "./receivingApi", "./replenishmentApi"].includes(source)) return mocks;
    },
  }, react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(root, "src") } },
});
