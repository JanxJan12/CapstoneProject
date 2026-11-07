import { spawnSync } from "node:child_process";
import path from "node:path";

const stack = path.join(process.env.LOCALAPPDATA ?? "", "RRJ-Private-Backups", "rehearsal-20261013", "isolated-stack");
const status = spawnSync("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", stack, "-o", "json"], {
  shell: true, encoding: "utf8", windowsHide: true,
});
if (status.status !== 0) throw Error("Isolated Supabase stack unavailable");
const local = JSON.parse(status.stdout);
if (local.API_URL !== "http://127.0.0.1:56321") throw Error("Refusing non-isolated API");
const response = await fetch(`${local.API_URL}/rest/v1/rpc/get_customer_menu_modifiers`, {
  method: "POST", redirect: "error",
  headers: { apikey: local.PUBLISHABLE_KEY, authorization: `Bearer ${local.PUBLISHABLE_KEY}`, "content-type": "application/json" },
  body: "{}",
});
if (!response.ok) throw Error(`Local modifier projection failed: HTTP ${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows)) throw Error("Local modifier projection returned an invalid shape");
for (const row of rows) {
  if (!row.menu_item_id || !row.group_id || !["single", "multiple"].includes(row.selection_type))
    throw Error("Local modifier projection returned an invalid group");
  if (row.option_id && (!row.option_name || !Number.isFinite(Number(row.price_adjustment))))
    throw Error("Local modifier projection returned an invalid option");
}
console.log(`PASS: isolated local modifier RPC returned ${rows.length} catalog rows with valid group and option fields`);
