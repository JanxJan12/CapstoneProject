import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatMoney, SHIFT_VARIANCE_REASONS } from "../constants";
import { endShiftSchema, type EndShiftForm } from "../schemas";
import type { ShiftClosureInput, ShiftTotals } from "../types";
import {
  CashierButton,
  ConfirmationDialog,
  CashierDialogContent,
  CashierInput,
  CashierSelect,
  CashierTextarea,
  FieldError,
  Label,
} from "../components";
import { ShiftSummaryItem, VarianceIndicator } from "./ShiftDialogSummary";
import { getVarianceOutcomeFromAmount } from "./shiftSettlementUtils";

export function EndShiftDialog({
  open,
  loading,
  totals,
  pendingPaymentCount,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  totals: ShiftTotals;
  pendingPaymentCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: ShiftClosureInput) => Promise<void>;
}) {
  const [reviewValues, setReviewValues] = useState<EndShiftForm>();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = useForm<EndShiftForm>({
    resolver: zodResolver(endShiftSchema),
    defaultValues: {
      actualCash: totals.expectedCash,
      varianceReason: "",
      notes: "",
      managerName: "",
      managerApproved: false,
    },
  });
  const actual = Number(watch("actualCash") ?? 0);
  const managerName = watch("managerName");
  const managerApproved = watch("managerApproved");
  const variance = actual - totals.expectedCash;
  const outcome = getVarianceOutcomeFromAmount(variance);

  useEffect(() => {
    if (variance === 0) {
      clearErrors("varianceReason");
      setValue("varianceReason", "");
    }
  }, [variance, clearErrors, setValue]);

  const submit = handleSubmit((values) => {
    if (pendingPaymentCount > 0) return;
    if (variance !== 0 && !values.varianceReason?.trim()) {
      setError("varianceReason", {
        message: "Select a reason for this drawer variance.",
      });
      return;
    }
    setReviewValues(values);
  });

  const resetForm = () => {
    setReviewValues(undefined);
    reset({
      actualCash: totals.expectedCash,
      varianceReason: "",
      notes: "",
      managerName: "",
      managerApproved: false,
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!loading) {
            onOpenChange(value);
            if (!value) resetForm();
          }
        }}
      >
        <CashierDialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>End and settle shift</DialogTitle>
            <DialogDescription>
              Count the drawer, document any variance, and obtain manager
              approval before final confirmation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {pendingPaymentCount > 0 && (
              <div
                className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-black">Shift closure is blocked</p>
                  <p className="mt-1">
                    Resolve {pendingPaymentCount} pending payment
                    {pendingPaymentCount === 1 ? "" : "s"} before ending this
                    shift.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs sm:grid-cols-3">
              <ShiftSummaryItem
                label="Expected cash"
                value={formatMoney(totals.expectedCash)}
              />
              <ShiftSummaryItem
                label="GCash"
                value={formatMoney(totals.gcashSales)}
              />
              <ShiftSummaryItem
                label="Refunds"
                value={formatMoney(totals.refunds)}
              />
              <ShiftSummaryItem
                label="Discounts"
                value={formatMoney(totals.discounts)}
              />
              <ShiftSummaryItem
                label="Voids"
                value={formatMoney(totals.voids)}
              />
              <ShiftSummaryItem
                label="Transactions"
                value={String(totals.transactionCount)}
              />
            </div>

            <div>
              <Label htmlFor="actual-cash">Actual cash count</Label>
              <CashierInput
                id="actual-cash"
                type="number"
                min="0"
                step="0.01"
                autoFocus
                aria-invalid={Boolean(errors.actualCash)}
                {...register("actualCash", { valueAsNumber: true })}
              />
              <FieldError>{errors.actualCash?.message}</FieldError>
            </div>

            <VarianceIndicator variance={variance} outcome={outcome} />

            {variance !== 0 && (
              <div>
                <Label htmlFor="variance-reason">Variance reason</Label>
                <CashierSelect
                  id="variance-reason"
                  aria-invalid={Boolean(errors.varianceReason)}
                  {...register("varianceReason")}
                >
                  <option value="">Select a reason</option>
                  {SHIFT_VARIANCE_REASONS.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </CashierSelect>
                <FieldError>{errors.varianceReason?.message}</FieldError>
              </div>
            )}

            <div>
              <Label htmlFor="settlement-notes">Cashier notes (optional)</Label>
              <CashierTextarea
                id="settlement-notes"
                placeholder="Record handoff notes, exceptions, or supporting details"
                aria-invalid={Boolean(errors.notes)}
                {...register("notes")}
              />
              <FieldError>{errors.notes?.message}</FieldError>
            </div>

            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Manager approval
              </p>
              <div className="mt-3">
                <Label htmlFor="manager-name">Approving manager</Label>
                <CashierInput
                  id="manager-name"
                  placeholder="Manager full name"
                  aria-invalid={Boolean(errors.managerName)}
                  {...register("managerName")}
                />
                <FieldError>{errors.managerName?.message}</FieldError>
              </div>
              <label className="mt-3 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-muted/35 p-3 text-xs font-semibold">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-primary"
                  {...register("managerApproved")}
                />
                <span>
                  The manager reviewed the expected cash, actual count,
                  variance, and supporting notes.
                </span>
              </label>
              <FieldError>{errors.managerApproved?.message}</FieldError>
            </div>

            <DialogFooter>
              <CashierButton
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => onOpenChange(false)}
              >
                Review later
              </CashierButton>
              <CashierButton
                type="submit"
                variant="danger"
                disabled={
                  pendingPaymentCount > 0 ||
                  !managerName?.trim() ||
                  !managerApproved
                }
              >
                Review and confirm
              </CashierButton>
            </DialogFooter>
          </form>
        </CashierDialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(reviewValues)}
        onOpenChange={(value) => {
          if (!value) setReviewValues(undefined);
        }}
        title={`End shift as ${outcome}?`}
        description={`Expected ${formatMoney(totals.expectedCash)}, actual ${formatMoney(actual)}, variance ${formatMoney(variance)}. Approved by ${managerName || "manager"}. This closes the drawer and blocks new transactions until another shift starts.`}
        confirmLabel="End shift"
        cancelLabel="Back to review"
        danger
        onConfirm={() => {
          if (!reviewValues) return;
          void onConfirm({
            actualCash: reviewValues.actualCash,
            varianceReason: reviewValues.varianceReason,
            notes: reviewValues.notes,
            managerName: reviewValues.managerName,
            managerApproved: reviewValues.managerApproved,
          });
        }}
      />
    </>
  );
}
