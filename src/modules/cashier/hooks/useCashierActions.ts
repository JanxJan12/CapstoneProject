import { useCallback, useMemo, type MutableRefObject } from "react";
import { OPTIMISTIC_DELAY_MS } from "../constants";
import {
  cancelCashierOrder,
  confirmCashierOrder,
  fetchCashierOrders,
  offerOrderToNextRider,
  releaseReadyCashierOrder,
} from "../services/supabaseOrderService";
import {
  assignOrderRider,
  cancelOrder,
  createWalkInOrder,
  duplicateOrder,
  endShift,
  holdOrder,
  markNotificationRead,
  markNotificationsRead,
  rejectOnlinePayment,
  recordReceiptReprint,
  releaseReadyOrder,
  removeHeldOrder,
  startShift,
  updateKitchenStatus,
  updateOrderDetails,
  verifyOnlinePayment,
  voidDraftOrder,
} from "../services/cashierService";
import type {
  CashierState,
  HeldOrder,
  OrderOperationalEditInput,
  OrderStatus,
  ShiftClosureInput,
  WalkInOrderInput,
} from "../types";
import type {
  CashierActions,
  CashierCommit,
  OptimisticCommit,
} from "./cashierStoreTypes";

export function useCashierActions(
  stateRef: MutableRefObject<CashierState>,
  commit: CashierCommit,
  commitOptimistically: OptimisticCommit,
): CashierActions {
  const verifyPayment = useCallback(
    async (paymentId: string, override: boolean) => {
      const previous = stateRef.current;
      await commitOptimistically(
        verifyOnlinePayment(previous, paymentId, override),
        previous,
        OPTIMISTIC_DELAY_MS.standard,
      );
    },
    [commitOptimistically, stateRef],
  );

  const rejectPayment = useCallback(
    async (paymentId: string, reason: string, notes?: string) => {
      const previous = stateRef.current;
      await commitOptimistically(
        rejectOnlinePayment(previous, paymentId, reason, notes),
        previous,
        OPTIMISTIC_DELAY_MS.standard,
      );
    },
    [commitOptimistically, stateRef],
  );

  const createOrder = useCallback(
    async (input: WalkInOrderInput) => {
      const previous = stateRef.current;
      const result = createWalkInOrder(previous, input);
      await commitOptimistically(
        result.state,
        previous,
        OPTIMISTIC_DELAY_MS.extended,
      );
      return result.order;
    },
    [commitOptimistically, stateRef],
  );

  const confirm = useCallback(
  async (databaseOrderId: string, notes?: string) => {
    await confirmCashierOrder(databaseOrderId, notes);

    const databaseOrders = await fetchCashierOrders();

    const current = stateRef.current;

    const databaseOrderNumbers = new Set(
      databaseOrders.map((order) => order.id),
    );

    const localOnlyOrders = current.orders.filter(
      (order) =>
        !order.databaseId &&
        !databaseOrderNumbers.has(order.id),
    );

    commit({
      ...current,
      orders: [
        ...databaseOrders,
        ...localOnlyOrders,
      ],
    });
  },
  [commit, stateRef],
);

  const cancel = useCallback(
    async (orderId: string, reason: string) => {
      const current = stateRef.current;

      const order = current.orders.find(
        (entry) => entry.id === orderId,
      );

      if (!order) {
        throw new Error("Order not found.");
      }

      if (!order.databaseId) {
        throw new Error(
          "This order is not connected to a database order.",
        );
      }

      await cancelCashierOrder(
        order.databaseId,
        reason,
      );

      const databaseOrders =
        await fetchCashierOrders();

      const latest = stateRef.current;

      const databaseOrderNumbers = new Set(
        databaseOrders.map(
          (entry) => entry.id,
        ),
      );

      const localOnlyOrders =
        latest.orders.filter(
          (entry) =>
            !entry.databaseId &&
            !databaseOrderNumbers.has(
              entry.id,
            ),
        );

      commit({
        ...latest,
        orders: [
          ...databaseOrders,
          ...localOnlyOrders,
        ],
      });
    },
    [commit, stateRef],
  );

  const updateOrder = useCallback(
    async (orderId: string, input: OrderOperationalEditInput) => {
      const previous = stateRef.current;
      await commitOptimistically(
        updateOrderDetails(previous, orderId, input),
        previous,
      );
    },
    [commitOptimistically, stateRef],
  );

  const assignRider = useCallback(
    async (orderId: string, riderId: string) => {
      const previous = stateRef.current;
      await commitOptimistically(
        assignOrderRider(previous, orderId, riderId),
        previous,
      );
    },
    [commitOptimistically, stateRef],
  );

  const offerNextRider = useCallback(
  async (orderId: string) => {
    const current = stateRef.current;

    const order = current.orders.find(
      (entry) => entry.id === orderId,
    );

    if (!order) {
      throw new Error("Order not found.");
    }

    if (!order.databaseId) {
      throw new Error(
        "This order is not connected to a database order.",
      );
    }

    await offerOrderToNextRider(
      order.databaseId,
    );
  },
  [stateRef],
);

  const duplicate = useCallback(
    async (orderId: string) => {
      const previous = stateRef.current;
      const result = duplicateOrder(previous, orderId);
      await commitOptimistically(
        result.state,
        previous,
        OPTIMISTIC_DELAY_MS.standard,
      );
      return result.order;
    },
    [commitOptimistically, stateRef],
  );

const releaseReadyOrderAction = useCallback(
  async (orderId: string) => {
    const current = stateRef.current;

    const order = current.orders.find(
      (entry) => entry.id === orderId,
    );

    if (!order) {
      throw new Error("Order not found.");
    }

    if (!order.databaseId) {
      throw new Error(
        "This order is not connected to a database order.",
      );
    }

    await releaseReadyCashierOrder(
      order.databaseId,
      "Ready order released by cashier",
    );

    const databaseOrders =
      await fetchCashierOrders();

    const latest = stateRef.current;

    const databaseOrderNumbers = new Set(
      databaseOrders.map((entry) => entry.id),
    );

    const localOnlyOrders = latest.orders.filter(
      (entry) =>
        !entry.databaseId &&
        !databaseOrderNumbers.has(entry.id),
    );

    commit({
      ...latest,
      orders: [
        ...databaseOrders,
        ...localOnlyOrders,
      ],
    });
  },
  [commit, stateRef],
);

  const updateKitchen = useCallback(
    async (
      orderId: string,
      status: Extract<OrderStatus, "Preparing" | "Ready">,
    ) => {
      const previous = stateRef.current;
      await commitOptimistically(
        updateKitchenStatus(previous, orderId, status),
        previous,
      );
    },
    [commitOptimistically, stateRef],
  );

  const hold = useCallback(
    async (held: Omit<HeldOrder, "id" | "heldAt">) => {
      const previous = stateRef.current;
      const result = holdOrder(previous, held);
      await commitOptimistically(result.state, previous);
      return result.held;
    },
    [commitOptimistically, stateRef],
  );

  const removeHeld = useCallback(
    (heldId: string) => {
      commit(removeHeldOrder(stateRef.current, heldId));
    },
    [commit, stateRef],
  );

  const voidDraft = useCallback(
    async (input: Omit<WalkInOrderInput, "paymentMethod">, reason: string) => {
      const previous = stateRef.current;
      await commitOptimistically(
        voidDraftOrder(previous, input, reason),
        previous,
        OPTIMISTIC_DELAY_MS.standard,
      );
    },
    [commitOptimistically, stateRef],
  );

  const start = useCallback(
    async (openingCash: number, terminal: string) => {
      const previous = stateRef.current;
      await commitOptimistically(
        startShift(previous, openingCash, terminal),
        previous,
        OPTIMISTIC_DELAY_MS.standard,
      );
    },
    [commitOptimistically, stateRef],
  );

  const end = useCallback(
    async (input: ShiftClosureInput) => {
      const previous = stateRef.current;
      await commitOptimistically(
        endShift(previous, input),
        previous,
        OPTIMISTIC_DELAY_MS.extended,
      );
    },
    [commitOptimistically, stateRef],
  );

  const reprint = useCallback(
    async (orderId: string) => {
      const previous = stateRef.current;
      await commitOptimistically(
        recordReceiptReprint(previous, orderId),
        previous,
        OPTIMISTIC_DELAY_MS.fast,
      );
    },
    [commitOptimistically, stateRef],
  );

  const markRead = useCallback(
    (notificationId: string) => {
      commit(markNotificationRead(stateRef.current, notificationId));
    },
    [commit, stateRef],
  );
  const markAllRead = useCallback(() => {
    commit(markNotificationsRead(stateRef.current));
  }, [commit, stateRef]);

  return useMemo(
    () => ({
      verifyPayment,
      rejectPayment,
      createWalkInOrder: createOrder,
      confirmOrder: confirm,
      cancelOrder: cancel,
      updateOrder,
      assignRider,
      offerNextRider,
      duplicateOrder: duplicate,
      releaseReadyOrder: releaseReadyOrderAction,
      updateKitchenStatus: updateKitchen,
      holdOrder: hold,
      removeHeldOrder: removeHeld,
      voidDraftOrder: voidDraft,
      startShift: start,
      endShift: end,
      recordReceiptReprint: reprint,
      markNotificationRead: markRead,
      markNotificationsRead: markAllRead,
    }),
    [
      assignRider,
      offerNextRider,
      cancel,
      confirm,
      createOrder,
      duplicate,
      end,
      hold,
      markAllRead,
      markRead,
      rejectPayment,
      releaseReadyOrderAction,
      removeHeld,
      reprint,
      start,
      updateKitchen,
      updateOrder,
      verifyPayment,
      voidDraft,
    ],
  );
}
