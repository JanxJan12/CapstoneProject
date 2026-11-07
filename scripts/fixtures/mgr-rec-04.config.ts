import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(__dirname, "../..");
const mocks = path.resolve(__dirname, "mgr-rec-04-mocks.ts");

export default defineConfig({
  root,
  envDir: false,
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  optimizeDeps: { entries: ["scripts/fixtures/mgr-rec-04.html"] },
  plugins: [
    {
      name: "mgr-rec-04-local-fixture",
      enforce: "pre",
      resolveId(source, importer) {
        if (!importer) return;
        const from = importer.replaceAll("\\", "/");
        if (["StockReceivingPage.tsx", "AwaitingProductionDelivery.tsx", "ReceivingDocumentList.tsx", "UnifiedReceivingDocuments.tsx"].some((name) => from.endsWith(name)) &&
            ["./inventoryRequestApi", "./receivingApi", "./replenishmentApi", "./inventoryApi"].includes(source)) return mocks;
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(root, "src") } },
});
