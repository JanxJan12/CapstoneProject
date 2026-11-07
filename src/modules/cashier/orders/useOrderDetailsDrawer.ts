import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Toast } from "../components";
import { fetchCashierSale } from "../api/cashierSaleHydrationApi";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order, Payment } from "../types";
import { canOfferOrderToRider } from "../services/cashierAssignmentService";
import { isOrderDelayed } from "./orderOperations";
import { canCancelCashierOrder } from "./orderOperations";

export function useOrderDetailsDrawer(order?: Order, open = false) {
  const { session } = useAuth();
  const {
    state,
    cancelOrder,
    releaseReadyOrder,
    offerNextRider,
    refreshDatabaseState,
    databaseLoading,
    databaseError,
  } = useCashierStore();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const actionInFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [salePayment, setSalePayment] = useState<{ databaseOrderId: string; payment: Payment }>();
  const [paymentLookup, setPaymentLookup] = useState<{ databaseOrderId: string; status: "loading" | "unavailable" }>();
  const currentOrder = order
    ? (state.orders.find((entry) => entry.id === order.id) ?? order)
    : undefined;
  const storedPayment = currentOrder
    ? state.payments.find((entry) => entry.orderId === currentOrder.id)
    : undefined;
  const payment = currentOrder?.paymentStatus === "Unknown"
    ? !currentOrder.paymentResolutionUncertain && currentOrder.databaseId === salePayment?.databaseOrderId
      ? salePayment?.payment : undefined
    : storedPayment;
  const needsSalePayment = Boolean(open && currentOrder?.databaseId &&
    currentOrder.orderChannel === "walk_in" && currentOrder.paymentStatus === "Unknown" &&
    !currentOrder.paymentResolutionUncertain &&
    session?.role === "cashier");

  useEffect(() => {
    if (!needsSalePayment || !currentOrder?.databaseId || !session) return;
    const databaseOrderId = currentOrder.databaseId;
    const orderNumber = currentOrder.id;
    let cancelled = false;
    setSalePayment(undefined);
    setPaymentLookup({ databaseOrderId, status: "loading" });
    void fetchCashierSale(databaseOrderId, session.name).then((sale) => {
      if (cancelled) return;
      if (sale.order.databaseId !== databaseOrderId || sale.order.id !== orderNumber ||
          sale.payment.orderId !== orderNumber || sale.transaction.cashierId !== session.id) {
        throw new Error("The historical payment did not match this order and cashier.");
      }
      setSalePayment({ databaseOrderId, payment: sale.payment });
      setPaymentLookup(undefined);
    }).catch(() => {
      if (!cancelled) setPaymentLookup({ databaseOrderId, status: "unavailable" });
    });
    return () => { cancelled = true; };
  }, [needsSalePayment, currentOrder?.databaseId, currentOrder?.id, session?.id, session?.name]);
  const delayed = currentOrder
    ? isOrderDelayed(currentOrder, state.delayedThresholdMinutes)
    : false;
  const offerAllowed = Boolean(currentOrder && canOfferOrderToRider(currentOrder) &&
    !databaseLoading && !databaseError);
  const releaseUnavailableReason = currentOrder?.status !== "Ready"
    ? "This order is no longer ready for release."
    : !currentOrder.databaseId
      ? "This order is not connected to a database order."
    : databaseError
      ? "Refresh cashier operations before releasing this order."
      : databaseLoading
        ? "Wait for cashier operations to finish refreshing."
        : undefined;

  const handleCancel = useCallback(
    async (reason: string) => {
      if (!currentOrder) return;
      if (actionInFlight.current) throw new Error("An order action is already in progress.");
      if (!canCancelCashierOrder(currentOrder)) {
        throw new Error("This order is no longer eligible for ordinary cancellation. Refresh its status and payment.");
      }
      actionInFlight.current = true;
      setLoading(true);
      setError("");
      try {
        await cancelOrder(currentOrder.id, reason);
        Toast.success(`${currentOrder.id} cancelled`, {
          description:
            "Order status and cancellation history were updated.",
        });
        setCancelOpen(false);
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : "The cancellation request could not be confirmed.";
        setError(`${detail} Refresh the order before trying again.`);
        setCancelOpen(false);
        refreshDatabaseState();
        throw caught;
      } finally {
        actionInFlight.current = false;
        setLoading(false);
      }
    },
    [cancelOrder, currentOrder, refreshDatabaseState],
  );

  const handleRelease = useCallback(async () => {
    if (!currentOrder) return;
    if (actionInFlight.current) return;
    if (currentOrder.status !== "Ready" || releaseUnavailableReason) {
      setError("This order is no longer ready for release. Refresh before trying again.");
      setReleaseOpen(false);
      return;
    }
    actionInFlight.current = true;
    setLoading(true);
    setError("");
    try {
      await releaseReadyOrder(currentOrder.id);
      setReleaseOpen(false);
      Toast.success(`${currentOrder.id} released`, {
        description:
          currentOrder.type === "Delivery"
            ? "The order is now waiting for a rider."
            : "The order was completed and handed to the customer.",
      });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "The release request could not be confirmed.";
      setError(`${detail} Refresh the order before attempting another handoff.`);
      setReleaseOpen(false);
      refreshDatabaseState();
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  }, [currentOrder, releaseReadyOrder, releaseUnavailableReason, refreshDatabaseState]);

  const handleOfferNextRider = useCallback(async () => {
  if (!currentOrder) return;

  if (!currentOrder.databaseId) {
    setError(
      "This order is not connected to a database order.",
    );
    return;
  }

  if (currentOrder.type !== "Delivery") {
    setError(
      "Only delivery orders can be offered to riders.",
    );
    return;
  }

  if (currentOrder.status !== "Waiting for Rider") {
    setError(
      "This order must be waiting for a rider before an offer can be created.",
    );
    return;
  }

  if (!offerAllowed) {
    setError("Rider assignment status is unavailable or has changed. Refresh before offering again.");
    return;
  }

  setLoading(true);
  setError("");

  try {
    await offerNextRider(currentOrder.id);

    Toast.success(
      `${currentOrder.id} offered to a rider`,
      {
        description:
          "The next eligible rider was selected using the fairness rule.",
      },
    );
  } catch (caught) {
    setError(
      caught instanceof Error
        ? caught.message
        : "Unable to offer the order to a rider.",
    );
  } finally {
    setLoading(false);
  }
}, [currentOrder, offerAllowed, offerNextRider]);

  return {
    currentOrder,
    payment,
    paymentLookup: currentOrder?.databaseId === paymentLookup?.databaseOrderId ? paymentLookup?.status : undefined,
    delayed,
    offerAllowed,
    releaseUnavailableReason,
    refreshAssignmentStatus: refreshDatabaseState,
    cancelOpen,
    setCancelOpen,
    releaseOpen,
    setReleaseOpen,
    loading,
    error,
    handleCancel,
    handleRelease,
    handleOfferNextRider,
  };
}
