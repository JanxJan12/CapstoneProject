import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "qa", "cashier-pos-controlled-evidence-20261102");
mkdirSync(output, { recursive: true });
const cssFile = readdirSync(join(root, "dist", "assets"))
  .filter((name) => name.endsWith(".css"))
  .map((name) => ({ name, size: readFileSync(join(root, "dist", "assets", name)).length }))
  .sort((a, b) => b.size - a.size)[0]?.name;
if (!cssFile) throw new Error("Build the app before rendering POS evidence.");
const css = readFileSync(join(root, "dist", "assets", cssFile), "utf8");

const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom" });
let POSOrderHeader, MenuGrid, POSOrderSidebar, TransactionBar;
try {
  ({ POSOrderHeader } = await server.ssrLoadModule("/src/modules/cashier/pos/POSOrderHeader.tsx"));
  ({ MenuGrid } = await server.ssrLoadModule("/src/modules/cashier/pos/MenuGrid.tsx"));
  ({ POSOrderSidebar } = await server.ssrLoadModule("/src/modules/cashier/pos/POSOrderSidebar.tsx"));
  ({ TransactionBar } = await server.ssrLoadModule("/src/modules/cashier/pos/TransactionBar.tsx"));
} finally {
  await server.close();
}

const noop = () => {};
const menuItems = [
  { id: "MENU-04", code: "B2", name: "Chicken Bicol Express", category: "Viands", price: 130, available: true },
  { id: "MENU-01", code: "B1", name: "Crispy Beef Tadyang", category: "Viands", price: 185, available: true },
  { id: "MENU-07", code: "R2", name: "Fried Rice", category: "Rice", price: 45, available: true },
  { id: "MENU-05", code: "K1", name: "Kare-Kare", category: "Viands", price: 175, available: true },
  { id: "MENU-06", code: "V1", name: "Pinakbet", category: "Vegetables", price: 110, available: true },
  { id: "MENU-03", code: "S1", name: "Sinigang na Baka", category: "Soups", price: 155, available: true },
  { id: "MENU-08", code: "R1", name: "White Rice", category: "Rice", price: 35, available: true },
];
const lines = [
  { lineId: "line-1", menuItemId: "MENU-04", name: "Chicken Bicol Express", unitPrice: 130, quantity: 2 },
  { lineId: "line-2", menuItemId: "MENU-07", name: "Fried Rice", unitPrice: 45, quantity: 1 },
];

function renderPOS({ expanded, mobileOpen, empty }) {
  const items = empty ? [] : lines;
  const total = empty ? 0 : 305;
  const editorProps = {
    items, orderNumber: "SYNTHETIC-ORDER", orderType: "Dine-in",
    subtotal: total, taxAmount: 0, taxEnabled: false, total,
    shiftOpen: true, busy: false, canContinue: !empty,
    onOpenShift: noop, onAdjust: noop, onQuantityChange: noop,
    onRemove: noop, onReorder: noop,
    onClear: noop, onPayment: noop,
  };
  return React.createElement("div", {
    className: "tablet-pos relative flex h-full min-h-0 flex-col overflow-hidden border",
    style: { height: "100vh", width: "100vw" },
  },
  React.createElement(POSOrderHeader, {
    orderType: "Dine-in", busy: false, shiftOpen: true,
    heldOrders: [], hasItems: !empty, canCancel: !empty,
    search: { value: "", resultCount: 0, recentSearches: [], onChange: noop,
      onCommit: noop, onMove: noop, onEnter: noop, onEscape: noop },
    onNew: noop, onHold: noop, onCancel: noop, onReopen: noop,
    onSelectOrderType: noop,
  }),
  React.createElement("div", {
    className: "pos-entry-layout min-h-0 flex-1",
    "data-order-panel": expanded ? "expanded" : "collapsed",
  },
  React.createElement("main", { className: "pos-workspace min-h-0 flex-1" },
    React.createElement(MenuGrid, {
      menuItems, cart: items, category: "All", search: "",
      bestSellerIds: ["MENU-04", "MENU-01"], heldOrderCount: 0,
      onCategoryChange: noop, onSelect: noop, onQuickAdd: noop,
    })),
  React.createElement(POSOrderSidebar, { ...editorProps, expanded, onToggle: noop })),
  React.createElement(TransactionBar, {
    items, lastItemCode: empty ? undefined : "R2", itemCount: empty ? 0 : 3,
    total, state: "ordering", busy: false, shiftOpen: true,
    onOpenShift: noop, onAdjust: noop, onUndoLast: noop,
    onViewOrder: noop, onPayment: noop,
  }),
  mobileOpen ? React.createElement("div", { className: "pos-mobile-order-overlay" },
    React.createElement("div", { className: "pos-mobile-order-backdrop" }),
    React.createElement(POSOrderSidebar, {
      ...editorProps, detailsId: "pos-mobile-order-details",
      expanded: true, focusToggle: true, onToggle: noop,
    })) : null);
}

const cases = [
  ["desktop-expanded", 1440, 900, { expanded: true }],
  ["desktop-collapsed", 1440, 900, { expanded: false }],
  ["desktop-empty", 1440, 900, { expanded: false, empty: true }],
  ["ipad-landscape", 1024, 768, { expanded: true }],
  ["tablet-order", 820, 1180, { expanded: true, mobileOpen: true }],
  ["phone-menu", 390, 844, { expanded: true }],
  ["phone-order", 390, 844, { expanded: true, mobileOpen: true }],
];
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "rrj-pos-browser-"));
const process = spawn(chrome, [
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
      break;
    } catch { await pause(100); }
  }
  if (!port) throw new Error("Chrome debugger unavailable");
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  const tab = tabs.find((entry) => entry.type === "page");
  if (!tab) throw new Error("Chrome page unavailable");
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
  for (const [name, width, height, props] of cases) {
    const markup = renderToStaticMarkup(renderPOS(props));
    const imageBase = `file:///${join(root, "public", "menu").replaceAll("\\", "/")}/`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body>${markup.replaceAll('src="/menu/', `src="${imageBase}`)}<script>
      const viewport = document.querySelector('.pos-product-viewport');
      const grid = document.querySelector('.pos-product-grid');
      if (viewport && grid) {
        const width = viewport.clientWidth;
        const columns = width >= 1650 ? 6 : width >= 1380 ? 5 : width >= 1100 ? 4 : width >= 700 ? 3 : width >= 520 ? 2 : 1;
        grid.style.gridTemplateColumns = 'repeat(' + columns + ', minmax(0, 1fr))';
        grid.parentElement.style.height = Math.ceil(grid.children.length / columns) * 152 + 'px';
        document.body.dataset.renderColumns = String(columns);
      }
    </script></body></html>`;
    const htmlPath = join(output, `${name}.html`);
    const pngPath = join(output, `${name}.png`);
    writeFileSync(htmlPath, html);
    await command("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile: width < 600,
    });
    await command("Page.navigate", { url: `file:///${htmlPath.replaceAll("\\", "/")}` });
    let measured;
    for (let attempt = 0; attempt < 100; attempt++) {
      const ready = await command("Runtime.evaluate", {
        expression: "({ready:document.readyState,width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,columns:document.body.dataset.renderColumns,headerHeight:document.querySelector('.pos-order-header')?.getBoundingClientRect().height,minControlHeight:Math.min(...[...document.querySelectorAll('.pos-order-actions button,.pos-order-type-switch button,.pos-search-wrap input')].map(node=>node.getBoundingClientRect().height))})",
        returnByValue: true,
      });
      measured = ready.result.value;
      if (measured?.ready === "complete" && measured.width === width) break;
      await pause(50);
    }
    if (measured?.width !== width || measured?.ready !== "complete" || !measured?.columns) {
      throw new Error(`${name} viewport unavailable: ${JSON.stringify(measured)}`);
    }
    if (measured.scrollWidth > width || measured.minControlHeight < 44) {
      throw new Error(`${name} header has clipped or undersized controls: ${JSON.stringify(measured)}`);
    }
    const capture = await command("Page.captureScreenshot", {
      format: "png", fromSurface: true, captureBeyondViewport: false,
    });
    writeFileSync(pngPath, Buffer.from(capture.data, "base64"));
    console.log(`${name}: ${measured.width}x${height}, scrollWidth=${measured.scrollWidth}, headerHeight=${measured.headerHeight}, minControlHeight=${measured.minControlHeight}, columns=${measured.columns}, ${pngPath}`);
  }
} finally {
  ws?.close();
  process.kill();
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error.code !== "EBUSY" || attempt === 19) {
        console.warn(`Temporary browser profile retained: ${profile}`);
        break;
      }
      await pause(100);
    }
  }
}
