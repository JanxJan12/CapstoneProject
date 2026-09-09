import { useCallback, useState } from "react";
import { Toast } from "../components";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order } from "../types";
import { isOrderDelayed } from "./orderOperations";

export function useOrderDetailsDrawer(order?: Order) {
  const {
    state,
    cancelOrder,
    releaseReadyOrder,
    offerNextRider,
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

  const handleCancel = useCallback(
    async (reason: string) => {
      if (!currentOrder) return;
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
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to cancel the order.",
        );
        throw caught;
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

  return {
    currentOrder,
    payment,
    delayed,
    cancelOpen,
    setCancelOpen,
    loading,
    error,
    handleCancel,
    handleRelease,
    handleOfferNextRider,
  };
}
