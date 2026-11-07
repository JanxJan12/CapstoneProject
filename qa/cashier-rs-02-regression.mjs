import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { recordedBasketLine, recordedBasketChoices, basketSubtotalDisagrees } from "./src/modules/cashier/transactions/basketPresentation.ts";
      export { buildTransactionAudit } from "./src/modules/cashier/transactions/transactionAudit.ts";
      export { calculateTransactionSummary } from "./src/modules/cashier/transactions/transactionSummaryMetrics.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  }, bundle: true, platform: "node", format: "esm", write: false,
});
const { recordedBasketLine, recordedBasketChoices, basketSubtotalDisagrees, buildTransactionAudit, calculateTransactionSummary } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const items = [
  { id: "1", name: "Meal with extra rice", quantity: 2, unitPrice: 50, lineTotal: 120,
    modifiers: [{ name: "Extra rice" }] },
  { id: "2", name: "Drink", quantity: 1, unitPrice: 10, lineTotal: 10 },
];
assert.equal(recordedBasketLine(items[0]), 120); // Stored modifier-inclusive amount, not 2 × 50.
assert.deepEqual(recordedBasketChoices({ ...items[0], mealOption: "with_rice", modifiers: [{ name: "With Rice" }, { name: "Extra rice" }] }), ["With Rice", "Extra rice"]);
assert.equal(recordedBasketLine({ ...items[1], lineTotal: undefined }), 10);
assert.equal(recordedBasketLine({ ...items[1], lineTotal: Number.NaN }), undefined);
assert.equal(basketSubtotalDisagrees({ items, subtotal: 130 }), false);
assert.equal(basketSubtotalDisagrees({ items, subtotal: 120 }), true);
const adjusted = { items, subtotal: 130, deliveryFee: 20, taxAmount: 0, total: 150 };
assert.equal(basketSubtotalDisagrees(adjusted), false); // Fee belongs after subtotal.

const cash = { id: "tx-cash", orderId: "ORD-1", cashierId: "cashier-original", cashierName: "Current session name",
  method: "Cash", status: "Completed", amount: 130, createdAt: "2025-01-01T00:00:00Z",
  shiftId: "shift-1", paymentId: "pay-1", customerName: "Customer" };
const gcash = { ...cash, id: "tx-gcash", method: "GCash", amount: 140, paymentId: "pay-2" };
const voided = { ...cash, id: "tx-void", status: "Voided", amount: 130, paymentId: "pay-3" };
const metrics = calculateTransactionSummary([cash, gcash, voided], []);
assert.equal(metrics.revenue, 270);
assert.equal(metrics.cashRevenue, 130);
assert.equal(metrics.gcashRevenue, 140);
assert.equal(metrics.completedCount, 2);
assert.equal(metrics.voidCount, 1);
assert.equal(calculateTransactionSummary([voided], []).revenue, 0);

const payment = { id: "pay-1", method: "Cash", uploadedAt: "2025-01-01T00:00:00Z",
  verifiedAt: "2025-01-01T00:01:00Z", verifiedBy: "verifier-original" };
const audit = buildTransactionAudit(cash, { timeline: [{ id: "event-1", label: "Order confirmed",
  timestamp: "2025-01-01T00:02:00Z", actor: "Account 12345678-1234-1234-1234-123456789abc" }] }, payment);
assert.equal(audit.find((entry) => entry.source === "Transaction").actorId, "cashier-original");
assert.equal(audit.find((entry) => entry.label === "Payment verified").actorId, "verifier-original");
assert.ok(audit.every((entry) => entry.actor !== "Current session name"));
assert.equal(audit.find((entry) => entry.source === "Order").actor, "Recorded account");
assert.equal(buildTransactionAudit(cash, { timeline: [] }, { ...payment, verifiedBy: undefined })
  .find((entry) => entry.label === "Payment verified").actor, "Verifier unavailable");
console.log("Cashier RS-02 basket, summary, void, and audit attribution scenarios: PASS");
