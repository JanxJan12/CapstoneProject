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
import { fetchCashierSale } from "../api/cashierSaleHydrationApi";
import { clearPOSDraft } from "../pos/posPersistence";
import {
  cancelCashierOrder,
  fetchCashierOrders,
  offerOrderToNextRider,
  releaseReadyCashierOrder,
  updateCashierOrderOperationalDetails,
} from "../services/supabaseOrderService";
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

export function useCashierActions(
  stateRef: MutableRefObject<CashierState>,
  commit: CashierCommit,
  commitOptimistically: OptimisticCommit,
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
        hydratedSale.transaction.transactionNumber !==
          verified.transactionNumber ||
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

const createOrder = useCallback(
  async (
    requestId: string,
    input: WalkInOrderInput,
  ) => {
    const createdSale = await createWalkInSale(
      requestId,
      input,
    );

    const hydratedSale = await fetchCashierSale(
      createdSale.orderId,
      stateRef.current.cashier.name,
    );

    const current = stateRef.current;

    commit({
      ...current,

      orders: [
        hydratedSale.order,
        ...current.orders.filter(
          (order) =>
            order.databaseId !== hydratedSale.order.databaseId &&
            order.id !== hydratedSale.order.id,
        ),
      ],

      payments: [
        hydratedSale.payment,
        ...current.payments.filter(
          (payment) =>
            payment.id !== hydratedSale.payment.id,
        ),
      ],

      transactions: [
        hydratedSale.transaction,
        ...current.transactions.filter(
          (transaction) =>
            transaction.id !== hydratedSale.transaction.id,
        ),
      ],
    });

    return hydratedSale.order;
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

      await updateCashierOrderOperationalDetails(
        order.databaseId,
        input,
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
      const closedShift = await closeCashierShift(
        input.actualCash,
        input.varianceReason,
        input.notes,
      );

      clearPOSDraft();

      const closedState = endShift(
        stateRef.current,
        closedShift,
        input.notes,
      );

      commit({
        ...closedState,
        heldOrders: [],
      });
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
