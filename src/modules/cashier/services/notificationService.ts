import type { CashierState } from "../types";
import { cloneState } from "./serviceUtils";

export function markNotificationsRead(current: CashierState): CashierState {
  const state = cloneState(current);
  state.notifications.forEach((entry) => {
    entry.read = true;
  });
  return state;
}
