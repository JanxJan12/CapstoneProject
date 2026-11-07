import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { getCashierActionQueue } from "./src/modules/cashier/services/cashierDashboardService.ts";
      export { partitionCashierWorkQueue, selectCashierQueueView } from "./src/modules/cashier/dashboard/workQueuePresentation.ts";
      export { formatElapsedMinutes } from "./src/modules/cashier/constants/index.ts";`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { getCashierActionQueue, partitionCashierWorkQueue, selectCashierQueueView, formatElapsedMinutes } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const now = Date.parse("2026-10-21T16:05:00Z"); // 00:05, Oct 22 in Manila
const order = (id, createdAt, status = "Ready") => ({
  id, createdAt, updatedAt: createdAt, timeline: [], status,
  customerName: "Test", type: "Takeout", total: 100,
  paymentStatus: "Verified",
});
const state = {
  orders: [
    order("current-payment", "2026-10-21T16:03:00Z", "Confirmed"),
    order("current-ready", "2026-10-21T16:01:00Z"),
    { ...order("older-ready", "2026-10-21T15:59:00Z"), shiftId: "closed-shift" },
    order("old-undated", "invalid"),
    order("completed", "2026-10-21T16:02:00Z", "Completed"),
    order("cancelled", "2026-10-21T15:58:00Z", "Cancelled"),
  ],
  payments: [{ id: "payment-1", orderId: "current-payment", status: "Pending", uploadedAt: "2026-10-21T16:04:00Z" }],
  shifts: [],
};
const actionQueue = getCashierActionQueue(state, now);
const queue = partitionCashierWorkQueue(actionQueue, now);

assert.deepEqual(new Set(queue.current.map((item) => item.orderId)), new Set(["current-payment", "current-ready"]));
assert.deepEqual(new Set(queue.older.map((item) => item.orderId)), new Set(["older-ready", "old-undated"]));
assert.equal(queue.all.length, 4);
assert.equal(selectCashierQueueView(queue, "action_required").length, 2);
assert.equal(selectCashierQueueView(queue, "current_orders").length, queue.current.length);
assert.equal(selectCashierQueueView(queue, "ready_for_handoff").length, 1);
assert.equal(selectCashierQueueView(queue, "all_active").length, 4);
assert.equal(selectCashierQueueView(queue, "older_backlog").length, 2);
assert.equal(selectCashierQueueView(queue, "action_required", "payments")[0].orderId, "current-payment");
assert.ok(actionQueue.filter((item) => item.nextAction === "release_order").every((item) => item.orderStatus === "Ready"));

assert.equal(formatElapsedMinutes(12), "12 min");
assert.equal(formatElapsedMinutes(135), "2 hr 15 min");
assert.equal(formatElapsedMinutes(4_320), "3 days");
assert.equal(formatElapsedMinutes(57_600), "40 days");
assert.equal(formatElapsedMinutes(-5), "Just now");
assert.equal(formatElapsedMinutes(Number.NaN), "Time unavailable");
console.log("Cashier workspace queue and duration checks: PASS");
