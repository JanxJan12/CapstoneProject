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
  paymentMethod: "Cash",
  amountTendered: 0,
  gcashReference: "",
  gcashConfirmed: false,
};

type StoredCartLine = Omit<OrderItem, "id"> & { lineId?: string };
let lineSequence = 0;
export const createLineId = () => `POS-LINE-${Date.now()}-${++lineSequence}`;
const PENDING_POS_REQUEST_KEY = "rrj_cashier_pos_pending_request_v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pendingRequestKey = (cashierId: string) => `${PENDING_POS_REQUEST_KEY}:${cashierId}`;

export function loadPendingPOSRequest(cashierId: string): string | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(pendingRequestKey(cashierId)) ?? "null");
    if (!saved || typeof saved !== "object" || !("cashierId" in saved) ||
      !("requestId" in saved) || saved.cashierId !== cashierId ||
      typeof saved.requestId !== "string" || !UUID_PATTERN.test(saved.requestId)) return null;
    return saved.requestId;
  } catch {
    return null;
  }
}

export function savePendingPOSRequest(cashierId: string, requestId: string): boolean {
  try {
    sessionStorage.setItem(pendingRequestKey(cashierId), JSON.stringify({ cashierId, requestId }));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingPOSRequest(cashierId: string, requestId: string) {
  if (loadPendingPOSRequest(cashierId) !== requestId) return;
  try {
    sessionStorage.removeItem(pendingRequestKey(cashierId));
  } catch {
    // A confirmed sale is already reflected in server-authoritative Cashier state.
  }
}

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
        orderType:
          saved?.form?.orderType === "Take-out" ||
          saved?.form?.orderType === "Delivery"
            ? "Take-out"
            : "Dine-in",
        customerName: "",
        contactNumber: "",
        deliveryAddress: "",
        paymentMethod: "Cash",
        gcashReference: "",
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
