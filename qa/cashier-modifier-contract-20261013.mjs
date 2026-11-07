import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile("src/modules/cashier/constants/modifiers.ts", "utf8");
const compiled = (await transform(source, { loader: "ts", format: "esm", target: "es2022" })).code;
const { modifierGroupsFor, defaultModifiersFor, validateMenuModifiers } =
  await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

const item = {
  name: "Synthetic catalog item",
  modifierGroups: [
    { id: "size", name: "Size", selection: "single", required: true,
      minSelections: 1, maxSelections: 1,
      options: [{ id: "small", name: "Small", price: 0 }, { id: "large", name: "Large", price: 15 }] },
    { id: "extras", name: "Extras", selection: "multiple", required: false,
      minSelections: 0, maxSelections: 2,
      options: [{ id: "rice", name: "Rice", price: 35 }, { id: "sauce", name: "Sauce", price: 15 }, { id: "egg", name: "Egg", price: 20 }] },
  ],
};
assert.equal(modifierGroupsFor(item).length, 2);
assert.deepEqual(defaultModifiersFor(item).map(option => option.id), ["small"]);
assert.deepEqual(validateMenuModifiers(item, [{ id: "large", name: "Stale name", price: 0 }]),
  [{ id: "large", name: "Large", price: 15 }]);
assert.throws(() => validateMenuModifiers(item, []), /size/);
assert.throws(() => validateMenuModifiers(item, [item.modifierGroups[0].options[0], item.modifierGroups[0].options[1]]), /size/);
assert.throws(() => validateMenuModifiers(item, [item.modifierGroups[0].options[0], ...item.modifierGroups[1].options]), /extras/);
assert.throws(() => validateMenuModifiers(item, [item.modifierGroups[0].options[0], item.modifierGroups[0].options[0]]), /Duplicate/);
assert.throws(() => validateMenuModifiers(item, [{ id: "invented", name: "Invented", price: 0 }]), /not available/);
console.log("PASS: catalog backed Cashier modifiers, canonical pricing, required/single/multiple/max/duplicate/unknown cases (8 checks)");
