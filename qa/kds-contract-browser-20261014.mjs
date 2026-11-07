// Isolated KDS contract and browser test. No hosted calls.
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

const stack = path.join(process.env.LOCALAPPDATA ?? "", "RRJ-Private-Backups", "rehearsal-20261013", "isolated-stack");
const status = spawnSync("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", stack, "-o", "json"], { shell: true, encoding: "utf8", windowsHide: true });
if (status.status !== 0) throw Error("Isolated stack unavailable");
const local = JSON.parse(status.stdout);
if (local.API_URL !== "http://127.0.0.1:56321") throw Error("Refusing non-isolated API");
const db = "supabase_db_isolated-stack";
if (spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", db], { encoding: "utf8" }).stdout.trim() !== "true") throw Error("Isolated database unavailable");
const sql = statement => {
  const r = spawnSync("docker", ["exec", "-u", "postgres", db, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", statement], { encoding: "utf8" });
  if (r.status !== 0) throw Error(`Isolated SQL failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
};
const email = `kds-browser-${randomUUID()}@example.invalid`;
const password = `Aa1!${randomBytes(24).toString("base64url")}`;
const adminHeaders = { apikey: local.SERVICE_ROLE_KEY, authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, "content-type": "application/json" };
const created = await fetch(`${local.API_URL}/auth/v1/admin/users`, { method: "POST", redirect: "error", headers: adminHeaders,
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { first_name: "KDS", last_name: "QA" } }) });
if (!created.ok) throw Error(`Local manager creation failed: HTTP ${created.status}`);
const manager = await created.json();
sql(`update public.profiles set role='manager',is_active=true where id='${manager.id}'`);
const login = await fetch(`${local.API_URL}/auth/v1/token?grant_type=password`, { method: "POST", redirect: "error",
  headers: { apikey: local.PUBLISHABLE_KEY, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
if (!login.ok) throw Error(`Local manager login failed: HTTP ${login.status}`);
const token = (await login.json()).access_token;
const provision = await fetch(`${local.API_URL}/rest/v1/rpc/provision_kds_terminal`, { method: "POST", redirect: "error",
  headers: { apikey: local.PUBLISHABLE_KEY, authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ p_terminal_name: `Isolated KDS QA ${randomUUID().slice(0, 8)}` }) });
if (!provision.ok) throw Error(`Local KDS provisioning failed: HTTP ${provision.status}`);
const terminal = (await provision.json())[0];
if (!terminal?.terminal_id || !terminal?.terminal_secret) throw Error("Local KDS terminal credential unavailable");
const prepared = JSON.parse(await readFile('qa/kds-browser-ticket-setup-20261014.json', 'utf8'));
const ticketId = prepared.walkInOrderId;
if (!ticketId) throw Error("No prior isolated synthetic modified walk-in ticket");
const queueHeaders = { apikey: local.PUBLISHABLE_KEY, authorization: `Bearer ${local.PUBLISHABLE_KEY}`, "content-type": "application/json" };
const queueRpc = async (name, args) => {
  const response = await fetch(`${local.API_URL}/rest/v1/rpc/${name}`, { method: "POST", redirect: "error", headers: queueHeaders, body: JSON.stringify(args) });
  return { status: response.status, data: await response.json() };
};
const badQueue = await queueRpc("get_kds_queue_v2", { p_terminal_id: terminal.terminal_id, p_terminal_secret: "invalid-local-secret" });
if (badQueue.status < 400 || Array.isArray(badQueue.data)) throw Error("Invalid terminal secret exposed KDS data");
const v1 = await queueRpc("get_kds_queue", { p_terminal_id: terminal.terminal_id, p_terminal_secret: terminal.terminal_secret });
const v2 = await queueRpc("get_kds_queue_v2", { p_terminal_id: terminal.terminal_id, p_terminal_secret: terminal.terminal_secret });
if (v1.status !== 200 || v2.status !== 200 || v1.data.length !== v2.data.length) throw Error("KDS v1/v2 ticket sets differ");
const v1Ticket = v1.data.find(row => row.order_id === ticketId);
const v2Ticket = v2.data.find(row => row.order_id === ticketId);
const customerTicket = v2.data.find(row => row.order_id === prepared.customerOrderId);
if (!v1Ticket || !v2Ticket || v1Ticket.order_channel !== undefined || v2Ticket.order_channel !== "walk_in") throw Error("KDS order channel contract mismatch");
if (!customerTicket || customerTicket.order_channel !== 'online' || !customerTicket.items.some(item => item.modifiers?.some(modifier => modifier.name === 'Extra rice'))) throw Error('Fresh Customer KDS snapshot/channel mismatch');
if (v1Ticket.items.some(item => "modifiers" in item) || !v2Ticket.items.some(item => item.modifiers?.some(modifier => modifier.name === "Extra rice"))) throw Error("KDS modifier snapshot mismatch");
if (v2.data.some(row => ["customer_name", "customer_contact_number", "delivery_address", "payment_id", "proof_image_path"].some(field => field in row))) throw Error("Sensitive order data exposed");
const base = "http://127.0.0.1:58433";
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "qa/kds-browser-20261013/vite.local.mjs", "--host", "127.0.0.1"], {
  cwd: process.cwd(), windowsHide: true, stdio: "ignore", env: { ...process.env, VITE_SUPABASE_URL: local.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY },
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/kitchen`)).ok) break; } catch {} if (i === 99) throw Error("Local Vite server unavailable"); await pause(150); }
const profile = await mkdtemp(path.join(tmpdir(), "rrj-kds-browser-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1440,900", `${base}/kitchen`,
], { windowsHide: true, stdio: "ignore" });
const out = path.resolve("qa/kds-contract-browser-20261014");
await mkdir(out, { recursive: true });
let ws, seq = 0;
const pending = new Map(), checks = [];
const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.text); return r.result.value; };
async function waitFor(expression, label) { for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await pause(150); } throw Error(`Timed out ${label}: ${JSON.stringify(await evaluate("({url:location.href,ready:document.readyState,body:document.body?.innerText.slice(0,500),resources:performance.getEntriesByType('resource').slice(-10).map(r=>({name:r.name,status:r.responseStatus,duration:r.duration})),scripts:[...document.scripts].map(s=>s.src)})"))}`); }
async function shot(name) { const capture = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); await writeFile(path.join(out, `${name}.png`), Buffer.from(capture.data, "base64")); }
async function fill(id, value) { return evaluate(`(() => { const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`); }
try {
  let port;
  for (let i = 0; i < 80; i++) { try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]); break; } catch { await pause(100); } }
  if (!port) throw Error("Chrome debugger unavailable");
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
  const tab = tabs.find(entry => entry.type === "page" && entry.url.startsWith(base));
  if (!tab) throw Error("Local KDS tab unavailable");
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  ws.addEventListener("message", event => { const message = JSON.parse(event.data); if (message.method === "Runtime.exceptionThrown") console.error("Browser exception:", message.params.exceptionDetails.text, message.params.exceptionDetails.exception?.description?.slice(0, 500)); if (message.method === "Network.loadingFailed") console.error("Browser load failure:", message.params.errorText); const task = pending.get(message.id); if (!task) return; pending.delete(message.id); message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result); });
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
  await waitFor("Boolean(document.getElementById('kds-terminal-id'))", "terminal gate");
  await shot("desktop-terminal-gate");
  if (!await fill("kds-terminal-id", terminal.terminal_id) || !await fill("kds-terminal-secret", "invalid-local-secret")) throw Error("Terminal fields unavailable");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Activate Kitchen Terminal')).click()");
  await waitFor("Boolean(document.querySelector('[role=alert]'))", "invalid terminal rejection");
  checks.push("Invalid terminal secret rejected in local browser");
  await fill("kds-terminal-secret", terminal.terminal_secret);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Activate Kitchen Terminal')).click()");
  await waitFor("Boolean(document.querySelector('.kitchen-board'))", "authorized kitchen queue");
  checks.push("Provisioned local terminal opened KDS queue");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(prepared.customerOrderNumber)}) && document.body.innerText.includes(${JSON.stringify(prepared.walkInOrderNumber)})`, "fresh modified tickets");
  checks.push("Fresh Customer and walk-in option snapshots and channels rendered");
  const refreshFocused = await evaluate("(() => { const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Refresh'); if(!button)return false;button.focus();return document.activeElement===button;})()");
  if (!refreshFocused) throw Error("Queue refresh button cannot receive focus");
  await command("Network.setBlockedURLs", { urls: ["*://127.0.0.1:56321/rest/v1/rpc/get_kds_queue_v2"] });
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Refresh')?.click()");
  await waitFor("document.body.innerText.includes('Queue needs attention')", "queue network failure");
  if (await evaluate("document.querySelectorAll('.kitchen-ticket').length") !== 0) throw Error("Stale KDS tickets stayed visible after queue failure");
  await command("Network.setBlockedURLs", { urls: [] });
  await evaluate("document.querySelector('[role=alert] button')?.click()");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(prepared.walkInOrderNumber)}) && document.body.innerText.includes('Queue loaded')`, "queue retry");
  checks.push("Focusable Refresh, honest error state without stale tickets, and successful Retry");
  for (const [name, width, height] of [["mobile", 390, 844], ["tablet", 768, 1024], ["desktop", 1440, 900]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await pause(250);
    const size = await evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})");
    if (size.width !== width || size.scrollWidth > width + 1) throw Error(`${name} overflow: ${JSON.stringify(size)}`);
    const customerSelector = `.kitchen-ticket[aria-label^=${JSON.stringify(prepared.customerOrderNumber)}]`;
    const walkInSelector = `.kitchen-ticket[aria-label^=${JSON.stringify(prepared.walkInOrderNumber)}]`;
    await evaluate(`document.querySelector(${JSON.stringify(customerSelector)})?.scrollIntoView({block:'start'})`);
    await pause(100);
    await shot(`${name}-customer-ticket`);
    await evaluate(`document.querySelector(${JSON.stringify(walkInSelector)})?.scrollIntoView({block:'start'})`);
    await pause(100);
    await shot(`${name}-walk-in-ticket`);
    checks.push(`${name} ${width}x${height} KDS queue without document overflow`);
  }
  const labels = await evaluate("({delayed:document.body.innerText.includes('Delayed'),columns:[...document.querySelectorAll('.kitchen-column h2')].map(e=>e.textContent?.trim())})");
  if (labels.delayed || labels.columns.length !== 3) throw Error("KDS status presentation invalid");
  checks.push("Confirmed, Preparing, Ready visible without invented delayed status");
  const cardSelector = `.kitchen-ticket[aria-label^=${JSON.stringify(v2Ticket.order_number)}]`;
  if (!await evaluate(`(() => { const card=document.querySelector(${JSON.stringify(cardSelector)}); const button=[...(card?.querySelectorAll('button') ?? [])].find(b=>b.textContent?.includes('Start Preparing')); if(!button)return false;button.click();return true })()`)) throw Error("Modified walk-in browser advance button missing");
  await waitFor(`document.querySelector(${JSON.stringify(cardSelector)})?.getAttribute('aria-label')?.includes('Preparing')`, "browser Preparing transition");
  const duplicate = await queueRpc("advance_kds_order", { ...{ p_terminal_id: terminal.terminal_id, p_terminal_secret: terminal.terminal_secret }, p_order_id: ticketId, p_expected_status: "confirmed" });
  if (duplicate.status < 400) throw Error("Duplicate browser KDS transition accepted");
  if (!await evaluate(`(() => { const card=document.querySelector(${JSON.stringify(cardSelector)}); const button=[...(card?.querySelectorAll('button') ?? [])].find(b=>b.textContent?.includes('Mark Ready')); if(!button)return false;button.click();return true })()`)) throw Error("Modified walk-in Mark Ready button missing");
  await waitFor(`document.querySelector(${JSON.stringify(cardSelector)})?.getAttribute('aria-label')?.includes('Ready')`, "browser Ready transition");
  checks.push("Browser drove modified walk-in Confirmed to Preparing to Ready; duplicate transition denied");
  checks.push("Invalid v2 terminal secret denied; v1 ticket set preserved; v2 modifier and channel matched stored walk-in ticket; sensitive columns absent");
  await writeFile(path.join(out, "result.json"), JSON.stringify({ checks, customerOrderId: prepared.customerOrderId, ticketId, screenshots: ["desktop-terminal-gate.png", ...['mobile','tablet','desktop'].flatMap(name => [`${name}-customer-ticket.png`, `${name}-walk-in-ticket.png`])] }, null, 2));
  console.log(`PASS: ${checks.length} isolated KDS browser checks`);
} finally {
  ws?.close(); chrome.kill(); vite.kill();
  sql(`delete from public.kds_terminals where id='${terminal.terminal_id}'`);
  await fetch(`${local.API_URL}/auth/v1/admin/users/${manager.id}`, { method: "DELETE", redirect: "error", headers: adminHeaders }).catch(() => {});
}

