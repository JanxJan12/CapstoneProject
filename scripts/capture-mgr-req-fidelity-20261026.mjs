import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase), "Pass before or after");
const output = path.resolve(`qa/mgr-req-fidelity-20261026/${phase}`);
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-req-fidelity-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map(), errors = [], requests = [], captures = [];
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
  throw new Error(`Timed out: ${expression}`);
};
const click = (label) => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&node.textContent.includes(${JSON.stringify(label)}));if(!button)return false;button.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>node.getClientRects().length);if(!node)return false;const descriptor=Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value');descriptor.set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const screenshot = async (state, width) => {
  if (!await evaluate("Boolean(document.querySelector('.manager-request-review'))"))
    await evaluate("document.querySelector('.manager-request-sheet')?.scrollIntoView({block:'start'})");
  await pause(150);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const filename = `${state}-${width}.png`;
  await writeFile(path.join(output, filename), Buffer.from(shot.data, "base64"));
  captures.push(filename);
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
  for (const width of [1502, 1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&visualShell=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
    await screenshot("zero", width);
    assert.equal(await setInput('input[placeholder="Search item name"]', "flour"), true);
    await waitFor("Boolean(document.querySelector('option[value=flour]'))");
    assert.equal(await setInput('.manager-request-add-item select', "flour"), true);
    await screenshot("add-item", width);
    assert.equal(await click("Add item"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
    await screenshot("added-row", width);
    assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.06"), true);
    assert.equal(await setInput('input[aria-label="All-Purpose Flour requested quantity (kg)"]', "1.25"), true);
    await waitFor("document.body.innerText.includes('Items in request: 2')");
    await screenshot("positive", width);
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.getClientRects().length&&button.getAttribute('aria-label')==='Remove All-Purpose Flour from request')?.click()");
    await waitFor("!document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]')");
    await screenshot("remove", width);
    assert.equal(await click("Undo remove"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
    await screenshot("undo", width);
    await evaluate("window.confirm=()=>true");
    assert.equal(await click("Clear request"), true);
    await waitFor("document.body.innerText.includes('Items in request: 0')");
    await screenshot("clear", width);
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&visualShell=1&coveredGaps=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
    await evaluate("document.querySelector('.manager-request-gap-help summary')?.click()");
    await screenshot("zero-gap", width);
    assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.02"), true);
    assert.equal(await click("Review request"), true);
    await waitFor("Boolean(document.querySelector('.manager-request-review'))");
    await screenshot("review-missing", width);
    assert.equal(await setInput('input[aria-label="Soy Sauce override reason"]', "Confirmed additional need"), true);
    await screenshot("review-ready", width);
    assert.equal(await evaluate("Boolean(document.querySelector('[role=dialog][aria-modal=true]'))"), true);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor("!document.querySelector('.manager-request-review')");
    assert.equal(await evaluate("document.activeElement?.textContent?.includes('Unsaved request sheet')"), true, "Escape returns focus to the request sheet");
  }
  assert.equal(errors.length, 0, `browser exceptions: ${errors.join(" | ")}`);
  assert.ok(requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))), "Fixture made an external request or write");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ phase, captures, browserExceptions: errors.length, networkWrites: 0 }, null, 2));
  console.log(`${phase}: ${captures.length} screenshots, no browser exceptions or network writes`);
} finally {
  socket?.close();
  chrome.kill();
}
