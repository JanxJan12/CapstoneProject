import assert from "node:assert/strict";
import { cashierPathFor, resolveCashierPath } from "../src/modules/cashier/ordersReceiptsNavigation.ts";
import { findAccessibleOrder, selectAuthorizedReceipt } from "../src/modules/cashier/ordersReceiptLinks.ts";

for (const [path, page, view, canonical] of [
  ["/cashier", "dashboard", "orders", "/cashier"],
  ["/cashier/orders-receipts", "orders-receipts", "orders", "/cashier/orders-receipts/orders"],
  ["/cashier/orders-receipts/orders", "orders-receipts", "orders", "/cashier/orders-receipts/orders"],
  ["/cashier/orders-receipts/receipts", "orders-receipts", "receipts", "/cashier/orders-receipts/receipts"],
  ["/cashier/order-list", "orders-receipts", "orders", "/cashier/orders-receipts/orders"],
  ["/cashier/transactions", "orders-receipts", "receipts", "/cashier/orders-receipts/receipts"],
  ["/cashier/unknown", "dashboard", "orders", "/cashier"],
]) {
  assert.deepEqual(resolveCashierPath(path), { page, view, canonicalPath: canonical });
}
assert.equal(cashierPathFor("order-list"), "/cashier/orders-receipts/orders");
assert.equal(cashierPathFor("transactions"), "/cashier/orders-receipts/receipts");
assert.equal(cashierPathFor("orders-receipts", "receipts"), "/cashier/orders-receipts/receipts");

const order = { id: "ORD-000075", databaseId: "order-uuid", transactionId: "tx-uuid" };
const owned = { id: "tx-uuid", cashier_id: "cashier-a", order_id: "order-uuid", order_number: "ORD-000075", status: "completed" };
assert.equal(selectAuthorizedReceipt(order, "cashier-a", [owned])?.id, "tx-uuid");
assert.equal(selectAuthorizedReceipt(order, "cashier-b", [owned]), undefined);
assert.equal(selectAuthorizedReceipt(order, "cashier-a", [{ ...owned, order_id: "other-order" }]), undefined);
assert.equal(selectAuthorizedReceipt(order, "cashier-a", [{ ...owned, id: "other-tx" }]), undefined);
assert.equal(selectAuthorizedReceipt(order, "cashier-a", []), undefined);
assert.equal(selectAuthorizedReceipt({ ...order, transactionId: undefined }, "cashier-a", [{ ...owned, status: "voided" }])?.id, "tx-uuid");
assert.equal(findAccessibleOrder(order, [order])?.id, order.id);
assert.equal(findAccessibleOrder(order, [{ ...order, databaseId: "other-order" }]), undefined);
assert.equal(findAccessibleOrder(undefined, [order]), undefined);
console.log("Cashier IA-01 route and authorized-link checks: PASS");
