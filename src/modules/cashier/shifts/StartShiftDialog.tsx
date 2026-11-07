import { useEffect, useRef, useState } from "react";
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
  const submittingRef = useRef(false);
  const wasOpenRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = loading || submitting;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StartShiftForm, unknown, { openingCash: number; terminal: string }>({
    resolver: zodResolver(startShiftSchema),
    defaultValues: { openingCash: "", terminal: defaultTerminal },
  });
  useEffect(() => {
    if (open && !wasOpenRef.current) reset({ openingCash: "", terminal: defaultTerminal });
    wasOpenRef.current = open;
  }, [open, defaultTerminal, reset]);

  const submit = handleSubmit(async ({ openingCash, terminal }) => {
    if (submittingRef.current || busy) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm(openingCash, terminal);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          onOpenChange(value);
          if (!value) reset({ openingCash: "", terminal: defaultTerminal });
        }
      }}
    >
      <CashierDialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start cashier shift</DialogTitle>
          <DialogDescription>
            Count the cash already in the drawer for making change, then record
            that opening amount for {cashierName}. The start time is recorded automatically.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={submit}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="opening-cash">Opening Cash (₱)</Label>
            <CashierInput
              id="opening-cash"
              type="text"
              inputMode="decimal"
              placeholder="Enter counted opening cash"
              autoFocus
              aria-required="true"
              aria-invalid={Boolean(errors.openingCash)}
              aria-describedby="opening-cash-help"
              {...register("openingCash")}
            />
            <p id="opening-cash-help" className="mt-1 text-xs text-muted-foreground">
              Include the physical cash float already in this drawer. Enter ₱0 if it starts empty.
            </p>
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
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </CashierButton>
            <CashierButton type="submit" loading={busy} disabled={busy}>
              {busy ? "Starting shift..." : "Start shift"}
            </CashierButton>
          </DialogFooter>
        </form>
      </CashierDialogContent>
    </Dialog>
  );
}
