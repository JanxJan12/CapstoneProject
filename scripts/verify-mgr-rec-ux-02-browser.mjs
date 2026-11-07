import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:58441/scripts/fixtures/mgr-rec-04.html";
const output = path.resolve("qa/manager-receiving-ui-polish-20261027");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-rec-ux-02-"));
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
const click = (label) => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&(x.textContent.trim()===${JSON.stringify(label)}||x.getAttribute('aria-label')===${JSON.stringify(label)}));if(!b)return false;b.click();return true})()`);
const setInput = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e||!e.getClientRects().length)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const visible = (selector) => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)})?.getClientRects().length)`);
const shot = async (name) => { const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true }); await writeFile(path.join(output, name), Buffer.from(result.data, "base64")); };
const navigate = async (query) => { await send("Page.navigate", { url: `${base}${query}` }); await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length || document.querySelector('#receiving-queue-heading')?.getClientRects().length"); };
const noOverflow = () => evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1");

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

  for (const width of [1440, 1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await navigate("?mgrRec=1");
    await waitFor("document.querySelector('[aria-label=\"Unified Receiving entries\"]')?.innerText.includes('PR-20261023-000004')");
    assert.equal(await visible("#receiving-queue-heading"), true);
    assert.equal(await visible("#receiving-workspace-heading"), false);
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0);
    assert.equal(await noOverflow(), true, `register overflow at ${width}`);
    await shot(`register-${width}.png`);
    if (width === 1280) {
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.manager-receiving-queue-columns')).display"), "grid");
      await shot("register-desktop.png");
      assert.equal(await click("Posted"), true);
      await waitFor("document.querySelector('[aria-label=\"Receiving requests\"]') === null");
      assert.equal(await evaluate("document.querySelector('#receiving-register-history')?.getClientRects().length > 0"), true);
      assert.equal(await click("All"), true);
      await waitFor("document.querySelector('[aria-label=\"Receiving requests\"]')?.innerText.includes('PR-20261023-000004')");
      assert.equal(await evaluate("(()=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'PR-SYNTHETIC-PARTIAL');e.dispatchEvent(new Event('input',{bubbles:true}));return true})()"), true);
      assert.equal(await click("Search"), true);
      await waitFor("document.querySelector('[aria-label=\"Receiving requests\"]')?.innerText.includes('PR-SYNTHETIC-PARTIAL')");
      assert.equal(await evaluate("document.querySelector('[aria-label=\"Receiving requests\"]').innerText.includes('PR-20261023-000004')"), false);
      assert.equal(await click("Clear"), true);
      await waitFor("document.querySelector('[aria-label=\"Receiving requests\"]')?.innerText.includes('PR-20261023-000004')");
      assert.equal(await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Receiving source\"]');e.value='direct_supplier';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
      assert.equal(await click("Search"), true);
      await waitFor("document.querySelector('[aria-label=\"Receiving requests\"]') === null");
      assert.equal(await evaluate("document.querySelector('[aria-label=\"Receiving receipt history\"]')?.innerText.includes('RR-SYNTHETIC-SUPPLIER')"), true);
      assert.equal(await click("Clear"), true);
      await waitFor("document.querySelector('[aria-label=\"Receiving requests\"]')?.innerText.includes('PR-20261023-000004')");
    }
    assert.equal(await click("Record Delivery"), true);
    await waitFor("document.body.innerText.includes('Start linked Receiving · PR-20261023-000004')");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0, "virtual request created a receipt");
    assert.equal(await click("Start Receiving"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-SYNTHETIC')");
    await waitFor("document.activeElement?.id === 'receiving-workspace-heading'");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1);
    assert.equal(await visible("#receiving-register-panel"), false);
    assert.equal(await visible("#receiving-line-editor"), true);
    assert.equal(await noOverflow(), true, `inspection overflow at ${width}`);
    assert.equal(await evaluate("document.querySelector('#receiving-document-details details.manager-receiving-secondary-details')?.open"), false, `delivery fields should start collapsed at ${width}`);
    assert.equal(await evaluate("document.querySelector('#receiving-document-details')?.innerText.includes('Production Team')"), true, `source identity missing at ${width}`);
    assert.equal(await evaluate("(()=>{const s=document.querySelector('#receiving-document-details details.manager-receiving-secondary-details > summary');s.focus();return document.activeElement===s})()"), true, `delivery fields summary cannot receive focus at ${width}`);
    await send("Page.bringToFront");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate("document.querySelector('#receiving-document-details details.manager-receiving-secondary-details')?.open"), true, `delivery fields did not open from keyboard at ${width}`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate("document.querySelector('#receiving-document-details details.manager-receiving-secondary-details')?.open"), false, `delivery fields did not close from keyboard at ${width}`);
    await shot(`details-${width}.png`);
    await evaluate("window.scrollTo(0, 0)");
    await shot(`inspect-${width}.png`);
    assert.equal(await click("← Back to Receiving Register"), true);
    await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length && document.activeElement?.id === 'receiving-queue-heading'");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1, "back to register created another draft");
    assert.equal(await click("Continue RR-SYNTHETIC"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length && document.activeElement?.id === 'receiving-workspace-heading'");
    assert.equal(await click("Inspect"), true);
    await waitFor("document.querySelector('#receiving-line-editor')?.getClientRects().length");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1, "continuing draft created another draft");
    if (width === 1440 || width === 1280) {
      assert.equal(await evaluate("(()=>{const a=document.querySelector('#receiving-items-table').getBoundingClientRect(),b=document.querySelector('#receiving-line-editor').getBoundingClientRect();return a.right < b.left && Math.abs(a.top-b.top)<10})()"), true, "Inspect panels must be side by side");
      assert.equal(await evaluate("(()=>{const b=[...document.querySelectorAll('#receiving-line-editor button')].find(x=>x.textContent.includes('Save Line to Draft'));const r=b?.getBoundingClientRect();return Boolean(r&&r.top>=0&&r.bottom<=innerHeight)})()"), true, "Save Line to Draft must remain visible in the desktop inspection panel");
      if (width === 1280) {
        assert.equal(await evaluate("(()=>{const e=document.querySelector('.manager-receiving-extra-quality');e.querySelector('summary').click();return e.open})()"), true, "Additional quality details did not expand");
        assert.equal(await visible("#line-manufactured"), true, "Manufactured date is not accessible after expanding quality details");
      }
      if (width === 1440) {
        assert.equal(await evaluate("(()=>{const a=document.querySelector('#receiving-line-editor').getBoundingClientRect(),b=document.querySelector('#receiving-saved-lines').getBoundingClientRect();return a.right < b.left && b.top >= a.top})()"), true, "Draft lines must be beside inspection at wide desktop width");
        assert.equal(await evaluate("(()=>{const a=document.querySelector('.manager-receiving-context').getBoundingClientRect(),b=document.querySelector('#receiving-saved-lines').getBoundingClientRect(),c=document.querySelector('#receiving-document-details').getBoundingClientRect();return a.left >= b.left - 1 && a.bottom <= b.top + 1 && b.bottom <= c.top + 1})()"), true, "Progress, saved lines, and delivery details must stack in the right rail");
      }
      await shot("inspect-desktop.png");
    }
    if (width === 820 || width === 390) {
      await evaluate("document.querySelector('#receiving-line-editor').scrollIntoView({block:'start'})");
      assert.equal(await evaluate("[...document.querySelectorAll('#receiving-line-editor button')].some(x=>x.textContent.includes('Save Line to Draft'))"), true);
      assert.equal(await noOverflow(), true, `inspection editor overflow at ${width}`);
      await shot(width === 820 ? "inspect-tablet-editor.png" : "inspect-mobile-editor.png");
      if (width === 820) await shot("inspect-tablet.png");
      if (width === 390) await shot("inspect-mobile.png");
    }

    await navigate("?populated=draft&mgrRec01bPost=1");
    await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Chicken breast')");
    assert.equal(await visible("#receiving-line-editor"), true);
    assert.equal(await visible("#receiving-review"), false);
    assert.equal(await evaluate("document.querySelectorAll('.manager-receiving-accordion > h2 > button').length"), 0, "document still uses accordions");
    if (width === 1280) { await evaluate("window.scrollTo(0,0)"); await pause(100); await shot("inspect-multi-item-desktop.png"); }
    assert.equal(await evaluate("document.querySelector('#receiving-items-table').innerText.includes('Chicken thigh') && document.querySelector('#receiving-items-table').innerText.includes('Chicken breast')"), true);
    if (width === 1280) {
      assert.match(await evaluate("[...document.querySelectorAll('.manager-receiving-workitem')].find(x=>x.innerText.includes('Chicken thigh')).innerText"), /5 kg[\s\S]*2 kg[\s\S]*3 kg/, "request, prior posted acceptance and outstanding quantities were conflated");
      assert.equal(await evaluate("(()=>{const e=document.querySelector('#receiving-item-filter');e.value='saved';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
      await waitFor("document.querySelectorAll('.manager-receiving-workitem').length === 1");
      assert.equal(await evaluate("document.querySelector('.manager-receiving-workitem')?.innerText.includes('Chicken thigh')"), true, "Saved filter omitted the saved item");
      assert.equal(await evaluate("(()=>{const e=document.querySelector('#receiving-item-filter');e.value='pending';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
      await waitFor("document.querySelector('.manager-receiving-workitem')?.innerText.includes('Chicken breast')");
      assert.equal(await evaluate("(()=>{const e=document.querySelector('#receiving-item-filter');e.value='all';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()"), true);
      await waitFor("document.querySelectorAll('.manager-receiving-workitem').length === 2");
      assert.equal(await evaluate("document.querySelector('.manager-receiving-saved-compact')?.innerText.includes('1 kg accepted')"), true, "Compact saved-line summary is missing the accepted quantity");
    }
    assert.equal(await click("2 · Review"), true);
    await waitFor("document.querySelector('#receiving-review')?.getClientRects().length");
    assert.equal(await visible("#receiving-line-editor"), false);
    assert.equal(await visible("#receiving-saved-lines"), true);
    assert.equal(await evaluate("document.querySelector('#receiving-linked-request')?.innerText.includes('2 linked receipt')"), true, "multiple linked receipts missing");
    assert.equal(await noOverflow(), true, `review overflow at ${width}`);
    if (width === 390) await shot("review-mobile-summary.png");
    await pause(650);
    await evaluate("window.scrollTo({top:0,behavior:'instant'})");
    await pause(50);
    await shot(`review-${width}.png`);
    if (width === 1280) {
      assert.equal(await evaluate("(()=>{const a=document.querySelector('#receiving-saved-lines').getBoundingClientRect(),b=document.querySelector('#receiving-review').getBoundingClientRect();return b.top > a.top && b.width > a.width*.9})()"), true, "Review lines must span the workspace above the summary");
      assert.equal(await evaluate("(()=>{const [a,b]=document.querySelectorAll('.manager-receiving-review-summary > section');return a.getBoundingClientRect().right < b.getBoundingClientRect().left})()"), true, "Review summary panels must be side by side");
      await shot("review-desktop.png");
    }
    if (width === 390) await shot("review-mobile.png");
    if (width === 1280) {
      assert.equal(await click("Review & Post"), true);
      await waitFor("document.body.innerText.includes('Post RR-20261012-000002?')");
      await shot("confirmation-1280.png");
      await shot("post-confirmation-desktop.png");
      assert.equal(await click("Post Receiving"), true);
      await waitFor("document.body.innerText.includes('posted successfully')");
      assert.equal(await evaluate("(window.__mgrRec01bPosts||[]).length"), 1);
      assert.equal(await evaluate("JSON.stringify(window.__mgrRec01bAccepted)"), JSON.stringify([{ item: "Chicken thigh", accepted: 1, unit: "kg" }]));
      assert.equal(await visible("#receiving-line-editor"), false);
      assert.equal(await visible("#receiving-review"), false);
      assert.equal(await visible("#receiving-saved-lines"), true);
      await shot("posted-after-confirmation-1280.png");
    }
    await navigate("?populated=posted");
    await waitFor("document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-20261012-000001')");
    assert.equal(await visible("#receiving-document-details"), true);
    assert.equal(await visible("#receiving-audit-history"), true);
    assert.equal(await visible("#receiving-line-editor"), false);
    assert.equal(await evaluate("document.body.innerText.includes('Post ✓ · Read only')"), true);
    assert.equal(await evaluate("[...document.querySelectorAll('button')].some(x=>['Post Receiving','Review & Post','Update Saved Line','Save Line to Draft'].includes(x.textContent.trim()) && x.getClientRects().length)"), false, "posted receipt exposed draft or repeat-post actions");
    assert.equal(await noOverflow(), true, `posted overflow at ${width}`);
    assert.equal(await evaluate("Boolean([...document.querySelectorAll('button')].find(x=>x.textContent.includes('View Stock / Batches')))"), true);
    await shot(`posted-${width}.png`);
    if (width === 1280) {
      assert.equal(await evaluate("(()=>{const a=document.querySelector('#receiving-saved-lines').getBoundingClientRect(),b=document.querySelector('#receiving-document-details').getBoundingClientRect();return a.right < b.left && Math.abs(a.top-b.top)<10})()"), true, "Posted items and details must be side by side");
      await shot("posted-desktop.png");
      assert.equal(await click("View Stock / Batches"), true);
      assert.equal(await evaluate("window.__openedStock"), true);
      assert.equal(await click("Movements · Chicken thigh"), true);
      assert.match(await evaluate("window.__openedMovements"), /RR-20261012-000001/);
      assert.equal(await click("View Linked Request"), true);
      assert.equal(await evaluate("Boolean(window.__openedRequest)"), true);
    }
    checks.push({ width, register: true, explicitStart: true, inspect: true, review: true, posted: true, noOverflow: true });
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("?populated=draft&mgrRec06Save=1");
  await waitFor("document.querySelector('#receiving-items-table')?.innerText.includes('Chicken breast')");
  assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('.manager-receiving-workitem')].find(x=>x.innerText.includes('Chicken breast'));row.querySelector('button').click();return true})()"), true);
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Chicken breast')");
  assert.equal(await setInput("line-delivered", "2.5"), true);
  assert.equal(await setInput("line-accepted", "1.25"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("document.body.innerText.includes('Enter a rejection reason whenever any quantity is rejected')");
  assert.equal(await setInput("line-rejection-reason", "Damaged packaging"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("document.body.innerText.includes(\"Enter the item's required use-by date\")");
  assert.equal(await evaluate("(window.__mgrRec06Saves||[]).length"), 0, "invalid inspection was saved");
  assert.equal(await setInput("line-use-by", "2026-10-24"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("(window.__mgrRec06Saves||[]).length === 1");
  assert.equal(await evaluate("document.querySelector('#receiving-saved-lines')?.innerText.includes('1.25 kg')"), true);
  assert.equal(await click("2 · Review"), true);
  await waitFor("document.querySelector('#receiving-review')?.getClientRects().length");
  assert.equal(await evaluate("document.querySelector('#receiving-saved-lines')?.innerText.includes('1.25 kg')"), true);
  await shot("saved-line-review-1280.png");
  assert.equal(await click("← Back to Inspect"), true);
  await waitFor("document.querySelector('#receiving-line-editor')?.getClientRects().length");
  assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('.manager-receiving-workitem')].find(x=>x.innerText.includes('Chicken breast'));row.querySelector('button').click();return true})()"), true);
  await waitFor("document.querySelector('#line-delivered')?.value === '2.5'");
  assert.equal(await setInput("line-delivered", "1.5"), true);
  assert.equal(await setInput("line-accepted", "1.5"), true);
  assert.equal(await click("Update Saved Line"), true);
  await waitFor("(window.__mgrRec06Saves||[]).length === 2");
  assert.equal(await evaluate("window.__mgrRec06Saves[0].id === window.__mgrRec06Saves[1].id"), true, "editing created a second line ID");
  assert.equal(await evaluate("document.querySelector('#receiving-saved-lines')?.innerText.includes('1.5 kg')"), true, "saved line edit did not retain identity and update quantity");

  await navigate("?populated=draft&optionalExpiry=1&mgrRec06Save=1");
  await waitFor("document.querySelector('#receiving-items-table')?.innerText.includes('Chicken breast')");
  assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('.manager-receiving-workitem')].find(x=>x.innerText.includes('Chicken breast'));row.querySelector('button').click();return true})()"), true);
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Expiry: Optional')");
  assert.equal(await evaluate("document.querySelector('#receiving-line-editor details')?.open"), false);
  assert.equal(await setInput("line-delivered", "1"), true);
  assert.equal(await setInput("line-accepted", "1"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("(window.__mgrRec06Saves||[]).length === 1");
  assert.equal(await evaluate("document.querySelector('#receiving-saved-lines')?.innerText.includes('1 kg')"), true, "optional expiry line did not save without a use-by date");

  await navigate("?populated=draft");
  await waitFor("document.querySelector('#receiving-line-editor')?.getClientRects().length");
  assert.equal(await setInput("line-delivered", "2"), true);
  await evaluate("window.confirm=()=>false");
  assert.equal(await click("← Back to Receiving Register"), true);
  assert.equal(await visible("#receiving-workspace-heading"), true, "unsaved inspection navigation was not guarded");
  assert.equal(await click("Refresh"), true);
  assert.equal(await visible("#receiving-workspace-heading"), true, "refresh discarded unsaved inspection");
  assert.equal(await click("2 · Review"), true);
  await waitFor("document.querySelector('#receiving-review')?.getClientRects().length");
  assert.equal(await evaluate("[...document.querySelectorAll('#receiving-review button')].some(x=>x.textContent.includes('Review & Post') && x.disabled)"), true, "unsaved inspection was postable");

  await navigate("?populated=draft&mgrUx08Units=1");
  await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length");
  assert.equal(await click("2 · Review"), true);
  await waitFor("document.querySelector('#receiving-saved-lines')?.getClientRects().length");
  const unitTable = await evaluate("document.querySelector('#receiving-saved-lines').innerText");
  assert.match(unitTable, /2 pcs/);
  assert.match(unitTable, /0\.06 L/);
  assert.doesNotMatch(unitTable, /\bS(?:pcs|L)\b/);
  assert.equal(await click("Review & Post"), true);
  await waitFor("document.querySelector('[aria-label=\"Saved receiving lines to post\"]')?.getClientRects().length");
  const unitReview = await evaluate("document.querySelector('[aria-label=\"Saved receiving lines to post\"]').innerText");
  assert.match(unitReview, /2 pcs/);
  assert.match(unitReview, /0\.06 L/);

  await navigate("?populated=draft&mgrRec06Save=1&mgrUx08Failure=1");
  await waitFor("document.querySelector('#receiving-items-table')?.innerText.includes('Chicken breast')");
  assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('.manager-receiving-workitem')].find(x=>x.innerText.includes('Chicken breast'));row.querySelector('button').click();return true})()"), true);
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('Chicken breast')");
  assert.equal(await setInput("line-delivered", "1"), true);
  assert.equal(await setInput("line-accepted", "1"), true);
  assert.equal(await setInput("line-use-by", "2026-10-24"), true);
  assert.equal(await click("Save Line to Draft"), true);
  await waitFor("document.body.innerText.includes('The receiving service could not be reached')");
  assert.equal(await evaluate("document.querySelector('#line-delivered')?.value === '1'"), true, "failed save lost entered values");
  await shot("save-failure-1280.png");

  await evaluate("sessionStorage.removeItem('rrj_manager_receiving_pending_post_v1')");
  await navigate("?mgrRec=1");
  await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length");
  assert.equal(await click("Supplier or emergency receipt"), true);
  await waitFor("document.querySelector('#receiving-document-details')?.getClientRects().length");
  assert.equal(await evaluate("document.querySelector('#receiving-source')?.value"), "production_team");
  await waitFor("document.querySelector('#receiving-document-details')?.innerText.includes('Manager emergency exception')");
  await shot("supplier-emergency-1280.png");

  await navigate("?mgrRec=1&paginate=1");
  await waitFor("document.body.innerText.includes('Receipt page 1')");
  assert.equal(await click("Next"), true);
  await waitFor("document.body.innerText.includes('Receipt page 2')");
  assert.equal(await click("Previous"), true);
  await waitFor("document.body.innerText.includes('Receipt page 1')");

  await navigate("?mgrRec=1&mgrRecError=1");
  await waitFor("document.querySelector('#receiving-register-panel [role=alert]')?.getClientRects().length");
  await send("Page.navigate", { url: `${base}?populated=draft&slow=1` });
  await waitFor("document.body.innerText.includes('Loading receiving')");
  await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length");

  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "network write");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:58441/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "external request");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, panelBoundsVerified: true, registerStatusSearchSource: true, registerPagination: true, requestLoadError: true, loadingState: true, draftResumeAndFocus: true, distinctRequestPriorAcceptedAndOutstanding: true, syntheticPostCalls: 1, invalidLineBlocked: true, localLineSaved: true, savedLineUpdated: true, savedLineIdentityPreserved: true, optionalExpirySavedWithoutUseBy: true, unsavedNavigationGuard: true, unsavedRefreshGuard: true, unsavedPostGuard: true, unitsPreserved: true, saveFailurePreservesInputs: true, postedRouteActions: true, supplierEmergencyEntry: true, browserErrors: errors, networkWrites: 0 }, null, 2));
  console.log("PASS: Receiving register, explicit draft, inspection/save, review, local synthetic post, posted receipt at 1440/1280/820/390");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
