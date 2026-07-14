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
import { cancellationSchema, type CancellationForm } from "../schemas";
import {
  CashierButton,
  CashierTextarea,
  FieldError,
  Label,
} from "../components/CashierUI";

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
    await onConfirm(values.reason);
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
          <DialogTitle>Cancel {orderId}?</DialogTitle>
          <DialogDescription>
            The order will be retained with its cashier, reason, and
            cancellation timestamp.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="cancel-reason">Cancellation reason</Label>
            <CashierTextarea
              id="cancel-reason"
              autoFocus
              placeholder="Explain why this order is being cancelled"
              {...register("reason")}
            />
            <FieldError>{errors.reason?.message}</FieldError>
          </div>
          <DialogFooter>
            <CashierButton
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Keep order
            </CashierButton>
            <CashierButton type="submit" variant="danger" loading={loading}>
              Confirm cancellation
            </CashierButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
