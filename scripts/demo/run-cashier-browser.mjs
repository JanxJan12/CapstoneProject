import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(import.meta.dirname, '../..');
const target = join(repo, '.tmp', 'defense-demo-20261014', 'cashier-browser.private.mjs');
let script = readFileSync(join(repo, 'qa', 'cashier-browser-regression-20261014.mjs'), 'utf8').replace(/\r\n/g, '\n');
const substitutions = [
  ['path.join(process.env.LOCALAPPDATA ?? "", "RRJ-Private-Backups", "rehearsal-20261013", "isolated-stack")', 'path.join(process.cwd(), ".tmp", "defense-demo-20261014")'],
  ['"--workdir", stack, "-o"', '"--workdir", `"${stack}"`, "-o"'],
  ['http://127.0.0.1:56321', 'http://127.0.0.1:61321'],
  ['supabase_db_isolated-stack', 'supabase_db_rrj_defense_demo_20261014'],
  ['path.resolve("qa/cashier-browser-regression-20261014")', 'path.resolve("qa/defense-cashier-browser-20261014")'],
  ["document.body.innerText.includes('Shift Settlement') && document.body.innerText.includes('Shift closure blocked')", "document.body.innerText.includes('Shift Settlement') && document.body.innerText.includes('Cash Reconciliation')"],
  ["Shift screen truthfully blocked closure while unrelated synthetic payments remain pending", "Shift settlement and cash reconciliation rendered on fresh demo stack"],
];
for (const [from, to] of substitutions) {
  if (script.split(from).length !== 2) throw new Error(`Cashier browser source changed at ${from.slice(0, 30)}`);
  script = script.replace(from, to);
}
writeFileSync(target, script);
const result = spawnSync(process.execPath, [target], { cwd: repo, stdio: 'inherit', env: { ...process.env, RRJ_DEFENSE_DEMO: '1', VITE_DEMO_MODE: 'true' } });
if (result.status !== 0) process.exitCode = result.status || 1;
