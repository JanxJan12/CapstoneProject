import { useEffect } from "react";
import { ArrowRight, ShoppingBag, Utensils } from "lucide-react";
import type { WalkInOrderType } from "./types";

const ORDER_TYPES = [
  {
    type: "Dine-in",
    description: "Serve here",
    shortcut: "D",
    icon: Utensils,
  },
  {
    type: "Take-out",
    description: "Pack for pickup",
    shortcut: "T",
    icon: ShoppingBag,
  },
] as const;

export function OrderTypeGate({
  busy,
  shiftOpen,
  currentType,
  onCancel,
  onSelect,
  onOpenShift,
}: {
  busy: boolean;
  shiftOpen: boolean;
  currentType: WalkInOrderType;
  onCancel?: () => void;
  onSelect: (type: WalkInOrderType) => void;
  onOpenShift: () => void;
}) {
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (busy || event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== "d" && key !== "t") return;

      event.preventDefault();
      onSelect(key === "d" ? "Dine-in" : "Take-out");
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [busy, onCancel, onSelect]);

  const changingExistingOrder = Boolean(onCancel);

  return (
    <section className="pos-order-type-gate" aria-labelledby="order-type-title">
      <div className="pos-order-type-content">
        <p className="pos-order-type-eyebrow">
          {changingExistingOrder ? "Active order" : "Walk-in POS"}
        </p>
        <h1 id="order-type-title">
          {changingExistingOrder ? "Change order type" : "Select order type"}
        </h1>
        {changingExistingOrder ? <p className="pos-order-type-intro">Items stay in the order.</p> : null}
        {!shiftOpen ? (
          <div className="pos-order-type-shift-note" role="status">
            <span>Shift closed · Browse the menu, then open a shift before payment.</span>
            <button type="button" onClick={onOpenShift}>Open shift</button>
          </div>
        ) : null}

        <div className="pos-order-type-options" aria-label="Order type">
          {ORDER_TYPES.map(
            ({ type, description, shortcut, icon: OrderTypeIcon }, index) => (
              <button
                key={type}
                type="button"
                autoFocus={index === 0}
                disabled={busy}
                aria-keyshortcuts={shortcut}
                aria-current={
                  changingExistingOrder && currentType === type
                    ? "true"
                    : undefined
                }
                onClick={() => onSelect(type)}
                className="pos-order-type-option"
              >
                <span className="pos-order-type-icon">
                  <OrderTypeIcon className="h-7 w-7" aria-hidden="true" />
                </span>
                <span className="pos-order-type-copy">
                  <strong>{type}</strong>
                  <small>{description}</small>
                </span>
                <span className="pos-order-type-enter">
                  <kbd>{shortcut}</kbd>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            ),
          )}
        </div>

        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="pos-order-type-back"
          >
            Back to current order <kbd>Esc</kbd>
          </button>
        ) : null}
      </div>
    </section>
  );
}
