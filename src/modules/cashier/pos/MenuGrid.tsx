import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { Search, Star, X } from "lucide-react";
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
  searchVisible: boolean;
  search: string;
  recentIds: string[];
  recentSearches: string[];
  bestSellerIds: string[];
  favoriteIds: string[];
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onCommitSearch: (search: string) => void;
  onCloseSearch: () => void;
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
  onToggleFavorite: (itemId: string) => void;
}

export function MenuGrid({
  menuItems,
  searchRef,
  cart,
  category,
  searchVisible,
  search,
  recentIds,
  recentSearches,
  bestSellerIds,
  favoriteIds,
  onCategoryChange,
  onSearchChange,
  onCommitSearch,
  onCloseSearch,
  onSelect,
  onQuickAdd,
  onToggleFavorite,
}: MenuGridProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const recent = useMemo(() => new Set(recentIds), [recentIds]);
  const bestSellers = useMemo(() => new Set(bestSellerIds), [bestSellerIds]);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const filtered = useMemo(
    () =>
      filterMenuItems(
        menuItems,
        category,
        search,
        recent,
        bestSellers,
        favorites,
      ),
    [bestSellers, category, favorites, menuItems, recent, search],
  );
  useEffect(() => setActiveIndex(-1), [category, search]);
  const activeItem = filtered[activeIndex];
  const title =
    category === "All"
      ? "Popular dishes"
      : category === "Recently ordered"
        ? "Recently ordered"
        : category;

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
    const target = activeItem ?? filtered[0];
    if (target?.available) onQuickAdd(target);
  }, [activeItem, filtered, onQuickAdd]);
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
  const closeSearch = useCallback(() => {
    onSearchChange("");
    setActiveIndex(-1);
    onCloseSearch();
  }, [onCloseSearch, onSearchChange]);

  return (
    <div className="pos-menu-grid flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {searchVisible ? (
        <div className="pos-menu-toolbar pos-menu-toolbar-reveal flex items-center gap-2 border-b p-3">
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
            onEscape={() => {
              setActiveIndex(-1);
              if (!search.trim()) onCloseSearch();
            }}
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close product search"
            title="Close search"
            className="pos-search-close flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="pos-menu-browser flex min-h-0 flex-1">
        <CategorySidebar
          menuItems={menuItems}
          value={category}
          recentCount={recentIds.length}
          bestSellerCount={bestSellerIds.length}
          favoriteCount={favoriteIds.length}
          onChange={handleCategoryChange}
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
              {search ? `“${search}” · ` : ""}
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
              activeItemId={activeItem?.id}
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
                    : "Try another name, alias, or category."
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
