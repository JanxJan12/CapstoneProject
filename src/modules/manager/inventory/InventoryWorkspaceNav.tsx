import {
  ArrowDownToLine,
  ClipboardList,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";

export type InventoryWorkspacePage =
  "inventory" | "stock-receiving" | "adjustment" | "inv-transactions";

const INVENTORY_WORKSPACE_ITEMS: Array<{
  id: InventoryWorkspacePage;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: "inventory", label: "Overview", icon: LayoutGrid },
  { id: "stock-receiving", label: "Receiving", icon: ArrowDownToLine },
  { id: "adjustment", label: "Adjustments", icon: SlidersHorizontal },
  { id: "inv-transactions", label: "Transactions", icon: ClipboardList },
];

export function InventoryWorkspaceNav({
  active,
  onNavigate,
}: {
  active: InventoryWorkspacePage;
  onNavigate: (page: InventoryWorkspacePage) => void;
}) {
  return (
    <nav
      aria-label="Inventory workspace"
      className="inventory-workspace-nav mb-4 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_1px_2px_rgba(67,42,23,0.03)]"
    >
      <div className="flex min-w-max items-center gap-1">
        {INVENTORY_WORKSPACE_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
              className={
                "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                (isActive
                  ? "bg-[#2b1b12] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
