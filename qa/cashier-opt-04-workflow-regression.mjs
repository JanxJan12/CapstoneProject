import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { getCashierActionQueue, latestStageTimestamp } from "./src/modules/cashier/services/cashierDashboardService.ts";
      export { partitionCashierWorkQueue, selectCashierQueueView } from "./src/modules/cashier/dashboard/workQueuePresentation.ts";
      export { getOrderWaitingPresentation, isOrderDelayed, getOrderPriority, presentTimelineActor, matchesOrderSearch, matchesOrderPaymentStatus } from "./src/modules/cashier/orders/orderOperations.ts";`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { getCashierActionQueue, latestStageTimestamp, partitionCashierWorkQueue, selectCashierQueueView,
  getOrderWaitingPresentation, isOrderDelayed, getOrderPriority, presentTimelineActor, matchesOrderSearch, matchesOrderPaymentStatus } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const now = Date.parse("2026-10-21T16:45:00Z"); // Oct 22, 00:45 Manila
const makeOrder = (id, createdAt, status) => ({
  id, databaseId: id, createdAt, updatedAt: createdAt, status,
  customerName: id, type: "Dine-in", total: 130, paymentStatus: "Verified", timeline: [],
});
const queued = makeOrder("queued", "2026-10-21T16:10:00Z", "Confirmed");
const preparing = {
  ...makeOrder("preparing", "2026-10-21T16:08:00Z", "Preparing"),
  timeline: [
    { status: "Confirmed", timestamp: "2026-10-21T16:08:00Z" },
    { status: "Preparing", timestamp: "2026-10-21T16:12:00Z" },
    { status: "Preparing", timestamp: "2026-10-21T16:40:00Z", label: "Operational order details updated by cashier" },
  ],
};
const ready = makeOrder("ready", "2026-10-21T16:25:00Z", "Ready");
const olderPayment = makeOrder("older-payment", "2026-10-21T15:50:00Z", "Awaiting Payment");
const olderReady = makeOrder("older-ready", "2026-10-21T15:45:00Z", "Ready");
const state = {
  orders: [queued, preparing, ready, olderPayment, olderReady],
  payments: [{ id: "payment-older", orderId: olderPayment.id, status: "Pending", uploadedAt: "2026-10-21T15:51:00Z" }],
  shifts: [], delayedThresholdMinutes: 20,
};
assert.equal(latestStageTimestamp(preparing), "2026-10-21T16:12:00Z");
const queue = partitionCashierWorkQueue(getCashierActionQueue(state, now), now);
assert.deepEqual(new Set(queue.current.map((item) => item.orderId)), new Set(["queued", "preparing", "ready"]));
assert.deepEqual(new Set(queue.older.map((item) => item.orderId)), new Set(["older-payment", "older-ready"]));
assert.deepEqual(selectCashierQueueView(queue, "action_required").map((item) => item.orderId), ["ready"]);
assert.deepEqual(selectCashierQueueView(queue, "action_required", "payments").map((item) => item.orderId), ["older-payment"]);
assert.deepEqual(selectCashierQueueView(queue, "ready_for_handoff").map((item) => item.orderId), ["ready"]);
assert.deepEqual(new Set(selectCashierQueueView(queue, "all_active", "delayed").map((item) => item.orderId)), new Set(["preparing", "ready"]));
assert.equal(queue.current.find((item) => item.orderId === "queued").orderAgeReview, true);
assert.equal(queue.current.find((item) => item.orderId === "queued").isDelayed, false);
assert.equal(queue.current.find((item) => item.orderId === "preparing").isDelayed, true);
assert.equal(queue.current.find((item) => item.orderId === "preparing").waitingMinutes, 33);
assert.equal(queue.older.every((item) => !item.isDelayed && !item.orderAgeReview), true);
assert.equal(isOrderDelayed(olderReady, 20, now), false);
assert.equal(getOrderPriority(olderReady, 20, now), "Normal");
assert.match(getOrderWaitingPresentation(olderReady, 20, now).label, /Older unresolved.*since placed/);
assert.equal(getOrderWaitingPresentation(queued, 20, now).label, "35 min since placed · review");
assert.deepEqual(presentTimelineActor("Account cashier-id", "cashier-id", "Jan"), { label: "Jan (Cashier)", technicalId: "cashier-id" });
assert.deepEqual(presentTimelineActor("Account other-id", "cashier-id", "Jan"), { label: "Recorded account (identity unavailable)", technicalId: "other-id" });
assert.equal(presentTimelineActor("Kitchen terminal", "cashier-id", "Jan").label, "Kitchen terminal");
const searchable = { ...queued, customerName: "Ana Cruz", contactNumber: "09171234567", items: [{ id: "item", name: "Chicken Bicol Express", quantity: 1 }] };
for (const term of ["queued", "ana", "0917", "bicol", "dine-in"]) {
  assert.equal(matchesOrderSearch(searchable, term), true, term);
}
assert.equal(matchesOrderSearch(searchable, "missing"), false);
for (const paymentStatus of ["Unpaid", "Pending", "Verified", "Rejected"]) {
  const row = { ...searchable, paymentStatus };
  assert.equal(matchesOrderPaymentStatus(row, paymentStatus), true);
  assert.equal(matchesOrderPaymentStatus(row, "All"), true);
  assert.equal(matchesOrderPaymentStatus(row, paymentStatus === "Verified" ? "Pending" : "Verified"), false);
}
console.log("Cashier OPT-04 action, monitoring, aging, and actor regression: PASS");
