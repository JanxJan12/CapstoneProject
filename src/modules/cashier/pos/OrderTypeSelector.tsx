import { ShoppingBag, Truck, UtensilsCrossed } from "lucide-react";
import type { POSForm } from "../schemas";

const ORDER_TYPES = [
  {
    value: "Dine-in",
    title: "Dine-in",
    description: "Serve at a dining table",
    icon: UtensilsCrossed,
  },
  {
    value: "Take-out",
    title: "Take-out",
    description: "Pack for counter pickup",
    icon: ShoppingBag,
  },
  {
    value: "Delivery",
    title: "Delivery",
    description: "Collect customer and address details",
    icon: Truck,
  },
] as const satisfies ReadonlyArray<{
  value: POSForm["orderType"];
  title: string;
  description: string;
  icon: React.ElementType;
}>;

export function OrderTypeSelector({
  onSelect,
}: {
  onSelect: (type: POSForm["orderType"]) => void;
}) {
  return (
    <section className="pos-order-type-gate flex min-h-0 flex-1 items-center justify-center p-5">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
            New order · Step 1
          </p>
          <h1 className="mt-2 text-2xl font-black">Select order type</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Choose how this order will be fulfilled. The menu opens next.
          </p>
        </div>
        <div
          className="mt-6 grid gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Order type"
        >
          {ORDER_TYPES.map(({ value, title, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked="false"
              onClick={() => onSelect(value)}
              className="pos-order-type-choice group flex min-h-44 flex-col items-center justify-center rounded-2xl border p-5 text-center transition-all duration-200"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <strong className="mt-4 text-base">{title}</strong>
              <span className="mt-1 text-[10px] leading-4 text-muted-foreground">
                {description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
