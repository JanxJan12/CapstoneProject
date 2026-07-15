import type { OrderStatus } from "../types";

export const CASHIER_STORAGE_KEY = "rrj_cashier_state_v4";
export const POS_DRAFT_STORAGE_KEY = "rrj_cashier_pos_draft_v2";
export const CASHIER_STATE_VERSION = 4;
export const CASHIER_ID = "USR-CASHIER-001";
export const CASHIER_NAME = "Juan Santos";
export const CASHIER_TERMINAL = "Counter Terminal 01";
export const DISCOUNT_RATE = 0.2;
export const DEFAULT_DELAY_THRESHOLD_MINUTES = 20;
export const PAGE_SIZE = 7;

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
  "Amount does not match",
  "Unreadable proof",
  "Duplicate proof",
  "Invalid reference number",
  "Wrong recipient",
  "Other",
] as const;

export const MENU_CATEGORIES = [
  "All",
  "Viands",
  "Soups",
  "Vegetables",
  "Rice",
  "Beverages",
];

export const DINING_TABLES = Array.from({ length: 12 }, (_, index) =>
  String(index + 1),
);

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

export const minutesSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

export const formatElapsed = (iso: string) => {
  const minutes = minutesSince(iso);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
