import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ToggleLeft, ToggleRight } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Table, Td } from "../../../components/common/Table";
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
  return error instanceof Error ? error.message : "Unable to load manager menu.";
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
    () => ["All", ...Array.from(new Set(items.map((item) => item.categoryName)))],
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
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">
            Menu Management
          </h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Manual availability and inventory-aware customer status from PostgreSQL
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadMenu()}
          loading={loading}
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or code…"
            className="w-full rounded-lg border border-border bg-input-background py-2 pl-8 pr-3 text-xs focus:outline-none"
          />
        </div>
        <div className="flex gap-0.5 overflow-x-auto rounded-lg border border-border bg-white p-0.5">
          {categories.map((itemCategory) => (
            <button
              key={itemCategory}
              type="button"
              onClick={() => setCategory(itemCategory)}
              className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all ${
                category === itemCategory
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {itemCategory}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <Table
        headers={[
          "Item",
          "Category",
          "Price",
          "Customer Status",
          "Description",
          "Manual Control",
        ]}
      >
        {loading ? (
          <tr>
            <td
              colSpan={6}
              className="px-4 py-10 text-center text-xs text-muted-foreground"
            >
              Loading menu items…
            </td>
          </tr>
        ) : filteredItems.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="px-4 py-10 text-center text-xs text-muted-foreground"
            >
              {items.length === 0
                ? "No menu items were returned by PostgreSQL."
                : "No menu items match the current filters."}
            </td>
          </tr>
        ) : (
          filteredItems.map((item) => (
            <tr key={item.id} className="hover:bg-muted/30">
              <Td>
                <p className="text-xs font-semibold">{item.name}</p>
                <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                  {item.code}
                </p>
              </Td>
              <Td>
                <Badge>{item.categoryName}</Badge>
              </Td>
              <Td className="text-xs font-semibold">
                {currencyFormatter.format(item.price)}
              </Td>
              <Td>
                {!item.isActive ? (
                  <Badge>Inactive</Badge>
                ) : item.effectivelyAvailable ? (
                  <Badge variant="success">Available</Badge>
                ) : item.manuallyAvailable ? (
                  <Badge variant="warning">Out of stock</Badge>
                ) : (
                  <Badge>Paused</Badge>
                )}
              </Td>
              <Td className="max-w-xs text-xs text-muted-foreground">
                {item.description ?? "—"}
              </Td>
              <Td>
                <button
                  type="button"
                  disabled={!item.isActive || updatingId !== null}
                  onClick={() => void updateAvailability(item)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                    item.manuallyAvailable
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-zinc-200 bg-zinc-100 text-zinc-600"
                  }`}
                  aria-label={`${item.manuallyAvailable ? "Pause" : "Enable"} ${item.name}`}
                >
                  {item.manuallyAvailable ? (
                    <ToggleRight className="h-3.5 w-3.5" />
                  ) : (
                    <ToggleLeft className="h-3.5 w-3.5" />
                  )}
                  {updatingId === item.id
                    ? "Saving…"
                    : item.manuallyAvailable
                      ? "Enabled"
                      : "Paused"}
                </button>
              </Td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
