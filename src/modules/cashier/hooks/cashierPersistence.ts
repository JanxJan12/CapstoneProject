import { CASHIER_STORAGE_KEY } from "../constants";
import { createInitialCashierState } from "../services/seed";
import type { CashierState } from "../types";

// The old key contained customer, payment, and shift records. Never restore it.
const PREFERENCES_KEY = `${CASHIER_STORAGE_KEY}_preferences`;

export function loadCashierState(): CashierState {
  const initial = createInitialCashierState();
  try {
    localStorage.removeItem(CASHIER_STORAGE_KEY);
    localStorage.removeItem(PREFERENCES_KEY);
  } catch {
    // Storage may be disabled; server-owned data always starts empty.
  }
  return initial;
}

export function loadCashierPreferences(cashierId: string): Pick<CashierState, "delayedThresholdMinutes"> {
  const fallback = createInitialCashierState().delayedThresholdMinutes;
  try {
    const saved = JSON.parse(localStorage.getItem(`${PREFERENCES_KEY}_${cashierId}`) ?? "null") as
      | { delayedThresholdMinutes?: number } | null;
    if (saved && Number.isFinite(saved.delayedThresholdMinutes)) {
      return { delayedThresholdMinutes: Math.max(1, saved.delayedThresholdMinutes!) };
    }
  } catch {
    // Use the default preference.
  }
  return { delayedThresholdMinutes: fallback };
}

export function saveCashierState(state: CashierState): void {
  try {
    localStorage.removeItem(CASHIER_STORAGE_KEY);
    if (!state.cashier.id) return;
    localStorage.setItem(`${PREFERENCES_KEY}_${state.cashier.id}`, JSON.stringify({
      delayedThresholdMinutes: state.delayedThresholdMinutes,
    }));
  } catch {
    // Preferences are optional.
  }
}
