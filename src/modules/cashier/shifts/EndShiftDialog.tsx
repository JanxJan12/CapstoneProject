import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Banknote,
  XIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CashierButton,
  CashierInput,
  FieldError,
  Label,
} from "../components";
import { formatMoney } from "../constants";
import { fetchClosedShiftHistory } from "../api/closedShiftHistoryApi";
import { fetchOpenCashierShift } from "../api/shiftApi";
import { endShiftSchema, type EndShiftForm } from "../schemas";
import type { ShiftClosureInput, ShiftTotals } from "../types";
import {
  ShiftSummaryItem,
  VarianceIndicator,
} from "./ShiftDialogSummary";
import { cashVariance, getVarianceOutcomeFromAmount } from "./shiftSettlementUtils";
import { inspectShiftClosureOutcome } from "./shiftClosureRecovery";

export function EndShiftDialog({
  open,
  loading,
  shiftId,
  openingCash,
  totals,
  pendingPaymentCount,
  onReviewPayments,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  shiftId: string;
  openingCash: number;
  totals: ShiftTotals;
  pendingPaymentCount: number;
  onReviewPayments?: () => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: ShiftClosureInput) => Promise<void>;
}) {
  const [reviewValues, setReviewValues] = useState<EndShiftForm>();
  const [reviewSnapshot, setReviewSnapshot] = useState<{ shiftId: string; expectedCash: number }>();
  const [closureError, setClosureError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recheckRequired, setRecheckRequired] = useState(false);
  const submittingRef = useRef(false);
  const busy = loading || submitting;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<EndShiftForm>({
    resolver: zodResolver(endShiftSchema),
    defaultValues: {},
  });

  const actual = watch("actualCash");
  const counted = typeof actual === "number" && Number.isFinite(actual);
  const variance = counted ? cashVariance(actual, totals.expectedCash) : undefined;
  const outcome = variance === undefined ? undefined : getVarianceOutcomeFromAmount(variance);
  const reviewedVariance = reviewValues && reviewSnapshot
    ? cashVariance(reviewValues.actualCash, reviewSnapshot.expectedCash)
    : undefined;

  useEffect(() => {
    if (reviewSnapshot && (reviewSnapshot.shiftId !== shiftId ||
      reviewSnapshot.expectedCash !== totals.expectedCash || pendingPaymentCount > 0)) {
      setReviewValues(undefined);
      setReviewSnapshot(undefined);
      setClosureError("Shift totals or payment prerequisites changed. Review the current count again.");
    }
  }, [reviewSnapshot, shiftId, totals.expectedCash, pendingPaymentCount]);

  const resetForm = () => {
    setReviewValues(undefined);
    setReviewSnapshot(undefined);
    if (!recheckRequired) setClosureError("");

    reset({
      actualCash: undefined,
    });
  };

  const closeDialog = () => {
    if (busy) return;

    resetForm();
    onOpenChange(false);
  };

  const submit = handleSubmit((values) => {
    if (pendingPaymentCount > 0 || recheckRequired) return;

    setClosureError("");

    setReviewValues(values);
    setReviewSnapshot({ shiftId, expectedCash: totals.expectedCash });
  });

  const confirmClosure = async () => {
    if (!reviewValues || !reviewSnapshot || submittingRef.current || busy || recheckRequired) return;
    if (pendingPaymentCount > 0 || reviewSnapshot.shiftId !== shiftId ||
      reviewSnapshot.expectedCash !== totals.expectedCash) {
      setReviewValues(undefined);
      setReviewSnapshot(undefined);
      setClosureError("Shift totals or payment prerequisites changed. Review the current count again.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setClosureError("");
    try {
      await onConfirm({
        actualCash: reviewValues.actualCash,
      });
      setReviewValues(undefined);
      setReviewSnapshot(undefined);
      setRecheckRequired(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Shift closure could not be confirmed.";
      setReviewValues(undefined);
      setReviewSnapshot(undefined);
      if (/resolve pending online gcash payments/i.test(message)) {
        setClosureError(`${message} Review Pending Payments, then refresh and review the count again.`);
      } else if (/only an active cashier account|authentication is required|permission denied|not authorized/i.test(message)) {
        setRecheckRequired(true);
        setClosureError("Cashier access could not be confirmed for closure. Refresh your session and check the active shift before any new attempt.");
      } else {
        setRecheckRequired(true);
        setClosureError("Checking whether the server saved this settlement. Do not submit it again yet.");
        try {
          const status = await inspectShiftClosureOutcome(
            shiftId,
            fetchOpenCashierShift,
            () => fetchClosedShiftHistory({}),
          );
          if (status === "still-open") {
            setClosureError(`The server still shows this shift open. Refresh shift data and review the count before another attempt. Original error: ${message}`);
          } else {
            setClosureError(status === "saved-closed"
              ? "The server has a saved closure for this shift. Refresh to view the recorded settlement; do not submit again."
              : "The shift is no longer the active shift, but its closure could not be confirmed here. Refresh and inspect Saved closed shifts before any new action.");
          }
        } catch {
          setClosureError("The settlement outcome could not be checked. Refresh and inspect the active shift and Saved closed shifts before any new action.");
        }
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (busy) return;

          onOpenChange(value);

          if (!value) {
            resetForm();
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <DialogPrimitive.Content
              data-testid="end-shift-dialog"
              className="pointer-events-auto relative flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#fffdf9] shadow-[0_24px_70px_rgba(36,26,19,0.22)] outline-none sm:max-h-[calc(100dvh-2rem)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
          <DialogPrimitive.Close
            className="absolute right-3.5 top-3.5 z-10 rounded-[10px] p-2 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close end shift dialog"
            disabled={busy}
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
          {/* Header */}
          <div
            className="
              shrink-0 border-b border-border/80
              bg-gradient-to-b from-[#fffaf4] to-[#fffdf9]
            "
            style={{
              padding: "16px 52px 14px 18px",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="
                  mt-0.5 flex h-9 w-9 shrink-0
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
                  {reviewValues ? "Review before closing" : "Count and review shift"}
                </DialogTitle>

              <DialogDescription className="max-w-lg leading-5">
                {reviewValues
                  ? "Confirm the count before the server saves this settlement."
                  : "Enter the physical count, then review before closing."}
              </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {reviewValues && reviewSnapshot && reviewedVariance !== undefined ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#fbf8f4] p-4 sm:p-5">
                <p className="text-sm text-muted-foreground">Shift {reviewSnapshot.shiftId.slice(0, 8)}</p>
                <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ShiftSummaryItem label="Expected cash — estimated" value={formatMoney(reviewSnapshot.expectedCash)} />
                    <ShiftSummaryItem label="Actual cash counted" value={formatMoney(reviewValues.actualCash)} />
                  </div>
                  <div className="mt-4 border-t border-border/70 pt-4">
                    <VarianceIndicator
                      variance={reviewedVariance}
                      outcome={getVarianceOutcomeFromAmount(reviewedVariance)}
                    />
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Closing saves this shift’s settlement record. The server rechecks eligibility and final cash figures before confirming.
                </p>
              </div>
              <DialogFooter className="shrink-0 gap-2 border-t border-border/80 bg-[#fffdf9] p-4 sm:p-5">
                <CashierButton
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  autoFocus
                  disabled={busy}
                  onClick={() => {
                    setReviewValues(undefined);
                    setReviewSnapshot(undefined);
                  }}
                >
                  Back to cash count
                </CashierButton>
                <CashierButton
                  type="button"
                  variant="danger"
                  className="w-full sm:w-auto"
                  loading={busy}
                  loadingLabel="Closing shift…"
                  disabled={busy || pendingPaymentCount > 0 || recheckRequired}
                  onClick={() => { void confirmClosure(); }}
                >
                  Confirm and close shift
                </CashierButton>
              </DialogFooter>
            </div>
          ) : (
          <form
            onSubmit={submit}
            noValidate
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {/* Scrollable modal content */}
            <div
              className="
                min-h-0 flex-1 space-y-3
                overflow-y-auto overscroll-contain
                bg-[#fbf8f4]
              "
              style={{
                padding: "14px 18px 16px",
              }}
            >
              {closureError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800" role="alert"><p>{closureError}</p>{recheckRequired ? <button type="button" className="mt-2 min-h-10 underline" onClick={() => window.location.reload()}>Refresh shift data</button> : null}</div> : null}
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
                      Payment review needs attention
                    </p>

                    <p className="mt-1 leading-5 text-red-700">
                      {pendingPaymentCount} payment{pendingPaymentCount === 1 ? " is" : "s are"} awaiting review. Outstanding online payments may prevent shift closure.
                    </p>
                    {onReviewPayments ? <button type="button" className="mt-2 min-h-10 font-bold underline" onClick={onReviewPayments}>Open Pending Payments</button> : null}
                    <details className="mt-1 leading-5">
                      <summary className="w-fit cursor-pointer font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Why can this block closure?</summary>
                      <p className="mt-1">This count is from the Cashier review queue. The server separately checks pending online GCash payments across the restaurant, including other shifts. If you cannot resolve a request, arrange authorized review.</p>
                    </details>
                  </div>
                </div>
              ) : null}

              {/* Shift summary */}
              <section
                className="
                  rounded-2xl border border-border/80
                  bg-white p-3.5
                  shadow-[0_3px_12px_rgba(36,26,19,0.04)]
                "
              >
                <div>
                  <p className="text-xs font-bold text-muted-foreground">
                    Expected Cash — Estimated
                  </p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{formatMoney(totals.expectedCash)}</p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-xs">
                  <ShiftSummaryItem label="Opening cash" value={formatMoney(openingCash)} />
                  <ShiftSummaryItem label="Completed cash receipts" value={formatMoney(totals.cashSales)} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">GCash is excluded from physical drawer cash.</p>
                <details className="mt-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                  <summary className="w-fit cursor-pointer font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">About this estimate and other shift details</summary>
                  <p className="mt-2 leading-5">This is a browser estimate from recorded receipts, not the final settlement. The server checks verified completed Cash payments for this shift and calculates the saved amount at closure. Payment collection and order fulfillment are separate.</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <ShiftSummaryItem label="GCash receipts (separate)" value={formatMoney(totals.gcashSales)} />
                    <ShiftSummaryItem label="Voided receipts" value={formatMoney(totals.voids)} />
                    <ShiftSummaryItem label="Transactions" value={String(totals.transactionCount)} />
                    {totals.refunds > 0 ? <ShiftSummaryItem label="Locally classified refunds" value={formatMoney(totals.refunds)} /> : null}
                    {totals.cashRefunds > 0 ? <ShiftSummaryItem label="Legacy refunded Cash rows" value={formatMoney(totals.cashRefunds)} /> : null}
                  </div>
                </details>
                {totals.cashRefunds > 0 ? <p className="mt-3 text-xs font-semibold text-amber-800" role="note">Legacy locally classified refunded rows affect this estimate. Review the server-saved settlement after closing; this is not a physical cash payout record.</p> : null}
              </section>

              {/* Drawer count */}
              <section
                className="
                  rounded-2xl border border-border/80
                  bg-white p-3.5
                  shadow-[0_3px_12px_rgba(36,26,19,0.04)]
                "
              >
                <Label htmlFor="actual-cash">
                  Actual Cash Counted (₱)
                </Label>

                <CashierInput
                  id="actual-cash"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Enter physical cash count"
                  autoFocus
                  className="mt-1 h-11 text-base font-black"
                  aria-required="true"
                  aria-invalid={Boolean(errors.actualCash)}
                  aria-describedby="actual-cash-help"
                  {...register("actualCash", {
                    valueAsNumber: true,
                  })}
                />
                <p id="actual-cash-help" className="mt-1 text-xs text-muted-foreground">Count all bills and coins, including the opening cash.</p>

                <FieldError>
                  {errors.actualCash?.message}
                </FieldError>

                <div className="mt-3">
                  {variance === undefined || outcome === undefined ? (
                    <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground" role="status">Variance pending count</p>
                  ) : (
                    <VarianceIndicator variance={variance} outcome={outcome} />
                  )}
                </div>

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
                padding: "10px 18px",
              }}
            >
              <CashierButton
                type="button"
                variant="secondary"
                className="w-full sm:w-auto sm:min-w-[130px]"
                disabled={busy}
                onClick={closeDialog}
              >
                Review later
              </CashierButton>

              <CashierButton
                type="submit"
                className="w-full sm:w-auto sm:min-w-[190px]"
                loading={busy}
                loadingLabel="Please wait…"
                disabled={busy || pendingPaymentCount > 0 || recheckRequired}
              >
                Review settlement
              </CashierButton>
            </DialogFooter>
          </form>
          )}
            </DialogPrimitive.Content>
          </div>
        </DialogPortal>
      </Dialog>

    </>
  );
}
