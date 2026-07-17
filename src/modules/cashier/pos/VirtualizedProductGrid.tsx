import { memo, useEffect, useMemo, useRef, useState } from "react";
import { MENU_GRID_OVERSCAN_ROWS, MENU_GRID_ROW_HEIGHT_PX } from "../constants";
import type { MenuItem } from "../types";
import { ProductCard } from "./ProductCard";
import type { POSCartLine } from "./types";

export interface VirtualizedProductGridProps {
  items: MenuItem[];
  cart: POSCartLine[];
  recentIds: string[];
  bestSellerIds: string[];
  favoriteIds: string[];
  activeItemId?: string;
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
  activeItemId,
  onSelect,
  onQuickAdd,
  onToggleFavorite,
}: VirtualizedProductGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | undefined>(undefined);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState({ width: 760, height: 600 });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () =>
      setViewport((current) => {
        const next = {
          width: element.clientWidth,
          height: element.clientHeight,
        };
        return current.width === next.width && current.height === next.height
          ? current
          : next;
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [items]);

  useEffect(
    () => () => {
      if (scrollFrame.current !== undefined) {
        window.cancelAnimationFrame(scrollFrame.current);
      }
    },
    [],
  );

  const columns =
    viewport.width >= 1450
      ? 6
      : viewport.width >= 1160
        ? 5
        : viewport.width >= 880
          ? 4
          : viewport.width >= 620
            ? 3
            : viewport.width >= 360
              ? 2
              : 1;
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

  useEffect(() => {
    if (!activeItemId) return;
    const index = items.findIndex((item) => item.id === activeItemId);
    if (index < 0) return;
    const row = Math.floor(index / columns);
    const top = row * MENU_GRID_ROW_HEIGHT_PX;
    const bottom = top + MENU_GRID_ROW_HEIGHT_PX;
    const element = viewportRef.current;
    if (!element) return;
    if (top < element.scrollTop) element.scrollTo({ top });
    else if (bottom > element.scrollTop + element.clientHeight) {
      element.scrollTo({ top: bottom - element.clientHeight });
    }
  }, [activeItemId, columns, items]);

  return (
    <div
      ref={viewportRef}
      onScroll={(event) => {
        const nextScrollTop = event.currentTarget.scrollTop;
        if (scrollFrame.current !== undefined) return;
        scrollFrame.current = window.requestAnimationFrame(() => {
          setScrollTop(nextScrollTop);
          scrollFrame.current = undefined;
        });
      }}
      className="pos-product-viewport min-h-0 flex-1 overflow-y-auto px-3 pb-3"
      aria-label="Menu products"
      id="pos-product-results"
      role="listbox"
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
              <ProductCard
                item={item}
                quantity={quantities.get(item.id) ?? 0}
                favorite={favorites.has(item.id)}
                bestSeller={bestSellers.has(item.id)}
                recentlyOrdered={recent.has(item.id)}
                keyboardActive={activeItemId === item.id}
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
