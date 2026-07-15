import { POS_DRAFT_STORAGE_KEY, POS_FAVORITES_STORAGE_KEY } from "../constants";
import type { POSForm } from "../schemas";
import type { OrderItem } from "../types";
import type { POSCartLine } from "./types";

export const DEFAULT_POS_FORM: POSForm = {
  customerName: "",
  orderType: "Dine-in",
  tableNumber: "",
  paymentMethod: "Cash",
  amountTendered: 0,
  gcashReference: "",
  discountType: "None",
  discountReference: "",
  orderInstructions: "",
};

type StoredCartLine = Omit<OrderItem, "id"> & { lineId?: string };
let lineSequence = 0;
export const createLineId = () => `POS-LINE-${Date.now()}-${++lineSequence}`;

export function loadPOSDraft(): { cart: POSCartLine[]; form: POSForm } {
  try {
    const saved = JSON.parse(
      localStorage.getItem(POS_DRAFT_STORAGE_KEY) ?? "null",
    ) as { cart?: StoredCartLine[]; form?: Partial<POSForm> } | null;
    return {
      cart: Array.isArray(saved?.cart)
        ? saved.cart.map((entry) => ({
            ...entry,
            lineId: entry.lineId || createLineId(),
          }))
        : [],
      form: {
        ...DEFAULT_POS_FORM,
        ...saved?.form,
        customerName: "",
        tableNumber: "",
        discountType: "None",
        discountReference: "",
      },
    };
  } catch {
    return { cart: [], form: DEFAULT_POS_FORM };
  }
}

export function savePOSDraft(cart: POSCartLine[], form: POSForm) {
  if (cart.length) {
    localStorage.setItem(POS_DRAFT_STORAGE_KEY, JSON.stringify({ cart, form }));
  } else {
    localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
  }
}

export function clearPOSDraft() {
  localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
}

export function loadPOSFavorites(): string[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem(POS_FAVORITES_STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(saved)
      ? saved.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export function savePOSFavorites(ids: string[]) {
  localStorage.setItem(POS_FAVORITES_STORAGE_KEY, JSON.stringify(ids));
}
