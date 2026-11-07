import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(import.meta.dirname, '../..');
const source = join(repo, 'qa', 'remaining-regression-closure-20261014.mjs');
const target = join(repo, '.tmp', 'defense-demo-20261014', 'run-defense-regression.private.mjs');
let script = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');
const replacements = [
  ["const stack = join(process.env.LOCALAPPDATA ?? '', 'RRJ-Private-Backups',\n  'rehearsal-20261013', 'isolated-stack');", "const stack = join(process.cwd(), '.tmp', 'defense-demo-20261014');"],
  ['http://127.0.0.1:56321', 'http://127.0.0.1:61321'],
  ['supabase_db_isolated-stack', 'supabase_db_rrj_defense_demo_20261014'],
  ["'--workdir', stack, '-o'", "'--workdir', `\"${stack}\"`, '-o'"],
  ["'qa/remaining-regression-closure-20261014.json'", "'qa/DEFENSE-DEMO-RUN-20261014.json'"],
];
for (const [from, to] of replacements) {
  if (script.split(from).length !== 2) throw new Error(`Regression source changed at required demo substitution: ${from.slice(0, 30)}`);
  script = script.replace(from, to);
}
writeFileSync(target, script);
const result = spawnSync(process.execPath, [target], { cwd: repo, stdio: 'inherit' });
if (result.status !== 0) process.exitCode = result.status || 1;
