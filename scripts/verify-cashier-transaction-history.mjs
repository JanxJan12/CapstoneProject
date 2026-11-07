import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { filterTransactionRecords, getReceiptNumber } from "./src/modules/cashier/transactions/transactionRecords.ts";
      export { calculateTransactionSummary } from "./src/modules/cashier/transactions/transactionSummaryMetrics.ts";
      export { buildTransactionAudit } from "./src/modules/cashier/transactions/transactionAudit.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { filterTransactionRecords, getReceiptNumber, calculateTransactionSummary, buildTransactionAudit } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const makeTxn = (id, orderId, method, amount, createdAt, status = "Completed") => ({
  id, orderId, method, amount, createdAt, status,
  customerName: "Test Customer", cashierName: "Cashier", shiftId: "shift-1",
  paymentId: `payment-${id}`,
});
const cash = { ...makeTxn("tx-41", "ORD-000060", "Cash", 120, "2026-10-21T15:55:00Z"), receiptNumber: "RCP-000041" };
const gcash = { ...makeTxn("tx-42", "ORD-000061", "GCash", 170, "2026-10-21T16:05:00Z"), receiptNumber: "RCP-000042" };
const voided = { ...makeTxn("tx-43", "ORD-000062", "Cash", 50, "2026-10-21T16:06:00Z", "Voided"), receiptNumber: "RCP-000043" };
const transactions = [cash, gcash, voided];
const orders = [
  { id: cash.orderId, items: [{ name: "Meal", quantity: 2 }] },
  { id: gcash.orderId, items: [{ name: "Rice", quantity: 1 }] },
];
const payments = new Map([
  [cash.paymentId, { id: cash.paymentId, referenceNumber: "CASH-REF", method: "Cash", uploadedAt: cash.createdAt, verifiedAt: cash.createdAt }],
  [gcash.paymentId, { id: gcash.paymentId, referenceNumber: "GCASH-REF", method: "GCash", uploadedAt: gcash.createdAt }],
]);
const shifts = new Map([["shift-1", { id: "shift-1", terminal: "Counter 1" }]]);
const defaults = { search: "", method: "All", status: "All", from: "", to: "", cashier: "All", shift: "All", terminal: "All", customer: "", orderId: "", receiptNumber: "" };

assert.equal(getReceiptNumber(cash), "RCP-000041");
assert.equal(getReceiptNumber(gcash), "RCP-000042");
assert.deepEqual(filterTransactionRecords(transactions, { ...defaults, search: "RCP-000041" }, payments, shifts).map((t) => t.id), [cash.id]);
assert.deepEqual(filterTransactionRecords(transactions, { ...defaults, search: "GCASH-REF" }, payments, shifts).map((t) => t.id), [gcash.id]);
assert.deepEqual(filterTransactionRecords(transactions, { ...defaults, method: "Cash", status: "Completed" }, payments, shifts).map((t) => t.id), [cash.id]);
assert.deepEqual(filterTransactionRecords(transactions, { ...defaults, from: "2026-10-22", to: "2026-10-22" }, payments, shifts).map((t) => t.id), [voided.id, gcash.id]);
assert.deepEqual(filterTransactionRecords(transactions, { ...defaults, terminal: "Counter 1", orderId: "000060" }, payments, shifts).map((t) => t.id), [cash.id]);

const allSummary = calculateTransactionSummary(transactions, orders);
assert.equal(allSummary.revenue, 290);
assert.equal(allSummary.cashRevenue, 120);
assert.equal(allSummary.gcashRevenue, 170);
assert.equal(allSummary.completedCount, 2);
assert.equal(allSummary.refundCount, 0);
assert.equal(allSummary.voidCount, 1);
const cashFiltered = filterTransactionRecords(transactions, { ...defaults, method: "Cash", status: "Completed" }, payments, shifts);
assert.equal(calculateTransactionSummary(cashFiltered, orders).revenue, 120);
assert.equal(cashFiltered.length, 1); // Same array feeds table and CSV export.

const audit = buildTransactionAudit(cash, { ...orders[0], timeline: [] }, payments.get(cash.paymentId));
assert.ok(audit.some((entry) => entry.source === "Transaction"));
assert.ok(audit.some((entry) => entry.source === "Payment"));
console.log("Cashier Transaction History focused checks: PASS");
