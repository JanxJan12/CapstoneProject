import { Fragment } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  History,
  MoreHorizontal,
  Pencil,
  Printer,
  UserPlus,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../app/components/ui/dropdown-menu";
import {
  CANCELLABLE_STATUSES,
  formatDateTime,
  formatMoney,
} from "../constants";
import type { Order } from "../types";
import {
  CashierIconButton,
  CashierStatusBadge,
  EmptyState,
} from "../components/CashierUI";
import {
  elapsedOrderMinutes,
  getItemsSummary,
  getKitchenStatus,
  getOrderPriority,
  getRiderStatus,
  isOrderDelayed,
  type OrderSortDescriptor,
  type OrderSortKey,
} from "./orderOperations";

const HEADERS: { label: string; key?: OrderSortKey; className?: string }[] = [
  { label: "Order Number", key: "orderNumber" },
  { label: "Customer", key: "customer" },
  { label: "Phone", key: "phone" },
  { label: "Items", key: "items", className: "min-w-[220px]" },
  { label: "Order Type", key: "type" },
  { label: "Kitchen Status", key: "kitchen" },
  { label: "Payment Status", key: "payment" },
  { label: "Rider Status", key: "rider" },
  { label: "Elapsed Time", key: "elapsed" },
  { label: "Priority", key: "priority" },
  { label: "Total", key: "total" },
  { label: "Actions" },
];

function formatElapsedMinutes(minutes: number) {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function OperationalBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "amber" | "blue" | "green" | "red" | "violet";
}) {
  const tones = {
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  };
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${tones[tone]}`}
    >
      {label}
    </span>
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
          {sort && (
            <span className="inline-flex items-center gap-0.5 text-primary">
              {sort.direction === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {sorts.length > 1 && <span>{index + 1}</span>}
            </span>
          )}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function OrderTable({
  orders,
  delayedThreshold,
  now,
  sorts,
  selectedIds,
  expandedIds,
  onSort,
  onToggleSelect,
  onToggleSelectAll,
  onToggleExpand,
  onView,
  onEdit,
  onPrint,
  onAssignRider,
  onCancel,
  onDuplicate,
}: {
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
  onPrint: (order: Order) => void;
  onAssignRider: (order: Order) => void;
  onCancel: (order: Order) => void;
  onDuplicate: (order: Order) => void;
}) {
  if (!orders.length)
    return (
      <div className="p-4">
        <EmptyState
          title="No matching orders"
          description="Adjust the search, status, type, date, or quick filters."
        />
      </div>
    );

  const allSelected = orders.every((order) => selectedIds.has(order.id));
  const someSelected = orders.some((order) => selectedIds.has(order.id));

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
                onChange={onToggleSelectAll}
                className="h-4 w-4 accent-primary"
              />
            </th>
            {HEADERS.map((header) => (
              <SortableHeader
                key={header.label}
                label={header.label}
                sortKey={header.key}
                sorts={sorts}
                className={header.className}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => {
            const delayed = isOrderDelayed(order, delayedThreshold, now);
            const expanded = expandedIds.has(order.id);
            const elapsed = elapsedOrderMinutes(order, now);
            const kitchen = getKitchenStatus(order);
            const rider = getRiderStatus(order);
            const priority = getOrderPriority(order, delayedThreshold, now);
            return (
              <Fragment key={order.id}>
                <tr
                  className={
                    delayed
                      ? "border-l-4 border-l-red-500 bg-red-50/60"
                      : selectedIds.has(order.id)
                        ? "bg-amber-50/60"
                        : "hover:bg-muted/20"
                  }
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      aria-label={`Select ${order.id}`}
                      onChange={() => onToggleSelect(order.id)}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`${expanded ? "Collapse" : "Expand"} ${order.id}`}
                        aria-expanded={expanded}
                        onClick={() => onToggleExpand(order.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-primary"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onView(order)}
                        className="min-h-11 font-mono text-xs font-black text-primary underline-offset-2 hover:underline"
                      >
                        {order.id}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-bold">
                    {order.customerName}
                  </td>
                  <td className="px-3 py-3 text-[11px] font-semibold text-muted-foreground">
                    {order.contactNumber}
                  </td>
                  <td className="max-w-[260px] px-3 py-3">
                    <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                      {getItemsSummary(order)}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold">
                    {order.type}
                  </td>
                  <td className="px-3 py-3">
                    <OperationalBadge
                      label={kitchen}
                      tone={
                        kitchen === "Cancelled"
                          ? "red"
                          : kitchen === "Ready" || kitchen === "Complete"
                            ? "green"
                            : kitchen === "Preparing"
                              ? "amber"
                              : "blue"
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <CashierStatusBadge status={order.paymentStatus} />
                  </td>
                  <td className="px-3 py-3">
                    <OperationalBadge
                      label={rider}
                      tone={
                        rider === "Unassigned"
                          ? "red"
                          : rider === "Not required"
                            ? "neutral"
                            : rider.includes("Delivered")
                              ? "green"
                              : "blue"
                      }
                    />
                  </td>
                  <td
                    className={`px-3 py-3 text-[11px] font-black ${delayed ? "text-red-700" : "text-muted-foreground"}`}
                  >
                    {formatElapsedMinutes(elapsed)}
                  </td>
                  <td className="px-3 py-3">
                    <OperationalBadge
                      label={priority}
                      tone={
                        priority === "Critical"
                          ? "red"
                          : priority === "High"
                            ? "amber"
                            : priority === "Normal"
                              ? "blue"
                              : "neutral"
                      }
                    />
                  </td>
                  <td className="px-3 py-3 text-xs font-black">
                    {formatMoney(order.total)}
                  </td>
                  <td className="px-3 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <CashierIconButton
                          label={`Actions for ${order.id}`}
                          icon={MoreHorizontal}
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onSelect={() => onToggleExpand(order.id)}
                        >
                          <Eye className="h-4 w-4" />
                          Quick view
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onEdit(order)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onPrint(order)}>
                          <Printer className="h-4 w-4" />
                          Print
                        </DropdownMenuItem>
                        {order.type === "Delivery" &&
                          !["Delivered", "Completed", "Cancelled"].includes(
                            order.status,
                          ) && (
                            <DropdownMenuItem
                              onSelect={() => onAssignRider(order)}
                            >
                              <UserPlus className="h-4 w-4" />
                              Assign rider
                            </DropdownMenuItem>
                          )}
                        <DropdownMenuItem onSelect={() => onDuplicate(order)}>
                          <Copy className="h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onView(order)}>
                          <History className="h-4 w-4" />
                          Timeline
                        </DropdownMenuItem>
                        {CANCELLABLE_STATUSES.includes(order.status) && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onCancel(order)}
                          >
                            <XCircle className="h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
                {expanded && (
                  <tr className="bg-[#fbf8f4]">
                    <td colSpan={13} className="px-6 py-4">
                      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr]">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            Fulfillment detail
                          </p>
                          <p className="mt-2 text-xs font-bold">
                            {order.type === "Dine-in"
                              ? `Table ${order.tableNumber ?? "not assigned"}`
                              : order.type === "Delivery"
                                ? (order.deliveryAddress ??
                                  "Address not provided")
                                : "Take-out counter"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {order.orderInstructions ||
                              "No special instructions"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            Item breakdown
                          </p>
                          <ul className="mt-2 space-y-1 text-[11px]">
                            {order.items.map((item) => (
                              <li
                                key={item.id}
                                className="flex justify-between gap-3"
                              >
                                <span>
                                  {item.quantity}× {item.name}
                                </span>
                                <strong>
                                  {formatMoney(item.unitPrice * item.quantity)}
                                </strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            Latest timeline
                          </p>
                          <div className="mt-2 space-y-2">
                            {[...order.timeline]
                              .reverse()
                              .slice(0, 2)
                              .map((event) => (
                                <div key={event.id}>
                                  <p className="text-[11px] font-bold">
                                    {event.label}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatDateTime(event.timestamp)} ·{" "}
                                    {event.actor}
                                  </p>
                                </div>
                              ))}
                            <button
                              type="button"
                              onClick={() => onView(order)}
                              className="min-h-9 text-[10px] font-black text-primary hover:underline"
                            >
                              Open full timeline
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
