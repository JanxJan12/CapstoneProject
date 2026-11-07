import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-ux-03b-rendered-20261025");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-req-ux-03b-"));
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
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,900)")}; ${errors.join(" | ")}`);
};
const click = (label) => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&node.textContent.includes(${JSON.stringify(label)}));if(!button)return false;button.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const setSelect = (selector, value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const toggle = (label) => evaluate(`(()=>{const node=[...document.querySelectorAll('input[type=checkbox]')].find(node=>node.getClientRects().length&&node.getAttribute('aria-label')===${JSON.stringify(label)});if(!node)return false;node.click();return true})()`);
const screenshot = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(output, name), Buffer.from(shot.data, "base64"));
};
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
    else if (message.method === "Network.requestWillBeSent") requests.push({ method: message.params.request.method, url: message.params.request.url });
  });
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await mkdir(output, { recursive: true });
  for (const width of [1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    await waitFor("document.body.innerText.includes('Suggested items to review')");
    const rowSelector = width < 900 ? ".manager-request-mobile-line" : ".manager-request-edit-table tbody tr";
    assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length`), 4, `${width}: proposal rows shown before selection`);
    assert.equal(await evaluate("document.body.innerText.includes('0 selected items')"), true, `${width}: no auto selection`);
    assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-add-item input[type=search]'))"), true, "manual catalog search retained");
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'));return row?.textContent.includes('bottles')&&row?.textContent.includes('Expiry unverified')&&row?.querySelector('summary')?.getAttribute('aria-label').includes('Open requests cover the current shortage')})()`), true, `${width}: catalog unit and accessible zero-gap advisory`);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: no page overflow`);
    if (width < 1280) await evaluate(`document.querySelector(${JSON.stringify(rowSelector)})?.scrollIntoView({block:'center'})`);
    await screenshot(`suggestions-${width}.png`);
    assert.equal(await evaluate("window.__issuePayload === undefined"), true);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    await waitFor("document.body.innerText.includes('1 selected item')");
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(rowSelector)}+' input[aria-label="Soy Sauce requested quantity (L)"]')?.value`), "0.06", `${width}: scale-aware suggestion`);
    assert.equal(await toggle("Select Buko Juice (bottles)"), true);
    await waitFor("document.body.innerText.includes('2 selected items')");
    assert.equal(await click("Review request"), true);
    await waitFor("document.body.innerText.includes('Buko Juice: enter a positive quantity')");
    assert.equal(await setInput("input[aria-label='Buko Juice requested quantity (bottles)']", "2"), true);
    assert.equal(await click("Review request"), true);
    await waitFor("document.body.innerText.includes('Buko Juice: explain the suggested quantity override')");
    assert.equal(await setInput("input[aria-label='Buko Juice override reason']", "Manager reviewed the zero gap"), true);
    assert.equal(await toggle("Select Buko Juice (bottles)"), true);
    await waitFor("document.body.innerText.includes('1 selected item')");
    assert.equal(await evaluate("window.__issuePayload === undefined"), true, "selection and review validation do not issue");
    if (width === 1280) {
      assert.equal(await evaluate("(()=>{const checkbox=document.querySelector('input[aria-label=\"Select Buko Juice (bottles)\"]');checkbox.focus();return document.activeElement===checkbox})()"), true, "checkbox can receive keyboard focus");
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await waitFor("document.querySelector('input[aria-label=\"Select Buko Juice (bottles)\"]').checked");
      assert.equal(await toggle("Select Buko Juice (bottles)"), true);
      assert.equal(await setSelect(".manager-request-add-item select", "flour"), true);
      assert.equal(await click("Add item"), true);
      await waitFor("document.querySelector('.manager-request-edit-table')?.textContent.includes('All-Purpose Flour')");
      assert.equal(await evaluate("document.querySelector('input[aria-label=\"Select All-Purpose Flour (kg)\"]')?.checked"), true, "non suggested catalog item remains manually addable");
      assert.equal(await evaluate("document.querySelectorAll('.manager-request-edit-table tbody tr').length"), 5, "manual row joins proposal-backed workspace");
      assert.equal(await evaluate("window.__issuePayload === undefined"), true);
    }
    await screenshot(`selected-${width}.png`);
    checks.push({ width, proposalRows: true, checkboxSelection: true, quantityValidation: true, noOverflow: true });
  }
  assert.equal(errors.length, 0, `browser exceptions: ${errors.join(" | ")}`);
  assert.ok(requests.every(({ url }) => url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:")), "external request");
  assert.ok(requests.every(({ method }) => method === "GET"), "network write");
  const result = { result: "PASS", checks, browserExceptions: errors.length, externalRequests: 0, networkWrites: 0 };
  await writeFile(path.join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  socket?.close(); chrome.kill(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
