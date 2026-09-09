import { MAX_ACTIVITY_RECORDS } from "../constants";
import type {
  ActivityKind,
  CashierState,
} from "../types";

export const cloneState = <T>(value: T): T => structuredClone(value);
export const timestampNow = () => new Date().toISOString();
export const nextEventId = () => `EVT-${crypto.randomUUID()}`;

export const nextRecordId = (
  prefix: string,
  records: Array<{ id: string }>,
) => {
  const max = records.reduce((current, record) => {
    const parsed = Number(record.id.match(/(\d+)$/)?.[1] ?? 0);
    return Math.max(current, parsed);
  }, 0);
  return `${prefix}-${max + 1}`;
};

export const addActivity = (
  state: CashierState,
  kind: ActivityKind,
  message: string,
  orderId?: string,
  transactionId?: string,
  actor = state.cashier.name,
) => {
  state.activities.unshift({
    id: nextEventId(),
    kind,
    message,
    orderId,
    transactionId,
    actor,
    timestamp: timestampNow(),
  });
  state.activities = state.activities.slice(0, MAX_ACTIVITY_RECORDS);
};
