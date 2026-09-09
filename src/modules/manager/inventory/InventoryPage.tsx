import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Package, RefreshCw } from "lucide-react";
import { Button } from "../../../components/common/Button";
import { Badge, StatusBadge } from "../../../components/common/Badge";
import { Table, Td } from "../../../components/common/Table";
import { StatCard } from "../../../components/common/StatCard";
import { getManagerInventory, type ManagerInventoryItem } from "./inventoryApi";

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getErrorMessage(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "Unable to load manager inventory.";
}

export function InventoryPage() {
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-base font-bold text-foreground">Inventory</h1>
        <Button
          variant="secondary"
          size="sm"
          disabled={isLoading}
          onClick={() => void loadInventory()}
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Items"
          value={String(items.length)}
          icon={Package}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Healthy"
          value={String(healthyCount)}
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          label="Reorder Soon"
          value={String(reorderSoonCount)}
          icon={AlertCircle}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Critical"
          value={String(criticalCount)}
          icon={AlertCircle}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
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
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
          No inventory items were returned by PostgreSQL.
        </div>
      ) : (
        <Table
          headers={[
            "Item Name",
            "Category",
            "Unit",
            "Quantity",
            "Reorder Level",
            "Status",
            "Last Updated",
          ]}
        >
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-muted/30">
              <Td className="font-semibold text-xs">
                <div>{item.itemName}</div>
                {!item.isActive ? (
                  <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                    Inactive
                  </div>
                ) : null}
              </Td>
              <Td>
                <Badge>{item.category ?? "Uncategorized"}</Badge>
              </Td>
              <Td className="text-xs text-muted-foreground">{item.unit}</Td>
              <Td
                className={`text-xs font-bold ${
                  item.stockStatus === "critical"
                    ? "text-red-600"
                    : item.stockStatus === "reorder-soon"
                      ? "text-amber-600"
                      : "text-foreground"
                }`}
              >
                {quantityFormatter.format(item.quantityOnHand)}
              </Td>
              <Td className="text-xs text-muted-foreground">
                {quantityFormatter.format(item.reorderLevel)} {item.unit}
              </Td>
              <Td>
                <StatusBadge status={item.stockStatus} />
              </Td>
              <Td className="text-[10px] text-muted-foreground">
                {dateTimeFormatter.format(new Date(item.updatedAt))}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
