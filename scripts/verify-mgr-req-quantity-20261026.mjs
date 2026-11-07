import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-quantity-20261026");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-req-qty-"));
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
const setInput = (selector, value) => evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>node.getClientRects().length);if(!node)return false;const descriptor=Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value');descriptor.set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const value = (name) => evaluate(`([...document.querySelectorAll('input[aria-label=${JSON.stringify(name)}]')].find(node=>node.getClientRects().length)?.value)`);
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
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
    assert.equal(await evaluate("document.querySelectorAll('.manager-request-sheet input[type=checkbox]').length"), 0);
    assert.equal(await evaluate("document.body.innerText.includes('Items in request: 0')"), true);
    assert.equal(await value("Soy Sauce requested quantity (L)"), "0");
    const geometry = await evaluate(`(()=>{const table=document.querySelector('.manager-request-table-wrap');const side=document.querySelector('.manager-request-authoring-side').getBoundingClientRect();const date=document.querySelector('.manager-request-details input[type="datetime-local"]').getBoundingClientRect();return {pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,tableOverflow:table.scrollWidth-table.clientWidth,dateRight:date.right,sideRight:side.right}})()`);
    assert.ok(geometry.pageOverflow <= 1, `${width}: no horizontal page overflow`);
    if (width >= 1100) { assert.ok(geometry.tableOverflow <= 1, `${width}: table fits`); assert.ok(geometry.dateRight <= geometry.sideRight - 8, `${width}: date fits`); }
    await screenshot(`after-${width}.png`);
    if (width < 1100) {
      await evaluate("document.querySelector('.manager-request-lines')?.scrollIntoView({block:'start'})");
      await pause(100);
      await screenshot(`after-lines-${width}.png`);
    }
    assert.equal(await setInput('input[placeholder="Search item name"]', "flour"), true);
    await waitFor("Boolean(document.querySelector('option[value=flour]'))");
    assert.equal(await setInput('.manager-request-add-item select', "flour"), true);
    assert.equal(await click("Add item"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
    assert.equal(await evaluate("[...document.querySelectorAll('[aria-label=\"Remove All-Purpose Flour from request\"]')].filter(button=>button.getClientRects().length).length"), 1, `${width}: one visible manual Remove action`);
    await evaluate("[...document.querySelectorAll('.manager-request-mobile-line, .manager-request-edit-table tbody tr')].find(row=>row.textContent.includes('All-Purpose Flour') && row.getClientRects().length)?.scrollIntoView({block:'center'})");
    await pause(100);
    await screenshot(`manual-${width}.png`);
    checks.push({ width, ...geometry });
  }
  assert.equal(await evaluate("(()=>{const input=[...document.querySelectorAll('input[aria-label=\"Soy Sauce requested quantity (L)\"]')].find(node=>node.getClientRects().length);input?.focus();return document.activeElement===input})()"), true);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label') !== 'Soy Sauce requested quantity (L)'"), true, "keyboard Tab leaves quantity field");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&coveredGaps=1" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  assert.equal(await click("Prepare Request"), true);
  await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
  assert.equal(await evaluate("[...document.querySelectorAll('.manager-request-edit-table input[type=number]')].every(input=>input.value==='0')"), true);
  assert.equal(await evaluate("!document.querySelector('[aria-label=\"Remove Buko Juice from request\"]')"), true, "suggested zero has no Remove");
  assert.equal(await setInput('input[aria-label="Buko Juice requested quantity (bottles)"]', "2"), true);
  assert.equal(await evaluate("document.body.innerText.includes('Items in request: 1') && !document.querySelector('[aria-label=\"Remove Buko Juice from request\"]')"), true, "positive suggested quantity includes without Remove");
  assert.equal(await setInput('input[aria-label="Buko Juice requested quantity (bottles)"]', "0"), true);
  assert.equal(await evaluate("document.body.innerText.includes('Items in request: 0') && !document.querySelector('[aria-label=\"Remove Buko Juice from request\"]')"), true, "zero excludes suggested row without Remove");
  assert.equal(await click("Review request"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-review'))"), false);
  assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.02"), true);
  await waitFor("document.body.innerText.includes('Items in request: 1')");
  assert.equal(await click("Review request"), true);
  await waitFor("Boolean(document.querySelector('.manager-request-review'))");
  assert.equal(await evaluate("document.querySelectorAll('.manager-request-review tbody tr').length"), 1);
  await screenshot("after-review-missing-reason.png");
  assert.equal(await evaluate("document.querySelector('.manager-request-review button:last-child')?.disabled"), true, "missing override reason blocks issue");
  assert.equal(await setInput('input[aria-label="Soy Sauce override reason"]', "Additional delivery need"), true);
  assert.equal(await evaluate("document.querySelector('.manager-request-review button:last-child')?.disabled"), false);
  assert.equal(await click("Back to edit"), true);
  await waitFor("Boolean(document.querySelector('.manager-request-edit-table'))");
  assert.equal(await value("Soy Sauce requested quantity (L)"), "0.02");
  assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.0001"), true);
  assert.equal(await click("Review request"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-review'))"), false, "precision blocks review");
  assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', ""), true);
  assert.equal(await value("Soy Sauce requested quantity (L)"), "", "empty edit is retained");
  assert.equal(await click("Review request"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-review'))"), false, "empty edit blocks review");
  assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.02"), true);
  await evaluate("window.__proposalSoyAtNeed=0.02");
  assert.equal(await click("Refresh suggestions"), true);
  await waitFor("document.querySelector('.manager-request-edit-table tbody tr')?.textContent.includes('0.08')");
  assert.equal(await value("Soy Sauce requested quantity (L)"), "0.02", "refresh preserves intent");
  assert.equal(await setInput('.manager-request-details input[type="datetime-local"]', "2026-11-01T10:00"), true);
  assert.equal(await evaluate("document.body.innerText.includes('Refresh suggestions for the selected needed time')"), true, "needed date invalidates proposal");
  assert.equal(await value("Soy Sauce requested quantity (L)"), "0.02", "needed date preserves intent");
  assert.equal(await click("Review request"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-review'))"), false, "stale proposal blocks review");
  assert.equal(await click("Refresh suggestions"), true);
  await waitFor("!document.body.innerText.includes('Refresh suggestions for the selected needed time')");
  assert.equal(await setInput('input[placeholder="Search item name"]', "flour"), true);
  await waitFor("Boolean(document.querySelector('option[value=flour]'))");
  assert.equal(await setInput('.manager-request-add-item select', "flour"), true);
  assert.equal(await click("Add item"), true);
  await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
  assert.equal(await value("All-Purpose Flour requested quantity (kg)"), "0", "manual row starts at zero");
  assert.equal(await evaluate("[...document.querySelectorAll('[aria-label=\"Remove All-Purpose Flour from request\"]')].filter(button=>button.getClientRects().length).length"), 1, "manual zero has one visible Remove action");
  assert.equal(await evaluate("!document.querySelector('.manager-request-edit-table td:first-child button')"), true, "no action below item names");
  assert.equal(await evaluate("[...document.querySelectorAll('.manager-request-edit-table tbody tr')].every(row=>row.getBoundingClientRect().height<80)"), true, "rows stay compact");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Remove All-Purpose Flour from request\"]').click() || true"), true);
  await waitFor("!document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]')");
  assert.equal(await click("Undo remove"), true);
  assert.equal(await value("All-Purpose Flour requested quantity (kg)"), "0", "undo restores manual zero");
  assert.equal(await evaluate("!document.querySelector('.manager-request-add-item option[value=flour]')"), true, "manual duplicate excluded");
  assert.equal(await setInput('input[aria-label="All-Purpose Flour requested quantity (kg)"]', "1.25"), true);
  assert.equal(await evaluate("document.body.innerText.includes('Items in request: 2')"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('[aria-label=\"Remove All-Purpose Flour from request\"]')].filter(button=>button.getClientRects().length).length"), 1, "manual positive has one visible Remove action");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Remove All-Purpose Flour from request\"]').click() || true"), true);
  await waitFor("!document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]')");
  assert.equal(await click("Undo remove"), true);
  assert.equal(await value("All-Purpose Flour requested quantity (kg)"), "1.25", "undo restores manual quantity");
  await evaluate("window.__proposalFlourAtNeed=2");
  assert.equal(await click("Refresh suggestions"), true);
  await waitFor("[...document.querySelectorAll('.manager-request-edit-table tbody tr')].some(row=>row.textContent.includes('All-Purpose Flour') && row.cells[2]?.textContent.trim()==='2')");
  assert.equal(await evaluate("!document.querySelector('[aria-label=\"Remove All-Purpose Flour from request\"]')"), true, "manual item promoted to suggestion loses Remove");
  assert.equal(await value("All-Purpose Flour requested quantity (kg)"), "1.25", "promotion preserves quantity");
  await evaluate("window.__proposalFlourAtNeed=10");
  assert.equal(await click("Refresh suggestions"), true);
  await waitFor("[...document.querySelectorAll('.manager-request-edit-table tbody tr')].some(row=>row.textContent.includes('All-Purpose Flour') && row.cells[2]?.textContent.trim()==='10')");
  assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"Remove All-Purpose Flour from request\"]'))"), true, "catalog action returns when item is no longer suggested");
  await evaluate("window.confirm=()=>true");
  assert.equal(await evaluate("!document.querySelector('[aria-label=\"Remove Soy Sauce from request\"]')"), true, "suggested positive has no Remove");
  assert.equal(await click("Clear request"), true);
  assert.equal(await value("Soy Sauce requested quantity (L)"), "0");
  assert.equal(await evaluate("document.body.innerText.includes('Items in request: 0')"), true);
  assert.equal(await evaluate("!document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]')"), true, "clear removes manual rows");
  assert.equal(await setInput('input[aria-label="Food packs requested quantity (packs)"]', "1.5"), true);
  assert.equal(await click("Review request"), true);
  assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-review'))"), false, "whole-unit item rejects fraction");
  assert.equal(await setInput('input[aria-label="Food packs requested quantity (packs)"]', "0"), true);
  assert.equal(await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.08"), true);
  assert.equal(await click("Review request"), true);
  await waitFor("Boolean(document.querySelector('.manager-request-review'))");
  assert.equal(await setInput('input[aria-label="Soy Sauce override reason"]', "Confirmed extra requirement"), true);
  assert.equal(await evaluate("document.querySelector('.manager-request-review button:last-child')?.disabled"), false);
  assert.equal(await click("Issue Request"), true);
  await waitFor("Boolean(window.__issuePayload)");
  assert.equal(await evaluate("window.__issuePayload.lines.length === 1 && window.__issuePayload.lines[0].inventory_item_id === 'soy' && window.__issuePayload.lines[0].quantity === 0.08 && window.__issuePayload.expected.find(item=>item.id==='soy').valid_at_need === 0.02"), true);
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&splitRevisionEligible=1&revisionCatalogLine=1&request=split-issued" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  assert.equal(await evaluate("(()=>{const menu=document.querySelector('.manager-request-actions-menu');menu.open=true;return Boolean(menu)})()"), true);
  assert.equal(await click("Prepare new revision"), true);
  await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
  assert.equal(await value("All-Purpose Flour requested quantity (kg)"), "1.25", "historical revision line remains visible");
  assert.equal(await evaluate("!document.querySelector('[aria-label=\"Remove All-Purpose Flour from request\"]')"), true, "revision line is not a manual catalog add");
  await evaluate("document.querySelector('.manager-request-lines')?.scrollIntoView({block:'start'})");
  await pause(100);
  await screenshot("revision-1280.png");
  assert.equal(await evaluate("document.body.innerText.includes('Items in request: 2')"), true);
  assert.equal(await setInput('input[aria-label="All-Purpose Flour requested quantity (kg)"]', "0"), true);
  assert.equal(await evaluate("document.body.innerText.includes('Items in request: 1') && !document.querySelector('[aria-label=\"Remove All-Purpose Flour from request\"]')"), true, "zero excludes revision line without Remove");
  assert.equal(await setInput('input[aria-label="All-Purpose Flour requested quantity (kg)"]', "2"), true);
  assert.equal(await evaluate("document.body.innerText.includes('Items in request: 2') && !document.querySelector('[aria-label=\"Remove All-Purpose Flour from request\"]')"), true, "positive quantity re-includes revision line");
  assert.equal(errors.length, 0, `browser exceptions: ${errors.join(" | ")}`);
  assert.ok(requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))), "fixture made no external requests or writes");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ result: "PASS", checks, browserExceptions: errors.length, networkWrites: 0 }, null, 2));
  console.log(JSON.stringify({ result: "PASS", checks }, null, 2));
} finally {
  socket?.close(); chrome.kill();
}
