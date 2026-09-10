import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancellationSchema, type CancellationForm } from "../schemas";
import {
  CashierButton,
  CashierDialogContent,
  CashierTextarea,
  ErrorBanner,
  FieldError,
  Label,
} from "../components";

export function CancelOrderDialog({
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
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [submissionError, setSubmissionError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancellationForm>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: { reason: "" },
  });
  const submit = handleSubmit(async (values) => {
    setSubmissionError("");

    try {
      await onConfirm(values.reason);
      reset();
    } catch (caught) {
      setSubmissionError(
        caught instanceof Error
          ? caught.message
          : "Unable to cancel the order.",
      );
    }
  });

  const handleOpenChange = (value: boolean) => {
    if (!loading) {
      onOpenChange(value);

      if (!value) {
        reset();
        setSubmissionError("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CashierDialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel {orderId}?</DialogTitle>
          <DialogDescription>
            The order will be retained with its cashier, reason, and
            cancellation timestamp.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {submissionError ? <ErrorBanner message={submissionError} /> : null}
          <div>
            <Label htmlFor="cancel-reason">Cancellation reason</Label>
            <CashierTextarea
              id="cancel-reason"
              autoFocus
              aria-invalid={Boolean(errors.reason)}
              placeholder="Explain why this order is being cancelled"
              {...register("reason")}
            />
            <FieldError>{errors.reason?.message}</FieldError>
          </div>
          <DialogFooter className="border-t border-border/70 pt-4">
            <CashierButton
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => handleOpenChange(false)}
            >
              Keep order
            </CashierButton>
            <CashierButton type="submit" variant="danger" loading={loading}>
              Confirm cancellation
            </CashierButton>
          </DialogFooter>
        </form>
      </CashierDialogContent>
    </Dialog>
  );
}
