import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["src/modules/manager/inventory/unifiedReceivingModel.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { requestReceivingEntries, receiptReceivingEntries } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const request = (id, status, remaining, receipts = []) => ({
  id, number: `PR-${id}`, revision: 2, status,
  lines: [{ inventory_item_id: "item-1", quantity: 5, accepted: 5 - remaining, remaining }], receipts,
});
const draft = { id: "draft-1", number: "RR-DRAFT", status: "draft" };
const posted = { id: "posted-1", number: "RR-POSTED", status: "posted" };
const entries = requestReceivingEntries([
  request("new", "issued", 5),
  request("draft", "partially_received", 3, [posted, draft]),
  request("partial", "partially_received", 2, [posted]),
  request("full", "fulfilled", 0, [posted]),
  request("closed", "closed_short", 2, [posted]),
]);
assert.deepEqual(entries.map(({ key, status, action }) => ({ key, status, action })), [
  { key: "request:new", status: "Awaiting Delivery", action: "Record Delivery" },
  { key: "request:draft", status: "Draft in Progress", action: "Resume Receiving" },
  { key: "request:partial", status: "Partially Received", action: "Record Additional Delivery" },
]);
const receipts = [
  { id: "draft-1", rrNumber: "RR-DRAFT", status: "draft" },
  { id: "posted-1", rrNumber: "RR-POSTED", status: "posted" },
  { id: "supplier-1", rrNumber: "RR-SUPPLIER", status: "posted" },
];
assert.deepEqual(receiptReceivingEntries(receipts, entries, false).map((entry) => entry.key), ["receipt:posted-1", "receipt:supplier-1"]);
assert.deepEqual(receiptReceivingEntries(receipts, entries, true).map((entry) => entry.key), ["receipt:draft-1", "receipt:posted-1", "receipt:supplier-1"]);
assert.deepEqual(receiptReceivingEntries(receipts, entries.filter((entry) => entry.request.id !== "draft"), false).map((entry) => entry.key), ["receipt:draft-1", "receipt:posted-1", "receipt:supplier-1"]);
console.log("PASS: actionable request statuses, stable identities, fulfilled and closed safety, draft grouping, full receipt history");
