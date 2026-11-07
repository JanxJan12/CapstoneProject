import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  attentionItems,
  stockAlerts,
} from "../src/modules/manager/inventory/inventoryOverview.ts";
import { validRequestProposal } from "../src/modules/manager/inventory/requestProposal.ts";

const stock = (id, changes = {}) => ({
  id,
  itemName: id,
  unit: "pcs",
  isActive: true,
  physicalQuantity: 10,
  usableQuantity: 10,
  reorderLevel: 3,
  expiredQuantity: 0,
  ...changes,
});

assert.deepEqual(stockAlerts(stock("normal")), []);
assert.deepEqual(
  stockAlerts(stock("out", { physicalQuantity: 5, usableQuantity: 0 })),
  ["usable-out"],
);
assert.deepEqual(stockAlerts(stock("low", { usableQuantity: 3 })), [
  "low-usable",
]);
assert.deepEqual(
  stockAlerts(stock("expired", { expiredQuantity: 2, isActive: false })),
  ["expired-on-hand"],
);
assert.deepEqual(
  stockAlerts(stock("both", { usableQuantity: 0, expiredQuantity: 5 })),
  ["usable-out", "expired-on-hand"],
);
assert.deepEqual(
  attentionItems([
    stock("expired", { expiredQuantity: 1 }),
    stock("low", { usableQuantity: 2 }),
    stock("out", { usableQuantity: 0 }),
  ]).map(({ stock: row }) => row.id),
  ["out", "low", "expired"],
);
assert.deepEqual(
  attentionItems([
    stock("out-and-expired", { usableQuantity: 0, expiredQuantity: 2 }),
    stock("low", { usableQuantity: 2 }),
  ]).map(({ stock: row }) => row.id),
  ["out-and-expired", "low"],
  "attention counts unique items even when expired and out overlap",
);

const proposal = {
  id: "item-1",
  name: "Synthetic item",
  unit: "pcs",
  quantity_scale: 0,
  reorder_level: 3,
  usable_now: 1,
  valid_at_need: 1,
  outstanding: 2,
  expiry_verified: true,
};
assert.equal(validRequestProposal([proposal]), true);
assert.equal(
  validRequestProposal([{ ...proposal, outstanding: Number.NaN }]),
  false,
);
assert.equal(validRequestProposal([proposal, proposal]), false);
assert.equal(validRequestProposal(null), false);

const overview = readFileSync(
  new URL(
    "../src/modules/manager/inventory/InventoryPage.tsx",
    import.meta.url,
  ),
  "utf8",
);
assert.match(
  overview,
  /onPrepareRequest=\{\(\) => prepareItem\(stock\.id\)\}/,
  "mobile stock cards use the same guarded request action as the table",
);
assert.match(
  overview,
  /stockSearch[\s\S]*stockCategory[\s\S]*stockFilter[\s\S]*history\.replaceState/,
  "Stock Overview retains search and filters when opening item details",
);
const desktopTable = overview.split('<table className="manager-stock-table')[1];
const tableHead = desktopTable.split("</thead>")[0];
const tableBody = desktopTable.split("<tbody>")[1].split("</tbody>")[0];
assert.equal(
  (tableHead.match(/<th scope="col">/g) ?? []).length,
  7,
  "desktop quantities retain their units without a duplicate Unit column",
);
assert.equal(
  (
    tableBody.match(
      /formatInventoryQuantity\(\s*stock\.(?:physicalQuantity|usableQuantity|reorderLevel),\s*stock\.unit,?\s*\)/g,
    ) ?? []
  ).length,
  3,
  "physical, usable and minimum table quantities each show their unit",
);
assert.ok(
  tableBody.indexOf("<ExistingRequestLinks") <
    tableBody.indexOf('<td className="text-right">'),
  "actual formal Request links sit with outstanding guidance",
);
assert.match(
  tableBody,
  /min-h-11[\s\S]*?onClick=\{\(\) => openItem\(stock\.id\)\}[\s\S]*?View details/,
  "compact item actions retain a keyboard and touch target",
);
assert.ok(
  !overview.includes("inventory-attention-heading") &&
    !overview.includes("Stock health") &&
    !overview.includes("Incoming requests") &&
    !overview.includes("outstandingRows"),
  "duplicate attention item previews are removed",
);
assert.ok(
  overview.includes("aria-pressed={filter === view}") &&
    overview.includes("onClick={() => showStockView(view)}"),
  "each attention counter remains a keyboard-accessible stock filter",
);
assert.ok(
  overview.includes("receivingRead.rows.length > 0") &&
    overview.includes("openReceivingReport(receivingRead.rows[0].id)") &&
    overview.includes('receivingRead.status === "error"'),
  "unfinished Receiving remains discoverable without a permanent empty panel",
);
assert.equal(
  (overview.match(/<ExistingRequestLinks/g) ?? []).length,
  2,
  "real formal Request links remain in mobile cards and the desktop table",
);

console.log(
  "H-22 overview classification and navigation: 21 offline assertions passed.",
);
