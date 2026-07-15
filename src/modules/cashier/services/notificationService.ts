import type { CashierState } from "../types";
import { cloneState } from "./serviceUtils";

export function markNotificationsRead(current: CashierState): CashierState {
  const state = cloneState(current);
  state.notifications.forEach((entry) => {
    entry.read = true;
  });
  return state;
}

export function markNotificationRead(
  current: CashierState,
  notificationId: string,
): CashierState {
  const state = cloneState(current);
  const notification = state.notifications.find(
    (entry) => entry.id === notificationId,
  );
  if (notification) notification.read = true;
  return state;
}
