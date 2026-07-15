import { memo, useMemo } from "react";
import { Eye, MoreHorizontal, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../app/components/ui/dropdown-menu";
import { formatDateTime, formatMoney } from "../constants";
import type { CashierShift, Order, Transaction } from "../types";
import {
  CashierIconButton,
  DataTable,
  type DataTableColumn,
  StatusBadge,
} from "../components";
import { getBasketQuantity, getReceiptNumber } from "./transactionRecords";

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
  onPrint,
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
        header: "Receipt Number",
        cell: (transaction) => (
          <button
            type="button"
            onClick={() => onView(transaction)}
            className="min-h-11 font-mono text-xs font-black text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {getReceiptNumber(transaction)}
          </button>
        ),
      },
      {
        id: "transaction",
        header: "Transaction ID",
        cellClassName: "font-mono text-[10px] text-muted-foreground",
        cell: (transaction) => transaction.id,
      },
      {
        id: "order",
        header: "Order ID",
        cellClassName: "font-mono text-xs font-black text-foreground",
        cell: (transaction) => transaction.orderId,
      },
      {
        id: "customer",
        header: "Customer",
        cell: (transaction) => {
          const order = orderById.get(transaction.orderId);
          return (
            <>
              <p className="text-xs font-bold">{transaction.customerName}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {order?.contactNumber ?? "No linked contact"}
              </p>
            </>
          );
        },
      },
      {
        id: "basket",
        header: "Basket",
        cellClassName: "max-w-[240px]",
        cell: (transaction) => {
          const order = orderById.get(transaction.orderId);
          return (
            <>
              <p className="text-xs font-bold">
                {getBasketQuantity(order)} items
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {order?.items
                  .map((item) => `${item.quantity}× ${item.name}`)
                  .join(", ") ?? "Order record unavailable"}
              </p>
            </>
          );
        },
      },
      {
        id: "amount",
        header: "Amount",
        cellClassName: "text-sm font-black",
        cell: (transaction) => formatMoney(transaction.amount),
      },
      {
        id: "payment",
        header: "Payment",
        cellClassName: "text-xs font-bold",
        cell: (transaction) => transaction.method,
      },
      {
        id: "status",
        header: "Status",
        cell: (transaction) => <StatusBadge status={transaction.status} />,
      },
      {
        id: "cashier",
        header: "Cashier",
        cellClassName: "text-xs",
        cell: (transaction) => transaction.cashierName,
      },
      {
        id: "terminal",
        header: "Terminal",
        cellClassName: "text-[11px] text-muted-foreground",
        cell: (transaction) =>
          shiftById.get(transaction.shiftId)?.terminal ?? "Unlinked terminal",
      },
      {
        id: "created",
        header: "Date and Time",
        cellClassName: "text-[10px] text-muted-foreground",
        cell: (transaction) => formatDateTime(transaction.createdAt),
      },
      {
        id: "actions",
        header: "Actions",
        cell: (transaction) => {
          const order = orderById.get(transaction.orderId);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <CashierIconButton
                  label={`Actions for ${transaction.id}`}
                  icon={MoreHorizontal}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => onView(transaction)}>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Transaction details
                </DropdownMenuItem>
                {transaction.status === "Completed" && order ? (
                  <DropdownMenuItem onSelect={() => onPrint(transaction)}>
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    Receipt reprint
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onPrint, onView, orderById, shiftById],
  );

  return (
    <DataTable
      rows={transactions}
      columns={columns}
      rowKey={(transaction) => transaction.id}
      label="Linked financial transaction records"
      emptyTitle="No matching transactions"
      emptyDescription="Adjust the date, cashier, payment, shift, terminal, customer, order, or receipt filters."
      minWidthClassName="min-w-[1500px]"
    />
  );
});
