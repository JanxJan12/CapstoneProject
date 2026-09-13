import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, RefreshCw, Search, ToggleLeft, ToggleRight } from "lucide-react";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Table, Td } from "@/components/common/Table";
import {
  getManagerMenuItems,
  setManagerMenuItemAvailability,
  type ManagerMenuItem,
} from "../api/managerPhase2Api";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load manager menu.";
}

export function MenuManagementPage() {
  const [items, setItems] = useState<ManagerMenuItem[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await getManagerMenuItems());
    } catch (loadError) {
      setItems([]);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(items.map((item) => item.categoryName))),
    ],
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory =
        category === "All" || item.categoryName === category;
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [category, items, search]);

  const updateAvailability = async (item: ManagerMenuItem) => {
    setUpdatingId(item.id);
    setError(null);

    try {
      const updatedItem = await setManagerMenuItemAvailability(
        item.id,
        !item.manuallyAvailable,
      );

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem,
        ),
      );
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="manager-menu-page">
      <header className="manager-page-header mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-foreground">Menu Management</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 text-primary" />
            Effective availability also depends on ingredient stock.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadMenu()}
          loading={loading}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

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
                "min-h-9 flex-shrink-0 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
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

      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

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
        ) : filteredItems.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="px-4 py-10 text-center text-sm text-muted-foreground"
            >
              {items.length === 0
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
                  <p className="text-sm font-bold text-foreground">
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
                    disabled={!item.isActive || updatingId !== null}
                    onClick={() => void updateAvailability(item)}
                    className={
                      "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 " +
                      (item.manuallyAvailable
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-zinc-100 text-zinc-700")
                    }
                    aria-label={
                      (item.manuallyAvailable ? "Pause " : "Enable ") +
                      item.name
                    }
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
  );
}
