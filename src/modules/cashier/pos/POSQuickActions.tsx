import {
  BadgePercent,
  CircleX,
  CreditCard,
  PauseCircle,
  RotateCcw,
} from "lucide-react";

const ACTIONS = [
  { id: "checkout", label: "Checkout", hint: "F3", icon: CreditCard },
  { id: "new", label: "New", hint: "Ctrl+N", icon: RotateCcw },
  { id: "discount", label: "Discount", hint: "Ctrl+D", icon: BadgePercent },
  { id: "hold", label: "Hold", hint: "Ctrl+H", icon: PauseCircle },
  { id: "cancel", label: "Cancel", hint: "Esc", icon: CircleX },
] as const;

export type QuickActionId = (typeof ACTIONS)[number]["id"];

export function POSQuickActions({
  busy,
  hasItems,
  onAction,
}: {
  busy: boolean;
  hasItems: boolean;
  onAction: (action: QuickActionId) => void;
}) {
  return (
    <nav className="pos-quick-actions" aria-label="POS keyboard quick actions">
      {ACTIONS.map(({ id, label, hint, icon: Icon }) => (
        <button
          key={id}
          type="button"
          disabled={busy || (!hasItems && id !== "new")}
          onClick={() => onAction(id)}
          className="pos-quick-action"
          title={`${label} (${hint})`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
          <kbd>{hint}</kbd>
        </button>
      ))}
    </nav>
  );
}
