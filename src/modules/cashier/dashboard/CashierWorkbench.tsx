import {
  ArrowRight,
  CreditCard,
  LogOut,
  PackageCheck,
  Printer,
  Search,
  ShoppingCart,
} from "lucide-react";
import { useCashierMetrics } from "../hooks/useCashierMetrics";
import type { CashierNavigationIntent, CashierPageId } from "../types";

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
      <div className="mb-4">
        <h2 className="text-sm font-black tracking-tight text-foreground">
          Cashier Workbench
        </h2>
        <p className="text-[11px] font-semibold text-muted-foreground">
          Fast, task-focused actions for the active counter
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(
          ({ label, detail, icon: Icon, action, primary, disabled }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              disabled={disabled}
              className={`group flex min-h-[76px] items-center gap-3 rounded-xl border px-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45 ${primary ? "col-span-2 border-primary bg-gradient-to-r from-primary to-orange-600 text-primary-foreground shadow-md shadow-orange-900/10 hover:-translate-y-0.5 hover:shadow-lg" : "border-border bg-white/90 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-amber-50/30 hover:shadow-md"}`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${primary ? "bg-white/15" : "bg-amber-50 text-primary"}`}
              >
                <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-black sm:text-xs">
                  {label}
                </span>
                <span
                  className={`mt-0.5 block line-clamp-1 text-[9px] font-semibold sm:text-[10px] ${primary ? "text-white/70" : "text-muted-foreground"}`}
                >
                  {detail}
                </span>
              </span>
              <ArrowRight className="hidden h-4 w-4 shrink-0 opacity-35 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70 sm:block" />
            </button>
          ),
        )}
      </div>
    </section>
  );
}
