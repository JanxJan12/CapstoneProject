export type PageId =
  | "cover"
  | "auth"
  | "manager"
  | "cashier"
  | "kitchen"
  | "customer"
  | "rider"
  | "reports"
  | "states"
  | "components";
export type ManagerPage =
  | "dashboard"
  | "orders"
  | "payments"
  | "kitchen-monitor"
  | "menu"
  | "inventory"
  | "inv-transactions"
  | "suppliers"
  | "purchase-orders"
  | "riders"
  | "customers"
  | "reports"
  | "settings";
export type CashierPage =
  | "dashboard"
  | "pending-payments"
  | "walkin-pos"
  | "order-list"
  | "transactions"
  | "shift-settlement";
export type KitchenTab = "confirmed" | "preparing" | "ready" | "completed";
export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  | "orange"
  | "default";

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  available: boolean;
  desc: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  qty: number;
  unit: string;
  reorder: number;
  status: string;
  updated: string;
}

export interface InvTransaction {
  id: string;
  item: string;
  type: string;
  qty: string;
  ref: string;
  date: string;
  by: string;
}

export interface OrderItem {
  name: string;
  qty: number;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  addr: string;
  items: OrderItem[];
  total: number;
  status: string;
  type: string;
  rider: string;
  time: string;
}

export interface PendingPayment {
  id: string;
  customer: string;
  phone: string;
  items: string;
  total: number;
  gcashRef: string;
  submitted: string;
  address: string;
}

export interface KitchenOrder {
  id: string;
  customer: string;
  type: string;
  items: OrderItem[];
  status: string;
  elapsed: string;
}

export interface Rider {
  id: number;
  name: string;
  phone: string;
  plate: string;
  motor: string;
  status: string;
  license: string;
  deliveries: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  address: string;
  items: number;
  pos: number;
}

export interface PurchaseOrderItem {
  name: string;
  qty: number;
  unit: string;
  cost: number;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  items: PurchaseOrderItem[];
  total: number;
  status: string;
  date: string;
  by: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  orders: number;
  last: string;
}

export interface Transaction {
  id: string;
  order: string;
  customer: string;
  amount: number;
  method: string;
  status: string;
  date: string;
}

export interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: React.ElementType;
  badge?: number;
  shortcut?: string;
}

export interface NavGroup<T extends string> {
  label: string;
  items: NavItem<T>[];
}

export interface PageEntry {
  id: PageId;
  num: string;
  label: string;
  sub: string;
}
