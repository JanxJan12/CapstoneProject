import {
  AlertTriangle,
  Banknote,
  Bike,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CANCELLABLE_STATUSES,
  formatDateTime,
  formatElapsed,
  formatMoney,
} from "../constants";
import type { Order } from "../types";
import { CashierButton, Drawer, StatusBadge, ErrorBanner } from "../components";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { OrderDetailInfo } from "./OrderDetailInfo";
import { useOrderDetailsDrawer } from "./useOrderDetailsDrawer";

export function OrderDetailsDrawer({
  order,
  open,
  onOpenChange,
}: {
  order?: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const drawer = useOrderDetailsDrawer(order);
  if (!drawer.currentOrder) return null;
  const { currentOrder, payment, delayed } = drawer;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-white/95 p-5 pr-14 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-mono text-lg font-black text-primary">
              {currentOrder.id}
            </DialogTitle>
            <StatusBadge status={currentOrder.status} />
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
          {drawer.error ? <ErrorBanner message={drawer.error} /> : null}
          <section className="rrj-card grid gap-4 p-4 sm:grid-cols-2">
            <OrderDetailInfo
              icon={UserRound}
              label="Customer"
              value={currentOrder.customerName}
            />
            <OrderDetailInfo
              icon={Phone}
              label="Contact"
              value={currentOrder.contactNumber}
            />
            {currentOrder.tableNumber && (
              <OrderDetailInfo
                icon={ReceiptText}
                label="Table"
                value={currentOrder.tableNumber}
              />
            )}
            {currentOrder.deliveryAddress && (
              <OrderDetailInfo
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
                <StatusBadge status={currentOrder.paymentStatus} />
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
          {currentOrder.status === "Ready" && (
            <CashierButton
              loading={drawer.loading}
              disabled={drawer.loading}
              onClick={drawer.handleRelease}
            >
              Release ready order
            </CashierButton>
          )}

          {currentOrder.databaseId &&
            currentOrder.type === "Delivery" &&
            currentOrder.status === "Waiting for Rider" && (
              <CashierButton
                loading={drawer.loading}
                disabled={drawer.loading}
                onClick={drawer.handleOfferNextRider}
              >
                <Bike className="h-4 w-4" />
                Offer to next rider
              </CashierButton>
            )}

          {CANCELLABLE_STATUSES.includes(
            currentOrder.status,
          ) && (
            <CashierButton
              variant="danger"
              disabled={drawer.loading}
              onClick={() =>
                drawer.setCancelOpen(true)
              }
            >
              <XCircle className="h-4 w-4" />
              Cancel order
            </CashierButton>
          )}
        </div>
        </div>
      </Drawer>
      <CancelOrderDialog
        open={drawer.cancelOpen}
        orderId={currentOrder.id}
        loading={drawer.loading}
        onOpenChange={drawer.setCancelOpen}
        onConfirm={drawer.handleCancel}
      />
    </>
  );
}
