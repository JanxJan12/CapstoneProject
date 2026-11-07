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
const menuId = sql(`select m.id from public.menu_items m join public.get_menu_effective_availability() a on a.menu_item_id=m.id join public.menu_item_modifier_groups mg on mg.menu_item_id=m.id join public.menu_modifier_options mo on mo.group_id=mg.group_id and mo.id='extra-rice' where a.effective_available and m.is_active and m.is_available order by m.id limit 1`);
if (!menuId) throw Error('No isolated available modified menu item');
one(await rpc('start_cashier_shift', { p_terminal: `KDS-VIS-${randomUUID().slice(0, 8)}`, p_opening_cash: 0 }, cashier.token), 'Cashier shift');
const customerOrder = one(await rpc('place_customer_order', { p_request_id: randomUUID(), p_customer_name: 'Synthetic KDS visual QA', p_contact_number: '09170000000', p_delivery_address: 'Synthetic local QA address', p_landmark: null, p_items: [{ id: menuId, qty: 1, modifier_ids: ['extra-rice'] }] }, customer.token), 'Customer order');
const proof = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=', 'base64');
const paymentPath = `${customer.id}/${customerOrder.order_id}/${randomUUID()}.png`;
await request(`/storage/v1/object/payment-proofs/${paymentPath}`, { method: 'POST', token: customer.token, body: proof, contentType: 'image/png' });
const payment = one(await rpc('submit_customer_payment', { p_order_id: customerOrder.order_id, p_gcash_reference_number: `LOCAL-${randomUUID()}`, p_proof_image_path: paymentPath }, customer.token), 'Customer payment');
one(await rpc('verify_customer_gcash_payment', { p_request_id: randomUUID(), p_payment_id: payment.payment_id }, cashier.token), 'Cashier verification');
const walkIn = one(await rpc('create_walk_in_sale', { p_request_id: randomUUID(), p_fulfillment_type: 'takeout', p_customer_name: 'Synthetic walk-in visual QA', p_contact_number: null, p_payment_method: 'cash', p_cash_received: 1000, p_gcash_reference_number: null, p_items: [{ menu_item_id: menuId, quantity: 1, modifier_ids: ['extra-rice'], note: 'No onions' }] }, cashier.token), 'Walk-in');
const { writeFile } = await import('node:fs/promises');
await writeFile('qa/kds-browser-ticket-setup-20261014.json', JSON.stringify({ customerOrderId: customerOrder.order_id, customerOrderNumber: customerOrder.order_number, walkInOrderId: walkIn.order_id, walkInOrderNumber: walkIn.order_number }, null, 2));
console.log('PASS: fresh Customer and walk-in modified tickets prepared in isolated KDS queue');
