import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from "./src/modules/cashier/transactions/transactionExport.ts";
      export { serializeCsv, downloadCsv } from "./src/modules/cashier/utils/exportUtils.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const {
  assertCompleteTransactionExport, buildTransactionExport, createTransactionExportGate, fetchAllTransactionExportRecords,
  serializeCsv, downloadCsv, TRANSACTION_CSV_HEADERS,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const filters = { search: "", method: "All", status: "All", from: "", to: "", cashier: "All", shift: "All", terminal: "All", customer: "", orderId: "", receiptNumber: "" };
const cashier = { id: "cashier-1", name: "Cashier One" };
function record(n, changes = {}) {
  return {
    id: String(n).padStart(5, "0"),
    receipt_number: `RCP-${n}`, cashier_id: cashier.id, status: "completed",
    created_at: n === 1 ? "2026-10-21T15:55:00Z" : "2026-10-21T16:05:00Z",
    order: { order_number: `ORD-${n}`, customer_name: "Test Customer", grand_total: n === 1 ? "120.00" : "170.00" },
    payment: { id: `payment-${n}`, payment_method: n === 1 ? "cash" : "gcash", gcash_reference_number: n === 1 ? null : `REF-${n}` },
    shift: { id: "shift-1", terminal: "Counter 1" },
    ...changes,
  };
}

function parseCsv(csv) {
  assert.equal(csv.codePointAt(0), 0xFEFF);
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let i = 1; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"' && quoted && csv[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if (char === "\r" && csv[i + 1] === "\n" && !quoted) {
      row.push(value); rows.push(row); row = []; value = ""; i++;
    } else value += char;
  }
  assert.equal(quoted, false);
  return rows;
}

const two = buildTransactionExport([record(1), record(2)], filters, cashier);
assert.equal(two.count, 2);
const parsed = parseCsv(serializeCsv(two.headers, two.rows));
assert.deepEqual(parsed[0], [...TRANSACTION_CSV_HEADERS]);
assert.deepEqual(parsed.slice(1).map((row) => row[0]), ["RCP-2", "RCP-1"]);
assert.deepEqual(parsed.slice(1).map((row) => row[7]), ["170.00", "120.00"]);
assert.deepEqual(parsed.find((row) => row[0] === "RCP-2").slice(2, 4), ["2026-10-22", "00:05:00"]);
assert.equal(buildTransactionExport([record(1), record(2)], { ...filters, search: "REF-2" }, cashier).count, 1);
assert.deepEqual(buildTransactionExport([record(1), record(2)], { ...filters, method: "Cash" }, cashier).rows.map((row) => row[0]), ["RCP-1"]);
assert.deepEqual(buildTransactionExport([record(1), record(2, { status: "voided" })], { ...filters, status: "Voided" }, cashier).rows.map((row) => row[6]), ["Voided"]);
assert.throws(() => buildTransactionExport([record(1, { status: "refunded" })], filters, cashier), /incomplete/);
assert.deepEqual(buildTransactionExport([record(1), record(2)], { ...filters, from: "2026-10-22", to: "2026-10-22" }, cashier).rows.map((row) => row[0]), ["RCP-2"]);
assert.equal(buildTransactionExport([record(1)], { ...filters, cashier: "Other" }, cashier).count, 0);
assert.equal(buildTransactionExport([record(1)], { ...filters, shift: "other" }, cashier).count, 0);
assert.equal(buildTransactionExport([record(1)], { ...filters, terminal: "Other" }, cashier).count, 0);
assert.equal(buildTransactionExport([record(1)], { ...filters, customer: "missing" }, cashier).count, 0);
assert.equal(buildTransactionExport([record(1)], { ...filters, orderId: "ORD-1", receiptNumber: "RCP-1" }, cashier).count, 1);
assert.equal(buildTransactionExport([], filters, cashier).count, 0);
const special = record(3, { order: { order_number: "ORD-3", customer_name: 'José, "Ocampo"\nNorth', grand_total: "99.50" } });
const specialCsv = serializeCsv(two.headers, buildTransactionExport([special], filters, cashier).rows);
assert.equal(parseCsv(specialCsv)[1][4], 'José, "Ocampo"\nNorth');
for (const customer_name of ["=1+1", " +SUM(1,1)", "\t@formula", "\n-2"]) {
  const csv = serializeCsv(two.headers, buildTransactionExport([record(3, { order: { order_number: "ORD-3", customer_name, grand_total: 10 } })], filters, cashier).rows);
  assert.equal(parseCsv(csv)[1][4], `'${customer_name}`);
}
assert.equal(parseCsv(serializeCsv(two.headers, buildTransactionExport([record(3, { order: { order_number: "ORD-3", customer_name: null, grand_total: "10" } })], filters, cashier).rows))[1][4], "");
assert.throws(() => buildTransactionExport([record(1, { cashier_id: "other" })], filters, cashier), /unauthorized/);
assert.throws(() => buildTransactionExport([record(1, { payment: null })], filters, cashier), /incomplete/);
assert.throws(() => buildTransactionExport([record(1, { order: { order_number: "ORD-1", customer_name: null, grand_total: "NaN" } })], filters, cashier), /amount/);
assert.throws(() => serializeCsv(two.headers, [["short"]]), /length/);

const all = Array.from({ length: 501 }, (_, index) => record(index + 1));
let calls = 0;
const fetched = await fetchAllTransactionExportRecords(async (afterId, limit) => {
  calls++;
  assert.equal(limit, 500);
  return all.filter((row) => afterId === null || row.id > afterId).slice(0, limit);
});
assert.equal(calls, 2);
assert.equal(buildTransactionExport(fetched, filters, cashier).count, 501);
assert.doesNotThrow(() => assertCompleteTransactionExport(501, 501, fetched.length));
assert.throws(() => assertCompleteTransactionExport(501, 501, 100), /incomplete/);
assert.throws(() => assertCompleteTransactionExport(501, 500, 500), /incomplete/);
await assert.rejects(fetchAllTransactionExportRecords(async () => { throw new Error("401/403 denied"); }), /denied/);
await assert.rejects(fetchAllTransactionExportRecords(async () => [record(2), record(1)]), /pagination/);

const gate = createTransactionExportGate();
let release; let started = 0;
const first = gate(async () => { started++; await new Promise((resolve) => { release = resolve; }); });
assert.deepEqual(await gate(async () => { started++; }), { started: false });
release(); await first;
assert.equal(started, 1);
assert.equal((await gate(async () => { started++; })).started, true);
assert.equal(started, 2);

const previous = { document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timer: globalThis.setTimeout };
let clicked = 0; let removed = 0; let scheduled = 0; let blob;
globalThis.document = { body: { appendChild() {} }, createElement: () => ({ click() { clicked++; }, remove() { removed++; } }) };
URL.createObjectURL = (value) => { blob = value; return "blob:synthetic"; };
URL.revokeObjectURL = () => { throw new Error("Revoked too early"); };
globalThis.setTimeout = (_callback, ms) => { scheduled = ms; return 1; };
try {
  downloadCsv("rrj-cashier-transactions-2026-10-21.csv", two.headers, two.rows);
  assert.equal(clicked, 1); assert.equal(removed, 1); assert.equal(scheduled, 60_000);
  assert.match(blob.type, /text\/csv;charset=utf-8/);
} finally {
  globalThis.document = previous.document;
  URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke;
  globalThis.setTimeout = previous.timer;
}
console.log("Cashier Transaction History export focused checks: PASS");
