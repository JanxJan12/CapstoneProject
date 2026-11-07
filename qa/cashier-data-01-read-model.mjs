import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from "./src/modules/cashier/transactions/historyReadApi.ts";
      export { serializeCsv } from "./src/modules/cashier/utils/exportUtils.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  plugins: [{ name: "disposable-supabase", setup(build) {
    build.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "client", namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const supabase = globalThis.__cashierData01Client;", loader: "js" }));
  } }],
  bundle: true, platform: "node", format: "esm", write: false,
});
const cashier = "cashier-one";
const other = "cashier-two";
const records = [
  { id: "tx-3", receipt_number: "RCP-3", transaction_number: "TXN-3", order_id: "o-3", payment_id: "p-3", shift_id: "closed-2", cashier_id: cashier, status: "voided", void_reason: "Manager cancellation", created_at: "2026-10-22T01:00:00Z", order_number: "ORD-3", customer_name: "Voided", grand_total: "75.00", subtotal: "75", delivery_fee: "0", tax_amount: "0", payment_method: "cash", gcash_reference_number: null, terminal: "Counter 2" },
  { id: "tx-2", receipt_number: "RCP-2", transaction_number: "TXN-2", order_id: "o-2", payment_id: "p-2", shift_id: "closed-1", cashier_id: cashier, status: "completed", void_reason: null, created_at: "2026-10-21T16:05:00Z", order_number: "ORD-2", customer_name: 'José, "Ocampo"', grand_total: "150.00", subtotal: "120", delivery_fee: "30", tax_amount: "0", payment_method: "gcash", gcash_reference_number: "REF-2", terminal: "Counter 1" },
  { id: "tx-1", receipt_number: "RCP-1", transaction_number: "TXN-1", order_id: "o-1", payment_id: "p-1", shift_id: "closed-1", cashier_id: cashier, status: "completed", void_reason: null, created_at: "2026-10-20T16:05:00Z", order_number: "ORD-1", customer_name: "Cash", grand_total: "50.00", subtotal: "50", delivery_fee: "0", tax_amount: "0", payment_method: "cash", gcash_reference_number: null, terminal: "Counter 1" },
  { id: "tx-other", receipt_number: "RCP-OTHER", transaction_number: "TXN-OTHER", order_id: "o-other", payment_id: "p-other", shift_id: "other", cashier_id: other, status: "completed", void_reason: null, created_at: "2026-10-23T01:00:00Z", order_number: "ORD-OTHER", customer_name: "Private", grand_total: "999.00", subtotal: "999", delivery_fee: "0", tax_amount: "0", payment_method: "cash", gcash_reference_number: null, terminal: "Other" },
];
let calls = [];
let override;
globalThis.__cashierData01Client = {
  async rpc(name, args) {
    calls.push([name, args]);
    assert.equal(name, "get_cashier_transaction_history");
    if (override) return override;
    const f = args.p_filters;
    const filtered = records.filter((row) => row.cashier_id === cashier &&
      (!f.status || row.status === f.status) &&
      (!f.method || row.payment_method === f.method) &&
      (!f.search || `${row.transaction_number} ${row.receipt_number} ${row.gcash_reference_number ?? ""}`.toLowerCase().includes(f.search.toLowerCase())) &&
      (!f.shift || row.shift_id === f.shift));
    return { data: { rows: filtered.slice(args.p_offset, args.p_offset + args.p_limit), total: filtered.length }, error: null };
  },
  from(table) {
    assert.equal(table, "cashier_shifts");
    return { select() { return this; }, eq(column, value) { assert.equal(column, "cashier_id"); assert.equal(value, cashier); return this; }, order() { return this; }, limit(value) { assert.equal(value, 500); return Promise.resolve({ data: [
      { id: "closed-2", cashier_id: cashier, terminal: "Counter 2", opening_cash: "0", started_at: "2026-10-22", ended_at: "2026-10-23", status: "closed" },
      { id: "closed-1", cashier_id: cashier, terminal: "Counter 1", opening_cash: "0", started_at: "2026-10-20", ended_at: "2026-10-21", status: "closed" },
    ], error: null }); } };
  },
};
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
const filters = { search: "", method: "All", status: "All", from: "", to: "", cashier: "All", shift: "All", terminal: "All", customer: "", orderId: "", receiptNumber: "" };
const shifts = await api.fetchHistoryShifts(cashier, "Cashier One");
assert.equal(shifts.length, 2);
assert.ok(shifts.every((shift) => shift.status === "Closed")); // no open shift
const first = await api.fetchHistoryPage(cashier, filters, 0, 2);
const second = await api.fetchHistoryPage(cashier, filters, 2, 2);
assert.equal(first.total, 3);
assert.deepEqual([...first.rows, ...second.rows].map((row) => row.receipt_number), ["RCP-3", "RCP-2", "RCP-1"]);
assert.equal(calls[0][1].p_offset, 0);
assert.equal(calls[1][1].p_offset, 2);
const csv = api.serializeCsv(api.HISTORY_CSV_HEADERS, [...first.rows, ...second.rows].map(api.historyCsvRow));
assert.match(csv, /"RCP-2","ORD-2","2026-10-22","00:05:00"/);
assert.match(csv, /"José, ""Ocampo"""/);
assert.ok(!csv.includes("RCP-OTHER"));
assert.equal(Number(first.rows[1].subtotal) + Number(first.rows[1].delivery_fee) + Number(first.rows[1].tax_amount), Number(first.rows[1].grand_total));
const filtered = await api.fetchHistoryPage(cashier, { ...filters, method: "GCash", status: "Completed", search: "REF-2" }, 0, 50);
assert.equal(filtered.total, 1);
assert.equal(api.historyCsvRow(filtered.rows[0])[0], filtered.rows[0].receipt_number);
assert.deepEqual(calls.at(-1)[1].p_filters, { search: "REF-2", method: "gcash", status: "completed", from: "", to: "", shift: "", terminal: "", customer: "", orderId: "", receiptNumber: "" });
override = { data: { total: 1, rows: [records[3]] }, error: null };
await assert.rejects(api.fetchHistoryPage(cashier, filters, 0, 50), /unauthorized/);
override = { data: null, error: { message: "permission denied" } };
await assert.rejects(api.fetchHistoryPage(cashier, filters, 0, 50), /permission denied/);
delete globalThis.__cashierData01Client;
const mappingBundle = await build({
  stdin: { contents: `export { mapDatabaseOrderToCashierOrder } from "./src/modules/cashier/services/supabaseOrderService.ts";
    export { mapDatabaseCashierSale } from "./src/modules/cashier/api/cashierSaleHydrationApi.ts";
    export { canCancelCashierOrder } from "./src/modules/cashier/orders/orderOperations.ts";`,
    resolveDir: process.cwd(), loader: "ts" },
  plugins: [{ name: "disposable-supabase", setup(build) {
    build.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "client", namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const supabase = {};", loader: "js" }));
  } }],
  bundle: true, platform: "node", format: "esm", write: false,
});
const mapping = await import(`data:text/javascript;base64,${Buffer.from(mappingBundle.outputFiles[0].contents).toString("base64")}`);
const databaseOrder = {
  id: "db-order", order_number: "ORD-UNLINKED", customer_id: null, processed_by: null,
  order_channel: "online", fulfillment_type: "delivery", customer_name: "Customer",
  customer_contact_number: null, delivery_address: null, landmark: null,
  current_status: "delivered", subtotal: "120", delivery_fee: "30", grand_total: "150",
  confirmed_at: null, created_at: "2026-10-01T00:00:00Z", completed_at: null, cancelled_at: null,
};
const unlinked = mapping.mapDatabaseOrderToCashierOrder(databaseOrder, [], []);
assert.equal(unlinked.paymentStatus, "Unknown");
assert.equal(unlinked.paymentMethod, "Unknown");
assert.equal(unlinked.deliveryFee, 30);
assert.equal(mapping.canCancelCashierOrder({ ...unlinked, status: "Awaiting Payment" }), false);
const sale = mapping.mapDatabaseCashierSale({
  order: { ...databaseOrder, processed_by: cashier, current_status: "confirmed", tax_amount: "0", grand_total: "150",
    delivery_fee: "30" },
  items: [], history: [],
  payment: { id: "payment", order_id: databaseOrder.id, payment_method: "gcash", amount: "150",
    gcash_reference_number: "REF", proof_image_path: null, status: "verified", cash_received: null,
    verified_by: cashier, verified_at: "2026-10-01T00:10:00Z", rejection_reason: null,
    created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:10:00Z" },
  transaction: { id: "transaction", transaction_number: "TXN-1", receipt_number: "RCP-1",
    order_id: databaseOrder.id, payment_id: "payment", shift_id: "closed-1", cashier_id: cashier,
    status: "completed", void_reason: null, voided_at: null, request_id: "request",
    created_at: "2026-10-01T00:10:00Z" },
}, "Cashier One");
assert.equal(sale.order.deliveryFee, 30);
assert.equal(sale.order.subtotal + sale.order.deliveryFee + sale.order.taxAmount, sale.order.total);
assert.equal(sale.order.paymentStatus, "Verified");
console.log("Cashier DATA-01 historical read model, closed shifts, isolation, pagination, CSV parity, fee, and filters: PASS");
