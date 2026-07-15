import {
  CreditCard,
  LogOut,
  PackageCheck,
  Printer,
  Search,
  ShoppingCart,
} from "lucide-react";
import { useCashierMetrics } from "../hooks/useCashierMetrics";
import type { CashierNavigationIntent, CashierPageId } from "../types";
import { ActionCard, SectionHeading } from "../components";

export function CashierWorkbench({
  onNavigate,
  onSearchOrder,
  onReprintReceipt,
  onEndShift,
}: {
  onNavigate: (page: CashierPageId, intent?: CashierNavigationIntent) => void;
  onSearchOrder: () => void;
  onReprintReceipt: () => void;
  onEndShift: () => void;
}) {
  const metrics = useCashierMetrics();
  const actions = [
    {
      label: "New Walk-in Order",
      detail: "Dine-in or take-out POS · F2",
      icon: ShoppingCart,
      action: () => onNavigate("walkin-pos"),
      primary: true,
      disabled: !metrics.activeShift,
    },
    {
      label: "Verify GCash Payments",
      detail: `${metrics.pendingPayments} submissions waiting · F3`,
      icon: CreditCard,
      action: () => onNavigate("pending-payments"),
    },
    {
      label: "Release Ready Order",
      detail: `${metrics.readyOrders} ready for handoff`,
      icon: PackageCheck,
      action: () =>
        onNavigate("order-list", { statuses: ["Ready"], openFirstReady: true }),
    },
    {
      label: "Search Order",
      detail: "ID, customer, or contact · Ctrl/⌘ F",
      icon: Search,
      action: onSearchOrder,
    },
    {
      label: "Reprint Receipt",
      detail: "Choose a recent transaction",
      icon: Printer,
      action: onReprintReceipt,
    },
    {
      label: "End Shift",
      detail: "Count drawer and settle",
      icon: LogOut,
      action: onEndShift,
      disabled: !metrics.activeShift,
    },
  ];

  return (
    <section className="rrj-card p-4 sm:p-5">
      <SectionHeading
        title="Cashier Workbench"
        description="Fast, task-focused actions for the active counter"
        className="mb-4"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {actions.map(
          ({ label, detail, icon: Icon, action, primary, disabled }) => (
            <ActionCard
              key={label}
              onClick={action}
              disabled={disabled}
              label={label}
              detail={detail}
              icon={Icon}
              primary={primary}
            />
          ),
        )}
      </div>
    </section>
  );
}
