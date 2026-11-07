// Generate a reviewable copy for a new-environment replay; never edit history.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const migrations = join(root, 'supabase/migrations');
const source = join(migrations, '20260914000000_harden_numeric_inputs.sql');
const output = process.argv[2] && resolve(process.argv[2]);
if (!output) throw new Error('Pass a new output file path outside supabase/migrations.');
if (output === source || output.startsWith(migrations + sep)) throw new Error('Refusing to write inside canonical migrations.');
if (dirname(output) === root) throw new Error('Choose an isolated review directory.');
const original = readFileSync(source, 'utf8');
const matches = [...original.matchAll(/\bstatus cashier_shift_status,/g)];
if (matches.length !== 2) throw new Error('Expected exactly two unqualified return fields; review source.');
const variant = original.replaceAll('status cashier_shift_status,', 'status public.cashier_shift_status,');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
writeFileSync(output, variant, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({
  source,
  output,
  replacements: matches.length,
  sourceSha256: sha256(original),
  variantSha256: sha256(variant),
  status: 'REVIEW_ONLY_NOT_APPLIED',
}, null, 2)}\n`);
