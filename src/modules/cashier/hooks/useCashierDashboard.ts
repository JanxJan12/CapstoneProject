import { useEffect, useMemo, useState } from "react";
import { DASHBOARD_CLOCK_REFRESH_MS } from "../constants";
import {
  getCashierActionQueue,
  getCashierShiftSummary,
} from "../services/cashierDashboardService";
import type { CashierAttentionSummary } from "../types";
import { useCashierStore } from "./CashierStore";
import { partitionCashierWorkQueue, selectCashierQueueView } from "../dashboard/workQueuePresentation";

export function useCashierDashboard() {
  const { state, activeShift } = useCashierStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      DASHBOARD_CLOCK_REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const actionQueue = getCashierActionQueue(state, now);
    const queue = partitionCashierWorkQueue(actionQueue, now);
    const shiftSummary = getCashierShiftSummary(state, activeShift?.id);
    const attention: CashierAttentionSummary = {
      pendingPayments: queue.all.filter(
        (item) => item.nextAction === "verify_payment",
      ).length,
      readyOrders: queue.current.filter(
        (item) => item.nextAction === "release_order",
      ).length,
      delayedOrders: queue.current.filter((item) => item.isDelayed).length,
      agingOrders: queue.current.filter((item) => item.orderAgeReview).length,
      kitchenQueued: queue.current.filter((item) => item.stage === "kitchen_queue").length,
      preparingOrders: queue.current.filter((item) => item.stage === "preparing").length,
      waitingForRider: queue.current.filter((item) => item.stage === "rider_assignment").length,
      deliveryInProgress: queue.current.filter((item) =>
        ["rider_assigned", "picked_up", "out_for_delivery"].includes(item.stage),
      ).length,
      actionRequired: selectCashierQueueView(queue, "action_required").length,
      allActive: queue.all.length,
      olderBacklog: queue.older.length,
    };

    return { queue, shiftSummary, attention };
  }, [activeShift?.id, now, state]);
}
