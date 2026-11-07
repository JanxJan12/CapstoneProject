import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/modules/customer/customerPaymentInput.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { normalizeCustomerGcashReference } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

assert.deepEqual(normalizeCustomerGcashReference('  A-09/31  '),
  { value: 'A-09/31', error: null });
assert.equal(normalizeCustomerGcashReference(' '.repeat(4)).error,
  'Enter the GCash reference number.');
assert.equal(normalizeCustomerGcashReference(` ${'A'.repeat(100)} `).error, null);
assert.match(normalizeCustomerGcashReference('A'.repeat(101)).error, /100 characters/);

console.log('PASS Customer GCash reference whitespace, accepted punctuation, empty and 100-character boundaries');
