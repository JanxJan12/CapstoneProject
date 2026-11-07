import { supabase } from "@/lib/supabase";

export type ReplenishmentStatus =
  | "requested"
  | "acknowledged"
  | "preparing"
  | "ready_for_delivery"
  | "received";

export interface ReplenishmentEvent {
  previous_status: ReplenishmentStatus | null;
  next_status: ReplenishmentStatus;
  changed_at: string;
  changed_by: string;
  changed_by_name: string;
}

export interface ReplenishmentRequest {
  id: string;
  inventory_item_id: string;
  item_name: string;
  unit: string;
  quantity: number;
  needed_at: string | null;
  priority: "normal" | "urgent";
  note: string | null;
  status: ReplenishmentStatus;
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  ready_at: string | null;
  closed_at: string | null;
  receiving_report_id: string | null;
  receiving_report_number: string | null;
  receiving_report_status: "draft" | "posted" | null;
  delivered: number | null;
  accepted: number | null;
  rejected: number | null;
  events: ReplenishmentEvent[];
}

export async function getReplenishmentRequests(): Promise<
  ReplenishmentRequest[]
> {
  const { data, error } = await supabase.rpc("get_replenishment_requests");
  if (error) throw new Error(error.message);
  if (!Array.isArray(data))
    throw new Error("Invalid replenishment queue response.");
  return data as ReplenishmentRequest[];
}

export async function startReplenishmentReceiving(
  requestId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("start_replenishment_receiving", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || typeof data.id !== "string") {
    throw new Error("Invalid receiving draft response.");
  }
  return data.id;
}
