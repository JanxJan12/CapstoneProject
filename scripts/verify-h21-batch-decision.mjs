import assert from "node:assert/strict";
import { batchDecision } from "../src/modules/manager/inventory/batchDecision.ts";

const stock = {
  batchConsumptionEnabled: true,
  isActive: true,
  usableQuantity: 6,
  expiryRequired: true,
  rotationPolicy: "fefo",
};
const batch = (
  id,
  status = "current",
  useByDate = "2026-10-20",
  quantityOnHand = 2,
) => ({
  id,
  batchCode: id,
  status,
  useByDate,
  quantityOnHand,
  receivedAt: "2026-10-01T00:00:00Z",
});
const detail = (batches, changes = {}) => ({
  stock: { ...stock, ...changes },
  batches,
});

// The input order is the server's allocation order. Exclusions may precede
// the next eligible row in the read RPC's physical-batch list.
const mixed = batchDecision(
  detail(
    [
      batch("expired", "expired", "2026-10-01"),
      batch("unknown", "current", null),
      batch("first"),
      batch("second", "current", "2026-10-21"),
    ],
    { usableQuantity: 4 },
  ),
);
assert.equal(mixed.next?.id, "first");
assert.deepEqual(
  mixed.otherEligible.map((row) => row.id),
  ["second"],
);
assert.deepEqual(
  mixed.unavailable.map((row) => row.reason),
  ["expired", "missing-use-by"],
);

assert.equal(
  batchDecision(detail([batch("zero", "current", "2026-10-20", 0)])).next,
  null,
);
assert.equal(batchDecision(detail([])).next, null);
assert.equal(
  batchDecision(detail([batch("first")], { usableQuantity: 0 })).next,
  null,
);
assert.equal(
  batchDecision(detail([batch("first")], { isActive: false })).next,
  null,
);
assert.equal(
  batchDecision(detail([batch("first")], { batchConsumptionEnabled: false }))
    .next,
  null,
);
assert.equal(
  batchDecision(
    detail([batch("undated", "current", null)], {
      expiryRequired: false,
      rotationPolicy: "fifo",
      usableQuantity: 2,
    }),
  ).next?.id,
  "undated",
);
assert.equal(
  batchDecision(detail([batch("first")], { usableQuantity: 3 })).next,
  null,
);

console.log("H-21 batch decision: 10 focused assertions passed.");
