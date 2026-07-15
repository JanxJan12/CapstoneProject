import { useMemo } from "react";
import { ACTIVE_ORDER_STATUSES, minutesSince } from "../constants";
import { useCashierStore } from "./CashierStore";

const isToday = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

export function useCashierMetrics() {
  const { state, activeShift, shiftTotals } = useCashierStore();
  return useMemo(() => {
    const todayTransactions = state.transactions.filter((entry) =>
      isToday(entry.createdAt),
    );
    const completedTransactions = todayTransactions.filter(
      (entry) => entry.status === "Completed",
    );
    const activeOrders = state.orders.filter((entry) =>
      ACTIVE_ORDER_STATUSES.includes(entry.status),
    );
    const pendingPayments = state.payments.filter(
      (entry) => entry.status === "Pending",
    );
    const digitalPayments = state.payments.filter(
      (entry) => entry.method === "GCash",
    );
    const verifiedDigitalPayments = digitalPayments.filter(
      (entry) => entry.status === "Verified",
    ).length;
    const cashSales = completedTransactions
      .filter((entry) => entry.method === "Cash")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const gcashSales = completedTransactions
      .filter((entry) => entry.method === "GCash")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const delayedOrders = activeOrders.filter(
      (entry) => minutesSince(entry.createdAt) > state.delayedThresholdMinutes,
    );
    const deliveryOrders = activeOrders.filter(
      (entry) => entry.type === "Delivery",
    );
    const actualCash = activeShift?.actualCash;
    const variance =
      actualCash === undefined ? undefined : actualCash - shiftTotals.expectedCash;

    return {
      pendingPayments: pendingPayments.length,
      pendingAmount: pendingPayments.reduce(
        (sum, entry) => sum + entry.amount,
        0,
      ),
      oldestPendingMinutes: pendingPayments.length
        ? Math.max(...pendingPayments.map((entry) => minutesSince(entry.uploadedAt)))
        : 0,
      paymentVerificationPercent: digitalPayments.length
        ? Math.round((verifiedDigitalPayments / digitalPayments.length) * 100)
        : 100,
      openTickets: activeOrders.length,
      salesToday: completedTransactions.reduce(
        (sum, entry) => sum + entry.amount,
        0,
      ),
      walkInOrders: state.orders.filter(
        (entry) => entry.type !== "Delivery" && isToday(entry.createdAt),
      ).length,
      readyOrders: state.orders.filter((entry) => entry.status === "Ready")
        .length,
      completedTransactions: completedTransactions.length,
      cashSales,
      gcashSales,
      confirmedOrders: state.orders.filter(
        (entry) => entry.status === "Confirmed",
      ).length,
      preparingOrders: state.orders.filter(
        (entry) => entry.status === "Preparing",
      ).length,
      waitingForRider: state.orders.filter(
        (entry) => entry.status === "Waiting for Rider",
      ).length,
      availableRiders: state.riders.filter(
        (entry) => entry.availability === "Available",
      ).length,
      activeDeliveries: deliveryOrders.filter((entry) =>
        ["Rider Accepted", "Picked Up", "Out for Delivery"].includes(
          entry.status,
        ),
      ).length,
      delayedOrders,
      activeOrders,
      activeShift,
      shiftTotals,
      actualCash,
      variance,
    };
  }, [state, activeShift, shiftTotals]);
}
