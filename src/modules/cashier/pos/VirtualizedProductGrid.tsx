import { memo, useEffect, useMemo, useRef, useState } from "react";
import { MENU_GRID_OVERSCAN_ROWS, MENU_GRID_ROW_HEIGHT_PX } from "../constants";
import type { MenuItem } from "../types";
import { MenuItemCard } from "./MenuItemCard";
import type { POSCartLine } from "./types";

export interface VirtualizedProductGridProps {
  items: MenuItem[];
  cart: POSCartLine[];
  recentIds: string[];
  bestSellerIds: string[];
  favoriteIds: string[];
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
  onToggleFavorite: (itemId: string) => void;
}

export const VirtualizedProductGrid = memo(function VirtualizedProductGrid({
  items,
  cart,
  recentIds,
  bestSellerIds,
  favoriteIds,
  onSelect,
  onQuickAdd,
  onToggleFavorite,
}: VirtualizedProductGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState({ width: 760, height: 600 });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () =>
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [items]);

  const columns = viewport.width >= 720 ? 3 : viewport.width >= 360 ? 2 : 1;
  const totalRows = Math.ceil(items.length / columns);
  const startRow = Math.max(
    0,
    Math.floor(scrollTop / MENU_GRID_ROW_HEIGHT_PX) - MENU_GRID_OVERSCAN_ROWS,
  );
  const visibleRows =
    Math.ceil(viewport.height / MENU_GRID_ROW_HEIGHT_PX) +
    MENU_GRID_OVERSCAN_ROWS * 2;
  const endRow = Math.min(totalRows, startRow + visibleRows);
  const visibleItems = items.slice(startRow * columns, endRow * columns);
  const recent = useMemo(() => new Set(recentIds), [recentIds]);
  const bestSellers = useMemo(() => new Set(bestSellerIds), [bestSellerIds]);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const quantities = useMemo(() => {
    const result = new Map<string, number>();
    for (const entry of cart) {
      result.set(
        entry.menuItemId,
        (result.get(entry.menuItemId) ?? 0) + entry.quantity,
      );
    }
    return result;
  }, [cart]);

  return (
    <div
      ref={viewportRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className="pos-product-viewport min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      aria-label="Menu products"
    >
      <div
        className="relative"
        style={{ height: Math.max(1, totalRows * MENU_GRID_ROW_HEIGHT_PX) }}
      >
        <div
          className="pos-product-grid absolute inset-x-0 grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            transform: `translateY(${startRow * MENU_GRID_ROW_HEIGHT_PX}px)`,
          }}
        >
          {visibleItems.map((item) => (
            <div key={item.id} style={{ height: MENU_GRID_ROW_HEIGHT_PX - 12 }}>
              <MenuItemCard
                item={item}
                quantity={quantities.get(item.id) ?? 0}
                favorite={favorites.has(item.id)}
                bestSeller={bestSellers.has(item.id)}
                recentlyOrdered={recent.has(item.id)}
                onSelect={() => onSelect(item)}
                onQuickAdd={() => onQuickAdd(item)}
                onToggleFavorite={() => onToggleFavorite(item.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
