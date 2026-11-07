import { useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "../constants";
import type { Order, Payment } from "../types";
import { CashierButton, CashierDialogContent } from "../components";

export function VerifyPaymentDialog({
  open,
  order,
  payment,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  order?: Order;
  payment?: Payment;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const confirming = useRef(false);

  const handleOpenChange = (value: boolean) => {
    if (loading || confirming.current) return;
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!open || loading || confirming.current) return;
    confirming.current = true;
    try {
      await onConfirm();
    } finally {
      confirming.current = false;
    }
  };

  if (!order || !payment) return null;
  const recordedAmountDiffers =
    Math.round(order.total * 100) !== Math.round(payment.amount * 100);
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <CashierDialogContent
        className="max-w-xl sm:max-w-xl [&_[data-slot=dialog-description]]:text-sm [&_[data-slot=dialog-close]]:h-11 [&_[data-slot=dialog-close]]:w-11"
      >
        <DialogHeader>
          <DialogTitle>Verify {order.id}?</DialogTitle>
          <DialogDescription>
            Check the merchant's actual GCash transaction records before verifying.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border/80 bg-muted/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-base font-semibold text-foreground">
            <span>Expected payment amount</span>
            <strong className="text-2xl font-bold tabular-nums text-primary">
              {formatMoney(order.total)}
            </strong>
          </div>
          {recordedAmountDiffers && (
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-base font-semibold text-amber-900">
              <span>Recorded payment amount differs</span>
              <strong className="tabular-nums">{formatMoney(payment.amount)}</strong>
            </div>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <span className="block text-sm font-medium text-muted-foreground">Submitted GCash reference</span>
            <strong className="mt-1 block break-all font-mono text-lg font-bold text-foreground">
              {payment.referenceNumber ?? "Not provided"}
            </strong>
          </div>
        </div>
        <DialogFooter className="border-t border-border/70 pt-4">
          <CashierButton
            size="lg"
            className="min-h-14 w-full text-base sm:w-auto sm:min-w-32"
            variant="secondary"
            disabled={loading}
            onClick={() => handleOpenChange(false)}
          >
            Go back
          </CashierButton>
          <CashierButton
            size="lg"
            className="min-h-14 w-full text-base sm:w-auto sm:min-w-56"
            loading={loading}
            onClick={handleConfirm}
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Verifying..." : "Confirm verification"}
          </CashierButton>
        </DialogFooter>
      </CashierDialogContent>
    </Dialog>
  );
}
