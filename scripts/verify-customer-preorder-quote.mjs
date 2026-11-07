import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/modules/customer/customerQuoteState.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { parseCustomerOrderQuote, currentCustomerQuote, customerQuoteDisplayStatus,
  customerQuoteStatusCopy, customerQuotedAmountRows } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const now = Date.parse('2026-10-22T10:00:00Z');
const row = { subtotal: '120.00', delivery_fee: '50.00',
  tax_amount: '0.00', grand_total: '170.00', calculated_at: '2026-10-22T10:00:00Z',
  expires_at: '2026-10-22T10:05:00Z', quote_token: 'server-token' };
const quote = parseCustomerOrderQuote(row, 'cart-and-address-a', 'request-a', now);
assert.equal(quote.grand_total, 170);
assert.equal(currentCustomerQuote(quote, 'cart-and-address-a', now, true), quote);
assert.equal(currentCustomerQuote(quote, 'cart-or-address-b', now, true), null);
assert.equal(currentCustomerQuote(quote, 'cart-and-address-a', Date.parse(row.expires_at), true), null);
assert.equal(currentCustomerQuote(quote, 'cart-and-address-a', now, false), null);
assert.throws(() => parseCustomerOrderQuote({ ...row, grand_total: '171.00' }, 'a', 'b', now));
assert.throws(() => parseCustomerOrderQuote({ ...row, quote_token: '' }, 'a', 'b', now));
assert.throws(() => parseCustomerOrderQuote({ ...row, expires_at: row.calculated_at }, 'a', 'b', now));

const status = (overrides = {}) => customerQuoteDisplayStatus({ confirmed: false,
  requesting: false, currentQuote: null, previousQuote: null, quoteFailed: false,
  now, ...overrides });
assert.equal(status(), 'awaiting');
assert.equal(customerQuoteStatusCopy.awaiting.label, 'Awaiting quote');
assert.equal(status({ requesting: true }), 'calculating');
assert.equal(customerQuoteStatusCopy.calculating.label, 'Calculating');
assert.equal(status({ currentQuote: quote }), 'quoted');
assert.equal(customerQuoteStatusCopy.quoted.label, 'Quoted');
assert.doesNotMatch(customerQuoteStatusCopy.quoted.note, /request a server quote/i);
assert.equal(status({ previousQuote: quote, now: Date.parse(row.expires_at) }), 'expired');
assert.equal(status({ previousQuote: quote }), 'changed');
assert.equal(status({ quoteFailed: true }), 'failed');
assert.match(customerQuoteStatusCopy.failed.note, /retry price calculation/i);
assert.equal(status({ confirmed: true, currentQuote: quote }), 'confirmed');
assert.equal(customerQuoteStatusCopy.confirmed.label, 'Confirmed');

const rows = customerQuotedAmountRows(quote);
assert.deepEqual(rows.map((line) => [line.label, line.amount]), [
  ['Items subtotal', 120], ['Delivery fee', 50], ['Total payable', 170],
]);
const adjusted = parseCustomerOrderQuote({ ...row, delivery_fee: '0.00',
  tax_amount: '3.00', grand_total: '123.00' },
  'cart-and-address-a', 'request-b', now);
assert.deepEqual(customerQuotedAmountRows(adjusted).map((line) => [line.key, line.amount, line.sign]), [
  ['subtotal', 120, ''], ['delivery', 0, ''],
  ['tax', 3, ''], ['total', 123, ''],
]);

const source = readFileSync('src/modules/customer/customerCheckoutPage.tsx', 'utf8');
const cartSource = readFileSync('src/modules/customer/customerCartPage.tsx', 'utf8');
assert.equal((source.match(/<CustomerQuotedBreakdown quote={currentOrderQuote}/g) ?? []).length, 1,
  'Order summary is the single quoted breakdown');
assert.match(source, /customerQuoteStatusCopy\[quoteDisplayStatus\]/);
assert.match(source, /setFailedQuoteFingerprint\(fingerprint\)/);
assert.match(source, /deliveryAddress: deliveryAddress\.trim\(\)/);
assert.match(source, /items: cart\.map\(\(item\) =>/);
assert.match(source, /modifier_ids: item\.modifierIds/);
assert.match(source, /window\.setTimeout\(async \(\) => \{[\s\S]*?supabase\.rpc\("quote_customer_order"/);
assert.match(source, /!active \|\| latestQuoteFingerprintRef\.current !== fingerprint/);
assert.match(source, /!currentOrderQuote \|\| Date\.parse\(currentOrderQuote\.expires_at\) <= Date\.now\(\)/);
assert.match(source, /setOrderQuote\(null\)/);
assert.doesNotMatch(source, /Review Final Price/);
assert.ok(source.indexOf('Order summary sidebar') < source.indexOf('Confirm order —'),
  'the order summary must precede confirmation on mobile');
assert.match(source, /setPendingPaymentSubmission\(\{[\s\S]*?setStep\("upload"\)/);
assert.doesNotMatch(source, /Request a server quote to review the delivery fee/i);
assert.match(cartSource, /Order estimate[\s\S]*?Estimate/);
assert.match(cartSource, /lg:hidden/);
console.log('PASS Customer quote parsing, lifecycle states, single summary, zero fee, tax, retry and checkout source guards');
