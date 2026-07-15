import {
  CASH_TENDER_ROUNDING_STEPS,
  DISCOUNT_RATE,
  MAX_POS_ITEM_QUANTITY,
  POS_PRODUCT_HISTORY_LIMIT,
  POS_TAX_ENABLED,
  POS_TAX_RATE,
} from "../constants";
import type { POSForm } from "../schemas";
import type { MenuItem, Order, OrderItemModifier } from "../types";
import { createLineId } from "./posPersistence";
import type { POSCartLine } from "./types";

export interface CartUpdateResult {
  cart: POSCartLine[];
  error?: string;
  warning?: { title: string; description: string };
}

export interface CashTenderSuggestion {
  label: string;
  amount: number;
}

export function getCashTenderSuggestions(
  total: number,
): CashTenderSuggestion[] {
  return [
    { label: "Exact", amount: total },
    ...CASH_TENDER_ROUNDING_STEPS.map((step) => {
      const rounded = Math.ceil(total / step) * step;
      return {
        label: `Next ₱${step}`,
        amount: rounded > total ? rounded : rounded + step,
      };
    }),
  ];
}

export function filterMenuItems(
  items: MenuItem[],
  category: string,
  search: string,
  recentIds: ReadonlySet<string>,
  bestSellerIds: ReadonlySet<string>,
  favoriteIds: ReadonlySet<string>,
) {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const inView =
      category === "All" ||
      item.category === category ||
      (category === "Recently ordered" && recentIds.has(item.id)) ||
      (category === "Best sellers" && bestSellerIds.has(item.id)) ||
      (category === "Favorites" && favoriteIds.has(item.id));
    if (!inView) return false;
    const searchable = [
      item.name,
      item.category,
      item.description,
      ...(item.aliases ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function getOccupiedTables(orders: Order[]) {
  return orders
    .filter(
      (order) =>
        order.type === "Dine-in" &&
        order.tableNumber &&
        !["Completed", "Cancelled"].includes(order.status),
    )
    .map((order) => String(Number(order.tableNumber)));
}

export function getProductHistory(orders: Order[]) {
  const recent = new Set<string>();
  const quantities = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      if (recent.size < POS_PRODUCT_HISTORY_LIMIT) recent.add(item.menuItemId);
      if (order.status !== "Cancelled") {
        quantities.set(
          item.menuItemId,
          (quantities.get(item.menuItemId) ?? 0) + item.quantity,
        );
      }
    }
  }
  return {
    recentIds: [...recent].slice(0, POS_PRODUCT_HISTORY_LIMIT),
    bestSellerIds: [...quantities.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, POS_PRODUCT_HISTORY_LIMIT)
      .map(([id]) => id),
  };
}

export function getNextOrderNumber(orders: Order[]) {
  const maximum = orders.reduce((current, order) => {
    const parsed = Number(order.id.match(/(\d+)$/)?.[1] ?? 0);
    return Math.max(current, parsed);
  }, 0);
  return `ORD-${maximum + 1}`;
}

export function calculatePOSTotals(cart: POSCartLine[], form: POSForm) {
  const subtotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const discountAmount =
    form.discountType === "None"
      ? 0
      : Math.round(subtotal * DISCOUNT_RATE * 100) / 100;
  const taxAmount = POS_TAX_ENABLED
    ? Math.round((subtotal - discountAmount) * POS_TAX_RATE * 100) / 100
    : 0;
  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: subtotal - discountAmount + taxAmount,
    tendered: Number(form.amountTendered ?? 0),
  };
}

export function getInventoryIssue(cart: POSCartLine[], menuItems: MenuItem[]) {
  const requested = new Map<string, number>();
  for (const entry of cart) {
    requested.set(
      entry.menuItemId,
      (requested.get(entry.menuItemId) ?? 0) + entry.quantity,
    );
  }
  for (const [menuItemId, quantity] of requested) {
    const item = menuItems.find((entry) => entry.id === menuItemId);
    if (
      item?.inventoryRemaining !== undefined &&
      quantity > item.inventoryRemaining
    ) {
      return `Only ${item.inventoryRemaining} ${item.name} remaining.`;
    }
  }
  return undefined;
}

export function getPlaceOrderAvailability(
  cart: POSCartLine[],
  form: POSForm,
  menuItems: MenuItem[],
  occupiedTables: string[],
  total: number,
  tendered: number,
  inventoryIssue?: string,
) {
  const unavailableItem = cart.find(
    (entry) =>
      !menuItems.find((menuItem) => menuItem.id === entry.menuItemId)
        ?.available,
  );
  const selectedTableOccupied =
    form.orderType === "Dine-in" &&
    occupiedTables.includes(String(Number(form.tableNumber)));
  const canPlace =
    cart.length > 0 &&
    (form.orderType !== "Dine-in" || Boolean(form.tableNumber?.trim())) &&
    !selectedTableOccupied &&
    !unavailableItem &&
    !inventoryIssue &&
    (form.discountType === "None" || Boolean(form.discountReference?.trim())) &&
    (form.paymentMethod === "Cash"
      ? tendered >= total
      : Boolean(form.gcashReference?.trim()));
  const disabledReason = !cart.length
    ? "Add at least one menu item to continue."
    : unavailableItem
      ? `${unavailableItem.name} is no longer available. Remove it to continue.`
      : inventoryIssue
        ? `${inventoryIssue} Adjust the quantity to continue.`
        : form.orderType === "Dine-in" && !form.tableNumber?.trim()
          ? "Select an available table for this dine-in order."
          : selectedTableOccupied
            ? `Table ${form.tableNumber} already has an active order.`
            : form.discountType !== "None" && !form.discountReference?.trim()
              ? "Enter the Senior/PWD ID or reference."
              : form.paymentMethod === "Cash" && tendered < total
                ? "Enter enough cash tendered to cover the total."
                : form.paymentMethod === "GCash" && !form.gcashReference?.trim()
                  ? "Enter the customer's GCash reference number."
                  : undefined;
  return { unavailableItem, selectedTableOccupied, canPlace, disabledReason };
}

export function addCartItem(
  current: POSCartLine[],
  menuItem: MenuItem,
  quantity = 1,
  itemNote = "",
  modifiers: OrderItemModifier[] = [],
): CartUpdateResult {
  const currentQuantity = current
    .filter((entry) => entry.menuItemId === menuItem.id)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const capacity = Math.max(
    0,
    Math.min(
      MAX_POS_ITEM_QUANTITY - currentQuantity,
      (menuItem.inventoryRemaining ?? MAX_POS_ITEM_QUANTITY) - currentQuantity,
    ),
  );
  if (!capacity) {
    return {
      cart: current,
      error:
        menuItem.inventoryRemaining !== undefined &&
        currentQuantity >= menuItem.inventoryRemaining
          ? `Only ${menuItem.inventoryRemaining} ${menuItem.name} remaining.`
          : "Maximum quantity reached",
    };
  }

  const amountToAdd = Math.min(capacity, Math.max(1, quantity));
  const normalizedNote = itemNote.trim();
  const modifierKey = modifiers
    .map((modifier) => modifier.id)
    .sort()
    .join("|");
  const existing = current.find(
    (entry) =>
      entry.menuItemId === menuItem.id &&
      (entry.note?.trim() ?? "") === normalizedNote &&
      (entry.modifiers ?? [])
        .map((modifier) => modifier.id)
        .sort()
        .join("|") === modifierKey,
  );
  const cart = existing
    ? current.map((entry) =>
        entry.lineId === existing.lineId
          ? { ...entry, quantity: entry.quantity + amountToAdd }
          : entry,
      )
    : [
        ...current,
        {
          lineId: createLineId(),
          menuItemId: menuItem.id,
          name: menuItem.name,
          unitPrice:
            menuItem.price +
            modifiers.reduce((sum, modifier) => sum + modifier.price, 0),
          quantity: amountToAdd,
          note: normalizedNote || undefined,
          modifiers: modifiers.length
            ? modifiers.map((modifier) => ({ ...modifier }))
            : undefined,
        },
      ];
  return {
    cart,
    warning:
      amountToAdd < quantity
        ? {
            title: `Quantity limited to ${currentQuantity + amountToAdd}`,
            description: `The cart now contains the maximum available ${menuItem.name}.`,
          }
        : undefined,
  };
}

export function setCartLineQuantity(
  current: POSCartLine[],
  lineId: string,
  quantity: number,
  menuItems: MenuItem[],
) {
  return current.map((entry) => {
    if (entry.lineId !== lineId) return entry;
    const menuItem = menuItems.find((item) => item.id === entry.menuItemId);
    const otherQuantity = current
      .filter(
        (candidate) =>
          candidate.menuItemId === entry.menuItemId &&
          candidate.lineId !== lineId,
      )
      .reduce((sum, candidate) => sum + candidate.quantity, 0);
    const maximum = Math.max(
      1,
      Math.min(
        MAX_POS_ITEM_QUANTITY - otherQuantity,
        (menuItem?.inventoryRemaining ?? MAX_POS_ITEM_QUANTITY) - otherQuantity,
      ),
    );
    return {
      ...entry,
      quantity: Math.min(maximum, Math.max(1, Math.round(quantity))),
    };
  });
}

export function duplicateCartLine(
  current: POSCartLine[],
  lineId: string,
  menuItems: MenuItem[],
): CartUpdateResult {
  const sourceIndex = current.findIndex((entry) => entry.lineId === lineId);
  const source = current[sourceIndex];
  if (!source) return { cart: current };
  const menuItem = menuItems.find((item) => item.id === source.menuItemId);
  if (!menuItem?.available) {
    return { cart: current, error: `${source.name} is unavailable.` };
  }
  const currentQuantity = current
    .filter((entry) => entry.menuItemId === source.menuItemId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const capacity = Math.max(
    0,
    Math.min(
      MAX_POS_ITEM_QUANTITY - currentQuantity,
      (menuItem.inventoryRemaining ?? MAX_POS_ITEM_QUANTITY) - currentQuantity,
    ),
  );
  if (!capacity) {
    return {
      cart: current,
      error: `No additional ${source.name} inventory is available.`,
    };
  }
  const quantity = Math.min(source.quantity, capacity);
  const duplicate: POSCartLine = {
    ...source,
    lineId: createLineId(),
    quantity,
    modifiers: source.modifiers?.map((modifier) => ({ ...modifier })),
  };
  const cart = [...current];
  cart.splice(sourceIndex + 1, 0, duplicate);
  return {
    cart,
    warning:
      quantity < source.quantity
        ? {
            title: `Duplicated ${quantity} only`,
            description: "The duplicate was limited by available inventory.",
          }
        : undefined,
  };
}

export function reorderCart(
  current: POSCartLine[],
  sourceLineId: string,
  targetLineId: string,
) {
  const sourceIndex = current.findIndex(
    (entry) => entry.lineId === sourceLineId,
  );
  const targetIndex = current.findIndex(
    (entry) => entry.lineId === targetLineId,
  );
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
    return current;
  const next = [...current];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}
