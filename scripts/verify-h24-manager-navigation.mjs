import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manager = read("../src/modules/manager/index.tsx");
const shell = read("../src/components/layout/AppShell.tsx");
const overview = read("../src/modules/manager/inventory/InventoryPage.tsx");
const movements = read(
  "../src/modules/manager/inventory/InvTransactionsPage.tsx",
);
const audit = read(
  "../src/modules/manager/inventory/InventoryReconciliationPanel.tsx",
);
const itemDetail = read(
  "../src/modules/manager/inventory/InventoryItemDetail.tsx",
);
const menu = manager
  .split("export const MANAGER_NAV_GROUPS")[1]
  .split("function ManagerPageLoader")[0];
const ids = [...menu.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);

assert.equal(ids.length, 15, "all 15 mounted menu destinations remain present");
assert.equal(new Set(ids).size, ids.length, "menu destinations are unique");
for (const id of ids) {
  assert.match(manager, new RegExp(`case "${id}":`), `${id} is mounted`);
}
assert.match(menu, /id: "inventory"[\s\S]*?label: "Stock Overview"/);
assert.match(menu, /label: "Inventory & Supply"/);
assert.match(menu, /label: "Inventory Tools"/);
assert.match(shell, /renderSidebarContent\(true\)/);
assert.match(shell, /renderSidebarContent\(false\)/);
assert.match(
  shell,
  /aria-current=\{active === item\.id \? "page" : undefined\}/,
);
assert.match(shell, /if \(!desktop\) closeNavigation\("content"\)/);
assert.match(
  manager,
  /onSelect=\{\(target\) => \{\s*if \(target === page\) return;/,
);
assert.match(
  manager,
  /active=\{page === "inventory-item" \? "inventory" : page\}/,
);
assert.match(
  manager,
  /activeTitle=\{\s*page === "inventory-item" && itemContext \? "Item Stock" : undefined\s*\}/,
);
assert.match(manager, /initialRequestId=\{requestDocumentId \?\? undefined\}/);
assert.match(manager, /initialReportId=\{receivingReportId \?\? undefined\}/);
assert.match(manager, /initialItemId=\{itemContext \?\? ""\}/);
assert.match(
  overview,
  /<section\s+ref=\{stockResultsRef\}\s+aria-label="Inventory items"/,
);
assert.match(
  movements,
  /const \[itemId, setItemId\] = useState\(initialItemId\)/,
);
assert.equal(
  [...audit.matchAll(/onOpenItem\(row\.inventoryItemId\)/g)].length,
  2,
  "mobile and desktop audit items retain their actual inventory ID",
);
assert.match(
  manager,
  /setItemOrigin\("audit"\);\s*setPage\("inventory-item"\)/,
  "audit opens the existing Item Stock route",
);
assert.match(
  manager,
  /setItemOrigin\(params\.get\("origin"\) === "audit" \? "audit" : null\)/,
  "browser history restores audit origin",
);
assert.match(
  manager,
  /setPage\(itemOrigin === "audit" \? "inventory-audit" : "inventory"\)/,
  "Item Stock returns to its actual entry workspace",
);
assert.match(
  itemDetail,
  /onSelect=\{\(\) => onAction\("adjustment", itemId\)\}/,
  "Manage Stock keeps the item ID for Adjustment",
);
assert.match(
  itemDetail,
  /onSelect=\{\(\) => onAction\("waste-spoilage", itemId\)\}/,
  "Manage Stock keeps the item ID for Waste",
);

console.log(
  `H-24 Manager navigation: ${ids.length} unique mounted destinations and audit-to-item continuity assertions passed.`,
);
