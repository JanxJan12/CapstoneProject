import { CircleX, PauseCircle, Radio, RotateCcw } from "lucide-react";
import type { HeldOrder } from "../types";
import { CashierSelect } from "../components";
import type { WalkInOrderType } from "./types";

export function POSOrderHeader({
  orderType,
  busy,
  shiftOpen,
  heldOrders,
  onOrderTypeChange,
  hasItems,
  canCancel,
  onNew,
  onHold,
  onCancel,
  onReopen,
}: {
  orderType: WalkInOrderType;
  busy: boolean;
  shiftOpen: boolean;
  heldOrders: HeldOrder[];
  hasItems: boolean;
  canCancel: boolean;
  onOrderTypeChange: (type: WalkInOrderType) => void;
  onNew: () => void;
  onHold: () => void;
  onCancel: () => void;
  onReopen: (id: string) => void;
}) {
  return (
    <div className="pos-order-header border-b border-border bg-gradient-to-r from-white via-[#fffaf5] to-orange-50/30 p-2 shadow-[0_4px_14px_rgba(67,42,23,0.035)]">
      <div className="pos-order-fields flex flex-wrap items-center gap-2.5">
        <div
          className="pos-workstation-status hidden items-center gap-2 lg:flex"
          data-live={shiftOpen || undefined}
        >
          <span>
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div>
            <small>Counter workstation</small>
            <strong>{shiftOpen ? "Live · Shift open" : "Shift closed"}</strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            Order
          </span>
          <div
            className="flex min-h-10 items-center rounded-xl border border-border bg-muted/70 p-1 shadow-inner"
            role="radiogroup"
            aria-label="Order type"
          >
            {(["Dine-in", "Take-out"] as const).map((type) => (
              <button
                type="button"
                key={type}
                role="radio"
                aria-checked={orderType === type}
                onClick={() => onOrderTypeChange(type)}
                disabled={busy}
                className={`flex min-h-8 cursor-pointer items-center rounded-lg px-4 text-xs font-black transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${orderType === type ? "bg-white text-primary shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:text-foreground"}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        {heldOrders.length > 0 && (
          <div className="min-w-[150px]">
            <CashierSelect
              id="held-order"
              aria-label="Reopen a held order"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) onReopen(event.target.value);
                event.target.value = "";
              }}
              className="min-h-10 w-full rounded-xl border border-border bg-white px-3 text-xs font-bold"
            >
              <option value="">Reopen held…</option>
              {heldOrders.map((held) => (
                <option key={held.id} value={held.id}>
                  {held.id} ·{" "}
                  {held.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  items
                </option>
              ))}
            </CashierSelect>
          </div>
        )}
        <div className="pos-order-actions ml-auto flex flex-wrap gap-1.5">
          <Action
            label="New"
            icon={RotateCcw}
            onClick={onNew}
            disabled={busy}
          />
          <Action
            label="Hold"
            icon={PauseCircle}
            onClick={onHold}
            disabled={busy || !hasItems}
          />
          <Action
            label="Cancel Order"
            icon={CircleX}
            danger
            onClick={onCancel}
            disabled={busy || !canCancel}
          />
        </div>
      </div>
    </div>
  );
}

function Action({
  label,
  icon: Icon,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-black shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-40 ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-border bg-white text-muted-foreground hover:border-primary/25 hover:bg-amber-50/40 hover:text-foreground"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
