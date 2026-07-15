import {
  Beef,
  CupSoda,
  Flame,
  Grid2X2,
  History,
  Salad,
  Search,
  Soup,
  Star,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { useMemo, type RefObject } from "react";
import { MENU_CATEGORIES } from "../constants";
import type { MenuItem } from "../types";
import { CashierInput, EmptyState } from "../components";
import type { POSCartLine } from "./types";
import { VirtualizedProductGrid } from "./VirtualizedProductGrid";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: Grid2X2,
  Viands: Beef,
  Soups: Soup,
  Vegetables: Salad,
  Rice: Wheat,
  Beverages: CupSoda,
};

const QUICK_VIEWS = [
  { id: "Recently ordered", label: "Recent", icon: History },
  { id: "Best sellers", label: "Best sellers", icon: Flame },
  { id: "Favorites", label: "Favorites", icon: Star },
] as const;

export function MenuGrid({
  menuItems,
  searchRef,
  cart,
  category,
  search,
  recentIds,
  bestSellerIds,
  favoriteIds,
  onCategoryChange,
  onSearchChange,
  onSelect,
  onQuickAdd,
  onToggleFavorite,
}: {
  menuItems: MenuItem[];
  searchRef?: RefObject<HTMLInputElement | null>;
  cart: POSCartLine[];
  category: string;
  search: string;
  recentIds: string[];
  bestSellerIds: string[];
  favoriteIds: string[];
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
  onToggleFavorite: (itemId: string) => void;
}) {
  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const recent = new Set(recentIds);
    const bestSellers = new Set(bestSellerIds);
    const favorites = new Set(favoriteIds);

    return menuItems.filter((item) => {
      const inView =
        category === "All" ||
        item.category === category ||
        (category === "Recently ordered" && recent.has(item.id)) ||
        (category === "Best sellers" && bestSellers.has(item.id)) ||
        (category === "Favorites" && favorites.has(item.id));
      const matchesSearch =
        !normalizedSearch ||
        `${item.name} ${item.description} ${item.category}`
          .toLowerCase()
          .includes(normalizedSearch);
      return inView && matchesSearch;
    });
  }, [bestSellerIds, category, favoriteIds, menuItems, recentIds, search]);

  const title =
    category === "All"
      ? "Popular dishes"
      : category === "Recently ordered"
        ? "Recently ordered"
        : category;

  return (
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pos-menu-toolbar flex items-center gap-2 border-b p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <CashierInput
            ref={searchRef}
            aria-label="Search menu"
            aria-keyshortcuts="F2 /"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search menu items — F2"
            className="pl-9 pr-14"
          />
          <kbd className="pos-search-shortcut pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[9px] font-black">
            F2
          </kbd>
        </div>
        <span
          className="pos-menu-result-count hidden shrink-0 rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-wider sm:block"
          aria-live="polite"
        >
          {filtered.length} items
        </span>
      </div>

      <div className="pos-menu-browser flex min-h-0 flex-1">
        <nav
          className="pos-category-rail shrink-0 overflow-auto border-r p-2"
          aria-label="Menu categories and quick views"
        >
          <p className="pos-category-label px-2 pb-1 pt-1 text-[8px] font-black uppercase tracking-[0.18em]">
            Quick views
          </p>
          {QUICK_VIEWS.map(({ id, label, icon: Icon }) => {
            const count =
              id === "Recently ordered"
                ? recentIds.length
                : id === "Best sellers"
                  ? bestSellerIds.length
                  : favoriteIds.length;
            return (
              <button
                type="button"
                key={id}
                aria-pressed={category === id}
                onClick={() => onCategoryChange(id)}
                className={`pos-category-button ${category === id ? "is-active" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            );
          })}

          <p className="pos-category-label px-2 pb-1 pt-3 text-[8px] font-black uppercase tracking-[0.18em]">
            Categories
          </p>
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

        <div className="pos-menu-results flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="pos-menu-section-heading flex shrink-0 items-end justify-between gap-3 px-3 pb-2 pt-3">
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">
                Menu selection
              </span>
              <h2 className="mt-0.5 text-base font-black">{title}</h2>
            </div>
            {search && (
              <span className="truncate text-[9px]">
                Results for “{search}”
              </span>
            )}
          </div>

          {filtered.length ? (
            <VirtualizedProductGrid
              items={filtered}
              cart={cart}
              recentIds={recentIds}
              bestSellerIds={bestSellerIds}
              favoriteIds={favoriteIds}
              onSelect={onSelect}
              onQuickAdd={onQuickAdd}
              onToggleFavorite={onToggleFavorite}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyState
                icon={category === "Favorites" ? Star : Search}
                title={
                  category === "Favorites"
                    ? "No favorites yet"
                    : "No menu items found"
                }
                description={
                  category === "Favorites"
                    ? "Use the star on a product card to build a fast-access list."
                    : "Try another search term or category."
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
