import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve("qa/mgr-req-ux-03-rendered-20261025");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-req-ux-01-"));
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
const click = (label) => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.getClientRects().length && node.textContent.includes(${JSON.stringify(label)}));if(!button)return false;button.click();return true})()`);
const selectRequest = (number) => evaluate(`(()=>{const row=[...document.querySelectorAll('[aria-label="Formal inventory requests"] > li')].find(node=>node.textContent.includes(${JSON.stringify(number)}));const button=row?.querySelector('button');if(!button)return false;button.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const setSelect = (selector, value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
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
    await waitFor("document.querySelectorAll('[aria-label=\"Formal inventory requests\"] > li').length === 3 && Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: default overflow`);
    assert.equal(await evaluate("document.body.innerText.includes('Prepare Request') && Boolean(document.querySelector('[aria-label=\"Request register\"]'))"), true);
    assert.equal(await evaluate("document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]').innerText.includes('Issued')"), true, "newest request auto selected");
    assert.equal(await evaluate("document.querySelector('.manager-request-next-action button')?.textContent.includes('Resume Receiving')"), true, "issued linked draft takes precedence");
    assert.equal(await evaluate("document.querySelectorAll('.manager-request-summary > div').length"), 3, "three summary counts");
    await screenshot(`default-${width}.png`);
    if (width < 1280) { assert.equal(await click("Back to Requests"), true); await waitFor("document.querySelector('[aria-label=\"Request register\"]').getClientRects().length > 0"); }
    await screenshot(`register-${width}.png`);
    if (width === 1280) {
      assert.equal(await evaluate("document.querySelector('[aria-label=\"Formal inventory requests\"] > li').getBoundingClientRect().height < 100"), true, "compact register row");
      assert.equal(await setSelect("select[aria-label='Sort requests']", "oldest"), true);
      await waitFor("document.querySelector('[aria-label=\"Formal inventory requests\"] > li')?.textContent.includes('PR-SPLIT-PARTIAL')");
      assert.equal(await setSelect("select[aria-label='Sort requests']", "newest"), true);
      await waitFor("document.querySelector('[aria-label=\"Formal inventory requests\"] > li')?.textContent.includes('PR-SPLIT-ISSUED')");
      assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('[aria-label=\"Formal inventory requests\"] > li')].find(node=>node.textContent.includes('PR-SPLIT-PARTIAL'));row?.querySelector('button')?.focus();return document.activeElement === row?.querySelector('button')})()"), true);
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await send("Input.dispatchKeyEvent", { type: "char", text: "\r", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    } else assert.equal(await selectRequest("PR-SPLIT-PARTIAL"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]'))");
    assert.equal(await evaluate("document.querySelector('.manager-request-next-action button')?.textContent.includes('Resume Receiving')"), true, "partial linked draft takes precedence");
    assert.equal(await evaluate("[...document.querySelectorAll('.manager-request-receipt-row')].find(row=>row.textContent.includes('RR-SPLIT-003'))?.querySelectorAll('button').length"), 0, "no duplicate draft action");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: detail overflow`);
    assert.match(await evaluate("document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]').innerText"), /Rev 2[\s\S]*Partially received[\s\S]*3[\s\S]*item lines[\s\S]*2[\s\S]*Receiving documents[\s\S]*2\.125 kg[\s\S]*1\.125 kg/);
    assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"PR-SPLIT-PARTIAL detail\"] button').length > 6"), true);
    assert.equal(await evaluate("document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]').innerText.includes('RR-SPLIT-001') && document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]').innerText.includes('RR-SPLIT-002') && document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]').innerText.includes('RR-SPLIT-003')"), true);
    assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('.manager-request-receipt-row')].find(node=>node.textContent.includes('RR-SPLIT-002'));const button=row?.querySelector('button');if(!button)return false;button.click();return true})()"), true);
    assert.equal(await evaluate("window.__openedReceipt"), "split-posted-2");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]').innerText.includes('Draft · stock unchanged')"), true);
    assert.equal(await evaluate("document.querySelector('#request-document-panel')?.innerText.includes('Audit timeline')"), false, "document omits bottom audit");
    assert.equal(await click("History & Audit"), true);
    await waitFor("Boolean(document.querySelector('#request-history-panel'))");
    await waitFor("document.body.innerText.includes('Manager recorded external dispatch')");
    assert.equal(await evaluate("document.body.innerText.includes('not proof that the message was delivered')"), true);
    await waitFor("document.body.innerText.includes('Export Rev 1 text')");
    assert.equal(await evaluate("document.querySelector('#request-history-tab')?.getAttribute('aria-selected')"), "true");
    await screenshot(`history-${width}.png`);
    if (width < 1280) { await evaluate("document.querySelector('#request-history-panel')?.scrollIntoView({block:'start'})"); await screenshot(`history-content-${width}.png`); await evaluate("window.scrollTo(0,0)"); }
    assert.equal(await click("Document"), true);
    await waitFor("Boolean(document.querySelector('#request-document-panel'))");
    assert.equal(await evaluate("(()=>{const tab=document.querySelector('#request-document-tab');tab.focus();return document.activeElement===tab})()"), true);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await waitFor("document.querySelector('#request-history-tab')?.getAttribute('aria-selected') === 'true'");
    assert.equal(await click("Document"), true);
    assert.equal(await evaluate("document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]') !== null"), true, "tab switch preserves selection");
    if (width >= 1024) assert.equal(await evaluate("document.querySelector('[aria-label=\"Request register\"]').getClientRects().length > 0"), true);
    else assert.equal(await evaluate("document.querySelector('[aria-label=\"Request register\"]').getClientRects().length === 0"), true);
    await screenshot(`selected-${width}.png`);
    if (width < 1280) { await evaluate("document.querySelector('.manager-request-next-action')?.scrollIntoView({block:'center'})"); await screenshot(`selected-action-${width}.png`); await evaluate("window.scrollTo(0,0)"); }
    if (width === 1280) { await evaluate("document.querySelector('.manager-request-receipt-row')?.scrollIntoView({block:'center'})"); await screenshot("receipts-1280.png"); await evaluate("window.scrollTo(0,0)"); }
    assert.equal(await click("Refresh"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]'))");
    assert.equal(await evaluate("(()=>{const node=[...document.querySelectorAll('summary')].find(x=>x.textContent.includes('Actions'));node?.click();return Boolean(node)})()"), true);
    assert.equal(await evaluate("document.querySelector('#request-export-actions')?.innerText.includes('Close with shortfall')"), true);
    assert.equal(await evaluate("(()=>{const r=document.querySelector('#request-export-actions').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})()"), true, `${width}: actions menu within viewport`);
    assert.equal(await evaluate("[...document.querySelectorAll('#request-export-actions button')].find(button=>button.textContent.includes('Close with shortfall'))?.disabled"), true, "draft blocks shortfall closure");
    await screenshot(`actions-${width}.png`);
    if (width === 390) { await evaluate("[...document.querySelectorAll('#request-export-actions button')].find(button=>button.textContent.includes('Close with shortfall'))?.scrollIntoView({block:'center'})"); await screenshot("actions-admin-390.png"); }
    assert.equal(await click("View official document"), true);
    await waitFor("Boolean(document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]'))");
    assert.equal(await evaluate("document.querySelector('[role=\"dialog\"]').innerText.includes('PR-SPLIT-PARTIAL')"), true);
    await screenshot(`document-${width}.png`);
    assert.equal(await click("Close full document"), true);
    assert.equal(await evaluate("!document.querySelector('[role=\"dialog\"]')"), true);
    if (width < 1280) { assert.equal(await click("Back to Requests"), true); await waitFor("document.querySelector('[aria-label=\"Request register\"]').getClientRects().length > 0"); }
    assert.equal(await setInput("input[aria-label='Search requests']", "NO-SUCH-REQUEST"), true);
    await waitFor("document.body.innerText.includes('No requests match these filters')");
    assert.equal(await setInput("input[aria-label='Search requests']", "Chicken"), true);
    await waitFor("document.querySelectorAll('[aria-label=\"Formal inventory requests\"] > li').length === 2");
    assert.equal(await setSelect("select[aria-label='Filter request destination']", "Kitchen"), true);
    await waitFor("document.querySelectorAll('[aria-label=\"Formal inventory requests\"] > li').length === 1");
    assert.equal(await setSelect("select[aria-label='Filter request destination']", ""), true);
    await waitFor("document.querySelectorAll('[aria-label=\"Formal inventory requests\"] > li').length === 2");
    assert.equal(await setSelect("select[aria-label='Filter request status']", "fulfilled"), true);
    await waitFor("document.querySelectorAll('[aria-label=\"Formal inventory requests\"] > li').length === 1");
    assert.equal(await selectRequest("PR-SPLIT-FULL"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-FULL detail\"]'))");
    assert.equal(await evaluate("document.querySelector('#request-document-tab')?.getAttribute('aria-selected')"), "true", "document view retained after register change");
    assert.equal(await evaluate("document.querySelector('.manager-request-next-action button')?.textContent.includes('View Completed Receipt')"), true, "fulfilled next action");
    assert.equal(await evaluate("(()=>{const menu=document.querySelector('.manager-request-actions-menu');menu.open=true;return !menu.innerText.includes('Prepare new revision')&&!menu.innerText.includes('Close with shortfall')})()"), true, "fulfilled request has no administrative mutation controls");
    assert.match(await evaluate("document.querySelector('[aria-label=\"PR-SPLIT-FULL detail\"]').innerText"), /Still outstanding[\s\S]*0[\s\S]*item lines/);
    assert.equal(await evaluate("!document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]')"), true);
    await screenshot(`fulfilled-${width}.png`);
    assert.equal(await click("Prepare Request"), true);
    await waitFor("Boolean(document.querySelector('[aria-label=\"Unsaved request\"]'))");
    assert.equal(await evaluate("document.body.innerText.includes('Review request') && document.body.innerText.includes('Suggested items to review')"), true);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: authoring overflow`);
    const rowSelector = width === 390 ? ".manager-request-mobile-line" : ".manager-request-edit-table tbody tr";
    assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length`), 4, "proposal rows appear before selection");
    assert.equal(await evaluate("document.body.innerText.includes('0 selected items')"), true, "suggestions do not auto-select");
    assert.equal(await evaluate("sessionStorage.getItem('rrj_inventory_request_unsaved_v1')"), null, "working sheet is not persisted");
    await screenshot(`prepare-${width}.png`);
    assert.equal(await evaluate("(()=>{const notice=document.querySelector('.manager-request-attention');notice.querySelector('summary').click();return notice.open&&notice.querySelectorAll('li').length===4})()"), true, `${width}: stock attention expands`);
    assert.equal(await evaluate("(()=>{const notice=document.querySelector('.manager-request-attention');notice.querySelector('summary').click();return !notice.open})()"), true, `${width}: stock attention collapses`);
    assert.equal(await evaluate("(()=>{const node=document.querySelector('input[aria-label=\"Select Soy Sauce (L)\"]');if(!node)return false;node.click();return true})()"), true);
    await waitFor("document.body.innerText.includes('1 selected item')");
    if (width === 1280) {
      assert.equal(await evaluate("(()=>{const node=document.querySelector('input[aria-label=\"Select Vinegar (L)\"]');if(!node)return false;node.click();return true})()"), true);
      await waitFor("document.body.innerText.includes('2 selected items')");
      assert.equal(await click("Review request"), true);
      await waitFor("Boolean(document.querySelector('[aria-label=\"Pre-issue request review\"]'))");
      assert.equal(await evaluate("window.__issuePayload === undefined"), true, "review does not issue");
      await screenshot("review-1280.png");
      assert.equal(await click("Issue Request"), true);
      await waitFor("Boolean(window.__issuePayload) && Boolean(document.querySelector('[aria-label=\"PR-SPLIT-NEW detail\"]'))");
      assert.equal(await evaluate("window.__issuePayload.lines.length"), 2);
    }
    if (width === 390) { await evaluate("document.querySelector('.manager-request-mobile-line')?.scrollIntoView({block:'center'})"); await screenshot("mobile-item-editor-390.png"); }
    checks.push({ width, suggestionRows: true, deliberateItemSelection: true, attentionDisclosure: true, noOverflow: true, ...(width === 1280 ? { explicitReviewAndIssue: true } : {}) });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&request=split-partial" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]'))");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]').innerText.includes('Rev 2')"), true, "deep link takes priority over auto selection");
  await screenshot("deep-link-1280.png");
  assert.equal(await click("History & Audit"), true);
  assert.equal(await evaluate("document.querySelector('#request-history-panel')?.innerText.includes('Manager recorded external dispatch')"), true, "deep-linked history");
  assert.equal(await selectRequest("PR-SPLIT-FULL"), true);
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-FULL detail\"]'))");
  assert.equal(await evaluate("document.querySelector('#request-history-panel')?.innerText.includes('Manager recorded external dispatch')"), false, "request switch replaces history");
  assert.equal(await evaluate("Boolean(document.querySelector('#request-history-panel'))"), true, "history view persists across request switch");
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&splitNoDraft=1&request=split-partial" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-PARTIAL detail\"]'))");
  assert.equal(await evaluate("document.querySelector('.manager-request-next-action button')?.textContent.includes('Record Additional Delivery')"), true, "partial without draft offers additional delivery");
  assert.equal(await evaluate("window.__openedReceipt === undefined"), true, "selection does not open or create Receiving");
  assert.equal(await click("Record Additional Delivery"), true);
  assert.equal(await evaluate("window.__openedReceipt === null"), true, "explicit action enters Receiving without a receipt id");
  await screenshot("partial-additional-delivery-1280.png");
  assert.equal(await evaluate("(()=>{const menu=document.querySelector('.manager-request-actions-menu');menu.open=true;return Boolean(menu)})()"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('#request-export-actions button')].find(button=>button.textContent.includes('Close with shortfall'))?.disabled"), true, "reason required");
  assert.equal(await setInput("#request-export-actions input", "Documented shortfall"), true);
  await waitFor("[...document.querySelectorAll('#request-export-actions button')].find(button=>button.textContent.includes('Close with shortfall'))?.disabled === false");
  await screenshot("shortfall-ready-1280.png");
  await evaluate("window.confirm=()=>true");
  assert.equal(await click("Close with shortfall"), true);
  await waitFor("Boolean(window.__shortfallAttempt)");
  assert.deepEqual(await evaluate("window.__shortfallAttempt"), { requestId: "split-partial", revision: 2, reason: "Documented shortfall" }, "shortfall sends current request, revision, and required reason to existing call");
  await waitFor("document.body.innerText.includes('Fixture is read only')");
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&splitRevisionEligible=1&request=split-issued" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  assert.equal(await evaluate("(()=>{const menu=document.querySelector('.manager-request-actions-menu');menu.open=true;return Boolean(menu)})()"), true);
  assert.equal(await evaluate("document.querySelector('#request-export-actions')?.innerText.includes('Prepare new revision')"), true, "revision available with no receipts");
  await screenshot("revision-eligible-1280.png");
  assert.equal(await click("Prepare new revision"), true);
  await waitFor("Boolean(document.querySelector('[aria-label=\"Unsaved request\"]'))");
  assert.equal(await evaluate("document.body.innerText.includes('Rev 2')"), true, "revision launches authoring");
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitEmpty=1" });
  await waitFor("document.body.innerText.includes('No formal Inventory Requests have been issued yet')");
  assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Formal inventory requests\"] > li').length"), 0);
  assert.equal(await evaluate("Boolean([...document.querySelectorAll('button')].find(button=>button.textContent.includes('Prepare Request')))"), true);
  await screenshot("empty-1280.png");
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&proposalError=1" });
  await waitFor("document.body.innerText.includes('Stock suggestions are unavailable')");
  assert.equal(await click("Prepare Request"), true);
  await waitFor("Boolean(document.querySelector('[aria-label=\"Unsaved request\"]'))");
  assert.equal(await evaluate("document.querySelector('.manager-request-add-item select')?.disabled"), true, "unavailable proposal blocks item selection");
  await screenshot("proposal-error-1280.png");
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every(({ method }) => ["GET", "HEAD"].includes(method)), "network write");
  assert.ok(requests.every(({ url }) => url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:")), "external request");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, browserExceptions: errors, networkWrites: 0 }, null, 2));
  console.log("PASS: Prepare Request suggestion rows and selection at 1280/820/390 px, desktop review/issue, and history/error cases; local-only traffic");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
