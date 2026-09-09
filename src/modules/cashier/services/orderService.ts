import type {
  CashierState,
  HeldOrder,
} from "../types";
import {
  cloneState,
  nextRecordId,
  timestampNow,
} from "./serviceUtils";

export function holdOrder(
  current: CashierState,
  held: Omit<HeldOrder, "id" | "heldAt">,
): { state: CashierState; held: HeldOrder } {
  const state = cloneState(current);
  const record: HeldOrder = {
    ...held,
    id: nextRecordId("HOLD", state.heldOrders),
    heldAt: timestampNow(),
  };
  state.heldOrders.unshift(record);
  return { state, held: record };
}

export function removeHeldOrder(
  current: CashierState,
  heldId: string,
): CashierState {
  const state = cloneState(current);
  state.heldOrders = state.heldOrders.filter((entry) => entry.id !== heldId);
  return state;
}

function normalizeTable(tableNumber?: string) {
  const value = tableNumber?.trim();
  if (!value) return undefined;
  return value.replace(/^0+(?=\d)/, "");
}
