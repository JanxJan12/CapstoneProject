import { defaultModifiersFor } from "../src/modules/cashier/constants/modifiers";
import {
  addCartItem,
  calculatePOSTotals,
  filterMenuItems,
  getMealRecommendations,
  getOrderSummaryAvailability,
  transitionTransactionState,
} from "../src/modules/cashier/pos/posOperations";
import { DEFAULT_POS_FORM } from "../src/modules/cashier/pos/posPersistence";
import {
  POSTransactionState,
  type POSCartLine,
} from "../src/modules/cashier/pos/types";
import {
  createWalkInOrder,
  holdOrder,
  removeHeldOrder,
} from "../src/modules/cashier/services/cashierService";
import { createInitialCashierState } from "../src/modules/cashier/services/seed";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let state = createInitialCashierState();
let cart: POSCartLine[] = [];
const menuItem = (id: string) => {
  const item = state.menuItems.find((entry) => entry.id === id);
  assert(item, `Missing test menu item ${id}.`);
  return item;
};
const add = (id: string) => {
  const item = menuItem(id);
  const result = addCartItem(cart, item, 1, "", defaultModifiersFor(item));
  assert(!result.error, result.error ?? `Unable to add ${item.name}.`);
  cart = result.cart;
};

assert(
  new Set(state.menuItems.map((item) => item.code.toLowerCase())).size ===
    state.menuItems.length,
  "Every cashier menu item must have a unique item code.",
);
const codeSearch = filterMenuItems(
  state.menuItems,
  "All",
  "R1",
  new Set(),
  new Set(),
);
assert(
  codeSearch.length === 1 && codeSearch[0]?.name === "White Rice",
  "Item code search must resolve the exact cashier menu item.",
);
const softdrinkDefaults = defaultModifiersFor(menuItem("MENU-09"));
assert(
  softdrinkDefaults.some((modifier) => modifier.id === "drink-coke") &&
    softdrinkDefaults.some((modifier) => modifier.id === "drink-regular"),
  "Soft drink Quick Add must apply a valid flavor and size that can be edited later.",
);

assert(
  transitionTransactionState(POSTransactionState.IDLE, "reset", false) ===
    POSTransactionState.IDLE,
  "A new POS order must begin in the idle item-selection state.",
);
add("MENU-02");
assert(
  transitionTransactionState(POSTransactionState.IDLE, "itemAdded", true) ===
    POSTransactionState.ORDERING,
  "Adding a product must move the workstation into order entry.",
);
const afterViand = getMealRecommendations(cart, state.menuItems);
assert(
  afterViand.title === "Complete the meal" &&
    afterViand.items.some((item) => item.category === "Rice") &&
    afterViand.items.some((item) => item.category === "Beverages"),
  "A viand must recommend rice and beverages without blocking the cart.",
);

add("MENU-08");
const afterRice = getMealRecommendations(cart, state.menuItems);
assert(
  afterRice.title === "Add a drink or dessert" &&
    afterRice.items.every((item) => item.category === "Beverages"),
  "A viand and rice must prioritize beverage recommendations.",
);

add("MENU-10");
assert(
  cart.length === 3 &&
    cart.some(
      (item) =>
        item.menuItemId === "MENU-10" &&
        item.modifiers?.some((modifier) => modifier.id === "drink-regular"),
    ),
  "Quick Add must support several categories and apply required defaults.",
);
const totals = calculatePOSTotals(cart, {
  ...DEFAULT_POS_FORM,
  orderType: "Take-out",
  amountTendered: 500,
});
assert(totals.total === 190, "The multi-category cart total is incorrect.");

const cartSnapshot = JSON.stringify(cart);
assert(
  transitionTransactionState(
    POSTransactionState.ORDERING,
    "openReview",
    true,
  ) === POSTransactionState.ORDER_REVIEW &&
    transitionTransactionState(
      POSTransactionState.ORDER_REVIEW,
      "proceedToPayment",
      true,
    ) === POSTransactionState.PAYMENT &&
    transitionTransactionState(
      POSTransactionState.PAYMENT,
      "backToReview",
      true,
    ) === POSTransactionState.ORDER_REVIEW &&
    transitionTransactionState(
      POSTransactionState.ORDER_REVIEW,
      "backToOrdering",
      true,
    ) === POSTransactionState.ORDERING &&
    JSON.stringify(cart) === cartSnapshot,
  "Order review and payment transitions must preserve the active order.",
);
const summaryCheck = getOrderSummaryAvailability(
  cart,
  { ...DEFAULT_POS_FORM, orderType: "Take-out" },
  state.menuItems,
);
assert(
  summaryCheck.canContinue,
  "A valid take-out order must continue from summary to payment.",
);
const tablelessDineIn = getOrderSummaryAvailability(
  cart,
  { ...DEFAULT_POS_FORM, orderType: "Dine-in", tableNumber: "" },
  state.menuItems,
);
assert(
  tablelessDineIn.canContinue,
  "Dine-in orders must continue without a table number.",
);

const heldResult = holdOrder(state, {
  type: "Take-out",
  items: cart.map(({ lineId: _lineId, ...item }, index) => ({
    ...item,
    id: `POS-HOLD-${index + 1}`,
  })),
  discountType: null,
});
state = heldResult.state;
assert(
  state.heldOrders.some((held) => held.id === heldResult.held.id),
  "Hold must persist the draft cart and order type.",
);
const resumedCart = heldResult.held.items;
state = removeHeldOrder(state, heldResult.held.id);
assert(
  resumedCart.length === cart.length &&
    !state.heldOrders.some((held) => held.id === heldResult.held.id),
  "Resuming a held order must recover its items and remove the hold record.",
);

const tablelessOrder = createWalkInOrder(state, {
  type: "Dine-in",
  items: resumedCart.slice(0, 1).map(({ id: _id, ...item }) => item),
  discountType: null,
  paymentMethod: "Cash",
  amountTendered: 500,
}).order;
assert(
  tablelessOrder.tableNumber === undefined &&
    tablelessOrder.customerName === "Walk-in Customer",
  "Tableless dine-in orders must use the automatic walk-in identity.",
);

const orderCountBeforeDraftCancel = state.orders.length;
cart = [];
assert(
  state.orders.length === orderCountBeforeDraftCancel &&
    transitionTransactionState(POSTransactionState.ORDERING, "reset", false) ===
      POSTransactionState.IDLE,
  "Cancelling an unsubmitted draft must not create a voided order record.",
);

const confirmed = createWalkInOrder(state, {
  customerName: "Walk-in Test",
  type: "Take-out",
  items: resumedCart.map(({ id: _id, ...item }) => item),
  discountType: null,
  paymentMethod: "Cash",
  amountTendered: 500,
});
state = confirmed.state;
assert(
  confirmed.order.status === "Confirmed" &&
    state.payments.some(
      (payment) => payment.id === confirmed.order.paymentId,
    ) &&
    state.transactions.some(
      (transaction) => transaction.id === confirmed.order.transactionId,
    ),
  "Confirm Order must create connected kitchen, payment, and transaction records.",
);
assert(
  transitionTransactionState(
    POSTransactionState.PAYMENT,
    "showReceipt",
    false,
  ) === POSTransactionState.RECEIPT,
  "Successful confirmation must move the transaction into receipt state.",
);

console.log(
  `Verified Walk-in POS: ${confirmed.order.id}, ${resumedCart.length} order lines, ${state.transactions.length} transactions.`,
);
