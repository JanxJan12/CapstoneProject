// Verifies a recovery set without printing private paths or reading database contents.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';

const file = process.argv[2];
if (!file) throw new Error('Usage: node verify-bundle.mjs <manifest.json>');
const manifestPath = realpathSync(resolve(file));
const base = dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !Array.isArray(manifest.objects)) throw new Error('Unsupported bundle manifest.');
const expectedBuckets = ['delivery-proofs', 'payment-proofs', 'rider-documents'];
const all = [...manifest.files, ...manifest.objects];
const seen = new Set();
let bytes = 0;
for (const entry of all) {
  if (typeof entry.file !== 'string' || entry.file.includes('..') || entry.file.includes('\\') || entry.file.startsWith('/')) throw new Error('Unsafe recovery path.');
  if (seen.has(entry.file)) throw new Error('Duplicate recovery path.');
  seen.add(entry.file);
  const actual = realpathSync(resolve(base, entry.file));
  if (!actual.startsWith(base + sep) || !statSync(actual).isFile()) throw new Error('Recovery path escapes bundle.');
  const data = readFileSync(actual);
  if (data.length !== entry.bytes || createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error('Recovery byte count or SHA-256 mismatch.');
  bytes += data.length;
}
const kinds = new Set(manifest.files.map((entry) => entry.kind));
for (const kind of ['roles', 'schema', 'data', 'managed-auth-storage', 'catalog-supplement', 'migration-ledger']) {
  if (!kinds.has(kind)) throw new Error(`Missing ${kind} recovery component.`);
}
for (const bucket of expectedBuckets) if (!manifest.buckets?.some((entry) => entry.id === bucket && entry.public === false)) throw new Error('Missing private bucket declaration.');
for (const entry of manifest.objects) if (!expectedBuckets.includes(entry.bucket) || typeof entry.objectKey !== 'string' || !entry.objectKey || entry.objectKey.startsWith('/')) throw new Error('Invalid object identity.');
const objectKeys = manifest.objects.map((entry) => JSON.stringify([entry.bucket, entry.objectKey]));
if (new Set(objectKeys).size !== objectKeys.length) throw new Error('Duplicate Storage object identity.');
if (manifest.objects.length !== manifest.expectedObjectCount) throw new Error('Storage metadata and byte inventory differ.');
process.stdout.write(`${JSON.stringify({ status: 'PASS', files: manifest.files.length, objects: manifest.objects.length, bytes, buckets: expectedBuckets.length })}\n`);
