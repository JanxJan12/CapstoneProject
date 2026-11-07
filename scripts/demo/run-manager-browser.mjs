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
  await navigate('/auth?portal=staff');
  await waitFor("Boolean(document.getElementById('demo-email'))",'Manager login');
  await fill('demo-email',card.roles.manager.email); await fill('demo-password',card.roles.manager.password);
  await evaluate("document.getElementById('demo-email').closest('form').requestSubmit()");
  await waitFor("location.pathname==='/manager'&&!document.body.innerText.includes('Loading your page')",'Manager workspace');
  const snap=()=>{const r=spawnSync('docker',['exec','-u','postgres','supabase_db_rrj_defense_demo_20261014','psql','-U','supabase_admin','-d','postgres','-X','-Atqc',"select (select count(*) from public.inventory_transactions)||'|'||(select coalesce(sum(quantity_on_hand),0) from public.inventory_batches)"],{encoding:'utf8'});if(r.status!==0)throw new Error('Demo SQL check failed');return r.stdout.trim()};
  const before=snap();
  const nav=await evaluate("(() => {const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Requests');if(!b)return false;b.click();return true;})()");
  if(!nav)throw new Error('Manager Requests navigation absent');
  await waitFor("document.body.innerText.includes('Unsaved request sheet')",'Manager Requests sheet');
  const removed=await evaluate("(() => {const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Remove');if(!b)return false;b.click();return true;})()");
  if(!removed)throw new Error('Prior QA suggestion could not be removed');
  async function addItem(name){const ok=await evaluate(`(() => {const s=[...document.querySelectorAll('select')].find(x=>x.closest('label')?.textContent?.includes('Add eligible item'));const o=[...(s?.options??[])].find(x=>x.textContent?.startsWith(${JSON.stringify(name)}));if(!o)return false;const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);if(!ok)throw new Error(`Eligible ${name} absent`);await evaluate("[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Add item')?.click()");await waitFor(`Boolean(document.querySelector('input[aria-label=${JSON.stringify(name.split(' (')[0]+' requested quantity')}]'))`,`${name} line`);}
  await addItem('Chicken (kg)'); await addItem('Rice (kg)');
  async function setInput(label,value){const ok=await evaluate(`(() => {const e=[...document.querySelectorAll('input')].find(x=>x.getClientRects().length&&x.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);if(!ok)throw new Error(`Missing input ${label}`)}
  await setInput('Chicken requested quantity','2'); await setInput('Rice requested quantity','3');
  for(const name of ['Chicken','Rice']){const reason=`${name} override reason`;const exists=await evaluate(`Boolean(document.querySelector('input[aria-label=${JSON.stringify(reason)}]'))`);if(exists)await setInput(reason,'Synthetic defense workflow quantity');}
  const reasonOk=await evaluate("(() => {const e=[...document.querySelectorAll('label')].find(x=>x.textContent?.trim()==='Reason')?.querySelector('input');if(!e)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,'Synthetic defense two-item request');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");if(!reasonOk)throw new Error('Reason input absent');
  await shot('manager-request-two-line-draft');
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Review request')?.click()");
  await waitFor("document.body.innerText.includes('Pre-issue review document')",'Manager pre-issue review');
  await shot('manager-request-two-line-review');
  const reviewText=await evaluate("document.querySelector('[aria-label=\"Pre-issue request review\"]')?.innerText");
  if(!reviewText?.includes('Chicken')||!reviewText?.includes('Rice'))throw new Error('Two-item review missing');
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent?.trim()==='Issue Request')?.click()");
  await waitFor("document.body.innerText.includes('issued. Stock did not change.')",'Manager issue notice');
  const requestNumber=await evaluate("document.body.innerText.match(/PR-\\d{8}-\\d{6}/)?.[0]");
  if(!requestNumber)throw new Error('Official request number missing');
  const after=snap();if(before!==after)throw new Error(`Request issue changed stock ledger: ${before} => ${after}`);
  await shot('manager-request-issued');
  await writeFile(join(output,'manager-request-result.json'),JSON.stringify({status:'PASS',requestNumber,checks:['Manager Chrome created two-line synthetic request','pre-issue document displayed both lines','official request issued','stock batches and inventory movement count unchanged'],before,after,boundary:'Actual Manager Chrome UI on isolated local demo. No Messenger send, physical delivery, or Receiving UI posting in this script.'},null,2));
  console.log(`PASS: Manager Chrome two-item request ${requestNumber}; stock unchanged.`);
} finally { ws?.close(); chrome.kill(); vite.kill(); }
