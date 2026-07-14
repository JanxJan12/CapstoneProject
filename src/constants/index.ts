import {
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  ChefHat,
  BookOpen,
  Package,
  Banknote,
  RefreshCw,
  Truck,
  ShoppingBag,
  Bike,
  Users,
  BarChart2,
  Settings,
  ClipboardList,
  History,
} from "lucide-react";
import type {
  BadgeVariant,
  ManagerPage,
  CashierPage,
  NavGroup,
  PageEntry,
} from "../types";

export const STATUS_MAP: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  available: { label: "Available", variant: "success" },
  on_delivery: { label: "On Delivery", variant: "info" },
  offline: { label: "Offline", variant: "neutral" },
  pending: { label: "Pending", variant: "warning" },
  received: { label: "Received", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  "waiting-payment": { label: "Awaiting Payment", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "info" },
  preparing: { label: "Preparing", variant: "orange" },
  ready: { label: "Ready", variant: "purple" },
  "out-for-delivery": { label: "Out for Delivery", variant: "info" },
  delivered: { label: "Delivered", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  "walk-in": { label: "Walk-in", variant: "neutral" },
  delivery: { label: "Delivery", variant: "info" },
  healthy: { label: "Healthy", variant: "success" },
  "reorder-soon": { label: "Reorder Soon", variant: "warning" },
  critical: { label: "Critical", variant: "danger" },
  "stock receiving": { label: "Stock Receiving", variant: "success" },
  "order deduction": { label: "Order Deduction", variant: "info" },
  adjustment: { label: "Adjustment", variant: "neutral" },
  waste: { label: "Waste", variant: "warning" },
  spoilage: { label: "Spoilage", variant: "danger" },
};

export const PAGE_LIST: PageEntry[] = [
  { id: "cover", num: "00", label: "Cover", sub: "Design System" },
  { id: "auth", num: "01", label: "Authentication", sub: "11 screens" },
  { id: "manager", num: "02", label: "Manager", sub: "13 screens" },
  { id: "cashier", num: "03", label: "Cashier", sub: "6 screens" },
  { id: "kitchen", num: "04", label: "Kitchen", sub: "Kanban board" },
  { id: "customer", num: "05", label: "Customer Website", sub: "9 screens" },
  { id: "rider", num: "06", label: "Rider App", sub: "8 mobile screens" },
  { id: "reports", num: "07", label: "Reports", sub: "5 report views" },
  { id: "states", num: "08", label: "System States", sub: "20 states" },
  { id: "components", num: "09", label: "Components", sub: "Design library" },
];

export const MANAGER_GROUPS: NavGroup<ManagerPage>[] = [
  {
    label: "Operations",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "orders", label: "Orders", icon: ShoppingCart, badge: 8 },
      { id: "payments", label: "Payments", icon: CreditCard, badge: 3 },
      { id: "kitchen-monitor", label: "Kitchen Monitor", icon: ChefHat },
    ],
  },
  {
    label: "Inventory",
    items: [
      { id: "menu", label: "Menu Management", icon: BookOpen },
      { id: "inventory", label: "Inventory", icon: Package, badge: 3 },
      { id: "inv-transactions", label: "Inv. Transactions", icon: RefreshCw },
      { id: "suppliers", label: "Suppliers", icon: Truck },
      { id: "purchase-orders", label: "Purchase Orders", icon: ShoppingBag },
    ],
  },
  {
    label: "People",
    items: [
      { id: "riders", label: "Riders", icon: Bike },
      { id: "customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Reports & System",
    items: [
      { id: "reports", label: "Reports", icon: BarChart2 },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export const CASHIER_GROUPS: NavGroup<CashierPage>[] = [
  {
    label: "Operations",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        id: "pending-payments",
        label: "Pending Payments",
        icon: CreditCard,
        badge: 3,
      },
      { id: "walkin-pos", label: "Walk-in POS", icon: ShoppingCart },
      { id: "order-list", label: "Order List", icon: ClipboardList },
      { id: "transactions", label: "Transactions", icon: History },
      { id: "shift-settlement", label: "Shift Settlement", icon: Banknote },
    ],
  },
];

export const KITCHEN_GROUPS: NavGroup<"queue">[] = [
  {
    label: "Kitchen",
    items: [{ id: "queue", label: "Kitchen Queue", icon: ChefHat }],
  },
];

export const ORDER_TIMELINE = [
  "Waiting for Payment",
  "Confirmed",
  "Preparing",
  "Ready",
  "Waiting for Rider",
  "Rider Accepted",
  "Picked Up",
  "Out for Delivery",
  "Delivered",
];

export const ORDER_STEP_MAP: Record<string, number> = {
  "waiting-payment": 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  "waiting-rider": 4,
  "rider-accepted": 5,
  "picked-up": 6,
  "out-for-delivery": 7,
  delivered: 8,
};

export const MENU_CATEGORIES = [
  "All",
  "Viands",
  "Soups",
  "Rice",
  "Vegetables",
  "Beverages",
];
