import type { MenuItem, InventoryItem, InvTransaction, Order, PendingPayment, KitchenOrder, Rider, Supplier, PurchaseOrder, Customer, Transaction } from "../types";

export const salesData = [
  { day: "Mon", sales: 8200 }, { day: "Tue", sales: 9500 }, { day: "Wed", sales: 7800 },
  { day: "Thu", sales: 11200 }, { day: "Fri", sales: 14500 }, { day: "Sat", sales: 16800 }, { day: "Sun", sales: 12450 },
];

export const orderStatusData = [
  { name: "Delivered", value: 38, color: "#22c55e" }, { name: "Preparing", value: 12, color: "#f59e0b" },
  { name: "Pending", value: 8, color: "#3b82f6" }, { name: "Cancelled", value: 3, color: "#ef4444" },
];

export const menuItems: MenuItem[] = [
  { id: 1, name: "Crispy Beef Tadyang", category: "Viands", price: 185, available: true, desc: "Crispy beef ribs with garlic and spices" },
  { id: 2, name: "Adobong Manok", category: "Viands", price: 120, available: true, desc: "Classic chicken adobo" },
  { id: 3, name: "Sinigang na Baka", category: "Soups", price: 155, available: true, desc: "Tamarind beef soup with vegetables" },
  { id: 4, name: "Chicken Bicol Express", category: "Viands", price: 130, available: false, desc: "Spicy chicken in coconut milk" },
  { id: 5, name: "Kare-Kare", category: "Viands", price: 175, available: true, desc: "Oxtail stew in peanut sauce" },
  { id: 6, name: "Pinakbet", category: "Vegetables", price: 110, available: true, desc: "Mixed veggies in shrimp paste" },
  { id: 7, name: "Fried Rice", category: "Rice", price: 45, available: true, desc: "Garlic fried rice" },
  { id: 8, name: "White Rice", category: "Rice", price: 35, available: true, desc: "Steamed white rice" },
  { id: 9, name: "Softdrinks", category: "Beverages", price: 30, available: true, desc: "Coke, Royal, or Sprite" },
  { id: 10, name: "Buko Juice", category: "Beverages", price: 35, available: true, desc: "Fresh coconut juice" },
];

export const inventoryItems: InventoryItem[] = [
  { id: 1, name: "Rice", category: "Staple", qty: 45, unit: "kg", reorder: 20, status: "healthy", updated: "Jul 4, 8:00 AM" },
  { id: 2, name: "Cooking Oil", category: "Condiment", qty: 4, unit: "liters", reorder: 10, status: "critical", updated: "Jul 4, 7:45 AM" },
  { id: 3, name: "Marinated Chicken Pecho", category: "Meat", qty: 12, unit: "kg", reorder: 8, status: "healthy", updated: "Jul 3, 6:00 PM" },
  { id: 4, name: "Chicken Lumpia", category: "Prepared", qty: 80, unit: "pcs", reorder: 50, status: "healthy", updated: "Jul 3, 3:00 PM" },
  { id: 5, name: "Beef", category: "Meat", qty: 6, unit: "kg", reorder: 5, status: "reorder-soon", updated: "Jul 4, 6:30 AM" },
  { id: 6, name: "Flour", category: "Staple", qty: 3, unit: "kg", reorder: 8, status: "critical", updated: "Jul 3, 9:00 AM" },
  { id: 7, name: "Noodles", category: "Staple", qty: 8, unit: "kg", reorder: 5, status: "healthy", updated: "Jul 2, 4:00 PM" },
  { id: 8, name: "Vegetables", category: "Produce", qty: 2, unit: "kg", reorder: 5, status: "critical", updated: "Jul 4, 7:00 AM" },
  { id: 9, name: "Shrimp", category: "Seafood", qty: 4, unit: "kg", reorder: 6, status: "reorder-soon", updated: "Jul 3, 5:00 PM" },
  { id: 10, name: "Iced Tea Mix", category: "Beverage", qty: 15, unit: "packs", reorder: 10, status: "healthy", updated: "Jul 2, 2:00 PM" },
];

export const invTransactions: InvTransaction[] = [
  { id: "TRX-001", item: "Rice", type: "stock receiving", qty: "+20 kg", ref: "PO-2024-031", date: "Jul 4, 8:00 AM", by: "Manager" },
  { id: "TRX-002", item: "Marinated Chicken Pecho", type: "order deduction", qty: "-2 kg", ref: "ORD-1047", date: "Jul 4, 10:42 AM", by: "System" },
  { id: "TRX-003", item: "Cooking Oil", type: "waste", qty: "-1.5 liters", ref: "—", date: "Jul 3, 6:00 PM", by: "Kitchen Staff" },
  { id: "TRX-004", item: "Vegetables", type: "spoilage", qty: "-3 kg", ref: "—", date: "Jul 3, 5:30 PM", by: "Kitchen Staff" },
  { id: "TRX-005", item: "Beef", type: "adjustment", qty: "+2 kg", ref: "—", date: "Jul 2, 3:00 PM", by: "Manager" },
];

export const allOrders: Order[] = [
  { id: "ORD-1052", customer: "Grace Villanueva", phone: "09282345678", addr: "12 Mabini Ave., Makati", items: [{ name: "Sinigang na Baka", qty: 1 }, { name: "White Rice", qty: 1 }], total: 190, status: "waiting-payment", type: "delivery", rider: "—", time: "11:18 AM" },
  { id: "ORD-1051", customer: "Walk-in", phone: "—", addr: "—", items: [{ name: "Sinigang na Baka", qty: 1 }, { name: "Pinakbet", qty: 1 }, { name: "White Rice", qty: 2 }], total: 335, status: "preparing", type: "walk-in", rider: "—", time: "10:55 AM" },
  { id: "ORD-1047", customer: "Maria Santos", phone: "09172345678", addr: "89 Del Pilar St., Pasig", items: [{ name: "Crispy Beef Tadyang", qty: 1 }, { name: "White Rice", qty: 1 }], total: 220, status: "preparing", type: "delivery", rider: "—", time: "10:42 AM" },
  { id: "ORD-1046", customer: "Juan dela Cruz", phone: "09283456789", addr: "23 Katipunan Ave., QC", items: [{ name: "Adobong Manok", qty: 1 }, { name: "White Rice", qty: 1 }], total: 155, status: "out-for-delivery", type: "delivery", rider: "Ramil Abad", time: "10:35 AM" },
  { id: "ORD-1045", customer: "Ana Reyes", phone: "09394567890", addr: "56 Ortigas Ave., Mandaluyong", items: [{ name: "Sinigang na Baka", qty: 1 }, { name: "White Rice", qty: 2 }], total: 225, status: "delivered", type: "delivery", rider: "Danilo Cruz", time: "10:18 AM" },
  { id: "ORD-1044", customer: "Walk-in", phone: "—", addr: "—", items: [{ name: "Kare-Kare", qty: 1 }, { name: "White Rice", qty: 1 }], total: 240, status: "completed", type: "walk-in", rider: "—", time: "10:05 AM" },
];

export const pendingPayments: PendingPayment[] = [
  { id: "ORD-1048", customer: "Roberto Lim", phone: "09171234567", items: "Crispy Beef Tadyang ×2, White Rice ×2", total: 440, gcashRef: "GC-2024-7841", submitted: "11:02 AM", address: "45 Rizal St., Taguig" },
  { id: "ORD-1049", customer: "Grace Villanueva", phone: "09282345678", items: "Sinigang na Baka, White Rice", total: 190, gcashRef: "GC-2024-7842", submitted: "11:08 AM", address: "12 Mabini Ave., Makati" },
  { id: "ORD-1050", customer: "Mark Castillo", phone: "09393456789", items: "Kare-Kare, White Rice ×2, Buko Juice", total: 280, gcashRef: "GC-2024-7843", submitted: "11:15 AM", address: "78 Quezon Blvd., QC" },
];

export const kitchenOrders: KitchenOrder[] = [
  { id: "ORD-1053", customer: "Walk-in", type: "Walk-in", items: [{ name: "Crispy Beef Tadyang", qty: 2 }, { name: "Fried Rice", qty: 2 }], status: "confirmed", elapsed: "2 min" },
  { id: "ORD-1047", customer: "Maria Santos", type: "Delivery", items: [{ name: "Crispy Beef Tadyang", qty: 1 }, { name: "White Rice", qty: 1 }], status: "confirmed", elapsed: "8 min" },
  { id: "ORD-1054", customer: "Walk-in", type: "Walk-in", items: [{ name: "Sinigang na Baka", qty: 1 }, { name: "White Rice", qty: 2 }], status: "confirmed", elapsed: "1 min" },
  { id: "ORD-1046", customer: "Juan dela Cruz", type: "Delivery", items: [{ name: "Adobong Manok", qty: 1 }, { name: "White Rice", qty: 1 }], status: "preparing", elapsed: "14 min" },
  { id: "ORD-1051", customer: "Walk-in", type: "Walk-in", items: [{ name: "Sinigang na Baka", qty: 1 }, { name: "Pinakbet", qty: 1 }, { name: "White Rice", qty: 2 }], status: "preparing", elapsed: "9 min" },
  { id: "ORD-1055", customer: "Liza Fernandez", type: "Delivery", items: [{ name: "Kare-Kare", qty: 1 }, { name: "White Rice", qty: 2 }], status: "preparing", elapsed: "22 min" },
  { id: "ORD-1044", customer: "Walk-in", type: "Walk-in", items: [{ name: "Kare-Kare", qty: 1 }, { name: "White Rice", qty: 1 }, { name: "Softdrinks", qty: 1 }], status: "ready", elapsed: "35 min" },
  { id: "ORD-1045", customer: "Ana Reyes", type: "Delivery", items: [{ name: "Sinigang na Baka", qty: 1 }, { name: "White Rice", qty: 2 }], status: "ready", elapsed: "28 min" },
  { id: "ORD-1042", customer: "Walk-in", type: "Walk-in", items: [{ name: "Pinakbet", qty: 1 }, { name: "White Rice", qty: 2 }], status: "completed", elapsed: "45 min" },
  { id: "ORD-1043", customer: "Carlos Mendoza", type: "Delivery", items: [{ name: "Chicken Bicol Express", qty: 1 }, { name: "Fried Rice", qty: 1 }], status: "completed", elapsed: "55 min" },
];

export const riders: Rider[] = [
  { id: 1, name: "Ramil Abad", phone: "09172345678", plate: "ABD-1234", motor: "Honda TMX 125", status: "available", license: "LIC-2021-001234", deliveries: 5 },
  { id: 2, name: "Danilo Cruz", phone: "09283456789", plate: "BCD-2345", motor: "Yamaha Sniper 150", status: "on_delivery", license: "LIC-2020-005678", deliveries: 3 },
  { id: 3, name: "Joey Reyes", phone: "09394567890", plate: "CDE-3456", motor: "Honda Wave 125", status: "offline", license: "LIC-2022-009012", deliveries: 0 },
];

export const suppliers: Supplier[] = [
  { id: 1, name: "Metro Market Supplier", contact: "09171234567", address: "123 Divisoria St., Manila", items: 12, pos: 5 },
  { id: 2, name: "Fresh Farm Distributors", contact: "09281234567", address: "456 Market Ave., Pasig", items: 8, pos: 3 },
  { id: 3, name: "Pantranco Goods Supply", contact: "09391234567", address: "789 Commercial Rd., QC", items: 15, pos: 7 },
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: "PO-2024-031", supplier: "Metro Market Supplier", items: [{ name: "Rice", qty: 20, unit: "kg", cost: 1100 }, { name: "Cooking Oil", qty: 10, unit: "liters", cost: 1500 }], total: 3200, status: "received", date: "Jul 1, 2024", by: "Manager" },
  { id: "PO-2024-030", supplier: "Fresh Farm Distributors", items: [{ name: "Vegetables", qty: 10, unit: "kg", cost: 800 }, { name: "Shrimp", qty: 5, unit: "kg", cost: 1050 }], total: 1850, status: "pending", date: "Jul 2, 2024", by: "Manager" },
  { id: "PO-2024-029", supplier: "Pantranco Goods Supply", items: [{ name: "Marinated Chicken Pecho", qty: 15, unit: "kg", cost: 2700 }], total: 4700, status: "received", date: "Jun 28, 2024", by: "Manager" },
];

export const customers: Customer[] = [
  { id: 1, name: "Maria Santos", email: "maria.santos@gmail.com", phone: "09172345678", orders: 12, last: "Jul 4, 2024" },
  { id: 2, name: "Ana Reyes", email: "ana.reyes@gmail.com", phone: "09394567890", orders: 8, last: "Jul 4, 2024" },
  { id: 3, name: "Carlos Mendoza", email: "carlos.m@gmail.com", phone: "09275678901", orders: 5, last: "Jul 4, 2024" },
  { id: 4, name: "Grace Villanueva", email: "grace.v@gmail.com", phone: "09282345678", orders: 3, last: "Jul 4, 2024" },
];

export const transactions: Transaction[] = [
  { id: "TXN-0847", order: "ORD-1045", customer: "Ana Reyes", amount: 225, method: "GCash", status: "verified", date: "Jul 4, 2024 10:20 AM" },
  { id: "TXN-0846", order: "ORD-1044", customer: "Walk-in", amount: 240, method: "Cash", status: "verified", date: "Jul 4, 2024 10:08 AM" },
  { id: "TXN-0845", order: "ORD-1043", customer: "Carlos Mendoza", amount: 175, method: "GCash", status: "verified", date: "Jul 4, 2024 9:55 AM" },
];
