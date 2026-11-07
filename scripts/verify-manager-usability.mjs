import assert from "node:assert/strict";
import { requestPastNeededDate, requestWorkflow } from "../src/modules/manager/inventory/requestWorkflow.ts";

const boundary = Date.parse("2026-10-19T00:00:00+08:00");
const base = {
  status: "issued", needed_at: "2026-10-19T00:00:00+08:00",
  lines: [{ remaining: 2 }], receipts: [],
};
assert.equal(requestPastNeededDate(base, boundary - 1), false, "future Manila needed time");
assert.equal(requestPastNeededDate(base, boundary), false, "exact needed time");
assert.equal(requestPastNeededDate(base, boundary + 1), true, "past Manila needed time");
assert.equal(requestPastNeededDate({ ...base, status: "partially_received" }, boundary + 1), true);
assert.equal(requestPastNeededDate({ ...base, status: "fulfilled", lines: [{ remaining: 0 }] }, boundary + 1), false);
assert.equal(requestPastNeededDate({ ...base, status: "closed_short" }, boundary + 1), false);
assert.equal(requestPastNeededDate({ ...base, needed_at: "invalid" }, boundary + 1), false);
assert.equal(requestPastNeededDate({ ...base, receipts: [{ status: "draft" }] }, boundary + 1), true);
const multiple = { ...base, status: "partially_received", receipts: [{ status: "posted" }, { status: "posted" }, { status: "draft" }] };
assert.deepEqual(requestWorkflow(multiple), {
  draftReceipt: multiple.receipts[2], outstandingLines: 1, postedReceipts: 2, next: "draft",
});
assert.equal(multiple.lines[0].remaining, 2, "outstanding quantity unchanged");
console.log("PASS: 10 request timing/workflow assertions, including Manila boundary and multiple Receiving records");
