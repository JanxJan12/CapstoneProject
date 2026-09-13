import { Badge } from "@/components/common/Badge";
import type { BadgeVariant } from "@/types";

import type {
  ManagerOrderStatus,
  ManagerPaymentStatus,
} from "../api/managerApi";

export const MANAGER_ORDER_STATUS_PRESENTATION: Record<
  ManagerOrderStatus,
  { label: string; variant: BadgeVariant; needsAttention: boolean }
> = {
  waiting_payment_verification: {
    label: "Awaiting Payment",
    variant: "warning",
    needsAttention: true,
  },
  confirmed: { label: "Confirmed", variant: "info", needsAttention: false },
  preparing: { label: "Preparing", variant: "orange", needsAttention: false },
  ready: { label: "Ready", variant: "purple", needsAttention: false },
  waiting_for_rider: {
    label: "Waiting for Rider",
    variant: "warning",
    needsAttention: true,
  },
  rider_accepted: {
    label: "Rider Accepted",
    variant: "info",
    needsAttention: false,
  },
  picked_up: { label: "Picked Up", variant: "info", needsAttention: false },
  out_for_delivery: {
    label: "Out for Delivery",
    variant: "info",
    needsAttention: false,
  },
  delivered: {
    label: "Delivered",
    variant: "neutral",
    needsAttention: false,
  },
  completed: {
    label: "Completed",
    variant: "neutral",
    needsAttention: false,
  },
  cancelled: {
    label: "Cancelled",
    variant: "danger",
    needsAttention: true,
  },
  rejected: {
    label: "Rejected",
    variant: "danger",
    needsAttention: true,
  },
};

const PAYMENT_STATUS_PRESENTATION: Record<
  ManagerPaymentStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "Pending", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  voided: { label: "Voided", variant: "neutral" },
};

export function ManagerOrderStatusBadge({
  status,
}: {
  status: ManagerOrderStatus;
}) {
  const presentation = MANAGER_ORDER_STATUS_PRESENTATION[status];

  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}

export function ManagerPaymentStatusBadge({
  status,
}: {
  status: ManagerPaymentStatus;
}) {
  const presentation = PAYMENT_STATUS_PRESENTATION[status];

  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}

export function managerOrderNeedsAttention(
  status: ManagerOrderStatus,
): boolean {
  return MANAGER_ORDER_STATUS_PRESENTATION[status].needsAttention;
}
