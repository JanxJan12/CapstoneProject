import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const read = (file) => readFileSync(file, "utf8");
const managerSource = read("src/modules/manager/index.tsx");
const inventoryFiles = [
  "InventoryPage",
  "ManagerRequestsPage",
  "InventoryItemDetail",
  "StockReceivingPage",
  "InvTransactionsPage",
  "WasteSpoilagePage",
  "AdjustmentPage",
  "InventoryAuditPage",
];
const checks = [];
function check(label, condition) {
  assert.ok(condition, label);
  checks.push(label);
}

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const [{ AppShell }, { MANAGER_NAV_GROUPS }] = await Promise.all([
    vite.ssrLoadModule("/src/components/layout/AppShell.tsx"),
    vite.ssrLoadModule("/src/modules/manager/index.tsx"),
  ]);
  const inventory = MANAGER_NAV_GROUPS.find(
    (group) => group.label === "Inventory & Supply",
  );
  const inventoryTools = inventory?.subgroups?.find(
    (group) => group.label === "Inventory Tools",
  );
  const expected = [
    "inventory",
    "replenishment",
    "stock-receiving",
    "inv-transactions",
    "waste-spoilage",
    "adjustment",
    "inventory-audit",
  ];
  check(
    "Inventory & Supply has three primary destinations and four grouped tools",
    inventory?.collapsible === true &&
      ["inventory", "replenishment", "stock-receiving"].every((id) =>
        inventory.items.some((item) => item.id === id),
      ) &&
      ["inv-transactions", "waste-spoilage", "adjustment", "inventory-audit"].every((id) =>
        inventoryTools?.items.some((item) => item.id === id),
      ),
  );
  check(
    "Purchase Orders and ERP prototypes are absent from Manager navigation",
    !MANAGER_NAV_GROUPS.some((group) =>
      [...group.items, ...(group.subgroups?.flatMap((subgroup) => subgroup.items) ?? [])].some((item) =>
        /purchase|supplier|transfer|production|warehouse/i.test(
          `${item.id} ${item.label}`,
        ),
      ),
    ),
  );
  const allIds = MANAGER_NAV_GROUPS.flatMap((group) =>
    [...group.items, ...(group.subgroups?.flatMap((subgroup) => subgroup.items) ?? [])].map((item) => item.id),
  );
  check(
    "all Manager destinations are unique",
    new Set(allIds).size === allIds.length,
  );
  check(
    "all seven inventory destinations render active pages",
    expected.every((id) => managerSource.includes(`case "${id}":`)),
  );
  check(
    "item context actions remain connected to workflows",
    managerSource.includes('setPage("inventory-item")') &&
      managerSource.includes("setItemContext(itemId)") &&
      managerSource.includes("onBackToItem"),
  );
  check(
    "old inventory tab bar is absent from active pages",
    inventoryFiles.every(
      (name) =>
        !read(`src/modules/manager/inventory/${name}.tsx`).includes(
          "<InventoryWorkspaceNav",
        ),
    ),
  );
  check(
    "Receiving keeps server-filtered status choices near its list",
    read("src/modules/manager/inventory/ReceivingDocumentList.tsx").includes(
      'aria-label="Receiving status"',
    ) &&
      read("src/modules/manager/inventory/ReceivingDocumentList.tsx").includes(
        "setFilters((current) => ({ ...current, status: value }))",
      ),
  );

  const html = renderToStaticMarkup(
    createElement(AppShell, {
      groups: MANAGER_NAV_GROUPS,
      active: "stock-receiving",
      onSelect: () => {},
      user: { name: "Manager QA", role: "Manager" },
      children: createElement("div", null, "Page content"),
    }),
  );
  check(
    "desktop sidebar and responsive drawer both render",
    html.includes('aria-label="Manager navigation"') &&
      html.includes('id="app-shell-navigation"') &&
      html.includes("lg:flex") &&
      html.includes("lg:hidden"),
  );
  check(
    "Inventory & Supply parent exposes expansion semantics and active context",
    html.includes('aria-expanded="true"') &&
      html.includes("Collapse Inventory &amp; Supply navigation") &&
      html.includes("is-current"),
  );
  check(
    "active Inventory child has page state",
    html.includes('aria-current="page"') && html.includes("Receiving"),
  );
  check(
    "mobile drawer remains hidden from assistive technology while closed",
    html.includes('aria-hidden="true"') &&
      read("src/components/layout/AppShell.tsx").includes(
        'drawer.setAttribute("inert", "")',
      ),
  );
  for (const role of ["Cashier", "Kitchen Display System"]) {
    const roleHtml = renderToStaticMarkup(
      createElement(AppShell, {
        groups: [{ label: "Work", items: [{ id: "queue", label: "Queue", icon: () => null }] }],
        active: "queue",
        onSelect: () => {},
        user: { name: "Local QA", role },
        children: createElement("div", null, "Role workspace"),
      }),
    );
    check(
      `${role} keeps the shared drawer and active item without Manager desktop navigation`,
      roleHtml.includes('id="app-shell-navigation"') &&
        roleHtml.includes('aria-current="page"') &&
        !roleHtml.includes('aria-label="Manager navigation"'),
    );
  }
  const pageCases = [
    [
      "InventoryPage",
      { onNavigate: () => {}, onOpenItem: () => {} },
      "Stock Overview",
    ],
    [
      "ManagerRequestsPage",
      { onReceive: () => {}, onReceiveLegacy: () => {} },
      "Inventory Requests",
    ],
    [
      "InventoryItemDetail",
      {
        itemId: "fixture",
        onBack: () => {},
        onNavigate: () => {},
        onAction: () => {},
      },
      "Item Stock",
    ],
    ["StockReceivingPage", {}, "Receiving"],
    ["InvTransactionsPage", {}, "Stock Movements"],
    ["WasteSpoilagePage", {}, "Waste / Spoilage"],
    ["AdjustmentPage", {}, "Inventory Adjustment"],
    ["InventoryAuditPage", {}, "Inventory Audit"],
  ];
  for (const [name, props, heading] of pageCases) {
    const module = await vite.ssrLoadModule(
      `/src/modules/manager/inventory/${name}.tsx`,
    );
    const pageHtml = renderToStaticMarkup(createElement(module[name], props));
    check(
      `${heading} renders one inventory page header without the old tab bar`,
      pageHtml.includes("manager-page-context") &&
        pageHtml.includes("<h1") &&
        pageHtml.includes(heading) &&
        !pageHtml.includes("inventory-workspace-nav"),
    );
  }
} finally {
  await vite.close();
}

for (const label of checks) console.log(`PASS: ${label}`);
console.log(
  `${checks.length}/${checks.length} Phase 6C.1 Manager shell checks passed.`,
);
