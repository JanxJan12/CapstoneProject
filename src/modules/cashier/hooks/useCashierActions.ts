import {
  useCallback,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { verifyCustomerGcashPayment } from "../api/customerGcashVerificationApi";
import { rejectCustomerGcashPayment } from "../api/customerGcashRejectionApi";
import { fetchCashierOnlinePayments } from "../api/onlinePaymentApi";
import {
  closeCashierShift,
  startCashierShift,
} from "../api/shiftApi";

import { createWalkInSale } from "../api/walkInSaleApi";
import { fetchCashierSale, findCurrentShiftWalkInSaleByRequestId, type HydratedCashierSale } from "../api/cashierSaleHydrationApi";
import { clearPOSDraft } from "../pos/posPersistence";
import {
  cancelCashierOrder,
  confirmCashierOrderOperationalDetails,
  fetchCashierOrders,
  offerOrderToNextRider,
  releaseReadyCashierOrder,
  updateCashierOrderOperationalDetails,
} from "../services/supabaseOrderService";
import { canOfferOrderToRider } from "../services/cashierAssignmentService";
import { canCancelCashierOrder, canEditCashierOrder } from "../orders/orderOperations";
import {
  endShift,
  holdOrder,
  markNotificationRead,
  markNotificationsRead,
  removeHeldOrder,
  startShift,
} from "../services/cashierService";
import type {
  CashierState,
  HeldOrder,
  OrderOperationalEditInput,
  ShiftClosureInput,
  WalkInOrderInput,
} from "../types";
import type {
  CashierActions,
  CashierCommit,
  OptimisticCommit,
} from "./cashierStoreTypes";

async function fetchOrdersWithOnlinePayments(): Promise<CashierState["orders"]> {
  const [databaseOrders, onlinePayments] = await Promise.all([
    fetchCashierOrders(),
    fetchCashierOnlinePayments(),
  ]);
  const onlinePaymentsByOrderId = new Map(
    onlinePayments.map(({ databaseOrderId, payment }) => [databaseOrderId, payment]),
  );

  return databaseOrders.map((entry) => {
    const onlinePayment = entry.databaseId
      ? onlinePaymentsByOrderId.get(entry.databaseId)
      : undefined;
    if (!onlinePayment) return entry;
    if (onlinePayment.orderId !== entry.id) {
      throw new Error("An online payment did not match its database order number.");
    }
    return {
      ...entry,
      paymentId: onlinePayment.id,
      paymentMethod: onlinePayment.method,
      paymentStatus: onlinePayment.status,
    };
  });
}

export function useCashierActions(
  stateRef: MutableRefObject<CashierState>,
  commit: CashierCommit,
  commitOptimistically: OptimisticCommit,
  refreshDatabaseState: () => void,
): CashierActions {
  const verificationRequestIds = useRef(
    new Map<string, string>(),
  );

  const verifyPayment = useCallback(
    async (paymentId: string) => {
      const current = stateRef.current;
      const payment = current.payments.find(
        (entry) => entry.id === paymentId,
      );
      const order = current.orders.find(
        (entry) => entry.id === payment?.orderId,
      );

      if (!payment || !order) {
        throw new Error(
          "Payment record could not be found.",
        );
      }

      if (!order.databaseId) {
        throw new Error(
          "This payment is not linked to a database order and cannot be verified.",
        );
      }

      if (!payment.proofImagePath) {
        throw new Error(
          "This database-backed customer payment is missing its uploaded GCash proof.",
        );
      }

      if (payment.method !== "GCash") {
        throw new Error(
          "Only a database-backed GCash proof may use this verification path.",
        );
      }

      if (order.orderChannel !== "online") {
        throw new Error(
          "Only an online customer order may use manual GCash proof verification.",
        );
      }

      let requestId = verificationRequestIds.current.get(
        payment.id,
      );

      if (!requestId) {
        requestId = globalThis.crypto.randomUUID();
        verificationRequestIds.current.set(
          payment.id,
          requestId,
        );
      }

      const verified = await verifyCustomerGcashPayment(
        requestId,
        payment.id,
      );

      if (
        verified.databaseOrderId !== order.databaseId ||
        verified.orderNumber !== order.id
      ) {
        throw new Error(
          "The verified payment did not match its linked order.",
        );
      }

      const hydratedSale = await fetchCashierSale(
        order.databaseId,
        stateRef.current.cashier.name,
      );

      if (
        hydratedSale.order.databaseId !==
          verified.databaseOrderId ||
        hydratedSale.order.id !== verified.orderNumber ||
        hydratedSale.order.status !== "Confirmed" ||
        hydratedSale.payment.id !== verified.paymentId ||
        hydratedSale.payment.status !== "Verified" ||
        hydratedSale.transaction.id !==
          verified.transactionId ||
        hydratedSale.transaction.receiptNumber !==
          verified.receiptNumber ||
        hydratedSale.transaction.shiftId !==
          verified.shiftId ||
        hydratedSale.transaction.cashierId !==
          verified.cashierId
      ) {
        throw new Error(
          "The verified sale hydration did not match the authoritative verification result.",
        );
      }

      const latest = stateRef.current;

      commit({
        ...latest,
        orders: [
          hydratedSale.order,
          ...latest.orders.filter(
            (entry) =>
              entry.databaseId !==
                hydratedSale.order.databaseId &&
              entry.id !== hydratedSale.order.id,
          ),
        ],
        payments: [
          hydratedSale.payment,
          ...latest.payments.filter(
            (entry) =>
              entry.id !== hydratedSale.payment.id &&
              entry.orderId !==
                hydratedSale.payment.orderId,
          ),
        ],
        transactions: [
          hydratedSale.transaction,
          ...latest.transactions.filter(
            (entry) =>
              entry.id !== hydratedSale.transaction.id &&
              entry.orderId !==
                hydratedSale.transaction.orderId,
          ),
        ],
      });

      verificationRequestIds.current.delete(payment.id);
    },
    [commit, stateRef],
  );

  const rejectPayment = useCallback(
    async (paymentId: string, reason: string, notes?: string) => {
      const current = stateRef.current;
      const payment = current.payments.find(
        (entry) => entry.id === paymentId,
      );
      const order = current.orders.find(
        (entry) => entry.id === payment?.orderId,
      );

      if (!payment || !order) {
        throw new Error(
          "Payment record could not be found.",
        );
      }

      if (!order.databaseId) {
        throw new Error(
          "This payment is not linked to a database order and cannot be rejected.",
        );
      }

      if (order.orderChannel !== "online") {
        throw new Error(
          "Only an online customer order may use manual GCash proof rejection.",
        );
      }

      if (
        payment.method !== "GCash" ||
        !payment.proofImagePath
      ) {
        throw new Error(
          "This database payment does not contain a customer-uploaded GCash proof.",
        );
      }

      const rejected = await rejectCustomerGcashPayment(
        payment.id,
        reason,
        notes,
      );

      if (
        rejected.databaseOrderId !== order.databaseId ||
        rejected.orderNumber !== order.id ||
        rejected.rejectedBy !== current.cashier.id
      ) {
        throw new Error(
          "The rejected payment did not match its linked order or authenticated cashier.",
        );
      }

      const onlinePayments =
        await fetchCashierOnlinePayments();
      const authoritativeRejection = onlinePayments.find(
        (entry) =>
          entry.databaseOrderId ===
            rejected.databaseOrderId &&
          entry.payment.id === rejected.paymentId,
      );

      if (
        !authoritativeRejection ||
        authoritativeRejection.payment.status !== "Rejected" ||
        authoritativeRejection.payment.rejectionReason !==
          rejected.rejectionReason ||
        authoritativeRejection.payment.rejectionNotes !==
          rejected.rejectionNotes ||
        authoritativeRejection.payment.rejectedBy !==
          rejected.rejectedBy ||
        authoritativeRejection.payment.rejectedAt !==
          rejected.rejectedAt ||
        authoritativeRejection.payment.updatedAt !==
          rejected.updatedAt
      ) {
        throw new Error(
          "The rejected payment could not be reconciled from PostgreSQL.",
        );
      }

      const latest = stateRef.current;
      const authoritativePaymentIds = new Set(
        onlinePayments.map((entry) => entry.payment.id),
      );
      const authoritativePaymentOrderIds = new Set(
        onlinePayments.map(
          (entry) => entry.payment.orderId,
        ),
      );
      const onlinePaymentByOrderId = new Map(
        onlinePayments.map((entry) => [
          entry.payment.orderId,
          entry.payment,
        ]),
      );

      commit({
        ...latest,
        orders: latest.orders.map((entry) => {
          const onlinePayment =
            onlinePaymentByOrderId.get(entry.id);

          if (!onlinePayment) {
            return entry;
          }

          return {
            ...entry,
            paymentId: onlinePayment.id,
            paymentMethod: onlinePayment.method,
            paymentStatus: onlinePayment.status,
          };
        }),
        payments: [
          ...onlinePayments.map((entry) => entry.payment),
          ...latest.payments.filter(
            (entry) =>
              !authoritativePaymentIds.has(entry.id) &&
              !authoritativePaymentOrderIds.has(
                entry.orderId,
              ),
          ),
        ],
      });
    },
    [commit, stateRef],
  );

const commitWalkInSale = useCallback((hydratedSale: HydratedCashierSale) => {
  const current = stateRef.current;
  commit({
    ...current,
    orders: [hydratedSale.order, ...current.orders.filter((order) =>
      order.databaseId !== hydratedSale.order.databaseId && order.id !== hydratedSale.order.id)],
    payments: [hydratedSale.payment, ...current.payments.filter((payment) =>
      payment.id !== hydratedSale.payment.id)],
    transactions: [hydratedSale.transaction, ...current.transactions.filter((transaction) =>
      transaction.id !== hydratedSale.transaction.id)],
  });
  return hydratedSale.order;
}, [commit, stateRef]);

const createOrder = useCallback(
  async (
    requestId: string,
    input: WalkInOrderInput,
  ) => {
    const cashierId = stateRef.current.cashier.id;
    const createdSale = await createWalkInSale(
      requestId,
      input,
    );

    const hydratedSale = await fetchCashierSale(
      createdSale.orderId,
      stateRef.current.cashier.name,
    );

    if (hydratedSale.order.databaseId !== createdSale.orderId ||
      hydratedSale.order.id !== createdSale.orderNumber ||
      hydratedSale.payment.id !== createdSale.paymentId ||
      hydratedSale.transaction.id !== createdSale.transactionId ||
      hydratedSale.transaction.receiptNumber !== createdSale.receiptNumber ||
      hydratedSale.order.total !== createdSale.grandTotal ||
      hydratedSale.payment.status !== "Verified" ||
      hydratedSale.transaction.status !== "Completed") {
      throw new Error("The sale records did not match the creation result.");
    }

    if (stateRef.current.cashier.id !== cashierId) {
      throw new Error("The active cashier changed while the sale was being confirmed.");
    }

    return commitWalkInSale(hydratedSale);
  },
  [commitWalkInSale, stateRef],
);

const recoverOrder = useCallback(async (requestId: string) => {
  const cashierId = stateRef.current.cashier.id;
  const sale = await findCurrentShiftWalkInSaleByRequestId(
    requestId,
    stateRef.current.cashier.name,
  );
  if (stateRef.current.cashier.id !== cashierId) return null;
  if (sale) commitWalkInSale(sale);
  return sale;
}, [commitWalkInSale, stateRef]);

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

      if (!canCancelCashierOrder(order)) {
        throw new Error("This order is no longer eligible for ordinary cancellation. Refresh its status and payment.");
      }

      await cancelCashierOrder(
        order.databaseId,
        reason,
      );

      const databaseOrders =
        await fetchOrdersWithOnlinePayments();

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

      if (!canEditCashierOrder(order)) {
        throw new Error("This order is no longer editable. Refresh its status.");
      }

      const result = await updateCashierOrderOperationalDetails(
        order.databaseId,
        input,
      );
      if (result.order_id !== order.databaseId || result.order_number !== order.id) {
        throw new Error("Order saved, but the backend returned a different order. Refresh before editing again.");
      }
      const confirmed = await confirmCashierOrderOperationalDetails(order.databaseId, input);
      commit({
        ...stateRef.current,
        orders: stateRef.current.orders.map((entry) => entry.databaseId === order.databaseId
          ? { ...entry, ...confirmed }
          : entry),
      });
      refreshDatabaseState();
    },
    [commit, refreshDatabaseState, stateRef],
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

    if (!canOfferOrderToRider(order)) {
      throw new Error("Refresh the rider assignment before offering this order again.");
    }

    const result = await offerOrderToNextRider(
      order.databaseId,
    );
    if (result.order_id !== order.databaseId || result.order_number !== order.id || result.assignment_status !== "offered") {
      throw new Error("The offer response could not be matched to this order. Refresh before trying again.");
    }
    commit({
      ...stateRef.current,
      orders: stateRef.current.orders.map((entry) => entry.databaseId === order.databaseId
        ? {
            ...entry,
            assignedRider: undefined,
            riderStatus: "Offer pending",
            riderAssignmentKnown: true,
            riderAssignmentId: result.assignment_id,
            riderAssignmentStatus: "offered",
            riderAssignedAt: result.assigned_at,
            riderAssignmentUpdatedAt: result.assigned_at,
          }
        : entry),
    });
    refreshDatabaseState();
  },
  [commit, refreshDatabaseState, stateRef],
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

    if (order.status !== "Ready") {
      throw new Error("This order is no longer ready for release. Refresh its status.");
    }

    const result = await releaseReadyCashierOrder(
      order.databaseId,
    );
    const expectedStatus = order.type === "Delivery" ? "waiting_for_rider" : "completed";
    if (result.order_id !== order.databaseId || result.order_number !== order.id ||
        result.previous_status !== "ready" || result.current_status !== expectedStatus) {
      throw new Error("The release response did not match this order. Refresh before taking another action.");
    }

    const refreshedOrders = await fetchOrdersWithOnlinePayments();

    const latest = stateRef.current;

    const databaseOrderNumbers = new Set(
      refreshedOrders.map((entry) => entry.id),
    );

    const localOnlyOrders = latest.orders.filter(
      (entry) =>
        !entry.databaseId &&
        !databaseOrderNumbers.has(entry.id),
    );

    commit({
      ...latest,
      orders: [
        ...refreshedOrders,
        ...localOnlyOrders,
      ],
    });
  },
  [commit, stateRef],
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

  const start = useCallback(
    async (openingCash: number, terminal: string) => {
      const startedShift = await startCashierShift(openingCash, terminal);

      commit(startShift(stateRef.current, startedShift));
    },
    [commit, stateRef],
  );

  const end = useCallback(
    async (input: ShiftClosureInput) => {
      const closedShift = await closeCashierShift(input.actualCash);

      clearPOSDraft();

      const closedState = endShift(stateRef.current, closedShift);

      commit({
        ...closedState,
        heldOrders: [],
      });
      return closedShift;
    },
    [commit, stateRef],
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
      recoverWalkInOrder: recoverOrder,
      cancelOrder: cancel,
      updateOrder,
      offerNextRider,
      releaseReadyOrder: releaseReadyOrderAction,
      holdOrder: hold,
      removeHeldOrder: removeHeld,
      startShift: start,
      endShift: end,
      markNotificationRead: markRead,
      markNotificationsRead: markAllRead,
    }),
    [
      offerNextRider,
      cancel,
      createOrder,
      recoverOrder,
      end,
      hold,
      markAllRead,
      markRead,
      rejectPayment,
      releaseReadyOrderAction,
      removeHeld,
      start,
      updateOrder,
      verifyPayment,
    ],
  );
}
