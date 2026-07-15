import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatMoney } from "../constants";
import type { Order, Payment } from "../types";
import { CashierButton, CashierDialogContent } from "../components/CashierUI";

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
  onConfirm: (override: boolean) => Promise<void>;
}) {
  const [override, setOverride] = useState(false);
  if (!order || !payment) return null;
  const mismatch = payment.amount !== payment.submittedAmount;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) {
          onOpenChange(value);
          if (!value) setOverride(false);
        }
      }}
    >
      <CashierDialogContent>
        <DialogHeader>
          <DialogTitle>Verify {order.id}?</DialogTitle>
          <DialogDescription>
            Confirm that the submitted GCash payment should release this order
            to the kitchen.
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
            <span>Submitted amount</span>
            <strong className={mismatch ? "text-red-700" : "text-foreground"}>
              {formatMoney(payment.submittedAmount)}
            </strong>
          </div>
        </div>
        {mismatch && (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-900">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-primary"
              checked={override}
              onChange={(event) => setOverride(event.target.checked)}
            />
            <span>
              <span className="flex items-center gap-1 font-black">
                <AlertTriangle className="h-4 w-4" />
                Approve amount override
              </span>
              <span className="mt-1 block font-medium">
                I confirmed the discrepancy and take responsibility for
                releasing this order.
              </span>
            </span>
          </label>
        )}
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
            disabled={mismatch && !override}
            onClick={() => onConfirm(override)}
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Verifying..." : "Confirm verification"}
          </CashierButton>
        </DialogFooter>
      </CashierDialogContent>
    </Dialog>
  );
}
