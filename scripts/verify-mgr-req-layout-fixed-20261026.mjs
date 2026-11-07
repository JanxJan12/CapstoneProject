import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-layout-fixed-20261026");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-request-layout-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map(), errors = [], requests = [], widths = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  socket.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async (expression) => {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
};
const waitFor = async (expression) => {
  for (let n = 0; n < 120; n++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(-900)")}`);
};
const click = (label) => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent.trim()===${JSON.stringify(label)});if(!b)return false;b.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.getClientRects().length);if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const shot = async (name) => {
  await evaluate("document.querySelector('.manager-request-sheet')?.scrollIntoView({block:'start'})");
  await pause(100);
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(output, name), Buffer.from(result.data, "base64"));
};
const geometry = () => evaluate(`(()=>{
  const box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,right:r.right,bottom:r.bottom}:null};
  const wrap=document.querySelector('.manager-request-table-wrap');
  const toolbar=document.querySelector('.manager-request-selection-toolbar');
  const counter=toolbar?.querySelector('.manager-request-selected-summary');
  const actions=[...(toolbar?.querySelectorAll('button')??[])];
  const rect=(element)=>{const r=element?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height}:null};
  return {pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    main:box('.manager-request-authoring-main'),add:box('.manager-request-add-item'),heading:box('.manager-request-section-heading'),lines:box('.manager-request-lines'),
    side:box('.manager-request-authoring-side'),table:box('.manager-request-table-wrap'),
    tableOverflow:wrap?.scrollWidth-wrap?.clientWidth??0,
    toolbar:rect(toolbar),counter:rect(counter),actions:actions.map((button)=>({label:button.textContent.trim(),...rect(button)})),
    headers:document.querySelector('.manager-request-edit-table thead tr')?.cells.length};})()`);

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
  for (const width of [1502, 1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&visualShell=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    await waitFor("Boolean(document.querySelector('.manager-request-table-empty'))");
    assert.equal(await click("Suggest Items"), true);
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===6");
    const before = await geometry();
    const gap = Math.round(before.heading.y - before.add.bottom);
    assert.ok(gap >= 0 && gap <= 24, `${width}: suggestions heading follows Add an item (${gap}px)`);
    assert.ok(before.lines.y >= before.heading.bottom && before.lines.y - before.heading.bottom <= 24, `${width}: table follows the heading without unused space`);
    assert.ok(before.pageOverflow <= 1, `${width}: no page overflow`);
    assert.equal(before.headers, 8, `${width}: eight table headers remain`);
    assert.deepEqual(before.actions.map(({label})=>label), ["Clear All Items"], `${width}: only applicable clear action appears before editing`);
    assert.ok(before.actions.every(({left,right})=>left>=before.toolbar.left-1&&right<=before.toolbar.right+1), `${width}: actions fit within toolbar`);
    if(width>=1100) assert.ok(before.toolbar.height<=50&&before.actions.every(({top,bottom})=>Math.abs((top+bottom-before.counter.top-before.counter.bottom)/2)<=2&&bottom<=before.toolbar.bottom+1), `${width}: toolbar stays on one desktop row`);
    if (width >= 1100) {
      assert.ok(before.side.x > before.main.right, `${width}: Request Details is right of the left column`);
      assert.ok(before.lines.y >= before.side.bottom, `${width}: full-width table starts below Request Details`);
      assert.ok(before.table.x <= before.main.x + 1 && before.table.right >= before.side.right - 1, `${width}: table spans both top columns`);
      assert.ok(before.tableOverflow <= 1, `${width}: full-width table fits its region`);
    } else assert.ok(before.side.y >= before.lines.bottom, `${width}: Request Details stacks after suggestions`);
    await shot(`zero-${width}.png`);
    assert.equal(await setInput('input[placeholder="Type an item name"]', "flour"), true);
    await waitFor("document.querySelector('[role=listbox]')?.innerText.includes('All-Purpose Flour')");
    await shot(`manual-search-${width}.png`);
    assert.equal(await evaluate("(()=>{const b=document.querySelector('[role=listbox] button');if(!b)return false;b.click();return true})()"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
    await shot(`manual-added-${width}.png`);
    const manual = await geometry();
    assert.deepEqual(manual.actions.map(({label})=>label), ["Clear request", "Clear All Items"], `${width}: distinct clear actions appear after editing`);
    assert.ok(manual.pageOverflow <= 1, `${width}: manual row has no page overflow`);
    assert.ok(manual.heading.y - manual.add.bottom <= 24, `${width}: manual row keeps the compact heading position`);
    assert.equal(await setInput('input[aria-label="All-Purpose Flour requested quantity (kg)"]', "1.25"), true);
    await waitFor("document.body.innerText.includes('Items in request: 1')");
    await shot(`positive-${width}.png`);
    assert.equal(await evaluate("(()=>{const b=[...document.querySelectorAll('[aria-label=\"Remove All-Purpose Flour from request\"]')].find(x=>x.getClientRects().length);if(!b)return false;b.scrollIntoView({block:'nearest',inline:'nearest'});const wrap=b.closest('.manager-request-table-wrap');if(wrap&&b.getBoundingClientRect().right>wrap.getBoundingClientRect().right+1)return false;b.click();return true})()"), true);
    await waitFor("!document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]')");
    assert.equal(await click("Undo remove"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
    await evaluate("window.confirm=()=>true");
    assert.equal(await click("Clear request"), true);
    await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
    assert.equal(await evaluate("(()=>{const b=[...document.querySelectorAll('[role=alertdialog] button')].find(x=>x.textContent.trim()==='Clear request');if(!b)return false;b.click();return true})()"), true);
    await waitFor("document.body.innerText.includes('Items in request: 0')");
    assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.06"), true);
    await waitFor("document.body.innerText.includes('Items in request: 1')");
    assert.equal(await click("Review request"), true);
    await waitFor("Boolean(document.querySelector('.manager-request-review'))");
    assert.equal(await evaluate("document.querySelector('.manager-request-review')?.innerText.includes('0.06')"), true);
    await shot(`review-${width}.png`);
    assert.equal(await evaluate("(()=>{const b=document.querySelector('[aria-label=\"Close review\"]');if(!b)return false;b.click();return true})()"), true);
    await waitFor("!document.querySelector('.manager-request-review')");
    widths.push({ width, gapPx: gap, tableWidthPx: before.table?.width ?? null, tableOverflowPx: before.tableOverflow, manualTableOverflowPx: manual.tableOverflow });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1502, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&coveredGaps=1" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  assert.equal(await click("Prepare Request"), true);
  await waitFor("Boolean(document.querySelector('.manager-request-table-empty'))");
  assert.equal(await click("Suggest Items"), true);
  await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===6");
  assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.02"), true);
  assert.equal(await click("Review request"), true);
  await waitFor("Boolean(document.querySelector('.manager-request-review'))");
  assert.equal(await evaluate("document.body.innerText.includes('reason for changing the suggested gap')"), true, "zero-gap override requires explanation");
  await shot("zero-gap-review-1502.png");
  assert.equal(errors.length, 0, `browser exceptions: ${errors.join(" | ")}`);
  assert.ok(requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))), "no external requests or writes");
  const paths = ["initial suggestions", "catalog search", "manual add", "positive quantity", "remove", "undo", "clear", "review", "zero-gap explanation"];
  await writeFile(path.join(output, "result.json"), JSON.stringify({ result: "PASS", paths, widths, browserExceptions: 0, networkWrites: 0 }, null, 2));
  console.log(JSON.stringify({ result: "PASS", widths }, null, 2));
} finally {
  socket?.close(); chrome.kill();
}
