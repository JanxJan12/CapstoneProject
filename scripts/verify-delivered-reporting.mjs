import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260921010000_harmonize_delivered_order_reporting.sql",
    import.meta.url,
  ),
  "utf8",
);
const baselineSchema = readFileSync(
  new URL(
    "../supabase/migrations/20260825183637_remote_schema.sql",
    import.meta.url,
  ),
  "utf8",
);

function latestDeliveredAt(assignments) {
  return assignments
    .filter(
      (assignment) =>
        assignment.status === "delivered" && assignment.deliveredAt,
    )
    .map((assignment) => assignment.deliveredAt)
    .sort()
    .at(-1);
}

function effectiveCompletionAt(order) {
  if (
    order.fulfillmentType === "delivery" &&
    order.currentStatus === "delivered"
  ) {
    return latestDeliveredAt(order.assignments ?? []) ?? null;
  }

  if (
    order.fulfillmentType !== "delivery" &&
    order.currentStatus === "completed"
  ) {
    return order.completedAt ?? null;
  }

  return null;
}

function manilaDate(timestamp) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function summarize(orders, startDate, endDate) {
  const fulfilled = orders.flatMap((order) => {
    const completedAt = effectiveCompletionAt(order);

    if (!completedAt) return [];

    const completionDate = manilaDate(completedAt);
    if (completionDate < startDate || completionDate > endDate) return [];

    return [{ ...order, completionDate }];
  });
  const verified = fulfilled.filter(
    (order) => order.paymentStatus === "verified",
  );

  return {
    fulfilledCount: fulfilled.length,
    revenue: verified.reduce((sum, order) => sum + order.paymentAmount, 0),
    dailyRevenue: verified.reduce((totals, order) => {
      totals[order.completionDate] =
        (totals[order.completionDate] ?? 0) + order.paymentAmount;
      return totals;
    }, {}),
  };
}

const pickup = {
  id: "pickup",
  fulfillmentType: "takeout",
  currentStatus: "completed",
  completedAt: "2026-09-21T01:00:00.000Z",
  paymentStatus: "verified",
  paymentAmount: 120,
};
const crossDateDelivery = {
  id: "cross-date",
  fulfillmentType: "delivery",
  currentStatus: "delivered",
  createdAt: "2026-09-20T15:55:00.000Z",
  completedAt: null,
  assignments: [
    {
      status: "delivered",
      deliveredAt: "2026-09-20T16:15:00.000Z",
    },
  ],
  paymentStatus: "verified",
  paymentAmount: 300,
};
const historicalDelivery = {
  id: "historical",
  fulfillmentType: "delivery",
  currentStatus: "delivered",
  completedAt: null,
  assignments: [
    {
      status: "delivered",
      deliveredAt: "2026-09-21T03:00:00.000Z",
    },
  ],
  paymentStatus: "verified",
  paymentAmount: 180,
};
const activeDelivery = {
  id: "active",
  fulfillmentType: "delivery",
  currentStatus: "out_for_delivery",
  assignments: [{ status: "out_for_delivery", deliveredAt: null }],
  paymentStatus: "verified",
  paymentAmount: 500,
};
const readyDelivery = {
  id: "ready",
  fulfillmentType: "delivery",
  currentStatus: "waiting_for_rider",
  assignments: [],
  paymentStatus: "verified",
  paymentAmount: 450,
};
const duplicateCandidate = {
  id: "duplicate-candidate",
  fulfillmentType: "delivery",
  currentStatus: "delivered",
  completedAt: "2026-09-20T14:00:00.000Z",
  assignments: [
    { status: "delivered", deliveredAt: "2026-09-21T02:00:00.000Z" },
    { status: "delivered", deliveredAt: "2026-09-21T02:05:00.000Z" },
  ],
  paymentStatus: "verified",
  paymentAmount: 200,
};

const checks = [
  [
    "1. non-delivery completion keeps completed_at",
    () => assert.equal(effectiveCompletionAt(pickup), pickup.completedAt),
  ],
  [
    "2. terminal delivery is included",
    () =>
      assert.equal(
        summarize([crossDateDelivery], "2026-09-21", "2026-09-21")
          .fulfilledCount,
        1,
      ),
  ],
  [
    "3. delivery completion uses delivered_at",
    () =>
      assert.equal(
        effectiveCompletionAt(crossDateDelivery),
        crossDateDelivery.assignments[0].deliveredAt,
      ),
  ],
  [
    "4. cross-date delivery belongs to its Manila fulfillment date",
    () => {
      assert.equal(manilaDate(crossDateDelivery.createdAt), "2026-09-20");
      assert.equal(
        manilaDate(effectiveCompletionAt(crossDateDelivery)),
        "2026-09-21",
      );
    },
  ],
  [
    "5. historical delivered order does not need orders.completed_at",
    () => assert.ok(effectiveCompletionAt(historicalDelivery)),
  ],
  [
    "6. active delivery is excluded even when payment is verified",
    () =>
      assert.deepEqual(
        summarize([activeDelivery], "2026-09-21", "2026-09-21"),
        { fulfilledCount: 0, revenue: 0, dailyRevenue: {} },
      ),
  ],
  [
    "7. ready or waiting delivery is excluded",
    () => assert.equal(effectiveCompletionAt(readyDelivery), null),
  ],
  [
    "8. POD and Rider completion authority remain unchanged",
    () => {
      assert.match(baselineSchema, /Proof of delivery is required\./);
      assert.match(
        baselineSchema,
        /proof_of_delivery_path\s*=\s*\n\s*v_proof_path/,
      );
      assert.doesNotMatch(migration, /complete_rider_delivery/);
    },
  ],
  [
    "9. completed non-delivery remains reportable",
    () =>
      assert.equal(
        summarize([pickup], "2026-09-21", "2026-09-21").fulfilledCount,
        1,
      ),
  ],
  [
    "10. dashboard/report totals include each intended fulfillment",
    () => {
      const result = summarize(
        [pickup, crossDateDelivery, historicalDelivery, activeDelivery],
        "2026-09-21",
        "2026-09-21",
      );
      assert.equal(result.fulfilledCount, 3);
      assert.equal(result.revenue, 600);
    },
  ],
  [
    "11. delivery cannot be counted again through completed_at or assignments",
    () => {
      assert.equal(
        effectiveCompletionAt(duplicateCandidate),
        "2026-09-21T02:05:00.000Z",
      );
      assert.equal(
        summarize([duplicateCandidate], "2026-09-21", "2026-09-21")
          .fulfilledCount,
        1,
      );
      assert.match(migration, /select max\(assignment\.delivered_at\)/);
    },
  ],
  [
    "12. inclusive report dates use the effective fulfillment timestamp",
    () => {
      assert.equal(
        summarize([crossDateDelivery], "2026-09-20", "2026-09-20")
          .fulfilledCount,
        0,
      );
      assert.equal(
        summarize([crossDateDelivery], "2026-09-21", "2026-09-21")
          .fulfilledCount,
        1,
      );
    },
  ],
];

assert.doesNotMatch(migration, /\b(create|alter)\s+table\b/i);
assert.doesNotMatch(migration, /\b(add|drop)\s+column\b/i);
assert.doesNotMatch(migration, /set\s+completed_at\s*=/i);
assert.match(migration, /payment\.status = 'verified'/);
assert.match(migration, /at time zone 'Asia\/Manila'/);

for (const [label, check] of checks) {
  check();
  console.log(`PASS ${label}`);
}
