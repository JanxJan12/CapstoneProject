import type { ElementType } from "react";
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
  detail?: string;
  icon: ElementType;
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
      className="
        rrj-card grid gap-2 p-2
        lg:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.75fr)]
      "
      aria-labelledby="cashier-actions-title"
    >
      <h2 id="cashier-actions-title" className="sr-only">
        Primary cashier actions
      </h2>

      <button
        type="button"
        disabled={!shiftActive}
        onClick={onNewOrder}
        className="
          cashier-action group flex min-h-[72px] items-center gap-3
          rounded-xl bg-gradient-to-r from-primary to-orange-600
          px-4 text-left text-white
          shadow-[0_6px_16px_rgba(184,79,10,0.18)]
          transition
          hover:-translate-y-0.5
          hover:shadow-[0_9px_20px_rgba(184,79,10,0.24)]
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-primary
          focus-visible:ring-offset-2
          disabled:cursor-not-allowed
          disabled:opacity-50
          disabled:hover:translate-y-0
        "
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black">
            New walk-in order
          </span>

        </span>

        <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-mono text-[9px] font-black text-white/90">
          F2
        </kbd>
      </button>

      <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
        <SecondaryAction
          label="Review payments"
          icon={CreditCard}
          count={attention.pendingPayments}
          onClick={onVerifyPayments}
        />

        <SecondaryAction
          label="Ready orders"
          icon={PackageCheck}
          count={attention.readyOrders}
          onClick={onReleaseOrders}
        />

        <SecondaryAction
          label="Find order"
          icon={Search}
          onClick={onSearchOrder}
        />

        <SecondaryAction
          label="Reprint receipt"
          icon={Printer}
          onClick={onReprintReceipt}
        />
      </div>
    </section>
  );
}

function SecondaryAction({
  label,
  detail,
  icon: Icon,
  count,
  onClick,
}: ActionButtonProps) {
  const hasCount = typeof count === "number" && count > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        cashier-action group flex min-h-[64px] items-center gap-2.5
        rounded-[10px] border border-border/60 bg-white/45
        px-2.5 text-left transition
        hover:border-primary/20
        hover:bg-white/80
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-primary
        focus-visible:ring-offset-1
      "
      aria-label={hasCount ? `${label}, ${count} requiring attention` : label}
    >
      <span
        className="
          flex h-10 w-10 shrink-0 items-center justify-center
          rounded-lg bg-muted/65 text-primary/80
          transition group-hover:bg-primary/10 group-hover:text-primary
        "
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black leading-4 text-foreground/90">
          {label}
        </span>

        {detail ? <span
          className={[
            "mt-0.5 block text-[9px] font-semibold leading-3",
            hasCount ? "text-primary" : "text-muted-foreground",
          ].join(" ")}
        >
          {detail}
        </span> : null}
      </span>

      {hasCount ? (
        <span
          className="
            flex h-5 min-w-5 shrink-0 items-center justify-center
            rounded-full bg-primary/10 px-1.5
            text-[9px] font-black text-primary
          "
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
