import { supabase } from "@/lib/supabase";

export type InventoryDisposition = "restore" | "waste" | "no_return";
export type RefundMethod = "cash" | "gcash";

export interface PaidOrderCancellation {
  orderId: string;
  previousStatus: string;
  inventoryDisposition: InventoryDisposition;
  refundAmount: number;
  refundMethod: RefundMethod;
  refundReference: string;
  reason: string;
  processedAt: string;
}

interface SettlementInput {
  orderId: string;
  reason: string;
  inventoryDisposition: InventoryDisposition;
  refundMethod: RefundMethod;
  refundReference: string;
  kitchenNotStartedConfirmed: boolean;
}

function parseSettlement(value: unknown): PaidOrderCancellation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The server returned an invalid cancellation record.");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.order_id !== "string" ||
    typeof row.previous_status !== "string" ||
    (row.inventory_disposition !== "restore" &&
      row.inventory_disposition !== "waste" &&
      row.inventory_disposition !== "no_return") ||
    (row.refund_method !== "cash" && row.refund_method !== "gcash") ||
    typeof row.refund_reference !== "string" ||
    typeof row.reason !== "string" ||
    typeof row.processed_at !== "string"
  ) {
    throw new Error("The server returned an incomplete cancellation record.");
  }
  const refundAmount = Number(row.refund_amount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error("The server returned an invalid refund amount.");
  }
  return {
    orderId: row.order_id,
    previousStatus: row.previous_status,
    inventoryDisposition: row.inventory_disposition,
    refundAmount,
    refundMethod: row.refund_method,
    refundReference: row.refund_reference,
    reason: row.reason,
    processedAt: row.processed_at,
  };
}

export async function getPaidOrderCancellation(
  orderId: string,
): Promise<PaidOrderCancellation | null> {
  const { data, error } = await supabase.rpc(
    "get_manager_paid_order_cancellation",
    { p_order_id: orderId },
  );
  if (error) throw new Error(error.message);
  return data === null ? null : parseSettlement(data);
}

export async function settlePaidOrderCancellation(
  input: SettlementInput,
): Promise<PaidOrderCancellation> {
  const { data, error } = await supabase.rpc("settle_paid_order_cancellation", {
    p_order_id: input.orderId,
    p_reason: input.reason.trim(),
    p_inventory_disposition: input.inventoryDisposition,
    p_refund_method: input.refundMethod,
    p_refund_reference: input.refundReference.trim(),
    p_refund_confirmed: true,
    p_kitchen_not_started_confirmed: input.kitchenNotStartedConfirmed,
  });
  if (error) throw new Error(error.message);
  return parseSettlement(data);
}
