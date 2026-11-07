import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Banknote,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  ShoppingCart,
} from "lucide-react";
import { Toaster } from "sonner";

import { AppShell } from "../../components/layout/AppShell";
import type { NavGroup } from "../../types";

import { useAuth } from "@/app/providers/AuthProvider";
import { CashierProvider, useCashierStore } from "./hooks/CashierStore";

import type {
  CashierNavigationIntent,
  CashierPageId,
} from "./types";

import { CashierDashboardPage } from "./dashboard/CashierDashboardPage";
import { PendingPaymentsPage } from "./payments/PendingPaymentsPage";
import { WalkInPOSPage } from "./pos/WalkInPOSPage";
import { OrdersReceiptsPage } from "./OrdersReceiptsPage";
import { cashierPathFor, resolveCashierPath } from "./ordersReceiptsNavigation";
import { cashierHydrationView } from "./cashierHydrationView";
import { ShiftSettlementPage } from "./shifts/ShiftSettlementPage";
import { ConfirmationDialog, ErrorBanner } from "./components";

export function CashierApp() {
  return (
    <CashierProvider>
      <CashierModule />
    </CashierProvider>
  );
}

function CashierModule() {
  const {
    state,
    isHydrating,
    databaseError,
    refreshDatabaseState,
    menuAvailabilityError,
    refreshMenuAvailability,
    markNotificationRead,
    markNotificationsRead,
  } = useCashierStore();

  const { session, logout } = useAuth();

  const location = useLocation();
  const routerNavigate = useNavigate();
  const destination = resolveCashierPath(location.pathname);
  const page = destination.page;
  const hydrationView = cashierHydrationView(isHydrating, databaseError);
  const intent = (location.state as { cashierIntent?: CashierNavigationIntent } | null)?.cashierIntent;

  useEffect(() => {
    if (location.pathname !== destination.canonicalPath) {
      routerNavigate(destination.canonicalPath, { replace: true, state: location.state });
    }
  }, [destination.canonicalPath, location.pathname, location.state, routerNavigate]);

  const [posDirty, setPosDirty] =
    useState(false);

  const [pendingNavigation, setPendingNavigation] =
    useState<{
      page: CashierPageId;
      intent?: CashierNavigationIntent;
      notificationId?: string;
    }>();

  /*
   * Real logged-in account from Supabase/AuthProvider.
   * This replaces the prototype state.cashier.name.
   */
  const accountName =
    session?.name?.trim() || "Cashier";

  const accountRole = session?.role
    ? session.role.charAt(0).toUpperCase() +
      session.role.slice(1)
    : "Cashier";

  const groups = useMemo<
    NavGroup<CashierPageId>[]
  >(
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
            badge: state.payments.filter(
              (entry) =>
                entry.status === "Pending",
            ).length,
          },
          {
            id: "walkin-pos",
            label: "Walk-in POS",
            icon: ShoppingCart,
            shortcut: "F2",
          },
          {
            id: "orders-receipts",
            label: "Orders & Receipts",
            icon: ClipboardList,
            shortcut: "F4",
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
    (
      nextPage: CashierPageId,
      nextIntent?: CashierNavigationIntent,
    ) => {
      routerNavigate(cashierPathFor(nextPage, nextIntent?.workspaceView), {
        state: { cashierIntent: nextIntent },
      });
    },
    [routerNavigate],
  );

  const navigate = useCallback(
    (
      nextPage: CashierPageId,
      nextIntent?: CashierNavigationIntent,
    ) => {
      if (
        page === "walkin-pos" &&
        nextPage !== "walkin-pos" &&
        posDirty
      ) {
        setPendingNavigation({
          page: nextPage,
          intent: nextIntent,
        });

        return;
      }

      commitNavigation(
        nextPage,
        nextIntent,
      );
    },
    [
      commitNavigation,
      page,
      posDirty,
    ],
  );

  const openNotification = useCallback(
    (notificationId: string) => {
      const notification =
        state.notifications.find(
          (entry) =>
            entry.id === notificationId,
        );

      if (!notification) {
        return;
      }

      if (page === "walkin-pos" && notification.page !== "walkin-pos" && posDirty) {
        setPendingNavigation({
          page: notification.page,
          intent: notification.intent,
          notificationId,
        });
        return;
      }

      markNotificationRead(notificationId);
      commitNavigation(notification.page, notification.intent);
    },
    [
      markNotificationRead,
      commitNavigation,
      page,
      posDirty,
      state.notifications,
    ],
  );

  useEffect(() => {
    const shortcuts = (
      event: KeyboardEvent,
    ) => {
      const target =
        event.target as HTMLElement;

      const editing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (editing) {
        return;
      }

      if (
        page === "walkin-pos" &&
        ["F2", "F3"].includes(
          event.key,
        )
      ) {
        return;
      }

      const shortcutPages: Partial<
        Record<
          string,
          CashierPageId
        >
      > = {
        F1: "dashboard",
        F2: "walkin-pos",
        F3: "pending-payments",
        F4: "orders-receipts",
        F6: "transactions",
        F7: "shift-settlement",
      };

      const shortcutPage =
        shortcutPages[event.key];

      if (shortcutPage) {
        event.preventDefault();

        navigate(
          shortcutPage,
        );

        return;
      }

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          "f" &&
        !editing
      ) {
        event.preventDefault();

        navigate(page === "orders-receipts" && destination.view === "receipts"
          ? "transactions" : "order-list", { focusSearch: true });
      }
    };

    window.addEventListener(
      "keydown",
      shortcuts,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        shortcuts,
      );
  }, [navigate, page, destination.view]);

  const content =
    page === "dashboard" ? (
      <CashierDashboardPage
        onNavigate={navigate}
      />
    ) : page ===
      "pending-payments" ? (
<PendingPaymentsPage intent={intent} />
    ) : page === "walkin-pos" ? (
      <WalkInPOSPage
        onDirtyChange={
          setPosDirty
        }
        onOpenShift={() => navigate("shift-settlement")}
      />
    ) : page === "orders-receipts" ? (
      <OrdersReceiptsPage
        view={destination.view}
        intent={intent}
        onNavigate={navigate}
      />
    ) : (
      <ShiftSettlementPage onReviewPayments={() => navigate("pending-payments")} />
    );

  return (
    <>
      <AppShell
        groups={groups}
        active={page}
        onSelect={(next) =>
          navigate(next)
        }
        user={{
          name: accountName,
          role: accountRole,
        }}
        notifications={
          state.notifications
        }
        onNotificationsRead={
          markNotificationsRead
        }
        onNotificationSelect={
          openNotification
        }
        onLogout={logout}
      >
        <div className="flex h-full min-h-0 flex-col">
          {databaseError || menuAvailabilityError ? (
            <div className={page === "walkin-pos" ? "p-4 pb-0" : "mb-4"}>
              <ErrorBanner
                message={databaseError || menuAvailabilityError}
                onRetry={
                  databaseError
                    ? refreshDatabaseState
                    : () => {
                        void refreshMenuAvailability(true).catch(() => {
                          // The store keeps the retry error visible.
                        });
                      }
                }
              />
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            {hydrationView === "failed" ? (
              <div
                role="status"
                className="rounded-xl border border-border bg-card px-4 py-10 text-center text-xs font-semibold text-muted-foreground"
              >
                Cashier operations are unavailable. Use Retry above to load them.
              </div>
            ) : hydrationView === "loading" && page !== "dashboard" ? (
              <div
                role="status"
                className="rounded-xl border border-border bg-card px-4 py-10 text-center text-xs font-semibold text-muted-foreground"
              >
                Loading cashier operations…
              </div>
            ) : (
              content
            )}
          </div>
        </div>
      </AppShell>

      <ConfirmationDialog
        open={Boolean(
          pendingNavigation,
        )}
        onOpenChange={(open) => {
          if (!open) {
            setPendingNavigation(
              undefined,
            );
          }
        }}
        title="Leave the active order?"
        description="Your order is saved on this device, but leaving the POS interrupts the current payment flow."
        confirmLabel="Leave POS"
        cancelLabel="Stay here"
        danger
        onConfirm={() => {
          if (
            pendingNavigation
          ) {
            if (pendingNavigation.notificationId) {
              markNotificationRead(pendingNavigation.notificationId);
            }
            commitNavigation(
              pendingNavigation.page,
              pendingNavigation.intent,
            );
          }

          setPendingNavigation(
            undefined,
          );
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
            success:
              "cashier-toast-success",
            warning:
              "cashier-toast-warning",
            error:
              "cashier-toast-error",
            title:
              "text-xs font-black",
            description:
              "text-[11px] leading-4",
          },
        }}
      />
    </>
  );
}
