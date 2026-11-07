// Read-only comparison of a captured hosted migration ledger and local SQL files.
// Equal version is a ledger match, not proof of equal SQL or deployed behavior.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const snapshot = JSON.parse(readFileSync(join(root, 'qa/backend-audit-hosted-migrations-20261026.json'), 'utf8'));
if (snapshot.projectRef !== 'zhzluhqvysvsadwuugpa') throw new Error('Unexpected hosted project');
const hosted = snapshot.migrations;
const local = readdirSync(join(root, 'supabase/migrations'))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .map((file) => ({ version: file.slice(0, 14), name: file.slice(15, -4), file }))
  .sort((a, b) => a.version.localeCompare(b.version));
const unique = (rows, source) => {
  const versions = rows.map((row) => row.version);
  if (new Set(versions).size !== versions.length) throw new Error(`Duplicate ${source} version`);
};
unique(hosted, 'hosted');
unique(local, 'local');
const hostedByVersion = new Map(hosted.map((row) => [row.version, row]));
const localByVersion = new Map(local.map((row) => [row.version, row]));
const common = local.filter((row) => hostedByVersion.has(row.version));
const hostedOnly = hosted.filter((row) => !localByVersion.has(row.version));
const localOnly = local.filter((row) => !hostedByVersion.has(row.version));
const sameNameCandidates = hostedOnly.flatMap((remote) =>
  localOnly.filter((file) => file.name === remote.name)
    .map((file) => ({ hostedVersion: remote.version, localVersion: file.version, name: remote.name })));
const result = {
  snapshot: snapshot.capturedAt,
  projectRef: snapshot.projectRef,
  hostedCount: hosted.length,
  localCount: local.length,
  commonVersionCount: common.length,
  hostedOnly,
  localOnly,
  sameNameCandidates,
  warning: 'Same name or version does not prove equal SQL. Compare deployed object definitions and source hashes before any history operation.',
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
