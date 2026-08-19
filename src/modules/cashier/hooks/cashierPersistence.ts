import {
  CASHIER_STATE_VERSION,
  CASHIER_STORAGE_KEY,
} from "../constants";

import { createInitialCashierState } from "../services/seed";

import type { CashierState } from "../types";

/*
 * An open cashier shift should never realistically remain active
 * for multiple days.
 *
 * If an old prototype shift is still stored in localStorage,
 * regenerate the demo state so timestamps become relative to now.
 */
const MAX_OPEN_SHIFT_HOURS = 16;

function hasStaleOpenShift(state: CashierState): boolean {
  const openShift = state.shifts.find(
    (shift) => shift.status === "Open",
  );

  if (!openShift?.startedAt) {
    return false;
  }

  const startedAt = new Date(openShift.startedAt).getTime();

  if (Number.isNaN(startedAt)) {
    return true;
  }

  const ageInHours =
    (Date.now() - startedAt) / (1000 * 60 * 60);

  return ageInHours > MAX_OPEN_SHIFT_HOURS;
}

export function loadCashierState(): CashierState {
  try {
    const raw = localStorage.getItem(
      CASHIER_STORAGE_KEY,
    );

    if (!raw) {
      return createInitialCashierState();
    }

    const parsed = JSON.parse(raw) as CashierState;

    /*
     * Reset obsolete prototype data.
     *
     * This fixes cases where a seeded "active shift" from days
     * or weeks ago is still being restored from localStorage.
     */
    if (hasStaleOpenShift(parsed)) {
      const freshState =
        createInitialCashierState();

      localStorage.setItem(
        CASHIER_STORAGE_KEY,
        JSON.stringify(freshState),
      );

      return freshState;
    }

    /*
     * Current stored format can be restored normally.
     */
    if (
      parsed.version === CASHIER_STATE_VERSION
    ) {
      return parsed;
    }

    /*
     * Migrate older prototype states while keeping cashier
     * operations already performed in the browser.
     */
    if (
      parsed.version >= 4 &&
      parsed.version < CASHIER_STATE_VERSION
    ) {
      const initial =
        createInitialCashierState();

      const catalog = new Map(
        initial.menuItems.map((item) => [
          item.id,
          item,
        ]),
      );

      const migratedState: CashierState = {
        ...parsed,
        version: CASHIER_STATE_VERSION,

        menuItems: parsed.menuItems.map(
          (item) => ({
            ...catalog.get(item.id),
            ...item,

            aliases:
              item.aliases ??
              catalog.get(item.id)?.aliases,

            inventoryRemaining:
              item.inventoryRemaining ??
              catalog.get(item.id)
                ?.inventoryRemaining,
          }),
        ),
      };

      localStorage.setItem(
        CASHIER_STORAGE_KEY,
        JSON.stringify(migratedState),
      );

      return migratedState;
    }
  } catch (error) {
    console.error(
      "Unable to restore cashier state:",
      error,
    );
  }

  /*
   * Unknown or damaged state gets replaced by a known-good
   * prototype state.
   */
  const freshState =
    createInitialCashierState();

  try {
    localStorage.setItem(
      CASHIER_STORAGE_KEY,
      JSON.stringify(freshState),
    );
  } catch {
    // Browser storage may be unavailable.
  }

  return freshState;
}

export function saveCashierState(
  state: CashierState,
): void {
  try {
    localStorage.setItem(
      CASHIER_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch (error) {
    console.error(
      "Unable to save cashier state:",
      error,
    );
  }
}