import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Table, Td } from "@/components/common/Table";
import type { BadgeVariant } from "@/types";
import {
  getManagerInventoryTransactions,
  type InventoryTransactionType,
  type ManagerInventoryTransaction,
} from "./inventoryApi";
import {
  InventoryWorkspaceNav,
  type InventoryWorkspacePage,
} from "./InventoryWorkspaceNav";

const TRANSACTION_PRESENTATION: Record<
  InventoryTransactionType,
  { label: string; variant: BadgeVariant }
> = {
  receiving: { label: "Receiving", variant: "success" },
  restock: { label: "Restock", variant: "success" },
  issuance: { label: "Issuance", variant: "orange" },
  adjustment: { label: "Adjustment", variant: "neutral" },
  waste: { label: "Waste", variant: "warning" },
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
    : "Unable to load inventory transactions.";
}

function formatSignedQuantity(value: number): string {
  return (value > 0 ? "+" : "") + quantityFormatter.format(value);
}

export function InvTransactionsPage({
  onNavigate,
}: {
  onNavigate: (page: InventoryWorkspacePage) => void;
}) {
  const [transactions, setTransactions] = useState<
    ManagerInventoryTransaction[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setTransactions(await getManagerInventoryTransactions(100));
    } catch (caught) {
      setTransactions([]);
      setError(getErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  return (
    <div className="inventory-workspace-page inventory-transactions-page">
      <header className="manager-page-header mb-3">
        <h1 className="text-foreground">Inventory Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock movement audit trail
        </p>
      </header>

      <InventoryWorkspaceNav
        active="inv-transactions"
        onNavigate={onNavigate}
      />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Loading inventory transactions…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <p>{error}</p>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadTransactions()}
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No inventory transactions are available.
        </div>
      ) : (
        <Table
          headers={[
            "Item",
            "Type",
            "Quantity Change",
            "Before → After",
            "Reason",
            "Order",
            "Date",
            "Performed By",
          ]}
        >
          {transactions.map((transaction) => {
            const typePresentation =
              TRANSACTION_PRESENTATION[transaction.transactionType];
            const isIncrease = transaction.quantityChange > 0;
            const isDecrease = transaction.quantityChange < 0;
            const ChangeIcon = isIncrease
              ? ArrowUpRight
              : isDecrease
                ? ArrowDownRight
                : ArrowRight;

            return (
              <tr key={transaction.id}>
                <Td>
                  <p className="text-sm font-bold text-foreground">
                    {transaction.itemName}
                  </p>
                  <p
                    className="mt-1 max-w-[190px] break-all font-mono text-xs text-muted-foreground/75"
                    title={transaction.id}
                  >
                    Transaction {transaction.id}
                  </p>
                </Td>
                <Td>
                  <Badge variant={typePresentation.variant}>
                    {typePresentation.label}
                  </Badge>
                </Td>
                <Td>
                  <div
                    className={
                      "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-extrabold tabular-nums " +
                      (isIncrease
                        ? "text-emerald-700"
                        : isDecrease
                          ? "text-orange-800"
                          : "text-foreground")
                    }
                  >
                    <ChangeIcon className="h-4 w-4" />
                    {formatSignedQuantity(transaction.quantityChange)}{" "}
                    {transaction.unit}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-2 whitespace-nowrap text-sm tabular-nums">
                    <span className="text-muted-foreground">
                      {quantityFormatter.format(transaction.quantityBefore)}{" "}
                      {transaction.unit}
                    </span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
                    <span className="font-bold text-foreground">
                      {quantityFormatter.format(transaction.quantityAfter)}{" "}
                      {transaction.unit}
                    </span>
                  </div>
                </Td>
                <Td className="max-w-[260px] text-sm leading-5 text-muted-foreground">
                  <span title={transaction.reason ?? undefined}>
                    {transaction.reason ?? "—"}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  {transaction.orderNumber ? (
                    <p className="font-mono text-sm font-bold text-primary">
                      {transaction.orderNumber}
                    </p>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="block text-sm font-semibold text-foreground">
                    {dateFormatter.format(new Date(transaction.createdAt))}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {timeFormatter.format(new Date(transaction.createdAt))}
                  </span>
                </Td>
                <Td className="text-sm text-muted-foreground">
                  {transaction.performedByName}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
