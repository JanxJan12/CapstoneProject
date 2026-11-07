import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "qa", "cashier-dashboard-touch-evidence-20261102");
mkdirSync(output, { recursive: true });
const cssFile = readdirSync(join(root, "dist", "assets"))
  .filter((name) => name.endsWith(".css"))
  .map((name) => ({ name, size: readFileSync(join(root, "dist", "assets", name)).length }))
  .sort((a, b) => b.size - a.size)[0]?.name;
if (!cssFile) throw new Error("Build the app before rendering dashboard evidence.");
const css = readFileSync(join(root, "dist", "assets", cssFile), "utf8");

const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom" });
let CompactShiftHeader, PrimaryCashierActions, CashierWorkQueue;
try {
  ({ CompactShiftHeader } = await server.ssrLoadModule("/src/modules/cashier/dashboard/CompactShiftHeader.tsx"));
  ({ PrimaryCashierActions } = await server.ssrLoadModule("/src/modules/cashier/dashboard/PrimaryCashierActions.tsx"));
  ({ CashierWorkQueue } = await server.ssrLoadModule("/src/modules/cashier/dashboard/CashierWorkQueue.tsx"));
} finally {
  await server.close();
}

const noop = () => {};
const attention = {
  pendingPayments: 0, readyOrders: 0, delayedOrders: 0, agingOrders: 0,
  kitchenQueued: 0, preparingOrders: 0, waitingForRider: 0,
  deliveryInProgress: 0, actionRequired: 0, allActive: 6, olderBacklog: 6,
};
const older = [155, 35, 120, 35, 395, 235].map((totalAmount, index) => ({
  orderId: `ORD-0000${43 + index}`, createdAt: "2026-09-10T01:00:00Z",
  customerName: index < 5 ? "Walk-in Customer" : "Hannah Golbin",
  orderType: index < 5 ? "Dine-in" : "Delivery", totalAmount,
  currentStage: "Ready for handoff", stage: "ready_for_handoff",
  nextAction: "release_order", waitingMinutes: 74880 - index * 90,
  isDelayed: false, orderAgeReview: false, priority: 3,
  orderStatus: "ready", stageStartedAt: "2026-09-10T01:00:00Z",
}));
const page = renderToStaticMarkup(React.createElement("main", {
  className: "cashier-page cashier-dashboard-page mx-auto flex w-full max-w-[1600px] flex-col gap-3 pb-5 sm:gap-4",
  style: { padding: "24px" },
},
React.createElement(CompactShiftHeader, {
  summary: { isActive: true, cashierName: "JANMARICENIA", terminal: "Counter Terminal 01", expectedDrawer: 1000, pendingPaymentCount: 0 },
  onEndShift: noop,
}),
React.createElement(PrimaryCashierActions, {
  attention, shiftActive: true, onNewOrder: noop, onVerifyPayments: noop,
  onReleaseOrders: noop, onSearchOrder: noop, onReprintReceipt: noop,
}),
React.createElement(CashierWorkQueue, {
  queue: { current: [], older, all: older }, attention, view: "older_backlog",
  orders: older.map((item) => ({ id: item.orderId })), onViewChange: noop, onClearAttentionFilter: noop,
  onSelect: noop, onVerify: noop,
})));

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "rrj-dashboard-browser-"));
const browserProcess = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--disable-background-networking",
  "--no-proxy-server", "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1",
  "--allow-file-access-from-files", "--hide-scrollbars",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { windowsHide: true, stdio: "ignore" });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split(/\r?\n/)[0]);
      if (port) break;
    } catch { /* Browser is starting. */ }
    await pause(50);
  }
  if (!port) throw new Error("Chrome debugging port unavailable.");
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((res) => res.json());
  const tab = pages.find((entry) => entry.type === "page");
  if (!tab) throw new Error("Chrome page unavailable.");
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await command("Page.enable");
  await command("Runtime.enable");
  for (const [name, width, height] of [["desktop", 1440, 900], ["ipad-landscape", 1024, 768], ["ipad-portrait", 820, 1180], ["phone", 390, 844]]) {
    const htmlPath = join(output, `${name}.html`);
    const pngPath = join(output, `${name}.png`);
    writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>html,body{margin:0;width:100%;min-height:100%}</style></head><body>${page}</body></html>`);
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await command("Page.navigate", { url: `file:///${htmlPath.replaceAll("\\", "/")}` });
    let measured;
    for (let attempt = 0; attempt < 100; attempt++) {
      const ready = await command("Runtime.evaluate", {
        expression: "({ready:document.readyState,url:location.href,bodyLength:document.body.innerHTML.length,width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,minActionHeight:Math.min(...[...document.querySelectorAll('button')].map(node=>node.getBoundingClientRect().height)),minQueueButtonHeight:Math.min(...[...document.querySelectorAll('article button')].map(node=>node.getBoundingClientRect().height)),firstQueueRowHeight:document.querySelector('article')?.getBoundingClientRect().height})",
        returnByValue: true,
      });
      measured = ready.result.value;
      if (measured?.ready === "complete" && measured.width === width && measured.bodyLength > 1000) break;
      await pause(50);
    }
    if (measured?.width !== width || measured?.ready !== "complete" || measured.bodyLength <= 1000 || measured.scrollWidth > width || measured.minActionHeight < 43.5 || measured.minQueueButtonHeight < 43.5) {
      throw new Error(`${name} has clipped or undersized controls: ${JSON.stringify(measured)}`);
    }
    const capture = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    writeFileSync(pngPath, Buffer.from(capture.data, "base64"));
    console.log(`${name}: ${width}x${height}, scrollWidth=${measured.scrollWidth}, firstQueueRowHeight=${measured.firstQueueRowHeight}, minQueueButtonHeight=${measured.minQueueButtonHeight}, ${pngPath}`);
  }
} finally {
  ws?.close();
  browserProcess.kill();
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error.code !== "EBUSY" || attempt === 19) break;
      await pause(100);
    }
  }
}
