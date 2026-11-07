import { supabase } from "@/lib/supabase";

export interface ClosedShiftSnapshot {
  id: string;
  cashierId: string;
  terminal: string;
  openingCash: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  startedAt: string;
  endedAt: string;
  closedBy: string;
}

export interface HistoryCursor { endedAt: string; id: string }
export interface HistoryQuery {
  from?: string;
  through?: string;
  cashierId?: string;
  cursor?: HistoryCursor;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 25;

function manilaDayStart(day: string, next = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid date filter.");
  const date = new Date(`${day}T00:00:00+08:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== day) {
    throw new Error("Invalid date filter.");
  }
  if (next) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function amount(value: unknown): number {
  if (value === null || value === undefined || value === "") throw new Error("Invalid saved shift amount.");
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid saved shift amount.");
  return parsed;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Invalid saved shift date.");
  return value;
}

function mapRow(value: unknown): ClosedShiftSnapshot {
  if (!value || typeof value !== "object") throw new Error("Invalid saved shift record.");
  const row = value as Record<string, unknown>;
  if (!UUID.test(String(row.shift_id)) || !UUID.test(String(row.cashier_id)) ||
      !UUID.test(String(row.closed_by)) || typeof row.terminal !== "string") {
    throw new Error("Invalid saved shift identity.");
  }
  return {
    id: String(row.shift_id), cashierId: String(row.cashier_id), terminal: row.terminal,
    openingCash: amount(row.opening_cash), expectedCash: amount(row.expected_cash),
    actualCash: amount(row.actual_cash), variance: amount(row.variance),
    startedAt: timestamp(row.started_at), endedAt: timestamp(row.ended_at),
    closedBy: String(row.closed_by),
  };
}

export async function fetchClosedShiftHistory(query: HistoryQuery): Promise<{ rows: ClosedShiftSnapshot[]; next: HistoryCursor | null }> {
  if (query.from && query.through && query.from > query.through) throw new Error("Start date must be before end date.");
  if (query.cashierId && !UUID.test(query.cashierId)) throw new Error("Enter a valid cashier ID.");
  const { data, error } = await supabase.rpc("get_closed_cashier_shifts", {
    p_from_ended_at: query.from ? manilaDayStart(query.from) : null,
    p_before_ended_at: query.through ? manilaDayStart(query.through, true) : null,
    p_cashier_id: query.cashierId || null,
    p_cursor_ended_at: query.cursor?.endedAt ?? null,
    p_cursor_id: query.cursor?.id ?? null,
    p_limit: PAGE_SIZE + 1,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length > PAGE_SIZE + 1) throw new Error("Invalid historical shift page.");
  const rows = data.map(mapRow).slice(0, PAGE_SIZE);
  const last = rows.at(-1);
  return { rows, next: data.length > PAGE_SIZE && last ? { endedAt: last.endedAt, id: last.id } : null };
}
