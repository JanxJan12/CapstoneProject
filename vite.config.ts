import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id: string) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(__dirname, "src/assets", filename);
      }
    },
  };
}

if (process.env.RRJ_STAGE2_TEST !== undefined && process.env.RRJ_STAGE2_TEST !== "1") {
  throw new Error("RRJ_STAGE2_TEST must be 1 when supplied.");
}

const stage2Test = process.env.RRJ_STAGE2_TEST === "1";

if (stage2Test) {
  if (process.env.RRJ_DEFENSE_DEMO === "1" || process.env.VITE_DEMO_MODE === "true") {
    throw new Error("Stage 2 testing cannot use defense demo mode.");
  }
  if (process.env.VITE_SUPABASE_URL !== "http://127.0.0.1:49321") {
    throw new Error("Stage 2 testing requires the exact local Supabase API URL.");
  }
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  let isPublicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!isPublicKey) {
    try {
      const parts = key.split(".");
      isPublicKey = parts.length === 3 &&
        JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role === "anon";
    } catch {
      isPublicKey = false;
    }
  }
  if (!isPublicKey) {
    throw new Error("Stage 2 testing requires a local publishable or anon key.");
  }
}

export default defineConfig({
  envDir: process.env.RRJ_DEFENSE_DEMO === "1" || stage2Test ? false : undefined,
  define: {
    "import.meta.env.VITE_STAGE2_TEST_MODE": JSON.stringify(stage2Test ? "true" : "false"),
  },
  server: stage2Test ? { host: "127.0.0.1", port: 58443, strictPort: true } : undefined,
  preview: stage2Test ? { host: "127.0.0.1", port: 58443, strictPort: true } : undefined,
  plugins: [
    {
      name: "rrj-stage2-binding-guard",
      configResolved(config) {
        if (!stage2Test) return;
        for (const binding of [config.server, config.preview]) {
          if (binding.host !== "127.0.0.1" || binding.port !== 58443 || !binding.strictPort) {
            throw new Error("Stage 2 frontend must bind only to 127.0.0.1:58443.");
          }
        }
      },
    },
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
