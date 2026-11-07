import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, RefreshCw, Search, ToggleLeft, ToggleRight } from "lucide-react";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Table, Td } from "@/components/common/Table";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  getManagerMenuItems,
  setManagerMenuItemAvailability,
  type ManagerMenuItem,
} from "../api/managerPhase2Api";
import {
  getManagerFixedMealOptions,
  getManagerMealIngredients,
  getManagerMealInventoryCandidates,
  setManagerFixedMealOption,
  type ManagerFixedMealOption,
  type ManagerMealIngredient,
  type ManagerMealInventoryCandidate,
} from "../api/mealOptionsApi";
import { getManagerDrinkChoices, setManagerDrinkChoice, type ManagerDrinkChoice } from "../api/drinkChoicesApi";
import { eligibleMealProducts } from "./mealEligibility";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function isAccessFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Active manager access required") ||
    message.includes("Authentication required")
  );
}

export function MenuManagementPage() {
  const { session, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ManagerMenuItem[]>([]);
  const [mealOptions, setMealOptions] = useState<ManagerFixedMealOption[]>([]);
  const [drinkChoices, setDrinkChoices] = useState<ManagerDrinkChoice[]>([]);
  const [drinkConfigAvailable, setDrinkConfigAvailable] = useState(false);
  const [savingDrinkId, setSavingDrinkId] = useState<string | null>(null);
  const [mealIngredients, setMealIngredients] = useState<ManagerMealIngredient[]>([]);
  const [mealInventoryCandidates, setMealInventoryCandidates] = useState<ManagerMealInventoryCandidate[]>([]);
  const [mealConfigAvailable, setMealConfigAvailable] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [mealConfigOpen, setMealConfigOpen] = useState(false);
  const [standardPrice, setStandardPrice] = useState("");
  const [withoutRicePrice, setWithoutRicePrice] = useState("");
  const [excludedIngredientId, setExcludedIngredientId] = useState("");
  const [riceQuantity, setRiceQuantity] = useState("");
  const [savingMeal, setSavingMeal] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedForSession, setLoadedForSession] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [requiresRead, setRequiresRead] = useState(false);
  const requestVersion = useRef(0);
  const mutationPending = useRef(false);
  const activeSessionId = useRef(session?.id);
  activeSessionId.current = session?.id;
  const canShowItems =
    session?.role === "manager" && loadedForSession === session.id;

  const loadMenu = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);

    try {
      const nextItems = await getManagerMenuItems();
      const [optionsResult, ingredientsResult, candidatesResult, drinksResult] = await Promise.allSettled([
        getManagerFixedMealOptions(), getManagerMealIngredients(), getManagerMealInventoryCandidates(), getManagerDrinkChoices(),
      ]);
      if (version !== requestVersion.current) return;
      setItems(nextItems);
      const configReady = optionsResult.status === "fulfilled" && ingredientsResult.status === "fulfilled" && candidatesResult.status === "fulfilled";
      setMealConfigAvailable(configReady);
      setMealOptions(optionsResult.status === "fulfilled" ? optionsResult.value : []);
      setMealIngredients(ingredientsResult.status === "fulfilled" ? ingredientsResult.value : []);
      setMealInventoryCandidates(candidatesResult.status === "fulfilled" ? candidatesResult.value : []);
      setDrinkConfigAvailable(drinksResult.status === "fulfilled");
      setDrinkChoices(drinksResult.status === "fulfilled" ? drinksResult.value : []);
      setLoadedForSession(session?.id ?? null);
      setLoadedAt(new Date());
      setRequiresRead(false);
      setNotice(null);
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      setItems([]);
      setMealConfigAvailable(false);
      setDrinkConfigAvailable(false);
      setDrinkChoices([]);
      setLoadedAt(null);
      if (isAccessFailure(loadError)) setLoadedForSession(null);
      setError(
        isAccessFailure(loadError)
          ? "Manager access is required to view this menu."
          : "Menu items could not be loaded. Check your connection or access, then retry.",
      );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.id || session.role !== "manager") {
      requestVersion.current += 1;
      setItems([]);
      setLoadedForSession(null);
      setLoadedAt(null);
      setLoading(false);
      setError("Manager access is required to view this menu.");
      return;
    }
    void loadMenu();
    return () => {
      requestVersion.current += 1;
    };
  }, [authLoading, loadMenu, session?.id, session?.role]);

  const visibleItems = useMemo(
    () => (canShowItems ? items : []),
    [canShowItems, items],
  );
  const eligibleMeals = useMemo(
    () => eligibleMealProducts(visibleItems, drinkChoices),
    [visibleItems, drinkChoices],
  );

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(visibleItems.map((item) => item.categoryName))),
    ],
    [visibleItems],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return visibleItems.filter((item) => {
      const matchesCategory =
        category === "All" || item.categoryName === category;
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [category, visibleItems, search]);

  const updateAvailability = async (item: ManagerMenuItem) => {
    if (mutationPending.current || requiresRead) return;
    const requesterId = session?.id;
    mutationPending.current = true;
    setUpdatingId(item.id);
    setError(null);
    setNotice(null);

    try {
      const updatedItem = await setManagerMenuItemAvailability(
        item.id,
        !item.manuallyAvailable,
      );
      if (requesterId !== activeSessionId.current) return;

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem,
        ),
      );
      setNotice(
        `${item.name} (${item.code}): manual availability ${updatedItem.manuallyAvailable ? "enabled" : "paused"}. ${updatedItem.effectivelyAvailable ? "Customers can order this item." : "The item remains unavailable to customers."}`,
      );
    } catch (updateError) {
      if (requesterId !== activeSessionId.current) return;
      if (isAccessFailure(updateError)) {
        setItems([]);
        setLoadedForSession(null);
        setError("Manager access is required to change menu availability.");
      } else {
        setRequiresRead(true);
        setError(
          "The availability change could not be confirmed. Refresh the menu to check its current state before trying again.",
        );
      }
    } finally {
      mutationPending.current = false;
      setUpdatingId(null);
    }
  };

  const openMealConfig = (id: string) => {
    const item = eligibleMeals.find((entry) => entry.id === id);
    if (!item) return;
    const config = mealOptions.find((entry) => entry.menuItemId === id);
    setEditingMealId(id);
    setStandardPrice(item.price.toFixed(2));
    setWithoutRicePrice(config?.withoutRicePrice?.toFixed(2) ?? "");
    setExcludedIngredientId(config?.withoutRiceInventoryItemId ?? "");
    setRiceQuantity("");
    setError(null);
  };

  const saveMealConfig = async () => {
    if (!editingMealId || !eligibleMeals.some((item) => item.id === editingMealId) ||
      mutationPending.current || requiresRead) return;
    const normal = Number(standardPrice);
    const alternate = withoutRicePrice.trim() ? Number(withoutRicePrice) : null;
    const existingLink = mealIngredients.find((entry) =>
      entry.menuItemId === editingMealId && entry.inventoryItemId === excludedIngredientId);
    const approvedQuantity = !existingLink && excludedIngredientId && riceQuantity.trim()
      ? Number(riceQuantity) : null;
    if (!Number.isFinite(normal) || normal <= 0 ||
      (alternate !== null && (!Number.isFinite(alternate) || alternate <= 0 || alternate >= normal))) {
      setError("Enter a valid standard price and a lower Without Rice price.");
      return;
    }
    if (alternate !== null && !excludedIngredientId) {
      setError("Select the Manager-approved rice inventory item before enabling meal choices.");
      return;
    }
    if (alternate !== null && excludedIngredientId && !existingLink &&
      (approvedQuantity === null || !Number.isFinite(approvedQuantity) ||
        approvedQuantity <= 0 || approvedQuantity !== Math.round(approvedQuantity * 1000) / 1000)) {
      setError("Enter the Manager-approved rice quantity in the inventory item's base unit, to three decimal places.");
      return;
    }
    mutationPending.current = true;
    setSavingMeal(true);
    setError(null);
    try {
      await setManagerFixedMealOption(editingMealId, normal, alternate,
        alternate === null ? null : excludedIngredientId || null,
        alternate === null ? null : approvedQuantity);
      const itemName = items.find((entry) => entry.id === editingMealId)?.name ?? "Meal";
      setEditingMealId(null);
      await loadMenu();
      setNotice(`${itemName} meal options saved.`);
    } catch (saveError) {
      setRequiresRead(true);
      setError(saveError instanceof Error ? saveError.message : "Meal options could not be confirmed. Refresh before retrying.");
    } finally {
      mutationPending.current = false;
      setSavingMeal(false);
    }
  };

  const updateDrinkChoice = (choice: ManagerDrinkChoice) => {
    setDrinkChoices((current) => current.map((entry) =>
      entry.menuItemId === choice.menuItemId && entry.optionId === choice.optionId ? choice : entry));
  };

  const saveDrinkChoice = async (choice: ManagerDrinkChoice) => {
    if (mutationPending.current || requiresRead) return;
    if (!Number.isFinite(choice.priceAdjustment) || choice.priceAdjustment < 0 ||
      Math.round(choice.priceAdjustment * 100) / 100 !== choice.priceAdjustment) {
      setError("Enter a valid drink choice price adjustment to two decimal places.");
      return;
    }
    mutationPending.current = true;
    setSavingDrinkId(`${choice.menuItemId}:${choice.optionId}`);
    setError(null);
    try {
      await setManagerDrinkChoice(choice);
      await loadMenu();
      setNotice(`${choice.optionName} drink choice saved.`);
    } catch (saveError) {
      setRequiresRead(true);
      setError(saveError instanceof Error ? saveError.message : "Drink choice update could not be confirmed. Refresh before retrying.");
    } finally {
      mutationPending.current = false;
      setSavingDrinkId(null);
    }
  };

  return (
    <div className="manager-menu-page">
      <header className="manager-page-header mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="manager-page-context">Restaurant Operations / Menu</p>
          <h1 className="text-foreground">Menu Management</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 text-primary" />
            Pause an active item to stop customer ordering. Enabling it still
            requires sufficient ingredient stock.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadMenu()}
          loading={loading}
          disabled={updatingId !== null}
          className="min-h-11"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      {canShowItems ? (
        <section className="mb-3 rounded-xl border border-border bg-card p-3" aria-label="Meal Options">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold">Meal Options</h2>
              <p className="text-xs text-muted-foreground">Configure a standard meal with an optional lower Without Rice price.</p>
            </div>
            {mealConfigAvailable ? (
              <Button variant="secondary" size="sm" onClick={() => { setMealConfigOpen((open) => !open); setEditingMealId(null); }}>
                {mealConfigOpen ? "Close" : "Configure meal"}
              </Button>
            ) : <span className="text-xs text-muted-foreground">Meal Options backend is not available yet.</span>}
          </div>
          {mealConfigOpen && mealConfigAvailable ? (
            <>
            <label className="mt-3 block text-xs font-semibold">Menu product
              <select className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3" value={editingMealId ?? ""}
                onChange={(event) => { if (event.target.value) openMealConfig(event.target.value); else setEditingMealId(null); }}>
                <option value="">Select an eligible meal</option>
                {eligibleMeals.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.code})</option>)}
              </select>
            </label>
            {!eligibleMeals.length && <p className="mt-2 text-sm text-muted-foreground">No eligible meals are available for configuration.</p>}
            {editingMealId && eligibleMeals.some((item) => item.id === editingMealId) && (
            <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Standard price (With Rice)
                <input type="number" min="0.01" step="0.01" className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"
                  value={standardPrice} onChange={(event) => setStandardPrice(event.target.value)} />
              </label>
              <label className="text-xs font-semibold">Without Rice price (leave blank to disable)
                <input type="number" min="0.01" step="0.01" className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"
                  value={withoutRicePrice} onChange={(event) => setWithoutRicePrice(event.target.value)} />
              </label>
              <label className="text-xs font-semibold">Rice inventory item (Manager-approved)
                <select className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3"
                  value={excludedIngredientId} onChange={(event) => { setExcludedIngredientId(event.target.value); setRiceQuantity(""); }}>
                  <option value="">Not configured</option>
                  {mealInventoryCandidates.map((entry) => (
                    <option key={entry.inventoryItemId} value={entry.inventoryItemId}>
                      {entry.inventoryName} ({entry.inventoryUnit})
                      {mealIngredients.find((link) => link.menuItemId === editingMealId && link.inventoryItemId === entry.inventoryItemId)
                        ? " — already in recipe" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {excludedIngredientId && !mealIngredients.some((entry) => entry.menuItemId === editingMealId && entry.inventoryItemId === excludedIngredientId) ? (
                <label className="text-xs font-semibold">Approved quantity per standard meal ({mealInventoryCandidates.find((entry) => entry.inventoryItemId === excludedIngredientId)?.inventoryUnit ?? "base unit"})
                  <input type="number" min="0.001" step="0.001" className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"
                    value={riceQuantity} onChange={(event) => setRiceQuantity(event.target.value)} />
                </label>
              ) : null}
              {excludedIngredientId && mealIngredients.some((entry) => entry.menuItemId === editingMealId && entry.inventoryItemId === excludedIngredientId) ? (
                <p className="text-xs text-muted-foreground">Existing recipe quantity: {mealIngredients.find((entry) => entry.menuItemId === editingMealId && entry.inventoryItemId === excludedIngredientId)?.quantityRequired} {mealInventoryCandidates.find((entry) => entry.inventoryItemId === excludedIngredientId)?.inventoryUnit} per meal. This action preserves it.</p>
              ) : null}
              <p className="text-xs text-muted-foreground sm:col-span-2">Meal choices require the actual rice inventory item and its approved serving quantity. Saving a new mapping adds only that recipe link. Other ingredients remain unchanged. Until configured, this product remains an ordinary menu item and rice stock consumption is untracked.</p>
              <Button className="min-h-11 sm:col-span-2" onClick={() => void saveMealConfig()} disabled={savingMeal || requiresRead}>
                {savingMeal ? "Saving…" : "Save Meal Options"}
              </Button>
            </div>)}
            </>
          ) : null}
        </section>
      ) : null}

      {canShowItems ? (
        <section className="mb-3 rounded-xl border border-border bg-card p-3" aria-label="Drink Choices">
          <h2 className="text-sm font-bold">Drink Choices</h2>
          <p className="text-xs text-muted-foreground">Set the availability and price adjustment for each existing drink flavor or size. Each drink requires one active choice per type.</p>
          {drinkConfigAvailable ? (
            <div className="mt-3 grid gap-2">
              {drinkChoices.map((choice) => {
                const key = `${choice.menuItemId}:${choice.optionId}`;
                return <div key={key} className="grid items-center gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_auto]">
                  <span className="text-xs font-semibold">{items.find((item) => item.id === choice.menuItemId)?.name ?? "Drink"} · {choice.choiceKind} · {choice.optionName}</span>
                  <label className="text-xs">Price adjustment
                    <input type="number" min="0" step="0.01" value={choice.priceAdjustment}
                      onChange={(event) => updateDrinkChoice({ ...choice, priceAdjustment: Number(event.target.value) })}
                      className="min-h-10 w-full rounded-lg border border-border px-2" />
                  </label>
                  <label className="flex min-h-10 items-center gap-2 text-xs"><input type="checkbox" checked={choice.isActive}
                    onChange={(event) => updateDrinkChoice({ ...choice, isActive: event.target.checked })} /> Active</label>
                  <Button size="sm" onClick={() => void saveDrinkChoice(choice)} disabled={savingDrinkId !== null || requiresRead}>Save</Button>
                </div>;
              })}
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">Drink Choices backend is not available yet.</p>}
        </section>
      ) : null}

      <div className="manager-menu-filters mb-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-[0_1px_2px_rgba(67,42,23,0.03)] sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or code…"
            className="min-h-10 w-full border-0 bg-transparent py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none"
            aria-label="Search menu items by name or code"
          />
        </div>
        <div className="hidden h-6 w-px bg-border sm:block" />
        <div
          className="flex gap-1 overflow-x-auto"
          aria-label="Filter menu by category"
        >
          {categories.map((itemCategory) => (
            <button
              key={itemCategory}
              type="button"
              onClick={() => setCategory(itemCategory)}
              aria-pressed={category === itemCategory}
              className={
                "min-h-11 flex-shrink-0 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                (category === itemCategory
                  ? "bg-[#2b1b12] text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {itemCategory}
            </button>
          ))}
        </div>
      </div>
      {!loading && !error && canShowItems && (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
        >
          <span>
            {filteredItems.length.toLocaleString("en-PH")} of{" "}
            {visibleItems.length.toLocaleString("en-PH")} loaded menu items
            shown
            {loadedAt
              ? ` · Refreshed ${loadedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </span>
          {(search || category !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All");
              }}
              className="min-h-11 rounded-lg px-3 font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          {session?.role === "manager" && (
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={() => void loadMenu()}
              loading={loading}
              disabled={updatingId !== null}
            >
              Refresh menu
            </Button>
          )}
        </div>
      ) : null}
      {notice && !error && (
        <p
          role="status"
          className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}

      <div className="hidden md:block">
        <Table
          headers={[
            "Item",
            "Category",
            "Price",
            "Effective Availability",
            "Manual Availability",
            "Description",
          ]}
        >
          {loading ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                Loading menu items…
              </td>
            </tr>
          ) : error || !canShowItems ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                Menu items are unavailable until the read succeeds.
              </td>
            </tr>
          ) : filteredItems.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                {visibleItems.length === 0
                  ? "No menu items are available."
                  : "No menu items match the current filters."}
              </td>
            </tr>
          ) : (
            filteredItems.map((item) => {
              const isOutOfStock =
                item.isActive &&
                item.manuallyAvailable &&
                !item.effectivelyAvailable;

              return (
                <tr key={item.id}>
                  <Td>
                    <p className="break-words text-sm font-bold text-foreground">
                      {item.name}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {item.code}
                    </p>
                  </Td>
                  <Td>
                    <Badge>{item.categoryName}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-sm font-bold tabular-nums text-foreground">
                    {currencyFormatter.format(item.price)}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      {!item.isActive ? (
                        <Badge>Inactive</Badge>
                      ) : item.effectivelyAvailable ? (
                        <Badge variant="success">Available</Badge>
                      ) : isOutOfStock ? (
                        <Badge variant="warning">Out of stock</Badge>
                      ) : (
                        <Badge>Paused</Badge>
                      )}
                      {isOutOfStock && (
                        <span className="text-xs font-medium text-muted-foreground">
                          Ingredient stock
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      disabled={
                        !item.isActive ||
                        updatingId !== null ||
                        requiresRead ||
                        loading
                      }
                      onClick={() => void updateAvailability(item)}
                      className={
                        "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 " +
                        (item.manuallyAvailable
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-zinc-200 bg-zinc-100 text-zinc-700")
                      }
                      aria-label={`${item.manuallyAvailable ? "Pause" : "Enable"} ${item.name} (${item.code})`}
                      aria-pressed={item.manuallyAvailable}
                    >
                      {item.manuallyAvailable ? (
                        <ToggleRight className="h-4 w-4" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                      {updatingId === item.id
                        ? "Saving…"
                        : item.manuallyAvailable
                          ? "Enabled"
                          : "Paused"}
                    </button>
                  </Td>
                  <Td className="max-w-[260px] text-xs leading-4 text-muted-foreground/65">
                    <span title={item.description ?? undefined}>
                      {item.description ?? "—"}
                    </span>
                  </Td>
                </tr>
              );
            })
          )}
        </Table>
      </div>
      <section
        aria-label="Menu items on small screens"
        className="grid gap-3 md:hidden"
      >
        {loading ? (
          <p
            role="status"
            className="rounded-xl border border-border bg-card p-4 text-sm"
          >
            Loading menu items…
          </p>
        ) : error ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            Menu items are unavailable until refresh succeeds.
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            {visibleItems.length === 0
              ? "No menu items are available."
              : "No menu items match the current filters."}
          </p>
        ) : (
          filteredItems.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-bold">{item.name}</h2>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {item.code} · {item.categoryName}
                  </p>
                </div>
                <strong className="whitespace-nowrap text-sm tabular-nums">
                  {currencyFormatter.format(item.price)}
                </strong>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Customer availability:{" "}
                <strong className="text-foreground">
                  {!item.isActive
                    ? "Inactive"
                    : item.effectivelyAvailable
                      ? "Available"
                      : item.manuallyAvailable
                        ? "Out of stock"
                        : "Paused"}
                </strong>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Manual availability:{" "}
                {item.manuallyAvailable ? "Enabled" : "Paused"}
                {item.manuallyAvailable &&
                !item.effectivelyAvailable &&
                item.isActive
                  ? " · Ingredient stock prevents ordering"
                  : ""}
              </p>
              {item.description && (
                <p className="mt-2 break-words text-xs text-muted-foreground">
                  {item.description}
                </p>
              )}
              <button
                type="button"
                disabled={
                  !item.isActive ||
                  updatingId !== null ||
                  requiresRead ||
                  loading
                }
                onClick={() => void updateAvailability(item)}
                aria-pressed={item.manuallyAvailable}
                aria-label={`${item.manuallyAvailable ? "Pause" : "Enable"} ${item.name} (${item.code})`}
                className="mt-3 min-h-11 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                {updatingId === item.id
                  ? "Saving…"
                  : item.manuallyAvailable
                    ? "Pause menu item"
                    : "Enable menu item"}
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
