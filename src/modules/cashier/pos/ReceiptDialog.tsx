import { Printer } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import { formatDateTime, formatMoney } from "../constants";
import type { Order, Payment } from "../types";
import { CashierButton } from "../components/CashierUI";

export function ReceiptDialog({
  order,
  payment,
  open,
  onClose,
}: {
  order?: Order;
  payment?: Payment;
  open: boolean;
  onClose: () => void;
}) {
  if (!order) return null;
  const change =
    payment?.method === "Cash"
      ? Math.max(0, (payment.submittedAmount ?? 0) - order.total)
      : 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-w-md rounded-[20px] border-border bg-[#fbf8f4] shadow-[0_24px_70px_rgba(36,26,19,0.24)]">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-emerald-700">
            Order placed successfully
          </DialogTitle>
          <DialogDescription>
            {order.id} was sent to the kitchen and recorded in this shift.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_14px_35px_rgba(67,42,23,0.1)]">
          <div className="bg-gradient-to-r from-primary to-orange-600 px-5 py-4 text-center text-white">
            <p className="text-sm font-black uppercase tracking-widest">
              RRJ Food-House
            </p>
            <p className="mt-0.5 text-[10px] text-white/70">
              Official cashier receipt
            </p>
          </div>
          <div className="p-5">
            <div className="mb-3 flex justify-between text-[10px] text-muted-foreground">
              <span>{order.id}</span>
              <span>{formatDateTime(order.createdAt)}</span>
            </div>
            <div className="mb-3 rounded-lg bg-muted/45 px-3 py-2 text-[10px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Customer</span>
                <strong>{order.customerName}</strong>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Order</span>
                <strong>
                  {order.type}
                  {order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
                </strong>
              </div>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-1 text-xs">
                <span className="text-muted-foreground">
                  {item.quantity} × {item.name}
                </span>
                <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
              </div>
            ))}
            {order.discountAmount > 0 && (
              <div className="mt-2 flex justify-between text-xs text-emerald-700">
                <span>{order.discountType} discount</span>
                <strong>−{formatMoney(order.discountAmount)}</strong>
              </div>
            )}
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-black">
              <span>Total</span>
              <span className="text-primary">{formatMoney(order.total)}</span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>{order.paymentMethod}</span>
                <span>
                  {payment?.referenceNumber ??
                    formatMoney(payment?.submittedAmount ?? order.total)}
                </span>
              </div>
              {payment?.method === "Cash" && (
                <div className="mt-1 flex justify-between">
                  <span>Change</span>
                  <span>{formatMoney(change)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <CashierButton
            variant="secondary"
            onClick={() => {
              window.print();
              toast.success("Receipt sent to the print dialog.");
            }}
          >
            <Printer className="h-4 w-4" />
            Print receipt
          </CashierButton>
          <CashierButton onClick={onClose}>Close receipt</CashierButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
