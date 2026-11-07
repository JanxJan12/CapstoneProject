import { supabase } from "@/lib/supabase";
import type { Order } from "../types";

interface AssignmentRow {
  order_id: string;
  assignment_id: string;
  assignment_status: NonNullable<Order["riderAssignmentStatus"]>;
  assigned_at: string;
  assignment_updated_at: string;
}

const ASSIGNMENT_STATUSES = new Set<string>([
  "offered", "accepted", "rejected", "picked_up",
  "out_for_delivery", "delivered", "cancelled",
]);

function labelFor(order: Order, assignment?: AssignmentRow): string {
  // The order's current status owns the active delivery lifecycle. A rejected
  // or released historical offer matters only while reassignment is possible.
  if (order.status !== "Waiting for Rider") {
    return order.riderStatus ?? "Assignment unavailable";
  }

  switch (assignment?.assignment_status) {
    case undefined: return "Waiting for rider";
    case "offered": return "Offer pending";
    case "accepted": return "Rider accepted";
    case "rejected": return "Offer rejected · ready to reoffer";
    case "cancelled": return "Offer released · ready to reoffer";
    case "picked_up": return "Picked up";
    case "out_for_delivery": return "Out for delivery";
    case "delivered": return "Delivered";
  }
}

export function canOfferOrderToRider(order: Order): boolean {
  return order.type === "Delivery" &&
    order.status === "Waiting for Rider" &&
    order.riderAssignmentKnown === true &&
    (order.riderAssignmentStatus === undefined ||
      order.riderAssignmentStatus === "rejected" ||
      order.riderAssignmentStatus === "cancelled");
}

export async function fetchCashierAssignmentStatuses(
  orders: Order[],
): Promise<Map<string, AssignmentRow>> {
  const ids = [...new Set(orders.flatMap((order) =>
    order.type === "Delivery" && order.databaseId ? [order.databaseId] : [],
  ))];
  const requested = new Set(ids);
  const assignments = new Map<string, AssignmentRow>();

  for (let start = 0; start < ids.length; start += 200) {
    const { data, error } = await supabase.rpc(
      "get_cashier_delivery_assignment_statuses",
      { p_order_ids: ids.slice(start, start + 200) },
    );
    if (error || !Array.isArray(data)) {
      throw new Error("Rider assignment status is unavailable. Refresh before offering a rider.");
    }
    for (const value of data as unknown[]) {
      if (!value || typeof value !== "object") throw new Error("Invalid rider assignment response.");
      const row = value as Record<string, unknown>;
      if (typeof row.order_id !== "string" || !requested.has(row.order_id) ||
          typeof row.assignment_id !== "string" ||
          typeof row.assignment_status !== "string" ||
          !ASSIGNMENT_STATUSES.has(row.assignment_status) ||
          typeof row.assigned_at !== "string" ||
          typeof row.assignment_updated_at !== "string" ||
          assignments.has(row.order_id)) {
        throw new Error("Invalid rider assignment response.");
      }
      assignments.set(row.order_id, row as unknown as AssignmentRow);
    }
  }
  return assignments;
}

export function applyCashierAssignmentStatuses(
  orders: Order[],
  assignments: Map<string, AssignmentRow> | null,
): Order[] {
  return orders.map((order) => {
    if (order.type !== "Delivery" || !order.databaseId) return order;
    if (!assignments) {
      return {
        ...order,
        assignedRider: undefined,
        riderStatus: "Assignment unavailable",
        riderAssignmentKnown: false,
        riderAssignmentId: undefined,
        riderAssignmentStatus: undefined,
        riderAssignedAt: undefined,
        riderAssignmentUpdatedAt: undefined,
      };
    }
    const assignment = assignments.get(order.databaseId);
    return {
      ...order,
      assignedRider: undefined,
      riderStatus: labelFor(order, assignment),
      riderAssignmentKnown: true,
      riderAssignmentId: assignment?.assignment_id,
      riderAssignmentStatus: assignment?.assignment_status,
      riderAssignedAt: assignment?.assigned_at,
      riderAssignmentUpdatedAt: assignment?.assignment_updated_at,
    };
  });
}
