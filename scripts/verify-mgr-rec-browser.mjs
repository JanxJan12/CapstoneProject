import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:5173/scripts/fixtures/visual-manager.html";
const output = path.resolve("qa/mgr-rec-01-rendered-20261023");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-rec-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map();
const errors = [], requests = [];
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
  for (let n = 0; n < 100; n++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,800)")}; ${errors.join(" | ")}`);
};
const shot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true });
  await writeFile(path.join(output, name), Buffer.from(result.data, "base64"));
};
const setInput = (label, value) => evaluate(`(()=>{const e=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(${JSON.stringify(label)}))?.querySelector('input');if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);

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
    if (!task) return;
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await mkdir(output, { recursive: true });
  const checks = [];
  for (const width of [1280, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await send("Page.navigate", { url: `${base}?page=stock-receiving&mgrRec=1` });
    await waitFor("document.querySelector('#awaiting-production-heading') && document.body.innerText.includes('PR-20261023-000004')");
    const queue = await evaluate("document.querySelector('[aria-labelledby=awaiting-production-heading]').innerText");
    assert.match(queue, /PR-20261023-000004 · Rev 1[\s\S]*Issued[\s\S]*Oct 24, 2026, 6:15 PM[\s\S]*2 pcs remaining/);
    assert.match(queue, /PR-SYNTHETIC-PARTIAL[\s\S]*1 pcs remaining/);
    assert.doesNotMatch(queue, /PR-SYNTHETIC-FULL|PR-SYNTHETIC-CLOSED/);
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0, "viewing queue creates no draft");
    assert.ok(await evaluate("document.querySelector('[aria-label=\"Receiving documents\"]') !== null"), "existing documents remain visible");
    const overflow = await evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1");
    assert.equal(overflow, false, "no horizontal overflow");
    await shot(`receiving-${width}.png`);
    checks.push({ width, queue: true, overflow: false });
    if (width === 1280) {
      await evaluate("[...document.querySelectorAll('li')].find(x=>x.textContent.includes('PR-20261023-000004'))?.querySelector('button')?.click()");
      await waitFor("document.body.innerText.includes('Start linked Receiving · PR-20261023-000004')");
      assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0, "opening inspection form creates no draft");
      await shot("receiving-inspection-entry.png");
      assert.ok(await setInput("Physical inspector name or staff ID", "Test Inspector"));
      await evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Start linked Receiving draft'))?.click()");
      await waitFor("(window.__mgrRecStarts||[]).length === 1");
      const started = await evaluate("window.__mgrRecStarts[0]");
      assert.equal(started.requestId, "11111111-1111-4111-8111-000000000004");
      assert.equal(started.revision, 1);
      assert.equal(started.inspector, "Test Inspector");
      await waitFor("document.body.innerText.includes('RR-SYNTHETIC')");
      assert.match(await evaluate("document.body.innerText"), /Draft · stock unchanged/);
      await waitFor("document.querySelector('[aria-label=\"Receiving documents\"]')?.innerText.includes('RR-SYNTHETIC')");
      await shot("receiving-created-draft.png");
      await evaluate("[...document.querySelectorAll('li')].find(x=>x.textContent.includes('PR-20261023-000004'))?.querySelector('button')?.click()");
      await pause(200);
      assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1, "resume does not create another draft");
    }
  }
  await send("Page.navigate", { url: `${base}?page=stock-receiving&mgrRecError=1` });
  await waitFor("document.body.innerText.includes('Synthetic request register unavailable')");
  assert.ok(await evaluate("document.querySelector('[aria-labelledby=awaiting-production-heading] [role=alert]') !== null"));
  await send("Page.navigate", { url: `${base}?page=replenishment&mgrRec=1` });
  await waitFor("document.querySelector('#request-delivery-actions button') !== null");
  assert.doesNotMatch(await evaluate("document.querySelector('#request-delivery-actions').innerText"), /Physical inspector|Condition \/ inspection note/);
  await evaluate("document.querySelector('#request-delivery-actions button').click()");
  await waitFor("document.querySelector('#awaiting-production-heading') && document.body.innerText.includes('PR-20261023-000004')");
  assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0, "navigating from Request creates no draft");
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "browser fixture made no network writes");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:5173/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "no external requests");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, startedOnce: true, resumedWithoutDuplicate: true, requestReadErrorVisible: true, requestNavigation: true, errors, externalRequests: [] }, null, 2));
  console.log("PASS: desktop/mobile queue, no auto-draft, linked start/resume, request-read error, no writes or overflow");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
