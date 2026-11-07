import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Minus, Search, X, BadgeCheck, ChevronRight, MapPin, UtensilsCrossed } from "lucide-react";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import rrjPhoto from "@/assets/brand/rrj-restaurant.jpg";
import { CustNav } from "./customerNav";
import { formatCustomerCurrency } from "./customerRecordedCharges";
import { loadCustomerDrinkChoiceRows } from "./customerCatalog";
import { customerProductPricesChanged, retainCustomerDrinkSelections } from "./customerBatch1";
import { CustomerMenuCartAside } from "./customerMenuCartAside";
import type { CustomerPage } from "./customerPageTypes";
import type { CartItem, CustomerDatabaseMenuItem, DatabaseMenuCategory, CustomerDrinkChoiceGroup, CustomerDrinkChoiceOption } from "./customerTypes";

function customerMenuImageSrc(imagePath: string | null): string | null {
  const path = imagePath?.trim();
  if (!path) return null;
  const localPath = path.startsWith("/") ? path : `/${path}`;
  return /^\/menu\/[a-z0-9/_-]+\.(?:avif|jpe?g|png|webp)$/i.test(localPath)
    ? localPath
    : null;
}

function MenuVisual({ item, imageSrc, large = false }: { item: CustomerDatabaseMenuItem; imageSrc: string; large?: boolean }) {
  return (
    <div className={`customer-menu-visual relative flex items-center justify-center overflow-hidden bg-muted ${large ? "h-56 sm:h-72" : "h-32 sm:h-40"}`}>
      <span className="customer-display-font px-4 text-center text-xl text-foreground">{item.category}</span>
      <img
        key={imageSrc}
        src={imageSrc}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(event) => { event.currentTarget.hidden = true; }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-card px-2 py-1 text-xs font-bold text-emerald-700 shadow-sm">
        <BadgeCheck className="h-3 w-3" /> Halal
      </span>
    </div>
  );
}

function FoodCard({
  item,
  onAdd,
  featured = false,
}: {
  item: CustomerDatabaseMenuItem;
  onAdd: (
    item: CustomerDatabaseMenuItem,
  ) => void;
  featured?: boolean;
}) {
  const imageSrc = customerMenuImageSrc(item.imagePath);
  return (
    <article
      className={`customer-food-row${featured ? " customer-featured-dish" : ""}${item.available ? " customer-food-row-clickable" : ""}`}
      onClick={(event) => {
        if (item.available && !(event.target as HTMLElement).closest("button")) onAdd(item);
      }}
    >
      {imageSrc ? <button
        type="button"
        onClick={() => onAdd(item)}
        disabled={!item.available}
        className="customer-food-row-image"
        aria-label={`${item.category === "Beverages" || item.withoutRicePrice !== undefined ? "Choose options for" : "Add"} ${item.name}${item.category === "Beverages" || item.withoutRicePrice !== undefined ? "" : " to cart"}`}
      >
        <img src={imageSrc} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} />
      </button> : null}
      <div className="customer-food-row-copy">
        <h3>{item.name}</h3>
        {item.desc ? <p>{item.desc}</p> : null}
        {!item.available ? <span className="customer-food-unavailable">Unavailable today</span> : null}
      </div>
      <div className="customer-food-row-side">
        <strong>{formatCustomerCurrency(item.price)}</strong>
        <button type="button" onClick={() => onAdd(item)} disabled={!item.available}>
          {item.available ? (item.category === "Beverages" || item.withoutRicePrice !== undefined ? "Choose options" : "Add to cart") : "Unavailable"}
        </button>
      </div>
    </article>
  );
}

function CustomerMenuFeedback({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-label="Loading menu">
        <span className="sr-only">Loading today&apos;s menu.</span>
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
            >
              <div className="h-32 animate-pulse bg-amber-100/60 motion-reduce:animate-none sm:h-40" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-4 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-11 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center"
    >
      <p className="text-base font-bold text-red-700">Unable to load the menu</p>
      <p className="mt-1 max-w-md text-sm leading-5 text-red-600">
        {error ?? "Please check your connection and try again."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-100"
      >
        Try Again
      </button>
    </div>
  );
}

// ── Shared Customer Nav ──────────────────────────────────────────
export function HomePage({
  cart,
  menuItems,
  categories,
  menuLoading,
  menuError,
  availabilityError,
  onNav,
  onBrowseCategory,
  onRetryMenu,
  onAddToCart,
}: {
  cart: CartItem[];
  menuItems: CustomerDatabaseMenuItem[];
  categories: DatabaseMenuCategory[];
  menuLoading: boolean;
  menuError: string | null;
  availabilityError: string | null;
  onNav: (page: CustomerPage) => void;
  onBrowseCategory: (category: string) => void;
  onRetryMenu: () => void;
  onAddToCart: (
    item: CustomerDatabaseMenuItem,
  ) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="home" />
      <div className="customer-storefront flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
          <section aria-label="About RRJ's Food-Haus" className="customer-home-banner mb-5 grid overflow-hidden rounded-2xl border border-border/70 bg-foreground shadow-sm">
            <div className="customer-home-photo min-w-0 overflow-hidden">
              <ImageWithFallback src={rrjPhoto} alt="RRJ's Food-Haus restaurant" className="h-full w-full object-cover object-[center_66%]" />
            </div>
            <div className="customer-home-intro min-w-0 p-4 sm:flex sm:flex-col sm:justify-center sm:p-6">
              <h1 className="customer-display-font text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">Comfort food, made for sharing.</h1>
              <div className="customer-home-actions mt-3 flex gap-2">
                <button onClick={() => onNav("menu")} className="customer-home-menu-action flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3 text-xs font-extrabold text-primary-foreground hover:bg-amber-700 active:scale-[0.98] motion-reduce:transform-none sm:px-5 sm:text-sm"><Search className="h-4 w-4" aria-hidden="true" /> Explore menu</button>
                <button onClick={() => onNav("history")} className="customer-home-track-action flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-bold text-foreground hover:text-primary active:scale-[0.98] motion-reduce:transform-none sm:px-5 sm:text-sm">Your orders</button>
              </div>
            </div>
          </section>
          {availabilityError && !menuLoading && !menuError ? (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>{availabilityError} Availability may have changed.</span>
              <button type="button" onClick={onRetryMenu} className="min-h-10 rounded-lg px-3 font-bold underline underline-offset-2">Refresh menu</button>
            </div>
          ) : null}
          {menuLoading || menuError ? (
            <CustomerMenuFeedback
              loading={menuLoading}
              error={menuError}
              onRetry={onRetryMenu}
            />
          ) : menuItems.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/75 px-6 py-8 text-center">
              <UtensilsCrossed aria-hidden="true" className="mb-3 h-8 w-8 text-primary" />
              <h2 className="text-base font-extrabold text-foreground">The menu is empty right now</h2>
              <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Please check again when dishes have been added to the menu.</p>
            </div>
          ) : (
            <>
          <div className="sr-only">
            <h2>Categories</h2>
          </div>
          <div className="customer-home-categories mb-6 flex gap-2 overflow-x-auto pb-2 sm:mb-8 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
            {[
                "All",
                ...categories.map(
                  (category) => category.name,
                ),
              ].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onBrowseCategory(cat)}
                    className="flex min-h-11 flex-none items-center justify-center whitespace-nowrap rounded-xl border border-border/80 bg-card px-4 py-2 text-center text-sm font-bold text-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary sm:min-w-0"
                  >
                    {cat}
                  </button>
              ))}
          </div>

          <div className="mb-3 flex items-end justify-between sm:mb-4">
            <h2 className="customer-display-font text-xl font-semibold text-foreground sm:text-2xl">Featured dishes</h2>
            <button onClick={() => onNav("menu")} className="flex min-h-11 items-center gap-1 rounded-lg bg-card px-2 text-xs font-extrabold text-foreground hover:bg-muted">View all</button>
          </div>
          {menuItems.some((item) => item.available) ? (
            <div className="customer-food-list customer-featured-list grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {menuItems.filter((item) => item.available).slice(0, 4).map((item) => (
                <FoodCard key={item.id} item={item} onAdd={onAddToCart} featured />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-card px-5 py-7 text-center text-sm text-muted-foreground">No dishes are available for ordering right now. Please check again later.</p>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Menu Browse ───────────────────────────────────────────────────
export function MenuPage({
  cart,
  menuItems,
  categories,
  menuLoading,
  menuError,
  availabilityError,
  checkoutError,
  availabilityRefreshing,
  selectedCategory,
  onNav,
  onCategoryChange,
  onRetryMenu,
  onAddToCart,
}: {
  cart: CartItem[];
  menuItems: CustomerDatabaseMenuItem[];
  categories: DatabaseMenuCategory[];
  menuLoading: boolean;
  menuError: string | null;
  availabilityError: string | null;
  checkoutError: string | null;
  availabilityRefreshing: boolean;
  selectedCategory: string;
  onNav: (page: CustomerPage) => void;
  onCategoryChange: (category: string) => void;
  onRetryMenu: () => void;
  onAddToCart: (
    item: CustomerDatabaseMenuItem,
  ) => void;
}) {
  const [search, setSearch] = useState("");
  const cats = [
  "All",
  ...categories.map(
    (category) => category.name,
  ),
  ];
  const cat = cats.includes(selectedCategory)
    ? selectedCategory
    : "All";
  const searchTerm = search.trim().toLocaleLowerCase();
  const filtered = menuItems.filter(
    (item) => (cat === "All" || item.category === cat) &&
      (!searchTerm || `${item.name} ${item.desc}`.toLocaleLowerCase().includes(searchTerm)),
  ).sort((first, second) => Number(second.available) - Number(first.available));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="menu" />
      <div className="customer-storefront customer-menu-screen flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
        <div className="customer-menu-layout">
        <main className="customer-menu-content">
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-7">
          <h1 className="customer-display-font text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Menu</h1>
        </div>
        {menuLoading || menuError ? (
          <CustomerMenuFeedback
            loading={menuLoading}
            error={menuError}
            onRetry={onRetryMenu}
          />
        ) : (
          <>
        {availabilityError ? (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>{availabilityError} Availability may have changed.</span>
            <button type="button" onClick={onRetryMenu} className="min-h-10 rounded-lg px-3 font-bold underline underline-offset-2">Refresh menu</button>
          </div>
        ) : null}
        {/* Search + filters */}
        <section className="customer-menu-toolbar mb-6 sm:mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="min-w-0 flex-1 md:max-w-md">
            <span className="sr-only">Search the menu</span>
            <span className="relative block">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                aria-label="Search menu"
                placeholder="Search dishes"
                className="h-12 w-full rounded-lg border border-border bg-card pl-10 pr-11 text-base outline-none placeholder:text-muted-foreground focus:border-primary" />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          </label>
          <div className="min-w-0 flex-1">
            <p className="sr-only">Category</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {cats.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCategoryChange(c)}
                  aria-pressed={cat === c}
                  className={`min-h-11 flex-none whitespace-nowrap rounded-lg border px-4 text-sm font-semibold transition-colors ${cat === c ? "border-foreground bg-foreground text-white" : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          </div>
          {(search || cat !== "All") ? <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filtered.length}</span> {filtered.length === 1 ? "dish" : "dishes"} in <span className="font-bold text-foreground">{cat}</span>
              {search ? <> for <span className="font-bold text-foreground">“{search}”</span></> : null}
            </p>
            <button
              type="button"
              onClick={() => { setSearch(""); onCategoryChange("All"); }}
              className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary/5"
            >
              Clear filters
            </button>
          </div> : null}
        </section>
        {filtered.length > 0 ? (
          <div className="customer-food-list grid grid-cols-1 lg:grid-cols-2">
            {filtered.map((item) => <FoodCard key={item.id} item={item} onAdd={onAddToCart} />)}
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/70 px-6 py-8 text-center">
            <Search aria-hidden="true" className="mb-3 h-8 w-8 text-primary" />
            <h2 className="text-base font-extrabold text-foreground">{menuItems.length === 0 ? "The menu is empty right now" : "No matching dishes"}</h2>
            {menuItems.length === 0 ? <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Please check again when dishes have been added to the menu.</p> : null}
            {(search || cat !== "All") ? <button type="button" onClick={() => { setSearch(""); onCategoryChange("All"); }} className="mt-4 min-h-11 rounded-xl bg-foreground px-4 text-sm font-extrabold text-white hover:bg-primary">Clear filters</button> : null}
          </div>
        )}
          </>
        )}
        </main>
        <CustomerMenuCartAside
          cart={cart}
          checking={availabilityRefreshing}
          error={checkoutError}
          onCart={() => onNav("cart")}
          onCheckout={() => onNav("checkout")}
        />
        </div>
        </div>
      </div>
    </div>
  );
}

// ── Menu Detail ───────────────────────────────────────────────────
export function MenuDetailPage({
  item,
  removed,
  choiceRefreshVersion,
  refreshError,
  cart,
  onNav,
  onRetryMenu,
  onAddToCart,
}: {
  item: CustomerDatabaseMenuItem;
  removed: boolean;
  choiceRefreshVersion: number;
  refreshError: string | null;
  cart: CartItem[];
  onNav: (page: CustomerPage) => void;
  onRetryMenu: () => void;
  onAddToCart: (
    item: CustomerDatabaseMenuItem,
    qty: number,
    modifiers: CustomerDrinkChoiceOption[],
    mealOption?: "with_rice" | "without_rice",
  ) => boolean;
}) {
  const [qty, setQty] = useState(1);
  const [mealOption, setMealOption] = useState<"with_rice" | "without_rice">("with_rice");
  const [openedWithFixedMealOption] = useState(item.withoutRicePrice !== undefined);
  const [groups, setGroups] = useState<CustomerDrinkChoiceGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [modifierLoading, setModifierLoading] = useState(true);
  const [modifierError, setModifierError] = useState<string | null>(null);
  const [loadedChoiceVersion, setLoadedChoiceVersion] = useState(-1);
  const [choiceChanged, setChoiceChanged] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const previousPrices = useRef({ id: item.id, price: item.price, withoutRicePrice: item.withoutRicePrice });
  useEffect(() => {
    const previous = previousPrices.current;
    if (previous.id === item.id && customerProductPricesChanged(previous, item)) {
      setPriceChanged(true);
    } else if (previous.id !== item.id) {
      setPriceChanged(false);
    }
    previousPrices.current = { id: item.id, price: item.price, withoutRicePrice: item.withoutRicePrice };
  }, [item.id, item.price, item.withoutRicePrice]);
  useEffect(() => {
    let active = true;
    if (item.category !== "Beverages") {
      setGroups([]);
      setSelected([]);
      setModifierError(null);
      setModifierLoading(false);
      setLoadedChoiceVersion(choiceRefreshVersion);
      return () => { active = false; };
    }
    setModifierLoading(true);
    setModifierError(null);
    void loadCustomerDrinkChoiceRows().then((data) => {
      if (!active) return;
      const byGroup = new Map<string, CustomerDrinkChoiceGroup>();
      for (const row of data) {
        if (row.menu_item_id !== item.id) continue;
        let group = byGroup.get(row.choice_kind);
        if (!group) {
          group = { id: row.choice_kind, name: row.choice_kind === "flavor" ? "Drink flavor" : "Drink size",
            selectionType: "single", min: 1,
            max: 1, options: [] };
          byGroup.set(row.choice_kind, group);
        }
        if (row.option_id && row.option_name !== null) group.options.push({
          id: row.option_id, name: row.option_name,
          price: Number(row.price_adjustment),
        });
      }
      const nextGroups = [...byGroup.values()];
      const oldOptions = groupsRef.current.flatMap((group) => group.options);
      const newOptions = nextGroups.flatMap((group) => group.options);
      if (selectedRef.current.some((id) => {
        const oldChoice = oldOptions.find((option) => option.id === id);
        const newChoice = newOptions.find((option) => option.id === id);
        return oldChoice && newChoice && oldChoice.price !== newChoice.price;
      })) setPriceChanged(true);
      if (groupsRef.current.some((oldGroup) => !nextGroups.some((group) => group.id === oldGroup.id))) {
        setModifierError("Drink choices changed. Return to the menu and open this item again.");
      }
      setGroups(nextGroups);
      const retained = retainCustomerDrinkSelections(selectedRef.current, newOptions);
      if (retained.invalidated) {
        setChoiceChanged(true);
        setSelected(retained.selected);
      }
      setLoadedChoiceVersion(choiceRefreshVersion);
      setModifierLoading(false);
    }).catch(() => {
      if (!active) return;
      setModifierError("Drink choices could not be loaded. Try opening this product again.");
      setModifierLoading(false);
    });
    return () => { active = false; };
  }, [item.id, item.category, choiceRefreshVersion]);
  const activeGroups = item.category === "Beverages" ? groups : [];
  const drinkLoading = item.category === "Beverages" && (modifierLoading || loadedChoiceVersion !== choiceRefreshVersion);
  const drinkError = item.category === "Beverages" ? modifierError : null;
  const chosen = activeGroups.flatMap((group) => group.options.filter((option) => selected.includes(option.id)));
  const complete = activeGroups.every((group) => {
    const count = group.options.filter((option) => selected.includes(option.id)).length;
    return count >= group.min && count <= group.max;
  });
  const selectOption = (group: CustomerDrinkChoiceGroup, optionId: string) => {
    setChoiceChanged(false);
    const groupIds = new Set(group.options.map((option) => option.id));
    setSelected((current) => {
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      const outside = current.filter((id) => !groupIds.has(id));
      const inside = group.selectionType === "single" ? [] : current.filter((id) => groupIds.has(id));
      return inside.length >= group.max ? current : [...outside, ...inside, optionId];
    });
  };
  const unitPrice = (mealOption === "without_rice" ? item.withoutRicePrice ?? item.price : item.price) +
    chosen.reduce((sum, option) => sum + option.price, 0);
  const selectedMealAvailable = item.withoutRicePrice === undefined ||
    (mealOption === "with_rice" ? item.withRiceAvailable !== false : item.withoutRiceAvailable !== false);
  const invalidMealSelection = item.withoutRicePrice === undefined &&
    (openedWithFixedMealOption || mealOption === "without_rice");
  const imageSrc = customerMenuImageSrc(item.imagePath);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="menu" />
      <div className="customer-detail-scroll flex-1 overflow-y-auto">
        <div className="customer-detail-page mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-9">
          <button onClick={() => onNav("menu")} className="mb-4 flex min-h-11 items-center gap-1.5 rounded-lg pr-3 text-sm font-bold text-muted-foreground hover:text-foreground sm:mb-7">
            <ArrowLeft className="w-4 h-4" /> Back to Menu
          </button>
          <div className={`customer-detail-layout grid grid-cols-1 gap-6 md:gap-10 ${imageSrc ? "md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : "md:grid-cols-1"}`}>
            {imageSrc ? <div className="customer-detail-media overflow-hidden rounded-xl"><MenuVisual item={item} imageSrc={imageSrc} large /></div> : null}
            <div className="customer-detail-product flex min-w-0 flex-col">
              <h1 className="customer-display-font mb-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{item.name}</h1>
              <div className="mb-3 flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-primary">{item.category}</span><span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Halal</span>{!item.available ? <span className="text-sm font-semibold text-stone-600">Unavailable today</span> : null}</div>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{item.desc}</p>
              <p className="mb-5 border-b border-border pb-5 text-2xl font-bold text-foreground sm:mb-6 sm:text-3xl">{formatCustomerCurrency(unitPrice)}</p>
              {priceChanged ? <p role="status" className="mb-3 text-sm font-semibold text-amber-800">The price of this item has been updated.</p> : null}
              {removed ? <p role="alert" className="mb-3 text-sm font-semibold text-red-700">This item is no longer on the menu. Return to browsing to choose another item.</p> : null}
              {!removed && !item.available ? <p role="status" className="mb-3 text-sm font-semibold text-amber-800">This item is currently unavailable. Please choose another item.</p> : null}
              {refreshError ? <div role="alert" className="mb-3 text-sm font-semibold text-amber-800"><p>{refreshError}</p><button type="button" onClick={onRetryMenu} className="mt-2 min-h-11 rounded-lg px-3 underline underline-offset-2">Retry menu</button></div> : null}
              {invalidMealSelection ? <p role="alert" className="mb-3 text-sm font-semibold text-amber-800">This rice choice is no longer offered. Return to the menu and choose the item again.</p> : null}
              {choiceChanged ? <p role="status" className="mb-3 text-sm font-semibold text-amber-800">Drink choices changed. Review your selection before adding this item.</p> : null}
              {item.withoutRicePrice !== undefined ? (
                <fieldset className="customer-detail-choices mb-5 border-b border-border pb-5">
                  <legend className="mb-2 text-base font-bold">Include Rice?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(["with_rice", "without_rice"] as const).map((choice) => (
                      <label key={choice} className="customer-detail-choice flex min-h-12 cursor-pointer flex-col justify-center rounded-lg border border-border px-3 py-2 text-sm">
                        <span><input type="radio" name="customer-meal-rice" checked={mealOption === choice}
                          disabled={choice === "with_rice" ? item.withRiceAvailable === false : item.withoutRiceAvailable === false}
                          onChange={() => setMealOption(choice)} /> {choice === "with_rice" ? "With Rice" : "Without Rice"}</span>
                        <strong>{formatCustomerCurrency(choice === "with_rice" ? item.price : item.withoutRicePrice!)}</strong>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {item.withoutRicePrice !== undefined && !selectedMealAvailable ? (
                <p role="status" className="mb-3 text-sm font-semibold text-amber-800">Choose an available rice option.</p>
              ) : null}
              {drinkLoading ? <p role="status" className="mb-4 text-sm">Loading drink choices…</p> : null}
              {drinkError ? <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{drinkError}</p> : null}
              {!drinkLoading && !drinkError ? activeGroups.map((group) => (
                <fieldset key={group.id} className="customer-detail-choices mb-5 border-b border-border pb-5">
                  <legend className="mb-2 text-base font-bold">{group.name}</legend>
                  <p className="mb-2 text-xs text-muted-foreground">Choose {group.min} to {group.max}</p>
                  <div className="grid gap-2">
                    {group.options.map((option) => (
                      <label key={option.id} className="customer-detail-choice flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                        <input type={group.selectionType === "single" ? "radio" : "checkbox"}
                          name={`modifier-${group.id}`} checked={selected.includes(option.id)}
                          onChange={() => selectOption(group, option.id)} />
                        <span className="flex-1">{option.name}</span>
                        <span>{option.price ? `+${formatCustomerCurrency(option.price)}` : "Included"}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )) : null}
              {!drinkLoading && !complete ? <p role="status" className="mb-3 text-sm font-semibold text-amber-800">Choose the required drink options.</p> : null}
              <div className="customer-detail-order-bar mt-2 flex items-center gap-3 border-t border-border pt-5 sm:gap-4">
                <div className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-2">
                  <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Decrease quantity" className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted disabled:cursor-not-allowed disabled:opacity-45"><Minus className="w-4 h-4" /></button>
                  <span className="font-bold w-6 text-center">{qty}</span>
                  <button type="button" onClick={() => setQty(Math.min(99, qty + 1))} disabled={qty >= 99} aria-label="Increase quantity" className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted disabled:cursor-not-allowed disabled:opacity-45"><Plus className="w-4 h-4" /></button>
                </div>
                <button
                  onClick={() => { if (onAddToCart(item, qty, chosen,
                    item.withoutRicePrice !== undefined ? mealOption : undefined)) onNav("menu"); }}
                  disabled={removed || !item.available || Boolean(refreshError) || !selectedMealAvailable || invalidMealSelection || drinkLoading || Boolean(drinkError) || !complete}
                  className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500">
                  {item.available ? <><span>Add to Cart</span><span>{formatCustomerCurrency(unitPrice * qty)}</span></> : "Unavailable today"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

