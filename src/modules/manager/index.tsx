import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  ChefHat,
  BookOpen,
  Package,
  RefreshCw,
  Truck,
  ShoppingBag,
  Bike,
  Users,
  BarChart2,
  Settings,
  ArrowDownToLine,
  Sliders,
  Trash2,
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import type { NavGroup } from "../../types";
import { ManagerDashboard } from "./dashboard/ManagerDashboard";
import { OrdersPage } from "./orders/OrdersPage";
import { PaymentsPage } from "./payments/PaymentsPage";
import { KitchenMonitorPage } from "./kitchen-monitor/KitchenMonitorPage";
import { MenuManagementPage } from "./menu/MenuManagementPage";
import { InventoryPage } from "./inventory/InventoryPage";
import { InvTransactionsPage } from "./inventory/InvTransactionsPage";
import { SuppliersPage } from "./suppliers/SuppliersPage";
import { PurchaseOrdersPage } from "./purchase-orders/PurchaseOrdersPage";
import { RidersPage } from "./riders/RidersPage";
import { CustomersPage } from "./customers/CustomersPage";
import { ReportsPage } from "./reports/ReportsPage";
import { SettingsPage } from "./settings/SettingsPage";
import { StockReceivingPage } from "./inventory/StockReceivingPage";
import { AdjustmentPage } from "./inventory/AdjustmentPage";
import { WasteSpoilagePage } from "./inventory/WasteSpoilagePage";

type ManagerPage =
  | "dashboard"
  | "orders"
  | "payments"
  | "kitchen-monitor"
  | "menu"
  | "inventory"
  | "inv-transactions"
  | "stock-receiving"
  | "adjustment"
  | "waste-spoilage"
  | "suppliers"
  | "purchase-orders"
  | "riders"
  | "customers"
  | "reports"
  | "settings";

const NAV_GROUPS: NavGroup<ManagerPage>[] = [
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
    label: "Menu & Inventory",
    items: [
      { id: "menu", label: "Menu Management", icon: BookOpen },
      { id: "inventory", label: "Inventory", icon: Package, badge: 3 },
      { id: "inv-transactions", label: "Inv. Transactions", icon: RefreshCw },
      {
        id: "stock-receiving",
        label: "Stock Receiving",
        icon: ArrowDownToLine,
      },
      { id: "adjustment", label: "Adjustment", icon: Sliders },
      { id: "waste-spoilage", label: "Waste & Spoilage", icon: Trash2 },
    ],
  },
  {
    label: "Procurement",
    items: [
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

export function ManagerApp() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [page, setPage] = useState<ManagerPage>("dashboard");

  const handleLogout = async () => {
  await logout();

  navigate("/auth?portal=staff", {
    replace: true,
  });
};

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <ManagerDashboard />;
      case "orders":
        return <OrdersPage />;
      case "payments":
        return <PaymentsPage />;
      case "kitchen-monitor":
        return <KitchenMonitorPage />;
      case "menu":
        return <MenuManagementPage />;
      case "inventory":
        return <InventoryPage />;
      case "inv-transactions":
        return <InvTransactionsPage />;
      case "stock-receiving":
        return <StockReceivingPage />;
      case "adjustment":
        return <AdjustmentPage />;
      case "waste-spoilage":
        return <WasteSpoilagePage />;
      case "suppliers":
        return <SuppliersPage />;
      case "purchase-orders":
        return <PurchaseOrdersPage />;
      case "riders":
        return <RidersPage />;
      case "customers":
        return <CustomersPage />;
      case "reports":
        return <ReportsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <ManagerDashboard />;
    }
  };

  return (
  <AppShell
    groups={NAV_GROUPS}
    active={page}
    onSelect={setPage}
    user={{ name: "Maria Reyes", role: "Manager" }}
    onLogout={() => {
      void handleLogout();
    }}
  >
      {renderPage()}
    </AppShell>
  );
}
