import {
  CASHIER_STATE_VERSION,
  CASHIER_TERMINAL,
  DEFAULT_DELAY_THRESHOLD_MINUTES,
} from "../constants";

import type { CashierState } from "../types";

export function createInitialCashierState(): CashierState {
  return {
    version: CASHIER_STATE_VERSION,

    cashier: {
      id: "",
      name: "",
      terminal: CASHIER_TERMINAL,
    },

    delayedThresholdMinutes:
      DEFAULT_DELAY_THRESHOLD_MINUTES,

    menuItems: [],

    /*
     * No fake operational data.
     *
     * Real online orders are loaded from PostgreSQL.
     * These arrays begin empty instead of creating ORD-20xx,
     * PAY-91xx, demo riders, fake shifts, etc.
     */
    orders: [],
    payments: [],
    transactions: [],
    shifts: [],
    riders: [],
    notifications: [],
    activities: [],
    heldOrders: [],
  };
}
