import assert from "node:assert/strict";
import { build } from "esbuild";

// Isolated, synthetic records. No database or financial RPC is invoked.
const bundle = await build({
  stdin: { contents: `export { calculateShiftTotals } from "./src/modules/cashier/services/shiftService.ts";`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { calculateShiftTotals } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);
const cents = (value) => {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error(`Not a peso amount: ${value}`);
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
};
const peso = (value) => Number(cents(value)) / 100;
const receipt = (id, amount, method = "Cash", status = "Completed", paymentStatus = "Verified", shiftId = "S1") =>
  ({ id, orderId: id, shiftId, method, status, paymentStatus, amount: peso(amount) });
const cash = (id, amount) => receipt(id, amount);
const gcash = (id, amount) => receipt(id, amount, "GCash");
const voidCash = (id, amount) => receipt(id, amount, "Cash", "Voided", "Voided");
const voidGcash = (id, amount) => receipt(id, amount, "GCash", "Voided", "Voided");
const base = cash("A", "130.00");
const cases = [
  ["01 opening only", [], "4000.00", "4000.00", "supported"],
  ["02 completed cash", [base], "4130.00", "4130.00", "supported"],
  ["03 multiple cash", [base, cash("B", "70.25")], "4200.25", "4200.25", "supported"],
  ["04 verified GCash", [gcash("A", "170.00")], "4000.00", "4000.00", "supported"],
  ["05 cash and GCash", [base, gcash("B", "170.00")], "4130.00", "4130.00", "supported"],
  ["06 approved unexecuted refund", [base], "4130.00", "4130.00", "unsupported approval state"],
  ["07 Manager-attested full cash refund", [voidCash("A", "130.00")], "4000.00", "4000.00", "supported void state"],
  ["08 Manager-attested GCash refund", [voidGcash("A", "170.00")], "4000.00", "4000.00", "supported void state"],
  ["09 partial refund", [base], "4130.00", "4130.00", "unsupported partial operation"],
  ["10 unpaid cancellation", [], "4000.00", "4000.00", "supported no receipt"],
  ["11 paid cash cancellation", [voidCash("A", "130.00")], "4000.00", "4000.00", "supported void state"],
  ["12 paid unfulfilled order", [base], "4130.00", "4130.00", "supported receipt state"],
  ["13 cash payout from different drawer", [voidCash("A", "130.00")], "4000.00", "4000.00", "physical drawer source unrecorded"],
  ["14 cash refund after original shift closed", [base], "4130.00", "4130.00", "RPC rejects refund"],
  ["15 exact refund retry", [voidCash("A", "130.00")], "4000.00", "4000.00", "same settlement replay"],
  ["16 missing or other shift link", [receipt("A", "130.00", "Cash", "Completed", "Verified", "S2")], "4000.00", "4000.00", "other shift excluded; null FK unsupported"],
  ["17 rejected or reversed payment", [voidGcash("A", "170.00")], "4000.00", "4000.00", "no completed verified receipt"],
  ["18 exact count", [base], "4130.00", "4130.00", "count 4130.00; variance 0.00"],
  ["19 shortage", [base], "4130.00", "4130.00", "count 4129.75; variance -0.25"],
  ["20 overage", [base], "4130.00", "4130.00", "count 4130.25; variance +0.25"],
  ["21 legacy Refunded state", [receipt("A", "130.00", "Cash", "Refunded")], "3870.00", "4000.00", "unsupported by hosted transaction enum"],
  ["22 completed but unverified", [receipt("A", "130.00", "Cash", "Completed", "Pending")], "4130.00", "4000.00", "inconsistent source state"],
  ["23 GCash refund after original closure", [base, voidGcash("B", "170.00")], "4130.00", "4130.00", "allowed; original saved snapshot remains separate"],
];
const outcomes = [];
for (const [name, rows, browser, backend, support] of cases) {
  const projected = calculateShiftTotals({ shifts: [{ id: "S1", openingCash: 4000 }], transactions: rows }, "S1");
  assert.equal(BigInt(Math.round(projected.expectedCash * 100)), cents(browser), `${name} browser`);
  const backendCents = 400000n + rows.reduce((total, row) =>
    total + (row.shiftId === "S1" && row.status === "Completed" && row.paymentStatus === "Verified" && row.method === "Cash"
      ? BigInt(Math.round(row.amount * 100)) : 0n), 0n);
  assert.equal(backendCents, cents(backend), `${name} RPC predicate model`);
  outcomes.push({ name, browser, backend, support });
}
assert.equal(cents("4130.00") - cents("4130.00"), 0n);
assert.equal(cents("4129.75") - cents("4130.00"), -25n);
assert.equal(cents("4130.25") - cents("4130.00"), 25n);
console.log(JSON.stringify({ result: "PASS", scenarioCount: outcomes.length, outcomes }, null, 2));
