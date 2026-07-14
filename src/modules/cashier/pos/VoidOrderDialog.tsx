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
import { voidSchema, type VoidForm } from "../schemas";
import {
  CashierButton,
  CashierTextarea,
  FieldError,
  Label,
} from "../components/CashierUI";

export function VoidOrderDialog({
  open,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VoidForm>({
    resolver: zodResolver(voidSchema),
    defaultValues: { reason: "" },
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
          <DialogTitle>Void current order?</DialogTitle>
          <DialogDescription>
            The draft will be retained as a cancelled order with the cashier,
            timestamp, and reason.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async ({ reason }) => {
            await onConfirm(reason);
            reset();
          })}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="void-reason">Void reason</Label>
            <CashierTextarea
              id="void-reason"
              autoFocus
              placeholder="Why is this order being voided?"
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
              Confirm void
            </CashierButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
