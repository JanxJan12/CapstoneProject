import { createInitialCashierState } from "../src/modules/cashier/services/seed";
import {
  calculateShiftTotals,
  cancelOrder,
  createWalkInOrder,
  endShift,
  holdOrder,
  rejectOnlinePayment,
  releaseReadyOrder,
  removeHeldOrder,
  startShift,
  updateKitchenStatus,
  verifyOnlinePayment,
  voidDraftOrder,
} from "../src/modules/cashier/services/cashierService";
import type {
  CashierState,
  WalkInOrderInput,
} from "../src/modules/cashier/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectFailure(run: () => unknown, message: string) {
  let failed = false;
  try {
    run();
  } catch {
    failed = true;
  }
  assert(failed, message);
}

let state: CashierState = createInitialCashierState();
const initialTransactionCount = state.transactions.length;

state = verifyOnlinePayment(state, "ORD-2044", false);
assert(
  state.orders.find((order) => order.id === "ORD-2044")?.status === "Confirmed",
  "Verification must confirm the order.",
);
assert(
  state.payments.find((payment) => payment.orderId === "ORD-2044")?.status ===
    "Verified",
  "Verification must update the payment.",
);
assert(
  state.transactions.length === initialTransactionCount + 1,
  "Verification must create one transaction.",
);
state = updateKitchenStatus(state, "ORD-2044", "Preparing");
state = updateKitchenStatus(state, "ORD-2044", "Ready");
assert(
  state.orders.find((order) => order.id === "ORD-2044")?.status === "Ready",
  "Kitchen status changes must update the shared cashier order.",
);
assert(
  state.activities.some(
    (activity) =>
      activity.kind === "kitchen_ready" && activity.orderId === "ORD-2044",
  ),
  "Kitchen-ready events must flow back to cashier activity.",
);
expectFailure(
  () => verifyOnlinePayment(state, "ORD-2044", false),
  "Duplicate verification must be blocked.",
);
expectFailure(
  () => verifyOnlinePayment(state, "ORD-2043", false),
  "Mismatched payments must require an override.",
);
state = verifyOnlinePayment(state, "ORD-2043", true);
assert(
  state.payments.find((payment) => payment.orderId === "ORD-2043")
    ?.overrideMismatch,
  "Amount override must be recorded.",
);

const beforeRejectionTransactions = state.transactions.length;
state = rejectOnlinePayment(
  state,
  "ORD-2042",
  "Unreadable proof",
  "Customer should upload a clearer screenshot.",
);
assert(
  state.payments.find((payment) => payment.orderId === "ORD-2042")?.status ===
    "Rejected",
  "Rejection must update the payment.",
);
assert(
  state.orders.find((order) => order.id === "ORD-2042")?.status ===
    "Awaiting Payment",
  "Rejected orders must stay out of the kitchen.",
);
assert(
  state.transactions.length === beforeRejectionTransactions,
  "Rejection must not create a transaction.",
);

const walkInInput: WalkInOrderInput = {
  customerName: "Jamie Cruz",
  type: "Dine-in",
  tableNumber: "6",
  items: [
    {
      menuItemId: "MENU-02",
      name: "Tampered item name",
      unitPrice: 1,
      quantity: 2,
    },
    { menuItemId: "MENU-08", name: "White Rice", unitPrice: 35, quantity: 2 },
  ],
  discountType: "Senior Citizen",
  discountReference: "SC-10028",
  orderInstructions: "Serve rice first.",
  paymentMethod: "Cash",
  amountTendered: 500,
};
const created = createWalkInOrder(state, walkInInput);
state = created.state;
const walkIn = created.order;
assert(
  walkIn.status === "Confirmed",
  "Walk-in orders must enter the kitchen as confirmed.",
);
assert(
  Boolean(walkIn.paymentId && walkIn.transactionId),
  "Walk-in orders must link payment and transaction records.",
);
assert(
  walkIn.customerName === "Jamie Cruz",
  "Walk-in customer identity must be saved.",
);
assert(
  walkIn.items[0].name === "Adobong Manok" &&
    walkIn.items[0].unitPrice === 120 &&
    walkIn.total === 248,
  "Menu names, prices, and totals must be calculated from authoritative state.",
);
assert(
  state.payments.some((payment) => payment.id === walkIn.paymentId),
  "Walk-in payment record is missing.",
);
assert(
  state.transactions.some(
    (transaction) => transaction.id === walkIn.transactionId,
  ),
  "Walk-in transaction record is missing.",
);
expectFailure(
  () => createWalkInOrder(state, walkInInput),
  "An occupied dine-in table must reject a second active order.",
);
expectFailure(
  () =>
    createWalkInOrder(state, {
      type: "Take-out",
      items: [
        {
          menuItemId: "MENU-04",
          name: "Bicol Express",
          unitPrice: 130,
          quantity: 1,
        },
      ],
      discountType: null,
      paymentMethod: "Cash",
      amountTendered: 500,
    }),
  "Unavailable menu items must be rejected during confirmation.",
);
expectFailure(
  () =>
    createWalkInOrder(state, {
      type: "Take-out",
      items: [
        {
          menuItemId: "MENU-10",
          name: "Buko Juice",
          unitPrice: 35,
          quantity: 1,
        },
      ],
      discountType: null,
      paymentMethod: "GCash",
      gcashReference: "GC-882010",
    }),
  "A reused GCash reference must be rejected.",
);

state = cancelOrder(
  state,
  walkIn.id,
  "Customer changed the order before preparation.",
);
assert(
  state.orders.find((order) => order.id === walkIn.id)?.status === "Cancelled",
  "Cancellation must update the order.",
);
assert(
  state.transactions.find((transaction) => transaction.orderId === walkIn.id)
    ?.status === "Voided",
  "Cancellation must void the related transaction.",
);

state = releaseReadyOrder(state, "ORD-2046");
assert(
  state.orders.find((order) => order.id === "ORD-2046")?.status === "Completed",
  "Ready take-out orders must complete on release.",
);

const heldResult = holdOrder(state, {
  type: "Take-out",
  items: [
    {
      id: "HELD-1",
      menuItemId: "MENU-06",
      name: "Pinakbet",
      unitPrice: 110,
      quantity: 1,
    },
  ],
  discountType: null,
});
state = heldResult.state;
assert(
  state.heldOrders.some((held) => held.id === heldResult.held.id),
  "Held cart must be persisted.",
);
state = removeHeldOrder(state, heldResult.held.id);
assert(
  !state.heldOrders.length,
  "Reopened held cart must be removed from holds.",
);

state = voidDraftOrder(
  state,
  {
    type: "Take-out",
    items: [
      { menuItemId: "MENU-10", name: "Buko Juice", unitPrice: 35, quantity: 2 },
    ],
    discountType: null,
  },
  "Duplicate counter entry.",
);
assert(
  state.orders[0].status === "Cancelled" &&
    state.transactions[0].status === "Voided",
  "Draft void must preserve cancelled and voided records.",
);

const activeShift = state.shifts.find((shift) => shift.status === "Open");
assert(activeShift, "An active shift is required for settlement verification.");
const totals = calculateShiftTotals(state, activeShift.id);
state = endShift(state, totals.expectedCash);
assert(
  !state.shifts.some((shift) => shift.status === "Open"),
  "End shift must close the active shift.",
);
expectFailure(
  () => createWalkInOrder(state, walkInInput),
  "New transactions must be blocked after shift closure.",
);
state = startShift(state, 3500, "Counter Terminal 02");
assert(
  state.shifts.some((shift) => shift.status === "Open"),
  "A new shift must allow cashier operations to resume.",
);

console.log(
  `Verified cashier workflows: ${state.orders.length} orders, ${state.payments.length} payments, ${state.transactions.length} transactions, ${state.shifts.length} shifts.`,
);
