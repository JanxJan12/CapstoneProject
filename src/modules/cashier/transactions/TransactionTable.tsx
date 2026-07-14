import { Eye, MoreHorizontal, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../app/components/ui/dropdown-menu";
import { formatDateTime, formatMoney } from "../constants";
import type { Transaction } from "../types";
import { CashierStatusBadge, EmptyState } from "../components/CashierUI";

export function TransactionTable({
  transactions,
  onView,
  onPrint,
}: {
  transactions: Transaction[];
  onView: (transaction: Transaction) => void;
  onPrint: (transaction: Transaction) => void;
}) {
  if (!transactions.length)
    return (
      <div className="p-4">
        <EmptyState
          title="No matching transactions"
          description="Adjust the search, payment, status, date, cashier, or shift filters."
        />
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="rrj-table w-full min-w-[1050px]">
        <thead>
          <tr className="border-b border-border bg-gradient-to-r from-[#f7f1ea] to-[#fbf8f4]">
            {[
              "Transaction ID",
              "Order ID",
              "Customer",
              "Amount",
              "Method",
              "Status",
              "Cashier",
              "Date and time",
              "Actions",
            ].map((header) => (
              <th
                key={header}
                className="px-3 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((transaction) => (
            <tr key={transaction.id} className="hover:bg-muted/20">
              <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground">
                {transaction.id}
              </td>
              <td className="px-3 py-3 font-mono text-xs font-black text-primary">
                {transaction.orderId}
              </td>
              <td className="px-3 py-3 text-xs font-bold">
                {transaction.customerName}
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
              <td className="px-3 py-3 text-[10px] text-muted-foreground">
                {formatDateTime(transaction.createdAt)}
              </td>
              <td className="px-3 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={`Actions for ${transaction.id}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => onView(transaction)}>
                      <Eye className="h-4 w-4" />
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onPrint(transaction)}>
                      <Printer className="h-4 w-4" />
                      Print receipt
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onPrint(transaction)}>
                      <Printer className="h-4 w-4" />
                      Reprint receipt
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
