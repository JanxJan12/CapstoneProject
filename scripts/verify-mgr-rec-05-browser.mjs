import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:5173/scripts/fixtures/mgr-rec-04.html";
const output = path.resolve("qa/mgr-rec-05-rendered-20261024");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-rec-05-"));
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
const shot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
  await writeFile(path.join(output, name), Buffer.from(result.data, "base64"));
};
const navigate = async (url) => { await send("Page.navigate", { url: `${base}${url}` }); await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length || document.querySelector('#receiving-workspace-heading')?.getClientRects().length"); };
const list = () => evaluate("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText ?? ''");

try {
  let port;
  for (let n = 0; n < 100; n++) {
    try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]); break; }
    catch { await pause(100); }
  }
  assert.ok(port, "Chrome debugger unavailable");
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args?.map((arg) => arg.value ?? arg.description).join(" "));
    if (message.method === "Network.requestWillBeSent") requests.push({ url: message.params.request.url, method: message.params.request.method });
    const task = pending.get(message.id);
    if (task) { pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await mkdir(output, { recursive: true });
  for (const width of [1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await navigate("?page=stock-receiving&mgrRec=1");
    await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
    let rows = await list();
    assert.match(rows, /PR-20261023-000004[\s\S]*Awaiting Delivery[\s\S]*Record Delivery/);
    assert.match(rows, /PR-SYNTHETIC-PARTIAL[\s\S]*Partially Received[\s\S]*Record Additional Delivery/);
    assert.doesNotMatch(rows, /PR-SYNTHETIC-FULL|PR-SYNTHETIC-CLOSED/);
    assert.match(rows, /RR-20261012-000001/);
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true);
    await shot(`unified-list-${width}.png`);
    if (width === 1280) {
      assert.equal(await click("Draft"), true);
      await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('RR-20261012-000002')");
      assert.equal(await click("Posted"), true);
      await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('RR-20261012-000001')");
      assert.equal(await click("All"), true);
      await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
      await shot("awaiting-request.png");
    }
    assert.equal(await click("Record Delivery"), true);
    await waitFor("document.body.innerText.includes('Start linked Receiving · PR-20261023-000004')");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0);
    assert.equal(await click("Start Receiving"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length && document.querySelector('[aria-label=\"Requested and inspected quantities\"]')?.innerText.includes('Originally requested')");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true);
    await shot(`inspection-workspace-${width}.png`);
    assert.equal(await click("← Back to Receiving Documents"), true);
    await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length && document.body.innerText.includes('Resume Receiving')");
    rows = await list();
    assert.equal((rows.match(/RR-SYNTHETIC\b(?!-)/g) ?? []).length, 1, "operational draft duplicated");
    await shot(`existing-draft-${width}.png`);
    assert.equal(await click("Resume Receiving"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1, "resume created a second draft");
    checks.push({ width, issued: true, partial: true, dedupe: true, resume: true, overflow: false });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("?page=stock-receiving");
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261012-000001')");
  assert.match(await list(), /Draft in Progress[\s\S]*Resume Receiving/);
  assert.equal((await list()).match(/RR-20261012-000002/g)?.length, 1);
  assert.equal(await click("Resume Receiving"), true);
  await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-20261012-000002')");
  assert.match(await evaluate("document.querySelector('[aria-label=\"Requested and inspected quantities\"]').innerText"), /Originally requested[\s\S]*Previously accepted[\s\S]*Outstanding now[\s\S]*Current delivered/);
  assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0);
  await navigate("?page=stock-receiving");
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261012-000001')");
  await evaluate(`(()=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'RR-20261012-000002');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  assert.equal(await click("Search"), true);
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('RR-20261012-000002') && !document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261012-000001 · Rev')");
  await navigate("?populated=posted");
  await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('Posted')");
  assert.equal(await evaluate("Boolean(document.querySelector('#receiving-line-editor')?.getClientRects().length)"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('#receiving-review')?.getClientRects().length)"), false);
  await shot("posted-readonly.png");
  await navigate("?page=stock-receiving&mgrRecError=1");
  await waitFor("document.body.innerText.includes('Synthetic request register unavailable')");
  await navigate("?page=stock-receiving&mgrRec=1&paginate=1");
  await waitFor("document.body.innerText.includes('Receipt page 1')");
  assert.equal(await click("Next"), true);
  await waitFor("document.body.innerText.includes('Receipt page 2')");
  assert.equal(await click("Previous"), true);
  await waitFor("document.body.innerText.includes('Receipt page 1')");
  await navigate("?page=stock-receiving&mgrRec=1");
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
  assert.equal(await evaluate(`(()=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'PR-SYNTHETIC-PARTIAL');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`), true);
  assert.equal(await click("Search"), true);
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-SYNTHETIC-PARTIAL') && !document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
  assert.equal(await click("Clear"), true);
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('RR-SYNTHETIC-SUPPLIER')");
  assert.equal(await click("Awaiting Delivery"), true);
  await waitFor("!document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('RR-SYNTHETIC-SUPPLIER')");
  assert.match(await list(), /PR-SYNTHETIC-PARTIAL/);
  assert.equal(await click("All"), true);
  assert.equal(await evaluate(`(()=>{const s=[...document.querySelectorAll('summary')].find(x=>x.textContent.includes('More filters'));s.click();return true})()`), true);
  assert.equal(await evaluate(`(()=>{const s=document.querySelector('select');s.value='direct_supplier';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`), true);
  assert.equal(await click("Apply filters"), true);
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('RR-SYNTHETIC-SUPPLIER') && !document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "network write");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:5173/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "external request");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, postedReadOnly: true, search: true, statusFilter: true, sourceFilter: true, pagination: true, requestError: true, browserErrors: errors, networkWrites: 0 }, null, 2));
  console.log("PASS: unified request and receipt list, grouping, resume, quantities, posted view, desktop/tablet/mobile, error, pagination, local network only");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
