import { memo, useMemo } from "react";
import { formatDateTime, formatMoney } from "../constants";
import type { CashierShift, Order, Transaction } from "../types";
import {
  DataTable,
  type DataTableColumn,
  StatusBadge,
} from "../components";
import {
  getBasketQuantity,
  getReceiptNumber,
} from "./transactionRecords";

export interface TransactionTableProps {
  transactions: Transaction[];
  orders: Order[];
  shifts: CashierShift[];
  onView: (transaction: Transaction) => void;
  onPrint: (transaction: Transaction) => void;
}

export const TransactionTable = memo(function TransactionTable({
  transactions,
  orders,
  shifts,
  onView,
}: TransactionTableProps) {
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const shiftById = useMemo(
    () => new Map(shifts.map((shift) => [shift.id, shift])),
    [shifts],
  );

  const columns = useMemo<DataTableColumn<Transaction>[]>(
    () => [
      {
        id: "receipt",
        header: "Receipt",
        headerClassName: "text-[10px] tracking-wider",
        cellClassName: "max-w-[160px]",
        cell: (transaction) => (
          <div className="min-w-0">
            <button
              type="button"
              aria-label={`View transaction details for ${getReceiptNumber(transaction)}`}
              onClick={() => onView(transaction)}
              title="View transaction details"
              className="min-h-11 rounded-md font-mono text-[13px] font-black text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {getReceiptNumber(transaction)}
            </button>
          </div>
        ),
      },
      {
        id: "order",
        header: "Order",
        headerClassName: "text-[10px] tracking-wider",
        cellClassName: "max-w-[245px]",
        cell: (transaction) => {
          const order = orderById.get(transaction.orderId);
          const basketSummary = order?.items
            .map((item) => `${item.quantity}× ${item.name}`)
            .join(", ");
          return (
            <>
              <p className="font-mono text-xs font-black text-foreground">
                {transaction.orderId}
              </p>
              {order ? <p className="max-w-[225px] truncate text-[11px] text-muted-foreground" title={basketSummary}>{getBasketQuantity(order)}{" "}
{getBasketQuantity(order) === 1 ? "item" : "items"} · {basketSummary}</p> : null}
            </>
          );
        },
      },
      {
        id: "customer",
        header: "Customer",
        headerClassName: "text-[10px] tracking-wider",
        cell: (transaction) => {
          return (
            <>
              <p className="text-[13px] font-bold">{transaction.customerName}</p>
            </>
          );
        },
      },
      {
        id: "amount",
        header: "Recorded amount",
        headerClassName: "text-[10px] tracking-wider",
        cellClassName: "text-sm font-black",
        cell: (transaction) => formatMoney(transaction.amount),
      },
      {
        id: "payment",
        header: "Payment",
        headerClassName: "text-[10px] tracking-wider",
        cellClassName: "text-xs font-bold",
        cell: (transaction) => transaction.method,
      },
      {
        id: "status",
        header: "Status",
        headerClassName: "text-[10px] tracking-wider",
        cell: (transaction) => (
          <StatusBadge
            status={transaction.status}
            className={
              transaction.status === "Completed"
                ? "border-emerald-100 bg-emerald-50/55 text-emerald-700 shadow-none"
                : undefined
            }
          />
        ),
      },
      {
        id: "created",
        header: "Date",
        headerClassName: "text-[10px] tracking-wider",
        cellClassName: "whitespace-nowrap",
        cell: (transaction) => (
          <>
            <p className="text-xs font-semibold text-foreground/75">
              {formatDateTime(transaction.createdAt)}
            </p>
            <span className="sr-only">Cashier {transaction.cashierName}; terminal {shiftById.get(transaction.shiftId)?.terminal ?? "unlinked"}</span>
          </>
        ),
      },
    ],
  [onView, orderById, shiftById],
  );

  return (
    <DataTable
      rows={transactions}
      columns={columns}
      rowKey={(transaction) => transaction.id}
      label="Cashier transaction and receipt records"
      emptyTitle="No matching transactions"
      emptyDescription="Adjust your search or filters to find a transaction."
      minWidthClassName="min-w-[980px]"
    />
  );
});
