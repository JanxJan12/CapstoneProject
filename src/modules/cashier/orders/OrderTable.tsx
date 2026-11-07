import { ArrowDown, ArrowUp } from "lucide-react";
import { EmptyState } from "../components";
import type { Order } from "../types";
import type { OrderSortDescriptor, OrderSortKey } from "./orderOperations";
import { canCancelCashierOrder } from "./orderOperations";
import { OrderTableRow } from "./OrderTableRow";

const HEADERS: { label: string; sortKey?: OrderSortKey; className?: string }[] =
  [
    { label: "Order", sortKey: "orderNumber" },
    { label: "Customer", sortKey: "customer" },
    { label: "Type", sortKey: "type" },
    { label: "Total", sortKey: "total", className: "text-right" },
    { label: "Order status" },
    { label: "Payment", sortKey: "payment" },
  ];

export interface OrderTableProps {
  orders: Order[];
  delayedThreshold: number;
  now: number;
  sorts: OrderSortDescriptor[];
  selectedIds: Set<string>;
  onSort: (key: OrderSortKey, additive: boolean) => void;
  onToggleSelect: (orderId: string) => void;
  onToggleSelectAll: () => void;
  onView: (order: Order, trigger: HTMLElement) => void;
  onCancel: (order: Order) => void;
}

export function OrderTable(props: OrderTableProps) {
  if (!props.orders.length) {
    return (
      <div className="p-4">
        <EmptyState
          title="No matching orders"
          description="Adjust your search or filters to find an order."
        />
      </div>
    );
  }

  const allSelected = props.orders.every((order) =>
    props.selectedIds.has(order.id),
  );
  const someSelected = props.orders.some((order) =>
    props.selectedIds.has(order.id),
  );
  const showActions = props.orders.some(canCancelCashierOrder);
  return (
    <div className="overflow-x-auto" role="region" aria-label="Scrollable order table" tabIndex={0}>
      <table
        className="rrj-table cashier-orders-table w-full min-w-[1040px] table-fixed"
        aria-label="Central order operations table"
      >
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[14%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[19%]" />
          <col className={showActions ? "w-[17%]" : "w-[22%]"} />
          {showActions ? <col className="w-[5%]" /> : null}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="w-11 px-1 py-1 text-left">
              <label className="inline-flex h-11 w-11 items-center justify-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-checked={
                    someSelected && !allSelected ? "mixed" : allSelected
                  }
                  aria-label="Select all orders on this page"
                  onChange={props.onToggleSelectAll}
                  className="h-5 w-5 accent-primary"
                />
              </label>
            </th>
            {HEADERS.map((header) => (
              <SortableHeader
                key={header.label}
                {...header}
                sorts={props.sorts}
                onSort={props.onSort}
              />
            ))}
            {showActions ? <th scope="col" className="px-2.5 py-2 text-center text-xs font-semibold text-muted-foreground">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.orders.map((order) => (
            <OrderTableRow
              key={order.id}
              order={order}
              delayedThreshold={props.delayedThreshold}
              now={props.now}
              selected={props.selectedIds.has(order.id)}
              showActions={showActions}
              onToggleSelect={props.onToggleSelect}
              onView={props.onView}
              onCancel={props.onCancel}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sorts,
  className,
  onSort,
}: {
  label: string;
  sortKey?: OrderSortKey;
  sorts: OrderSortDescriptor[];
  className?: string;
  onSort: (key: OrderSortKey, additive: boolean) => void;
}) {
  const index = sortKey ? sorts.findIndex((sort) => sort.key === sortKey) : -1;
  const sort = index >= 0 ? sorts[index] : undefined;
  return (
    <th
      scope="col"
      aria-sort={
        sort
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={`px-3 py-2 text-left text-xs font-semibold text-muted-foreground ${className ?? ""}`}
    >
      {sortKey ? (
        <button
          type="button"
          title="Click to sort. Hold Shift to add another sort."
          className={`flex min-h-11 w-full items-center gap-1.5 whitespace-nowrap rounded-md text-xs font-semibold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className === "text-right" ? "justify-end" : "text-left"}`}
          onClick={(event) => onSort(sortKey, event.shiftKey)}
        >
          {label}
          {sort ? (
            <span className="inline-flex items-center gap-0.5 text-primary">
              {sort.direction === "asc" ? (
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              )}
              {sorts.length > 1 ? <span>{index + 1}</span> : null}
            </span>
          ) : null}
        </button>
      ) : (
        label
      )}
    </th>
  );
}
