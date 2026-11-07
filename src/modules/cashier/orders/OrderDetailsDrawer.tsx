import {
  AlertTriangle,
  Banknote,
  Bike,
  ChevronDown,
  ChevronLeft,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
  XCircle,
} from "lucide-react";
import type { ComponentProps } from "react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDateTime,
  formatElapsed,
  formatMoney,
} from "../constants";
import type { Order } from "../types";
import { useCashierStore } from "../hooks/CashierStore";
import { CashierButton, CashierDialogContent, Drawer, StatusBadge, ErrorBanner } from "../components";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { canCancelCashierOrder, getKitchenStatus, getRecordedDeliveryFee, getRiderStatus, matchesOrderListView, presentTimelineActor } from "./orderOperations";
import { OrderDetailInfo } from "./OrderDetailInfo";
import { useOrderDetailsDrawer } from "./useOrderDetailsDrawer";

export function OrderDetailsDrawer({
  order,
  open,
  onOpenChange,
  onFindReceipt,
  findingReceipt = false,
  onCloseAutoFocus,
}: {
  order?: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFindReceipt?: (order: Order) => void;
  findingReceipt?: boolean;
  onCloseAutoFocus?: ComponentProps<typeof Drawer>["onCloseAutoFocus"];
}) {
  const drawer = useOrderDetailsDrawer(order, open);
  const { state } = useCashierStore();
  if (!drawer.currentOrder) return null;
  const { currentOrder, payment, delayed } = drawer;
  const older = matchesOrderListView(currentOrder, "older", Date.now());
  const createdAtValid = Number.isFinite(new Date(currentOrder.createdAt).getTime());
  const deliveryFee = getRecordedDeliveryFee(currentOrder);
  const paymentStatus = currentOrder.paymentStatus === "Unknown"
    ? payment?.status ?? "Unknown"
    : currentOrder.paymentStatus;
  const paymentMethod = currentOrder.paymentStatus === "Unknown"
    ? payment?.method ?? currentOrder.paymentMethod
    : currentOrder.paymentMethod;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} onCloseAutoFocus={onCloseAutoFocus} className="flex flex-col">
        <DialogHeader className="sticky top-0 z-10 border-b border-border/80 bg-white/95 px-4 py-3.5 pr-14 shadow-[0_4px_14px_rgba(36,26,19,0.05)] backdrop-blur-xl sm:px-5">
          <DialogClose asChild>
            <CashierButton variant="ghost" className="min-h-11 self-start px-2">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back to orders
            </CashierButton>
          </DialogClose>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-mono text-lg font-black text-primary">
              {currentOrder.id}
            </DialogTitle>
            <StatusBadge status={currentOrder.status} />
            {!older && delayed ? (
              <span className="cashier-status-badge inline-flex min-h-6 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700 shadow-[0_1px_2px_rgba(36,26,19,0.03)]">
                <AlertTriangle className="h-3 w-3" /> Overdue · {formatElapsed(currentOrder.createdAt)} old
              </span>
            ) : null}
          </div>
          {older ? (
            <p className="text-xs font-medium text-amber-800/80">
              Older unresolved · {createdAtValid ? `${formatElapsed(currentOrder.createdAt)} old` : "Date unavailable"}
            </p>
          ) : null}
          <DialogDescription>
            Created {createdAtValid ? formatDateTime(currentOrder.createdAt) : "Date unavailable"} ·{" "}
            {currentOrder.type}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
          {drawer.error ? <ErrorBanner message={drawer.error} /> : null}
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
                {deliveryFee !== undefined && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery fee</span>
                    <span>{formatMoney(deliveryFee)}</span>
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

          <section className="rrj-card grid gap-4 p-4 sm:grid-cols-2">
            <OrderDetailInfo
              icon={UserRound}
              label="Customer"
              value={currentOrder.customerName}
            />
            {currentOrder.contactNumber.trim() && currentOrder.contactNumber.trim() !== "—" ? (
              <OrderDetailInfo
                icon={Phone}
                label="Contact"
                value={currentOrder.contactNumber}
              />
            ) : null}
            {currentOrder.deliveryAddress && (
              <OrderDetailInfo
                icon={MapPin}
                label="Delivery address"
                value={currentOrder.deliveryAddress}
                wide
              />
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rrj-card p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Payment
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {paymentStatus === "Unknown" ? (
                  <span className="text-sm font-semibold text-amber-800" role="status">
                    {drawer.paymentLookup === "loading" ? "Checking payment record…" : "Payment status unavailable"}
                  </span>
                ) : (
                  <>
                    <Banknote className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-sm font-bold">{paymentMethod}</span>
                    <StatusBadge status={paymentStatus} />
                  </>
                )}
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
                Kitchen status
              </p>
              <p className="mt-3 text-sm font-bold">
                {currentOrder.status === "Confirmed" ? "Confirmed" : getKitchenStatus(currentOrder)}
              </p>
              {currentOrder.type === "Delivery" ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Bike className="h-4 w-4" aria-hidden="true" />
                  {getRiderStatus(currentOrder)}
                </p>
              ) : null}
              {currentOrder.type === "Delivery" &&
                currentOrder.riderAssignmentKnown === false ? (
                  <CashierButton
                    variant="secondary"
                    className="mt-2"
                    onClick={drawer.refreshAssignmentStatus}
                  >
                    Refresh assignment status
                  </CashierButton>
                ) : null}
            </div>
          </section>

          <details key={`${currentOrder.id}:${open}`} className="group rrj-card p-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 text-primary transition-transform group-open:rotate-180" aria-hidden="true" />
              Activity history · {currentOrder.timeline.length} events
            </summary>
            <ol className="relative mt-3 space-y-4 border-l border-border pl-5">
              {[...currentOrder.timeline].reverse().map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-amber-50" />
                  <p className="text-sm font-bold text-foreground">
                    {event.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground" title={presentTimelineActor(event.actor, state.cashier.id, state.cashier.name).technicalId}>
                    {formatDateTime(event.timestamp)} · {presentTimelineActor(event.actor, state.cashier.id, state.cashier.name).label}
                  </p>
                </li>
              ))}
            </ol>
          </details>

          <div className="sticky bottom-0 -mx-4 -mb-4 mt-auto flex flex-wrap gap-2 border-t border-border/80 bg-[#f8f4ef]/95 px-4 py-3 backdrop-blur-xl sm:-mx-5 sm:-mb-5 sm:justify-end sm:px-5">
            {onFindReceipt ? (
              <CashierButton variant="secondary" loading={findingReceipt} disabled={findingReceipt || !currentOrder.databaseId}
                onClick={() => onFindReceipt(currentOrder)}>
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                Find receipt
              </CashierButton>
            ) : null}
            {currentOrder.status === "Ready" && !(currentOrder.type === "Delivery" && currentOrder.orderChannel === "online") && (
              <CashierButton
                loading={drawer.loading}
                disabled={drawer.loading || Boolean(drawer.releaseUnavailableReason)}
                title={drawer.releaseUnavailableReason}
                onClick={() => drawer.setReleaseOpen(true)}
              >
                Release ready order
              </CashierButton>
            )}
            {currentOrder.status === "Ready" && !(currentOrder.type === "Delivery" && currentOrder.orderChannel === "online") && drawer.releaseUnavailableReason ? (
              <p className="self-center text-xs font-semibold text-amber-900" role="status">
                {drawer.releaseUnavailableReason}
              </p>
            ) : null}

            {currentOrder.databaseId &&
              currentOrder.type === "Delivery" &&
              currentOrder.status === "Waiting for Rider" && (
                <CashierButton
                  loading={drawer.loading}
                  disabled={drawer.loading || !drawer.offerAllowed}
                  onClick={drawer.handleOfferNextRider}
                >
                  <Bike className="h-4 w-4" />
                  Offer to next rider
                </CashierButton>
              )}

            {canCancelCashierOrder(currentOrder) && (
              <CashierButton
                variant="danger"
                className="bg-none bg-red-50 text-red-700 shadow-none hover:bg-red-100"
                disabled={drawer.loading}
                onClick={() => drawer.setCancelOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                Cancel order
              </CashierButton>
            )}
          </div>
        </div>
      </Drawer>
      <Dialog open={drawer.releaseOpen} onOpenChange={(value) => {
        if (!drawer.loading) drawer.setReleaseOpen(value);
      }}>
        <CashierDialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Release {currentOrder.id}?</DialogTitle>
            <DialogDescription>
              Confirm that the ready order has been handed off.
              {currentOrder.type === "Delivery"
                ? " Delivery will move to Waiting for Rider and the system will offer it to a rider."
                : " This will mark the order Completed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <CashierButton variant="secondary" disabled={drawer.loading} onClick={() => drawer.setReleaseOpen(false)}>
              Keep ready
            </CashierButton>
            <CashierButton loading={drawer.loading} disabled={Boolean(drawer.releaseUnavailableReason)} onClick={drawer.handleRelease}>
              Confirm handoff
            </CashierButton>
          </DialogFooter>
        </CashierDialogContent>
      </Dialog>
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
