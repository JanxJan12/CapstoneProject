import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { addCartItem, calculatePOSTotals, getPlaceOrderAvailability, setCartLineQuantity } from "./src/modules/cashier/pos/posOperations.ts";
      export { DEFAULT_POS_FORM, loadPOSDraft } from "./src/modules/cashier/pos/posPersistence.ts";
      export { posSchema } from "./src/modules/cashier/schemas/index.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { addCartItem, calculatePOSTotals, getPlaceOrderAvailability, setCartLineQuantity, DEFAULT_POS_FORM, loadPOSDraft, posSchema } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const item = { id: "synthetic-meal", name: "Synthetic meal", price: 130, available: true };
const cart = addCartItem([], item).cart;
assert.equal(cart.length, 1);
assert.equal(setCartLineQuantity(cart, cart[0].lineId, 2)[0].quantity, 2);

for (const [tendered, expectedChange, allowed] of [
  [130, 0, true], [200, 70, true], [500, 370, true], [129, 0, false],
]) {
  const form = { ...DEFAULT_POS_FORM, amountTendered: tendered };
  const totals = calculatePOSTotals(cart, form);
  const availability = getPlaceOrderAvailability(cart, form, [item], totals.total, totals.tendered);
  assert.equal(totals.total, 130);
  assert.equal(posSchema.safeParse(form).success, true);
  assert.equal(Math.max(0, totals.tendered - totals.total), expectedChange);
  assert.equal(availability.canPlace, allowed, `Tender ${tendered}`);
  if (!allowed) assert.match(availability.disabledReason, /enough cash/i);
}

for (const field of [
  { paymentMethod: "GCash", gcashReference: "legacy-reference", gcashConfirmed: true },
]) {
  const form = { ...DEFAULT_POS_FORM, amountTendered: 500, ...field };
  const totals = calculatePOSTotals(cart, form);
  assert.equal(getPlaceOrderAvailability(cart, form, [item], totals.total, totals.tendered).canPlace, false);
  assert.equal(posSchema.safeParse(form).success, false);
}

globalThis.localStorage = {
  getItem: () => JSON.stringify({
    cart,
    form: { ...DEFAULT_POS_FORM, paymentMethod: "GCash", gcashReference: "old", gcashConfirmed: true },
  }),
};
const restored = loadPOSDraft();
assert.equal(restored.form.paymentMethod, "Cash");
assert.equal(restored.form.gcashReference, "");
console.log("Cashier OPT-02 POS cash and legacy-draft regression: PASS");
