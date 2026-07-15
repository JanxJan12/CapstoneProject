import { MoreHorizontal, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../app/components/ui/dropdown-menu";
import {
  CANCELLABLE_STATUSES,
  formatDateTime,
  formatElapsed,
  formatMoney,
  minutesSince,
} from "../constants";
import type { Order } from "../types";
import {
  CashierIconButton,
  CashierStatusBadge,
  EmptyState,
} from "../components/CashierUI";

export function OrderTable({
  orders,
  delayedThreshold,
  onView,
  onPrint,
  onCancel,
}: {
  orders: Order[];
  delayedThreshold: number;
  onView: (order: Order) => void;
  onPrint: (order: Order) => void;
  onCancel: (order: Order) => void;
}) {
  if (!orders.length)
    return (
      <div className="p-4">
        <EmptyState
          title="No matching orders"
          description="Adjust the search, status, type, or date filters."
        />
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table
        className="rrj-table w-full min-w-[1100px]"
        aria-label="Filtered cashier orders"
      >
        <thead>
          <tr className="border-b border-border bg-gradient-to-r from-[#f7f1ea] to-[#fbf8f4]">
            {[
              "Order ID",
              "Customer",
              "Items",
              "Type",
              "Total",
              "Status",
              "Created",
              "Elapsed",
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
          {orders.map((order) => {
            const delayed =
              minutesSince(order.createdAt) > delayedThreshold &&
              !["Delivered", "Completed", "Cancelled"].includes(order.status);
            return (
              <tr
                key={order.id}
                className={delayed ? "bg-red-50/50" : "hover:bg-muted/20"}
              >
                <td className="px-3 py-3">
                  <button
                    onClick={() => onView(order)}
                    className="min-h-11 font-mono text-xs font-black text-primary underline-offset-2 hover:underline"
                  >
                    {order.id}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs font-bold">{order.customerName}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {order.contactNumber}
                  </p>
                </td>
                <td className="max-w-[220px] px-3 py-3">
                  <p className="truncate text-[10px] text-muted-foreground">
                    {order.items
                      .map((item) => `${item.quantity}× ${item.name}`)
                      .join(", ")}
                  </p>
                </td>
                <td className="px-3 py-3 text-xs font-semibold">
                  {order.type}
                </td>
                <td className="px-3 py-3 text-xs font-black">
                  {formatMoney(order.total)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <CashierStatusBadge status={order.status} />
                    {delayed && (
                      <CashierStatusBadge status={order.status} delayed />
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-[10px] text-muted-foreground">
                  {formatDateTime(order.createdAt)}
                </td>
                <td
                  className={`px-3 py-3 text-[10px] font-bold ${delayed ? "text-red-700" : "text-muted-foreground"}`}
                >
                  {formatElapsed(order.createdAt)}
                </td>
                <td className="px-3 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <CashierIconButton
                        label={`Actions for ${order.id}`}
                        icon={MoreHorizontal}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => onView(order)}>
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onPrint(order)}>
                        <Printer className="h-4 w-4" />
                        {order.transactionId
                          ? "Reprint receipt"
                          : "Print receipt"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onView(order)}>
                        View timeline
                      </DropdownMenuItem>
                      {CANCELLABLE_STATUSES.includes(order.status) && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onCancel(order)}
                        >
                          Cancel order
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
