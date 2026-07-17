import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { AlertTriangle, Flame, PauseCircle, Search, Zap } from "lucide-react";
import { EmptyState } from "../components";
import type { MenuItem } from "../types";
import { CategorySidebar } from "./CategorySidebar";
import { filterMenuItems } from "./posOperations";
import { SearchBar } from "./SearchBar";
import type { POSCartLine } from "./types";
import { VirtualizedProductGrid } from "./VirtualizedProductGrid";

export interface MenuGridProps {
  menuItems: MenuItem[];
  searchRef?: RefObject<HTMLInputElement | null>;
  cart: POSCartLine[];
  category: string;
  search: string;
  recentSearches: string[];
  bestSellerIds: string[];
  heldOrderCount: number;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onCommitSearch: (search: string) => void;
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
}

export function MenuGrid({
  menuItems,
  searchRef,
  cart,
  category,
  search,
  recentSearches,
  bestSellerIds,
  heldOrderCount,
  onCategoryChange,
  onSearchChange,
  onCommitSearch,
  onSelect,
  onQuickAdd,
}: MenuGridProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const bestSellers = useMemo(() => new Set(bestSellerIds), [bestSellerIds]);
  const soldOutCount = useMemo(
    () =>
      menuItems.filter(
        (item) => !item.available || item.inventoryRemaining === 0,
      ).length,
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
  useEffect(() => setActiveIndex(-1), [category, search]);
  const activeItem = filtered[activeIndex];
  const title = category === "All" ? "Popular dishes" : category;

  const moveResult = useCallback(
    (direction: 1 | -1) => {
      if (!filtered.length) return;
      setActiveIndex((current) => {
        if (current < 0) return direction > 0 ? 0 : filtered.length - 1;
        return (current + direction + filtered.length) % filtered.length;
      });
    },
    [filtered.length],
  );
  const quickAddActiveResult = useCallback(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const target =
      filtered.find(
        (item) => item.code.toLocaleLowerCase() === normalizedSearch,
      ) ??
      activeItem ??
      filtered[0];
    if (target?.available) onQuickAdd(target);
  }, [activeItem, filtered, onQuickAdd, search]);
  const handleSearchChange = useCallback(
    (value: string) => {
      if (value.trim() && category !== "All") onCategoryChange("All");
      onSearchChange(value);
    },
    [category, onCategoryChange, onSearchChange],
  );
  const handleCategoryChange = useCallback(
    (value: string) => {
      onSearchChange("");
      onCategoryChange(value);
    },
    [onCategoryChange, onSearchChange],
  );
  return (
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="pos-menu-toolbar flex items-center gap-3 border-b p-3">
        <div className="pos-command-label hidden shrink-0 sm:block">
          <span>Menu command</span>
          <strong>Name or code</strong>
        </div>
        <SearchBar
          value={search}
          resultCount={filtered.length}
          recentSearches={recentSearches}
          activeResultId={
            activeItem ? `pos-product-${activeItem.id}` : undefined
          }
          inputRef={searchRef}
          onChange={handleSearchChange}
          onCommit={onCommitSearch}
          onMove={moveResult}
          onEnter={quickAddActiveResult}
          onEscape={() => setActiveIndex(-1)}
        />
        <div className="pos-code-hint hidden shrink-0 lg:block">
          <kbd>B1</kbd>
          <span>+ Enter</span>
        </div>
      </div>
      <div className="pos-menu-browser flex min-h-0 flex-1">
        <CategorySidebar
          menuItems={menuItems}
          value={category}
          bestSellerCount={bestSellerIds.length}
          onChange={handleCategoryChange}
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
              activeItemId={activeItem?.id}
              onSelect={onSelect}
              onQuickAdd={onQuickAdd}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyState
                icon={Search}
                title="No menu items found"
                description="Try another name, alias, or category."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
