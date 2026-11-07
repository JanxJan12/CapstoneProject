import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const runtime = join(repo, '.tmp', 'defense-demo-20261014');
const card = JSON.parse(readFileSync(join(runtime, 'role-accounts.private.json'), 'utf8'));
const statusResult = spawnSync('npx.cmd', ['--yes', 'supabase@2.120.0', 'status', '--workdir', `"${runtime}"`, '-o', 'json'], { encoding: 'utf8', shell: true });
if (statusResult.status !== 0) throw new Error('Demo stack unavailable.');
const local = JSON.parse(statusResult.stdout);
if (local.API_URL !== 'http://127.0.0.1:61321') throw new Error('Wrong demo API.');
const base = 'http://127.0.0.1:58440';
const output = join(repo, 'qa', 'defense-demo-browser-20261014');
await mkdir(output, { recursive: true });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '58440', '--strictPort'], {
  cwd: repo, windowsHide: true, stdio: 'ignore',
  env: { ...process.env, RRJ_DEFENSE_DEMO: '1', VITE_DEMO_MODE: 'true', VITE_SUPABASE_URL: local.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY },
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let ready = false;
for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/auth`)).ok) { ready = true; break; } } catch {} await pause(150); }
if (!ready) { vite.kill(); throw new Error('Demo Vite server unavailable.'); }
const profile = await mkdtemp(join(tmpdir(), 'rrj-defense-browser-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-proxy-server',
  '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1440,900', `${base}/auth`,
], { windowsHide: true, stdio: 'ignore' });
let ws;
let seq = 0;
const pending = new Map();
const checks = [];
function command(method, params = {}) { return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const r = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; }
async function waitFor(expression, label) { for (let i = 0; i < 220; i++) { if (await evaluate(expression)) return; await pause(150); } throw new Error(`Timed out ${label}: ${JSON.stringify(await evaluate('({url:location.href,body:document.body.innerText.slice(0,400)})'))}`); }
async function shot(name) { const result = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }); await writeFile(join(output, `${name}.png`), Buffer.from(result.data, 'base64')); }
async function fill(id, value) { return evaluate(`(() => { const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`); }
async function navigate(path) { await command('Page.navigate', { url: `${base}${path}` }); }

try {
  let port;
  for (let i = 0; i < 80; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]); break; } catch { await pause(100); } }
  if (!port) throw new Error('Chrome debugger unavailable.');
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
  const tab = tabs.find(entry => entry.type === 'page' && entry.url.startsWith(base));
  if (!tab) throw new Error('Demo browser tab unavailable.');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); const task = pending.get(message.id); if (!task) return; pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); });
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  await command('Page.enable'); await command('Runtime.enable');
  await waitFor("location.origin === 'http://127.0.0.1:58440'", 'demo browser origin');
  await navigate('/auth?portal=staff'); await waitFor("Boolean(document.getElementById('demo-email'))",'Manager login');
  await fill('demo-email',card.roles.manager.email); await fill('demo-password',card.roles.manager.password);
  await evaluate("document.getElementById('demo-email').closest('form').requestSubmit()");
  await waitFor("location.pathname==='/manager'&&!document.body.innerText.includes('Loading your page')",'Manager workspace');
  const snap=()=>{const r=spawnSync('docker',['exec','-u','postgres','supabase_db_rrj_defense_demo_20261014','psql','-U','supabase_admin','-d','postgres','-X','-Atqc',"select (select count(*) from public.inventory_transactions)||'|'||(select coalesce(sum(quantity_on_hand),0) from public.inventory_batches)"],{encoding:'utf8'});if(r.status!==0)throw new Error('Demo SQL check failed');return r.stdout.trim()};
  const before=snap();
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Receiving')?.click()");
  await waitFor("document.body.innerText.includes('Receiving documents')",'Receiving workspace');
  const opened=await evaluate("(() => {const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.includes('RR-20261014-462B83F3'));if(!b)return false;b.click();return true;})()");if(!opened)throw new Error('Linked synthetic draft missing');
  await waitFor("document.body.innerText.includes('PR-20261014-000003')&&Boolean(document.getElementById('receiving-line-item'))",'Linked draft selected');
  const chose=await evaluate("(() => {const s=document.getElementById('receiving-line-item');const o=[...s.options].find(x=>x.textContent?.startsWith('Rice ·'));if(!o)return false;const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");if(!chose)throw new Error('Rice request item unavailable');
  async function setInput(id,value){const ok=await evaluate(`(() => {const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);if(!ok)throw new Error(`Missing ${id}`)}
  await setInput('line-delivered','3'); await setInput('line-accepted','2'); await setInput('line-rejection-reason','Synthetic demo quality rejection; no physical goods'); await setInput('line-lot','DEMO-RICE-20261014-01'); await setInput('line-use-by','2027-01-01');
  await shot('manager-receiving-partial-line');
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Save Line')?.click()");
  await waitFor("document.body.innerText.includes('Receiving line saved to the draft. No stock moved.')",'Receiving line saved');
  if(snap()!==before)throw new Error('Draft moved stock');
  await shot('manager-receiving-saved-draft');
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Review & Post')?.click()");
  await waitFor("document.body.innerText.includes('Post RR-20261014-462B83F3?')",'Receiving post review');
  await shot('manager-receiving-post-review');
  const review=await evaluate("document.body.innerText.slice(-2200)");if(!review.includes('Rice')||!review.includes('2')||!review.includes('1'))throw new Error('Review missing partial line');
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Post Receiving')?.click()");
  await waitFor("document.body.innerText.includes('Posted receiving document')",'Receiving posted');
  const after=snap(); if(after===before)throw new Error('Accepted quantity not posted');
  await shot('manager-receiving-posted');
  await writeFile(join(output,'manager-receiving-result.json'),JSON.stringify({status:'PASS',requestNumber:'PR-20261014-000003',reportNumber:'RR-20261014-462B83F3',checks:['Linked Manager Chrome Receiving draft from issued request','Rice line delivered 3 accepted 2 rejected 1 with fictional reason','Saved draft left stock unchanged','Review and Post advanced the report and stock ledger'],before,after,boundary:'Synthetic local Chrome UI; fictional quantities, no physical goods, no Messenger dispatch.'},null,2));
  console.log(`PASS: Manager Chrome linked Receiving partial post; ${before} to ${after}.`);
} finally { ws?.close(); chrome.kill(); vite.kill(); }
