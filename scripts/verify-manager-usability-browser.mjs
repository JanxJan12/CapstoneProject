import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html";
const output = path.resolve("qa/manager-usability-rendered-20261023");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-manager-usability-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map();
const errors = [], requests = [], results = [];
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
  for (let n = 0; n < 80; n++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,500)")}`);
};
const clickOrder = (suffix, width) => evaluate(width < 768
  ? `([...document.querySelectorAll('button')].find(b => b.textContent.includes('Details for ORD-${suffix}')))?.click()`
  : `([...document.querySelectorAll('tr')].find(r => r.textContent.includes('ORD-${suffix}')))?.click()`);
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
  for (const [width, height] of [[390, 844], [1280, 900]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await send("Page.navigate", { url: `${base}?page=requests&history=1&usability=1` });
    await waitFor("document.body.innerText.includes('PR-PARTIAL')");
    assert.equal(await evaluate("document.querySelectorAll('.manager-request-history-row').length"), 4);
    assert.equal(await evaluate("[...document.querySelectorAll('.manager-request-history-row')].filter(e => e.textContent.includes('Past needed date')).length"), 2);
    assert.match(await evaluate("[...document.querySelectorAll('.manager-request-history-row')].find(e => e.textContent.includes('PR-PARTIAL')).innerText"), /Partially received[\s\S]*Outstanding: 1 of 1 item lines/i);
    assert.doesNotMatch(await evaluate("[...document.querySelectorAll('.manager-request-history-row')].find(e => e.textContent.includes('PR-FULL')).innerText"), /Past needed date/);
    const collapsed = await evaluate("[...document.querySelectorAll('details')].find(e => e.querySelector('summary')?.textContent.includes('Legacy Requests')).open");
    assert.equal(collapsed, false);
    await evaluate("[...document.querySelectorAll('details')].find(e => e.querySelector('summary')?.textContent.includes('Legacy Requests')).open=true");
    await waitFor("document.body.innerText.includes('No legacy requests.')");
    await evaluate("[...document.querySelectorAll('.manager-request-history-row')].find(e => e.textContent.includes('PR-PARTIAL')).querySelector('button').click()");
    await waitFor("document.querySelector('[aria-label=\"Fulfillment summary\"]')?.innerText.includes('2 Receiving documents')");
    assert.match(await evaluate("document.querySelector('[aria-label=\"PR-PARTIAL detail\"]').innerText"), /Past needed date[\s\S]*2 Receiving documents[\s\S]*RR-1[\s\S]*RR-2/);
    let shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(path.join(output, `requests-${width}.png`), Buffer.from(shot.data, "base64"));
    results.push({ width, case: "requests" });

    await send("Page.navigate", { url: `${base}?page=requests&history=1&legacyEntry=1` });
    await waitFor("document.body.innerText.includes('PR-SYNTHETIC-001')");
    await evaluate("[...document.querySelectorAll('details')].find(e => e.querySelector('summary')?.textContent.includes('Legacy Requests')).open=true");
    await waitFor("document.body.innerText.includes('Start Receiving')");
    assert.match(await evaluate("document.body.innerText"), /Legacy Requests[\s\S]*Single-item requests[\s\S]*Soy Sauce[\s\S]*Start Receiving/);
    shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(path.join(output, `legacy-${width}.png`), Buffer.from(shot.data, "base64"));
    results.push({ width, case: "legacy" });

    await send("Page.navigate", { url: `${base}?page=orders` });
    await waitFor("document.body.innerText.includes('ORD-0003')");
    for (const [suffix, fee] of [["0001", true], ["0002", false], ["0003", false]]) {
      await clickOrder(suffix, width);
      await waitFor(`document.querySelector('[aria-label="Details for ORD-${suffix}"]')?.innerText.includes('Item subtotal')`);
      const details = await evaluate(`document.querySelector('[aria-label="Details for ORD-${suffix}"]').innerText`);
      assert.match(details, /Item subtotal[\s\S]*₱120\.00/);
      assert.equal(details.includes("Delivery fee"), fee);
      assert.match(details, fee ? /Order total[\s\S]*₱170\.00/ : /Order total[\s\S]*₱120\.00/);
    }
    await clickOrder("0001", width);
    shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(path.join(output, `orders-${width}.png`), Buffer.from(shot.data, "base64"));
    results.push({ width, case: "orders" });
    await send("Page.navigate", { url: `${base}?page=orders&missingFinance=1` });
    await waitFor("document.body.innerText.includes('ORD-0001')");
    await clickOrder("0001", width);
    await waitFor("document.body.innerText.includes('Stored price breakdown unavailable')");
    assert.doesNotMatch(await evaluate("document.querySelector('[aria-label=\"Details for ORD-0001\"]').innerText"), /Delivery fee/);
    const dimensions = await evaluate("({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})");
    assert.ok(dimensions.scroll <= dimensions.width + 1, `orders ${width}: horizontal overflow`);
  }
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "fixture made no writes");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:58435/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "fixture made no external requests");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ evidence: "synthetic Manager-only browser fixture", results, errors, externalRequests: [] }, null, 2));
  console.log(`PASS: ${results.length} desktop/mobile rendered cases, fallback, no writes`);
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
