import { useCallback, useState } from "react";
import { Toast } from "../components";
import { formatMoney } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { ShiftClosureInput } from "../types";

export function useShiftSettlement() {
  const { state, activeShift, shiftTotals, startShift, endShift } =
    useCashierStore();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pendingPayments = state.payments.filter(
    (payment) => payment.status === "Pending",
  );

  const handleStart = useCallback(
    async (openingCash: number, terminal: string) => {
      setLoading(true);
      setError("");
      try {
        await startShift(openingCash, terminal);
        setStartOpen(false);
        Toast.success("Shift started", {
          description:
            "The opening cash and terminal were recorded in the audit trail.",
        });
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to start shift.",
        );
      } finally {
        setLoading(false);
      }
    },
    [startShift],
  );

  const handleEnd = useCallback(
    async (input: ShiftClosureInput) => {
      setLoading(true);
      setError("");
      try {
        const saved = await endShift(input);
        setEndOpen(false);
        Toast.success("Shift settled and closed", {
          description: `Saved expected ${formatMoney(saved.expectedCash)} · counted ${formatMoney(saved.actualCash)} · ${saved.variance === 0 ? "balanced" : saved.variance < 0 ? "shortage" : "overage"} ${formatMoney(Math.abs(saved.variance))}. View Saved closed shifts for the recorded settlement.`,
        });
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to settle shift.",
        );
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [endShift],
  );

  const openEndDialog = useCallback(() => {
    if (pendingPayments.length) {
      Toast.warning("Shift closure is blocked", {
        description: `Resolve ${pendingPayments.length} pending payment${pendingPayments.length === 1 ? "" : "s"} before closing the drawer.`,
      });
    }
    setEndOpen(true);
  }, [pendingPayments.length]);

  return {
    state,
    activeShift,
    shiftTotals,
    pendingPayments,
    startOpen,
    setStartOpen,
    endOpen,
    setEndOpen,
    loading,
    error,
    setError,
    handleStart,
    handleEnd,
    openEndDialog,
  };
}
