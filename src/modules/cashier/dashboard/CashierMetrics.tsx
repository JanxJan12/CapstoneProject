import {
  Banknote,
  CheckCheck,
  CreditCard,
  HandCoins,
  Package,
  PackageCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { ACTIVE_ORDER_STATUSES, formatMoney } from "../constants";
import { useCashierMetrics } from "../hooks/useCashierMetrics";
import type { CashierNavigationIntent, CashierPageId } from "../types";
import { CashierMetricCard } from "./CashierMetricCard";

export function CashierMetrics({
  onNavigate,
}: {
  onNavigate: (page: CashierPageId, intent?: CashierNavigationIntent) => void;
}) {
  const metrics = useCashierMetrics();
  const cards = [
    {
      label: "Pending Payments",
      value: String(metrics.pendingPayments),
      detail: "Awaiting cashier verification",
      icon: CreditCard,
      tone: "bg-amber-100 text-amber-700",
      action: () => onNavigate("pending-payments"),
    },
    {
      label: "Open Tickets",
      value: String(metrics.openTickets),
      detail: `${metrics.delayedOrders.length} currently delayed`,
      icon: Package,
      tone: "bg-blue-100 text-blue-700",
      action: () =>
        onNavigate("order-list", { statuses: ACTIVE_ORDER_STATUSES }),
    },
    {
      label: "Sales Today",
      value: formatMoney(metrics.salesToday),
      detail: `${metrics.completedTransactions} completed transactions`,
      icon: HandCoins,
      tone: "bg-emerald-100 text-emerald-700",
      action: () =>
        onNavigate("transactions", {
          transactionStatuses: ["Completed"],
          today: true,
        }),
    },
    {
      label: "Walk-in Orders",
      value: String(metrics.walkInOrders),
      detail: "Dine-in and take-out today",
      icon: Users,
      tone: "bg-violet-100 text-violet-700",
      action: () =>
        onNavigate("order-list", {
          orderTypes: ["Dine-in", "Take-out"],
          today: true,
        }),
    },
    {
      label: "Ready for Handoff",
      value: String(metrics.readyOrders),
      detail: "Kitchen-complete orders",
      icon: PackageCheck,
      tone: "bg-orange-100 text-orange-700",
      action: () =>
        onNavigate("order-list", {
          statuses: ["Ready"],
          openFirstReady: true,
        }),
    },
    {
      label: "Completed Transactions",
      value: String(metrics.completedTransactions),
      detail: "Recorded today",
      icon: CheckCheck,
      tone: "bg-teal-100 text-teal-700",
      action: () =>
        onNavigate("transactions", {
          transactionStatuses: ["Completed"],
          today: true,
        }),
    },
    {
      label: "Cash Sales",
      value: formatMoney(metrics.cashSales),
      detail: "Completed today",
      icon: Banknote,
      tone: "bg-lime-100 text-lime-700",
      action: () =>
        onNavigate("transactions", {
          transactionStatuses: ["Completed"],
          paymentMethods: ["Cash"],
          today: true,
        }),
    },
    {
      label: "GCash Sales",
      value: formatMoney(metrics.gcashSales),
      detail: "Verified today",
      icon: WalletCards,
      tone: "bg-sky-100 text-sky-700",
      action: () =>
        onNavigate("transactions", {
          transactionStatuses: ["Completed"],
          paymentMethods: ["GCash"],
          today: true,
        }),
    },
  ];

  return (
    <section aria-label="Cashier summary metrics">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <CashierMetricCard key={card.label} {...card} onClick={card.action} />
        ))}
      </div>
    </section>
  );
}
