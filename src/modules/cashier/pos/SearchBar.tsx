import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type RefObject,
} from "react";
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
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedInputRef = inputRef ?? fallbackInputRef;

  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);

  const hasValue = Boolean(value.trim());
  const isExpanded = expanded || focused || hasValue;
  const showSuggestions = focused && !hasValue;

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      resolvedInputRef.current?.focus();
    });
  }, [resolvedInputRef]);

  const openSearch = useCallback(() => {
    setExpanded(true);
    focusInput();
  }, [focusInput]);

  const closeSearch = useCallback(() => {
    setFocused(false);
    setExpanded(false);
    resolvedInputRef.current?.blur();
  }, [resolvedInputRef]);

  const clearSearch = useCallback(() => {
    onChange("");
    onEscape();
    focusInput();
  }, [focusInput, onChange, onEscape]);

  const chooseSearch = useCallback(
    (search: string) => {
      setExpanded(true);
      onChange(search);
      onCommit(search);
      focusInput();
    },
    [focusInput, onChange, onCommit],
  );

  useEffect(() => {
    if (hasValue) {
      setExpanded(true);
    }
  }, [hasValue]);

  return (
    <div
      className={`
        pos-search-wrap
        relative h-10 shrink-0
        transition-[width]
        duration-200
        ease-[cubic-bezier(.22,1,.36,1)]
        motion-reduce:transition-none
        max-w-full
        ${isExpanded ? "w-full sm:w-[430px]" : "w-full sm:w-[240px]"}
      `}
      onFocusCapture={() => {
        setFocused(true);
        setExpanded(true);
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;

        if (event.currentTarget.contains(nextTarget)) return;

        setFocused(false);

        if (!value.trim()) {
          setExpanded(false);
        }
      }}
    >
      <Search
        className="
          pointer-events-none absolute left-3 top-1/2 z-20
          h-4 w-4 -translate-y-1/2
          text-muted-foreground
        "
        aria-hidden="true"
      />

      <CashierInput
        ref={resolvedInputRef}
        role="combobox"
        aria-label="Search products by item code, name, or alias"
        aria-keyshortcuts="F2 ArrowDown ArrowUp Enter Escape"
        aria-controls="pos-product-results"
        aria-expanded={showSuggestions}
        aria-activedescendant={activeResultId}
        autoComplete="off"
        value={value}
        onClick={() => {
          if (!isExpanded) openSearch();
        }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onMove(1);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            onMove(-1);
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();

            const committedValue = value.trim();

            if (!committedValue) return;

            onCommit(committedValue);
            onEnter();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();

            onChange("");
            onEscape();
            closeSearch();
          }
        }}
        placeholder={
          isExpanded ? "Enter item code or product name" : "Search / Item Code"
        }
        className="
          h-10 w-full rounded-xl
          pl-9 pr-14
          text-[11px] font-bold
          transition-[border-color,box-shadow,background-color]
          duration-150
        "
      />

      {hasValue ? (
        <button
          type="button"
          aria-label="Clear product search"
          onClick={clearSearch}
          className="
            pos-search-clear
            absolute right-11 top-1/2 z-30
            flex h-7 w-7 -translate-y-1/2
            items-center justify-center rounded-lg
          "
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}

      <button
        type="button"
        aria-label={
          isExpanded ? "Collapse product search" : "Open product search"
        }
        onClick={() => {
          if (isExpanded) {
            onChange("");
            onEscape();
            closeSearch();
          } else {
            openSearch();
          }
        }}
        className="
          absolute right-2 top-1/2 z-30
          flex h-7 min-w-7 -translate-y-1/2
          items-center justify-center rounded-md
        "
      >
        <kbd className="pointer-events-none rounded border px-1.5 py-0.5 text-[9px] font-black">
          {isExpanded ? "Esc" : "F2"}
        </kbd>
      </button>

      {showSuggestions ? (
        <div
          className="
            pos-search-suggestions
            absolute inset-x-0 top-[calc(100%+0.35rem)] z-40
            rounded-xl border p-3 shadow-2xl
            animate-in fade-in-0 slide-in-from-top-1
            duration-150
          "
        >
          {recentSearches.length > 0 ? (
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
            Exact code + Enter adds immediately · Use ↑ and ↓ to select
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
  icon: ElementType;
  label: string;
  searches: string[];
  onChoose: (search: string) => void;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {searches.map((search) => (
          <button
            key={search}
            type="button"
            onClick={() => onChoose(search)}
            className="
              pos-search-chip
              min-h-9 rounded-lg border px-2.5
              text-[10px] font-bold
            "
          >
            {search}
          </button>
        ))}
      </div>
    </div>
  );
}
