import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_REJECTION_REASONS } from "../constants";
import { rejectionSchema, type RejectionForm } from "../schemas";
import {
  CashierButton,
  CashierDialogContent,
  CashierSelect,
  CashierTextarea,
  FieldError,
  Label,
} from "../components";

export function RejectPaymentDialog({
  open,
  orderId,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  orderId: string;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, notes?: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<RejectionForm>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { reason: "", notes: "" },
  });
  const selectedReason = watch("reason");
  const submit = handleSubmit(async (values) => {
    await onConfirm(values.reason, values.reason === "Other" ? values.notes : undefined);
    reset();
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) {
          onOpenChange(value);
          if (!value) reset();
        }
      }}
    >
      <CashierDialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject payment for {orderId}?</DialogTitle>
          <DialogDescription>
            The customer will receive the rejection reason and can resubmit payment proof.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="rejection-reason">Rejection reason</Label>
            <CashierSelect
              id="rejection-reason"
              autoFocus
              aria-invalid={Boolean(errors.reason)}
              {...register("reason", {
                onChange: (event) => {
                  if (event.target.value !== "Other") {
                    setValue("notes", "");
                    clearErrors("notes");
                  }
                },
              })}
            >
              <option value="">Select a reason</option>
              {PAYMENT_REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </CashierSelect>
            <FieldError>{errors.reason?.message}</FieldError>
          </div>
          {selectedReason === "Other" && (
            <div>
              <Label htmlFor="rejection-notes">Message to customer (required)</Label>
              <CashierTextarea
                id="rejection-notes"
                required
                aria-invalid={Boolean(errors.notes)}
                placeholder="Explain why the payment was rejected and what to resubmit"
                {...register("notes")}
              />
              <FieldError>{errors.notes?.message}</FieldError>
            </div>
          )}
          <DialogFooter className="border-t border-border/70 pt-4">
            <CashierButton
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Go back
            </CashierButton>
            <CashierButton type="submit" variant="danger" loading={loading}>
              {loading ? "Rejecting..." : "Confirm rejection"}
            </CashierButton>
          </DialogFooter>
        </form>
      </CashierDialogContent>
    </Dialog>
  );
}
