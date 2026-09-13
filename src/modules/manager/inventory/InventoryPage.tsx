import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Package,
  RefreshCw,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Table, Td } from "@/components/common/Table";
import {
  getManagerInventory,
  type InventoryStockStatus,
  type ManagerInventoryItem,
} from "./inventoryApi";
import {
  InventoryWorkspaceNav,
  type InventoryWorkspacePage,
} from "./InventoryWorkspaceNav";

const STOCK_PRIORITY: Record<InventoryStockStatus, number> = {
  critical: 0,
  "reorder-soon": 1,
  healthy: 2,
};

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
});

function getErrorMessage(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "Unable to load manager inventory.";
}

function InventoryMetric({
  label,
  value,
  icon: Icon,
  tone,
  active = false,
}: {
  label: string;
  value: string;
  icon: typeof Package;
  tone: "neutral" | "green" | "amber" | "red";
  active?: boolean;
}) {
  const toneClasses = {
    neutral: "border-border bg-card text-foreground",
    green: "border-emerald-200/70 bg-emerald-50/40 text-emerald-800",
    amber: active
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-border bg-card text-foreground",
    red: active
      ? "border-red-300 bg-red-50 text-red-800"
      : "border-border bg-card text-foreground",
  };
  const iconClasses = {
    neutral: "bg-blue-50 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: active
      ? "bg-amber-100 text-amber-700"
      : "bg-muted text-muted-foreground",
    red: active ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground",
  };

  return (
    <article
      className={
        "flex min-h-[82px] items-center gap-3 rounded-xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(67,42,23,0.025)] " +
        toneClasses[tone]
      }
    >
      <div
        className={
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg " +
          iconClasses[tone]
        }
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold opacity-70">{label}</p>
        <p className="mt-1 font-['Fraunces'] text-xl font-bold leading-none tabular-nums text-current">
          {value}
        </p>
      </div>
    </article>
  );
}

export function InventoryPage({
  onNavigate,
}: {
  onNavigate: (page: InventoryWorkspacePage) => void;
}) {
  const [items, setItems] = useState<ManagerInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setItems(await getManagerInventory());
    } catch (caught) {
      setItems([]);
      setError(getErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const healthyCount = items.filter(
    (item) => item.stockStatus === "healthy",
  ).length;
  const reorderSoonCount = items.filter(
    (item) => item.stockStatus === "reorder-soon",
  ).length;
  const criticalCount = items.filter(
    (item) => item.stockStatus === "critical",
  ).length;
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          STOCK_PRIORITY[left.stockStatus] - STOCK_PRIORITY[right.stockStatus],
      ),
    [items],
  );
  const attentionItems = sortedItems.filter(
    (item) => item.stockStatus !== "healthy",
  );

  return (
    <div className="inventory-workspace-page manager-inventory-page">
      <header className="manager-page-header mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-foreground">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Current stock levels and reorder status
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isLoading}
          onClick={() => void loadInventory()}
        >
          <RefreshCw
            className={"h-4 w-4 " + (isLoading ? "animate-spin" : "")}
          />
          Refresh
        </Button>
      </header>

      <InventoryWorkspaceNav active="inventory" onNavigate={onNavigate} />

      <section
        aria-label="Inventory totals"
        className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4"
      >
        <InventoryMetric
          label="Total Items"
          value={isLoading ? "—" : String(items.length)}
          icon={Package}
          tone="neutral"
        />
        <InventoryMetric
          label="Healthy"
          value={isLoading ? "—" : String(healthyCount)}
          icon={CheckCircle}
          tone="green"
        />
        <InventoryMetric
          label="Reorder Soon"
          value={isLoading ? "—" : String(reorderSoonCount)}
          icon={AlertCircle}
          tone="amber"
          active={reorderSoonCount > 0}
        />
        <InventoryMetric
          label="Critical"
          value={isLoading ? "—" : String(criticalCount)}
          icon={AlertTriangle}
          tone="red"
          active={criticalCount > 0}
        />
      </section>

      {!isLoading && !error && items.length > 0 && (
        <section
          aria-labelledby="inventory-attention-heading"
          className={
            "mb-3 overflow-hidden rounded-xl border " +
            (attentionItems.length > 0
              ? "border-amber-200 bg-amber-50/45"
              : "border-emerald-200 bg-emerald-50/35")
          }
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {attentionItems.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-700" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-700" />
              )}
              <div>
                <h2
                  id="inventory-attention-heading"
                  className="text-sm font-extrabold text-foreground"
                >
                  Needs attention
                </h2>
                <p className="text-xs text-muted-foreground">
                  Showing up to 4 highest-priority items; all flagged items
                  remain in the table below
                </p>
              </div>
            </div>
            <span className="rounded-lg border border-current/10 bg-white/65 px-2.5 py-1 text-sm font-extrabold tabular-nums text-foreground">
              {attentionItems.length}
            </span>
          </div>

          {attentionItems.length > 0 ? (
            <div className="grid gap-px border-t border-amber-200 bg-amber-200 sm:grid-cols-2 xl:grid-cols-4">
              {attentionItems.slice(0, 4).map((item) => (
                <article
                  key={item.id}
                  className="min-w-0 bg-white/85 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-bold text-foreground">
                      {item.itemName}
                    </p>
                    <StatusBadge status={item.stockStatus} />
                  </div>
                  <p
                    className={
                      "mt-2 text-sm font-extrabold tabular-nums " +
                      (item.stockStatus === "critical"
                        ? "text-red-700"
                        : "text-amber-800")
                    }
                  >
                    {quantityFormatter.format(item.quantityOnHand)} {item.unit}
                    <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                      / reorder at {quantityFormatter.format(item.reorderLevel)}
                    </span>
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="border-t border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              No critical or reorder-soon inventory items.
            </p>
          )}
        </section>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Loading inventory…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <p>{error}</p>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadInventory()}
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No inventory items are available.
        </div>
      ) : (
        <Table
          headers={[
            "Item",
            "Category",
            "Unit",
            "On Hand",
            "Reorder At",
            "Status",
            "Updated",
          ]}
        >
          {sortedItems.map((item) => (
            <tr
              key={item.id}
              className={
                item.stockStatus === "critical"
                  ? "inventory-row-critical"
                  : item.stockStatus === "reorder-soon"
                    ? "inventory-row-warning"
                    : ""
              }
            >
              <Td className="font-semibold text-foreground">
                <div>{item.itemName}</div>
                {!item.isActive ? (
                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Inactive
                  </div>
                ) : null}
              </Td>
              <Td>
                <Badge>{item.category ?? "Uncategorized"}</Badge>
              </Td>
              <Td className="text-sm text-muted-foreground">{item.unit}</Td>
              <Td>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={
                      "text-base font-extrabold tabular-nums " +
                      (item.stockStatus === "critical"
                        ? "text-red-700"
                        : item.stockStatus === "reorder-soon"
                          ? "text-amber-800"
                          : "text-foreground")
                    }
                  >
                    {quantityFormatter.format(item.quantityOnHand)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.unit}
                  </span>
                  {item.quantityOnHand === 0 && (
                    <Badge variant="danger">Zero stock</Badge>
                  )}
                </div>
              </Td>
              <Td>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {quantityFormatter.format(item.reorderLevel)}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  {item.unit}
                </span>
              </Td>
              <Td>
                <StatusBadge status={item.stockStatus} />
              </Td>
              <Td className="whitespace-nowrap text-xs text-muted-foreground">
                <span className="block">
                  {dateFormatter.format(new Date(item.updatedAt))}
                </span>
                <span className="mt-0.5 block text-muted-foreground/75">
                  {timeFormatter.format(new Date(item.updatedAt))}
                </span>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
