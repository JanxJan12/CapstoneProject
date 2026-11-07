import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile("src/modules/customer/customerCatalog.ts", "utf8");
const lineKey = source.slice(source.indexOf("export function customerLineKey("), source.indexOf("export function customerUnitPrice("));
const reconcile = source.slice(source.indexOf("export function reconcileCustomerCart("), source.indexOf("export async function fetchCustomerEffectiveAvailability("));
const compiled = (await transform(`${lineKey}\n${reconcile}`,
  { loader: "ts", format: "esm", target: "es2022" })).code;
const { reconcileCustomerCart } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const base = { id: "food", name: "Adobong Manok", price: 120, qty: 1, modifierIds: [],
  modifiers: [], lineKey: "food:standard:" };
const rows = [
  { menu_item_id: "drink", choice_kind: "flavor", option_id: "coke", option_name: "Coke", price_adjustment: 0 },
  { menu_item_id: "drink", choice_kind: "flavor", option_id: "sprite", option_name: "Sprite", price_adjustment: 0 },
  { menu_item_id: "drink", choice_kind: "size", option_id: "regular", option_name: "Regular", price_adjustment: 0 },
  { menu_item_id: "drink", choice_kind: "size", option_id: "large", option_name: "Large", price_adjustment: 15 },
];
const fixed = new Map([["meal", { standard: 200, withoutRice: 170,
  withRiceAvailable: true, withoutRiceAvailable: true }]]);
assert.equal(reconcileCustomerCart([base], rows, fixed).error, null);
assert.match(reconcileCustomerCart([{ ...base, modifierIds: ["extra-rice"] }], rows, fixed).error, /changed/);
const drink = { ...base, id: "drink", name: "Softdrinks", price: 30,
  modifierIds: ["coke", "large"], modifiers: [{ id: "coke", name: "Stale", price: 999 }] };
const valid = reconcileCustomerCart([drink], rows, fixed);
assert.equal(valid.error, null);
assert.deepEqual(valid.cart[0].modifiers.map((choice) => [choice.name, choice.price]), [["Coke", 0], ["Large", 15]]);
assert.match(reconcileCustomerCart([{ ...drink, modifierIds: ["coke"] }], rows, fixed).error, /changed/);
assert.match(reconcileCustomerCart([{ ...drink, modifierIds: ["coke", "invented"] }], rows, fixed).error, /changed/);
const meal = { ...base, id: "meal", name: "Fixed Meal", mealOption: "without_rice" };
const mealResult = reconcileCustomerCart([meal], rows, fixed);
assert.equal(mealResult.error, null);
assert.equal(mealResult.cart[0].withoutRicePrice, 170);
console.log("Customer cart: ordinary food, retired food choice rejection, required drink, authoritative drink refresh, fixed meal PASS.");
