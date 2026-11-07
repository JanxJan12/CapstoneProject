import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const out = join(repo, 'qa', 'customer-c5-fixture', 'evidence');
const base = 'http://127.0.0.1:58447';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
await mkdir(out, { recursive: true });
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config',
  'qa/customer-c5-fixture/vite.config.mjs'], { cwd: repo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let viteLog = '';
vite.stdout.on('data', (chunk) => { viteLog += chunk.toString(); });
vite.stderr.on('data', (chunk) => { viteLog += chunk.toString(); });
let chrome, ws;
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await sleep(100);
  }
  assert.ok(ready, 'loopback fixture server did not start');
  const profile = await mkdtemp(join(tmpdir(), 'rrj-c5-'));
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-proxy-server',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1366,900', 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let n = 0; n < 100; n++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]); break; } catch {}
    await sleep(100);
  }
  assert.ok(port, 'Chrome debugger unavailable');
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
  const tab = targets.find((target) => target.type === 'page');
  assert.ok(tab, 'Chrome page unavailable');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  let id = 0;
  const pending = new Map();
  const blocked = [];
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const next = ++id; pending.set(next, { resolve, reject });
      ws.send(JSON.stringify({ id: next, method, params }));
    });
  }
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Fetch.requestPaused') {
      const url = msg.params.request.url;
      const local = url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:');
      if (!local) blocked.push(url.replace(/\?.*$/, ''));
      void send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest',
        local ? { requestId: msg.params.requestId } : { requestId: msg.params.requestId, errorReason: 'BlockedByClient' });
      return;
    }
    const task = pending.get(msg.id);
    if (!task) return;
    pending.delete(msg.id);
    msg.error ? task.reject(new Error(msg.error.message)) : task.resolve(msg.result);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }
  async function waitFor(expression) {
    for (let n = 0; n < 100; n++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    const page = await evaluate('({url:location.href,body:document.body.innerText.slice(0,900),html:document.body.innerHTML.slice(0,900)})');
    throw new Error(`Timed out: ${expression}; ${JSON.stringify(page)}; vite=${viteLog.slice(-1200)}`);
  }
  const scenarios = ['p1', 'p2', 'p3', 'p5', 't1', 't2', 't3', 't4', 't5', 't6', 'empty', 'error'];
  const widths = [360, 390, 768, 1366];
  const results = [];
  for (const scenario of scenarios) {
    await send('Page.navigate', { url: `${base}/?scenario=${scenario}` });
    await waitFor('Boolean(window.__c5fixture) && document.body.innerText.includes("Your order")');
    await waitFor(scenario === 'empty' ? 'document.body.innerText.includes("No order to track")'
      : scenario === 'error' ? 'document.body.innerText.includes("Unable to load order")'
        : 'document.body.innerText.includes("SYN-C5-001")');
    for (const width of widths) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: width <= 390 ? 844 : 900, deviceScaleFactor: 1, mobile: width <= 390 });
      await sleep(80);
      const view = await evaluate(`(() => {
        const overview = document.querySelector('section[aria-label="Order overview"]');
        const timeline = document.querySelector('section[aria-labelledby="order-progress-heading"]');
        const rows = timeline ? [...timeline.querySelectorAll('div.flex.items-start')].filter(x => x.querySelector('p.text-sm.font-semibold')) : [];
        return { text: document.body.innerText, overview: overview?.innerText ?? '',
          timeline: timeline?.innerText ?? '',
          steps: rows.map(x => ({label: x.querySelector('p.text-sm.font-semibold')?.innerText ?? '',
            checked: Boolean(x.querySelector('div.border-green-500'))})),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          width: innerWidth, buttons: [...document.querySelectorAll('button')].filter(x => x.getClientRects().length)
            .map(x => ({label:x.innerText.trim(), height:Math.round(x.getBoundingClientRect().height)})) };
      })()`);
      assert.equal(view.overflow, false, `${scenario} horizontal overflow at ${width}`);
      for (const action of view.buttons.filter((button) => /^(Refresh status|Submit Payment|All Orders)$/.test(button.label))) {
        assert.ok(action.height >= 44, `${scenario} ${width}px: ${action.label} target ${action.height}px`);
      }
      if (scenario === 'p1') { assert.match(view.text, /Pay for this order/); assert.match(view.overview, /Not submitted/); assert.doesNotMatch(view.text, /Payment needs resubmission/); }
      if (scenario === 'p2') { assert.match(view.overview, /Awaiting Cashier verification/); assert.doesNotMatch(view.text, /Pay for this order|Payment needs resubmission/); }
      if (scenario === 'p3') { assert.match(view.text, /Payment needs resubmission|Unreadable proof/); assert.match(view.overview, /Needs resubmission/); }
      if (scenario === 'p5') { assert.match(view.overview, /Cancelled|Rejected before cancellation/); assert.doesNotMatch(view.text, /Payment needs resubmission|Pay for this order/); }
      if (scenario === 't1' || scenario === 't2') { assert.match(view.timeline, /Completed/); assert.doesNotMatch(view.timeline, /Delivered|Rider|Out for Delivery|Picked Up/); assert.equal(view.steps.at(-1)?.checked, true); }
      if (scenario === 't3') { assert.match(view.timeline, /Rider Accepted|Picked Up|Out for Delivery|Delivered/); assert.equal(view.steps.at(-1)?.checked, false); }
      if (scenario === 't4') { assert.match(view.timeline, /Delivered/); assert.equal(view.steps.at(-1)?.checked, true); }
      if (scenario === 't5') { assert.match(view.overview, /Cancelled/); assert.equal(view.timeline, ''); }
      if (scenario === 't6') { assert.match(view.overview, /Awaiting Cashier verification/); assert.equal(view.steps.at(-1)?.checked, false); }
      if (scenario === 'empty') assert.match(view.text, /No order to track/);
      if (scenario === 'error') assert.match(view.text, /Unable to load order|Try Again/);
      if (width === 390 && ['p1', 'p3', 't1', 't4'].includes(scenario)) {
        const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        await writeFile(join(out, `${scenario}-390.png`), Buffer.from(shot.data, 'base64'));
        await evaluate(`document.querySelector(${JSON.stringify(scenario.startsWith('p') ? '.border-red-200.bg-red-50' : 'section[aria-labelledby="order-progress-heading"]')})?.scrollIntoView({block:'start'})`);
        await sleep(100);
        const detail = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        await writeFile(join(out, `${scenario}-390-detail.png`), Buffer.from(detail.data, 'base64'));
      }
      results.push({ scenario, width, overview: view.overview, steps: view.steps, overflow: view.overflow,
        paymentAction: /Pay for this order|Payment needs resubmission/.test(view.text) });
    }
  }
  await send('Page.navigate', { url: `${base}/?scenario=p4` });
  await evaluate('sessionStorage.removeItem("c5-p4-payment")');
  await send('Page.reload');
  await waitFor('document.body.innerText.includes("Payment needs resubmission")');
  await evaluate('window.__c5fixture.setPayment("pending"); [...document.querySelectorAll("button")].find(x=>x.innerText.includes("Refresh status")).click()');
  await waitFor('document.body.innerText.includes("Awaiting Cashier verification")');
  assert.equal(await evaluate('document.body.innerText.includes("Payment needs resubmission")'), false);
  await send('Page.reload');
  await waitFor('document.body.innerText.includes("Awaiting Cashier verification")');
  assert.equal(await evaluate('document.body.innerText.includes("Payment needs resubmission")'), false);
  await send('Page.navigate', { url: `${base}/?scenario=p1` });
  await waitFor('document.body.innerText.includes("SYN-C5-001")');
  await evaluate('[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Orders").click()');
  await waitFor('document.body.innerText.includes("Order history") && document.body.innerText.includes("SYN-C5-001")');
  await evaluate('[...document.querySelectorAll("button")].find(x=>x.innerText.includes("Track Order")).click()');
  await waitFor('document.body.innerText.includes("Your order") && document.body.innerText.includes("SYN-C5-001")');
  await writeFile(join(out, 'results.json'), JSON.stringify({ tier: 2, results, p4: 'pending transition clears resubmission after refresh and remount', historyNavigation: 'Orders to Track Order passed', blockedNonLoopback: blocked }, null, 2));
  console.log(`PASS Tier 2 rendered fixture: ${results.length} scenario/viewport checks; P4 refresh/remount; History navigation; screenshots p1,p3,t1,t4 at 390 px; nonloopback requests blocked=${blocked.length}`);
} finally {
  ws?.close();
  chrome?.kill();
  vite.kill();
}
