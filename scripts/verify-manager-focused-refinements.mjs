import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { eligibleMealProducts } from "../src/modules/manager/menu/mealEligibility.ts";
import { formatRequestQuantity, suggestedRequestQuantity } from "../src/modules/manager/inventory/requestQuantity.ts";

const proposal = (name, unit, quantity_scale, reorder_level, valid_at_need, outstanding) =>
  ({ id: name, name, unit, quantity_scale, reorder_level, valid_at_need, outstanding });

for (const [item, expected] of [
  [proposal("Soy Sauce", "L", 3, 0.1, 0.04, 0), 0.06],
  [proposal("Vinegar", "L", 3, 0.1, 0.06, 0), 0.04],
  [proposal("Small fraction", "kg", 3, 0.005, 0.001, 0.001), 0.003],
  [proposal("Piece", "pcs", 0, 10, 2, 3), 5],
  [proposal("Bottle", "bottles", 0, 2, 3, 0), 0],
  [proposal("Pack", "packs", 0, 8, 1, 2), 5],
]) {
  const quantity = suggestedRequestQuantity(item);
  assert.equal(quantity, expected, item.name);
  assert.equal(JSON.stringify({ quantity }), `{"quantity":${expected}}`, item.name);
  assert.equal(formatRequestQuantity(quantity, item.quantity_scale), String(expected), item.name);
}
assert.equal(formatRequestQuantity(0.039999999999999925), "0.04");
assert.equal(formatRequestQuantity(0.0399, 3), "0.0399", "invalid manual precision remains visible");
assert.equal(formatRequestQuantity(2.5, 0), "2.5", "invalid integer-unit quantity remains visible");
assert.equal(formatRequestQuantity(0.125, 3), "0.125");
assert.equal(suggestedRequestQuantity(proposal("Unexpected precision", "kg", 3, 0.0005, 0, 0)), 0.0005);

const item = (id, name, categoryName, isActive = true) =>
  ({ id, name, categoryName, isActive });
const choices = [{ menuItemId: "buko" }, { menuItemId: "softdrinks" }];
const products = [
  item("buko", "Buko Juice", "Drinks"),
  item("softdrinks", "Softdrinks", "Drinks"),
  item("rice", "White Rice", "Rice"),
  item("dessert", "Dessert", "Desserts"),
  item("biryani", "Chicken Biryani", "Viands"),
  item("meal", "Viand meal", "Viands"),
  item("inactive", "Inactive viand", "Viands", false),
  item("misclassified", "Drink choice product", "Viands"),
];
assert.deepEqual(eligibleMealProducts(products, [...choices, { menuItemId: "misclassified" }]).map((row) => row.id), ["biryani", "meal"]);
assert.deepEqual(eligibleMealProducts(products.filter((row) => row.id === "buko"), choices), []);

const requestPage = readFileSync(new URL("../src/modules/manager/inventory/ManagerRequestsPage.tsx", import.meta.url), "utf8");
const document = readFileSync(new URL("../src/modules/manager/inventory/requestDocument.ts", import.meta.url), "utf8");
const menuPage = readFileSync(new URL("../src/modules/manager/menu/MenuManagementPage.tsx", import.meta.url), "utf8");
assert.match(requestPage, /const suggested = suggestedRequestQuantity/);
assert.ok((requestPage.match(/quantity: 0, override_reason: ""/g) ?? []).length >= 2,
  "suggested and manually added rows must start with an explicit zero quantity");
assert.match(requestPage, /requestLines = draft\.filter\(\(line\) => line\.quantity > 0\)/,
  "only positive requested quantities may enter the issued lines");
assert.match(requestPage, /quantity: line\.quantity/);
assert.match(requestPage, /formatRequestQuantity\(line\.quantity\)/);
assert.match(document, /formatRequestQuantity\(line\.quantity\)/);
const compiledDocument = stripTypeScriptTypes(document
  .replace('import { formatRequestQuantity } from "./requestQuantity";', "")
  .replaceAll("export function ", "function "), { mode: "strip" });
const requestPrintHtml = new Function("formatRequestQuantity", `${compiledDocument}\nreturn requestPrintHtml;`)(formatRequestQuantity);
const html = requestPrintHtml({
  identifier: "synthetic", revision: 1, status: "Draft", priority: "scheduled",
  neededAt: "synthetic time", draft: true,
  lines: [{ id: "soy", name: "Soy Sauce", quantity: 0.039999999999999925, unit: "L" }],
});
assert.match(html, /class="quantity">0\.04<\/td>/);
assert.doesNotMatch(html, /0\.039999999999999925/);
assert.match(menuPage, /Select an eligible meal/);
assert.doesNotMatch(menuPage, /items\[0\].*openMealConfig/);
assert.match(menuPage, /eligibleMeals\.some\(\(item\) => item\.id === editingMealId\)/);
console.log("PASS: quantity scale, artifacts, serialization shape, document wiring, and meal selector eligibility");
