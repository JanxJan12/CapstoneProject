import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const [phase, page, viewport = "desktop", state = "default"] = process.argv.slice(2);
const viewports = {
  desktop: [1440, 900],
  "desktop-medium": [1280, 800],
  "desktop-small": [1024, 768],
  mobile: [412, 915],
  "mobile-small": [360, 800],
  "mobile-mid": [390, 844],
  "mobile-wide": [430, 932],
};
if (!["before", "after"].includes(phase) || !["dashboard", "inventory", "inventory-item", "inv-transactions", "replenishment", "stock-receiving"].includes(page) || !Object.hasOwn(viewports, viewport) || !["default", "populated", "draft"].includes(state)) throw new Error("Usage: capture-visual-manager.mjs before|after page viewport [default|populated|draft]");
const out = path.resolve("qa/visual-manager-20261012");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-visual-manager-"));
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
  const [width, height] = viewports[viewport];
  const isMobile = viewport.startsWith("mobile");
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: isMobile });
  await send("Page.navigate", { url: `http://127.0.0.1:5173/scripts/fixtures/visual-manager.html?page=${page}${state === "default" ? "" : `&populated=${state === "draft" ? "draft" : "1"}`}` });
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
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
  const stateSuffix = state === "default" ? "" : `-${state}`;
  const file = path.join(out, `${phase}-${page}${stateSuffix}-${viewport}.png`);
  await writeFile(file, Buffer.from(shot.data, "base64"));
  if (page === "stock-receiving" && state === "populated") {
    dimensions.postedBatchLink = (await send("Runtime.evaluate", { expression: "Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.includes('View item and movements'))", returnByValue: true })).result.value;
    await send("Runtime.evaluate", { expression: "Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('View item and movements'))?.click()" });
    dimensions.postedBatchNavigates = (await send("Runtime.evaluate", { expression: "document.querySelector('[data-page]')?.getAttribute('data-page') === 'inventory' && document.querySelector('h1')?.textContent?.trim() === 'Chicken thigh'", returnByValue: true })).result.value;
  }
  if (page === "replenishment" && state === "populated") {
    const inspect = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
    await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Request history'))?.click()");
    await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Open detail')?.click()");
    dimensions.requestDetailVisible = await inspect("document.body.textContent.includes('Physical deliveries') && document.body.textContent.includes('PR-20261012-000001')");
    const requestShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
    await writeFile(path.join(out, `${phase}-${page}-${viewport}-detail.png`), Buffer.from(requestShot.data, "base64"));
    await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()==='RR-20261012-000001')?.click()");
    dimensions.requestOpensReceiving = await inspect("document.querySelector('h1')?.textContent?.trim()==='Receiving' && document.body.textContent.includes('RR-20261012-000001')");
    await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('View item and movements'))?.click()");
    dimensions.receivingOpensItem = await inspect("document.querySelector('h1')?.textContent?.trim()==='Chicken thigh'");
    await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('View all movements'))?.click()");
    dimensions.itemOpensMovements = await inspect("document.querySelector('h1')?.textContent?.trim()==='Stock Movements' && document.body.textContent.includes('LOCAL-DEMO-USED')");
  }
  if (page === "inventory-item") {
    dimensions.itemScroll = (await send("Runtime.evaluate", { expression: "(()=>{const main=document.scrollingElement;main.scrollTop=850;return {top:main.scrollTop,height:main.scrollHeight,viewport:main.clientHeight}})()", returnByValue: true })).result.value;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const detailShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
    await writeFile(path.join(out, `${phase}-${page}-${viewport}-batches.png`), Buffer.from(detailShot.data, "base64"));
    dimensions.batchListVisible = (await send("Runtime.evaluate", { expression: "!!document.querySelector('#item-batches-heading')", returnByValue: true })).result.value;
    dimensions.usedBatchVisible = (await send("Runtime.evaluate", { expression: "document.body.textContent.includes('LOCAL-DEMO-USED')", returnByValue: true })).result.value;
    await send("Runtime.evaluate", { expression: "document.scrollingElement.scrollTop = 1450" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const movementShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
    await writeFile(path.join(out, `${phase}-${page}-${viewport}-movements.png`), Buffer.from(movementShot.data, "base64"));
    await send("Runtime.evaluate", { expression: "Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('View all movements'))?.click()" });
    dimensions.movementsNavigation = (await send("Runtime.evaluate", { expression: "document.querySelector('[data-page]')?.getAttribute('data-page') === 'inv-transactions'", returnByValue: true })).result.value;
  }
  if (phase === "after" && isMobile) {
    const inspect = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
    if (page === "dashboard") {
      await inspect("document.querySelector('button[aria-label=\"Open navigation\"]')?.click()");
      dimensions.drawerOpens = await inspect("document.querySelector('button[aria-label=\"Open navigation\"]')?.getAttribute('aria-expanded') === 'true'");
      await new Promise((resolve) => setTimeout(resolve, 250));
      const drawerShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
      await writeFile(path.join(out, `${phase}-${page}-${viewport}-drawer.png`), Buffer.from(drawerShot.data, "base64"));
      await inspect("document.querySelector('button[aria-label=\"Collapse Inventory & Supply navigation\"]')?.click()");
      dimensions.inventoryGroupCollapses = await inspect("document.querySelector('button[aria-label=\"Expand Inventory & Supply navigation\"]')?.getAttribute('aria-expanded')==='false'");
      await inspect("document.querySelector('button[aria-label=\"Expand Inventory & Supply navigation\"]')?.click()");
      dimensions.inventoryGroupReopens = await inspect("document.querySelector('button[aria-label=\"Collapse Inventory & Supply navigation\"]')?.getAttribute('aria-expanded')==='true'");
      await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Inventory Tools'&&b.getClientRects().length)?.click()");
      dimensions.inventoryToolsCollapses = await inspect("Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.trim()==='Inventory Tools'&&b.getClientRects().length&&b.getAttribute('aria-expanded')==='false')");
      await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Inventory Tools'&&b.getClientRects().length)?.click()");
      dimensions.inventoryToolsReopens = await inspect("Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.trim()==='Inventory Tools'&&b.getClientRects().length&&b.getAttribute('aria-expanded')==='true')");
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
    if (page === "replenishment" && state === "default") {
      dimensions.mobileRequestCards = await inspect("document.querySelectorAll('.manager-request-mobile-line').length");
      dimensions.desktopTableHidden = await inspect("getComputedStyle(document.querySelector('.manager-request-sheet table').parentElement).display === 'none'");
      await inspect("Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Request history'))?.click()");
      dimensions.historyOpens = await inspect("!!Array.from(document.querySelectorAll('h2')).find(e=>e.textContent?.includes('Request register'))");
    }
    if (page === "stock-receiving" && state === "default") {
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
