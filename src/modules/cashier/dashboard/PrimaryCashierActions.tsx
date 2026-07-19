import {
  CreditCard,
  PackageCheck,
  Printer,
  Search,
  ShoppingCart,
} from "lucide-react";
import type { CashierAttentionSummary } from "../types";

interface ActionButtonProps {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  count?: number;
}

export function PrimaryCashierActions({
  attention,
  shiftActive,
  onNewOrder,
  onVerifyPayments,
  onReleaseOrders,
  onSearchOrder,
  onReprintReceipt,
}: {
  attention: CashierAttentionSummary;
  shiftActive: boolean;
  onNewOrder: () => void;
  onVerifyPayments: () => void;
  onReleaseOrders: () => void;
  onSearchOrder: () => void;
  onReprintReceipt: () => void;
}) {
  return (
    <section
      className="rrj-card grid gap-2.5 p-3 lg:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.6fr)]"
      aria-labelledby="cashier-actions-title"
    >
      <h2 id="cashier-actions-title" className="sr-only">
        Primary cashier actions
      </h2>
      <button
        type="button"
        disabled={!shiftActive}
        onClick={onNewOrder}
        className="cashier-action group flex min-h-[72px] items-center gap-3 rounded-xl bg-gradient-to-r from-primary to-orange-600 px-4 text-left text-white shadow-[0_7px_18px_rgba(184,79,10,0.2)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(184,79,10,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">New Walk-in Order</span>
          <span className="mt-1 block text-[10px] font-semibold text-white/70">
            Start dine-in or take-out sale
          </span>
        </span>
        <kbd className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-[10px] font-black text-white/90">
          F2
        </kbd>
      </button>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <SecondaryAction
          label="Verify Payments"
          icon={CreditCard}
          count={attention.pendingPayments}
          onClick={onVerifyPayments}
        />
        <SecondaryAction
          label="Release Orders"
          icon={PackageCheck}
          count={attention.readyOrders}
          onClick={onReleaseOrders}
        />
        <SecondaryAction
          label="Search Order"
          icon={Search}
          onClick={onSearchOrder}
        />
        <SecondaryAction
          label="Reprint Receipt"
          icon={Printer}
          onClick={onReprintReceipt}
        />
      </div>
    </section>
  );
}

function SecondaryAction({
  label,
  icon: Icon,
  count,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cashier-action group flex min-h-[72px] items-center gap-2.5 rounded-xl border border-border/80 bg-white/80 px-3 text-left hover:border-primary/25 hover:bg-amber-50/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      aria-label={`${label}${count ? `, ${count} waiting` : ""}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-[10px] font-black leading-4 text-foreground">
        {label}
      </span>
      {count ? (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
