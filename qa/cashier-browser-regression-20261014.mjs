// Fresh synthetic Cashier browser actions against the preserved isolated loopback stack.
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

const stack = path.join(process.env.LOCALAPPDATA ?? "", "RRJ-Private-Backups", "rehearsal-20261013", "isolated-stack");
const result = spawnSync("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", stack, "-o", "json"], { shell: true, encoding: "utf8", windowsHide: true });
if (result.status !== 0) throw Error("Isolated stack unavailable");
const local = JSON.parse(result.stdout);
if (local.API_URL !== "http://127.0.0.1:56321") throw Error("Refusing non-isolated API");
const db = "supabase_db_isolated-stack";
if (spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", db], { encoding: "utf8" }).stdout.trim() !== "true") throw Error("Isolated database unavailable");
const sql = statement => {
  const r = spawnSync("docker", ["exec", "-u", "postgres", db, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", statement], { encoding: "utf8" });
  if (r.status !== 0) throw Error(r.stderr.trim());
  return r.stdout.trim();
};
const email = `cashier-browser-${randomUUID()}@example.invalid`;
const password = `Aa1!${randomBytes(24).toString("base64url")}`;
const created = await fetch(`${local.API_URL}/auth/v1/admin/users`, {
  method: "POST", redirect: "error",
  headers: { apikey: local.SERVICE_ROLE_KEY, authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, "content-type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { first_name: "Cashier", last_name: "QA" } }),
});
if (!created.ok) throw Error(`Local Auth creation failed: HTTP ${created.status}`);
const user = await created.json();
sql(`update public.profiles set role='cashier',is_active=true where id='${user.id}'`);
const pubHeaders = token => ({ apikey: local.PUBLISHABLE_KEY, authorization: `Bearer ${token ?? local.PUBLISHABLE_KEY}`, "content-type": "application/json" });
const api = async (url, { method = 'POST', token, body, type } = {}) => {
  const response = await fetch(`${local.API_URL}${url}`, { method, redirect: 'error', headers: type ? { apikey: local.PUBLISHABLE_KEY, authorization: `Bearer ${token}`, 'content-type': type } : pubHeaders(token), body: body === undefined ? undefined : type ? body : JSON.stringify(body) });
  const raw = await response.text(); let value; try { value = JSON.parse(raw); } catch { value = raw; }
  if (!response.ok) throw Error(`Local ${url} HTTP ${response.status}: ${value?.message ?? ''}`);
  return value;
};
const cashierToken = (await api('/auth/v1/token?grant_type=password', { body: { email, password } })).access_token;
const customerEmail = `cashier-action-${randomUUID()}@example.invalid`;
const customerPassword = `Aa1!${randomBytes(24).toString('base64url')}`;
const customerResponse = await fetch(`${local.API_URL}/auth/v1/admin/users`, { method: 'POST', redirect: 'error', headers: { apikey: local.SERVICE_ROLE_KEY, authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ email: customerEmail, password: customerPassword, email_confirm: true }) });
if (!customerResponse.ok) throw Error('Local Customer Auth creation failed');
const customer = await customerResponse.json();
const customerToken = (await api('/auth/v1/token?grant_type=password', { body: { email: customerEmail, password: customerPassword } })).access_token;
const menuId = sql(`select m.id from public.menu_items m join public.get_menu_effective_availability() a on a.menu_item_id=m.id join public.menu_item_modifier_groups mg on mg.menu_item_id=m.id join public.menu_modifier_options mo on mo.group_id=mg.group_id and mo.id='extra-rice' where a.effective_available and m.is_active and m.is_available order by m.id limit 1`);
if (!menuId) throw Error('Local modified menu item unavailable');
await api('/rest/v1/rpc/start_cashier_shift', { token: cashierToken, body: { p_terminal: `BROWSER-${randomUUID().slice(0, 8)}`, p_opening_cash: 0 } });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=', 'base64');
const pendingOrders = [];
for (const label of ['verify', 'reject']) {
  const placed = (await api('/rest/v1/rpc/place_customer_order', { token: customerToken, body: { p_request_id: randomUUID(), p_customer_name: `Synthetic browser ${label}`, p_contact_number: '09170000000', p_delivery_address: 'Synthetic local address', p_landmark: null, p_items: [{ id: menuId, qty: 1, modifier_ids: ['extra-rice'] }] } }))[0];
  const proofPath = `${customer.id}/${placed.order_id}/${randomUUID()}.png`;
  await api(`/storage/v1/object/payment-proofs/${proofPath}`, { token: customerToken, body: png, type: 'image/png' });
  const payment = (await api('/rest/v1/rpc/submit_customer_payment', { token: customerToken, body: { p_order_id: placed.order_id, p_gcash_reference_number: `LOCAL-${randomUUID()}`, p_proof_image_path: proofPath } }))[0];
  pendingOrders.push({ ...placed, paymentId: payment.payment_id });
}
const base = "http://127.0.0.1:58432";
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "qa/cashier-browser-20261013/vite.local.mjs", "--host", "127.0.0.1"], {
  cwd: process.cwd(), windowsHide: true, stdio: "ignore",
  env: { ...process.env, VITE_SUPABASE_URL: local.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY },
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(`${base}/qa/cashier-browser-20261013/local-login.html`)).ok) break; } catch {}
  if (i === 99) throw Error("Local browser server unavailable");
  await pause(150);
}
const profile = await mkdtemp(path.join(tmpdir(), "rrj-cashier-browser-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1440,900", `${base}/qa/cashier-browser-20261013/local-login.html`,
], { windowsHide: true, stdio: "ignore" });
const out = path.resolve("qa/cashier-browser-regression-20261014");
await mkdir(out, { recursive: true });
let ws, seq = 0;
const pending = new Map(), checks = [];
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  let r;
  try { r = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); }
  catch (error) { throw Error(`${error.message} while evaluating ${expression.slice(0, 180)}`); }
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
  return r.result.value;
};
async function waitFor(expression, label) {
  for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await pause(150); }
  throw Error(`Timed out ${label}: ${JSON.stringify(await evaluate("document.body.innerText.slice(0,1000)"))}`);
}
async function shot(name) {
  const capture = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(out, `${name}.png`), Buffer.from(capture.data, "base64"));
}
try {
  let port;
  for (let i = 0; i < 80; i++) { try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]); break; } catch { await pause(100); } }
  if (!port) throw Error("Chrome debugger unavailable");
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
  const tab = tabs.find(entry => entry.type === "page" && entry.url.startsWith(base));
  if (!tab) throw Error("Local Cashier tab unavailable");
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  ws.addEventListener("message", event => { const message = JSON.parse(event.data); const task = pending.get(message.id); if (!task) return; pending.delete(message.id); message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result); });
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
  await waitFor("window.cashierQaLoginReady === true", "local login");
  await evaluate(`(() => { document.querySelector('input[name=email]').value=${JSON.stringify(email)}; document.querySelector('input[name=password]').value=${JSON.stringify(password)}; document.querySelector('#login button').click(); })()`);
  await waitFor("location.pathname==='/cashier' && document.body.innerText.includes('Cashier')", "authenticated Cashier route");
  await waitFor("document.body.innerText.includes('Walk-in POS')", "Cashier navigation");
  checks.push("Authenticated isolated Cashier route and navigation loaded");
  for (const [name, width, height] of [["mobile", 390, 844], ["tablet", 768, 1024], ["desktop", 1440, 900]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await pause(250);
    const size = await evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})");
    if (size.width !== width || size.scrollWidth > width + 1) throw Error(`${name} overflow: ${JSON.stringify(size)}`);
    await shot(`${name}-dashboard`);
    checks.push(`${name} ${width}x${height} dashboard without document overflow`);
  }
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'F3',bubbles:true}))");
  await waitFor("document.body.innerText.includes('Pending Payments') && Boolean(document.querySelector('[aria-label=\"Pending payments\"]'))", "Cashier pending payments");
  const selectPayment = number => evaluate(`(() => { const button=[...document.querySelectorAll('[aria-label="Pending payments"] button')].find(b=>b.textContent?.includes(${JSON.stringify(number)})); if(!button)return false;button.click();return true;})()`);
  if (!await selectPayment(pendingOrders[0].order_number)) throw Error('Fresh payment verification row absent');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(pendingOrders[0].order_number)}) && document.body.innerText.includes('Extra rice')`, "modified payment detail");
  await shot('desktop-pending-modified');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Verify payment')?.click()");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`Verify ${pendingOrders[0].order_number}?`)})`, "verification dialog");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Confirm verification')?.click()");
  for (let i=0;i<100 && sql(`select status from public.payments where id='${pendingOrders[0].paymentId}'`) !== 'verified';i++) await pause(150);
  if (sql(`select status from public.payments where id='${pendingOrders[0].paymentId}'`) !== 'verified') throw Error('Browser payment verification did not persist');
  let staleVerificationDenied = false;
  try { await api('/rest/v1/rpc/verify_customer_gcash_payment', { token: cashierToken, body: { p_request_id: randomUUID(), p_payment_id: pendingOrders[0].paymentId } }); }
  catch { staleVerificationDenied = true; }
  if (!staleVerificationDenied) throw Error('Stale second payment verification accepted');
  checks.push('Browser selected modified order and confirmed Cashier GCash verification');
  if (!await selectPayment(pendingOrders[1].order_number)) throw Error('Fresh payment rejection row absent');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Reject payment')?.click()");
  await waitFor("Boolean(document.getElementById('rejection-reason'))", "rejection dialog");
  const reasonSet = await evaluate("(() => { const e=document.getElementById('rejection-reason'); if(!e)return false; e.value='Unreadable Proof';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  if (!reasonSet) throw Error('Rejection reason unavailable');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Confirm rejection')?.click()");
  for (let i=0;i<100 && sql(`select status from public.payments where id='${pendingOrders[1].paymentId}'`) !== 'rejected';i++) await pause(150);
  if (sql(`select status from public.payments where id='${pendingOrders[1].paymentId}'`) !== 'rejected') throw Error('Browser payment rejection did not persist');
  let staleRejectionDenied = false;
  try { await api('/rest/v1/rpc/reject_customer_gcash_payment', { token: cashierToken, body: { p_payment_id: pendingOrders[1].paymentId, p_reason: 'Unreadable Proof' } }); }
  catch { staleRejectionDenied = true; }
  if (!staleRejectionDenied) throw Error('Stale second payment rejection accepted');
  checks.push('Browser rejected separate synthetic GCash proof with reason');
  checks.push('Server denied stale repeat verification and rejection after browser actions');
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'F1',bubbles:true}))");
  await waitFor("document.body.innerText.includes('Reprint Receipt')", "dashboard receipt action");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Reprint Receipt'))?.click()");
  await waitFor("document.body.innerText.includes('Recent printable transactions')", "receipt chooser");
  const receiptSelected = await evaluate(`(() => { const b=[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent?.includes(${JSON.stringify(pendingOrders[0].order_number)})); if(!b)return false;b.click();return true;})()`);
  if (!receiptSelected) throw Error('Verified modified receipt absent from chooser');
  await waitFor("document.body.innerText.includes('Receipt preview')", "receipt preview");
  await shot('desktop-receipt-preview');
  checks.push('Browser opened verified transaction receipt preview; OS print remains untested');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Close receipt')?.click()");
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'F7',bubbles:true}))");
  await waitFor("document.body.innerText.includes('Shift Settlement') && document.body.innerText.includes('Shift closure blocked')", "shift closure presentation");
  await shot('desktop-shift-closure-blocked');
  checks.push('Shift screen truthfully blocked closure while unrelated synthetic payments remain pending');
  const navigated = await evaluate("(() => { window.dispatchEvent(new KeyboardEvent('keydown',{key:'F2',bubbles:true})); return true; })()");
  if (!navigated) throw Error("Walk-in POS navigation unavailable");
  await waitFor("document.body.innerText.includes('Dine-in') && document.body.innerText.includes('Take-out')", "POS order type gate");
  await shot("desktop-pos-gate");
  checks.push("POS gate rendered with actual order types");
  const choseType = await evaluate("(() => { const b=[...document.querySelectorAll('button')].find(e=>e.textContent?.includes('Dine-in') && e.getClientRects().length); if(!b)return false;b.click();return true;})()");
  if (!choseType) throw Error("Dine-in choice unavailable");
  await waitFor("document.querySelectorAll('.pos-menu-item-card').length>0", "POS catalog");
  await shot("desktop-pos-menu");
  checks.push("Server catalog rendered in authenticated POS");
  const customized = await evaluate("(() => { const b=[...document.querySelectorAll('.pos-menu-customize')].find(e=>e.getClientRects().length); if(!b)return false;b.click();return true;})()");
  if (!customized) throw Error("Catalog item customization unavailable");
  await waitFor("document.querySelector('[data-state=customize]') && document.querySelectorAll('.pos-modifier-option').length>0", "catalog customization");
  await shot("desktop-pos-modifiers");
  checks.push("Server-backed modifier options rendered in POS drawer");
  const selectedOption = await evaluate("(() => { const b=[...document.querySelectorAll('.pos-modifier-option')].find(e=>e.textContent?.includes('Extra rice')) ?? [...document.querySelectorAll('.pos-modifier-option')].find(e=>e.getAttribute('aria-pressed')==='false'); if(!b)return null; if(b.getAttribute('aria-pressed')!=='true')b.click(); return b.textContent?.trim(); })()");
  if (!selectedOption) throw Error('No selectable modifier available for browser POS sale');
  const noted = await evaluate("(() => { const e=document.getElementById('pos-custom-item-note');if(!e)return false;const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(e,'Synthetic browser POS note');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
  if (!noted) throw Error('POS item note unavailable');
  await evaluate("document.querySelector('.pos-side-drawer .pos-place-order')?.click()");
  await waitFor("document.querySelector('[data-transaction-state=ordering]') && !document.querySelector('.pos-side-drawer') && !document.querySelector('.pos-take-payment')?.disabled", "POS cart with modifier");
  await evaluate("document.querySelector('.pos-take-payment')?.click()");
  await waitFor("Boolean(document.querySelector('[data-transaction-state=payment]') && document.getElementById('amount-tendered'))", "POS payment panel");
  const displayedDraftNumber = await evaluate("document.querySelector('.pos-payment-panel h2')?.textContent?.trim()");
  if (!displayedDraftNumber) throw Error('POS payment draft number unavailable');
  const tenderSet = await evaluate("(() => { const b=[...document.querySelectorAll('.pos-cash-suggestions button')].at(-1); if(!b)return false;b.click();return true;})()");
  if (!tenderSet) throw Error('Cash tender suggestion unavailable');
  await waitFor("Boolean([...document.querySelectorAll('.pos-payment-panel button')].find(b=>b.textContent?.includes('Confirm & Send') && !b.disabled))", "POS payment ready");
  await shot('desktop-pos-payment');
  const previousSaleNumber = sql("select o.order_number from public.orders o join public.order_items i on i.order_id=o.id where i.special_instructions='Synthetic browser POS note' order by o.created_at desc limit 1");
  await evaluate("[...document.querySelectorAll('.pos-payment-panel button')].find(b=>b.textContent?.includes('Confirm & Send'))?.click()");
  for (let i=0;i<100 && sql("select o.order_number from public.orders o join public.order_items i on i.order_id=o.id where i.special_instructions='Synthetic browser POS note' order by o.created_at desc limit 1") === previousSaleNumber;i++) await pause(150);
  const receiptUi = await evaluate("({state:document.querySelector('.tablet-pos')?.getAttribute('data-transaction-state'), receipt:document.body.innerText.toLowerCase().includes('payment complete'), tail:document.body.innerText.slice(-650)})");
  await shot('desktop-pos-after-submit');
  const browserSaleNumber = sql("select o.order_number from public.orders o join public.order_items i on i.order_id=o.id where i.special_instructions='Synthetic browser POS note' order by o.created_at desc limit 1");
  if (!browserSaleNumber) throw Error('Browser walk-in sale was not persisted');
  const snapshot = JSON.parse(sql(`select json_build_object('channel',o.order_channel,'status',o.current_status,'modifiers',i.modifiers,'note',i.special_instructions,'total',o.grand_total,'payment_status',p.status)::text from public.orders o join public.order_items i on i.order_id=o.id join public.payments p on p.order_id=o.id where o.order_number='${browserSaleNumber}' order by i.created_at limit 1`));
  if (snapshot.channel !== 'walk_in' || !snapshot.modifiers?.some(m => selectedOption.includes(m.name)) || snapshot.note !== 'Synthetic browser POS note' || snapshot.payment_status !== 'verified') throw Error(`Browser POS sale snapshot mismatch: ${JSON.stringify(snapshot)}`);
  checks.push('Browser placed a modified cash walk-in sale and persisted matching server snapshot');
  if (receiptUi.state === 'receipt' && receiptUi.receipt) checks.push('Browser showed completed sale receipt');
  await writeFile(path.join(out, "result.json"), JSON.stringify({ checks, verifiedOrder: pendingOrders[0].order_number, rejectedOrder: pendingOrders[1].order_number, displayedDraftNumber, browserSaleNumber, selectedOption, snapshot, receiptUi, screenshots: ["mobile-dashboard.png", "tablet-dashboard.png", "desktop-dashboard.png", "desktop-pending-modified.png", "desktop-receipt-preview.png", "desktop-shift-closure-blocked.png", "desktop-pos-gate.png", "desktop-pos-menu.png", "desktop-pos-modifiers.png", "desktop-pos-payment.png", "desktop-pos-after-submit.png"] }, null, 2));
  console.log(`PASS: ${checks.length} authenticated isolated Cashier browser checks`);
} finally {
  ws?.close(); chrome.kill(); vite.kill();
  // The synthetic cashier now owns auditable local shift/payment records; keep its Auth identity.
}
