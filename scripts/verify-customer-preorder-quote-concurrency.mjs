import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const run = promisify(execFile);
const container = 'codex-meal-customer-qa-20261021';
const database = process.argv[2] ?? 'quote_rehearsal_session_20261022';
const customerId = 'c1111111-1111-4111-8111-111111111111';
const sessionId = 'd1111111-1111-4111-8111-111111111111';
const requestId = randomUUID();
const items = '[{"id":"b3333333-3333-4333-8333-333333333333","qty":1,"modifier_ids":[]}]';
const context = `begin; set local role authenticated;
  select set_config('request.jwt.claim.sub','${customerId}',true);
  select set_config('request.jwt.claims','{"sub":"${customerId}","role":"authenticated","session_id":"${sessionId}"}',true);`;
async function query(sql) {
  const { stdout } = await run('docker', ['exec', container, 'psql', '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', database, '-c', sql]);
  return stdout.trim();
}
const quoteOutput = await query(`${context}
  select quote_token from public.quote_customer_order('QA Customer','09123456789','QA address',null,
    '${items}'::jsonb,'${requestId}'::uuid); commit;`);
const token = quoteOutput.split(/\r?\n/).find((line) => /^[0-9a-f]+\.[0-9a-f]{64}$/.test(line));
assert.ok(token, 'Expected a signed quote');
const statement = `${context}
  select order_id::text from public.place_customer_order_confirmed('QA Customer','09123456789',
    'QA address',null,'${items}'::jsonb,'${requestId}'::uuid,'${token}'); commit;`;
const responses = await Promise.all([query(statement), query(statement)]);
const orderIds = responses.map((output) => output.split(/\r?\n/).find((line) =>
  /^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(line)));
assert.ok(orderIds[0] && orderIds[0] === orderIds[1], 'Concurrent calls returned different orders');
const count = await query(`select count(*) from public.orders where customer_request_id='${requestId}'::uuid;`);
assert.equal(count, '1');
console.log('PASS two concurrent confirmed submissions returned one identical synthetic order');

const raceRequest = randomUUID();
const raceQuoteOutput = await query(`${context}
  select quote_token from public.quote_customer_order('QA Customer','09123456789','QA address',null,
    '${items}'::jsonb,'${raceRequest}'::uuid); commit;`);
const raceToken = raceQuoteOutput.split(/\r?\n/).find((line) => /^[0-9a-f]+\.[0-9a-f]{64}$/.test(line));
assert.ok(raceToken);
const updating = query(`begin; update public.menu_items set price=121
  where id='b3333333-3333-4333-8333-333333333333'; select pg_sleep(2); commit;`);
await delay(300);
let raceError = '';
try {
  await query(`${context}
    select order_id::text from public.place_customer_order_confirmed('QA Customer','09123456789',
      'QA address',null,'${items}'::jsonb,'${raceRequest}'::uuid,'${raceToken}'); commit;`);
} catch (error) {
  raceError = String(error.stderr ?? error.message);
}
await updating;
await query(`update public.menu_items set price=120 where id='b3333333-3333-4333-8333-333333333333';`);
const raceCount = await query(`select count(*) from public.orders where customer_request_id='${raceRequest}'::uuid;`);
assert.match(raceError, /Quote is stale/);
assert.equal(raceCount, '0');
console.log('PASS concurrent catalog price update cannot create an order at changed terms');

const feeRequest = randomUUID();
const feeQuoteOutput = await query(`${context}
  select quote_token from public.quote_customer_order('QA Customer','09123456789','QA address',null,
    '${items}'::jsonb,'${feeRequest}'::uuid); commit;`);
const feeToken = feeQuoteOutput.split(/\r?\n/).find((line) => /^[0-9a-f]+\.[0-9a-f]{64}$/.test(line));
assert.ok(feeToken);
const originalPricing = await query(`select pg_get_functiondef('public.customer_order_pricing(jsonb)'::regprocedure);`);
assert.match(originalPricing, /v_delivery_fee numeric := 50;/);
let feeError = '';
try {
  await query(originalPricing.replace('v_delivery_fee numeric := 50;', 'v_delivery_fee numeric := 51;'));
  try {
    await query(`${context}
      select order_id::text from public.place_customer_order_confirmed('QA Customer','09123456789',
        'QA address',null,'${items}'::jsonb,'${feeRequest}'::uuid,'${feeToken}'); commit;`);
  } catch (error) {
    feeError = String(error.stderr ?? error.message);
  }
} finally {
  await query(originalPricing);
}
assert.match(feeError, /Quote is stale/);
assert.equal(await query(`select count(*) from public.orders where customer_request_id='${feeRequest}'::uuid;`), '0');
console.log('PASS synthetic delivery-fee policy change rejects an old accepted quote');
