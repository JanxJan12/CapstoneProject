// Isolated recovery validation. Creates synthetic local-only rows and objects.
// This must never run against a linked or hosted Supabase project.
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';

const stack = join(process.env.LOCALAPPDATA ?? '', 'RRJ-Private-Backups',
  'rehearsal-20261013', 'isolated-stack');
const cli = spawnSync('npx.cmd', ['--yes', 'supabase@2.120.0', 'status',
  '--workdir', stack, '-o', 'json'], { encoding: 'utf8', shell: true });
if (cli.status !== 0) throw new Error('The isolated Supabase stack is unavailable.');
const local = JSON.parse(cli.stdout);
if (local.API_URL !== 'http://127.0.0.1:56321') {
  throw new Error('Refusing to use any API other than the isolated loopback stack.');
}
const dbContainer = 'supabase_db_isolated-stack';
const inspect = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', dbContainer],
  { encoding: 'utf8' });
if (inspect.status !== 0 || inspect.stdout.trim() !== 'true') {
  throw new Error('The expected isolated database is not running.');
}

function sql(query) {
  const result = spawnSync('docker', ['exec', '-u', 'postgres', dbContainer,
    'psql', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1',
    '-Atqc', query], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Local SQL failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function headers(token) {
  return { apikey: local.PUBLISHABLE_KEY,
    authorization: `Bearer ${token ?? local.PUBLISHABLE_KEY}` };
}

async function request(path, { method = 'GET', token, body, contentType } = {}) {
  const h = headers(token);
  if (contentType) h['content-type'] = contentType;
  else if (body !== undefined) h['content-type'] = 'application/json';
  const response = await fetch(local.API_URL + path, {
    method, headers: h, body: body === undefined ? undefined :
      (contentType ? body : JSON.stringify(body)), redirect: 'error',
  });
  const raw = await response.text();
  let value;
  try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
  if (!response.ok) {
    const code = value && typeof value === 'object' ? value.code ?? value.error : 'unknown';
    const message = value && typeof value === 'object' ? value.message ?? value.msg : '';
    throw new Error(`${method} ${path.split('?')[0]}: HTTP ${response.status} ${code} ${message}`);
  }
  return value;
}

async function createUser(role) {
  const email = `recovery-${role}-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString('base64url')}`;
  const response = await fetch(local.API_URL + '/auth/v1/admin/users', {
    method: 'POST',
    headers: { apikey: local.SERVICE_ROLE_KEY,
      authorization: `Bearer ${local.SERVICE_ROLE_KEY}`,
      'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true,
      user_metadata: { first_name: 'Recovery', last_name: 'QA' } }),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Local ${role} Auth creation returned HTTP ${response.status}.`);
  const user = await response.json();
  if (!/^[0-9a-f-]{36}$/.test(user.id)) throw new Error('Invalid local Auth ID.');
  if (role !== 'customer') {
    const updated = sql(`update public.profiles set role='${role}', is_active=true ` +
      `where id='${user.id}' returning id`);
    if (updated !== user.id) throw new Error(`Local ${role} profile update failed.`);
  }
  if (role === 'rider') {
    sql(`insert into public.riders (id,approval_status,availability_status) ` +
      `values ('${user.id}','approved','available')`);
  }
  const session = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  if (!session.access_token) throw new Error(`Local ${role} sign-in failed.`);
  return { id: user.id, token: session.access_token };
}

async function rpc(name, args, token) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', token, body: args });
}

function one(value, label) {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error(`${label} did not return exactly one result.`);
  }
  return value[0];
}

function expect(actual, wanted, label) {
  if (actual !== wanted) throw new Error(`${label}: expected ${wanted}, received ${actual}.`);
}

async function expectDenied(label, action) {
  let blocked = false;
  try { await action(); } catch (error) {
    if (/HTTP (400|401|403) (42501|P0001)/.test(error.message)) blocked = true;
    else throw error;
  }
  if (!blocked) throw new Error(`${label} was not denied.`);
}

const customer = await createUser('customer');
const cashier = await createUser('cashier');
const rider = await createUser('rider');
const manager = await createUser('manager');
console.log('PASS local Auth sign-in for customer, cashier, rider, and manager.');

const menuId = sql(`select m.id from public.menu_items m ` +
  `join public.get_menu_effective_availability() a on a.menu_item_id=m.id ` +
  `where a.effective_available and m.is_active and m.is_available ` +
  `order by m.id limit 1`);
if (!/^[0-9a-f-]{36}$/.test(menuId)) throw new Error('No locally available menu item.');
const orderRequest = randomUUID();
const orderArgs = { p_customer_name: 'Recovery QA', p_contact_number: '09171234567',
  p_delivery_address: 'Synthetic local test address', p_landmark: null,
  p_items: [{ id: menuId, qty: 1 }], p_request_id: orderRequest };
const order = one(await rpc('place_customer_order', orderArgs, customer.token), 'order');
expect(order.current_status, 'waiting_payment_verification', 'new order status');
const orderReplay = one(await rpc('place_customer_order', orderArgs, customer.token),
  'order idempotent replay');
expect(orderReplay.order_id, order.order_id, 'order replay ID');
console.log('PASS customer order placement and idempotent replay.');

const proofPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=',
  'base64');
const paymentPath = `${customer.id}/${order.order_id}/recovery-qa-${randomUUID()}.png`;
await request(`/storage/v1/object/payment-proofs/${paymentPath}`, {
  method: 'POST', token: customer.token, body: proofPng, contentType: 'image/png',
});
const reference = `LOCAL-QA-${randomUUID()}`;
const paymentArgs = { p_order_id: order.order_id,
  p_gcash_reference_number: reference, p_proof_image_path: paymentPath };
const payment = one(await rpc('submit_customer_payment', paymentArgs, customer.token),
  'payment');
expect(payment.status, 'pending', 'submitted payment status');
const paymentReplay = one(await rpc('submit_customer_payment', paymentArgs, customer.token),
  'payment idempotent replay');
expect(paymentReplay.payment_id, payment.payment_id, 'payment replay ID');
console.log('PASS authenticated payment proof upload, submission, and replay.');

await expectDenied('customer cashier verification', () => rpc(
  'verify_customer_gcash_payment', {
    p_request_id: randomUUID(), p_payment_id: payment.payment_id,
  }, customer.token));
console.log('PASS customer denied cashier-only verification.');

one(await rpc('start_cashier_shift', {
  p_terminal: `QA-${randomUUID().slice(0, 8)}`, p_opening_cash: 0 },
  cashier.token), 'cashier shift');
const verificationRequest = randomUUID();
const verified = one(await rpc('verify_customer_gcash_payment', {
  p_request_id: verificationRequest, p_payment_id: payment.payment_id,
}, cashier.token), 'cashier verification');
expect(verified.payment_status, 'verified', 'verified payment');
expect(verified.order_status, 'confirmed', 'confirmed order');
const verifiedReplay = one(await rpc('verify_customer_gcash_payment', {
  p_request_id: verificationRequest, p_payment_id: payment.payment_id,
}, cashier.token), 'cashier verification replay');
expect(verifiedReplay.transaction_id, verified.transaction_id, 'cashier replay transaction');
console.log('PASS cashier verification, transaction, receipt, and replay.');

const terminal = one(await rpc('provision_kds_terminal', {
  p_terminal_name: `Recovery QA ${randomUUID().slice(0, 8)}`,
}, manager.token), 'KDS terminal');
const credential = { p_terminal_id: terminal.terminal_id,
  p_terminal_secret: terminal.terminal_secret };
one(await rpc('verify_kds_terminal', credential, null), 'KDS credential');
await expectDenied('invalid KDS credential', () => rpc('verify_kds_terminal', {
  ...credential, p_terminal_secret: 'invalid-local-qa-secret',
}, null));
const queue = await rpc('get_kds_queue', credential, null);
if (!Array.isArray(queue) || !queue.some(row => row.order_id === order.order_id)) {
  throw new Error('Confirmed order was absent from authenticated KDS queue.');
}
const preparing = one(await rpc('advance_kds_order', { ...credential,
  p_order_id: order.order_id, p_expected_status: 'confirmed' }, null), 'KDS preparing');
expect(preparing.current_status, 'preparing', 'KDS preparing status');
const ready = one(await rpc('advance_kds_order', { ...credential,
  p_order_id: order.order_id, p_expected_status: 'preparing' }, null), 'KDS ready');
expect(ready.current_status, 'ready', 'KDS ready status');
console.log('PASS KDS credential, queue, preparing, and ready transitions.');

// Keep the local synthetic rider as the sole available rider during release,
// then restore every other local rider's prior available state immediately.
const sidelined = sql(`select coalesce(string_agg(id::text, ','),'') from public.riders ` +
  `where availability_status='available' and id<>'${rider.id}'`)
  .split(',').filter(Boolean);
if (!sidelined.every(id => /^[0-9a-f-]{36}$/.test(id))) {
  throw new Error('Unexpected local rider ID in the fixture.');
}
if (sidelined.length) {
  sql(`update public.riders set availability_status='offline' where id in (` +
    sidelined.map(id => `'${id}'`).join(',') + `)`);
}
let released;
try {
  released = one(await rpc('release_ready_order', {
    p_order_id: order.order_id,
  }, cashier.token), 'cashier release');
} finally {
  if (sidelined.length) {
    sql(`update public.riders set availability_status='available' where id in (` +
      sidelined.map(id => `'${id}'`).join(',') + `)`);
  }
}
expect(released.current_status, 'waiting_for_rider', 'cashier release status');
// Releasing a ready delivery may already offer it to a rider. In that case,
// calling the manual offer RPC again correctly rejects a duplicate offer.
let assignmentId = sql(`select id from public.delivery_assignments ` +
  `where order_id='${order.order_id}' and status='offered' limit 1`);
if (!assignmentId) {
  const offered = one(await rpc('offer_order_to_next_rider', {
    p_order_id: order.order_id,
  }, cashier.token), 'rider offer');
  assignmentId = offered.assignment_id;
}
if (!assignmentId) throw new Error('Rider assignment ID missing.');
const assignedRider = sql(`select rider_id from public.delivery_assignments ` +
  `where id='${assignmentId}'`);
expect(assignedRider, rider.id, 'synthetic rider assignment');
await expectDenied('customer rider acceptance', () => rpc('accept_rider_offer', {
  p_assignment_id: assignmentId,
}, customer.token));
const accepted = one(await rpc('accept_rider_offer', {
  p_assignment_id: assignmentId,
}, rider.token), 'rider acceptance');
expect(accepted.assignment_status, 'accepted', 'rider acceptance status');
const picked = one(await rpc('advance_rider_delivery', {
  p_assignment_id: assignmentId, p_expected_assignment_status: 'accepted',
}, rider.token), 'rider pickup');
expect(picked.assignment_status, 'picked_up', 'rider pickup status');
const travelling = one(await rpc('advance_rider_delivery', {
  p_assignment_id: assignmentId, p_expected_assignment_status: 'picked_up',
}, rider.token), 'rider out for delivery');
expect(travelling.assignment_status, 'out_for_delivery', 'rider transit status');
const deliveryPath = `${rider.id}/${assignmentId}/proof-${Date.now()}.png`;
await request(`/storage/v1/object/delivery-proofs/${deliveryPath}`, {
  method: 'POST', token: rider.token, body: proofPng, contentType: 'image/png',
});
const completed = one(await rpc('complete_rider_delivery', {
  p_assignment_id: assignmentId, p_proof_path: deliveryPath,
}, rider.token), 'delivery completion');
expect(completed.assignment_status, 'delivered', 'assignment delivered');
expect(completed.order_status, 'delivered', 'order delivered');
console.log('PASS cashier release, rider offer, acceptance, transit, proof, and delivery.');

const summary = sql(`select o.current_status||'|'||p.status||'|'||` +
  `(select count(*) from public.cashier_transactions c where c.order_id=o.id)||'|'||` +
  `(select count(*) from public.delivery_assignments d where d.order_id=o.id)||'|'||` +
  `(select count(*) from public.order_status_history h where h.order_id=o.id ` +
  `and h.status='delivered') from public.orders o join public.payments p ` +
  `on p.order_id=o.id where o.id='${order.order_id}'`);
expect(summary, 'delivered|verified|1|1|1', 'final database reconciliation');
console.log('PASS final same-database order, payment, cashier, assignment, and history reconciliation.');
