import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const viewport = process.argv[2];
if (!["desktop", "mobile"].includes(viewport)) throw new Error("Use desktop or mobile");
const out = path.resolve("qa/manager-final-gaps-20261012");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-manager-gaps-"));
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { windowsHide: true, stdio: "ignore" });
const chromeClosed = new Promise((resolve) => { chrome.once("close", resolve); chrome.once("error", () => {}); });
let ws;
const requests = [];
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  if (!port) throw new Error("Chrome did not start");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const packet = JSON.parse(event.data);
    if (packet.method === "Network.requestWillBeSent") requests.push(packet.params.request.url);
    if (packet.id && pending.has(packet.id)) {
      const { resolve, reject } = pending.get(packet.id); pending.delete(packet.id);
      packet.error ? reject(new Error(packet.error.message)) : resolve(packet.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id; pending.set(next, { resolve, reject });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const pause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  const metrics = async () => evaluate(`(() => {
    const main = document.querySelector('.app-shell-main');
    return { width: innerWidth, bodyScrollWidth: document.documentElement.scrollWidth, bodyElementWidth:document.body.scrollWidth,
      mainWidth: main?.clientWidth, mainScrollWidth: main?.scrollWidth,
      wideElements:Array.from(document.querySelectorAll('body *')).filter(e=>e.scrollWidth>innerWidth+2).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className.slice(0,80):'',width:e.scrollWidth,client:e.clientWidth})).slice(0,8),
      overflowCandidates: Array.from(document.querySelectorAll('body *')).map(e => ({ tag:e.tagName, cls:typeof e.className==='string'?e.className.slice(0,90):'', right:Math.round(e.getBoundingClientRect().right) })).filter(e=>e.right>innerWidth+2).sort((a,b)=>b.right-a.right).slice(0,5),
      smallTargets: Array.from(document.querySelectorAll('button')).filter(b => {
        const r=b.getBoundingClientRect(); return r.width>0 && r.height>0 && (r.width<44 || r.height<44);
      }).map(b => b.textContent.trim()).slice(0,10) };
  })()`);
  const shot = async (name) => {
    const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(path.join(out, `${name}-${viewport}.png`), Buffer.from(png.data, "base64"));
  };
  const navigate = async (page) => {
    await send("Page.navigate", { url: `http://127.0.0.1:5174/scripts/fixtures/visual-manager.html?page=${page}` });
    for (let i=0; i<80; i++) {
      if (await evaluate("!!document.querySelector('.inventory-workspace-page') && !document.body.textContent.includes('Loading inventory…')")) break;
      await pause(100);
    }
    await pause(600);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: viewport === "mobile" ? 412 : 1440, height: viewport === "mobile" ? 915 : 1000, deviceScaleFactor: 1, mobile: viewport === "mobile" });
  await navigate("inventory");
  const stock = {
    ...await metrics(),
    desktopTableVisible: await evaluate("!!document.querySelector('.manager-stock-table') && getComputedStyle(document.querySelector('.manager-stock-table').parentElement).display !== 'none'"),
    mobileCardsVisible: await evaluate("!!document.querySelector('.manager-stock-row') && getComputedStyle(document.querySelector('.manager-stock-row').parentElement).display !== 'none'"),
    headings: await evaluate("Array.from(document.querySelectorAll('.manager-stock-table thead th')).map(e=>e.textContent.trim())"),
    rows: await evaluate("document.querySelectorAll('.manager-stock-table tbody tr').length"),
    contextualActions: await evaluate("Array.from(document.querySelectorAll('.manager-stock-table tbody button')).filter(b=>b.textContent.includes('Prepare Request')).length"),
  };
  await shot("after-stock");
  if (viewport === "desktop") {
    await evaluate("Array.from(document.querySelectorAll('.manager-stock-table tbody tr')).find(r=>r.textContent.includes('Marinated chicken - quarter leg'))?.querySelector('td:last-child button:last-child')?.click()");
    await pause(800);
    stock.contextActionOpenedRequests = await evaluate("!!document.querySelector('.manager-request-sheet')");
    stock.contextItemSelected = await evaluate("document.querySelector('.manager-request-sheet')?.textContent.includes('Marinated chicken - quarter leg')");
  }
  await evaluate("sessionStorage.removeItem('rrj_inventory_request_unsaved_v1')");
  await navigate("replenishment");
  await shot("after-editor");
  const editor = { ...await metrics(), reviewPresent: await evaluate("!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Review request')") };
  const reason = await evaluate("document.querySelector('.manager-request-details input:not([type])')?.outerHTML");
  if (!reason) throw new Error("Reason input missing");
  await evaluate("document.querySelector('.manager-request-details input:not([type])').focus()");
  await send("Input.insertText", { text: "Kitchen service replenishment" });
  await evaluate("Array.from(document.querySelectorAll('.manager-request-sheet input[type=number]')).find(e=>e.getBoundingClientRect().width>0)?.focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Control", windowsVirtualKeyCode: 17 });
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", windowsVirtualKeyCode: 17 });
  await send("Input.insertText", { text: "5" });
  await pause();
  await evaluate("Array.from(document.querySelectorAll('.manager-request-sheet input[aria-label$=\\\"override reason\\\"]')).find(e=>e.getBoundingClientRect().width>0)?.focus()");
  await send("Input.insertText", { text: "Additional scheduled service" });
  await pause();
  const editValues = await evaluate("({ reason:document.querySelector('.manager-request-details input:not([type])')?.value, quantity:Array.from(document.querySelectorAll('.manager-request-sheet input[type=number]')).find(e=>e.getBoundingClientRect().width>0)?.value, override:Array.from(document.querySelectorAll('.manager-request-sheet input[aria-label$=\\\"override reason\\\"]')).find(e=>e.getBoundingClientRect().width>0)?.value })");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Review request')?.click()");
  await pause();
  const review = { ...await metrics(), visible: await evaluate("!!document.querySelector('.manager-request-review')"), title: await evaluate("document.querySelector('#pre-issue-title')?.textContent"), draftBadge: await evaluate("document.querySelector('.manager-request-review .manager-state-badge')?.textContent"), quantity: await evaluate("document.querySelector('.manager-request-review table tbody tr td:nth-of-type(2)')?.textContent"), reason: await evaluate("document.querySelector('.manager-request-review .manager-issued-reason')?.textContent"), issueButton: await evaluate("!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Issue Request')"), editorHidden: await evaluate("!document.querySelector('.manager-request-details')"), focusedHeading: await evaluate("document.activeElement?.id === 'pre-issue-title'"), error: await evaluate("document.querySelector('[role=alert]')?.textContent ?? ''"), issueCallsBefore: await evaluate("window.__fixtureIssueCalls ?? 0") };
  await shot("after-preview");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Back to edit')?.click()");
  await pause();
  const back = { editorVisible: await evaluate("!!document.querySelector('.manager-request-details')"), values: await evaluate("({ reason:document.querySelector('.manager-request-details input:not([type])')?.value, quantity:Array.from(document.querySelectorAll('.manager-request-sheet input[type=number]')).find(e=>e.getBoundingClientRect().width>0)?.value, override:Array.from(document.querySelectorAll('.manager-request-sheet input[aria-label$=\\\"override reason\\\"]')).find(e=>e.getBoundingClientRect().width>0)?.value })"), focusedHeading: await evaluate("document.activeElement?.textContent?.includes('Unsaved request sheet')") };
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Review request')?.click()");
  await pause();
  const reviewedAgain = await evaluate("!!document.querySelector('.manager-request-review')");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Issue Request')?.click()");
  await pause(500);
  const issue = { fixtureError: await evaluate("document.querySelector('[role=alert]')?.textContent ?? ''"), stillReview: await evaluate("!!document.querySelector('.manager-request-review')"), issueCallsAfter: await evaluate("window.__fixtureIssueCalls ?? 0") };
  await send("Page.navigate", { url: "http://127.0.0.1:5174/scripts/fixtures/visual-manager.html?page=inventory&stockSlow=1" });
  await pause(250);
  const loadingShown = await evaluate("!!Array.from(document.querySelectorAll('[role=status]')).find(e=>e.textContent.includes('Loading inventory'))");
  await pause(1400);
  const loadedAfterDelay = await evaluate("document.querySelectorAll('.manager-stock-table tbody tr').length === 3");
  await send("Page.navigate", { url: "http://127.0.0.1:5174/scripts/fixtures/visual-manager.html?page=inventory&stockError=1" });
  await pause(700);
  const stockError = await evaluate("document.querySelector('[role=alert]')?.textContent.includes('Synthetic stock source unavailable') && !!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Try Again'))");
  await send("Page.navigate", { url: "http://127.0.0.1:5174/scripts/fixtures/visual-manager.html?page=replenishment&requestError=1" });
  await pause(700);
  const requestError = await evaluate("document.querySelector('[role=alert]')?.textContent.includes('Synthetic proposal unavailable') && Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Review request'))?.disabled === true");
  const externalRequests = requests.filter((url) => { try { const target = new URL(url); return ["http:", "https:"].includes(target.protocol) && !["127.0.0.1", "localhost"].includes(target.hostname); } catch { return true; } });
  const report = { viewport, stock, editor, editValues, review, back, reviewedAgain, issue, loadingShown, loadedAfterDelay, stockError, requestError, requestCount: requests.length, externalRequests };
  await writeFile(path.join(out, `interaction-${viewport}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  try { ws?.close(); } catch (error) { console.warn(`Chrome debugging connection close failed: ${error.message}`); }
  chrome.kill();
  let timeout;
  const stopped = await Promise.race([chromeClosed.then(() => true), new Promise((resolve) => { timeout = setTimeout(() => resolve(false), 5000); })]);
  clearTimeout(timeout);
  if (stopped) await rm(profile, { recursive: true }).catch((error) => console.warn(`Temporary Chrome profile cleanup failed: ${error.message}`));
  else console.warn(`Chrome did not close; temporary profile retained: ${profile}`);
}
