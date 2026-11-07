import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-context-remove-20261026");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-req-context-"));
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
  throw new Error(`Timed out: ${expression}; page: ${await evaluate("document.body.innerText.slice(0,3000)")}; browser: ${errors.join(" | ")}`);
};
const check = (name, actual, expected = true) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const key = async (key, code, virtualKey) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: virtualKey });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKey });
};
const setInput = (selector, value) => evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.getClientRects().length);if(!node)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const screenshot = async (name, fullPage = false) => {
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: fullPage });
  await writeFile(path.join(output, name), Buffer.from(shot.data, "base64"));
};
const rowExpression = (width) => `([...document.querySelectorAll(${JSON.stringify(width >= 900 ? ".manager-request-edit-table tbody tr" : ".manager-request-mobile-line")})].find(row=>row.textContent.includes('Fried Chicken – Quarter Leg')))`;
const geometry = () => evaluate(`(()=>{const table=document.querySelector('.manager-request-edit-table');return {headers:[...table.tHead.rows[0].cells].map(c=>c.textContent.trim().replace(/\\s+/g,' ')),rows:[...table.tBodies[0].rows].map(r=>r.cells.length),widths:[...table.tHead.rows[0].cells].map(c=>Math.round(c.getBoundingClientRect().width*10)/10),tableWidth:Math.round(table.getBoundingClientRect().width*10)/10}})()`);

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
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: width === 390 });
    await send("Emulation.setTouchEmulationEnabled", { enabled: width === 390 });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&visualShell=1&contextRemove=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    check(`${width}: prepare`, await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Prepare Request'))?.click()===undefined"));
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length===6");
    const layout = await evaluate(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {main:box('.manager-request-authoring-main'),add:box('.manager-request-add-item'),heading:box('.manager-request-section-heading'),side:box('.manager-request-authoring-side'),lines:box('.manager-request-lines'),table:box('.manager-request-table-wrap'),scrollY:window.scrollY,pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`);
    check(`${width}: no page overflow`, layout.pageOverflow <= 1);
    check(`${width}: heading directly follows Add`, layout.heading.top - layout.add.bottom >= 0 && layout.heading.top - layout.add.bottom <= 24);
    check(`${width}: table follows heading`, layout.lines.top >= layout.heading.bottom && layout.lines.top - layout.heading.bottom <= 24);
    if (width >= 1100) {
      check(`${width}: details beside editor`, layout.side.left > layout.main.right);
      check(`${width}: preparation panels align at top`, Math.abs(layout.side.top - layout.main.top) <= 1);
      check(`${width}: heading and counter share a row`, await evaluate("(()=>{const heading=document.querySelector('.manager-request-section-heading');const label=heading.firstElementChild.getBoundingClientRect(),counter=heading.querySelector('.manager-request-selection-toolbar').getBoundingClientRect();return label.top<counter.bottom&&counter.top<label.bottom&&counter.right<=document.querySelector('.manager-request-authoring-main').getBoundingClientRect().right+1&&counter.width>=320})()"));
      check(`${width}: table below details`, layout.lines.top >= layout.side.bottom);
      check(`${width}: table spans both columns`, layout.table.left <= layout.main.left + 1 && layout.table.right >= layout.side.right - 1);
    } else check(`${width}: details stack after lines`, layout.side.top >= layout.lines.bottom);
    const base = await geometry();
    check(`${width}: eight headers`, base.headers.length, 8);
    check(`${width}: header order`, base.headers.map(label=>label.replace(/\s+/g,'').slice(0,10)), ["Item", "Unit", "Usablestoc", "Recordedmi", "Openreques", "Suggestedg", "Requestqty", "Status"]);
    check(`${width}: eight cells per suggested row`, base.rows.every(n=>n===8));
    check(`${width}: suggested Remove absent`, await evaluate("![...document.querySelectorAll('.manager-request-edit-table tbody tr, .manager-request-mobile-line')].some(r=>r.textContent.includes('Buko Juice')&&r.querySelector('.is-remove'))"));
    check(`${width}: zero count`, await evaluate("document.body.innerText.includes('Items in request: 0')"));
    await screenshot(`after-empty-${width}.png`);
    check(`${width}: five autocomplete options`, await setInput("#request-item-search", "chicken"));
    await waitFor("document.querySelectorAll('[role=listbox] [role=option]').length===5");
    if (width === 1502) {
      await evaluate("document.querySelector('#request-item-search').focus()");
      await key("Escape", "Escape", 27);
      check("Escape closes suggestions", await evaluate("!document.querySelector('[role=listbox]')"));
      await key("Enter", "Enter", 13);
      check("Enter cannot add a hidden suggestion", await evaluate("document.querySelectorAll('.manager-request-edit-table tbody tr').length===6"));
      await evaluate("document.querySelector('#request-item-search').focus()");
      await setInput("#request-item-search", "chicken");
      await waitFor("document.querySelectorAll('[role=listbox] [role=option]').length===5");
    }
    check(`${width}: suggestions do not cover heading`, await evaluate("document.querySelector('[role=listbox]').getBoundingClientRect().bottom <= document.querySelector('.manager-request-section-heading').getBoundingClientRect().top"));
    check(`${width}: item rows stay below suggestions`, await evaluate(`document.querySelector('[role=listbox]').getBoundingClientRect().bottom < document.querySelector(${JSON.stringify(width >= 900 ? ".manager-request-table-wrap" : ".manager-request-mobile-lines")}).getBoundingClientRect().top`));
    if (width >= 1100) {
      check(`${width}: details remain aligned during search`, await evaluate("(()=>{const side=document.querySelector('.manager-request-authoring-side').getBoundingClientRect(),main=document.querySelector('.manager-request-authoring-main').getBoundingClientRect();return Math.abs(side.top-main.top)<=1&&side.left>main.right})()"));
    }
    await screenshot(`after-search-${width}.png`);
    check(`${width}: search`, await setInput("#request-item-search", "fried chicken"));
    await waitFor("Boolean(document.querySelector('[role=listbox] button'))");
    check(`${width}: autocomplete match`, await evaluate("document.querySelector('[role=listbox] button')?.textContent.includes('Fried Chicken – Quarter Leg')"));
    check(`${width}: autocomplete add`, await evaluate("document.querySelector('[role=listbox] button')?.click()===undefined"));
    await waitFor("Boolean(document.querySelector('[aria-label=\"Fried Chicken – Quarter Leg requested quantity (pcs)\"]'))");
    check(`${width}: initial quantity zero`, await evaluate("[...document.querySelectorAll('[aria-label=\"Fried Chicken – Quarter Leg requested quantity (pcs)\"]')].find(n=>n.getClientRects().length)?.value"), "0");
    await setInput("#request-item-search", "fried chicken");
    check(`${width}: duplicate excluded`, await evaluate("!document.querySelector('[role=listbox]')&&document.body.innerText.includes('Already listed items cannot be added twice')"));
    await setInput("#request-item-search", "");
    const added = await geometry();
    check(`${width}: fixed headers`, added.headers, base.headers);
    check(`${width}: fixed widths after add`, added.widths, base.widths);
    check(`${width}: eight cells after add`, added.rows.every(n=>n===8));
    check(`${width}: quantity two`, await setInput('[aria-label="Fried Chicken – Quarter Leg requested quantity (pcs)"]', "2"));
    await waitFor("document.body.innerText.includes('Items in request: 1')");
    const row = rowExpression(width);
    check(`${width}: input does not select`, await evaluate(`${row}?.classList.contains('is-selected-manual')`), false);
    if (width === 1280) {
      await evaluate("document.querySelector('#request-item-search')?.focus()");
      check("desktop Remove hidden at rest", await evaluate(`getComputedStyle(${row}.querySelector('.is-remove')).visibility`), "hidden");
      const point = await evaluate(`(()=>{const r=${row}.querySelector('td:first-child').getBoundingClientRect();return {x:r.left+12,y:r.top+r.height/2}})()`);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
      check("desktop hover reveals Remove", await evaluate(`getComputedStyle(${row}.querySelector('.is-remove')).visibility`), "visible");
    }
    if (width === 1502) {
      await evaluate(`${row}?.querySelector('.manager-request-guidance summary')?.click()`);
      check("stock icon does not select", await evaluate(`${row}?.classList.contains('is-selected-manual')`), false);
      await evaluate(`${row}?.querySelector('.manager-request-guidance summary')?.click()`);
      await evaluate(`${row}?.focus()`);
      await key(" ", "Space", 32);
      check("keyboard selects manual row", await evaluate(`${row}?.classList.contains('is-selected-manual')`));
    }
    if (width >= 900) {
      await evaluate(`${row}?.querySelector('td:first-child')?.click()`);
    } else if (width === 390) {
      const point = await evaluate(`(()=>{const r=${row}.querySelector('strong').getBoundingClientRect();return {x:r.left+10,y:r.top+10}})()`);
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else await evaluate(`${row}?.querySelector('strong')?.click()`);
    await waitFor(`${row}?.classList.contains('is-selected-manual')`);
    check(`${width}: Remove visible on selection`, await evaluate(`getComputedStyle(${row}.querySelector('.is-remove')).visibility`), "visible");
    if (width >= 1100) check(`${width}: Remove sits at row end without covering stock guidance`, await evaluate(`(()=>{const r=${row},button=r.querySelector('.is-remove').getBoundingClientRect(),guidance=r.querySelector('.manager-request-suggestion-status').getBoundingClientRect(),bounds=r.getBoundingClientRect();return button.left>=guidance.right+4&&button.right<=bounds.right+1})()`));
    check(`${width}: selected widths fixed`, (await geometry()).widths, base.widths);
    await screenshot(`after-selected-${width}.png`);
    if (width === 390) await screenshot("after-selected-390-full.png", true);
    if (width === 1502) {
      await setInput("#request-item-search", "chicken");
      await waitFor("document.querySelectorAll('[role=listbox] [role=option]').length===4");
      await screenshot("after-selected-search-1502.png", true);
      await setInput("#request-item-search", "");
    }
    if (width === 1502) {
      await evaluate(`${row}?.querySelector('input')?.click()`);
      check("quantity click leaves selection stable", await evaluate(`${row}?.classList.contains('is-selected-manual')`));
      await evaluate("[...document.querySelectorAll('.manager-request-edit-table summary')].find(n=>n.closest('tr')?.textContent.includes('Buko Juice'))?.click()");
      check("stock info does not change selection", await evaluate(`${row}?.classList.contains('is-selected-manual')`));
      await evaluate(`${row}?.focus()`);
      await key("Tab", "Tab", 9);
      check("keyboard reaches Remove", await evaluate("document.activeElement?.getAttribute('aria-label')==='Remove Fried Chicken – Quarter Leg from request'"));
      await key(" ", "Space", 32);
    } else {
      await evaluate(`${row}?.querySelector('.is-remove')?.click()`);
    }
    await waitFor("!document.querySelector('[aria-label=\"Fried Chicken – Quarter Leg requested quantity (pcs)\"]')");
    check(`${width}: count after removal`, await evaluate("document.body.innerText.includes('Items in request: 0')"));
    if (width >= 1100) check(`${width}: toolbar stays one row with Undo`, await evaluate("(()=>{const toolbar=document.querySelector('.manager-request-selection-toolbar'),r=toolbar.getBoundingClientRect(),buttons=[...toolbar.querySelectorAll('button')].map(button=>button.getBoundingClientRect()),summary=toolbar.querySelector('.manager-request-selected-summary').getBoundingClientRect();return r.height<=50&&buttons.length===3&&buttons.every(b=>b.left>=r.left-1&&b.right<=r.right+1&&Math.abs((b.top+b.bottom-summary.top-summary.bottom)/2)<=2)})()"));
    check(`${width}: suggested rows retained`, (await geometry()).rows.length, 6);
    check(`${width}: removed widths fixed`, (await geometry()).widths, base.widths);
    check(`${width}: undo`, await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Undo remove'))?.click()===undefined"));
    await waitFor("Boolean(document.querySelector('[aria-label=\"Fried Chicken – Quarter Leg requested quantity (pcs)\"]'))");
    check(`${width}: quantity restored`, await evaluate("[...document.querySelectorAll('[aria-label=\"Fried Chicken – Quarter Leg requested quantity (pcs)\"]')].find(n=>n.getClientRects().length)?.value"), "2");
    check(`${width}: count restored`, await evaluate("document.body.innerText.includes('Items in request: 1')"));
    check(`${width}: undo widths fixed`, (await geometry()).widths, base.widths);
    await screenshot(`after-undo-${width}.png`);
  }
  check("no browser exceptions", errors.length, 0);
  check("no external requests or writes", requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))));
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, browserExceptions: errors, requests: requests.length }, null, 2));
  console.log(`PASS: ${checks.length} checks at 1502, 1280, 820, and 390 px`);
} finally {
  socket?.close();
  chrome.kill();
}
