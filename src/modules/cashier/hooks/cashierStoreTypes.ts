import type {
  CashierState,
  HeldOrder,
  Order,
  OrderOperationalEditInput,
  ShiftClosureInput,
  ShiftTotals,
  WalkInOrderInput,
} from "../types";

export interface CashierActions {
  verifyPayment: (paymentId: string) => Promise<void>;
  rejectPayment: (
    paymentId: string,
    reason: string,
    notes?: string,
  ) => Promise<void>;
  createWalkInOrder: (
  requestId: string,
  input: WalkInOrderInput,
) => Promise<Order>;

  cancelOrder: (orderId: string, reason: string) => Promise<void>;
  updateOrder: (
    orderId: string,
    input: OrderOperationalEditInput,
  ) => Promise<void>;
  offerNextRider: (orderId: string) => Promise<void>;
  releaseReadyOrder: (orderId: string) => Promise<void>;
  holdOrder: (order: Omit<HeldOrder, "id" | "heldAt">) => Promise<HeldOrder>;
  removeHeldOrder: (heldId: string) => void;
  startShift: (openingCash: number, terminal: string) => Promise<void>;
  endShift: (input: ShiftClosureInput) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  markNotificationsRead: () => void;
}

export interface CashierStoreValue extends CashierActions {
  state: CashierState;
  isHydrating: boolean;
  databaseLoading: boolean;
  databaseError: string;
  refreshDatabaseState: () => void;
  activeShift: CashierState["shifts"][number] | undefined;
  shiftTotals: ShiftTotals;
}

export type CashierCommit = (next: CashierState) => void;
export type OptimisticCommit = (
  next: CashierState,
  previous: CashierState,
  milliseconds?: number,
) => Promise<void>;
