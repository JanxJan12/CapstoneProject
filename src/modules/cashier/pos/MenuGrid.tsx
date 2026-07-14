import {
  Beef,
  CupSoda,
  Grid2X2,
  Salad,
  Search,
  Soup,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { MENU_CATEGORIES } from "../constants";
import type { MenuItem, OrderItem } from "../types";
import { CashierInput, EmptyState } from "../components/CashierUI";
import { MenuItemCard } from "./MenuItemCard";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: Grid2X2,
  Viands: Beef,
  Soups: Soup,
  Vegetables: Salad,
  Rice: Wheat,
  Beverages: CupSoda,
};

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
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pos-menu-toolbar flex items-center gap-2 border-b p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <CashierInput
            aria-label="Search menu"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search menu items…"
            className="pl-9"
          />
        </div>
        <span className="pos-menu-result-count hidden shrink-0 rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-wider sm:block">
          {filtered.length} items
        </span>
      </div>

      <div className="pos-menu-browser flex min-h-0 flex-1">
        <nav
          className="pos-category-rail shrink-0 overflow-auto border-r p-2"
          aria-label="Menu categories"
        >
          {MENU_CATEGORIES.map((entry) => {
            const Icon = CATEGORY_ICONS[entry] ?? Grid2X2;
            const count =
              entry === "All"
                ? menuItems.length
                : menuItems.filter((item) => item.category === entry).length;
            return (
              <button
                type="button"
                key={entry}
                aria-pressed={category === entry}
                onClick={() => onCategoryChange(entry)}
                className={`pos-category-button ${category === entry ? "is-active" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{entry}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </nav>

        <div className="pos-menu-results min-w-0 flex-1 overflow-y-auto p-3">
          <div className="pos-menu-section-heading mb-3 flex items-end justify-between gap-3">
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">
                Menu selection
              </span>
              <h2 className="mt-0.5 text-sm font-black">
                {category === "All" ? "Popular dishes" : category}
              </h2>
            </div>
            {search && (
              <span className="truncate text-[9px]">
                Results for “{search}”
              </span>
            )}
          </div>

          {filtered.length ? (
            <div className="pos-product-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
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
    </div>
  );
}
