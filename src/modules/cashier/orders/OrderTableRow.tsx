import { Fragment, memo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  History,
  MoreHorizontal,
  Pencil,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CashierIconButton, StatusBadge } from "../components";
import { CANCELLABLE_STATUSES, formatMoney } from "../constants";
import type { Order } from "../types";
import { OrderExpandedContent } from "./OrderExpandedContent";
import {
  elapsedOrderMinutes,
  formatElapsedMinutes,
  getItemsSummary,
  getKitchenStatus,
  getOrderPriority,
  getRiderStatus,
  isOrderDelayed,
  type OrderPriority,
} from "./orderOperations";

type BadgeTone = "neutral" | "amber" | "blue" | "green" | "red";
const TONE_STYLE: Record<BadgeTone, string> = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-red-200 bg-red-50 text-red-800",
};

const EDITABLE_ORDER_STATUSES = new Set<Order["status"]>([
  "Awaiting Payment",
  "Confirmed",
  "Preparing",
  "Ready",
  "Waiting for Rider",
]);

export interface OrderTableRowProps {
  order: Order;
  delayedThreshold: number;
  now: number;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: (orderId: string) => void;
  onToggleExpand: (orderId: string) => void;
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
  onCancel: (order: Order) => void;
}

export const OrderTableRow = memo(function OrderTableRow(
  props: OrderTableRowProps,
) {
  const { order, delayedThreshold, now, selected, expanded } = props;
  const delayed = isOrderDelayed(order, delayedThreshold, now);
  const kitchen = getKitchenStatus(order);
  const rider = getRiderStatus(order);
  const priority = getOrderPriority(order, delayedThreshold, now);
  return (
    <Fragment>
      <tr
        className={
          delayed
            ? "border-l-4 border-l-red-500 bg-red-50/60"
            : selected
              ? "bg-amber-50/60"
              : "hover:bg-muted/20"
        }
      >
        <td className="px-3 py-3">
          <input
            type="checkbox"
            checked={selected}
            aria-label={`Select ${order.id}`}
            onChange={() => props.onToggleSelect(order.id)}
            className="h-4 w-4 accent-primary"
          />
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${order.id}`}
              aria-expanded={expanded}
              onClick={() => props.onToggleExpand(order.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => props.onView(order)}
              className="min-h-11 font-mono text-xs font-black text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {order.id}
            </button>
          </div>
        </td>
        <td className="px-3 py-3 text-xs font-bold">{order.customerName}</td>
        <td className="px-3 py-3 text-[11px] font-semibold text-muted-foreground">
          {order.contactNumber}
        </td>
        <td className="max-w-[260px] px-3 py-3">
          <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">
            {getItemsSummary(order)}
          </p>
        </td>
        <td className="px-3 py-3 text-xs font-semibold">{order.type}</td>
        <td className="px-3 py-3">
          <OperationalBadge label={kitchen} tone={kitchenTone(kitchen)} />
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={order.paymentStatus} />
        </td>
        <td className="px-3 py-3">
          <OperationalBadge label={rider} tone={riderTone(rider)} />
        </td>
        <td
          className={`px-3 py-3 text-[11px] font-black ${delayed ? "text-red-700" : "text-muted-foreground"}`}
        >
          {formatElapsedMinutes(elapsedOrderMinutes(order, now))}
        </td>
        <td className="px-3 py-3">
          <OperationalBadge label={priority} tone={priorityTone(priority)} />
        </td>
        <td className="px-3 py-3 text-xs font-black">
          {formatMoney(order.total)}
        </td>
        <td className="px-3 py-3">
          <OrderActions {...props} />
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-[#fbf8f4]">
          <OrderExpandedContent order={order} onView={props.onView} />
        </tr>
      ) : null}
    </Fragment>
  );
});

function OrderActions(props: OrderTableRowProps) {
  const { order } = props;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CashierIconButton
          label={`Actions for ${order.id}`}
          icon={MoreHorizontal}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <Action
          icon={Eye}
          label="Quick view"
          onSelect={() => props.onToggleExpand(order.id)}
        />
        {EDITABLE_ORDER_STATUSES.has(order.status) ? (
          <Action
            icon={Pencil}
            label="Edit"
            onSelect={() => props.onEdit(order)}
          />
        ) : null}
        <Action
          icon={History}
          label="Timeline"
          onSelect={() => props.onView(order)}
        />
        {CANCELLABLE_STATUSES.includes(order.status) ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => props.onCancel(order)}
          >
            <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Action({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof Eye;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </DropdownMenuItem>
  );
}

function OperationalBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${TONE_STYLE[tone]}`}
    >
      {label}
    </span>
  );
}

const kitchenTone = (value: string): BadgeTone =>
  value === "Cancelled"
    ? "red"
    : value === "Ready" || value === "Complete"
      ? "green"
      : value === "Preparing"
        ? "amber"
        : "blue";
const riderTone = (value: string): BadgeTone =>
  value === "Unassigned"
    ? "red"
    : value === "Not required"
      ? "neutral"
      : value.includes("Delivered")
        ? "green"
        : "blue";
const priorityTone = (value: OrderPriority): BadgeTone =>
  value === "Critical"
    ? "red"
    : value === "High"
      ? "amber"
      : value === "Normal"
        ? "blue"
        : "neutral";
