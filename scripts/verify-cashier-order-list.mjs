import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { matchesOrderListView, getOrderWaitingPresentation, getRiderStatus, getRecordedDeliveryFee, sortOperationalOrders } from "./src/modules/cashier/orders/orderOperations.ts";
      export { PAGE_SIZE } from "./src/modules/cashier/constants/index.ts";`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  matchesOrderListView, getOrderWaitingPresentation, getRiderStatus,
  getRecordedDeliveryFee, sortOperationalOrders, PAGE_SIZE,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);

const now = Date.parse("2026-10-21T16:05:00Z"); // Oct 22, 00:05 Manila
const makeOrder = (id, createdAt, status = "Ready", type = "Delivery") => ({
  id, createdAt, status, type, total: 85, subtotal: 35, deliveryFee: 50,
  customerName: id, contactNumber: "", items: [], paymentStatus: "Unpaid",
});
const current = makeOrder("current", "2026-10-21T16:03:00Z");
const older = makeOrder("older", "2026-10-21T15:59:00Z");
const completed = makeOrder("completed", "2026-10-21T15:58:00Z", "Completed");
const cancelledToday = makeOrder("cancelled", "2026-10-21T16:02:00Z", "Cancelled");
const invalid = makeOrder("invalid", "bad timestamp");
assert.equal(matchesOrderListView(current, "today", now), true);
assert.equal(matchesOrderListView(older, "today", now), false);
assert.equal(matchesOrderListView(older, "older", now), true);
assert.equal(matchesOrderListView(invalid, "older", now), true);
assert.equal(matchesOrderListView(completed, "older", now), false);
assert.equal(matchesOrderListView(cancelledToday, "today", now), false);
assert.equal(matchesOrderListView(completed, "all", now), true);

const records = [older, completed, current, cancelledToday, invalid];
const searched = records.filter((order) => order.id.includes("current") || order.id.includes("older"));
assert.deepEqual(searched.filter((order) => matchesOrderListView(order, "today", now)).map((order) => order.id), ["current"]);
assert.deepEqual(searched.filter((order) => matchesOrderListView(order, "older", now)).map((order) => order.id), ["older"]);
const many = Array.from({ length: PAGE_SIZE + 2 }, (_, index) => makeOrder(`order-${index}`, current.createdAt));
const sorted = sortOperationalOrders(many, [{ key: "orderNumber", direction: "asc" }], 20, now, "operations");
assert.equal(sorted.slice(0, PAGE_SIZE).length, PAGE_SIZE);
assert.equal(sorted.slice(PAGE_SIZE, 2 * PAGE_SIZE).length, 2);
assert.equal(sorted[0].id, "order-0");
assert.equal(sortOperationalOrders([older, current], [], 20, now, "operations")[0].id, "current");
assert.equal(sortOperationalOrders([older, current], [{ key: "orderNumber", direction: "asc" }], 20, now, "operations")[0].id, "current");
assert.equal(sortOperationalOrders([older, current], [{ key: "created", direction: "asc" }], 20, now, "operations")[0].id, "older");

assert.equal(getOrderWaitingPresentation(current, 20, now).label, "2 min since placed");
assert.match(getOrderWaitingPresentation(older, 20, now).label, /^Older unresolved · /);
assert.equal(getOrderWaitingPresentation(makeOrder("historical", "2026-09-11T16:05:00Z"), 20, now).label, "Older unresolved · 40 days since placed");
assert.equal(getOrderWaitingPresentation(invalid, 20, now).label, "Date unavailable");
assert.equal(getOrderWaitingPresentation(completed, 20, now).delayed, false);
const delayedCurrent = makeOrder("late", "2026-10-21T16:00:00Z");
assert.equal(getOrderWaitingPresentation(delayedCurrent, 3, now).label, "5 min since placed · review");

assert.equal(getRiderStatus(makeOrder("payment", current.createdAt, "Awaiting Payment")), "Not yet applicable");
assert.equal(getRiderStatus({ ...current, status: "Waiting for Rider", riderAssignmentKnown: false, riderStatus: "Assignment unavailable" }), "Assignment status unavailable");
assert.equal(getRiderStatus({ ...current, status: "Waiting for Rider", riderAssignmentKnown: true, riderStatus: "Offer pending" }), "Offer pending");
assert.equal(getRiderStatus({ ...current, status: "Waiting for Rider", riderAssignmentKnown: true, riderStatus: "Waiting for rider" }), "Waiting for rider");
assert.equal(getRecordedDeliveryFee(current), 50);
assert.equal(current.subtotal + getRecordedDeliveryFee(current), current.total);
assert.equal(getRecordedDeliveryFee({ ...current, deliveryFee: undefined }), undefined);
assert.equal(getRecordedDeliveryFee({ ...current, type: "Take-out" }), undefined);
assert.equal(getRecordedDeliveryFee({ ...current, deliveryFee: Number.NaN }), undefined);
console.log("Cashier Order List focused checks: PASS");
