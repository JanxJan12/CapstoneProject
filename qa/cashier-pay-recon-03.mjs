import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyCashierOrderPaymentSummaries,
  CASHIER_PAYMENT_BATCH_SIZE,
  loadCashierOrderPaymentSummaries,
  parseCashierOrderPaymentSummaries,
} from "../src/modules/cashier/services/cashierOrderPaymentResolution.ts";

const order = (id, channel = "walk_in", status = "Unknown") => ({
  id,
  databaseId: id,
  orderChannel: channel,
  paymentMethod: "Unknown",
  paymentStatus: status,
});
const rows = [
  { order_id: "old-cash", payment_method: "cash", payment_status: "verified" },
  { order_id: "recent-cash", payment_method: "cash", payment_status: "verified" },
  { order_id: "reversed", payment_method: "gcash", payment_status: "voided" },
  { order_id: "conflict", payment_method: null, payment_status: null },
];
const summaries = parseCashierOrderPaymentSummaries(
  rows.map((row) => row.order_id),
  rows,
);
const result = applyCashierOrderPaymentSummaries([
  order("old-cash"), order("recent-cash"), order("reversed"), order("conflict"),
  order("missing"), order("online-pending", "online", "Pending"),
  order("online-rejected", "online", "Rejected"),
], summaries);
assert.deepEqual(result.map(({ paymentMethod, paymentStatus }) => [paymentMethod, paymentStatus]), [
  ["Cash", "Verified"], ["Cash", "Verified"], ["GCash", "Voided"],
  ["Unknown", "Unknown"], ["Unknown", "Unknown"],
  ["Unknown", "Pending"], ["Unknown", "Rejected"],
]);
assert.equal(result[3].paymentResolutionUncertain, true);
assert.equal(result[0].paymentResolutionUncertain, false);

assert.throws(() => parseCashierOrderPaymentSummaries(["mine"], [rows[0]]));
assert.throws(() => parseCashierOrderPaymentSummaries(["mine"], [
  { order_id: "mine", payment_method: "cash", payment_status: "verified" },
  { order_id: "mine", payment_method: "cash", payment_status: "verified" },
]));
assert.throws(() => parseCashierOrderPaymentSummaries(["mine"], [
  { order_id: "mine", payment_method: "cash", payment_status: null },
]));

const batches = [];
await loadCashierOrderPaymentSummaries(
  Array.from({ length: 205 }, (_, index) => `order-${index}`),
  async (batch) => { batches.push(batch); return []; },
);
assert.deepEqual(batches.map((batch) => batch.length), [100, 100, 5]);
await loadCashierOrderPaymentSummaries([], async () => {
  throw new Error("An empty order list must make no payment request.");
});

const sql = readFileSync(new URL("../supabase/migrations/20261102193437_cashier_owned_order_payment_summaries.sql", import.meta.url), "utf8");
assert.equal(CASHIER_PAYMENT_BATCH_SIZE, 100);
for (const predicate of [
  "cardinality(p_order_ids) > 100",
  "auth.uid()",
  "profile.role = 'cashier'",
  "owned_transaction.cashier_id = v_cashier_id",
  "transaction_row.cashier_id = v_cashier_id",
  "transaction_row.payment_id = payment_row.id",
  "payment_row.amount = orders.grand_total",
  "payment_counts.record_count = 1",
  "transaction_counts.record_count = 1",
  "payment_row.status = 'verified'",
  "transaction_row.status = 'completed'",
  "payment_row.status = 'voided'",
  "transaction_row.status = 'voided'",
  "set search_path = ''",
  "to authenticated",
]) assert.ok(sql.includes(predicate), `Missing SQL guard: ${predicate}`);
assert.ok(!/grant\s+select\s+on\s+.*payments/i.test(sql));
assert.ok(!/\b(insert|update|delete)\s+(into|public\.|from)\s*(public\.)?(payments|cashier_transactions|orders)\b/i.test(sql));
console.log("PASS cashier payment summary mapping and SQL guard checks");
