import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'rrj-preflight-'));
const check = join(import.meta.dirname, 'check-release-preflight.mjs');
function blocked(args, expected) {
  const run = spawnSync(process.execPath, [check, ...args], { encoding: 'utf8' });
  if (run.status !== 1) throw Error('Preflight must exit 1.');
  const report = JSON.parse(run.stdout);
  if (report.status !== 'BLOCKED' || !report.findings.some((finding) => finding.includes(expected))) throw Error(`Expected blocker: ${expected}`);
  if (report.migrationHashes.length !== 6
      || report.migrationHashes.at(-1)?.name !== '20261014191853_h08c_historical_shift_access.sql'
      || report.migrationHashes.at(-1)?.sha256 !== '121dbf55122736b853a93989fab0a46c22af4d98d22a308aab219371e161b5b5'
      || report.findings.some((finding) => finding.includes('SHA-256 differs'))) {
    throw Error('Pinned migration hashes differ from the current source.');
  }
}
blocked([], 'Missing private historical');
const broken = join(dir, 'broken.json');
writeFileSync(broken, '{');
blocked([broken, broken], 'Hosted recovery authorization is missing or malformed');
const fake = join(dir, 'fake.json');
writeFileSync(fake, JSON.stringify({ schemaVersion: 1, projectRef: 'zhzluhqvysvsadwuugpa', approved: true }));
blocked([fake, fake], 'Hosted recovery authorization is incomplete');
process.stdout.write('PASS: absent and malformed approvals fail closed; migration hashes are checked.\n');
