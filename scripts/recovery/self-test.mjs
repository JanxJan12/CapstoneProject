import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = mkdtempSync(join(tmpdir(), 'rrj-recovery-validator-'));
const manifest = { schemaVersion: 1, expectedObjectCount: 3,
  buckets: ['delivery-proofs', 'payment-proofs', 'rider-documents'].map((id) => ({ id, public: false })),
  files: [], objects: [] };
function add(file, kind, bucket, objectKey) {
  const path = join(root, file);
  const bytes = Buffer.from(`SYNTHETIC ${file}\n`);
  mkdirSync(join(root, 'objects'), { recursive: true });
  writeFileSync(path, bytes);
  const entry = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (kind) manifest.files.push({ ...entry, kind });
  else manifest.objects.push({ ...entry, bucket, objectKey });
}
for (const kind of ['roles', 'schema', 'data', 'managed-auth-storage', 'catalog-supplement', 'migration-ledger']) add(`${kind}.txt`, kind);
for (const bucket of manifest.buckets) add(`objects/${bucket.id}.bin`, null, bucket.id, 'synthetic/probe.bin');
const path = join(root, 'manifest.json');
writeFileSync(path, JSON.stringify(manifest));
const verify = join(import.meta.dirname, 'verify-bundle.mjs');
function result() { return spawnSync(process.execPath, [verify, path], { encoding: 'utf8' }); }
if (result().status !== 0) throw new Error('Valid synthetic bundle was rejected.');
writeFileSync(join(root, manifest.objects[0].file), 'corrupted');
if (result().status === 0) throw new Error('Corrupted object bytes were accepted.');
writeFileSync(join(root, manifest.objects[0].file), readFileSync(join(root, manifest.objects[1].file)));
manifest.objects[0].file = '../escape.bin';
writeFileSync(path, JSON.stringify(manifest));
if (result().status === 0) throw new Error('Path traversal was accepted.');
process.stdout.write('PASS: valid synthetic bundle; corruption and path traversal rejected.\n');
