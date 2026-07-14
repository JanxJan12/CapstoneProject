import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { PAYMENT_REJECTION_REASONS } from "../constants";
import { rejectionSchema, type RejectionForm } from "../schemas";
import {
  CashierButton,
  CashierSelect,
  CashierTextarea,
  FieldError,
  Label,
} from "../components/CashierUI";

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
    formState: { errors },
  } = useForm<RejectionForm>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { reason: "", notes: "" },
  });
  const submit = handleSubmit(async (values) => {
    await onConfirm(values.reason, values.notes);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject payment for {orderId}?</DialogTitle>
          <DialogDescription>
            The order will remain out of the kitchen queue and the customer will
            receive the reason.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="rejection-reason">Rejection reason</Label>
            <CashierSelect
              id="rejection-reason"
              autoFocus
              {...register("reason")}
            >
              <option value="">Select a reason</option>
              {PAYMENT_REJECTION_REASONS.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </CashierSelect>
            <FieldError>{errors.reason?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="rejection-notes">Notes (optional)</Label>
            <CashierTextarea
              id="rejection-notes"
              placeholder="Add details that will help the customer resubmit"
              {...register("notes")}
            />
            <FieldError>{errors.notes?.message}</FieldError>
          </div>
          <DialogFooter>
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
      </DialogContent>
    </Dialog>
  );
}
