import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: 'export { canCancelCashierOrder, canEditCashierOrder } from "./src/modules/cashier/orders/orderOperations.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { canCancelCashierOrder, canEditCashierOrder } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const order = { id: "ORD-FIXTURE", databaseId: "disposable-order-id", type: "Dine-in", status: "Awaiting Payment", paymentStatus: "Unpaid" };
for (const paymentStatus of ["Unpaid", "Rejected", "Pending", "Verified"]) {
  assert.equal(canCancelCashierOrder({ ...order, paymentStatus }),
    paymentStatus === "Unpaid" || paymentStatus === "Rejected", paymentStatus);
}
assert.equal(canCancelCashierOrder({ ...order, transactionId: "sale-id" }), false);
assert.equal(canCancelCashierOrder({ ...order, databaseId: undefined }), false);
for (const status of ["Confirmed", "Preparing", "Ready", "Waiting for Rider", "Rider Accepted", "Completed", "Cancelled"]) {
  assert.equal(canCancelCashierOrder({ ...order, status }), false, status);
}
for (const status of ["Awaiting Payment", "Confirmed", "Preparing", "Ready", "Waiting for Rider"]) {
  assert.equal(canEditCashierOrder({ ...order, status }), true, status);
}
for (const status of ["Rider Accepted", "Picked Up", "Out for Delivery", "Completed", "Cancelled"]) {
  assert.equal(canEditCashierOrder({ ...order, status }), false, status);
}
assert.equal(canEditCashierOrder({ ...order, databaseId: undefined }), false);
console.log("Cashier OPT-03 action eligibility regression: PASS");
