import type {
  ActivityKind,
  CashierShift,
  CashierState,
  Order,
  OrderStatus,
} from "../types";

export const cloneState = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;
export const timestampNow = () => new Date().toISOString();
export const nextEventId = () =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

export const requireOpenShift = (state: CashierState): CashierShift => {
  const shift = state.shifts.find((entry) => entry.status === "Open");
  if (!shift)
    throw new Error("Start a cashier shift before processing transactions.");
  return shift;
};

export const addTimeline = (
  order: Order,
  status: OrderStatus,
  label: string,
  actor: string,
  timestamp = timestampNow(),
) => {
  order.timeline.push({ id: nextEventId(), status, label, actor, timestamp });
  order.updatedAt = timestamp;
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
  state.activities = state.activities.slice(0, 40);
};
