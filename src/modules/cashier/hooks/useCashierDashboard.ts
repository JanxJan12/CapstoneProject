import { useEffect, useMemo, useState } from "react";
import { DASHBOARD_CLOCK_REFRESH_MS } from "../constants";
import {
  getCashierActionQueue,
  getCashierShiftSummary,
} from "../services/cashierDashboardService";
import type { CashierAttentionSummary } from "../types";
import { useCashierStore } from "./CashierStore";

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
    const actionQueue = getCashierActionQueue(state, activeShift?.id, now);
    const shiftSummary = getCashierShiftSummary(state, activeShift?.id);
    const attention: CashierAttentionSummary = {
      pendingPayments: actionQueue.filter(
        (item) => item.nextAction === "verify_payment",
      ).length,
      readyOrders: actionQueue.filter(
        (item) => item.nextAction === "release_order",
      ).length,
      delayedOrders: actionQueue.filter((item) => item.isDelayed).length,
      actionRequired: actionQueue.filter(
        (item) => item.nextAction !== "view_details" || item.isDelayed,
      ).length,
      allActive: actionQueue.length,
    };

    return { actionQueue, shiftSummary, attention };
  }, [activeShift?.id, now, state]);
}
