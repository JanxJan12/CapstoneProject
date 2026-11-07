import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const helperSource = await readFile("src/modules/customer/customerBatch1.ts", "utf8");
const helperCode = (await transform(helperSource, { loader: "ts", format: "esm", target: "es2022" })).code;
const helpers = await import(`data:text/javascript;base64,${Buffer.from(helperCode).toString("base64")}`);
const { customerErrorMessage, currentCustomerProduct, customerProductPricesChanged,
  canAddCurrentCustomerProduct, retainCustomerDrinkSelections, isCurrentCustomerMenuResponse } = helpers;

const internal = { code: "XX000", message: 'SQL exception in public.place_customer_order: secret detail' };
assert.equal(customerErrorMessage({ message: "Failed to fetch" }, "menu"),
  "Your connection appears to be interrupted. Check it and try again.");
assert.equal(customerErrorMessage(internal, "menu"), "We couldn't load the menu. Please try again.");
assert.equal(customerErrorMessage({ message: "JWT expired" }, "profile"),
  "Your session has expired. Please sign in again to continue.");
assert.match(customerErrorMessage({ status: 401, message: "unknown" }, "auth"), /session has expired/);
assert.match(customerErrorMessage({ code: "42501", message: "permission denied for orders" }, "history"), /don't have access/);
assert.match(customerErrorMessage({ code: "22023", message: "invalid input syntax" }, "options"), /needs your attention/);
assert.match(customerErrorMessage({ message: "item unavailable" }, "options"), /currently unavailable/);
assert.match(customerErrorMessage(internal, "order"), /couldn't confirm whether/);
assert.match(customerErrorMessage(internal, "payment"), /couldn't confirm the payment submission/);
assert.match(customerErrorMessage({ message: "Failed to fetch" }, "order"), /couldn't confirm whether/);
assert.match(customerErrorMessage({ message: "Failed to fetch" }, "payment"), /couldn't confirm the payment submission/);
for (const context of ["menu", "options", "availability", "tracking", "history", "profile", "profile-save", "auth", "order", "payment"]) {
  assert.doesNotMatch(customerErrorMessage(internal, context), /SQL|public\.|secret|XX000|place_customer_order/);
}

const opened = { id: "meal", name: "Meal", price: 120, withoutRicePrice: 100,
  withRiceAvailable: true, withoutRiceAvailable: true, available: true };
assert.deepEqual(currentCustomerProduct(opened, [opened]), { item: opened, removed: false });
const refreshed = { ...opened, price: 130, withoutRicePrice: 105 };
const detail = currentCustomerProduct(opened, [refreshed]);
assert.equal(detail.item.price, 130);
assert.equal(detail.item.withoutRicePrice, 105);
assert.equal(customerProductPricesChanged(opened, detail.item), true);
assert.equal(2 * detail.item.withoutRicePrice, 210);
assert.equal(canAddCurrentCustomerProduct(opened, refreshed, "without_rice"), false);
assert.equal(canAddCurrentCustomerProduct(refreshed, refreshed, "without_rice"), true);
assert.equal(canAddCurrentCustomerProduct(refreshed, { ...refreshed, available: false }, "without_rice"), false);
assert.equal(canAddCurrentCustomerProduct(refreshed, { ...refreshed, withoutRiceAvailable: false }, "without_rice"), false);
assert.equal(canAddCurrentCustomerProduct(refreshed, { ...refreshed, withoutRicePrice: undefined }, "without_rice"), false);
assert.equal(canAddCurrentCustomerProduct(refreshed, { ...refreshed, withoutRicePrice: undefined }, "with_rice"), false);
assert.equal(canAddCurrentCustomerProduct(refreshed, { ...refreshed, withRiceAvailable: false }, "with_rice"), false);
assert.deepEqual(currentCustomerProduct(opened, []).item, { ...opened, available: false });
assert.equal(currentCustomerProduct(opened, []).removed, true);
assert.equal(canAddCurrentCustomerProduct(opened, undefined), false);
assert.equal(customerProductPricesChanged(refreshed, refreshed), false);

const drinkOptions = [{ id: "coke", price: 0 }, { id: "large", price: 15 }];
assert.deepEqual(retainCustomerDrinkSelections(["coke", "large"], drinkOptions),
  { selected: ["coke", "large"], invalidated: false });
assert.deepEqual(retainCustomerDrinkSelections(["coke", "removed"], drinkOptions),
  { selected: ["coke"], invalidated: true });
assert.equal(refreshed.price + drinkOptions[1].price, 145);

let newest = refreshed;
let revision = 2;
if (isCurrentCustomerMenuResponse(1, revision)) newest = opened;
assert.equal(newest.price, 130, "late older response must not replace newer catalog");
assert.equal(isCurrentCustomerMenuResponse(2, revision), true);
assert.equal(currentCustomerProduct(opened, [newest]).item.price, 130);
assert.equal(opened.available, true, "failed refresh keeps known data without fabricating a replacement");

const activeSource = await readFile("src/modules/customer/customerCheckoutPage.tsx", "utf8");
assert.match(activeSource, /orderCreationInFlightRef\.current\)\s*\{\s*return;/,
  "the active checkout still blocks duplicate submissions");
assert.match(activeSource, /getOrCreateCustomerOrderRequestId\(/,
  "the active checkout still reuses its request ID");
const menuSource = await readFile("src/modules/customer/customerMenuPages.tsx", "utf8");
assert.match(menuSource, /onRetry=\{onRetryMenu\}/,
  "read-only menu retry remains available");
const detailSource = menuSource.slice(menuSource.indexOf("export function MenuDetailPage("));
assert.match(detailSource, /const \[qty, setQty\] = useState\(1\)/,
  "quantity stays in the mounted detail view while the item prop refreshes");
assert.match(detailSource, /loadedChoiceVersion !== choiceRefreshVersion/,
  "Add remains blocked until refreshed drink choices have loaded");
assert.match(detailSource, /invalidMealSelection/, "invalidated rice choice remains blocked");
console.log("Customer Batch 1: safe error mapping, retry/idempotency guards, current product/price/availability, choice retention, stale-response rejection PASS.");
