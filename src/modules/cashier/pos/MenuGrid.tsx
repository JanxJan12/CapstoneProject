import { useMemo } from "react";
import { AlertTriangle, Flame, PauseCircle, Search, Zap } from "lucide-react";
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
  heldOrderCount: number;
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
  heldOrderCount,
  onCategoryChange,
  onSelect,
  onQuickAdd,
}: MenuGridProps) {
  const bestSellers = useMemo(() => new Set(bestSellerIds), [bestSellerIds]);
  const soldOutCount = useMemo(
    () => menuItems.filter((item) => !item.available).length,
    [menuItems],
  );
  const fastLaneItems = useMemo(
    () =>
      bestSellerIds
        .map((id) => menuItems.find((item) => item.id === id))
        .filter((item): item is MenuItem => Boolean(item?.available))
        .slice(0, 3),
    [bestSellerIds, menuItems],
  );
  const filtered = useMemo(
    () => filterMenuItems(menuItems, category, search, bestSellers),
    [bestSellers, category, menuItems, search],
  );
  const title = category === "All" ? "Popular dishes" : category;
  return (
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pos-menu-browser flex min-h-0 flex-1">
        <CategorySidebar
          menuItems={menuItems}
          value={category}
          bestSellerCount={bestSellerIds.length}
          onChange={onCategoryChange}
        />

        <div className="pos-menu-results flex min-w-0 flex-1 flex-col overflow-hidden">
          {!cart.length && !search.trim() ? (
            <section className="pos-idle-tools" aria-label="Quick order tools">
              <div className="pos-idle-ready">
                <span>
                  <Zap className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <strong>Ready for next order</strong>
                  <small>Use a menu key or type a code</small>
                </div>
              </div>
              <div className="pos-fast-lane" aria-label="Popular today">
                <span>
                  <Flame className="h-3.5 w-3.5" /> Popular
                </span>
                {fastLaneItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onQuickAdd(item)}
                    title={`Quick add ${item.name}`}
                  >
                    <b>{item.code}</b>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
              <div className="pos-idle-signals">
                <span>
                  <PauseCircle className="h-3.5 w-3.5" />
                  {heldOrderCount} held
                </span>
                <span className={soldOutCount ? "is-warning" : ""}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {soldOutCount} unavailable
                </span>
              </div>
            </section>
          ) : null}
          <div className="pos-menu-section-heading flex shrink-0 items-end justify-between gap-3 px-3 pb-2 pt-3">
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">
                Menu selection
              </span>
              <h2 className="mt-0.5 text-base font-black">{title}</h2>
            </div>
            <span className="text-[9px] text-[var(--pos-muted)]">
              {search ? `“${search}” · ` : ""}
              {filtered.length} items
            </span>
          </div>

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
                description="Try another name, alias, or category."
                className="pos-empty-state w-full max-w-md"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
