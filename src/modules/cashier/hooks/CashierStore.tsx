import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { OPTIMISTIC_DELAY_MS } from "../constants";
import { calculateShiftTotals } from "../services/cashierService";
import type { CashierState, ShiftTotals } from "../types";
import { loadCashierState, saveCashierState } from "./cashierPersistence";
import type {
  CashierCommit,
  CashierStoreValue,
  OptimisticCommit,
} from "./cashierStoreTypes";
import { useCashierActions } from "./useCashierActions";

const EMPTY_SHIFT_TOTALS: ShiftTotals = {
  cashSales: 0,
  gcashSales: 0,
  refunds: 0,
  cashRefunds: 0,
  voids: 0,
  discounts: 0,
  transactionCount: 0,
  ordersProcessed: 0,
  expectedCash: 0,
};

const CashierStore = createContext<CashierStoreValue | null>(null);

export function CashierProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CashierState>(loadCashierState);
  const [isHydrating, setIsHydrating] = useState(true);
  const stateRef = useRef(state);

  const commit = useCallback<CashierCommit>((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const commitOptimistically = useCallback<OptimisticCommit>(
    async (next, previous, milliseconds = OPTIMISTIC_DELAY_MS.default) => {
      commit(next);
      try {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, milliseconds),
        );
      } catch (error) {
        if (stateRef.current === next) commit(previous);
        throw error;
      }
    },
    [commit],
  );

  const actions = useCashierActions(stateRef, commit, commitOptimistically);

  useEffect(() => {
    stateRef.current = state;
    saveCashierState(state);
  }, [state]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsHydrating(false));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const activeShift = useMemo(
    () => state.shifts.find((entry) => entry.status === "Open"),
    [state.shifts],
  );
  const shiftTotals = useMemo(
    () =>
      activeShift
        ? calculateShiftTotals(state, activeShift.id)
        : EMPTY_SHIFT_TOTALS,
    [activeShift, state],
  );

  const value = useMemo<CashierStoreValue>(
    () => ({ state, isHydrating, activeShift, shiftTotals, ...actions }),
    [actions, activeShift, isHydrating, shiftTotals, state],
  );

  return (
    <CashierStore.Provider value={value}>{children}</CashierStore.Provider>
  );
}

export function useCashierStore() {
  const value = useContext(CashierStore);
  if (!value) {
    throw new Error("useCashierStore must be used inside CashierProvider");
  }
  return value;
}
