export const CUSTOMER_ORDER_REQUEST_STORAGE_KEY =
  "rrj_customer_order_request_v1";
export const CUSTOMER_DELIVERY_RETRY_STORAGE_KEY = "rrj_customer_delivery_retry_v1";

interface StoredCustomerOrderRequest {
  requestId: string;
  fingerprint: string;
}

export interface StoredCustomerDeliveryRetry {
  requestId: string;
  customerId: string;
  fullName: string;
  contactNumber: string;
  deliveryAddress: string;
  landmark: string;
  responseUnknown?: boolean;
}

export function readCustomerDeliveryRetry(customerId: string): StoredCustomerDeliveryRetry | null {
  try {
    const request = JSON.parse(sessionStorage.getItem(CUSTOMER_ORDER_REQUEST_STORAGE_KEY) ?? "null") as Partial<StoredCustomerOrderRequest> | null;
    const draft = JSON.parse(sessionStorage.getItem(CUSTOMER_DELIVERY_RETRY_STORAGE_KEY) ?? "null") as Partial<StoredCustomerDeliveryRetry> | null;
    if (request?.requestId && draft?.requestId === request.requestId && draft.customerId === customerId &&
      typeof draft.fullName === "string" && typeof draft.contactNumber === "string" &&
      typeof draft.deliveryAddress === "string" && typeof draft.landmark === "string") {
      return draft as StoredCustomerDeliveryRetry;
    }
  } catch {
    // Malformed browser storage must not block checkout.
  }
  return null;
}

export function clearCustomerDeliveryRetry(requestId: string): void {
  try {
    const draft = JSON.parse(sessionStorage.getItem(CUSTOMER_DELIVERY_RETRY_STORAGE_KEY) ?? "null") as Partial<StoredCustomerDeliveryRetry> | null;
    if (draft?.requestId === requestId) sessionStorage.removeItem(CUSTOMER_DELIVERY_RETRY_STORAGE_KEY);
  } catch {
    sessionStorage.removeItem(CUSTOMER_DELIVERY_RETRY_STORAGE_KEY);
  }
}

export function markCustomerDeliveryRetryResponseUnknown(): void {
  try {
    const request = JSON.parse(sessionStorage.getItem(CUSTOMER_ORDER_REQUEST_STORAGE_KEY) ?? "null") as Partial<StoredCustomerOrderRequest> | null;
    const draft = JSON.parse(sessionStorage.getItem(CUSTOMER_DELIVERY_RETRY_STORAGE_KEY) ?? "null") as Partial<StoredCustomerDeliveryRetry> | null;
    if (request?.requestId && draft?.requestId === request.requestId) {
      sessionStorage.setItem(CUSTOMER_DELIVERY_RETRY_STORAGE_KEY, JSON.stringify({ ...draft, responseUnknown: true }));
    }
  } catch {
    // Recovery remains available through the live form when storage is unavailable.
  }
}

export function getOrCreateCustomerOrderRequestId(
  fingerprint: string,
): string {
  try {
    const stored = sessionStorage.getItem(
      CUSTOMER_ORDER_REQUEST_STORAGE_KEY,
    );

    if (stored) {
      const parsed = JSON.parse(
        stored,
      ) as Partial<StoredCustomerOrderRequest>;

      if (
        typeof parsed.requestId === "string" &&
        parsed.requestId.length > 0 &&
        parsed.fingerprint === fingerprint
      ) {
        return parsed.requestId;
      }
    }
  } catch {
    // Fall through and create a new request ID.
  }

  const requestId = crypto.randomUUID();

  try {
    sessionStorage.setItem(
      CUSTOMER_ORDER_REQUEST_STORAGE_KEY,
      JSON.stringify({
        requestId,
        fingerprint,
      }),
    );
  } catch {
    // The current in-memory request can still proceed.
  }

  return requestId;
}

export function clearCustomerOrderRequestId(
  requestId: string,
): void {
  try {
    const stored = sessionStorage.getItem(
      CUSTOMER_ORDER_REQUEST_STORAGE_KEY,
    );

    if (!stored) {
      return;
    }

    const parsed = JSON.parse(
      stored,
    ) as Partial<StoredCustomerOrderRequest>;

    if (parsed.requestId === requestId) {
      sessionStorage.removeItem(
        CUSTOMER_ORDER_REQUEST_STORAGE_KEY,
      );
    }
  } catch {
    sessionStorage.removeItem(
      CUSTOMER_ORDER_REQUEST_STORAGE_KEY,
    );
  }
}

export class CustomerCheckoutFeedbackError extends Error {
  constructor(message: string, readonly responseUnknown = false) {
    super(message);
  }
}
