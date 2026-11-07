import { supabase } from "@/lib/supabase";

const KDS_SESSION_KEY = "rrj_kds_terminal_session_v1";

export class KdsTerminalError extends Error {
  constructor(
    public readonly kind: "credential" | "conflict" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "KdsTerminalError";
  }
}

function kitchenRpcError(message: string, operation: "verify" | "queue" | "advance") {
  if (/^(Invalid (or inactive )?(kitchen )?terminal credential\.|Invalid terminal credential\.)/i.test(message)) {
    return new KdsTerminalError("credential", "Kitchen terminal access was rejected. Ask a manager to check the device credential, then activate again.");
  }
  if (operation === "advance" && message.startsWith("Kitchen transition rejected because the order status has changed.")) {
    return new KdsTerminalError("conflict", "Another terminal has already updated this order. Refresh the queue before taking another action.");
  }
  return new KdsTerminalError("unavailable", operation === "verify"
    ? "Could not verify the kitchen terminal. Check the connection and try again."
    : operation === "queue"
      ? "The kitchen queue is unavailable. Check the connection and try again."
      : "The order update could not be confirmed. Check the refreshed queue before trying again.");
}

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
  modifiers: { id: string; name: string; price: number }[];
}

export interface KdsQueueTicket {
  databaseId: string;
  orderNumber: string;
  fulfillmentType: KdsFulfillmentType;
  orderChannel: "online" | "walk_in";
  status: KdsOrderStatus;
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
  modifiers?: unknown;
}

interface KdsQueueRpcRow {
  order_id: string;
  order_number: string;
  fulfillment_type: KdsFulfillmentType;
  order_channel: "online" | "walk_in";
  current_status: KdsOrderStatus;
  created_at: string;
  items: KdsQueueRpcItem[];
}

interface AdvanceKdsOrderRpcResult {
  order_id: string;
  order_number: string;
  previous_status: KdsOrderStatus;
  current_status: KdsOrderStatus | "waiting_for_rider";
}

export interface AdvanceKdsOrderResult {
  orderId: string;
  orderNumber: string;
  previousStatus: KdsOrderStatus;
  currentStatus: KdsOrderStatus | "waiting_for_rider";
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

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(terminalId)) {
    throw new Error("Enter a valid terminal ID.");
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
    throw kitchenRpcError(error.message, "verify");
  }

  const result = (
    data as VerifyKdsTerminalResult[] | null
  )?.[0];

  if (!result) {
    throw kitchenRpcError("Invalid or inactive kitchen terminal credential.", "verify");
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
    "get_kds_queue_v2",
    {
      p_terminal_id: terminalId,
      p_terminal_secret: terminalSecret,
    },
  );

  if (error) {
    throw kitchenRpcError(error.message, "queue");
  }

  const rows = (data ?? []) as KdsQueueRpcRow[];

  return rows.map((row) => ({
    databaseId: row.order_id,
    orderNumber: row.order_number,
    fulfillmentType: row.fulfillment_type,
    orderChannel: row.order_channel,
    status: row.current_status,
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
      modifiers: Array.isArray(item.modifiers)
        ? item.modifiers.filter((modifier): modifier is { id: string; name: string; price: number } =>
            !!modifier && typeof modifier === "object" &&
            typeof modifier.id === "string" && typeof modifier.name === "string" &&
            typeof modifier.price === "number")
        : [],
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
  expectedStatus !== "preparing" &&
  expectedStatus !== "ready"
) {
  throw new Error(
    "Only confirmed, preparing, or ready kitchen orders can be advanced.",
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
    throw kitchenRpcError(error.message, "advance");
  }

  const result = (
    data as AdvanceKdsOrderRpcResult[] | null
  )?.[0];

  if (!result) {
    throw kitchenRpcError("", "advance");
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
