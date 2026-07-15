import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatMoney } from "../constants";
import { CashierButton, CashierDialogContent } from "../components";

export function PlaceOrderDialog({
  open,
  loading,
  itemCount,
  orderType,
  total,
  paymentMethod,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  itemCount: number;
  orderType: string;
  total: number;
  paymentMethod: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) onOpenChange(value);
      }}
    >
      <CashierDialogContent>
        <DialogHeader>
          <DialogTitle>Place this walk-in order?</DialogTitle>
          <DialogDescription>
            Confirm the final order before recording payment and sending the
            ticket to the kitchen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs">
          <div>
            <p className="text-muted-foreground">Order type</p>
            <p className="mt-1 font-black">{orderType}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Items</p>
            <p className="mt-1 font-black">{itemCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment</p>
            <p className="mt-1 font-black">{paymentMethod}</p>
          </div>
          <div className="col-span-2 flex items-end justify-between border-t border-border pt-3">
            <p className="text-muted-foreground">Total</p>
            <p className="text-lg font-black text-primary">
              {formatMoney(total)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <CashierButton
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Review order
          </CashierButton>
          <CashierButton loading={loading} onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Placing order..." : "Confirm and send to kitchen"}
          </CashierButton>
        </DialogFooter>
      </CashierDialogContent>
    </Dialog>
  );
}
