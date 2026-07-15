import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bike,
  MapPin,
  Phone,
  Printer,
  ReceiptText,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import {
  CANCELLABLE_STATUSES,
  formatDateTime,
  formatElapsed,
  formatMoney,
  minutesSince,
} from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import type { Order } from "../types";
import {
  CashierButton,
  CashierDialogContent,
  CashierStatusBadge,
  ErrorBanner,
} from "../components/CashierUI";
import { CancelOrderDialog } from "./CancelOrderDialog";

export function OrderDetailsDrawer({
  order,
  open,
  onOpenChange,
}: {
  order?: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, cancelOrder, releaseReadyOrder, recordReceiptReprint } =
    useCashierStore();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!order) return null;
  const currentOrder =
    state.orders.find((entry) => entry.id === order.id) ?? order;
  const payment = state.payments.find(
    (entry) => entry.orderId === currentOrder.id,
  );
  const delayed =
    minutesSince(currentOrder.createdAt) > state.delayedThresholdMinutes &&
    !["Completed", "Cancelled"].includes(currentOrder.status);

  const handleCancel = async (reason: string) => {
    setLoading(true);
    setError("");
    try {
      await cancelOrder(currentOrder.id, reason);
      toast.success(`${currentOrder.id} cancelled`, {
        description: "The order and related transaction records were updated.",
      });
      setCancelOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to cancel the order.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    setLoading(true);
    setError("");
    try {
      await releaseReadyOrder(currentOrder.id);
      toast.success(`${currentOrder.id} released`, {
        description:
          currentOrder.type === "Delivery"
            ? "The order is now waiting for a rider."
            : "The order was completed and handed to the customer.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to release the order.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <CashierDialogContent className="cashier-drawer left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-xl translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-[#f8f4ef] p-0 shadow-[-18px_0_50px_rgba(36,26,19,0.16)] sm:max-w-xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-border bg-white/95 p-5 pr-14 shadow-sm backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="font-mono text-lg font-black text-primary">
                {currentOrder.id}
              </DialogTitle>
              <CashierStatusBadge status={currentOrder.status} />
              {delayed && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-700">
                  <AlertTriangle className="h-3 w-3" /> Delayed ·{" "}
                  {formatElapsed(currentOrder.createdAt)}
                </span>
              )}
            </div>
            <DialogDescription>
              Created {formatDateTime(currentOrder.createdAt)} ·{" "}
              {currentOrder.type}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 p-5">
            {error && <ErrorBanner message={error} />}
            <section className="rrj-card grid gap-4 p-4 sm:grid-cols-2">
              <Info
                icon={UserRound}
                label="Customer"
                value={currentOrder.customerName}
              />
              <Info
                icon={Phone}
                label="Contact"
                value={currentOrder.contactNumber}
              />
              {currentOrder.tableNumber && (
                <Info
                  icon={ReceiptText}
                  label="Table"
                  value={currentOrder.tableNumber}
                />
              )}
              {currentOrder.deliveryAddress && (
                <Info
                  icon={MapPin}
                  label="Delivery address"
                  value={currentOrder.deliveryAddress}
                  wide
                />
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                Order items
              </h3>
              <div className="rrj-card overflow-hidden">
                {currentOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {item.quantity} × {item.name}
                      </p>
                      {item.note && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Note: {item.note}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-black">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="space-y-1 bg-muted/30 px-4 py-3 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatMoney(currentOrder.subtotal)}</span>
                  </div>
                  {currentOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>{currentOrder.discountType} discount</span>
                      <span>−{formatMoney(currentOrder.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-black">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatMoney(currentOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rrj-card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Payment
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">
                    {currentOrder.paymentMethod}
                  </span>
                  <CashierStatusBadge status={currentOrder.paymentStatus} />
                </div>
                {payment?.referenceNumber && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reference:{" "}
                    <strong className="text-foreground">
                      {payment.referenceNumber}
                    </strong>
                  </p>
                )}
                {payment?.verifiedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verified {formatDateTime(payment.verifiedAt)}
                  </p>
                )}
              </div>
              <div className="rrj-card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Kitchen & rider
                </p>
                <p className="mt-3 text-sm font-bold">
                  Kitchen: {currentOrder.status}
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Bike className="h-4 w-4" />
                  {currentOrder.assignedRider ?? "No rider assigned"}
                  {currentOrder.riderStatus
                    ? ` · ${currentOrder.riderStatus}`
                    : ""}
                </p>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                Order timeline
              </h3>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {[...currentOrder.timeline].reverse().map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-amber-50" />
                    <p className="text-sm font-bold text-foreground">
                      {event.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDateTime(event.timestamp)} · {event.actor}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-[#f8f4ef]/95 py-3 backdrop-blur-xl">
              <CashierButton
                variant="secondary"
                onClick={() => {
                  window.print();
                  void recordReceiptReprint(currentOrder.id);
                  toast.success("Receipt sent to the print dialog.");
                }}
                disabled={!currentOrder.transactionId}
              >
                <Printer className="h-4 w-4" />
                Print receipt
              </CashierButton>
              {currentOrder.status === "Ready" && (
                <CashierButton loading={loading} onClick={handleRelease}>
                  Release ready order
                </CashierButton>
              )}
              {CANCELLABLE_STATUSES.includes(currentOrder.status) && (
                <CashierButton
                  variant="danger"
                  disabled={loading}
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel order
                </CashierButton>
              )}
            </div>
          </div>
        </CashierDialogContent>
      </Dialog>
      <CancelOrderDialog
        open={cancelOpen}
        orderId={currentOrder.id}
        loading={loading}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancel}
      />
    </>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  wide,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
