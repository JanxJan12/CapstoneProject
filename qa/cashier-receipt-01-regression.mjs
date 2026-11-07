import assert from "node:assert/strict";
import { prepareReceipt } from "../src/modules/cashier/pos/receiptPresentation.ts";

const order = {
  id: "ORD-000075", customerName: "Walk-in Customer", type: "Dine-in",
  items: [{ id: "item-1", name: "Chicken Bicol Express", unitPrice: 130, lineTotal: 130, quantity: 1 }],
  subtotal: 130, deliveryFee: 0, taxAmount: 0, total: 130,
};
const payment = {
  id: "payment-1", orderId: order.id, method: "Cash", amount: 130,
  submittedAmount: 130, cashReceived: 130, status: "Verified",
};
const transaction = {
  id: "transaction-1", orderId: order.id, paymentId: payment.id,
  receiptNumber: "RCP-000054", amount: 130,
  method: "Cash", status: "Completed", createdAt: "2026-10-29T04:00:00Z",
};
const ready = (o = order, p = payment, t = transaction) => {
  const result = prepareReceipt(o, p, t);
  assert.equal(result.ready, true, result.ready ? "" : result.reason);
  return result.receipt;
};
const blocked = (o = order, p = payment, t = transaction) =>
  assert.equal(prepareReceipt(o, p, t).ready, false);

const exact = ready();
assert.equal(exact.receiptNumber, "RCP-000054");
assert.equal(exact.orderNumber, "ORD-000075");
assert.equal(exact.items[0].amount, 130);
assert.equal(exact.cashReceived, 130);
assert.equal(exact.change, 0);
assert.match(exact.issuedAt, /Oct.*29.*2026|29.*Oct.*2026/);
assert.equal(ready(order, { ...payment, submittedAmount: 200, cashReceived: 200 }).change, 70);
assert.equal(ready(order, { ...payment, submittedAmount: 500, cashReceived: 500 }).change, 370);
blocked(order, { ...payment, cashReceived: 129 });

const longName = "Special Family Meal with a very long recorded item name that must wrap safely";
const manyItems = Array.from({ length: 30 }, (_, index) => ({
  id: `item-${index}`, name: index === 0 ? longName : `Recorded item ${index + 1}`,
  quantity: 1, unitPrice: 10, lineTotal: 10,
  modifiers: index === 0 ? [{ name: "Extra sauce" }] : [],
}));
const multi = ready({ ...order, items: manyItems, subtotal: 300, total: 300,
  customerName: "", deliveryFee: undefined },
  { ...payment, amount: 300, submittedAmount: 500, cashReceived: 500 },
  { ...transaction, amount: 300 });
assert.equal(multi.items.length, 30);
assert.equal(multi.items[0].name, longName);
assert.deepEqual(multi.items[0].choices, ["Extra sauce"]);
assert.equal(multi.customerName, undefined);
assert.equal(multi.change, 200);

const historical = ready({ ...order, type: "Delivery", deliveryFee: 30,
  taxAmount: 0, subtotal: 100,
  items: [{ ...order.items[0], unitPrice: 100, lineTotal: 100 }] },
  { ...payment, method: "GCash", amount: 130, cashReceived: undefined, referenceNumber: "GC-123" },
  { ...transaction, method: "GCash", createdAt: "2025-01-05T00:00:00Z" });
assert.equal(historical.deliveryFee, 30);
assert.equal(historical.tax, undefined);
assert.equal(historical.method, "GCash");
assert.equal(historical.gcashReference, "GC-123");
assert.equal(historical.cashReceived, undefined);
assert.equal(historical.change, undefined);
assert.match(historical.issuedAt, /2025/);
assert.equal(ready(order, { ...payment, cashReceived: undefined }).change, undefined);
assert.equal(ready(order, payment, { ...transaction, status: "Voided" }).voided, true);

blocked(order, payment, null);
blocked(order, null, transaction);
blocked(order, payment, { ...transaction, receiptNumber: undefined });
blocked(order, payment, { ...transaction, orderId: "ORD-OTHER" });
blocked(order, { ...payment, status: "Pending" });
blocked(order, payment, { ...transaction, amount: 131 });
blocked({ ...order, items: [{ ...order.items[0], name: "Menu Item" }] });
blocked({ ...order, items: [{ ...order.items[0], lineTotal: 100 }] });
assert.equal(ready({ ...order, deliveryFee: 10 }).total, 130);
console.log("Cashier RECEIPT-01 recorded-data scenarios: PASS");
