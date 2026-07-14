import { Search } from "lucide-react";
import { MENU_CATEGORIES } from "../constants";
import type { MenuItem, OrderItem } from "../types";
import { CashierInput, EmptyState } from "../components/CashierUI";
import { MenuItemCard } from "./MenuItemCard";

export function MenuGrid({
  menuItems,
  cart,
  category,
  search,
  onCategoryChange,
  onSearchChange,
  onSelect,
}: {
  menuItems: MenuItem[];
  cart: Array<Omit<OrderItem, "id">>;
  category: string;
  search: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onSelect: (item: MenuItem) => void;
}) {
  const filtered = menuItems.filter(
    (item) =>
      (category === "All" || item.category === category) &&
      (!search ||
        `${item.name} ${item.description}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return (
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden border-r border-border bg-[#fbf8f4]/60">
      <div className="space-y-2 border-b border-border bg-white/90 p-3 backdrop-blur-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <CashierInput
            aria-label="Search menu"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search menu items…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {MENU_CATEGORIES.map((entry) => (
            <button
              type="button"
              key={entry}
              onClick={() => onCategoryChange(entry)}
              className={`min-h-12 shrink-0 rounded-full border px-4 text-[10px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${category === entry ? "border-primary bg-gradient-to-r from-primary to-orange-600 text-white shadow-md shadow-orange-900/10" : "border-border bg-white text-muted-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary"}`}
            >
              {entry}
              <span className="ml-1.5 opacity-60">
                {entry === "All"
                  ? menuItems.length
                  : menuItems.filter((item) => item.category === entry).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                quantity={
                  cart.find((entry) => entry.menuItemId === item.id)
                    ?.quantity ?? 0
                }
                onSelect={() => onSelect(item)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No menu items found"
            description="Try another search term or category."
          />
        )}
      </div>
    </div>
  );
}
