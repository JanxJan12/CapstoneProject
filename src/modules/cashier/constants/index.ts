import type { OrderStatus } from "../types";

export const CASHIER_STORAGE_KEY = "rrj_cashier_state_v4";
export const POS_DRAFT_STORAGE_KEY = "rrj_cashier_pos_draft_v3";
export const POS_RECENT_SEARCHES_STORAGE_KEY =
  "rrj_cashier_pos_recent_searches_v1";
export const CASHIER_STATE_VERSION = 6;
export const CASHIER_ID = "USR-CASHIER-001";
export const CASHIER_NAME = "Juan Santos";
export const CASHIER_TERMINAL = "Counter Terminal 01";
export const CASHIER_LOCALE = "en-PH";
export const CASHIER_CURRENCY = "PHP";
export const DISCOUNT_RATE = 0.2;
export const POS_TAX_ENABLED = false;
export const POS_TAX_RATE = 0.12;
export const DEFAULT_DELAY_THRESHOLD_MINUTES = 20;
export const PAGE_SIZE = 7;
export const ORDER_REFRESH_INTERVAL_MS = 15_000;
export const DASHBOARD_CLOCK_REFRESH_MS = 30_000;
export const SEARCH_FOCUS_DELAY_MS = 100;
export const DATA_REFRESH_FEEDBACK_MS = 200;
export const CASH_TENDER_ROUNDING_STEPS = [100, 500, 1000] as const;
export const MAX_POS_ITEM_QUANTITY = 99;
export const POS_MAX_CASH_DIGITS = 7;
export const POS_BEST_SELLER_LIMIT = 8;
export const POS_RECENT_SEARCH_LIMIT = 6;
export const POS_LOW_INVENTORY_THRESHOLD = 5;
export const POS_ITEM_NOTE_MAX_LENGTH = 120;
export const MAX_ACTIVITY_RECORDS = 40;
export const MENU_GRID_ROW_HEIGHT_PX = 190;
export const MENU_GRID_OVERSCAN_ROWS = 2;
export const OPTIMISTIC_DELAY_MS = {
  fast: 160,
  default: 180,
  standard: 200,
  extended: 220,
} as const;

export const ORDER_STATUSES: OrderStatus[] = [
  "Awaiting Payment",
  "Confirmed",
  "Preparing",
  "Ready",
  "Waiting for Rider",
  "Rider Accepted",
  "Picked Up",
  "Out for Delivery",
  "Delivered",
  "Completed",
  "Cancelled",
];

export const KITCHEN_STATUSES: OrderStatus[] = [
  "Confirmed",
  "Preparing",
  "Ready",
];
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "Awaiting Payment",
  "Confirmed",
  "Preparing",
  "Ready",
  "Waiting for Rider",
  "Rider Accepted",
  "Picked Up",
  "Out for Delivery",
];
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  "Awaiting Payment",
  "Confirmed",
  "Preparing",
  "Ready",
  "Waiting for Rider",
];

export const PAYMENT_REJECTION_REASONS = [
  "Wrong Amount",
  "Unreadable Proof",
  "Duplicate Payment",
  "Fake Screenshot",
  "Reference Not Found",
  "Other",
] as const;

export const SHIFT_VARIANCE_REASONS = [
  "Counting Error",
  "Incorrect Change",
  "Cash Payout",
  "Missing Receipt",
  "Unrecorded Refund",
  "Other",
] as const;

export const MENU_CATEGORIES = [
  "All",
  "Viands",
  "Soups",
  "Vegetables",
  "Rice",
  "Beverages",
  "Desserts",
  "Sides",
  "Add-ons",
];

export const POPULAR_MENU_SEARCHES = [
  "Beef",
  "Chicken",
  "Rice",
  "Beverages",
] as const;

export const DINING_TABLES = Array.from({ length: 12 }, (_, index) =>
  String(index + 1),
);

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat(CASHIER_LOCALE, {
    style: "currency",
    currency: CASHIER_CURRENCY,
    minimumFractionDigits: 2,
  }).format(amount);

export const formatCompactMoney = (amount: number) =>
  new Intl.NumberFormat(CASHIER_LOCALE, {
    style: "currency",
    currency: CASHIER_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat(CASHIER_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

export const formatDateOnly = (value: string | Date) =>
  new Intl.DateTimeFormat(CASHIER_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(typeof value === "string" ? new Date(value) : value);

export const formatTimeOnly = (value: string | Date, includeSeconds = false) =>
  new Intl.DateTimeFormat(CASHIER_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
  }).format(typeof value === "string" ? new Date(value) : value);

export const minutesSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

export const formatElapsed = (iso: string) => {
  const minutes = minutesSince(iso);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
