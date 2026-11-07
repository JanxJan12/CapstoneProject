import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { validRequestProposal } from "../src/modules/manager/inventory/requestProposal.ts";
import { suggestedRequestQuantity } from "../src/modules/manager/inventory/requestQuantity.ts";

const row = {
  id: "item-1", name: "Synthetic item", unit: "kg", quantity_scale: 3,
  reorder_level: 1.2, usable_now: 0.4, valid_at_need: 0.3,
  outstanding: 0.2, expiry_verified: true,
};
assert.equal(validRequestProposal([row]), true);
assert.equal(suggestedRequestQuantity(row), 0.7);
assert.equal(suggestedRequestQuantity({ ...row, outstanding: 1 }), 0);
for (const invalid of [
  { ...row, quantity_scale: undefined },
  { ...row, quantity_scale: -1 },
  { ...row, quantity_scale: 1.5 },
  { ...row, usable_now: Number.NaN },
  { ...row, valid_at_need: -1 },
  { ...row, expiry_verified: undefined },
]) assert.equal(validRequestProposal([invalid]), false);
assert.equal(validRequestProposal([row, row]), false);
assert.equal(validRequestProposal({}), false);

const api = readFileSync(new URL("../src/modules/manager/inventory/inventoryRequestApi.ts", import.meta.url), "utf8");
const overview = readFileSync(new URL("../src/modules/manager/inventory/InventoryPage.tsx", import.meta.url), "utf8");
assert.match(api, /getRequestProposal = async[\s\S]*rpc<unknown>\("get_inventory_request_proposal"[\s\S]*validRequestProposal\(rows\)/);
assert.match(overview, /const suggestedGap = suggestedRequestQuantity;/);
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/modules/manager/inventory/inventoryRequestApi.ts", import.meta.url))],
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{
    name: "mock-supabase",
    setup(plugin) {
      plugin.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "supabase", namespace: "mock" }));
      plugin.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
        contents: "export const supabase = { rpc: async (name, args) => globalThis.__proposalRpc(name, args) };",
        loader: "js",
      }));
    },
  }],
});
const { getRequestProposal } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
globalThis.__proposalRpc = async (name, args) => {
  assert.equal(name, "get_inventory_request_proposal");
  assert.deepEqual(args, { p_needed_at: "2026-10-27T00:00:00Z" });
  return { data: [row], error: null };
};
assert.deepEqual(await getRequestProposal("2026-10-27T00:00:00Z"), [row]);
globalThis.__proposalRpc = async () => ({ data: [{ ...row, usable_now: "0.4" }], error: null });
await assert.rejects(getRequestProposal("2026-10-27T00:00:00Z"), /invalid request guidance/);
delete globalThis.__proposalRpc;
console.log("PASS request proposal contract and shared quantity calculation");
