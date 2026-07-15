import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatMoney } from "../constants";
import { endShiftSchema, type EndShiftForm } from "../schemas";
import type { ShiftTotals } from "../types";
import {
  CashierButton,
  CashierDialogContent,
  CashierInput,
  CashierTextarea,
  FieldError,
  Label,
} from "../components/CashierUI";

export function EndShiftDialog({
  open,
  loading,
  totals,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  totals: ShiftTotals;
  onOpenChange: (open: boolean) => void;
  onConfirm: (actualCash: number, notes?: string) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<EndShiftForm>({
    resolver: zodResolver(endShiftSchema),
    defaultValues: { actualCash: totals.expectedCash, notes: "" },
  });
  const actual = Number(watch("actualCash") ?? 0);
  const notes = watch("notes");
  const variance = actual - totals.expectedCash;
  useEffect(() => {
    if (variance === 0) clearErrors("notes");
  }, [variance, clearErrors]);
  const submit = handleSubmit(async (values) => {
    if (variance !== 0 && !values.notes?.trim()) {
      setError("notes", {
        message: "Notes are required when variance is not zero.",
      });
      return;
    }
    await onConfirm(values.actualCash, values.notes);
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) {
          onOpenChange(value);
          if (!value) {
            setConfirmed(false);
            reset({ actualCash: totals.expectedCash, notes: "" });
          }
        }
      }}
    >
      <CashierDialogContent>
        <DialogHeader>
          <DialogTitle>End and settle shift</DialogTitle>
          <DialogDescription>
            Enter the physical drawer count and confirm the final settlement.
            New transactions will be blocked after closure.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs">
            <Summary
              label="Expected cash"
              value={formatMoney(totals.expectedCash)}
            />
            <Summary
              label="GCash total"
              value={formatMoney(totals.gcashSales)}
            />
            <Summary
              label="Transactions"
              value={String(totals.transactionCount)}
            />
            <Summary
              label="Orders processed"
              value={String(totals.ordersProcessed)}
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
          <div
            className={`flex justify-between rounded-xl px-4 py-3 text-sm font-black ${variance === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
          >
            <span>Drawer variance</span>
            <span>{formatMoney(variance)}</span>
          </div>
          <div>
            <Label htmlFor="settlement-notes">
              Settlement notes {variance !== 0 ? "(required)" : "(optional)"}
            </Label>
            <CashierTextarea
              id="settlement-notes"
              placeholder={
                variance !== 0 ? "Explain the cash variance" : "Add shift notes"
              }
              aria-invalid={Boolean(errors.notes)}
              {...register("notes")}
            />
            <FieldError>{errors.notes?.message}</FieldError>
          </div>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-3 text-xs font-semibold">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-primary"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I confirm the actual cash count and understand this will close the
              current cashier shift.
            </span>
          </label>
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
              loading={loading}
              disabled={!confirmed || (variance !== 0 && !notes?.trim())}
            >
              {loading ? "Closing shift..." : "Confirm end shift"}
            </CashierButton>
          </DialogFooter>
        </form>
      </CashierDialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-black text-foreground">{value}</p>
    </div>
  );
}
