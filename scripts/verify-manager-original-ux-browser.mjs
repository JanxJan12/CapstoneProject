import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/manager-original-ux-rendered-20261024");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-manager-original-ux-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map(), errors = [], requests = [], checks = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  socket.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async (expression) => {
  for (let n = 0; n < 120; n++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,700)")}; ${errors.join(" | ")}`);
};
const click = (label) => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent.trim()===${JSON.stringify(label)});if(!b)return false;b.click();return true})()`);
try {
  let port;
  for (let n = 0; n < 100; n++) {
    try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]); break; }
    catch { await pause(100); }
  }
  assert.ok(port, "Chrome debugger unavailable");
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  const target = targets.find((entry) => entry.type === "page");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    else if (message.method === "Network.requestWillBeSent") requests.push({ method: message.params.request.method, url: message.params.request.url });
  });
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await mkdir(output, { recursive: true });
  for (const width of [1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:5173/scripts/fixtures/manager-original-ux.html" });
    await waitFor("document.querySelector('#recent-stock-activity-heading') && document.body.innerText.includes('RR-20261012-000001')");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: document overflow`);
    assert.match(await evaluate("document.body.innerText"), /Recent Receiving[\s\S]*Recent stock movements[\s\S]*Reference: RR-20261012-000001/);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
    await writeFile(path.join(output, `overview-${width}.png`), Buffer.from(shot.data, "base64"));
    assert.equal(await click("All movements"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"Movement filters\"]'))");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: movement overflow`);
    assert.equal(await evaluate("document.body.innerText.includes('Reference: RR-20261012-000001')"), true);
    assert.equal(await evaluate("(()=>{const e=[...document.querySelectorAll('[aria-label=\"Movement filters\"] input')].find(x=>x.placeholder.includes('Exact RR'));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'RR-NO-MATCH');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()"), true);
    await waitFor("document.body.innerText.includes('No movements match this search')");
    assert.equal(await evaluate("(()=>{const e=[...document.querySelectorAll('[aria-label=\"Movement filters\"] input')].find(x=>x.placeholder.includes('Exact RR'));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'RR-20261012-000001');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()"), true);
    await waitFor("document.body.innerText.includes('Reference: RR-20261012-000001')");
    assert.equal(await click("Search full receipt history"), true);
    await waitFor("document.body.innerText.includes('across 2 receiving movements checked')");
    assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Stock movements\"] > li').length"), 1);
    assert.equal(await evaluate("(()=>{const e=[...document.querySelectorAll('[aria-label=\"Movement filters\"] input')].find(x=>x.placeholder.includes('Exact RR'));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'RR-NOT-FOUND');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()"), true);
    assert.equal(await click("Search full receipt history"), true);
    await waitFor("document.body.innerText.includes('0 movements for RR-NOT-FOUND across 2 receiving movements checked')");
    assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Stock movements\"] > li').length"), 0);
    assert.equal(await evaluate("(()=>{const e=[...document.querySelectorAll('[aria-label=\"Movement filters\"] input')].find(x=>x.placeholder.includes('Exact RR'));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'RR-20261012-000001');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()"), true);
    assert.equal(await evaluate("(()=>{const e=[...document.querySelectorAll('[aria-label=\"Movement filters\"] select')].find(x=>x.parentElement.textContent.includes('Item'));e.value='2';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
    await waitFor("document.querySelector('[aria-label=\"Movement filters\"] select')?.value === '2'");
    assert.equal(await click("Search full receipt history"), true);
    await waitFor("document.body.innerText.includes('0 movements for RR-20261012-000001 across 1 receiving movement checked')");
    assert.equal(await evaluate("(()=>{const e=[...document.querySelectorAll('[aria-label=\"Movement filters\"] select')].find(x=>x.parentElement.textContent.includes('Item'));e.value='1';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
    await waitFor("document.querySelector('[aria-label=\"Movement filters\"] select')?.value === '1'");
    assert.equal(await click("Search full receipt history"), true);
    await waitFor("document.body.innerText.includes('1 movement for RR-20261012-000001 across 2 receiving movements checked')");
    assert.equal(await click("Open receipt"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"Receiving documents\"]'))");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: Receiving overflow`);
    assert.equal(await evaluate("document.querySelector('input[placeholder=\"Request number, receipt number, source reference\"]')?.value"), "RR-20261012-000001");
    assert.equal(await evaluate("(()=>{const b=[...document.querySelectorAll('[aria-label=\"Receiving receipt history\"] button')].find(x=>x.textContent.includes('RR-20261012-000001'));if(!b)return false;b.click();return true})()"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-20261012-000001')");
    assert.equal(await click("Document Details"), true);
    await waitFor("document.querySelector('#receiving-document-details')?.getClientRects().length");
    assert.equal(await evaluate("(()=>{const b=[...document.querySelectorAll('#receiving-document-details button')].find(x=>x.textContent.includes('Open linked Request'));if(!b)return false;b.click();return true})()"), true);
    await waitFor("document.body.innerText.includes('PR-20261012-000001')");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: Request overflow`);
    if (width === 1280) {
      await send("Page.navigate", { url: "http://127.0.0.1:5173/scripts/fixtures/manager-original-ux.html?mgrRec=1" });
      await waitFor("document.body.innerText.includes('RR-SYNTHETIC') && document.body.innerText.includes('RR-20261012-000001')");
      assert.match(await evaluate("document.body.innerText"), /Unposted Receiving draft[\s\S]*Recent Receiving[\s\S]*Posted receipts only/);
    }
    checks.push({ width, overview: true, visibleReference: true, receiptFilter: true, fullPagedReceiptSearch: true, missingReceiptEmpty: true, combinedItemReceiptFilter: true, movementReceiptRequestNavigation: true, draftPostedDistinction: width === 1280, noOverflow: true });
  }
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "network write");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:5173/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "external request");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, errors, networkWrites: 0 }, null, 2));
  console.log("PASS: recent stock/Receiving activity and movement-to-receipt navigation at 1280/820/390 px; local-only traffic");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
