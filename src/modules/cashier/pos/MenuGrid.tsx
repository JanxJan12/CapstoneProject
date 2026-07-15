import { useMemo } from "react";
import { Search, Star } from "lucide-react";
import { EmptyState } from "../components";
import type { MenuItem } from "../types";
import { CategorySidebar } from "./CategorySidebar";
import { filterMenuItems } from "./posOperations";
import type { POSCartLine } from "./types";
import { VirtualizedProductGrid } from "./VirtualizedProductGrid";

export interface MenuGridProps {
  menuItems: MenuItem[];
  cart: POSCartLine[];
  category: string;
  recentIds: string[];
  bestSellerIds: string[];
  favoriteIds: string[];
  onCategoryChange: (category: string) => void;
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
  onToggleFavorite: (itemId: string) => void;
}

export function MenuGrid({
  menuItems,
  cart,
  category,
  recentIds,
  bestSellerIds,
  favoriteIds,
  onCategoryChange,
  onSelect,
  onQuickAdd,
  onToggleFavorite,
}: MenuGridProps) {
  const recent = useMemo(() => new Set(recentIds), [recentIds]);
  const bestSellers = useMemo(() => new Set(bestSellerIds), [bestSellerIds]);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const filtered = useMemo(
    () =>
      filterMenuItems(menuItems, category, "", recent, bestSellers, favorites),
    [bestSellers, category, favorites, menuItems, recent],
  );
  const title =
    category === "All"
      ? "Popular dishes"
      : category === "Recently ordered"
        ? "Recently ordered"
        : category;

  return (
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pos-menu-browser flex min-h-0 flex-1">
        <CategorySidebar
          menuItems={menuItems}
          value={category}
          recentCount={recentIds.length}
          bestSellerCount={bestSellerIds.length}
          favoriteCount={favoriteIds.length}
          onChange={onCategoryChange}
        />

        <div className="pos-menu-results flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="pos-menu-section-heading flex shrink-0 items-end justify-between gap-3 px-3 pb-2 pt-3">
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">
                Menu selection
              </span>
              <h2 className="mt-0.5 text-base font-black">{title}</h2>
            </div>
            <span className="text-[9px] text-[var(--pos-muted)]">
              {filtered.length} items
            </span>
          </div>

          {filtered.length ? (
            <VirtualizedProductGrid
              items={filtered}
              cart={cart}
              recentIds={recentIds}
              bestSellerIds={bestSellerIds}
              favoriteIds={favoriteIds}
              activeItemId={undefined}
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
                    : "Choose another menu category."
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
