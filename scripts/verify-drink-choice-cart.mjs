import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  entryPoints: ["src/modules/cashier/pos/posOperations.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const { addCartItem } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const softdrink = { id: "softdrink", code: "D1", name: "Softdrinks", category: "Beverages",
  description: "", price: 30, available: true };
const rice = { id: "rice", code: "R1", name: "White Rice", category: "Rice",
  description: "", price: 35, available: true };
const cokeLarge = [{ id: "drink-coke", name: "Coke", price: 0 },
  { id: "drink-large", name: "Large", price: 15 }];
const spriteRegular = [{ id: "drink-sprite", name: "Sprite", price: 0 },
  { id: "drink-regular", name: "Regular", price: 0 }];
let lines = addCartItem([], softdrink, 1, "", cokeLarge).cart;
lines = addCartItem(lines, softdrink, 2, "", spriteRegular).cart;
lines = addCartItem(lines, softdrink, 1, "", cokeLarge).cart;
lines = addCartItem(lines, rice, 1).cart;
assert.equal(lines.length, 3);
assert.deepEqual(lines.map((line) => [line.quantity, line.unitPrice]), [[2, 45], [2, 30], [1, 35]]);
assert.equal(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), 185);
assert.deepEqual(lines[2].modifiers, undefined);
console.log("Drink choice POS cart: distinct variants, same-choice merge, authoritative preview, independent rice PASS.");
