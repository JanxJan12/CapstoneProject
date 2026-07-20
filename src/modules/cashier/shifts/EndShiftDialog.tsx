import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Banknote,
  ShieldCheck,
  StickyNote,
} from "lucide-react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CashierButton,
  CashierDialogContent,
  CashierInput,
  CashierSelect,
  CashierTextarea,
  ConfirmationDialog,
  FieldError,
  Label,
} from "../components";
import { formatMoney, SHIFT_VARIANCE_REASONS } from "../constants";
import { endShiftSchema, type EndShiftForm } from "../schemas";
import type { ShiftClosureInput, ShiftTotals } from "../types";
import {
  ShiftSummaryItem,
  VarianceIndicator,
} from "./ShiftDialogSummary";
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

  const closeDialog = () => {
    if (loading) return;

    resetForm();
    onOpenChange(false);
  };

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

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (loading) return;

          onOpenChange(value);

          if (!value) {
            resetForm();
          }
        }}
      >
        <CashierDialogContent
          className="max-w-2xl"
          style={{
            padding: 0,
            gap: 0,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            className="
              shrink-0 border-b border-border/80
              bg-gradient-to-b from-[#fffaf4] to-[#fffdf9]
            "
            style={{
              padding: "22px 56px 18px 24px",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="
                  mt-0.5 flex h-10 w-10 shrink-0
                  items-center justify-center rounded-xl
                  bg-primary/10 text-primary
                "
              >
                <Banknote
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </span>

              <DialogHeader className="gap-1 text-left">
                <DialogTitle className="text-xl">
                  End and settle shift
                </DialogTitle>

                <DialogDescription className="max-w-lg leading-5">
                  Review the drawer totals, record the actual cash
                  count, and obtain manager approval before closing
                  the shift.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {/* Scrollable modal content */}
            <div
              className="
                min-h-0 flex-1 space-y-4
                overflow-y-auto overscroll-contain
                bg-[#fbf8f4]
              "
              style={{
                padding: "18px 24px 22px",
              }}
            >
              {/* Pending payments warning */}
              {pendingPaymentCount > 0 ? (
                <div
                  className="
                    flex gap-3 rounded-2xl
                    border border-red-200
                    bg-red-50 p-4
                    text-xs text-red-800
                  "
                  role="alert"
                >
                  <span
                    className="
                      flex h-8 w-8 shrink-0 items-center
                      justify-center rounded-lg bg-red-100
                    "
                  >
                    <AlertTriangle
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <p className="font-black">
                      Shift closure is blocked
                    </p>

                    <p className="mt-1 leading-5 text-red-700">
                      Resolve {pendingPaymentCount} pending payment
                      {pendingPaymentCount === 1 ? "" : "s"} before
                      ending this shift.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Shift summary */}
              <section
                className="
                  rounded-2xl border border-border/80
                  bg-white p-4
                  shadow-[0_3px_12px_rgba(36,26,19,0.04)]
                "
              >
                <div className="mb-4">
                  <p className="text-xs font-black text-foreground">
                    Shift summary
                  </p>

                  <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                    Recorded totals for the current cashier shift.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs sm:grid-cols-3">
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
              </section>

              {/* Drawer count */}
              <section
                className="
                  rounded-2xl border border-border/80
                  bg-white p-4
                  shadow-[0_3px_12px_rgba(36,26,19,0.04)]
                "
              >
                <div className="mb-4 flex items-start gap-3">
                  <span
                    className="
                      flex h-9 w-9 shrink-0 items-center
                      justify-center rounded-xl bg-amber-50
                      text-primary
                    "
                  >
                    <Banknote
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <p className="text-xs font-black text-foreground">
                      Drawer count
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                      Enter the physical cash currently inside the
                      drawer.
                    </p>
                  </div>
                </div>

                <Label htmlFor="actual-cash">
                  Actual cash count
                </Label>

                <CashierInput
                  id="actual-cash"
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="h-12 text-base font-black"
                  aria-invalid={Boolean(errors.actualCash)}
                  {...register("actualCash", {
                    valueAsNumber: true,
                  })}
                />

                <FieldError>
                  {errors.actualCash?.message}
                </FieldError>

                <div className="mt-3">
                  <VarianceIndicator
                    variance={variance}
                    outcome={outcome}
                  />
                </div>

                {variance !== 0 ? (
                  <div className="mt-4 border-t border-border/70 pt-4">
                    <Label htmlFor="variance-reason">
                      Variance reason
                    </Label>

                    <CashierSelect
                      id="variance-reason"
                      aria-invalid={Boolean(
                        errors.varianceReason,
                      )}
                      {...register("varianceReason")}
                    >
                      <option value="">
                        Select a reason
                      </option>

                      {SHIFT_VARIANCE_REASONS.map((reason) => (
                        <option
                          key={reason}
                          value={reason}
                        >
                          {reason}
                        </option>
                      ))}
                    </CashierSelect>

                    <FieldError>
                      {errors.varianceReason?.message}
                    </FieldError>
                  </div>
                ) : null}
              </section>

              {/* Shift notes */}
              <section
                className="
                  rounded-2xl border border-border/80
                  bg-white p-4
                  shadow-[0_3px_12px_rgba(36,26,19,0.04)]
                "
              >
                <div className="mb-3 flex items-start gap-3">
                  <span
                    className="
                      flex h-9 w-9 shrink-0 items-center
                      justify-center rounded-xl bg-muted
                      text-muted-foreground
                    "
                  >
                    <StickyNote
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <p className="text-xs font-black text-foreground">
                      Shift notes
                    </p>

                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                      Add handoff details or explain unusual
                      transactions.
                    </p>
                  </div>
                </div>

                <Label htmlFor="settlement-notes">
                  Cashier notes
                  <span className="ml-1 font-medium text-muted-foreground">
                    (optional)
                  </span>
                </Label>

                <CashierTextarea
                  id="settlement-notes"
                  placeholder="Record handoff notes, exceptions, or supporting details"
                  className="min-h-24 resize-none"
                  aria-invalid={Boolean(errors.notes)}
                  {...register("notes")}
                />

                <FieldError>
                  {errors.notes?.message}
                </FieldError>
              </section>

              {/* Manager approval */}
              <section
                className="
                  rounded-2xl border border-primary/15
                  bg-[#fffaf5] p-4
                  shadow-[0_3px_12px_rgba(36,26,19,0.04)]
                "
              >
                <div className="flex items-start gap-3">
                  <span
                    className="
                      flex h-9 w-9 shrink-0 items-center
                      justify-center rounded-xl
                      bg-primary/10 text-primary
                    "
                  >
                    <ShieldCheck
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <p className="text-xs font-black text-foreground">
                      Manager approval
                    </p>

                    <p className="mt-1 text-[10px] font-medium leading-4 text-muted-foreground">
                      A manager must review and approve the settlement
                      before the shift can be closed.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="manager-name">
                    Approving manager
                  </Label>

                  <CashierInput
                    id="manager-name"
                    placeholder="Enter manager full name"
                    autoComplete="off"
                    aria-invalid={Boolean(errors.managerName)}
                    {...register("managerName")}
                  />

                  <FieldError>
                    {errors.managerName?.message}
                  </FieldError>
                </div>

                <label
                  className="
                    mt-3 flex cursor-pointer items-start gap-3
                    rounded-xl border border-transparent
                    bg-white/80 p-3
                    text-xs font-semibold leading-5
                    transition
                    hover:border-primary/15 hover:bg-white
                  "
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                    {...register("managerApproved")}
                  />

                  <span>
                    I confirm that the manager reviewed the expected
                    cash, actual count, variance, and supporting
                    notes.
                  </span>
                </label>

                <FieldError>
                  {errors.managerApproved?.message}
                </FieldError>
              </section>
            </div>

            {/* Fixed footer */}
            <DialogFooter
              className="
                shrink-0 gap-2 border-t border-border/80
                bg-[#fffdf9]
                shadow-[0_-8px_24px_rgba(36,26,19,0.05)]
              "
              style={{
                padding: "14px 24px",
              }}
            >
              <CashierButton
                type="button"
                variant="secondary"
                className="w-full sm:w-auto sm:min-w-[130px]"
                disabled={loading}
                onClick={closeDialog}
              >
                Review later
              </CashierButton>

              <CashierButton
                type="submit"
                variant="danger"
                className="w-full sm:w-auto sm:min-w-[190px]"
                loading={loading}
                loadingLabel="Closing shift…"
                disabled={
                  loading ||
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
          if (!value && !loading) {
            setReviewValues(undefined);
          }
        }}
        title={`End shift as ${outcome}?`}
        description={`Expected ${formatMoney(
          totals.expectedCash,
        )}, actual ${formatMoney(
          actual,
        )}, variance ${formatMoney(
          variance,
        )}. Approved by ${
          managerName || "manager"
        }. This closes the drawer and blocks new transactions until another shift starts.`}
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