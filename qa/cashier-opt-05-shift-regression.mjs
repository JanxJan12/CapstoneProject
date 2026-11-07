import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { endShiftSchema } from "./src/modules/cashier/schemas/index.ts";
      export { cashVariance, getVarianceOutcomeFromAmount, formatShiftDuration } from "./src/modules/cashier/shifts/shiftSettlementUtils.ts";
      export { calculateShiftTotals } from "./src/modules/cashier/services/shiftService.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { endShiftSchema, cashVariance, getVarianceOutcomeFromAmount,
  formatShiftDuration, calculateShiftTotals } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const valid = (actualCash) => endShiftSchema.safeParse({ actualCash, varianceReason: "", notes: "" });
for (const amount of [0, 130, 129.99, 130.01, 4000.29]) {
  assert.equal(valid(amount).success, true, `valid count ${amount}`);
}
for (const amount of [undefined, Number.NaN, Infinity, -1, 130.001]) {
  assert.equal(valid(amount).success, false, `invalid count ${amount}`);
}
assert.match(valid(-1).error.issues[0].message, /negative/);
assert.match(valid(130.001).error.issues[0].message, /two decimal/);
assert.equal(cashVariance(130, 130), 0);
assert.equal(cashVariance(129.99, 130), -0.01);
assert.equal(cashVariance(130.01, 130), 0.01);
assert.deepEqual([0, -0.01, 0.01].map(getVarianceOutcomeFromAmount), ["Balanced", "Short", "Over"]);
assert.equal(formatShiftDuration("2026-10-20T00:00:00Z", "2026-10-29T05:00:00Z"), "221h 0m");

const state = {
  shifts: [{ id: "current", openingCash: 4000 }],
  transactions: [
    { shiftId: "current", status: "Completed", method: "Cash", amount: 165, orderId: "a" },
    { shiftId: "current", status: "Completed", method: "GCash", amount: 170, orderId: "b" },
    { shiftId: "current", status: "Voided", method: "Cash", amount: 50, orderId: "c" },
    { shiftId: "other", status: "Completed", method: "Cash", amount: 999, orderId: "d" },
  ],
};
const totals = calculateShiftTotals(state, "current");
assert.equal(totals.expectedCash, 4165);
assert.equal(totals.cashSales, 165);
assert.equal(totals.gcashSales, 170);
assert.equal(totals.voids, 50);
assert.equal(totals.transactionCount, 3);
const refunded = calculateShiftTotals({ ...state, transactions: [
  ...state.transactions, { shiftId: "current", status: "Refunded", method: "Cash", amount: 30, orderId: "e" },
] }, "current");
assert.equal(refunded.cashRefunds, 30);
assert.equal(refunded.expectedCash, 4135); // Existing client definition; backend definition differs.
console.log("PASS: Cashier OPT-05 count, variance, duration, and existing estimate fixtures");
