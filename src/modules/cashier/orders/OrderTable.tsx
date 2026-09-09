import { ArrowDown, ArrowUp } from "lucide-react";
import { EmptyState } from "../components";
import type { Order } from "../types";
import type { OrderSortDescriptor, OrderSortKey } from "./orderOperations";
import { OrderTableRow } from "./OrderTableRow";

const HEADERS: { label: string; sortKey?: OrderSortKey; className?: string }[] =
  [
    { label: "Order Number", sortKey: "orderNumber" },
    { label: "Customer", sortKey: "customer" },
    { label: "Phone", sortKey: "phone" },
    { label: "Items", sortKey: "items", className: "min-w-[220px]" },
    { label: "Order Type", sortKey: "type" },
    { label: "Kitchen Status", sortKey: "kitchen" },
    { label: "Payment Status", sortKey: "payment" },
    { label: "Rider Status", sortKey: "rider" },
    { label: "Elapsed Time", sortKey: "elapsed" },
    { label: "Priority", sortKey: "priority" },
    { label: "Total", sortKey: "total" },
    { label: "Actions" },
  ];

export interface OrderTableProps {
  orders: Order[];
  delayedThreshold: number;
  now: number;
  sorts: OrderSortDescriptor[];
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onSort: (key: OrderSortKey, additive: boolean) => void;
  onToggleSelect: (orderId: string) => void;
  onToggleSelectAll: () => void;
  onToggleExpand: (orderId: string) => void;
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
  onCancel: (order: Order) => void;
}

export function OrderTable(props: OrderTableProps) {
  if (!props.orders.length) {
    return (
      <div className="p-4">
        <EmptyState
          title="No matching orders"
          description="Adjust the search, status, type, date, or quick filters."
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
  return (
    <div className="overflow-x-auto">
      <table
        className="rrj-table w-full min-w-[1920px]"
        aria-label="Central order operations table"
      >
        <thead>
          <tr className="border-b border-border bg-gradient-to-r from-[#f7f1ea] to-[#fbf8f4]">
            <th scope="col" className="w-12 px-3 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                aria-checked={
                  someSelected && !allSelected ? "mixed" : allSelected
                }
                aria-label="Select all orders on this page"
                onChange={props.onToggleSelectAll}
                className="h-4 w-4 accent-primary"
              />
            </th>
            {HEADERS.map((header) => (
              <SortableHeader
                key={header.label}
                {...header}
                sorts={props.sorts}
                onSort={props.onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {props.orders.map((order) => (
            <OrderTableRow
              key={order.id}
              order={order}
              delayedThreshold={props.delayedThreshold}
              now={props.now}
              selected={props.selectedIds.has(order.id)}
              expanded={props.expandedIds.has(order.id)}
              onToggleSelect={props.onToggleSelect}
              onToggleExpand={props.onToggleExpand}
              onView={props.onView}
              onEdit={props.onEdit}
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
      className={`px-3 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground ${className ?? ""}`}
    >
      {sortKey ? (
        <button
          type="button"
          title="Click to sort. Hold Shift to add another sort."
          className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
