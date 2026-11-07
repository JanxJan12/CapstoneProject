import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(__dirname, "../..");
const mocks = path.resolve(__dirname, "manager-focused-mocks.ts");
const localSupabase = path.resolve(__dirname, "manager-focused-supabase.ts");
export default defineConfig({
  root, envDir: false,
  server: { host: "127.0.0.1", port: 58435, strictPort: true },
  optimizeDeps: { entries: ["scripts/fixtures/manager-focused.html"] },
  plugins: [{
    name: "manager-focused-local-mocks", enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return;
      const from = importer.replaceAll("\\", "/");
      if (source === "@/app/providers/AuthProvider") return mocks;
      if (source === "@/lib/supabase") return localSupabase;
      if (["MenuManagementPage.tsx", "ManagerRequestsPage.tsx", "ReplenishmentPage.tsx", "OrdersPage.tsx"].some((name) => from.endsWith(name)) &&
        ["../api/managerPhase2Api", "../api/mealOptionsApi", "../api/drinkChoicesApi", "../api/managerApi", "./inventoryRequestApi", "./replenishmentApi"].includes(source)) return mocks;
    },
  }, react(), tailwindcss()],
  resolve: { alias: [
    { find: "@/app/providers/AuthProvider", replacement: mocks },
    { find: "@/lib/supabase", replacement: localSupabase },
    { find: "@", replacement: path.resolve(root, "src") },
  ] },
});
