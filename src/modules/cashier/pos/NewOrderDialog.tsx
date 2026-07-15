import { PauseCircle, RotateCcw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { CashierButton, CashierDialogContent } from "../components";

export function NewOrderDialog({
  open,
  busy,
  onOpenChange,
  onHold,
  onDiscard,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onHold: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <CashierDialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Start a new order?</DialogTitle>
          <DialogDescription>
            Hold this draft to resume it later, or discard it and begin with an
            empty cart.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          <CashierButton variant="secondary" disabled={busy} onClick={onHold}>
            <PauseCircle className="h-4 w-4" aria-hidden="true" /> Hold Draft
          </CashierButton>
          <CashierButton variant="danger" disabled={busy} onClick={onDiscard}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Discard Draft
          </CashierButton>
        </div>
        <CashierButton
          variant="secondary"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Keep Current Order
        </CashierButton>
      </CashierDialogContent>
    </Dialog>
  );
}
