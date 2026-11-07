import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:5173/scripts/fixtures/mgr-rec-04.html";
const output = path.resolve("qa/mgr-rec-ux-01b-rendered-20261024");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-rec-06-"));
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
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,700)")}; ${errors.join(" | ")}`);
};
const click = (label) => evaluate(`(()=>{const labels=${JSON.stringify(label === "Save Line to Draft" ? ["Add Line to Draft", "Update Saved Line"] : [label])};const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&labels.includes(x.textContent.trim()));if(!b)return false;b.click();return true})()`);
const setInput = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||!e.getClientRects().length)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const visible = (selector) => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)})?.getClientRects().length)`);
const expanded = (section) => evaluate(`document.querySelector(${JSON.stringify(`#${section} > h2 > button`)})?.getAttribute('aria-expanded') === 'true'`);
const bodyVisible = (section) => visible(`#${section}-content`);
const keyboardToggle = async (section) => {
  await evaluate(`document.querySelector(${JSON.stringify(`#${section} > h2 > button`)})?.focus()`);
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
};
const shot = async (name) => { const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true }); await writeFile(path.join(output, name), Buffer.from(result.data, "base64")); };
const navigate = async (query) => { await send("Page.navigate", { url: `${base}${query}` }); await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length || document.querySelector('#receiving-queue-heading')?.getClientRects().length"); };

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
    if (task) { pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await mkdir(output, { recursive: true });

  for (const width of [1280, 820, 640, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: width === 640 ? 2 : 1, mobile: width < 600 });
    await navigate("?populated=draft");
    await waitFor("document.querySelector('[aria-label=\"Requested and inspected quantities\"]')?.innerText.includes('Chicken breast')");
    assert.equal(await evaluate(`(()=>{const register=document.querySelector('.manager-receiving-register');const detail=document.querySelector('#receiving-workspace-heading');if(!register||!detail)return false;const shown=register.getClientRects().length>0;return innerWidth>=1024 ? shown && register.getBoundingClientRect().right < detail.getBoundingClientRect().left : !shown})()`), true, "register/detail responsive layout");
    assert.equal(await visible(".manager-receiving-register-toggle"), width >= 1024);
    assert.equal(await visible(".manager-receiving-back"), width < 1024);
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Receiving workspace stages\"]')?.innerText.includes('1 · Inspect') && document.querySelector('[aria-label=\"Receiving workspace stages\"]')?.innerText.includes('2 · Review') && document.querySelector('[aria-label=\"Receiving workspace stages\"]')?.innerText.includes('3 · Post')"), true);
    const table = await evaluate("document.querySelector('[aria-label=\"Requested and inspected quantities\"]').innerText");
    assert.match(table, /Chicken thigh[\s\S]*Chicken breast/);
    assert.match(table, /Previously accepted/i);
    assert.match(table, /Outstanding/i);
    assert.equal(await expanded("receiving-items-table"), true);
    assert.equal(await expanded("receiving-document-details"), false);
    assert.equal(await expanded("receiving-review"), false);
    assert.equal(await expanded("receiving-saved-lines"), false);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, "page overflow");
    await shot(`inspection-${width}.png`);
    if (width === 390) {
      assert.equal(await click("← Back to Receiving Register"), true);
      await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length");
      assert.equal(await visible("#receiving-workspace-heading"), false);
      assert.equal(await click("Continue RR-20261012-000002"), true);
      await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length");
    }
    if (width === 1280) {
      assert.equal(await evaluate("document.querySelector('[aria-label=\"Requested and inspected quantities\"] tbody')?.rows.length"), 2);
      assert.match(await evaluate("[...document.querySelectorAll('[aria-label=\"Requested and inspected quantities\"] tbody tr')].find(x=>x.innerText.includes('Chicken thigh')).innerText"), /5 kg[\s\S]*2 kg[\s\S]*3 kg/, "posted acceptance and outstanding were conflated");
      assert.equal(await evaluate("Boolean(document.querySelector('#receiving-line-item'))"), false, "formal request still requires general item dropdown");
      assert.equal(await evaluate("(()=>{const r=[...document.querySelectorAll('[aria-label=\"Requested and inspected quantities\"] tbody tr')].find(x=>x.innerText.includes('Chicken thigh'));r.querySelector('button').click();return true})()"), true);
      await waitFor("document.querySelector('#line-delivered')?.value === '1'");
      await evaluate("document.querySelector('#receiving-line-editor').scrollIntoView({block:'start'})");
      await pause(120);
      await shot("delivery-inspection-open.png");
      assert.equal(await setInput("line-delivered", "3"), true);
      assert.equal(await setInput("line-accepted", "2"), true);
      await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Rejected')");
      assert.equal(await evaluate("document.querySelector('#receiving-line-editor details')?.open"), true, "quality details did not open for rejection/expiry");
      assert.equal(await click("Save Line to Draft"), true);
      await waitFor("document.body.innerText.includes('Enter a rejection reason whenever any quantity is rejected')");
      assert.equal(await evaluate("window.__fixtureIssueCalls||0"), 0, "invalid line reached save service");
      await shot("quality-details-desktop.png");
      assert.equal(await evaluate("(()=>{const r=[...document.querySelectorAll('[aria-label=\"Requested and inspected quantities\"] tbody tr')].find(x=>x.innerText.includes('Chicken breast'));r.querySelector('button').click();return true})()"), true);
      await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Chicken breast')");
      assert.equal(await setInput("line-delivered", "2.5"), true);
      assert.equal(await setInput("line-accepted", "1.25"), true);
      await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('1.25 kg')");
      assert.equal(await evaluate("(()=>{const r=[...document.querySelectorAll('[aria-label=\"Requested and inspected quantities\"] tbody tr')].find(x=>x.innerText.includes('Chicken thigh'));r.querySelector('button').click();return true})()"), true);
      await waitFor("document.querySelector('#line-delivered')?.value === '3' && document.querySelector('#line-accepted')?.value === '2'");
      assert.equal(await click("2 · Review"), true);
      await waitFor("document.querySelector('#receiving-review')?.getClientRects().length");
      await waitFor("document.activeElement?.id === 'receiving-review'");
      assert.equal(await bodyVisible("receiving-line-editor"), false);
      assert.equal(await evaluate("[...document.querySelectorAll('#receiving-review button')].some(x=>x.textContent.includes('Review & Post')&&x.disabled)"), true, "unsaved item drafts could post");
      assert.match(await evaluate("document.querySelector('#receiving-saved-lines').innerText"), /DELIVERED[\s\S]*ACCEPTED[\s\S]*Chicken thigh/);
      await shot("review-stage-desktop.png");
      assert.equal(await click("Document details"), true);
      await waitFor("document.querySelector('#receiving-document-details')?.getClientRects().length");
      await waitFor("document.activeElement?.id === 'receiving-document-details'");
      assert.equal(await expanded("receiving-document-details"), true);
      assert.equal(await bodyVisible("receiving-line-editor"), false);
      assert.equal(await click("1 · Inspect"), true);
      await waitFor("document.querySelector('#line-delivered')?.value === '3'");
      await evaluate("window.confirm=(message)=>{window.__lastReceivingConfirm=message;return false}");
      assert.equal(await click("Hide Register"), true);
      assert.equal(await visible(".manager-receiving-register"), false);
      assert.equal(await evaluate("document.querySelector('#line-delivered')?.value"), "3");
      assert.equal(await expanded("receiving-document-details"), true);
      await evaluate("window.scrollTo(0,0)");
      await pause(150);
      await shot("register-hidden-desktop.png");
      assert.equal(await click("Show Register"), true);
      assert.equal(await visible(".manager-receiving-register"), true);
      assert.equal(await expanded("receiving-document-details"), true);
    }
    checks.push({ width, items: 2, noOverflow: true, stagedViews: true });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("?page=stock-receiving&mgrRec=1");
  await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
  assert.equal(await click("Record Delivery"), true);
  await waitFor("document.body.innerText.includes('Start linked Receiving · PR-20261023-000004')");
  assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0);
  assert.equal(await click("Start Receiving"), true);
  await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-SYNTHETIC')");
  assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1);
  await shot("explicit-linked-draft.png");
  await navigate("?populated=draft");
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Chicken breast')");
  for (const section of ["receiving-items-table", "receiving-line-editor", "receiving-saved-lines", "receiving-review", "receiving-document-details", "receiving-linked-request", "receiving-audit-history"]) {
    const initial = await expanded(section);
    await keyboardToggle(section);
    await waitFor(`document.querySelector(${JSON.stringify(`#${section} > h2 > button`)})?.getAttribute('aria-expanded') === ${JSON.stringify(String(!initial))}`);
    await keyboardToggle(section);
    await waitFor(`document.querySelector(${JSON.stringify(`#${section} > h2 > button`)})?.getAttribute('aria-expanded') === ${JSON.stringify(String(initial))}`);
  }
  assert.equal(await expanded("receiving-saved-lines"), false);
  assert.equal(await expanded("receiving-review"), false);
  assert.equal(await evaluate("document.querySelector('#receiving-line-editor details')?.open"), true, "required quality fields closed");
  await evaluate("document.querySelector('#receiving-line-editor details > summary').click()");
  await waitFor("document.querySelector('#receiving-line-editor details')?.open === true");
  await setInput("line-delivered", "2.5");
  await setInput("line-accepted", "2.5");
  await keyboardToggle("receiving-line-editor");
  assert.equal(await bodyVisible("receiving-line-editor"), false);
  await keyboardToggle("receiving-line-editor");
  assert.equal(await evaluate("document.querySelector('#line-delivered')?.value === '2.5' && document.querySelector('#line-accepted')?.value === '2.5'"), true, "accordion reset unsaved inputs");
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("document.body.innerText.includes(\"Enter the item's required use-by date\")");
  await waitFor("document.activeElement?.id === 'line-use-by'");
  await shot("required-quality-open.png");
  assert.equal(await evaluate("document.querySelector('#receiving-linked-request > h2 > button').click();true"), true);
  await waitFor("document.querySelector('#receiving-linked-request > h2 > button')?.getAttribute('aria-expanded') === 'true'");
  await evaluate("window.confirm=()=>true");
  assert.equal(await click("Open linked Request"), true);
  assert.equal(await evaluate("window.__openedRequest"), "11111111-1111-4111-8111-111111111111");
  await shot("linked-request-open.png");
  assert.equal(await evaluate("document.querySelector('#receiving-audit-history > h2 > button').click();true"), true);
  await waitFor("document.querySelector('#receiving-audit-history-content')?.innerText.includes('RR-20261012-000001')");
  await shot("audit-history-open.png");
  await navigate("?populated=draft&optionalExpiry=1&mgrRec06Save=1");
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Chicken breast')");
  assert.equal(await evaluate("document.querySelector('#receiving-line-editor details')?.open"), false, "optional quality section should start closed");
  await evaluate("document.querySelector('#receiving-line-editor').scrollIntoView({block:'start'})");
  await pause(120);
  await shot("optional-quality-closed.png");
  await evaluate("document.querySelector('#receiving-line-editor details > summary').click()");
  await waitFor("document.querySelector('#receiving-line-editor details')?.open === true");
  assert.equal(await setInput("line-delivered", "1"), true);
  assert.equal(await setInput("line-accepted", "1"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("(window.__mgrRec06Saves||[]).length === 1");
  assert.equal(await evaluate("document.body.innerText.includes(\"Enter the item's required use-by date\")"), false, "optional expiry was treated as required");
  await navigate("?populated=draft&mgrRec06Save=1");
  await waitFor("document.querySelector('[aria-label=\"Requested and inspected quantities\"]')?.innerText.includes('Chicken breast')");
  assert.equal(await evaluate("(()=>{const r=[...document.querySelectorAll('[aria-label=\"Requested and inspected quantities\"] tbody tr')].find(x=>x.innerText.includes('Chicken breast'));r.querySelector('button').click();return true})()"), true);
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Chicken breast')");
  assert.equal(await setInput("line-delivered", "2"), true);
  assert.equal(await setInput("line-accepted", "2"), true);
  assert.equal(await setInput("line-use-by", "2026-11-10"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("document.querySelector('[aria-label=\"Requested and inspected quantities\"]')?.innerText.includes('2 saved')");
  assert.equal(await evaluate("(window.__mgrRec06Saves||[]).length"), 1);
  assert.equal(await click("2 · Review"), true);
  await waitFor("document.querySelector('#receiving-saved-lines')?.innerText.includes('2 line(s)')");
  assert.equal(await evaluate("document.querySelector('#receiving-saved-lines tbody')?.rows.length"), 2);
  await shot("saved-lines-review-desktop.png");
  assert.equal(await evaluate("(()=>{const r=[...document.querySelectorAll('#receiving-saved-lines tbody tr')].find(x=>x.innerText.includes('Chicken breast'));r.querySelector('button').click();return true})()"), true);
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Edit Inspection') && document.querySelector('#line-delivered')?.value === '2'");
  assert.equal(await setInput("line-delivered", "3"), true);
  assert.equal(await setInput("line-accepted", "3"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("(window.__mgrRec06Saves||[]).length === 2");
  assert.equal(await evaluate("window.__mgrRec06Saves[0].id === window.__mgrRec06Saves[1].id"), true, "edit created a second line ID");
  assert.equal(await click("2 · Review"), true);
  await waitFor("document.querySelector('#receiving-saved-lines')?.innerText.includes('2 line(s)')");
  assert.equal(await evaluate("document.querySelector('#receiving-saved-lines tbody')?.rows.length"), 2, "repeat save duplicated a line");
  await navigate("?populated=posted");
  await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-20261012-000001')");
  assert.equal(await visible("#receiving-line-editor"), false);
  assert.equal(await visible("#receiving-review"), false);
  assert.match(await evaluate("document.querySelector('[aria-label=\"Requested and inspected quantities\"]').innerText"), /Chicken thigh[\s\S]*Read only/);
  assert.equal(await evaluate("document.querySelector('#receiving-saved-lines-content')?.querySelectorAll('button').length ?? 0"), 0, "posted receipt has edit controls");
  await shot("posted-readonly-desktop.png");
  for (const width of [1280, 820, 640, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: width === 640 ? 2 : 1, mobile: width < 600 });
    await navigate("?page=stock-receiving&mgrRec=1");
    await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
    if (width >= 1024) await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0, "virtual request started a receipt");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true);
    assert.equal(await evaluate("Boolean(document.querySelector('.manager-receiving-register')?.getClientRects().length)"), true);
    assert.equal(await evaluate("Boolean(document.querySelector('#receiving-workspace-heading')?.getClientRects().length)"), width >= 1024);
    await shot(`register-${width}.png`);
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("?page=stock-receiving&mgrRec=1&paginate=1");
  await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length");
  assert.match(await evaluate("document.querySelector('[aria-label=\"Unified Receiving entries\"]').innerText"), /PR-20261023-000004[\s\S]*Record Delivery/);
  assert.equal(await click("Receipt history ▾"), true);
  assert.equal(await click("Draft"), true);
  await waitFor("document.querySelector('[aria-label=\"Receiving receipt history\"]')?.innerText.includes('RR-20261012-000002')");
  assert.equal(await click("Posted"), true);
  await waitFor("document.querySelector('[aria-label=\"Receiving receipt history\"]')?.innerText.includes('RR-20261012-000001')");
  assert.equal(await click("All"), true);
  await waitFor("document.body.innerText.includes('Receipt page 1')");
  assert.equal(await click("Next"), true);
  await waitFor("document.body.innerText.includes('Receipt page 2')");
  assert.equal(await click("Previous"), true);
  await waitFor("document.body.innerText.includes('Receipt page 1')");
  assert.equal(await click("Supplier or emergency receipt"), true);
  await waitFor("document.querySelector('#receiving-document-details')?.getClientRects().length");
  assert.equal(await evaluate("Boolean(document.querySelector('#receiving-source option[value=direct_supplier]'))"), true);
  assert.equal(await evaluate("(()=>{const s=document.querySelector('#receiving-source');s.value='direct_supplier';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
  await waitFor("Boolean(document.querySelector('#receiving-po')?.getClientRects().length)");
  assert.equal(await evaluate("(()=>{const s=document.querySelector('#receiving-source');s.value='production_team';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
  await waitFor("document.querySelector('#receiving-document-details')?.innerText.includes('Manager emergency exception')");
  await shot("supplier-emergency-details.png");
  await navigate("?populated=draft&mgrRec01bPost=1");
  await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-20261012-000002')");
  assert.equal(await click("2 · Review"), true);
  await waitFor("document.querySelector('#receiving-review-content')?.getClientRects().length");
  assert.equal(await click("Review & Post"), true);
  await waitFor("document.body.innerText.includes('Post RR-20261012-000002?')");
  await pause(300);
  await shot("posting-confirmation.png");
  assert.equal(await click("Post Receiving"), true);
  await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('Posted') || document.body.innerText.includes('posted successfully')");
  assert.equal(await evaluate("(window.__mgrRec01bPosts||[]).length"), 1);
  assert.equal(await evaluate("JSON.stringify(window.__mgrRec01bAccepted)"), JSON.stringify([{ item: "Chicken thigh", accepted: 1, unit: "kg" }]));
  assert.equal(await evaluate("Boolean([...document.querySelectorAll('button')].find(x=>x.textContent.includes('Review & Post')))"), false, "posted receipt retained post action");
  await shot("posted-after-confirmation.png");
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "network write");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:5173/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "external request");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, registerStatusAndPagination: true, virtualRequestNoAutoDraft: true, accordionKeyboard: true, accordionInputPreservation: true, requiredQualityVisible: true, optionalExpiry: true, linkedRequestNavigation: true, auditHistory: true, multiItemStaging: true, rejectionReasonValidation: true, saveAndEditIdentity: true, unsavedNavigationGuard: true, reviewPostGuard: true, syntheticAcceptedOnlyPosting: true, postedReadOnly: true, supplierEmergencyEntry: true, browserErrors: errors, networkWrites: 0 }, null, 2));
  console.log("PASS: collapsible Receiving, keyboard/input persistence, local synthetic save/post, desktop/tablet/mobile, local-only traffic");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
