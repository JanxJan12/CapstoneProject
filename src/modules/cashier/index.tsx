import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  ClipboardList,
  CreditCard,
  History,
  LayoutDashboard,
  ShoppingCart,
} from "lucide-react";
import { Toaster } from "sonner";
import { AppShell } from "../../components/layout/AppShell";
import type { NavGroup } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useCashierStore } from "./hooks/CashierStore";
import type { CashierNavigationIntent, CashierPageId } from "./types";
import { CashierDashboardPage } from "./dashboard/CashierDashboardPage";
import { PendingPaymentsPage } from "./payments/PendingPaymentsPage";
import { WalkInPOSPage } from "./pos/WalkInPOSPage";
import { CashierOrderListPage } from "./orders/CashierOrderListPage";
import { TransactionHistoryPage } from "./transactions/TransactionHistoryPage";
import { ShiftSettlementPage } from "./shifts/ShiftSettlementPage";

export function CashierApp() {
  return <CashierModule />;
}

function CashierModule() {
  const { state, markNotificationsRead } = useCashierStore();
  const { logout } = useAuth();
  const [page, setPage] = useState<CashierPageId>("dashboard");
  const [intent, setIntent] = useState<CashierNavigationIntent>();
  const [posDirty, setPosDirty] = useState(false);
  const groups = useMemo<NavGroup<CashierPageId>[]>(
    () => [
      {
        label: "Operations",
        items: [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          {
            id: "pending-payments",
            label: "Pending Payments",
            icon: CreditCard,
            badge: state.payments.filter((entry) => entry.status === "Pending")
              .length,
          },
          { id: "walkin-pos", label: "Walk-in POS", icon: ShoppingCart },
          { id: "order-list", label: "Order List", icon: ClipboardList },
          { id: "transactions", label: "Transaction History", icon: History },
          { id: "shift-settlement", label: "Shift Settlement", icon: Banknote },
        ],
      },
    ],
    [state.payments],
  );

  const navigate = useCallback(
    (nextPage: CashierPageId, nextIntent?: CashierNavigationIntent) => {
      if (
        page === "walkin-pos" &&
        nextPage !== "walkin-pos" &&
        posDirty &&
        !window.confirm(
          "Leave Walk-in POS? The active cart has unsaved changes.",
        )
      )
        return;
      setPage(nextPage);
      setIntent(nextIntent);
    },
    [page, posDirty],
  );

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if (event.key === "F2") {
        event.preventDefault();
        navigate("walkin-pos");
      }
      if (event.key === "F3") {
        event.preventDefault();
        navigate("pending-payments");
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "f" &&
        !editing
      ) {
        event.preventDefault();
        navigate("order-list", { focusSearch: true });
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [navigate]);

  const content =
    page === "dashboard" ? (
      <CashierDashboardPage onNavigate={navigate} />
    ) : page === "pending-payments" ? (
      <PendingPaymentsPage />
    ) : page === "walkin-pos" ? (
      <WalkInPOSPage onDirtyChange={setPosDirty} />
    ) : page === "order-list" ? (
      <CashierOrderListPage intent={intent} />
    ) : page === "transactions" ? (
      <TransactionHistoryPage intent={intent} />
    ) : (
      <ShiftSettlementPage />
    );

  return (
    <>
      <AppShell
        groups={groups}
        active={page}
        onSelect={(next) => navigate(next)}
        user={{ name: state.cashier.name, role: "Cashier" }}
        notifications={state.notifications}
        onNotificationsRead={markNotificationsRead}
        onLogout={logout}
      >
        {content}
      </AppShell>
      <Toaster richColors position="top-right" closeButton />
    </>
  );
}
