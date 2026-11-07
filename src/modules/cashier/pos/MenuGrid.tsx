import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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
  search: string;
  bestSellerIds: string[];
  activeItemId?: string;
  onCategoryChange: (category: string) => void;
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
}

export function MenuGrid({
  menuItems,
  cart,
  category,
  search,
  bestSellerIds,
  activeItemId,
  onCategoryChange,
  onSelect,
  onQuickAdd,
}: MenuGridProps) {
  const bestSellers = useMemo(() => new Set(bestSellerIds), [bestSellerIds]);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const soldOutCount = useMemo(
    () => menuItems.filter((item) => !item.available).length,
    [menuItems],
  );
  const searching = Boolean(search.trim());
  const showAll = showUnavailable || searching;
  const matches = useMemo(
    () => filterMenuItems(menuItems, category, search, bestSellers),
    [bestSellers, category, menuItems, search],
  );
  const filtered = useMemo(
    () => (showAll ? matches : matches.filter((item) => item.available)),
    [matches, showAll],
  );
  return (
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pos-menu-browser flex min-h-0 flex-1">
        <CategorySidebar
          menuItems={menuItems}
          value={category}
          showUnavailable={showAll}
          onChange={onCategoryChange}
        />

        <div className="pos-menu-results flex min-w-0 flex-1 flex-col overflow-hidden">
          {searching || soldOutCount ? <div className="pos-menu-section-heading flex shrink-0 flex-wrap items-center justify-end gap-3 px-3 pb-2 pt-3">
            {searching ? (
              <p className="pos-search-includes-unavailable">Search includes sold-out matches</p>
            ) : soldOutCount ? (
              <button
                type="button"
                aria-pressed={showUnavailable}
                onClick={() => setShowUnavailable((shown) => !shown)}
                className="pos-availability-toggle min-h-10 rounded-lg border px-3 text-xs font-semibold"
              >
                {showUnavailable ? "Hide unavailable" : `Show unavailable (${soldOutCount})`}
              </button>
            ) : null}
          </div> : null}

          {filtered.length ? (
            <VirtualizedProductGrid
              items={filtered}
              cart={cart}
              bestSellerIds={bestSellerIds}
              activeItemId={activeItemId}
              onSelect={onSelect}
              onQuickAdd={onQuickAdd}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyState
                icon={Search}
                title="No menu items found"
                description={
                  !showUnavailable && !searching && soldOutCount
                    ? "No available items here. Use Show unavailable to see sold-out products."
                    : "Try another name, alias, or category."
                }
                className="pos-empty-state w-full max-w-md"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
