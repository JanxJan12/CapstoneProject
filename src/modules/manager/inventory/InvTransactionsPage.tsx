import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/common/Button";
import { StatusBadge } from "../../../components/common/Badge";
import { Table, Td } from "../../../components/common/Table";
import {
  getManagerInventoryTransactions,
  type ManagerInventoryTransaction,
} from "./inventoryApi";

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
    : "Unable to load inventory transactions.";
}

function formatSignedQuantity(value: number): string {
  return `${value > 0 ? "+" : ""}${quantityFormatter.format(value)}`;
}

function getTransactionStatus(transactionType: string): string {
  return transactionType === "receiving" ? "stock receiving" : transactionType;
}

export function InvTransactionsPage() {
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
    <div>
      <div className="mb-4">
        <h1 className="text-base font-bold text-foreground">
          Inventory Transactions
        </h1>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
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
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
          No inventory transactions were returned by PostgreSQL.
        </div>
      ) : (
        <Table
          headers={[
            "Transaction ID",
            "Item",
            "Type",
            "Qty Change",
            "Qty Before",
            "Qty After",
            "Reason",
            "Order",
            "Date",
            "Performed By",
          ]}
        >
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="hover:bg-muted/30">
              <Td>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {transaction.id}
                </span>
              </Td>
              <Td className="font-semibold text-xs">{transaction.itemName}</Td>
              <Td>
                <StatusBadge
                  status={getTransactionStatus(transaction.transactionType)}
                />
              </Td>
              <Td
                className={`font-mono text-xs font-bold ${
                  transaction.quantityChange > 0
                    ? "text-green-600"
                    : transaction.quantityChange < 0
                      ? "text-red-600"
                      : "text-foreground"
                }`}
              >
                {formatSignedQuantity(transaction.quantityChange)}{" "}
                {transaction.unit}
              </Td>
              <Td className="font-mono text-xs text-muted-foreground">
                {quantityFormatter.format(transaction.quantityBefore)}{" "}
                {transaction.unit}
              </Td>
              <Td className="font-mono text-xs text-muted-foreground">
                {quantityFormatter.format(transaction.quantityAfter)}{" "}
                {transaction.unit}
              </Td>
              <Td className="max-w-[240px] text-xs text-muted-foreground">
                {transaction.reason ?? "—"}
              </Td>
              <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {transaction.orderNumber ?? "—"}
              </Td>
              <Td className="whitespace-nowrap text-[10px] text-muted-foreground">
                {dateTimeFormatter.format(new Date(transaction.createdAt))}
              </Td>
              <Td className="text-xs text-muted-foreground">
                {transaction.performedByName}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
