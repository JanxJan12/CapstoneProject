import { useMemo } from "react";
import { ACTIVE_ORDER_STATUSES } from "../constants";
import { useCashierStore } from "./CashierStore";

export function useCashierMetrics() {
  const { state, activeShift, shiftTotals } = useCashierStore();
  return useMemo(() => {
    const completedTransactions = state.transactions.filter(
      (entry) => entry.status === "Completed",
    );
    const activeOrders = state.orders.filter((entry) =>
      ACTIVE_ORDER_STATUSES.includes(entry.status),
    );
    return {
      pendingPayments: state.payments.filter(
        (entry) => entry.status === "Pending",
      ).length,
      openTickets: activeOrders.length,
      salesToday: completedTransactions.reduce(
        (sum, entry) => sum + entry.amount,
        0,
      ),
      walkInOrders: state.orders.filter((entry) => entry.type !== "Delivery")
        .length,
      readyOrders: state.orders.filter((entry) => entry.status === "Ready")
        .length,
      kitchenOrders: state.orders.filter((entry) =>
        ["Confirmed", "Preparing", "Ready"].includes(entry.status),
      ).length,
      deliveryOrders: state.orders.filter(
        (entry) =>
          entry.type === "Delivery" &&
          ACTIVE_ORDER_STATUSES.includes(entry.status),
      ).length,
      activeOrders,
      activeShift,
      shiftTotals,
    };
  }, [state, activeShift, shiftTotals]);
}
