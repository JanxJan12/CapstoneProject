import { useEffect } from "react";
import { ArrowRight, ShoppingBag, Utensils } from "lucide-react";
import type { WalkInOrderType } from "./types";

const ORDER_TYPES = [
  {
    type: "Dine-in",
    description: "Serve the order for dining at RRJ Food-House.",
    shortcut: "D",
    icon: Utensils,
  },
  {
    type: "Take-out",
    description: "Pack the order for counter pickup.",
    shortcut: "T",
    icon: ShoppingBag,
  },
] as const;

export function OrderTypeGate({
  busy,
  currentType,
  onCancel,
  onSelect,
}: {
  busy: boolean;
  currentType: WalkInOrderType;
  onCancel?: () => void;
  onSelect: (type: WalkInOrderType) => void;
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
          {changingExistingOrder ? "Active order" : "New order · Step 1"}
        </p>
        <h1 id="order-type-title">
          {changingExistingOrder ? "Change order type" : "Select order type"}
        </h1>
        <p className="pos-order-type-intro">
          {changingExistingOrder
            ? "Choose a new fulfillment type. Current order items are preserved."
            : "Choose how this order will be fulfilled. The menu opens next."}
        </p>

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

        <p className="pos-order-type-hint">
          Select a card or press <kbd>D</kbd> / <kbd>T</kbd>
        </p>

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
