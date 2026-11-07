// Isolated recovery validation. Creates synthetic local-only rows and objects.
// This must never run against a linked or hosted Supabase project.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

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
  return { id: user.id, token: session.access_token, email, password };
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
const manager = await createUser('manager');
const rider = await createUser('rider');
const menuId = sql(`select m.id from public.menu_items m join public.get_menu_effective_availability() a on a.menu_item_id=m.id join public.menu_item_modifier_groups mg on mg.menu_item_id=m.id join public.menu_modifier_options mo on mo.group_id=mg.group_id and mo.id='extra-rice' where a.effective_available and m.is_active and m.is_available order by m.id limit 1`);
if (!menuId) throw Error('No isolated modified menu item available');
one(await rpc('start_cashier_shift', { p_terminal: `RIDER-VIS-${randomUUID().slice(0, 8)}`, p_opening_cash: 0 }, cashier.token), 'shift');
const order = one(await rpc('place_customer_order', { p_request_id: randomUUID(), p_customer_name: 'Synthetic Rider visual QA', p_contact_number: '09170000000', p_delivery_address: 'Synthetic local QA address', p_landmark: null, p_items: [{ id: menuId, qty: 1, modifier_ids: ['extra-rice'] }] }, customer.token), 'modified order');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=', 'base64');
const proofPath = `${customer.id}/${order.order_id}/${randomUUID()}.png`;
await request(`/storage/v1/object/payment-proofs/${proofPath}`, { method: 'POST', token: customer.token, body: png, contentType: 'image/png' });
const payment = one(await rpc('submit_customer_payment', { p_order_id: order.order_id, p_gcash_reference_number: `LOCAL-${randomUUID()}`, p_proof_image_path: proofPath }, customer.token), 'payment');
one(await rpc('verify_customer_gcash_payment', { p_request_id: randomUUID(), p_payment_id: payment.payment_id }, cashier.token), 'verification');
const terminal = one(await rpc('provision_kds_terminal', { p_terminal_name: `Rider visual ${randomUUID().slice(0, 8)}` }, manager.token), 'terminal');
const credential = { p_terminal_id: terminal.terminal_id, p_terminal_secret: terminal.terminal_secret };
one(await rpc('advance_kds_order', { ...credential, p_order_id: order.order_id, p_expected_status: 'confirmed' }), 'preparing');
one(await rpc('advance_kds_order', { ...credential, p_order_id: order.order_id, p_expected_status: 'preparing' }), 'ready');
const otherAvailable = sql(`select coalesce(string_agg(id::text, ','),'') from public.riders where availability_status='available' and id<>'${rider.id}'`).split(',').filter(Boolean);
if (otherAvailable.length) sql(`update public.riders set availability_status='offline' where id in (${otherAvailable.map(id => `'${id}'`).join(',')})`);
try {
  one(await rpc('release_ready_order', { p_order_id: order.order_id }, cashier.token), 'release');
  let assignmentId = sql(`select id from public.delivery_assignments where order_id='${order.order_id}' and status='offered' limit 1`);
  if (!assignmentId) assignmentId = one(await rpc('offer_order_to_next_rider', { p_order_id: order.order_id }, cashier.token), 'offer').assignment_id;
  expect(sql(`select rider_id from public.delivery_assignments where id='${assignmentId}'`), rider.id, 'visual QA assigned rider');
} finally {
  if (otherAvailable.length) sql(`update public.riders set availability_status='available' where id in (${otherAvailable.map(id => `'${id}'`).join(',')})`);
}
const base = 'http://127.0.0.1:58434';
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'qa/rider-web-browser-20261013/vite.local.mjs', '--host', '127.0.0.1'], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: local.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY } });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
for (let i=0;i<100;i++) { try { if ((await fetch(`${base}/qa/rider-web-browser-20261013/local-login.html`)).ok) break; } catch {} if(i===99) throw Error('Local Rider browser unavailable'); await pause(150); }
const profile = await mkdtemp(join(tmpdir(), 'rrj-rider-modified-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1440,900', `${base}/qa/rider-web-browser-20261013/local-login.html`], { windowsHide: true, stdio: 'ignore' });
const out = resolve('qa/rider-modified-browser-20261014');
await mkdir(out, { recursive: true });
let ws; let seq=0; const pending = new Map();
const command = (method, params={}) => new Promise((resolveTask,reject) => { const id=++seq; pending.set(id,{resolve:resolveTask,reject}); ws.send(JSON.stringify({id,method,params})); });
const evaluate = async expression => { const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(result.exceptionDetails)throw Error(result.exceptionDetails.text); return result.result.value; };
async function waitFor(expression,label) { for(let i=0;i<300;i++){if(await evaluate(expression))return;await pause(150);} throw Error(`Timed out ${label}: ${JSON.stringify(await evaluate('document.body.innerText.slice(0,900)'))}`); }
async function shot(name) { const capture=await command('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(join(out,`${name}.png`),Buffer.from(capture.data,'base64')); }
try {
  let port; for(let i=0;i<80;i++){try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);break;}catch{await pause(100);}}
  if(!port)throw Error('Chrome debugger unavailable');
  const tabs=await fetch(`http://127.0.0.1:${port}/json`).then(response=>response.json());
  const tab=tabs.find(entry=>entry.type==='page'&&entry.url.startsWith(base));
  if(!tab)throw Error('Local Rider tab unavailable');
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);const task=pending.get(message.id);if(!task)return;pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);});
  await new Promise((resolveOpen,reject)=>{ws.addEventListener('open',resolveOpen,{once:true});ws.addEventListener('error',reject,{once:true});});
  await command('Page.enable');await command('Runtime.enable');
  await waitFor('window.riderQaLoginReady === true','local login');
  await evaluate(`(() => {document.querySelector('input[name=email]').value=${JSON.stringify(rider.email)};document.querySelector('input[name=password]').value=${JSON.stringify(rider.password)};document.querySelector('#login button').click();})()`);
  await waitFor("location.pathname==='/rider' && document.body.innerText.includes('Review Delivery Offer')",'assigned Rider Home');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Review Delivery Offer'))?.click()");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(order.order_number)}) && document.body.innerText.includes('Extra rice')`,'assigned modified offer');
  for(const [name,width,height] of [['mobile',390,844],['tablet',768,1024],['desktop',1440,900]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});await pause(250);
    const size=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})');
    if(size.width!==width||size.scrollWidth>width+1)throw Error(`${name} overflow: ${JSON.stringify(size)}`);
    await evaluate(`document.querySelector('.rider-offer-card')?.scrollIntoView({block:'start'})`);await shot(`${name}-modified-offer`);
  }
  await writeFile(join(out,'result.json'),JSON.stringify({status:'PASS',orderNumber:order.order_number,checks:['Authenticated assigned Rider opened fresh modified offer','Extra rice purchase-time snapshot displayed','Three responsive viewports without document overflow'],screenshots:['mobile-modified-offer.png','tablet-modified-offer.png','desktop-modified-offer.png']},null,2));
  console.log('PASS: assigned modified Rider offer rendered in three isolated browser viewports');
} finally {ws?.close();chrome.kill();vite.kill();}
