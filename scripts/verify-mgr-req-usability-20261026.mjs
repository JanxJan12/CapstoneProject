import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-usability-20261026");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-request-ui-"));
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
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,500)")}`);
};
const click = (label) => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&node.textContent.trim().includes(${JSON.stringify(label)}));if(!button)return false;button.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>node.getClientRects().length);if(!node)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const key = async (name, code, virtualKey) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, windowsVirtualKeyCode: virtualKey });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: virtualKey });
};
const screenshot = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(output, name), Buffer.from(shot.data, "base64"));
};
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
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
    check(`${width}: prepare`, await click("Prepare Request"));
    await waitFor("Boolean(document.querySelector('.manager-request-table-empty'))");
    await waitFor("[...document.querySelectorAll('.manager-request-section-actions > button')].some(button=>button.textContent.trim()==='Suggest Items' && !button.disabled)");
    check(`${width}: new sheet starts empty`, await evaluate("document.querySelector('.manager-request-table-empty')?.textContent.includes('No items yet') && !document.querySelector('.manager-request-edit-table input[data-request-item-id]')"));
    check(`${width}: empty sheet has one visible action`, await evaluate("!document.querySelector('.manager-request-selection-toolbar') && ![...document.querySelectorAll('.manager-page-header button')].some(button=>button.textContent.trim()==='Refresh')"));
    check(`${width}: clean sheet has no leave warning`, await evaluate("window.__requestDraftDirty===false"));
    await pause(300);
    await screenshot(`prepare-empty-${width}.png`);
    check(`${width}: suggest action`, await click("Suggest Items"));
    await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
    check(`${width}: action becomes refresh`, await evaluate("[...document.querySelectorAll('.manager-request-section-actions > button')].some(button=>button.textContent.trim()==='Refresh Suggestions')"));
    if (width >= 1100) check(`${width}: refresh grouped with request controls`, await evaluate("(()=>{const button=document.querySelector('.manager-request-section-actions > button').getBoundingClientRect(),toolbar=document.querySelector('.manager-request-selection-toolbar').getBoundingClientRect();return Math.abs(button.top-toolbar.top)<=3 && button.right<=toolbar.left && toolbar.left-button.right<=12})()"));
    if (width < 900) check(`${width}: suggest action precedes item cards`, await evaluate("document.querySelector('.manager-request-section-actions > button').getBoundingClientRect().bottom < document.querySelector('.manager-request-mobile-lines').getBoundingClientRect().top"));
    check(`${width}: no page overflow`, await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"));
    await screenshot(`prepare-${width}.png`);
    check(`${width}: live search`, await setInput('#request-item-search', "flour"));
    await waitFor("Boolean(document.querySelector('[role=listbox] [role=option]'))");
    check(`${width}: accessible match`, await evaluate("document.querySelector('[role=combobox]')?.getAttribute('aria-expanded')==='true' && document.querySelector('[role=option]')?.textContent.includes('All-Purpose Flour')"));
    await screenshot(`search-${width}.png`);
    if (width === 1502) {
      await evaluate("document.querySelector('#request-item-search').focus()");
      await key("ArrowDown", "ArrowDown", 40);
      check("keyboard option remains active", await evaluate("document.querySelector('[role=option][aria-selected=true]')?.textContent.includes('All-Purpose Flour')"));
      await key("Enter", "Enter", 13);
    } else {
      await evaluate("document.querySelector('[role=listbox] button').click()");
    }
    await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
    check(`${width}: one added row`, await evaluate("document.querySelectorAll('.manager-request-edit-table tbody tr').length===7"));
    await waitFor("window.__requestDraftDirty===true");
    check(`${width}: edit activates leave warning`, await evaluate("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented})()"));
    await setInput('#request-item-search', "flour");
    check(`${width}: duplicate excluded`, await evaluate("!document.querySelector('[role=listbox]') && document.body.innerText.includes('Already listed items cannot be added twice')"));
    await setInput('#request-item-search', "");
    await screenshot(`added-${width}.png`);
    check(`${width}: remove`, await evaluate("[...document.querySelectorAll('[aria-label=\"Remove All-Purpose Flour from request\"]')].some(node=>node.getClientRects().length)"));
    await evaluate("[...document.querySelectorAll('[aria-label=\"Remove All-Purpose Flour from request\"]')].find(node=>node.getClientRects().length).click()");
    await waitFor("!document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]')");
    await waitFor("document.activeElement?.textContent?.includes('Undo remove')");
    check(`${width}: undo`, await click("Undo remove"));
    await waitFor("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))");
    await pause(100);
    check(`${width}: undo restores quantity focus`, await evaluate("document.activeElement?.getAttribute('aria-label')==='All-Purpose Flour requested quantity (kg)'"));
    check(`${width}: clear opens dialog`, await click("Clear request"));
    await waitFor("Boolean(document.querySelector('.manager-request-clear-dialog'))");
    check(`${width}: precise clear copy`, await evaluate("document.querySelector('.manager-request-clear-dialog')?.textContent.includes('priority and needed time will stay')"));
    await screenshot(`clear-dialog-${width}.png`);
    if (width === 390) {
      await key("Escape", "Escape", 27);
      await waitFor("!document.querySelector('.manager-request-clear-dialog')");
      check("Escape retains row", await evaluate("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))"));
      await click("Clear request");
      await waitFor("Boolean(document.querySelector('.manager-request-clear-dialog'))");
    }
    await evaluate("document.querySelector('.manager-request-clear-dialog button')?.click()");
    await waitFor("!document.querySelector('.manager-request-clear-dialog')");
    check(`${width}: cancel retains row`, await evaluate("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))"));
    check(`${width}: cancel restores Clear focus`, await evaluate("document.activeElement?.textContent?.trim()==='Clear request'"));
    check(`${width}: quantity edited`, await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.02"));
    check(`${width}: review opens`, await click("Review request"));
    await waitFor("Boolean(document.querySelector('.manager-request-review'))");
    check(`${width}: draft remains distinct from Issue`, await evaluate("document.querySelector('.manager-request-review')?.textContent.includes('DRAFT · NOT ISSUED') && [...document.querySelectorAll('.manager-request-review button')].find(b=>b.textContent.includes('Issue Request'))?.disabled"));
    await screenshot(`review-${width}.png`);
    check(`${width}: back to edit`, await click("Back to edit"));
    await waitFor("!document.querySelector('.manager-request-review')");
    check(`${width}: back retains quantity`, await evaluate("[...document.querySelectorAll('input[aria-label=\"Soy Sauce requested quantity (L)\"]')].find(n=>n.getClientRects().length)?.value==='0.02'"));
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&coveredGaps=1" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  await click("Prepare Request");
  await waitFor("Boolean(document.querySelector('.manager-request-table-empty'))");
  check("covered gaps: suggest action", await click("Suggest Items"));
  await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
  check("covered gaps: visible explanation", await evaluate("document.querySelector('.manager-request-covered-notice')?.textContent.includes('All suggested gaps are 0.') && document.querySelector('.manager-request-covered-notice')?.textContent.includes('Open requests cover the shortage')"));
  await screenshot("covered-gaps-1280.png");
  check("leading zeros entered", await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "00.020"));
  check("natural edit preserved", await evaluate("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value==='00.020'"));
  await evaluate("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]').focus()");
  await key("Tab", "Tab", 9);
  await waitFor("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value==='0.020'");
  check("precision retained", await evaluate("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value==='0.020'"));
  check("review opens", await click("Review request"));
  await waitFor("Boolean(document.querySelector('.manager-request-review'))");
  check("UUID not visual", await evaluate("!document.querySelector('.manager-request-review th .break-all') && !document.querySelector('.manager-request-review li .break-all')"));
  check("issue waits for real reason", await evaluate("[...document.querySelectorAll('.manager-request-review button')].find(b=>b.textContent.includes('Issue Request'))?.disabled"));
  await screenshot("review-1280.png");
  check("back to edit", await click("Back to edit"));
  await waitFor("!document.querySelector('.manager-request-review')");
  check("draft preserved", await evaluate("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value==='0.020'"));
  await click("Clear request");
  await waitFor("Boolean(document.querySelector('.manager-request-clear-dialog'))");
  await evaluate("[...document.querySelectorAll('.manager-request-clear-dialog button')].find(b=>b.textContent.trim()==='Clear request').click()");
  await waitFor("document.body.innerText.includes('Items in request: 0')");
  check("clear reset quantities", await evaluate("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value==='0'"));
  await waitFor("window.__requestDraftDirty===false");
  check("clear removes leave warning when details are unchanged", await evaluate("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented})()"));
  check("invalid precision entered", await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.0001"));
  await click("Review request");
  check("invalid precision blocks review", await evaluate("!document.querySelector('.manager-request-review')"));
  check("valid quantity entered", await setInput('input[aria-label="Soy Sauce requested quantity (L)"]', "0.06"));
  await click("Review request");
  await waitFor("Boolean(document.querySelector('.manager-request-review'))");
  check("draft export separate from issue", await evaluate("[...document.querySelectorAll('.manager-request-review button')].some(b=>b.textContent.includes('Export PDF')) && [...document.querySelectorAll('.manager-request-review button')].some(b=>b.textContent.includes('Issue Request')) && !window.__issuePayload"));
  check("reason provided by manager", await setInput('input[aria-label="Soy Sauce quantity difference reason"]', "Confirmed extra need"));
  check("issue enabled by reason", await evaluate("![...document.querySelectorAll('.manager-request-review button')].find(b=>b.textContent.includes('Issue Request'))?.disabled"));
  await click("Issue Request");
  await waitFor("Boolean(window.__issuePayload)");
  check("issue payload preserves entered reason", await evaluate("window.__issuePayload.lines.length===1 && window.__issuePayload.lines[0].quantity===0.06 && window.__issuePayload.lines[0].override_reason==='Confirmed extra need'"));
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-NEW detail\"]'))");
  await waitFor("window.__requestDraftDirty===false");
  check("issued sheet clears leave warning", await evaluate("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented})()"));
  check("revision action", await click("Prepare new revision"));
  await waitFor("Boolean(document.querySelector('.manager-request-sheet.is-authoring'))");
  check("revision retains only its saved line", await evaluate("document.querySelectorAll('.manager-request-edit-table tbody tr').length===1 && document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value==='0.06'"));
  await waitFor("window.__requestDraftDirty===true");
  check("revision may suggest additional items", await evaluate("[...document.querySelectorAll('.manager-request-section-actions > button')].some(button=>button.textContent.trim()==='Suggest Items')"));
  check("no browser exceptions", errors.length === 0);
  check("no external network or writes", requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))));
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, browserExceptions: errors, requests: requests.length }, null, 2));
  console.log(`${checks.length} browser checks passed; screenshots at 1502/1280/820/390`);
} finally {
  socket?.close();
  chrome.kill();
}
