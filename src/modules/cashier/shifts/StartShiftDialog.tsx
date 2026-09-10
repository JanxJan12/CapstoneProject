import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startShiftSchema, type StartShiftForm } from "../schemas";
import {
  CashierButton,
  CashierDialogContent,
  CashierInput,
  FieldError,
  Label,
} from "../components";

export function StartShiftDialog({
  open,
  loading,
  cashierName,
  defaultTerminal,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  cashierName: string;
  defaultTerminal: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (openingCash: number, terminal: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StartShiftForm>({
    resolver: zodResolver(startShiftSchema),
    defaultValues: { openingCash: 4000, terminal: defaultTerminal },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) {
          onOpenChange(value);
          if (!value) reset({ openingCash: 4000, terminal: defaultTerminal });
        }
      }}
    >
      <CashierDialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start cashier shift</DialogTitle>
          <DialogDescription>
            Open a drawer for {cashierName}. The timestamp is recorded
            automatically.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(({ openingCash, terminal }) =>
            onConfirm(openingCash, terminal),
          )}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="opening-cash">Opening cash amount</Label>
            <CashierInput
              id="opening-cash"
              type="number"
              min="0"
              step="0.01"
              autoFocus
              aria-invalid={Boolean(errors.openingCash)}
              {...register("openingCash", { valueAsNumber: true })}
            />
            <FieldError>{errors.openingCash?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="terminal">Terminal</Label>
            <CashierInput
              id="terminal"
              aria-invalid={Boolean(errors.terminal)}
              {...register("terminal")}
            />
            <FieldError>{errors.terminal?.message}</FieldError>
          </div>
          <DialogFooter className="border-t border-border/70 pt-4">
            <CashierButton
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </CashierButton>
            <CashierButton type="submit" loading={loading}>
              {loading ? "Starting shift..." : "Start shift"}
            </CashierButton>
          </DialogFooter>
        </form>
      </CashierDialogContent>
    </Dialog>
  );
}
