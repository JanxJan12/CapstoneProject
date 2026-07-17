import { memo, useState, type RefObject } from "react";
import { Clock3, Flame, Search, X } from "lucide-react";
import { CashierInput } from "../components";
import { POPULAR_MENU_SEARCHES } from "../constants";

export interface SearchBarProps {
  value: string;
  resultCount: number;
  recentSearches: string[];
  activeResultId?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onMove: (direction: 1 | -1) => void;
  onEnter: () => void;
  onEscape: () => void;
}

export const SearchBar = memo(function SearchBar({
  value,
  resultCount,
  recentSearches,
  activeResultId,
  inputRef,
  onChange,
  onCommit,
  onMove,
  onEnter,
  onEscape,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const showSuggestions = focused && !value.trim();
  const chooseSearch = (search: string) => {
    onChange(search);
    onCommit(search);
    inputRef?.current?.focus();
  };

  return (
    <div
      className="pos-search-wrap relative min-w-0 flex-1"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <CashierInput
        ref={inputRef}
        role="combobox"
        aria-label="Search products by item code, name, or alias"
        aria-keyshortcuts="F2 / ArrowDown ArrowUp Enter Escape"
        aria-controls="pos-product-results"
        aria-expanded={showSuggestions}
        aria-activedescendant={activeResultId}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            onMove(1);
          } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            onMove(-1);
          } else if (event.key === "Enter") {
            event.preventDefault();
            onCommit(value);
            onEnter();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
            onEscape();
          }
        }}
        placeholder="Type item code or product name — F2"
        className="pl-9 pr-20"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear product search"
          onClick={() => {
            onChange("");
            onEscape();
            inputRef?.current?.focus();
          }}
          className="pos-search-clear absolute right-12 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
      <kbd className="pos-search-shortcut pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[9px] font-black">
        F2
      </kbd>

      {showSuggestions ? (
        <div className="pos-search-suggestions absolute inset-x-0 top-[calc(100%+0.35rem)] z-40 rounded-xl border p-3 shadow-2xl">
          {recentSearches.length ? (
            <SearchGroup
              icon={Clock3}
              label="Recent searches"
              searches={recentSearches}
              onChoose={chooseSearch}
            />
          ) : null}
          <SearchGroup
            icon={Flame}
            label="Popular searches"
            searches={[...POPULAR_MENU_SEARCHES]}
            onChoose={chooseSearch}
          />
          <p className="mt-2 text-[9px] font-semibold text-muted-foreground">
            Exact code + Enter adds immediately · ↑↓ selects a result
          </p>
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {resultCount} matching products
      </span>
    </div>
  );
});

function SearchGroup({
  icon: Icon,
  label,
  searches,
  onChoose,
}: {
  icon: React.ElementType;
  label: string;
  searches: string[];
  onChoose: (search: string) => void;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" /> {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {searches.map((search) => (
          <button
            key={search}
            type="button"
            onClick={() => onChoose(search)}
            className="pos-search-chip min-h-9 rounded-lg border px-2.5 text-[10px] font-bold"
          >
            {search}
          </button>
        ))}
      </div>
    </div>
  );
}
