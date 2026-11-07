import { memo } from "react";
import {
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CashierIconButton, StatusBadge } from "../components";
import {
  formatMoney,
} from "../constants";
import type { Order } from "../types";
import {
  canCancelCashierOrder,
  getOrderWaitingPresentation,
} from "./orderOperations";



export interface OrderTableRowProps {
  order: Order;
  delayedThreshold: number;
  now: number;
  selected: boolean;
  showActions: boolean;
  onToggleSelect: (orderId: string) => void;
  onView: (order: Order, trigger: HTMLElement) => void;
  onCancel: (order: Order) => void;
}

export const OrderTableRow = memo(function OrderTableRow(
  props: OrderTableRowProps,
) {
  const { order, delayedThreshold, now, selected } = props;
  const waiting = getOrderWaitingPresentation(order, delayedThreshold, now);

  return (
    <tr
        data-selected={selected || undefined}
        data-delayed={waiting.delayed || undefined}
      >
        <td className="px-1 py-1">
          <label className="inline-flex h-11 w-11 items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              aria-label={`Select ${order.id}`}
              onChange={() => props.onToggleSelect(order.id)}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center">
            <button
              type="button"
              aria-label={`View details for ${order.id}`}
              onClick={(event) => props.onView(order, event.currentTarget)}
              className="min-h-11 rounded-md font-mono text-[13px] font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {order.id}
            </button>
          </div>
        </td>
        <td className="px-3 py-2 text-[13px] font-semibold">
          <span className="block truncate" title={order.customerName}>
            {order.customerName}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-[13px]">
          {order.type}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right text-[13px] font-bold tabular-nums">
          {formatMoney(order.total)}
        </td>
        <td className="px-3 py-2">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-3 py-2">
          <StatusBadge
            status={order.paymentStatus}
            unknownLabel="Payment status unavailable"
            className={
              order.paymentStatus === "Verified"
                ? "border-emerald-100 bg-emerald-50/55 text-emerald-700 shadow-none"
                : undefined
            }
          />
        </td>

        {props.showActions ? (
          <td className="px-1 py-2 text-center">
            {canCancelCashierOrder(order) ? (
              <OrderActionMenu order={order} onCancel={props.onCancel} />
            ) : null}
          </td>
        ) : null}
    </tr>
  );
});

export function OrderActionMenu({
  order,
  onCancel,
}: {
  order: Order;
  onCancel: (order: Order) => void;
}) {
  if (!canCancelCashierOrder(order)) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CashierIconButton
          label={`Actions for ${order.id}`}
          icon={MoreHorizontal}
          className="h-11 w-11 rounded-lg"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-52 max-w-[calc(100vw-1rem)]">
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onCancel(order)}
        >
          <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
