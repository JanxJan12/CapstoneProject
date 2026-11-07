import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-clear-all-20261026");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-req-clear-all-"));
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
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(-1200)")}`);
};
const check = (name, actual, expected = true) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const click = (label, dialog = false) => evaluate(`(()=>{const root=${dialog ? "document.querySelector('[role=alertdialog]')" : "document"};const button=[...root.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(label)});if(!button)return false;button.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.getClientRects().length);if(!node)return false;const proto=node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const shot = async (name) => {
  await evaluate("document.querySelector('.manager-request-sheet')?.scrollIntoView({block:'start'})");
  await pause(350);
  const image = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(output, name), Buffer.from(image.data, "base64"));
};
const table = () => evaluate(`(()=>{const t=document.querySelector('.manager-request-edit-table');return {headers:[...t.tHead.rows[0].cells].map(c=>Math.round(c.getBoundingClientRect().width)),rows:t.tBodies[0].rows.length,empty:t.tBodies[0].rows[0]?.cells[0]?.colSpan===8,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`);

try {
  let port;
  for (let n = 0; n < 100; n++) {
    try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]); break; }
    catch { await pause(100); }
  }
  assert.ok(port, "Chrome debugger unavailable");
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  socket = new WebSocket(targets.find((entry) => entry.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    else if (message.method === "Page.javascriptDialogOpening") void send("Page.handleJavaScriptDialog", { accept: true });
    else if (message.method === "Network.requestWillBeSent") requests.push({ method: message.params.request.method, url: message.params.request.url });
  });
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await mkdir(output, { recursive: true });
  const measurements = [];
  for (const width of [1280, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: width === 390 });
    await send("Emulation.setTouchEmulationEnabled", { enabled: width === 390 });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&visualShell=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    check(`${width}: prepare`, await click("Prepare Request"));
    await waitFor("Boolean(document.querySelector('.manager-request-table-empty'))");
    check(`${width}: new sheet empty`, (await table()).empty);
    check(`${width}: suggest action`, await click("Suggest Items"));
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===6");
    check(`${width}: refresh action after suggestion`, await evaluate("[...document.querySelectorAll('.manager-request-section-actions > button')].some(b=>b.textContent.trim()==='Refresh Suggestions')"));
    check(`${width}: priority edit`, await setInput('.manager-request-details select', "priority"));
    const needed = await evaluate("document.querySelector('.manager-request-details input[type=datetime-local]').value");
    check(`${width}: manual add search`, await setInput('#request-item-search', "flour"));
    await waitFor("document.querySelector('[role=listbox]')?.innerText.includes('All-Purpose Flour')");
    check(`${width}: manual add`, await evaluate("(()=>{document.querySelector('[role=listbox] button').click();return true})()"));
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===7");
    const before = await table();
    check(`${width}: eight headers`, before.headers.length, 8);
    await shot(`before-${width}.png`);
    check(`${width}: open confirmation`, await click("Clear All Items"));
    await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
    check(`${width}: cancel`, await click("Cancel", true));
    await waitFor("!document.querySelector('[role=alertdialog]')");
    check(`${width}: cancellation retains seven rows`, (await table()).rows, 7);
    check(`${width}: confirm open`, await click("Clear All Items"));
    await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
    check(`${width}: confirm clear`, await click("Clear all items", true));
    await waitFor("document.querySelector('.manager-request-table-empty')?.colSpan===8");
    const empty = await table();
    check(`${width}: empty row and stable header proportions`, empty.empty && empty.rows === 1 && (width < 900 || empty.headers.every((n, i) => Math.abs(n / empty.headers.reduce((a, b) => a + b, 0) - before.headers[i] / before.headers.reduce((a, b) => a + b, 0)) < 0.005)));
    check(`${width}: request details preserved`, await evaluate(`document.querySelector('.manager-request-details select').value==='priority'&&document.querySelector('.manager-request-details input[type=datetime-local]').value===${JSON.stringify(needed)}`));
    check(`${width}: no quantities or clear controls`, await evaluate("!document.querySelector('.manager-request-selection-toolbar') && !document.querySelector('.manager-request-edit-table input[data-request-item-id]')"));
    await shot(`cleared-${width}.png`);
    check(`${width}: rerender through priority`, await setInput('.manager-request-details select', "emergency"));
    check(`${width}: rerender stays empty`, (await table()).empty);
    check(`${width}: autocomplete search`, await setInput('#request-item-search', "soy"));
    await waitFor("document.querySelector('[role=listbox]')?.innerText.includes('Soy Sauce')");
    check(`${width}: autocomplete does not repopulate`, (await table()).empty);
    const laterNeeded = new Date(new Date(needed).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    check(`${width}: date edit`, await setInput('.manager-request-details input[type=datetime-local]', laterNeeded));
    check(`${width}: date edit stays empty`, (await table()).empty);
    check(`${width}: no duplicate header refresh`, await evaluate("![...document.querySelectorAll('.manager-page-header button')].some(b=>b.textContent.trim()==='Refresh')"));
    check(`${width}: suggest updates changed date`, await click("Suggest Items"));
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===6");
    check(`${width}: clear refreshed rows`, await click("Clear All Items"));
    await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
    check(`${width}: confirm refreshed clear`, await click("Clear all items", true));
    await waitFor("Boolean(document.querySelector('.manager-request-table-empty'))");
    check(`${width}: manual add after clear`, await evaluate("(()=>{const input=document.querySelector('#request-item-search');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'soy');input.dispatchEvent(new Event('input',{bubbles:true}));return true})()"));
    await waitFor("document.querySelector('[role=listbox]')?.innerText.includes('Soy Sauce')");
    check(`${width}: select individual suggested item`, await evaluate("(()=>{document.querySelector('[role=listbox] button').click();return true})()"));
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===1&&!document.querySelector('.manager-request-table-empty')");
    check(`${width}: individual row has Remove`, await evaluate("Boolean(document.querySelector('[aria-label=\"Remove Soy Sauce from request\"]'))"));
    await shot(`manual-after-clear-${width}.png`);
    check(`${width}: independent Clear request`, await click("Clear request"));
    await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
    check(`${width}: confirm Clear request`, await click("Clear request", true));
    await waitFor("Boolean(document.querySelector('.manager-request-table-empty'))");
    check(`${width}: Clear request leaves hidden suggestions hidden`, (await table()).empty);
    check(`${width}: explicit suggest after clear`, await click("Suggest Items"));
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===6");
    check(`${width}: stock suggestions restored`, (await table()).rows, 6);
    await shot(`restored-${width}.png`);
    measurements.push({ width, before, empty, restored: await table() });
  }
  check("no browser exceptions", errors.length, 0);
  check("no external requests or writes", requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))));
  await writeFile(path.join(output, "result.json"), JSON.stringify({ result: "PASS", checks, measurements, browserExceptions: errors, networkWrites: 0 }, null, 2));
  console.log(`PASS: ${checks.length} checks at 1280 and 390 px`);
} finally {
  socket?.close(); chrome.kill();
}
