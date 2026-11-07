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
const source = result.outputFiles[0].text;
const { addCartItem } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const meal = {
  id: "synthetic-meal",
  code: "SYN",
  name: "Synthetic Meal",
  category: "Test",
  description: "",
  price: 200,
  withoutRicePrice: 170,
  available: true,
};
const withRice = addCartItem([], meal, 1, "", [], "with_rice");
const both = addCartItem(withRice.cart, meal, 1, "", [], "without_rice");
assert.equal(both.cart.length, 2);
assert.deepEqual(both.cart.map((line) => line.unitPrice), [200, 170]);
assert.deepEqual(both.cart.map((line) => line.mealOption), ["with_rice", "without_rice"]);
const merged = addCartItem(both.cart, meal, 2, "", [], "without_rice");
assert.equal(merged.cart.length, 2);
assert.deepEqual(merged.cart.map((line) => line.quantity), [1, 3]);
const ordinary = { ...meal, id: "synthetic-rice", price: 35, withoutRicePrice: undefined };
const separate = addCartItem(merged.cart, ordinary, 1);
assert.equal(separate.cart.length, 3);
assert.equal(separate.cart[2].unitPrice, 35);
console.log("Fixed meal POS cart: separate choices, same-choice merge, and independent rice PASS.");
