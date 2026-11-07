import { supabase } from "@/lib/supabase";
import { validRequestProposal } from "./requestProposal";

export type RequestPriority = "emergency" | "priority" | "scheduled";
export interface RequestProposalItem {
  id: string;
  name: string;
  unit: string;
  quantity_scale: number;
  reorder_level: number;
  usable_now: number;
  valid_at_need: number;
  expiry_verified: boolean;
  outstanding: number;
}
export interface RequestDraftLine {
  inventory_item_id: string;
  quantity: number;
  override_reason: string;
}
export interface RequestSnapshot {
  number: string;
  revision: number;
  issued_at: string;
  issued_by: string;
  issued_by_name: string;
  priority: RequestPriority;
  needed_at: string;
  destination: string;
  lines: Array<{
    inventory_item_id: string;
    name: string;
    unit: string;
    quantity: number;
  }>;
}
export interface InventoryRequest {
  id: string;
  number: string;
  revision: number;
  status: "issued" | "partially_received" | "fulfilled" | "closed_short";
  priority: RequestPriority;
  needed_at: string;
  issued_at: string;
  issued_by_name: string;
  close_reason: string | null;
  snapshot: RequestSnapshot;
  revisions: Array<{ revision: number; snapshot: RequestSnapshot }>;
  lines: Array<{
    inventory_item_id: string;
    name: string;
    unit: string;
    quantity: number;
    accepted: number;
    rejected: number;
    remaining: number;
  }>;
  receipts: Array<{
    id: string;
    number: string;
    status: "draft" | "posted";
    inspector: string;
    posted_at: string | null;
  }>;
  events: Array<{
    type: string;
    revision: number;
    at: string;
    actor: string;
    details: Record<string, string>;
  }>;
}

async function rpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const getRequestProposal = async (neededAt: string): Promise<RequestProposalItem[]> => {
  const rows = await rpc<unknown>("get_inventory_request_proposal", {
    p_needed_at: neededAt,
  });
  if (!validRequestProposal(rows))
    throw new Error("The server returned invalid request guidance.");
  return rows;
};
export const getInventoryRequestRegister = () =>
  rpc<InventoryRequest[]>("get_inventory_request_register");
export const issueInventoryRequest = (input: {
  id: string;
  priority: RequestPriority;
  neededAt: string;
  lines: RequestDraftLine[];
  expected: RequestProposalItem[];
}) =>
  rpc<{ id: string; request_number: string }>("issue_inventory_request", {
    p_request_id: input.id,
    p_priority: input.priority,
    p_needed_at: input.neededAt,
    p_lines: input.lines,
    p_expected: input.expected,
  });
export const reviseInventoryRequest = (input: {
  id: string;
  revision: number;
  priority: RequestPriority;
  neededAt: string;
  lines: RequestDraftLine[];
  expected: RequestProposalItem[];
}) =>
  rpc<{ id: string; request_number: string; revision: number }>(
    "revise_inventory_request",
    {
      p_request_id: input.id,
      p_expected_revision: input.revision,
      p_priority: input.priority,
      p_needed_at: input.neededAt,
      p_lines: input.lines,
      p_expected: input.expected,
    },
  );
export const recordInventoryRequestEvent = (
  id: string,
  revision: number,
  type: "dispatch" | "acknowledgment",
  details: Record<string, string>,
) =>
  rpc("record_inventory_request_event", {
    p_request_id: id,
    p_revision: revision,
    p_event_type: type,
    p_details: details,
  });
export const startInventoryRequestReceiving = (
  id: string,
  revision: number,
  reportId: string,
) =>
  rpc<{ id: string; rr_number: string }>("start_inventory_request_receiving", {
    p_request_id: id,
    p_revision: revision,
    p_report_id: reportId,
    // Preserve the existing RPC signature; the server derives the inspector.
    p_inspected_by_name: null,
    p_inspection_note: null,
  });
export const closeInventoryRequestShort = (
  id: string,
  revision: number,
  reason: string,
) =>
  rpc("close_inventory_request_short", {
    p_request_id: id,
    p_revision: revision,
    p_reason: reason,
  });
