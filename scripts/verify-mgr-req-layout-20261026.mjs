import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-layout-20261026");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-req-layout-"));
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
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,900)")}`);
};
const click = (label) => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&node.textContent.includes(${JSON.stringify(label)}));if(!button)return false;button.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
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
  for (const width of [1280, 1502, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&visualShell=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    await waitFor("document.body.innerText.includes('Suggested items to review')");
    await pause(200);
    const geometry = await evaluate(`(()=>{const box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null};const table=document.querySelector('.manager-request-table-wrap');const date=document.querySelector('.manager-request-details input[type="datetime-local"]');const side=document.querySelector('.manager-request-authoring-side');const buttons=[...document.querySelectorAll('.manager-request-actions button')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}});return {viewport:innerWidth,pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,main:box('.manager-request-authoring-main'),side:box('.manager-request-authoring-side'),add:box('.manager-request-add-item'),lines:box('.manager-request-lines'),table:box('.manager-request-table-wrap'),tableOverflow:table?.scrollWidth-table?.clientWidth??0,date:box('.manager-request-details input[type="datetime-local"]'),dateContentOverflow:date?.scrollWidth-date?.clientWidth??0,buttons,tableVisible:!!table?.getClientRects().length}})()`);
    assert.ok(geometry.pageOverflow <= 1, `${width}: no horizontal page overflow`);
    if (width >= 1100) {
      assert.ok(geometry.lines.y - geometry.add.bottom < 80, `${width}: suggestions follow add item without large gap`);
      assert.ok(geometry.tableOverflow <= 1, `${width}: table fits without horizontal scroll`);
      assert.ok(geometry.date.right <= geometry.side.right - 8, `${width}: date stays inside details`);
      assert.ok(Math.abs(geometry.buttons[0].y - geometry.buttons[1].y) < 2, `${width}: action buttons share a row`);
      assert.ok(geometry.table.width >= 800, `${width}: table has readable width`);
    }
    assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"Remove Buko Juice from request\"]'))"), false, `${width}: untouched unchecked Buko Juice has no Remove`);
    await screenshot(`layout-${width}.png`);
    if (width < 1100) {
      await evaluate("document.querySelector('.manager-request-lines')?.scrollIntoView({block:'start'})");
      await pause(100);
      await screenshot(`suggestions-${width}.png`);
      await evaluate("document.querySelector('.manager-request-authoring-side')?.scrollIntoView({block:'center'})");
      await pause(100);
      await screenshot(`details-${width}.png`);
    }
    if (width === 1280 || width === 390) {
      assert.equal(await toggle("Select Buko Juice (bottles)"), true);
      await waitFor("document.body.innerText.includes('1 selected item')");
      assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"Remove Buko Juice from request\"]'))"), true, `${width}: selected line can be removed`);
      assert.equal(await toggle("Select Buko Juice (bottles)"), true);
      await waitFor("document.body.innerText.includes('0 selected items')");
      assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"Remove Buko Juice from request\"]'))"), false, `${width}: untouched deselected line has no Remove`);
      assert.equal(await setInput('input[aria-label="Buko Juice requested quantity (bottles)"]', "2"), true);
      await waitFor("Boolean(document.querySelector('[aria-label=\"Remove Buko Juice from request\"]'))");
      assert.equal(await click("Remove"), true);
      await waitFor("document.body.innerText.includes('Undo remove')");
      assert.equal(await click("Undo remove"), true);
      await waitFor("Boolean(document.querySelector('[aria-label=\"Remove Buko Juice from request\"]'))");
      assert.equal(await evaluate('document.querySelector(\'input[aria-label="Buko Juice requested quantity (bottles)"]\')?.value'), "2", `${width}: undo restores edited draft`);
    }
    if (width === 1280) {
      assert.equal(await toggle("Select all ready suggested items"), true);
      await waitFor("document.body.innerText.includes('5 selected items')");
      assert.equal(await evaluate("!document.querySelector('input[aria-label=\"Select Buko Juice (bottles)\"]').checked"), true, "edited zero-gap row without an override explanation stays unchecked");
      assert.equal(await evaluate("document.body.innerText.includes('1 suggested item was left unchecked')"), true, "bulk selection explains skipped rows");
      assert.equal(await toggle("Select all ready suggested items"), true);
      await waitFor("document.body.innerText.includes('0 selected items')");
      assert.equal(await evaluate('document.querySelector(\'input[aria-label="Buko Juice requested quantity (bottles)"]\')?.value'), "2", "bulk deselection preserves edited quantity");
      assert.equal(await evaluate("(()=>{const disclosure=[...document.querySelectorAll('.manager-request-edit-table tbody tr')].find(row=>row.textContent.includes('Buko Juice'))?.querySelector('.manager-request-override summary');disclosure?.click();return Boolean(disclosure)})()"), true);
      assert.equal(await setInput('input[aria-label="Buko Juice override reason"]', "Needed for delivery"), true);
      assert.equal(await toggle("Select all ready suggested items"), true);
      await waitFor("document.body.innerText.includes('6 selected items')");
      assert.equal(await evaluate("document.querySelector('input[aria-label=\"Select Buko Juice (bottles)\"]').checked"), true, "completed edit is included on reselect");
      assert.equal(await click("Refresh suggestions"), true);
      await waitFor("document.querySelector('input[aria-label=\"Buko Juice requested quantity (bottles)\"]')?.value === '2'");
      assert.equal(await evaluate("document.body.innerText.includes('6 selected items')"), true, "refresh preserves selection and manual edit");
      await screenshot("selection-mixed-1280.png");
    }
    checks.push({ width, ...geometry });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&coveredGaps=1" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  assert.equal(await click("Prepare Request"), true);
  await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
  assert.equal(await toggle("Select all ready suggested items"), true);
  await waitFor("document.body.innerText.includes('6 suggested items were left unchecked')");
  assert.equal(await evaluate("document.body.innerText.includes('0 selected items')"), true, "all-zero bulk action selects no lines");
  assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.02"), true);
  assert.equal(await toggle("Select Soy Sauce (L)"), true);
  assert.equal(await click("Review request"), true);
  await waitFor("document.body.innerText.includes('explain the suggested quantity override')");
  assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-review'))"), false, "review blocks missing override explanation");
  assert.equal(await evaluate("(()=>{const disclosure=[...document.querySelectorAll('.manager-request-edit-table tbody tr')].find(row=>row.textContent.includes('Soy Sauce'))?.querySelector('.manager-request-override summary');disclosure?.click();return Boolean(disclosure)})()"), true);
  assert.equal(await setInput('input[aria-label="Soy Sauce override reason"]', "Additional delivery need"), true);
  assert.equal(await click("Review request"), true);
  await waitFor("Boolean(document.querySelector('.manager-request-review'))");
  assert.equal(await click("Issue Request"), true);
  await waitFor("Boolean(window.__issuePayload)");
  assert.equal(await evaluate("window.__issuePayload.lines.length === 1 && window.__issuePayload.lines[0].inventory_item_id === 'soy' && window.__issuePayload.lines[0].quantity === 0.02"), true, "issue receives only the reviewed positive line");
  assert.equal(errors.length, 0, `browser exceptions: ${errors.join(" | ")}`);
  assert.ok(requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))), "fixture made no external requests or writes");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ result: "PASS", checks, browserExceptions: errors.length, networkWrites: 0 }, null, 2));
  console.log(JSON.stringify({ result: "PASS", checks: checks.map(({ width, pageOverflow, tableOverflow, dateContentOverflow }) => ({ width, pageOverflow, tableOverflow, dateContentOverflow })) }, null, 2));
} finally {
  socket?.close(); chrome.kill();
}
