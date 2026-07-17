import {
  POS_DRAFT_STORAGE_KEY,
  POS_RECENT_SEARCHES_STORAGE_KEY,
  POS_RECENT_SEARCH_LIMIT,
} from "../constants";
import type { POSForm } from "../schemas";
import type { OrderItem } from "../types";
import type { POSCartLine } from "./types";

export const DEFAULT_POS_FORM: POSForm = {
  customerName: "",
  contactNumber: "",
  deliveryAddress: "",
  orderType: "Dine-in",
  tableNumber: "",
  paymentMethod: "Cash",
  amountTendered: 0,
  gcashReference: "",
  gcashConfirmed: false,
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
        orderType:
          saved?.form?.orderType === "Take-out" ||
          saved?.form?.orderType === "Delivery"
            ? "Take-out"
            : "Dine-in",
        customerName: "",
        contactNumber: "",
        deliveryAddress: "",
        tableNumber: "",
        discountType: "None",
        discountReference: "",
        gcashConfirmed: false,
      },
    };
  } catch {
    return { cart: [], form: DEFAULT_POS_FORM };
  }
}

export function savePOSDraft(cart: POSCartLine[], form: POSForm) {
  try {
    if (cart.length) {
      localStorage.setItem(
        POS_DRAFT_STORAGE_KEY,
        JSON.stringify({ cart, form }),
      );
    } else {
      localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
    }
  } catch {
    // Draft persistence is best-effort; the active in-memory order remains usable.
  }
}

export function clearPOSDraft() {
  try {
    localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore restricted storage environments.
  }
}

export function loadPOSRecentSearches(): string[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem(POS_RECENT_SEARCHES_STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(saved)
      ? saved
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, POS_RECENT_SEARCH_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function savePOSRecentSearches(searches: string[]) {
  try {
    localStorage.setItem(
      POS_RECENT_SEARCHES_STORAGE_KEY,
      JSON.stringify(searches.slice(0, POS_RECENT_SEARCH_LIMIT)),
    );
  } catch {
    // Recent searches remain available for the active session.
  }
}
