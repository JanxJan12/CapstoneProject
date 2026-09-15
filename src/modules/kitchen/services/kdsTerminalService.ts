import { supabase } from "@/lib/supabase";

const KDS_SESSION_KEY = "rrj_kds_terminal_session_v1";

export interface KdsTerminalCredential {
  terminalId: string;
  terminalSecret: string;
}

export interface VerifiedKdsTerminal {
  terminalId: string;
  terminalName: string;
}

export type KdsOrderStatus =
  | "confirmed"
  | "preparing"
  | "ready";

export type KdsFulfillmentType =
  | "delivery"
  | "takeout"
  | "dine_in";

export interface KdsQueueItem {
  id: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string;
}

export interface KdsQueueTicket {
  databaseId: string;
  orderNumber: string;
  fulfillmentType: KdsFulfillmentType;
  status: KdsOrderStatus;
  notes?: string;
  createdAt: string;
  items: KdsQueueItem[];
}

interface KdsQueueRpcItem {
  id: string;
  menu_item_id: string | null;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  special_instructions: string | null;
}

interface KdsQueueRpcRow {
  order_id: string;
  order_number: string;
  fulfillment_type: KdsFulfillmentType;
  current_status: KdsOrderStatus;
  notes: string | null;
  created_at: string;
  items: KdsQueueRpcItem[];
}

interface AdvanceKdsOrderRpcResult {
  order_id: string;
  order_number: string;
  previous_status: KdsOrderStatus;
  current_status: KdsOrderStatus;
}

export interface AdvanceKdsOrderResult {
  orderId: string;
  orderNumber: string;
  previousStatus: KdsOrderStatus;
  currentStatus: KdsOrderStatus;
}

interface VerifyKdsTerminalResult {
  terminal_id: string;
  terminal_name: string;
}

export async function verifyKdsTerminal(
  credential: KdsTerminalCredential,
): Promise<VerifiedKdsTerminal> {
  const terminalId = credential.terminalId.trim();
  const terminalSecret = credential.terminalSecret.trim();

  if (!terminalId) {
    throw new Error("Terminal ID is required.");
  }

  if (!terminalSecret) {
    throw new Error("Device secret is required.");
  }

  const { data, error } = await supabase.rpc(
    "verify_kds_terminal",
    {
      p_terminal_id: terminalId,
      p_terminal_secret: terminalSecret,
    },
  );

  if (error) {
    throw new Error(
      `Unable to verify kitchen terminal: ${error.message}`,
    );
  }

  const result = (
    data as VerifyKdsTerminalResult[] | null
  )?.[0];

  if (!result) {
    throw new Error(
      "Invalid or inactive kitchen terminal credential.",
    );
  }

  return {
    terminalId: result.terminal_id,
    terminalName: result.terminal_name,
  };
}



export async function fetchKdsQueue(
  credential: KdsTerminalCredential,
): Promise<KdsQueueTicket[]> {
  const terminalId = credential.terminalId.trim();
  const terminalSecret =
    credential.terminalSecret.trim();

  if (!terminalId || !terminalSecret) {
    throw new Error(
      "Kitchen terminal credential is missing.",
    );
  }

  const { data, error } = await supabase.rpc(
    "get_kds_queue",
    {
      p_terminal_id: terminalId,
      p_terminal_secret: terminalSecret,
    },
  );

  if (error) {
    throw new Error(
      `Unable to load kitchen queue: ${error.message}`,
    );
  }

  const rows = (data ?? []) as KdsQueueRpcRow[];

  return rows.map((row) => ({
    databaseId: row.order_id,
    orderNumber: row.order_number,
    fulfillmentType: row.fulfillment_type,
    status: row.current_status,
    notes: row.notes?.trim() || undefined,
    createdAt: row.created_at,

    items: (row.items ?? []).map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      name:
        item.item_name?.trim() ||
        "Menu Item",
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      specialInstructions:
        item.special_instructions?.trim() ||
        undefined,
    })),
  }));
}

export async function advanceKdsOrder(
  credential: KdsTerminalCredential,
  databaseOrderId: string,
  expectedStatus: KdsOrderStatus,
): Promise<AdvanceKdsOrderResult> {
  const terminalId = credential.terminalId.trim();
  const terminalSecret =
    credential.terminalSecret.trim();
  const orderId = databaseOrderId.trim();

  if (
  expectedStatus !== "confirmed" &&
  expectedStatus !== "preparing"
) {
  throw new Error(
    "Only confirmed or preparing kitchen orders can be advanced.",
  );
}

  if (!terminalId || !terminalSecret) {
    throw new Error(
      "Kitchen terminal credential is missing.",
    );
  }

  if (!orderId) {
    throw new Error(
      "The kitchen ticket does not have a valid database ID.",
    );
  }

  const { data, error } = await supabase.rpc(
    "advance_kds_order",
    {
      p_terminal_id: terminalId,
      p_terminal_secret: terminalSecret,
      p_order_id: orderId,
      p_expected_status: expectedStatus,
    },
  );

  if (error) {
    throw new Error(
      `Unable to advance kitchen order: ${error.message}`,
    );
  }

  const result = (
    data as AdvanceKdsOrderRpcResult[] | null
  )?.[0];

  if (!result) {
    throw new Error(
      "The kitchen order was updated, but no result was returned.",
    );
  }

  return {
    orderId: result.order_id,
    orderNumber: result.order_number,
    previousStatus: result.previous_status,
    currentStatus: result.current_status,
  };
}

export function saveKdsSession(
  credential: KdsTerminalCredential,
) {
  sessionStorage.setItem(
    KDS_SESSION_KEY,
    JSON.stringify(credential),
  );
}

export function loadKdsSession():
  | KdsTerminalCredential
  | null {
  const stored = sessionStorage.getItem(
    KDS_SESSION_KEY,
  );

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      stored,
    ) as Partial<KdsTerminalCredential>;

    if (
      typeof parsed.terminalId !== "string" ||
      typeof parsed.terminalSecret !== "string"
    ) {
      clearKdsSession();
      return null;
    }

    return {
      terminalId: parsed.terminalId,
      terminalSecret: parsed.terminalSecret,
    };
  } catch {
    clearKdsSession();
    return null;
  }
}

export function clearKdsSession() {
  sessionStorage.removeItem(KDS_SESSION_KEY);
}