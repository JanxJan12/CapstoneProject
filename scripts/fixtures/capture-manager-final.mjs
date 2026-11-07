import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const [phase, page, viewport = "desktop", state = "default"] = process.argv.slice(2);
if (!["before", "after"].includes(phase) || !["dashboard", "inventory", "replenishment", "stock-receiving", "inv-transactions", "waste-spoilage", "adjustment", "inventory-audit"].includes(page) || !["desktop", "mobile"].includes(viewport)) throw new Error("Usage: capture-manager-final.mjs before|after page desktop|mobile [state]");
const out = path.resolve("qa/manager-final-visual-20261012");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-manager-final-"));
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { windowsHide: true, stdio: "ignore" });
const chromeClosed = new Promise((resolve) => { chrome.once("close", resolve); chrome.once("error", () => {}); });
let ws;
try {
  let port;
  for (let i = 0; i < 80; i++) {
    try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  if (!port) throw new Error("Chrome debugging endpoint did not open");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const packet = JSON.parse(event.data);
    if (packet.id && pending.has(packet.id)) {
      const { resolve, reject } = pending.get(packet.id); pending.delete(packet.id);
      packet.error ? reject(new Error(packet.error.message)) : resolve(packet.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id; pending.set(next, { resolve, reject });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  const width = viewport === "mobile" ? 412 : 1440;
  const height = viewport === "mobile" ? 915 : 1000;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: viewport === "mobile" });
  await send("Page.navigate", { url: `http://127.0.0.1:5173/scripts/fixtures/visual-manager.html?page=${page}${state === "populated" ? "&populated=1" : state === "draft" ? "&populated=draft" : ""}` });
  let dimensions;
  for (let i = 0; i < 80; i++) {
    const result = await send("Runtime.evaluate", { expression: "({ready: !!document.querySelector('.manager-dashboard, .inventory-workspace-page'), innerWidth, scrollWidth: document.documentElement.scrollWidth})", returnByValue: true });
    dimensions = result.result.value;
    if (dimensions?.ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!dimensions?.ready) throw new Error("Manager page did not render");
  await new Promise((resolve) => setTimeout(resolve, 900));
  dimensions = (await send("Runtime.evaluate", { expression: "({innerWidth, scrollWidth: document.documentElement.scrollWidth, mainWidth: document.querySelector('.app-shell-main')?.clientWidth, mainScrollWidth: document.querySelector('.app-shell-main')?.scrollWidth})", returnByValue: true })).result.value;
  if (dimensions.scrollWidth > dimensions.innerWidth) {
    dimensions.overflowCandidates = (await send("Runtime.evaluate", { expression: "Array.from(document.querySelectorAll('body *')).map(e => ({tag:e.tagName, cls:typeof e.className==='string'?e.className.slice(0,70):'', right:Math.round(e.getBoundingClientRect().right)})).filter(e=>e.right>innerWidth+10).sort((a,b)=>b.right-a.right).slice(0,5)", returnByValue: true })).result.value;
  }
  if (page === "replenishment" && state !== "default") {
    await send("Runtime.evaluate", { expression: "Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Request history'))?.click()" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (state === "detail") {
      await send("Runtime.evaluate", { expression: "Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Open detail'))?.click()" });
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  const inspectCurrent = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
  if (page === "replenishment" && state === "default") {
    dimensions.editableQuantities = await inspectCurrent("Array.from(document.querySelectorAll('.manager-request-mobile-line input[type=number], .manager-request-sheet table input[type=number]')).filter(e=>e.getBoundingClientRect().width>0).length");
    dimensions.reviewActionPresent = await inspectCurrent("Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.includes('Review request'))");
  }
  if (page === "replenishment" && state === "detail") {
    dimensions.exportActions = await inspectCurrent("['Copy Text','Download Text','PNG','Print / Save PDF'].map(s=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.includes(s)))");
    dimensions.dispatchSeparate = await inspectCurrent("!!document.querySelector('.manager-dispatch-record button') && !!document.querySelector('.manager-export-actions')");
    dimensions.revisionVisible = await inspectCurrent("!!Array.from(document.querySelectorAll('summary')).find(e=>e.textContent?.includes('Previous revision'))");
  }
  if (page === "stock-receiving" && (state === "populated" || state === "draft")) {
    dimensions.reconciliationItems = await inspectCurrent("document.querySelectorAll('.manager-receiving-balance').length");
    dimensions.postedReadOnly = await inspectCurrent("document.body.textContent.includes('Read only') && document.body.textContent.includes('Outstanding now')");
  }
  if (viewport === "mobile") {
    dimensions.visibleSmallTargets = await inspectCurrent("Array.from(document.querySelectorAll('button')).filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&r.width<44||r.width>0&&r.height>0&&r.height<44}).slice(0,5).map(b=>({text:b.textContent?.trim().slice(0,25),width:Math.round(b.getBoundingClientRect().width),height:Math.round(b.getBoundingClientRect().height)}))");
  }
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: state === "detail" || state === "populated" || state === "draft", fromSurface: true });
  const file = path.join(out, `${phase}-${page}-${state}-${viewport}.png`);
  await writeFile(file, Buffer.from(shot.data, "base64"));
  if (page === "replenishment" && state === "default" && viewport === "mobile") {
    dimensions.quantityEdit = await inspectCurrent("(()=>{const e=document.querySelector('.manager-request-mobile-line input[type=number]');if(!e)return false;const old=e.value;const next=String(Number(old)+1);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,next);e.dispatchEvent(new Event('input',{bubbles:true}));return e.value===next})()");
  }
  if (page === "replenishment" && state === "detail" && viewport === "desktop") {
    const downloads = path.join(out, "export-smoke");
    await mkdir(downloads, { recursive: true });
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
    for (const label of ["Download Text", "PNG"]) {
      await send("Runtime.evaluate", { expression: `Array.from(document.querySelectorAll('.manager-export-actions button')).find(b=>b.textContent?.includes(${JSON.stringify(label)}))?.click()` });
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    dimensions.exportFiles = (await readdir(downloads)).filter((name) => name.endsWith(".txt") || name.endsWith(".png"));
  }
  if (phase === "after" && viewport === "mobile") {
    const inspect = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
    if (page === "dashboard") {
      await inspect("document.querySelector('button[aria-label=\"Open navigation\"]')?.click()");
      dimensions.drawerOpens = await inspect("document.querySelector('button[aria-label=\"Open navigation\"]')?.getAttribute('aria-expanded') === 'true'");
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await new Promise((resolve) => setTimeout(resolve, 120));
      dimensions.escapeClosesDrawer = await inspect("document.querySelector('button[aria-label=\"Open navigation\"]')?.getAttribute('aria-expanded') === 'false'");
      dimensions.escapeReturnsFocus = await inspect("document.activeElement === document.querySelector('button[aria-label=\"Open navigation\"]')");
      await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Open Stock Monitor'))?.click()");
      await new Promise((resolve) => setTimeout(resolve, 180));
      dimensions.stockActionNavigates = await inspect("document.querySelector('[data-page]')?.getAttribute('data-page') === 'inventory'");
    }
    if (page === "inventory") {
      dimensions.searchControlPresent = await inspect("!!document.querySelector('input[type=search]')");
      dimensions.stockCardsPresent = await inspect("document.querySelectorAll('.manager-stock-row').length === 3");
      dimensions.stockCardsInsideViewport = await inspect("Array.from(document.querySelectorAll('.manager-stock-row')).every(e=>e.getBoundingClientRect().width <= innerWidth)");
    }
    if (page === "replenishment") {
      dimensions.mobileRequestCards = await inspect("document.querySelectorAll('.manager-request-mobile-line').length");
      dimensions.desktopTableHidden = await inspect("getComputedStyle(document.querySelector('.manager-request-sheet table').parentElement).display === 'none'");
      await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Request history'))?.click()");
      dimensions.historyOpens = await inspect("!!Array.from(document.querySelectorAll('h2')).find(e=>e.textContent?.includes('Request register'))");
    }
    if (page === "stock-receiving") {
      dimensions.receivingSteps = await inspect("document.querySelectorAll('.manager-workflow-steps span').length");
      await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('New Receiving'))?.click()");
      dimensions.newDraftOpens = await inspect("!!document.querySelector('select, input') && !document.body.textContent.includes('Start or resume formal receiving')");
    }
  }
  console.log(JSON.stringify({ file, ...dimensions }));
} finally {
  try { ws?.close(); } catch (error) { console.warn(`Chrome debugging connection close failed: ${error.message}`); }
  chrome.kill();
  let timeout;
  const stopped = await Promise.race([chromeClosed.then(() => true), new Promise((resolve) => { timeout = setTimeout(() => resolve(false), 5000); })]);
  clearTimeout(timeout);
  if (stopped) await rm(profile, { recursive: true }).catch((error) => console.warn(`Temporary Chrome profile cleanup failed: ${error.message}`));
  else console.warn(`Chrome did not close; temporary profile retained: ${profile}`);
}
