import type {
  CashierState,
  HeldOrder,
  Order,
  OrderOperationalEditInput,
  OrderStatus,
  ShiftClosureInput,
  ShiftTotals,
  WalkInOrderInput,
} from "../types";

export interface CashierActions {
  verifyPayment: (
    paymentId: string,
    overrideMismatch: boolean,
  ) => Promise<void>;
  rejectPayment: (
    paymentId: string,
    reason: string,
    notes?: string,
  ) => Promise<void>;
  createWalkInOrder: (input: WalkInOrderInput) => Promise<Order>;

  confirmOrder: (
    databaseOrderId: string,
    notes?: string,
  ) => Promise<void>;

  cancelOrder: (orderId: string, reason: string) => Promise<void>;
  updateOrder: (
    orderId: string,
    input: OrderOperationalEditInput,
  ) => Promise<void>;
  assignRider: (orderId: string, riderId: string) => Promise<void>;
  offerNextRider: (orderId: string) => Promise<void>;
  duplicateOrder: (orderId: string) => Promise<Order>;  
  releaseReadyOrder: (orderId: string) => Promise<void>;
  updateKitchenStatus: (
    orderId: string,
    status: Extract<OrderStatus, "Preparing" | "Ready">,
  ) => Promise<void>;
  holdOrder: (order: Omit<HeldOrder, "id" | "heldAt">) => Promise<HeldOrder>;
  removeHeldOrder: (heldId: string) => void;
  voidDraftOrder: (
    input: Omit<WalkInOrderInput, "paymentMethod">,
    reason: string,
  ) => Promise<void>;
  startShift: (openingCash: number, terminal: string) => Promise<void>;
  endShift: (input: ShiftClosureInput) => Promise<void>;
  recordReceiptReprint: (orderId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  markNotificationsRead: () => void;
}

export interface CashierStoreValue extends CashierActions {
  state: CashierState;
  isHydrating: boolean;
  activeShift: CashierState["shifts"][number] | undefined;
  shiftTotals: ShiftTotals;
}

export type CashierCommit = (next: CashierState) => void;
export type OptimisticCommit = (
  next: CashierState,
  previous: CashierState,
  milliseconds?: number,
) => Promise<void>;
