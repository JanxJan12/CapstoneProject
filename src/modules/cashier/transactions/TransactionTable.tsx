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
  CashierStatusBadge,
  EmptyState,
} from "../components/CashierUI";
import {
  getBasketQuantity,
  getReceiptNumber,
  getTransactionOrder,
  getTransactionShift,
} from "./transactionRecords";

export function TransactionTable({
  transactions,
  orders,
  shifts,
  onView,
  onPrint,
}: {
  transactions: Transaction[];
  orders: Order[];
  shifts: CashierShift[];
  onView: (transaction: Transaction) => void;
  onPrint: (transaction: Transaction) => void;
}) {
  if (!transactions.length)
    return (
      <div className="p-4">
        <EmptyState
          title="No matching transactions"
          description="Adjust the date, cashier, payment, shift, terminal, customer, order, or receipt filters."
        />
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table
        className="rrj-table w-full min-w-[1500px]"
        aria-label="Linked financial transaction records"
      >
        <thead>
          <tr className="border-b border-border bg-gradient-to-r from-[#f7f1ea] to-[#fbf8f4]">
            {[
              "Receipt Number",
              "Transaction ID",
              "Order ID",
              "Customer",
              "Basket",
              "Amount",
              "Payment",
              "Status",
              "Cashier",
              "Terminal",
              "Date and Time",
              "Actions",
            ].map((header) => (
              <th
                key={header}
                scope="col"
                className="px-3 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((transaction) => {
            const order = getTransactionOrder(transaction, orders);
            const shift = getTransactionShift(transaction, shifts);
            return (
              <tr key={transaction.id} className="hover:bg-muted/20">
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onView(transaction)}
                    className="min-h-11 font-mono text-xs font-black text-primary underline-offset-2 hover:underline"
                  >
                    {getReceiptNumber(transaction)}
                  </button>
                </td>
                <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground">
                  {transaction.id}
                </td>
                <td className="px-3 py-3 font-mono text-xs font-black text-foreground">
                  {transaction.orderId}
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs font-bold">
                    {transaction.customerName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {order?.contactNumber ?? "No linked contact"}
                  </p>
                </td>
                <td className="max-w-[240px] px-3 py-3">
                  <p className="text-xs font-bold">
                    {getBasketQuantity(order)} items
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {order?.items
                      .map((item) => `${item.quantity}× ${item.name}`)
                      .join(", ") ?? "Order record unavailable"}
                  </p>
                </td>
                <td className="px-3 py-3 text-sm font-black">
                  {formatMoney(transaction.amount)}
                </td>
                <td className="px-3 py-3 text-xs font-bold">
                  {transaction.method}
                </td>
                <td className="px-3 py-3">
                  <CashierStatusBadge status={transaction.status} />
                </td>
                <td className="px-3 py-3 text-xs">{transaction.cashierName}</td>
                <td className="px-3 py-3 text-[11px] text-muted-foreground">
                  {shift?.terminal ?? "Unlinked terminal"}
                </td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground">
                  {formatDateTime(transaction.createdAt)}
                </td>
                <td className="px-3 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <CashierIconButton
                        label={`Actions for ${transaction.id}`}
                        icon={MoreHorizontal}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onSelect={() => onView(transaction)}>
                        <Eye className="h-4 w-4" />
                        Transaction details
                      </DropdownMenuItem>
                      {transaction.status === "Completed" && order && (
                        <DropdownMenuItem onSelect={() => onPrint(transaction)}>
                          <Printer className="h-4 w-4" />
                          Receipt reprint
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
