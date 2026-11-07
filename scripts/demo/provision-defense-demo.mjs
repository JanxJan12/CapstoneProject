import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const slot = Number(process.env.RRJ_DEMO_SLOT || '1');
if (![1, 2, 3].includes(slot)) throw new Error('Demo slot must be 1, 2, or 3.');
const runtime = join(repo, '.tmp', `defense-demo-20261014${slot === 1 ? '' : `-r${slot}`}`);
const db = `supabase_db_rrj_defense_demo_20261014${slot === 1 ? '' : `_r${slot}`}`;
const expectedUrl = `http://127.0.0.1:${{1:'613',2:'623',3:'633'}[slot]}21`;
const privateFile = join(runtime, 'role-accounts.private.json');
const snapshot = join(runtime, 'before-demo-data.dump');
const manifest = join(runtime, 'demo-fixture-manifest.private.json');
mkdirSync(runtime, { recursive: true });

function run(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024, shell: exe === 'npx.cmd', ...options });
  if (result.status !== 0) throw new Error(`${exe} failed: ${(result.stderr || '').slice(0, 180)}`);
  return result.stdout.trim();
}
const status = JSON.parse(run('npx.cmd', ['--yes', 'supabase@2.120.0', 'status', '--workdir', `"${runtime}"`, '-o', 'json']));
if (status.API_URL !== expectedUrl || !status.SERVICE_ROLE_KEY || !status.ANON_KEY) throw new Error('Wrong or unavailable isolated demo stack.');
if (run('docker', ['inspect', '--format', '{{.State.Running}}', db]) !== 'true') throw new Error('Wrong demo database container.');
function sql(query) { return run('docker', ['exec', '-u', 'postgres', db, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', query]); }
if (sql('select count(*) from supabase_migrations.schema_migrations') !== '52') throw new Error('Demo migration count is not 52.');
if (sql('select count(*) from auth.users') !== '0' && !existsSync(privateFile)) throw new Error('Unexpected users predate the private demo account card.');

if (!existsSync(snapshot)) {
  run('docker', ['exec', '-u', 'postgres', db, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc', '-f', '/tmp/defense-before-demo.dump']);
  run('docker', ['cp', `${db}:/tmp/defense-before-demo.dump`, snapshot]);
}

const accounts = existsSync(privateFile) ? JSON.parse(readFileSync(privateFile, 'utf8')) : { schemaVersion: 1, environment: 'isolated-defense-demo', roles: {}, terminal: null };
function save() { writeFileSync(privateFile, JSON.stringify(accounts, null, 2), { mode: 0o600 }); }
async function request(path, method, key, body) {
  const response = await fetch(expectedUrl + path, { method, redirect: 'error', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${value?.code ?? value?.error ?? ''} ${value?.message ?? ''}`);
  return value;
}
async function signIn(role) {
  const account = accounts.roles[role];
  const result = await request('/auth/v1/token?grant_type=password', 'POST', status.ANON_KEY, { email: account.email, password: account.password });
  if (!result.access_token || result.user?.id !== account.id) throw new Error(`${role} demo Auth sign-in failed.`);
  return result.access_token;
}
for (const role of ['customer', 'manager', 'cashier', 'rider']) {
  if (!accounts.roles[role]) {
    const email = `defense-${role}@example.invalid`;
    const password = `Aa1!${randomBytes(24).toString('base64url')}`;
    const user = await request('/auth/v1/admin/users', 'POST', status.SERVICE_ROLE_KEY, { email, password, email_confirm: true, user_metadata: { first_name: 'Defense', last_name: role } });
    accounts.roles[role] = { id: user.id, email, password };
    save();
    if (role !== 'customer') sql(`update public.profiles set role='${role}', is_active=true where id='${user.id}'`);
    if (role === 'rider') sql(`insert into public.riders (id,approval_status,availability_status) values ('${user.id}','approved','available') on conflict (id) do nothing`);
  }
  if (role === 'rider' && /[^A-Za-z0-9]/.test(accounts.roles[role].password)) {
    // Android emulator `adb input text` reliably types alphanumeric credentials.
    const password = `Aa1${randomBytes(20).toString('hex')}`;
    await request(`/auth/v1/admin/users/${accounts.roles[role].id}`, 'PUT', status.SERVICE_ROLE_KEY, { password });
    accounts.roles[role].password = password;
    save();
  }
  await signIn(role);
  if (sql(`select role::text from public.profiles where id='${accounts.roles[role].id}'`) !== role) throw new Error(`${role} profile mismatch.`);
}

for (const bucket of ['payment-proofs', 'delivery-proofs']) {
  if (sql(`select count(*) from storage.buckets where id='${bucket}'`) === '0') await request('/storage/v1/bucket', 'POST', status.SERVICE_ROLE_KEY, { id: bucket, name: bucket, public: false });
  if (sql(`select public::text from storage.buckets where id='${bucket}'`) !== 'false') throw new Error(`${bucket} is public.`);
}

sql(`insert into public.menu_modifier_groups (id,name,selection_type,min_selections,max_selections,is_active) values ('demo-addons','Demo add-ons','multiple',0,1,true) on conflict (id) do nothing`);
sql(`insert into public.menu_modifier_options (id,group_id,name,price_adjustment,sort_order,is_active) values ('extra-rice','demo-addons','Extra rice',35,1,true) on conflict (id) do nothing`);
const menuId = sql(`select id from public.menu_items where name='Fried Chicken Regular' limit 1`);
if (!/^[0-9a-f-]{36}$/.test(menuId)) throw new Error('Synthetic menu item missing.');
sql(`insert into public.menu_item_modifier_groups (menu_item_id,group_id,sort_order) values ('${menuId}','demo-addons',10) on conflict do nothing`);
const menuInfo = sql(`select name from public.menu_items where id='${menuId}'`);

function stableUuid(text) { const h = createHash('sha1').update(text).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; }
const managerToken = await signIn('manager');
const itemRows = JSON.parse(sql(`select coalesce(json_agg(json_build_object('id',id,'expiry',expiry_required,'shelf',shelf_life_days) order by id),'[]'::json)::text from public.inventory_items where is_active and batch_consumption_enabled`));
for (const item of itemRows) {
  const id = item.id;
  if (sql(`select count(*) from public.inventory_opening_balances where inventory_item_id='${id}'`) !== '0') continue;
  // Later scenario tests may add their own batch-managed item and stock history.
  // Provisioning must never reopen or overwrite that item's first stock event.
  if (sql(`select count(*) from public.inventory_transactions where inventory_item_id='${id}'`) !== '0') continue;
  const requestId = stableUuid(`rrj-defense-demo-opening:${id}`);
  const batch = { quantity: 100, received_at: new Date().toISOString(), source_lot_code: `DEMO-${id.slice(0,8)}`, notes: 'Fictional defense sample stock' };
  if (item.expiry && !item.shelf) batch.use_by_date = '2027-12-31';
  const result = await request('/rest/v1/rpc/initialize_inventory_opening_balance', 'POST', managerToken, {
    p_inventory_item_id: id,
    p_batches: [batch],
    p_notes: 'FICTIONAL DEFENSE SAMPLE; not a restaurant physical count', p_request_id: requestId,
  });
  if (!result?.opening_balance_id || Number(result.quantity_total) !== 100) throw new Error('Demo opening result mismatch.');
}

if (!accounts.terminal) {
  const result = await request('/rest/v1/rpc/provision_kds_terminal', 'POST', managerToken, { p_terminal_name: 'Defense demo KDS' });
  if (!Array.isArray(result) || !result[0]?.terminal_secret) throw new Error('KDS credential provisioning failed.');
  accounts.terminal = { id: result[0].terminal_id, secret: result[0].terminal_secret };
  save();
}
const terminal = await request('/rest/v1/rpc/verify_kds_terminal', 'POST', status.ANON_KEY, { p_terminal_id: accounts.terminal.id, p_terminal_secret: accounts.terminal.secret });
if (!Array.isArray(terminal) || terminal[0]?.terminal_id !== accounts.terminal.id) throw new Error('Demo KDS terminal verification failed.');

const summary = { environment: 'isolated-defense-demo', api: expectedUrl, menuId, menuName: menuInfo, roleCount: Object.keys(accounts.roles).length, inventoryItems: itemRows.length, bucketCount: 2, terminalVerified: true, snapshotSha256: createHash('sha256').update(readFileSync(snapshot)).digest('hex'), limitation: 'All quantities and accounts are synthetic. No historical restaurant baseline.' };
writeFileSync(manifest, JSON.stringify(summary, null, 2), { mode: 0o600 });
process.stdout.write(`PASS: demo roles=${summary.roleCount}, stock items=${summary.inventoryItems}, private buckets=${summary.bucketCount}, KDS terminal verified. Private card: ${privateFile}\n`);
