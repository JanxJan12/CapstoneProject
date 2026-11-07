import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(import.meta.dirname, '../..');
const target = join(repo, '.tmp', 'defense-demo-20261014', 'manager-regression.private.mjs');
let script = readFileSync(join(repo, 'qa', 'manager-write-regression-20261013.mjs'), 'utf8').replace(/\r\n/g, '\n');
const substitutions = [
  ['join(process.env.LOCALAPPDATA ?? "", "RRJ-Private-Backups", "rehearsal-20261013", "isolated-stack")', 'join(process.cwd(), ".tmp", "defense-demo-20261014")'],
  ['"--workdir", stack, "-o"', '"--workdir", `"${stack}"`, "-o"'],
  ['http://127.0.0.1:56321', 'http://127.0.0.1:61321'],
  ['supabase_db_isolated-stack', 'supabase_db_rrj_defense_demo_20261014'],
  ['"qa/manager-write-regression-20261013.json"', '"qa/DEFENSE-MANAGER-RUN-20261014.json"'],
];
for (const [from, to] of substitutions) {
  if (script.split(from).length !== 2) throw new Error(`Manager regression source changed at ${from.slice(0, 30)}`);
  script = script.replace(from, to);
}
writeFileSync(target, script);
const result = spawnSync(process.execPath, [target], { cwd: repo, stdio: 'inherit' });
if (result.status !== 0) process.exitCode = result.status || 1;
