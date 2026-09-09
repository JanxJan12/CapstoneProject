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
  if (!order || !payment) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) {
          onOpenChange(value);
        }
      }}
    >
      <CashierDialogContent>
        <DialogHeader>
          <DialogTitle>Verify {order.id}?</DialogTitle>
          <DialogDescription>
            Confirm only after manually inspecting the uploaded GCash proof.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Order total</span>
            <strong className="text-foreground">
              {formatMoney(order.total)}
            </strong>
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Recorded payment amount</span>
            <strong className="text-foreground">
              {formatMoney(payment.amount)}
            </strong>
          </div>
          <div className="mt-3 border-t border-border pt-3 text-xs text-amber-900">
            <strong>Proof review: Manual verification required</strong>
            <span className="mt-1 block font-medium">
              Recheck the screenshot, GCash reference, amount shown in the
              proof, and recipient/details before confirming.
            </span>
          </div>
        </div>
        <DialogFooter>
          <CashierButton
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Go back
          </CashierButton>
          <CashierButton
            loading={loading}
            onClick={() => onConfirm()}
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Verifying..." : "Confirm verification"}
          </CashierButton>
        </DialogFooter>
      </CashierDialogContent>
    </Dialog>
  );
}
