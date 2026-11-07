import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile("src/modules/customer/customerFinancialDisplay.ts", "utf8");
const code = (await transform(source, { loader: "ts", format: "esm", target: "es2022" })).code;
const { customerMoneyCents, customerRecordedBreakdown } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const sample = { subtotal: "120.00", delivery_fee: "50.00",
  tax_amount: "0.00", grand_total: "170.00", fulfillment_type: "delivery" };

assert.equal(customerMoneyCents("120.00"), 12000);
assert.equal(customerMoneyCents(0), 0);
for (const invalid of [null, undefined, "", "NaN", "1.234", -1, Infinity]) {
  assert.equal(customerMoneyCents(invalid), null);
}
assert.deepEqual(customerRecordedBreakdown(sample).lines, [
  { label: "Items subtotal", cents: 12000 }, { label: "Delivery fee", cents: 5000 },
]);
assert.equal(customerRecordedBreakdown(sample).totalCents, 17000);
assert.deepEqual(customerRecordedBreakdown({ ...sample, delivery_fee: 0, grand_total: 120 }).lines, [
  { label: "Items subtotal", cents: 12000 }, { label: "Delivery fee", cents: 0 },
]);
assert.deepEqual(customerRecordedBreakdown({ ...sample, fulfillment_type: "pickup", delivery_fee: 0, grand_total: 120 }).lines, [
  { label: "Items subtotal", cents: 12000 },
]);
assert.equal(customerRecordedBreakdown({ ...sample, grand_total: 175 }).lines, null,
  "an unexplained difference must not become a delivery fee");
assert.equal(customerRecordedBreakdown({ ...sample, delivery_fee: null }).lines, null);
assert.equal(customerRecordedBreakdown({ ...sample, tax_amount: null }).lines, null);
assert.equal(customerRecordedBreakdown({ ...sample, grand_total: null }).totalCents, null);
assert.equal(customerRecordedBreakdown({ ...sample, subtotal: "bad" }).lines, null);
assert.equal(customerRecordedBreakdown({ ...sample, tax_amount: 5, grand_total: 175 }).lines?.length, 3);

const checkout = await readFile("src/modules/customer/customerCheckoutPage.tsx", "utf8");
const recordedCharges = await readFile("src/modules/customer/customerRecordedCharges.tsx", "utf8");
const tracking = await readFile("src/modules/customer/customerTrackingPage.tsx", "utf8");
const history = await readFile("src/modules/customer/customerHistoryPage.tsx", "utf8");
const customer = [checkout, recordedCharges, tracking, history].join("\n");
assert.doesNotMatch(customer, /formatCustomerCurrency\(50\)|subtotal\s*\+\s*50/,
  "pre-order Customer UI must not embed a fee value");
assert.match(customer, /customerRecordedBreakdown\(order\)/);
assert.match(customer, /<CustomerRecordedCharges order=\{order\}/);
assert.match(customer, /confirmedCheckoutOrder\.grand_total/);
assert.match(customer, /confirmedSubtotalCents \+ confirmedFeeCents === customerMoneyCents\(confirmedCheckoutOrder\?\.grand_total\)/);
assert.match(customer, /order_items"\)\.select\("order_id,item_name,quantity,unit_price,line_total,modifiers"\)/);

console.log("PASS Customer Batch 3 money parsing, recorded breakdown, unknown fee, historic total, and source guards");
