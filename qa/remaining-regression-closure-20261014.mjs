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

const checks = [];
const customer = await createUser('customer');
const cashier = await createUser('cashier');
const manager = await createUser('manager');
const rider = await createUser('rider');
const menuId = sql(`select m.id from public.menu_items m join public.get_menu_effective_availability() a on a.menu_item_id=m.id join public.menu_item_modifier_groups mg on mg.menu_item_id=m.id join public.menu_modifier_options mo on mo.group_id=mg.group_id and mo.id='extra-rice' where a.effective_available and m.is_active and m.is_available order by m.id limit 1`);
if (!/^[0-9a-f-]{36}$/.test(menuId)) throw Error('No locally available Extra rice menu item');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=', 'base64');
async function makeModifiedOrder(label) {
  const placed = one(await rpc('place_customer_order', {
    p_request_id: randomUUID(), p_customer_name: `Local ${label}`,
    p_contact_number: '09170000000', p_delivery_address: 'Synthetic local QA address',
    p_landmark: 'Synthetic', p_items: [{ id: menuId, qty: 1, modifier_ids: ['extra-rice'] }],
  }, customer.token), `${label} order`);
  const path = `${customer.id}/${placed.order_id}/${randomUUID()}.png`;
  await request(`/storage/v1/object/payment-proofs/${path}`, { method: 'POST', token: customer.token, body: png, contentType: 'image/png' });
  const payment = one(await rpc('submit_customer_payment', {
    p_order_id: placed.order_id, p_gcash_reference_number: `LOCAL-${randomUUID()}`,
    p_proof_image_path: path,
  }, customer.token), `${label} payment`);
  return { placed, payment };
}
const shift = one(await rpc('start_cashier_shift', { p_terminal: `REG-${randomUUID().slice(0, 8)}`, p_opening_cash: 0 }, cashier.token), 'shift');
const primary = await makeModifiedOrder('KDS completion');
await expectDenied('customer payment verification', () => rpc('verify_customer_gcash_payment', { p_request_id: randomUUID(), p_payment_id: primary.payment.payment_id }, customer.token));
const verified = one(await rpc('verify_customer_gcash_payment', { p_request_id: randomUUID(), p_payment_id: primary.payment.payment_id }, cashier.token), 'verification');
expect(verified.order_status, 'confirmed', 'confirmed modified customer order');
const stored = JSON.parse(sql(`select modifiers::text from public.order_items where order_id='${primary.placed.order_id}' limit 1`));
if (stored.length !== 1 || stored[0].name !== 'Extra rice') throw Error('Customer purchase-time snapshot missing');
checks.push('New modified Customer order, private synthetic proof, role denial, Cashier verification, authoritative snapshot');

const terminal = one(await rpc('provision_kds_terminal', { p_terminal_name: `Closure ${randomUUID().slice(0, 8)}` }, manager.token), 'terminal');
const credential = { p_terminal_id: terminal.terminal_id, p_terminal_secret: terminal.terminal_secret };
await expectDenied('invalid KDS secret', () => rpc('get_kds_queue_v2', { ...credential, p_terminal_secret: 'invalid-local-secret' }));
const customerTicket = (await rpc('get_kds_queue_v2', credential)).find(row => row.order_id === primary.placed.order_id);
if (!customerTicket || customerTicket.order_channel !== 'online' || customerTicket.items[0].modifiers[0].name !== stored[0].name || Number(customerTicket.items[0].modifiers[0].price) !== Number(stored[0].price)) throw Error('KDS Customer snapshot/channel mismatch');
const preparing = one(await rpc('advance_kds_order', { ...credential, p_order_id: primary.placed.order_id, p_expected_status: 'confirmed' }), 'preparing');
expect(preparing.current_status, 'preparing', 'KDS preparing');
await expectDenied('duplicate KDS advance', () => rpc('advance_kds_order', { ...credential, p_order_id: primary.placed.order_id, p_expected_status: 'confirmed' }));
const ready = one(await rpc('advance_kds_order', { ...credential, p_order_id: primary.placed.order_id, p_expected_status: 'preparing' }), 'ready');
expect(ready.current_status, 'ready', 'KDS ready');
checks.push('KDS v2 modifier price/channel, invalid secret, preparing/ready, duplicate denial');

const sidelined = sql(`select coalesce(string_agg(id::text, ','),'') from public.riders where availability_status='available' and id<>'${rider.id}'`).split(',').filter(Boolean);
if (sidelined.length) sql(`update public.riders set availability_status='offline' where id in (${sidelined.map(id => `'${id}'`).join(',')})`);
try {
  const released = one(await rpc('release_ready_order', { p_order_id: primary.placed.order_id }, cashier.token), 'release');
  expect(released.current_status, 'waiting_for_rider', 'rider release');
  let assignmentId = sql(`select id from public.delivery_assignments where order_id='${primary.placed.order_id}' and status='offered' limit 1`);
  if (!assignmentId) assignmentId = one(await rpc('offer_order_to_next_rider', { p_order_id: primary.placed.order_id }, cashier.token), 'offer').assignment_id;
  expect(sql(`select rider_id from public.delivery_assignments where id='${assignmentId}'`), rider.id, 'assigned rider');
  const riderItems = await request(`/rest/v1/order_items?select=modifiers&order_id=eq.${primary.placed.order_id}`, { token: rider.token });
  if (!riderItems.some(item => item.modifiers?.[0]?.name === 'Extra rice')) throw Error('Assigned Rider cannot read modifier snapshot');
  one(await rpc('accept_rider_offer', { p_assignment_id: assignmentId }, rider.token), 'accept');
  one(await rpc('advance_rider_delivery', { p_assignment_id: assignmentId, p_expected_assignment_status: 'accepted' }, rider.token), 'pickup');
  one(await rpc('advance_rider_delivery', { p_assignment_id: assignmentId, p_expected_assignment_status: 'picked_up' }, rider.token), 'transit');
  const proofPath = `${rider.id}/${assignmentId}/${randomUUID()}.png`;
  await request(`/storage/v1/object/delivery-proofs/${proofPath}`, { method: 'POST', token: rider.token, body: png, contentType: 'image/png' });
  const delivered = one(await rpc('complete_rider_delivery', { p_assignment_id: assignmentId, p_proof_path: proofPath }, rider.token), 'delivered');
  expect(delivered.order_status, 'delivered', 'final order');
  checks.push('Rider assigned-order RLS, private proof upload, delivered same Customer order');
} finally {
  if (sidelined.length) sql(`update public.riders set availability_status='available' where id in (${sidelined.map(id => `'${id}'`).join(',')})`);
}

const refusedOrder = await makeModifiedOrder('Rider offer rejection');
one(await rpc('verify_customer_gcash_payment', { p_request_id: randomUUID(), p_payment_id: refusedOrder.payment.payment_id }, cashier.token), 'second verification');
one(await rpc('advance_kds_order', { ...credential, p_order_id: refusedOrder.placed.order_id, p_expected_status: 'confirmed' }), 'second preparing');
one(await rpc('advance_kds_order', { ...credential, p_order_id: refusedOrder.placed.order_id, p_expected_status: 'preparing' }), 'second ready');
const otherAvailable = sql(`select coalesce(string_agg(id::text, ','),'') from public.riders where availability_status='available' and id<>'${rider.id}'`).split(',').filter(Boolean);
if (otherAvailable.length) sql(`update public.riders set availability_status='offline' where id in (${otherAvailable.map(id => `'${id}'`).join(',')})`);
try {
  one(await rpc('release_ready_order', { p_order_id: refusedOrder.placed.order_id }, cashier.token), 'second release');
  let refusedAssignment = sql(`select id from public.delivery_assignments where order_id='${refusedOrder.placed.order_id}' and status='offered' limit 1`);
  if (!refusedAssignment) refusedAssignment = one(await rpc('offer_order_to_next_rider', { p_order_id: refusedOrder.placed.order_id }, cashier.token), 'second offer').assignment_id;
  expect(sql(`select rider_id from public.delivery_assignments where id='${refusedAssignment}'`), rider.id, 'rejection assigned rider');
  await expectDenied('customer Rider offer rejection', () => rpc('reject_rider_offer', { p_assignment_id: refusedAssignment, p_reason: 'Synthetic QA refusal' }, customer.token));
  const refusal = one(await rpc('reject_rider_offer', { p_assignment_id: refusedAssignment, p_reason: 'Synthetic QA refusal' }, rider.token), 'offer rejection');
  expect(refusal.assignment_status, 'rejected', 'offer rejection status');
  await expectDenied('duplicate Rider rejection', () => rpc('reject_rider_offer', { p_assignment_id: refusedAssignment, p_reason: 'Duplicate QA refusal' }, rider.token));
  checks.push('Fresh modified order Rider offer rejection, customer role denial, duplicate denial');
} finally {
  if (otherAvailable.length) sql(`update public.riders set availability_status='available' where id in (${otherAvailable.map(id => `'${id}'`).join(',')})`);
}

const sale = one(await rpc('create_walk_in_sale', {
  p_request_id: randomUUID(), p_fulfillment_type: 'takeout', p_customer_name: 'Local modified walk-in',
  p_contact_number: null,
  p_payment_method: 'cash', p_cash_received: 1000,
  p_gcash_reference_number: null, p_items: [{ menu_item_id: menuId, quantity: 1, modifier_ids: ['extra-rice'], note: 'No onions' }],
}, cashier.token), 'walk-in sale');
const saleTicket = (await rpc('get_kds_queue_v2', credential)).find(row => row.order_id === sale.order_id);
if (!saleTicket || saleTicket.order_channel !== 'walk_in' || saleTicket.items[0].modifiers[0].name !== 'Extra rice' || saleTicket.items[0].special_instructions !== 'No onions') throw Error('Walk-in KDS snapshot/channel/instruction mismatch');
if (!sale.receipt_number || Number(sale.grand_total) !== Number(saleTicket.items[0].unit_price)) throw Error('Receipt/price reconciliation failed');
checks.push('New modified walk-in sale, KDS channel/option/instruction, receipt and server price reconciliation');

const rejectedOrder = await makeModifiedOrder('GCash rejection');
await expectDenied('customer GCash rejection', () => rpc('reject_customer_gcash_payment', { p_payment_id: rejectedOrder.payment.payment_id, p_reason: 'Unreadable Proof', p_notes: 'Synthetic local QA' }, customer.token));
const rejected = one(await rpc('reject_customer_gcash_payment', { p_payment_id: rejectedOrder.payment.payment_id, p_reason: 'Unreadable Proof', p_notes: 'Synthetic local QA' }, cashier.token), 'GCash rejection');
expect(rejected.payment_status, 'rejected', 'rejected payment');
checks.push('Cashier GCash rejection and customer role denial on new local order');

const closed = one(await rpc('close_cashier_shift', { p_actual_cash: Number(sale.grand_total), p_variance_reason: null, p_notes: 'Synthetic local reconciliation' }, cashier.token), 'shift close');
expect(closed.status, 'closed', 'closed shift');
if (Number(closed.variance) !== 0 || Number(closed.cash_sales) !== Number(sale.grand_total) || Number(closed.gcash_sales) !== Number(primary.placed.grand_total) + Number(refusedOrder.placed.grand_total)) throw Error('Shift cash/GCash reconciliation mismatch');
checks.push('Shift close reconciled cash drawer and separate verified GCash sales with zero variance');

const evidence = { status: 'PASS', customerOrder: primary.placed.order_number, walkInOrder: sale.order_number, riderRejectedOrder: refusedOrder.placed.order_number,
  rejectedOrder: rejectedOrder.placed.order_number, checks,
  boundary: 'Isolated unlinked local Supabase only; no hosted, real GCash, or physical device actions.' };
const { writeFile } = await import('node:fs/promises');
await writeFile('qa/remaining-regression-closure-20261014.json', JSON.stringify(evidence, null, 2));
console.log(`PASS: ${checks.length} new isolated integration/regression groups`);
