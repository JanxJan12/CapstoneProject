import { useCallback, useState } from "react";
import { Toast } from "../components";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order } from "../types";
import { isOrderDelayed } from "./orderOperations";

export function useOrderDetailsDrawer(order?: Order) {
  const {
    state,
    confirmOrder,
    cancelOrder,
    releaseReadyOrder,
    offerNextRider,
    recordReceiptReprint,
  } = useCashierStore();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentOrder = order
    ? (state.orders.find((entry) => entry.id === order.id) ?? order)
    : undefined;
  const payment = currentOrder
    ? state.payments.find((entry) => entry.orderId === currentOrder.id)
    : undefined;
  const delayed = currentOrder
    ? isOrderDelayed(currentOrder, state.delayedThresholdMinutes)
    : false;

  const handleConfirm = useCallback(async () => {
  if (!currentOrder) return;

  if (!currentOrder.databaseId) {
    setError(
      "This order is not connected to a database order and cannot be confirmed.",
    );
    return;
  }

  if (currentOrder.status !== "Awaiting Payment") {
    setError("Only orders awaiting payment can be confirmed.");
    return;
  }

  setLoading(true);
  setError("");

  try {
    await confirmOrder(
      currentOrder.databaseId,
      "Order confirmed by cashier",
    );

    Toast.success(`${currentOrder.id} confirmed`, {
      description:
        "The order has been confirmed and sent to the kitchen queue.",
    });
  } catch (caught) {
    setError(
      caught instanceof Error
        ? caught.message
        : "Unable to confirm the order.",
    );
  } finally {
    setLoading(false);
  }
}, [confirmOrder, currentOrder]);

  const handleCancel = useCallback(
    async (reason: string) => {
      if (!currentOrder) return;
      setLoading(true);
      setError("");
      try {
        await cancelOrder(currentOrder.id, reason);
        Toast.success(`${currentOrder.id} cancelled`, {
          description:
            "The order and related transaction records were updated.",
        });
        setCancelOpen(false);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to cancel the order.",
        );
      } finally {
        setLoading(false);
      }
    },
    [cancelOrder, currentOrder],
  );

  const handleRelease = useCallback(async () => {
    if (!currentOrder) return;
    setLoading(true);
    setError("");
    try {
      await releaseReadyOrder(currentOrder.id);
      Toast.success(`${currentOrder.id} released`, {
        description:
          currentOrder.type === "Delivery"
            ? "The order is now waiting for a rider."
            : "The order was completed and handed to the customer.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to release the order.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentOrder, releaseReadyOrder]);

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
}, [currentOrder, offerNextRider]);

  const printReceipt = useCallback(() => {
    if (!currentOrder?.transactionId) return;
    window.print();
    void recordReceiptReprint(currentOrder.id);
    Toast.success("Receipt sent to the print dialog.");
  }, [currentOrder, recordReceiptReprint]);

  return {
    currentOrder,
    payment,
    delayed,
    cancelOpen,
    setCancelOpen,
    loading,
    error,
    handleConfirm,
    handleCancel,
    handleRelease,
    handleOfferNextRider,
    printReceipt,
  };
}
