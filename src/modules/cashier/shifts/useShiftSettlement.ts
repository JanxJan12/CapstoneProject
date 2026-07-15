import { useCallback, useState } from "react";
import { Toast } from "../components";
import { useCashierStore } from "../hooks/CashierStore";
import { calculateShiftTotals } from "../services/cashierService";
import type { ShiftClosureInput } from "../types";

export function useShiftSettlement() {
  const { state, activeShift, shiftTotals, startShift, endShift } =
    useCashierStore();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [reportShiftId, setReportShiftId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pendingPayments = state.payments.filter(
    (payment) => payment.status === "Pending",
  );
  const latest = activeShift ?? state.shifts[0];
  const totals = latest ? calculateShiftTotals(state, latest.id) : shiftTotals;
  const reportShift = state.shifts.find((shift) => shift.id === reportShiftId);
  const reportTotals = reportShift
    ? calculateShiftTotals(state, reportShift.id)
    : undefined;

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
        await endShift(input);
        setEndOpen(false);
        Toast.success("Shift settled and closed", {
          description:
            "The manager approval and closing audit record were saved.",
        });
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to settle shift.",
        );
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
    latest,
    totals,
    pendingPayments,
    reportShift,
    reportTotals,
    startOpen,
    setStartOpen,
    endOpen,
    setEndOpen,
    setReportShiftId,
    loading,
    error,
    setError,
    handleStart,
    handleEnd,
    openEndDialog,
  };
}
