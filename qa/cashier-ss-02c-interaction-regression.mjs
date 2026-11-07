import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const dialog = readFileSync("src/modules/cashier/shifts/EndShiftDialog.tsx", "utf8");
const page = readFileSync("src/modules/cashier/shifts/ShiftSettlementPage.tsx", "utf8");

// Source-boundary checks: these protect the two-stage handoff without submitting a live shift.
const review = dialog.slice(dialog.indexOf("const submit ="), dialog.indexOf("const confirmClosure ="));
const closure = dialog.slice(dialog.indexOf("const confirmClosure ="), dialog.indexOf("  return ("));
assert.match(review, /setReviewValues\(values\)/);
assert.match(review, /setReviewSnapshot\(\{ shiftId, expectedCash: totals\.expectedCash \}\)/);
assert.doesNotMatch(review, /onConfirm\s*\(/, "review must remain non-mutating");
assert.match(closure, /submittingRef\.current = true/);
assert.match(closure, /await onConfirm\(\{/);
assert.match(closure, /reviewSnapshot\.shiftId !== shiftId/);
assert.match(closure, /reviewSnapshot\.expectedCash !== totals\.expectedCash/);
assert.match(closure, /inspectShiftClosureOutcome\(/);
assert.match(dialog, /Review settlement/);
assert.match(dialog, /Confirm and close shift/);
assert.match(dialog, /Back to cash count/);
assert.match(dialog, /const resetForm = \(\) => \{\s*setReviewValues\(undefined\);\s*setReviewSnapshot\(undefined\);/);
assert.match(dialog, /onOpenChange=\{\(value\) => \{\s*if \(busy\) return;\s*onOpenChange\(value\);\s*if \(!value\) \{\s*resetForm\(\);/);
assert.match(review, /if \(pendingPaymentCount > 0 \|\| recheckRequired\) return/);
assert.match(closure, /if \(pendingPaymentCount > 0 \|\| reviewSnapshot\.shiftId !== shiftId/);
assert.match(dialog, /role="status">Variance pending count/);
assert.doesNotMatch(dialog, /Cashier notes/);
assert.match(dialog, /<details className="mt-2 border-t/);
assert.match(dialog, /This count is from the Cashier review queue/);
assert.match(dialog, /server separately checks pending online GCash payments across the restaurant/);
assert.doesNotMatch(page, /Ready to close/);

const bundle = await build({
  stdin: {
    contents: `export { endShiftSchema } from "./src/modules/cashier/schemas/index.ts";
      export { cashVariance, getVarianceOutcomeFromAmount } from "./src/modules/cashier/shifts/shiftSettlementUtils.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { endShiftSchema, cashVariance, getVarianceOutcomeFromAmount } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);
const parse = (actualCash) => endShiftSchema.safeParse({ actualCash });
assert.equal(parse(undefined).success, false);
assert.equal(parse(130).success, true);
assert.deepEqual(parse(130).data, { actualCash: 130 });
assert.equal(parse(129.99).success, true);
assert.equal(parse(130.01).success, true);
assert.equal(parse(130.001).success, false);
assert.deepEqual([130, 129.99, 130.01].map((count) =>
  getVarianceOutcomeFromAmount(cashVariance(count, 130))), ["Balanced", "Short", "Over"]);

console.log("PASS: SS-02C source boundaries, review/close labels, server guard, and count/variance fixtures");
