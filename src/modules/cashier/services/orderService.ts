import {
  DISCOUNT_RATE,
  MAX_POS_ITEM_QUANTITY,
  POS_ITEM_NOTE_MAX_LENGTH,
  POS_TAX_ENABLED,
  POS_TAX_RATE,
} from "../constants";
import { validateMenuModifiers } from "../constants/modifiers";
import type {
  CashierState,
  HeldOrder,
  Order,
  OrderItem,
  OrderOperationalEditInput,
  OrderStatus,
  WalkInOrderInput,
} from "../types";
import {
  addActivity,
  addTimeline,
  cloneState,
  nextEventId,
  nextRecordId,
  requireOpenShift,
  timestampNow,
} from "./serviceUtils";

export function createWalkInOrder(
  current: CashierState,
  input: WalkInOrderInput,
): { state: CashierState; order: Order } {
  const state = cloneState(current);
  const shift = requireOpenShift(state);
  if (!input.items.length) throw new Error("Add at least one menu item.");
  const submittedCustomerName = input.customerName?.trim();
  if (input.type === "Delivery" && !submittedCustomerName)
    throw new Error("Customer name is required for delivery.");
  const customerName = submittedCustomerName || "Walk-in Customer";
  if (customerName.length > 80)
    throw new Error("Customer name must be 80 characters or fewer.");
  const contactNumber = input.contactNumber?.trim();
  const deliveryAddress = input.deliveryAddress?.trim();
  if (input.type === "Delivery" && !contactNumber)
    throw new Error("Contact number is required for delivery.");
  if (input.type === "Delivery" && !deliveryAddress)
    throw new Error("Delivery address is required.");
  if (contactNumber && contactNumber.length > 30)
    throw new Error("Contact number must be 30 characters or fewer.");
  if (deliveryAddress && deliveryAddress.length > 200)
    throw new Error("Delivery address must be 200 characters or fewer.");
  const tableNumber =
    input.type === "Dine-in" ? normalizeTable(input.tableNumber) : undefined;
  if (
    tableNumber &&
    state.orders.some(
      (order) =>
        order.type === "Dine-in" &&
        normalizeTable(order.tableNumber) === tableNumber &&
        !["Completed", "Cancelled"].includes(order.status),
    )
  )
    throw new Error(`Table ${tableNumber} already has an active order.`);
  if (input.discountType && !input.discountReference?.trim())
    throw new Error("ID or reference is required for this discount.");
  const requestedQuantities = new Map<string, number>();
  const validatedItems = input.items.map((entry) => {
    if (
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > MAX_POS_ITEM_QUANTITY
    )
      throw new Error(
        `Item quantities must be whole numbers from 1 to ${MAX_POS_ITEM_QUANTITY}.`,
      );
    const menuItem = state.menuItems.find(
      (item) => item.id === entry.menuItemId,
    );
    if (!menuItem) throw new Error(`${entry.name} is no longer on the menu.`);
    if (!menuItem.available)
      throw new Error(`${menuItem.name} is currently unavailable.`);
    const requestedQuantity =
      (requestedQuantities.get(menuItem.id) ?? 0) + entry.quantity;
    if (requestedQuantity > MAX_POS_ITEM_QUANTITY) {
      throw new Error(
        `Total quantity for ${menuItem.name} cannot exceed ${MAX_POS_ITEM_QUANTITY}.`,
      );
    }
    requestedQuantities.set(menuItem.id, requestedQuantity);
    const modifiers = validateMenuModifiers(menuItem, entry.modifiers);
    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice:
        menuItem.price +
        modifiers.reduce((sum, modifier) => sum + modifier.price, 0),
      quantity: entry.quantity,
      note: entry.note?.trim().slice(0, POS_ITEM_NOTE_MAX_LENGTH) || undefined,
      modifiers: modifiers.length ? modifiers : undefined,
    };
  });
  const subtotal = validatedItems.reduce(
    (sum, entry) => sum + entry.unitPrice * entry.quantity,
    0,
  );
  const discountAmount = input.discountType
    ? Math.round(subtotal * DISCOUNT_RATE * 100) / 100
    : 0;
  const taxAmount = POS_TAX_ENABLED
    ? Math.round((subtotal - discountAmount) * POS_TAX_RATE * 100) / 100
    : 0;
  const total = subtotal - discountAmount + taxAmount;
  if (input.paymentMethod === "Cash" && (input.amountTendered ?? 0) < total)
    throw new Error("Cash tendered is insufficient.");
  if (input.paymentMethod === "GCash" && !input.gcashReference?.trim())
    throw new Error("GCash reference number is required.");
  const gcashReference = input.gcashReference?.trim();
  if (
    input.paymentMethod === "GCash" &&
    state.payments.some(
      (payment) =>
        payment.referenceNumber?.toLowerCase() ===
        gcashReference?.toLowerCase(),
    )
  )
    throw new Error("This GCash reference number has already been used.");
  const timestamp = timestampNow();
  const orderId = nextRecordId("ORD", state.orders);
  const paymentId = nextRecordId("PAY", state.payments);
  const transactionId = nextRecordId("TXN", state.transactions);
  const items: OrderItem[] = validatedItems.map((entry, index) => ({
    ...entry,
    id: `${orderId}-ITEM-${index + 1}`,
  }));
  const order: Order = {
    id: orderId,
    customerName,
    contactNumber: contactNumber || "—",
    deliveryAddress: input.type === "Delivery" ? deliveryAddress : undefined,
    type: input.type,
    tableNumber,
    items,
    subtotal,
    discountType: input.discountType,
    discountReference: input.discountReference?.trim() || undefined,
    discountAmount,
    taxAmount,
    total,
    orderInstructions: input.orderInstructions?.trim() || undefined,
    paymentId,
    transactionId,
    paymentMethod: input.paymentMethod,
    paymentStatus: "Verified",
    status: "Confirmed",
    riderStatus: input.type === "Delivery" ? "Waiting assignment" : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    cashierId: state.cashier.id,
    shiftId: shift.id,
    timeline: [
      {
        id: nextEventId(),
        status: "Confirmed",
        label: `${input.type} payment completed; order sent to kitchen`,
        timestamp,
        actor: state.cashier.name,
      },
    ],
  };
  state.orders.unshift(order);
  state.payments.unshift({
    id: paymentId,
    orderId,
    method: input.paymentMethod,
    amount: total,
    submittedAmount:
      input.paymentMethod === "Cash" ? (input.amountTendered ?? total) : total,
    status: "Verified",
    referenceNumber: gcashReference,
    uploadedAt: timestamp,
    verifiedBy: state.cashier.id,
    verifiedAt: timestamp,
  });
  state.transactions.unshift({
    id: transactionId,
    receiptNumber: transactionId.replace(/^TXN-/, "RCP-"),
    orderId,
    customerName: order.customerName,
    amount: total,
    discountAmount,
    method: input.paymentMethod,
    status: "Completed",
    cashierId: state.cashier.id,
    cashierName: state.cashier.name,
    shiftId: shift.id,
    paymentId,
    createdAt: timestamp,
  });
  state.activities.unshift(
    {
      id: nextEventId(),
      kind: "walkin_created",
      message: `${input.type} order ${orderId} created`,
      orderId,
      transactionId,
      actor: state.cashier.name,
      timestamp,
    },
    {
      id: nextEventId(),
      kind: "transaction_completed",
      message: `${input.paymentMethod} transaction completed for ${orderId}`,
      orderId,
      transactionId,
      actor: state.cashier.name,
      timestamp,
    },
  );
  return { state, order };
}

export function cancelOrder(
  current: CashierState,
  orderId: string,
  reason: string,
): CashierState {
  const state = cloneState(current);
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) throw new Error("Order could not be found.");
  if (
    [
      "Picked Up",
      "Out for Delivery",
      "Delivered",
      "Completed",
      "Cancelled",
    ].includes(order.status)
  )
    throw new Error("This order can no longer be cancelled.");
  const timestamp = timestampNow();
  const assignedRider = state.riders.find(
    (rider) => rider.name === order.assignedRider,
  );
  if (assignedRider?.currentOrderId === order.id) {
    assignedRider.currentOrderId = undefined;
    assignedRider.availability = "Available";
  }
  order.status = "Cancelled";
  order.riderStatus = order.assignedRider
    ? "Assignment released"
    : order.riderStatus;
  order.cancelledBy = state.cashier.id;
  order.cancelledAt = timestamp;
  order.cancellationReason = reason;
  addTimeline(
    order,
    "Cancelled",
    `Order cancelled: ${reason}`,
    state.cashier.name,
    timestamp,
  );
  const transaction = state.transactions.find(
    (entry) => entry.orderId === order.id && entry.status === "Completed",
  );
  if (transaction) {
    transaction.status = "Voided";
    transaction.voidReason = reason;
  }
  addActivity(
    state,
    "order_cancelled",
    `${order.id} cancelled by ${state.cashier.name}`,
    order.id,
  );
  state.notifications.unshift({
    id: nextEventId(),
    title: "Order cancelled",
    message: `${order.id}: ${reason}`,
    createdAt: timestamp,
    read: false,
    customerVisible: true,
    kind: "record_updated",
    page: "order-list",
    intent: { search: order.id },
    orderId: order.id,
  });
  return state;
}

export function updateOrderDetails(
  current: CashierState,
  orderId: string,
  input: OrderOperationalEditInput,
): CashierState {
  const state = cloneState(current);
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) throw new Error("Order could not be found.");
  const customerName = input.customerName.trim();
  const contactNumber = input.contactNumber.trim();
  if (!customerName) throw new Error("Customer name is required.");
  if (customerName.length > 80)
    throw new Error("Customer name must be 80 characters or fewer.");
  if (!contactNumber) throw new Error("Contact number is required.");
  if (contactNumber.length > 30)
    throw new Error("Contact number must be 30 characters or fewer.");

  order.customerName = customerName;
  order.contactNumber = contactNumber;
  order.tableNumber = input.tableNumber?.trim() || undefined;
  order.deliveryAddress = input.deliveryAddress?.trim() || undefined;
  order.orderInstructions = input.orderInstructions?.trim() || undefined;
  const timestamp = timestampNow();
  addTimeline(
    order,
    order.status,
    "Operational order details updated",
    state.cashier.name,
    timestamp,
  );
  state.notifications.unshift({
    id: nextEventId(),
    title: "Order details updated",
    message: `${order.id} customer and fulfillment details were updated.`,
    createdAt: timestamp,
    read: false,
    customerVisible: false,
    kind: "record_updated",
    page: "order-list",
    intent: { search: order.id },
    orderId: order.id,
  });
  return state;
}

export function assignOrderRider(
  current: CashierState,
  orderId: string,
  riderId: string,
): CashierState {
  const state = cloneState(current);
  const order = state.orders.find((entry) => entry.id === orderId);
  const rider = state.riders.find((entry) => entry.id === riderId);
  if (!order) throw new Error("Order could not be found.");
  if (order.type !== "Delivery")
    throw new Error("Riders can only be assigned to delivery orders.");
  if (["Delivered", "Completed", "Cancelled"].includes(order.status))
    throw new Error("This order no longer accepts rider assignments.");
  if (!rider) throw new Error("Select a valid rider.");
  if (rider.currentOrderId && rider.currentOrderId !== order.id)
    throw new Error(`${rider.name} is already assigned to another order.`);

  const previousRider = state.riders.find(
    (entry) => entry.name === order.assignedRider,
  );
  if (previousRider && previousRider.id !== rider.id) {
    previousRider.currentOrderId = undefined;
    previousRider.availability = "Available";
  }
  rider.currentOrderId = order.id;
  rider.availability = "Assigned";
  order.assignedRider = rider.name;
  order.riderStatus = "Assigned";
  const timestamp = timestampNow();
  addTimeline(
    order,
    order.status,
    `${rider.name} assigned for delivery`,
    state.cashier.name,
    timestamp,
  );
  addActivity(
    state,
    "rider_accepted",
    `${rider.name} assigned to ${order.id}`,
    order.id,
    undefined,
    state.cashier.name,
  );
  state.notifications.unshift({
    id: nextEventId(),
    title: "Rider assigned",
    message: `${rider.name} was assigned to ${order.id}.`,
    createdAt: timestamp,
    read: false,
    customerVisible: true,
    kind: "record_updated",
    page: "order-list",
    intent: { search: order.id },
    orderId: order.id,
  });
  return state;
}

export function duplicateOrder(
  current: CashierState,
  orderId: string,
): { state: CashierState; order: Order } {
  const state = cloneState(current);
  const shift = requireOpenShift(state);
  const source = state.orders.find((entry) => entry.id === orderId);
  if (!source) throw new Error("Order could not be found.");
  const timestamp = timestampNow();
  const duplicatedId = nextRecordId("ORD", state.orders);
  const order: Order = {
    ...source,
    id: duplicatedId,
    items: source.items.map((item, index) => ({
      ...item,
      id: `${duplicatedId}-ITEM-${index + 1}`,
    })),
    paymentId: undefined,
    transactionId: undefined,
    paymentStatus: "Pending",
    status: "Awaiting Payment",
    assignedRider: undefined,
    riderStatus: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    cashierId: state.cashier.id,
    shiftId: shift.id,
    cancelledBy: undefined,
    cancelledAt: undefined,
    cancellationReason: undefined,
    timeline: [
      {
        id: nextEventId(),
        status: "Awaiting Payment",
        label: `Order duplicated from ${source.id}; awaiting payment`,
        timestamp,
        actor: state.cashier.name,
      },
    ],
  };
  state.orders.unshift(order);
  addActivity(
    state,
    "walkin_created",
    `${state.cashier.name} duplicated ${source.id} as ${duplicatedId}`,
    duplicatedId,
  );
  state.notifications.unshift({
    id: nextEventId(),
    title: "Order duplicated",
    message: `${duplicatedId} was created from ${source.id} and requires payment.`,
    createdAt: timestamp,
    read: false,
    customerVisible: false,
    kind: "record_updated",
    page: "order-list",
    intent: { search: duplicatedId },
    orderId: duplicatedId,
  });
  return { state, order };
}

export function releaseReadyOrder(
  current: CashierState,
  orderId: string,
): CashierState {
  const state = cloneState(current);
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order || order.status !== "Ready")
    throw new Error("Only ready orders can be released.");
  order.status = order.type === "Delivery" ? "Waiting for Rider" : "Completed";
  addTimeline(
    order,
    order.status,
    order.type === "Delivery"
      ? "Released to rider queue"
      : "Released to customer",
    state.cashier.name,
  );
  addActivity(
    state,
    "transaction_completed",
    `${order.id} released by ${state.cashier.name}`,
    order.id,
  );
  if (
    order.type === "Delivery" &&
    !state.riders.some((rider) => rider.availability === "Available")
  ) {
    state.notifications.unshift({
      id: nextEventId(),
      title: "No rider available",
      message: `${order.id} is ready but no rider is currently available.`,
      createdAt: timestampNow(),
      read: false,
      kind: "no_rider",
      page: "order-list",
      intent: { statuses: ["Waiting for Rider"], search: order.id },
      orderId: order.id,
    });
  }
  return state;
}

export function updateKitchenStatus(
  current: CashierState,
  orderId: string,
  status: Extract<OrderStatus, "Preparing" | "Ready">,
): CashierState {
  const state = cloneState(current);
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) throw new Error("Kitchen order could not be found.");
  const valid =
    (order.status === "Confirmed" && status === "Preparing") ||
    (order.status === "Preparing" && status === "Ready");
  if (!valid) throw new Error("This kitchen ticket has already advanced.");
  order.status = status;
  addTimeline(
    order,
    status,
    status === "Ready"
      ? "Kitchen marked order ready"
      : "Kitchen started preparation",
    "Kitchen Staff",
  );
  if (status === "Ready") {
    state.notifications.unshift({
      id: nextEventId(),
      title: "Order ready",
      message: `${order.id} is ready for cashier handoff.`,
      createdAt: timestampNow(),
      read: false,
      kind: "kitchen_ready",
      page: "order-list",
      intent: { statuses: ["Ready"], search: order.id },
      orderId: order.id,
    });
    addActivity(
      state,
      "kitchen_ready",
      `Kitchen marked ${order.id} ready`,
      order.id,
    );
  }
  return state;
}

export function recordReceiptReprint(
  current: CashierState,
  orderId: string,
): CashierState {
  const state = cloneState(current);
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order?.transactionId)
    throw new Error(
      "A completed transaction is required to reprint a receipt.",
    );
  addActivity(
    state,
    "receipt_reprinted",
    `Receipt reprinted for ${order.id}`,
    order.id,
    order.transactionId,
  );
  return state;
}

export function holdOrder(
  current: CashierState,
  held: Omit<HeldOrder, "id" | "heldAt">,
): { state: CashierState; held: HeldOrder } {
  const state = cloneState(current);
  const record: HeldOrder = {
    ...held,
    id: nextRecordId("HOLD", state.heldOrders),
    heldAt: timestampNow(),
  };
  state.heldOrders.unshift(record);
  return { state, held: record };
}

export function removeHeldOrder(
  current: CashierState,
  heldId: string,
): CashierState {
  const state = cloneState(current);
  state.heldOrders = state.heldOrders.filter((entry) => entry.id !== heldId);
  return state;
}

export function voidDraftOrder(
  current: CashierState,
  input: Omit<WalkInOrderInput, "paymentMethod">,
  reason: string,
): CashierState {
  const state = cloneState(current);
  const shift = requireOpenShift(state);
  if (!input.items.length) throw new Error("There is no active order to void.");
  const timestamp = timestampNow();
  const orderId = nextRecordId("ORD", state.orders);
  const subtotal = input.items.reduce(
    (sum, entry) => sum + entry.unitPrice * entry.quantity,
    0,
  );
  const discountAmount = input.discountType
    ? Math.round(subtotal * DISCOUNT_RATE * 100) / 100
    : 0;
  const taxAmount = POS_TAX_ENABLED
    ? Math.round((subtotal - discountAmount) * POS_TAX_RATE * 100) / 100
    : 0;
  const customerName = input.customerName?.trim() || "Walk-in Customer";
  const items = input.items.map((entry, index) => ({
    ...entry,
    id: `${orderId}-ITEM-${index + 1}`,
  }));
  state.orders.unshift({
    id: orderId,
    customerName,
    contactNumber: input.contactNumber?.trim() || "—",
    deliveryAddress:
      input.type === "Delivery"
        ? input.deliveryAddress?.trim() || undefined
        : undefined,
    type: input.type,
    tableNumber: input.tableNumber,
    items,
    subtotal,
    discountType: input.discountType,
    discountReference: input.discountReference,
    discountAmount,
    taxAmount,
    total: subtotal - discountAmount + taxAmount,
    orderInstructions: input.orderInstructions,
    paymentMethod: "Cash",
    paymentStatus: "Rejected",
    status: "Cancelled",
    createdAt: timestamp,
    updatedAt: timestamp,
    cashierId: state.cashier.id,
    shiftId: shift.id,
    cancelledBy: state.cashier.id,
    cancelledAt: timestamp,
    cancellationReason: reason,
    timeline: [
      {
        id: nextEventId(),
        status: "Cancelled",
        label: `Draft order voided: ${reason}`,
        timestamp,
        actor: state.cashier.name,
      },
    ],
  });
  const paymentId = nextRecordId("PAY", state.payments);
  state.payments.unshift({
    id: paymentId,
    orderId,
    method: "Cash",
    amount: 0,
    submittedAmount: 0,
    status: "Rejected",
    uploadedAt: timestamp,
    rejectedBy: state.cashier.id,
    rejectedAt: timestamp,
    rejectionReason: reason,
  });
  const transactionId = nextRecordId("TXN", state.transactions);
  state.transactions.unshift({
    id: transactionId,
    receiptNumber: transactionId.replace(/^TXN-/, "RCP-"),
    orderId,
    customerName,
    amount: subtotal - discountAmount + taxAmount,
    discountAmount,
    method: "Cash",
    status: "Voided",
    cashierId: state.cashier.id,
    cashierName: state.cashier.name,
    shiftId: shift.id,
    paymentId,
    createdAt: timestamp,
    voidReason: reason,
  });
  addActivity(
    state,
    "order_cancelled",
    `${orderId} voided by ${state.cashier.name}`,
    orderId,
  );
  return state;
}

function normalizeTable(tableNumber?: string) {
  const value = tableNumber?.trim();
  if (!value) return undefined;
  return value.replace(/^0+(?=\d)/, "");
}
