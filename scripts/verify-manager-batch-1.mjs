import assert from "node:assert/strict";
import { countLowUsableStock } from "../src/modules/manager/dashboard/usableStockAttention.ts";

const row = (id, changes = {}) => ({
  id, itemName: id, unit: "pcs", isActive: true,
  physicalQuantity: 20, usableQuantity: 20, expiredQuantity: 0,
  reorderLevel: 5, ...changes,
});
const cases = [
  ["both sufficient", [row("a")], 0],
  ["physical sufficient, usable low", [row("a", { usableQuantity: 4 })], 1],
  ["positive physical, zero usable", [row("a", { usableQuantity: 0 })], 1],
  ["both below threshold", [row("a", { physicalQuantity: 4, usableQuantity: 2 })], 1],
  ["physical low and usable low", [row("a", { physicalQuantity: 3, usableQuantity: 3 })], 1],
  ["exact threshold", [row("a", { usableQuantity: 5 })], 1],
  ["zero threshold and zero usable", [row("a", { usableQuantity: 0, reorderLevel: 0 })], 1],
  ["zero threshold with positive usable", [row("a", { usableQuantity: 0.1, reorderLevel: 0 })], 0],
  ["decimal quantity", [row("a", { usableQuantity: 4.75, reorderLevel: 4.75, unit: "kg" })], 1],
  ["mixed units and inactive item", [row("a", { usableQuantity: 4 }), row("b", { usableQuantity: 0, unit: "kg" }), row("c", { usableQuantity: 0, isActive: false })], 2],
  ["empty summary", [], 0],
];
for (const [name, rows, expected] of cases) {
  assert.equal(countLowUsableStock(rows), expected, name);
  console.log(`PASS ${name}`);
}
for (const [name, rows] of [
  ["missing threshold", [row("a", { reorderLevel: null })]],
  ["missing usable quantity", [row("a", { usableQuantity: undefined })]],
  ["malformed record", [null]],
  ["negative quantity", [row("a", { usableQuantity: -1 })]],
  ["non-finite quantity", [row("a", { physicalQuantity: NaN })]],
  ["invalid response", null],
]) {
  assert.throws(() => countLowUsableStock(rows), /Invalid stock summary/, name);
  console.log(`PASS ${name} rejected`);
}
