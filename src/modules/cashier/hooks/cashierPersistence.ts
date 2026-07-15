import { CASHIER_STATE_VERSION, CASHIER_STORAGE_KEY } from "../constants";
import { createInitialCashierState } from "../services/seed";
import type { CashierState } from "../types";

export function loadCashierState(): CashierState {
  try {
    const raw = localStorage.getItem(CASHIER_STORAGE_KEY);
    if (!raw) return createInitialCashierState();
    const parsed = JSON.parse(raw) as CashierState;
    if (parsed.version === CASHIER_STATE_VERSION) return parsed;
    if (parsed.version >= 4 && parsed.version < CASHIER_STATE_VERSION) {
      const initial = createInitialCashierState();
      const catalog = new Map(initial.menuItems.map((item) => [item.id, item]));
      return {
        ...parsed,
        version: CASHIER_STATE_VERSION,
        menuItems: parsed.menuItems.map((item) => ({
          ...catalog.get(item.id),
          ...item,
          aliases: item.aliases ?? catalog.get(item.id)?.aliases,
          inventoryRemaining:
            item.inventoryRemaining ?? catalog.get(item.id)?.inventoryRemaining,
        })),
      };
    }
  } catch {
    // Fall through to a known-good state when browser storage is unavailable.
  }
  return createInitialCashierState();
}

export function saveCashierState(state: CashierState) {
  localStorage.setItem(CASHIER_STORAGE_KEY, JSON.stringify(state));
}
