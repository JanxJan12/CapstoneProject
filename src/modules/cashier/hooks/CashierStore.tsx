import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CASHIER_STATE_VERSION, CASHIER_STORAGE_KEY } from "../constants";
import {
  calculateShiftTotals,
  assignOrderRider as assignOrderRiderTransition,
  cancelOrder as cancelOrderTransition,
  createWalkInOrder as createWalkInOrderTransition,
  endShift as endShiftTransition,
  duplicateOrder as duplicateOrderTransition,
  holdOrder as holdOrderTransition,
  markNotificationsRead as markNotificationsReadTransition,
  markNotificationRead as markNotificationReadTransition,
  rejectOnlinePayment,
  releaseReadyOrder as releaseReadyOrderTransition,
  recordReceiptReprint as recordReceiptReprintTransition,
  removeHeldOrder as removeHeldOrderTransition,
  startShift as startShiftTransition,
  updateKitchenStatus as updateKitchenStatusTransition,
  updateOrderDetails as updateOrderDetailsTransition,
  verifyOnlinePayment,
  voidDraftOrder as voidDraftOrderTransition,
} from "../services/cashierService";
import { createInitialCashierState } from "../services/seed";
import type {
  CashierState,
  HeldOrder,
  Order,
  OrderOperationalEditInput,
  OrderStatus,
  ShiftTotals,
  WalkInOrderInput,
} from "../types";

const pause = (milliseconds = 650) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

interface CashierStoreValue {
  state: CashierState;
  isHydrating: boolean;
  activeShift: CashierState["shifts"][number] | undefined;
  shiftTotals: ShiftTotals;
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
  cancelOrder: (orderId: string, reason: string) => Promise<void>;
  updateOrder: (
    orderId: string,
    input: OrderOperationalEditInput,
  ) => Promise<void>;
  assignRider: (orderId: string, riderId: string) => Promise<void>;
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
  endShift: (actualCash: number, notes?: string) => Promise<void>;
  recordReceiptReprint: (orderId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  markNotificationsRead: () => void;
}

const CashierStore = createContext<CashierStoreValue | null>(null);

function loadState(): CashierState {
  try {
    const raw = localStorage.getItem(CASHIER_STORAGE_KEY);
    if (!raw) return createInitialCashierState();
    const parsed = JSON.parse(raw) as CashierState;
    if (parsed.version === CASHIER_STATE_VERSION) return parsed;
    if (parsed.version === 4 && CASHIER_STATE_VERSION === 5) {
      const initial = createInitialCashierState();
      const catalog = new Map(initial.menuItems.map((item) => [item.id, item]));
      return {
        ...parsed,
        version: CASHIER_STATE_VERSION,
        menuItems: parsed.menuItems.map((item) => ({
          ...item,
          inventoryRemaining:
            item.inventoryRemaining ?? catalog.get(item.id)?.inventoryRemaining,
        })),
      };
    }
    return createInitialCashierState();
  } catch {
    return createInitialCashierState();
  }
}

export function CashierProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CashierState>(loadState);
  const [isHydrating, setIsHydrating] = useState(true);
  const stateRef = useRef(state);

  const commit = useCallback((next: CashierState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    localStorage.setItem(CASHIER_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsHydrating(false));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const verifyPayment = useCallback(
    async (paymentId: string, overrideMismatch: boolean) => {
      await pause();
      commit(
        verifyOnlinePayment(stateRef.current, paymentId, overrideMismatch),
      );
    },
    [commit],
  );

  const rejectPayment = useCallback(
    async (paymentId: string, reason: string, notes?: string) => {
      await pause(500);
      commit(rejectOnlinePayment(stateRef.current, paymentId, reason, notes));
    },
    [commit],
  );

  const createWalkInOrder = useCallback(
    async (input: WalkInOrderInput) => {
      await pause(700);
      const result = createWalkInOrderTransition(stateRef.current, input);
      commit(result.state);
      return result.order;
    },
    [commit],
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason: string) => {
      await pause(450);
      commit(cancelOrderTransition(stateRef.current, orderId, reason));
    },
    [commit],
  );

  const updateOrder = useCallback(
    async (orderId: string, input: OrderOperationalEditInput) => {
      await pause(400);
      commit(updateOrderDetailsTransition(stateRef.current, orderId, input));
    },
    [commit],
  );

  const assignRider = useCallback(
    async (orderId: string, riderId: string) => {
      await pause(400);
      commit(assignOrderRiderTransition(stateRef.current, orderId, riderId));
    },
    [commit],
  );

  const duplicateOrder = useCallback(
    async (orderId: string) => {
      await pause(450);
      const result = duplicateOrderTransition(stateRef.current, orderId);
      commit(result.state);
      return result.order;
    },
    [commit],
  );

  const releaseReadyOrder = useCallback(
    async (orderId: string) => {
      await pause(350);
      commit(releaseReadyOrderTransition(stateRef.current, orderId));
    },
    [commit],
  );

  const updateKitchenStatus = useCallback(
    async (
      orderId: string,
      status: Extract<OrderStatus, "Preparing" | "Ready">,
    ) => {
      await pause(350);
      commit(updateKitchenStatusTransition(stateRef.current, orderId, status));
    },
    [commit],
  );

  const holdOrder = useCallback(
    async (held: Omit<HeldOrder, "id" | "heldAt">) => {
      await pause(300);
      const result = holdOrderTransition(stateRef.current, held);
      commit(result.state);
      return result.held;
    },
    [commit],
  );

  const removeHeldOrder = useCallback(
    (heldId: string) => {
      commit(removeHeldOrderTransition(stateRef.current, heldId));
    },
    [commit],
  );

  const voidDraftOrder = useCallback(
    async (input: Omit<WalkInOrderInput, "paymentMethod">, reason: string) => {
      await pause(400);
      commit(voidDraftOrderTransition(stateRef.current, input, reason));
    },
    [commit],
  );

  const startShift = useCallback(
    async (openingCash: number, terminal: string) => {
      await pause(500);
      commit(startShiftTransition(stateRef.current, openingCash, terminal));
    },
    [commit],
  );

  const endShift = useCallback(
    async (actualCash: number, notes?: string) => {
      await pause(650);
      commit(endShiftTransition(stateRef.current, actualCash, notes));
    },
    [commit],
  );

  const recordReceiptReprint = useCallback(
    async (orderId: string) => {
      await pause(250);
      commit(recordReceiptReprintTransition(stateRef.current, orderId));
    },
    [commit],
  );

  const markNotificationRead = useCallback(
    (notificationId: string) =>
      commit(markNotificationReadTransition(stateRef.current, notificationId)),
    [commit],
  );

  const markNotificationsRead = useCallback(
    () => commit(markNotificationsReadTransition(stateRef.current)),
    [commit],
  );
  const activeShift = state.shifts.find((entry) => entry.status === "Open");
  const shiftTotals = useMemo(
    () =>
      activeShift
        ? calculateShiftTotals(state, activeShift.id)
        : {
            cashSales: 0,
            gcashSales: 0,
            refunds: 0,
            voids: 0,
            discounts: 0,
            transactionCount: 0,
            ordersProcessed: 0,
            expectedCash: 0,
          },
    [activeShift, state],
  );

  const value = useMemo<CashierStoreValue>(
    () => ({
      state,
      isHydrating,
      activeShift,
      shiftTotals,
      verifyPayment,
      rejectPayment,
      createWalkInOrder,
      cancelOrder,
      updateOrder,
      assignRider,
      duplicateOrder,
      releaseReadyOrder,
      updateKitchenStatus,
      holdOrder,
      removeHeldOrder,
      voidDraftOrder,
      startShift,
      endShift,
      recordReceiptReprint,
      markNotificationRead,
      markNotificationsRead,
    }),
    [
      state,
      isHydrating,
      activeShift,
      shiftTotals,
      verifyPayment,
      rejectPayment,
      createWalkInOrder,
      cancelOrder,
      updateOrder,
      assignRider,
      duplicateOrder,
      releaseReadyOrder,
      updateKitchenStatus,
      holdOrder,
      removeHeldOrder,
      voidDraftOrder,
      startShift,
      endShift,
      recordReceiptReprint,
      markNotificationRead,
      markNotificationsRead,
    ],
  );

  return (
    <CashierStore.Provider value={value}>{children}</CashierStore.Provider>
  );
}

export function useCashierStore() {
  const value = useContext(CashierStore);
  if (!value)
    throw new Error("useCashierStore must be used inside CashierProvider");
  return value;
}
