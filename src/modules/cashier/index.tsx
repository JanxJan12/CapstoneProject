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
import { CashierConfirmDialog } from "./components/CashierUI";

export function CashierApp() {
  return <CashierModule />;
}

function CashierModule() {
  const { state, markNotificationRead, markNotificationsRead } =
    useCashierStore();
  const { logout } = useAuth();
  const [page, setPage] = useState<CashierPageId>("dashboard");
  const [intent, setIntent] = useState<CashierNavigationIntent>();
  const [posDirty, setPosDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    page: CashierPageId;
    intent?: CashierNavigationIntent;
  }>();
  const groups = useMemo<NavGroup<CashierPageId>[]>(
    () => [
      {
        label: "Operations",
        items: [
          {
            id: "dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
            shortcut: "F1",
          },
          {
            id: "pending-payments",
            label: "Pending Payments",
            icon: CreditCard,
            shortcut: "F3",
            badge: state.payments.filter((entry) => entry.status === "Pending")
              .length,
          },
          {
            id: "walkin-pos",
            label: "Walk-in POS",
            icon: ShoppingCart,
            shortcut: "F2",
          },
          {
            id: "order-list",
            label: "Order List",
            icon: ClipboardList,
            shortcut: "F4",
          },
          {
            id: "transactions",
            label: "Transaction History",
            icon: History,
            shortcut: "F6",
          },
          {
            id: "shift-settlement",
            label: "Shift Settlement",
            icon: Banknote,
            shortcut: "F7",
          },
        ],
      },
    ],
    [state.payments],
  );

  const commitNavigation = useCallback(
    (nextPage: CashierPageId, nextIntent?: CashierNavigationIntent) => {
      setPage(nextPage);
      setIntent(nextIntent);
    },
    [],
  );

  const navigate = useCallback(
    (nextPage: CashierPageId, nextIntent?: CashierNavigationIntent) => {
      if (page === "walkin-pos" && nextPage !== "walkin-pos" && posDirty) {
        setPendingNavigation({ page: nextPage, intent: nextIntent });
        return;
      }
      commitNavigation(nextPage, nextIntent);
    },
    [commitNavigation, page, posDirty],
  );

  const openNotification = useCallback(
    (notificationId: string) => {
      const notification = state.notifications.find(
        (entry) => entry.id === notificationId,
      );
      if (!notification) return;
      markNotificationRead(notificationId);
      navigate(notification.page, notification.intent);
    },
    [markNotificationRead, navigate, state.notifications],
  );

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if (editing) return;
      if (page === "walkin-pos" && ["F2", "F3"].includes(event.key)) return;
      const shortcutPages: Partial<Record<string, CashierPageId>> = {
        F1: "dashboard",
        F2: "walkin-pos",
        F3: "pending-payments",
        F4: "order-list",
        F6: "transactions",
        F7: "shift-settlement",
      };
      const shortcutPage = shortcutPages[event.key];
      if (shortcutPage) {
        event.preventDefault();
        navigate(shortcutPage);
        return;
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
  }, [navigate, page]);

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
        onNotificationSelect={openNotification}
        onLogout={logout}
      >
        {content}
      </AppShell>
      <CashierConfirmDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(undefined);
        }}
        title="Leave the active order?"
        description="Your cart is saved on this device, but leaving the POS interrupts the current checkout flow."
        confirmLabel="Leave POS"
        cancelLabel="Stay here"
        danger
        onConfirm={() => {
          if (pendingNavigation) {
            commitNavigation(pendingNavigation.page, pendingNavigation.intent);
          }
          setPendingNavigation(undefined);
        }}
      />
      <Toaster
        richColors
        closeButton
        expand
        visibleToasts={4}
        position="top-right"
        toastOptions={{
          duration: 3600,
          classNames: {
            toast:
              "cashier-toast rounded-xl border-border font-medium shadow-xl",
            success: "cashier-toast-success",
            warning: "cashier-toast-warning",
            error: "cashier-toast-error",
            title: "text-xs font-black",
            description: "text-[11px] leading-4",
          },
        }}
      />
    </>
  );
}
