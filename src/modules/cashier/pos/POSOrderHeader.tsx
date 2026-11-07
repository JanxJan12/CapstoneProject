import {
  CircleX,
  PauseCircle,
  Radio,
  RotateCcw,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import type { HeldOrder } from "../types";
import { CashierSelect } from "../components";
import { SearchBar, type SearchBarProps } from "./SearchBar";
import type { WalkInOrderType } from "./types";

export function POSOrderHeader({
  orderType,
  busy,
  shiftOpen,
  heldOrders,
  search,
  hasItems,
  canCancel,
  onNew,
  onHold,
  onCancel,
  onReopen,
  onSelectOrderType,
}: {
  orderType: WalkInOrderType;
  busy: boolean;
  shiftOpen: boolean;
  heldOrders: HeldOrder[];
  search: SearchBarProps;
  hasItems: boolean;
  canCancel: boolean;
  onNew: () => void;
  onHold: () => void;
  onCancel: () => void;
  onReopen: (id: string) => void;
  onSelectOrderType: (type: WalkInOrderType) => void;
}) {
  return (
    <div
      className="pos-order-header border-b border-border bg-gradient-to-r from-white via-[#fffaf5] to-orange-50/30 p-2 shadow-[0_4px_14px_rgba(67,42,23,0.035)]"
      data-has-items={hasItems || undefined}
    >
      <div className="pos-order-fields flex flex-wrap items-center gap-1.5">
        <div
          className="pos-workstation-status hidden items-center gap-2 lg:flex"
          data-live={shiftOpen || undefined}
        >
          <span>
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div>
            <small>Counter workstation</small>
            <strong>{shiftOpen ? "Shift open" : "Shift closed"}</strong>
          </div>
        </div>
        <div className="pos-header-command flex min-w-[240px] flex-1 items-center gap-1.5">
          <SearchBar {...search} />
          <div className="pos-order-type-switch" role="group" aria-label="Order type">
            {(["Dine-in", "Take-out"] as const).map((type) => {
              const Icon = type === "Dine-in" ? Utensils : ShoppingBag;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={orderType === type}
                  disabled={busy}
                  onClick={() => onSelectOrderType(type)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{type === "Take-out" ? "Takeout" : type}</span>
                </button>
              );
            })}
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
              className="min-h-12 w-full rounded-xl border border-border bg-white px-3 text-xs font-bold"
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
        <div className="pos-order-actions ml-auto flex flex-wrap gap-1">
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
            label="Cancel"
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
      aria-label={danger ? "Cancel draft order" : label}
      className={`inline-flex min-h-12 items-center gap-1.5 rounded-xl border px-2.5 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-40 ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-border bg-white text-muted-foreground hover:border-primary/25 hover:bg-amber-50/40 hover:text-foreground"}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
