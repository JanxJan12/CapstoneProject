import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { startShiftSchema, endShiftSchema } from "./src/modules/cashier/schemas/index.ts";
      export { cashVariance, getVarianceOutcomeFromAmount } from "./src/modules/cashier/shifts/shiftSettlementUtils.ts";
      export { inspectShiftClosureOutcome } from "./src/modules/cashier/shifts/shiftClosureRecovery.ts";
      export { calculateShiftTotals } from "./src/modules/cashier/services/shiftService.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { startShiftSchema, endShiftSchema, cashVariance, getVarianceOutcomeFromAmount,
  inspectShiftClosureOutcome, calculateShiftTotals } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const opening = (value) => startShiftSchema.safeParse({ openingCash: value, terminal: "Front" });
for (const amount of ["0", "0.01", "130", "4000.29", "100000", " 200.50 "]) {
  assert.equal(opening(amount).success, true, `opening ${amount}`);
}
assert.equal(opening(" 200.50 ").data.openingCash, 200.5);
for (const amount of ["", "   ", "abc", "-0.01", "0.001", "0.0000000001", "100000.01"]) {
  assert.equal(opening(amount).success, false, `invalid opening ${amount}`);
}
assert.match(opening("").error.issues[0].message, /physical opening cash/);
assert.match(opening("0.001").error.issues[0].message, /two decimal/);

const count = (value) => endShiftSchema.safeParse({ actualCash: value, varianceReason: "", notes: "" });
assert.equal(count(0).success, true);
assert.equal(count(undefined).success, false);
assert.equal(count(130.001).success, false);
assert.equal(cashVariance(130, 130), 0);
assert.equal(cashVariance(129.99, 130), -0.01);
assert.equal(cashVariance(130.01, 130), 0.01);
assert.deepEqual([0, -0.01, 0.01].map(getVarianceOutcomeFromAmount), ["Balanced", "Short", "Over"]);

const state = { shifts: [{ id: "own", openingCash: 100 }], transactions: [
  { shiftId: "own", status: "Completed", method: "Cash", amount: 30, orderId: "a" },
  { shiftId: "own", status: "Completed", method: "GCash", amount: 50, orderId: "b" },
  { shiftId: "own", status: "Voided", method: "Cash", amount: 60, orderId: "c" },
  { shiftId: "other", status: "Completed", method: "Cash", amount: 999, orderId: "d" },
] };
const totals = calculateShiftTotals(state, "own");
assert.equal(totals.expectedCash, 130);
assert.equal(totals.cashSales, 30);
assert.equal(totals.gcashSales, 50);

let closedReads = 0;
assert.equal(await inspectShiftClosureOutcome("own", async () => ({ id: "own" }), async () => { closedReads++; return { rows: [] }; }), "still-open");
assert.equal(closedReads, 0);
assert.equal(await inspectShiftClosureOutcome("own", async () => null, async () => ({ rows: [{ id: "own" }] })), "saved-closed");
assert.equal(await inspectShiftClosureOutcome("own", async () => ({ id: "new" }), async () => ({ rows: [] })), "unknown");
await assert.rejects(inspectShiftClosureOutcome("own", async () => { throw new Error("offline"); }, async () => ({ rows: [] })), /offline/);

console.log("PASS: SS-02B opening/count precision, exact-shift estimate, variance, and read-only closure recovery fixtures");
