import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Toast } from "../components";
import type {
  CashierAttentionFilter,
  CashierNavigationIntent,
  CashierPageId,
  CashierQueueView,
  Order,
  ShiftClosureInput,
} from "../types";
import { useCashierStore } from "../hooks/CashierStore";
import { useCashierDashboard } from "../hooks/useCashierDashboard";
import { OrderDetailsDrawer } from "../orders/OrderDetailsDrawer";
import { VerifyPaymentDialog } from "../payments/VerifyPaymentDialog";
import { EndShiftDialog } from "../shifts/EndShiftDialog";
import { AttentionSummary } from "./AttentionSummary";
import { CashierWorkQueue } from "./CashierWorkQueue";
import { CashierDashboardSkeleton } from "./CashierDashboardSkeleton";
import { CompactShiftHeader } from "./CompactShiftHeader";
import { OrderLookupDialog } from "./OrderLookupDialog";
import { PrimaryCashierActions } from "./PrimaryCashierActions";
import { RecentReceiptsDialog } from "./RecentReceiptsDialog";

export function CashierDashboardPage({
  onNavigate,
}: {
  onNavigate: (
    page: CashierPageId,
    intent?: CashierNavigationIntent,
  ) => void;
}) {
  const {
    state,
    isHydrating,
    activeShift,
    shiftTotals,
    endShift,
    verifyPayment,
    releaseReadyOrder,
  } = useCashierStore();

  const { session } = useAuth();

  const { actionQueue, shiftSummary, attention } =
    useCashierDashboard();
  const currentShiftSummary = {
  ...shiftSummary,
  cashierName:
    session?.name?.trim() ||
    shiftSummary.cashierName,
};
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const [verificationOrder, setVerificationOrder] =
    useState<Order>();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string>();

  const [queueView, setQueueView] =
    useState<CashierQueueView>("action_required");

  const [attentionFilter, setAttentionFilter] =
    useState<CashierAttentionFilter>();

  if (isHydrating) {
    return <CashierDashboardSkeleton />;
  }

  const handleEndShift = async (input: ShiftClosureInput) => {
    setSettling(true);

    try {
      await endShift(input);

      Toast.success("Shift closed and settlement recorded", {
        description:
          input.actualCash === shiftTotals.expectedCash
            ? "The drawer is balanced."
            : "The approved variance and reason were recorded.",
      });

      setSettlementOpen(false);
      onNavigate("shift-settlement");
    } catch (caught) {
      Toast.error("Unable to close the shift", {
        description:
          caught instanceof Error
            ? caught.message
            : "Review the drawer count and try again.",
      });
    } finally {
      setSettling(false);
    }
  };

  const handleAttentionFilter = (
    filter: CashierAttentionFilter,
  ) => {
    setQueueView("action_required");
    setAttentionFilter(filter);
  };

  const handleQueueViewChange = (view: CashierQueueView) => {
    setQueueView(view);
    setAttentionFilter(undefined);
  };

  const handleVerifyPayment = async (override: boolean) => {
    if (!verificationOrder?.paymentId) return;

    const orderId = verificationOrder.id;
    setLoadingOrderId(orderId);

    try {
      await verifyPayment(
        verificationOrder.paymentId,
        override,
      );

      Toast.success(`Payment verified for ${orderId}`, {
        description:
          "The order was released to the kitchen queue.",
      });

      setVerificationOrder(undefined);
    } catch (caught) {
      Toast.error("Verification failed", {
        description:
          caught instanceof Error
            ? caught.message
            : "Review the payment and try again.",
      });
    } finally {
      setLoadingOrderId(undefined);
    }
  };

  const handleReleaseOrder = async (order: Order) => {
    setLoadingOrderId(order.id);

    try {
      await releaseReadyOrder(order.id);

      Toast.success(`${order.id} released`, {
        description:
          order.type === "Delivery"
            ? "The order moved to the rider queue."
            : "The handoff was completed.",
      });
    } catch (caught) {
      Toast.error("Unable to release the order", {
        description:
          caught instanceof Error
            ? caught.message
            : "Refresh the queue and try again.",
      });
    } finally {
      setLoadingOrderId(undefined);
    }
  };

  const verificationPayment = state.payments.find(
    (payment) =>
      payment.id === verificationOrder?.paymentId,
  );

  return (
    <>
      <main
        className="
          cashier-page cashier-dashboard-page
          mx-auto flex w-full max-w-[1600px]
          flex-col gap-3 pb-5
          sm:gap-4
        "
      >
      <CompactShiftHeader
        summary={currentShiftSummary}
        onEndShift={() => setSettlementOpen(true)}
      />

        <PrimaryCashierActions
          attention={attention}
          shiftActive={shiftSummary.isActive}
          onNewOrder={() => onNavigate("walkin-pos")}
          onVerifyPayments={() =>
            handleAttentionFilter("payments")
          }
          onReleaseOrders={() =>
            handleAttentionFilter("ready")
          }
          onSearchOrder={() => setLookupOpen(true)}
          onReprintReceipt={() => setReceiptsOpen(true)}
        />

        <AttentionSummary
          attention={attention}
          onFilter={handleAttentionFilter}
        />

        <CashierWorkQueue
          items={actionQueue}
          attention={attention}
          view={queueView}
          attentionFilter={attentionFilter}
          orders={state.orders}
          actionsEnabled={shiftSummary.isActive}
          loadingOrderId={loadingOrderId}
          onViewChange={handleQueueViewChange}
          onClearAttentionFilter={() =>
            setAttentionFilter(undefined)
          }
          onSelect={setSelectedOrder}
          onVerify={setVerificationOrder}
          onRelease={handleReleaseOrder}
        />
      </main>

      <OrderLookupDialog
        open={lookupOpen}
        onOpenChange={setLookupOpen}
        onSelect={setSelectedOrder}
      />

      <RecentReceiptsDialog
        open={receiptsOpen}
        onOpenChange={setReceiptsOpen}
      />

      <OrderDetailsDrawer
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(undefined);
          }
        }}
      />

      <VerifyPaymentDialog
        open={Boolean(verificationOrder)}
        order={verificationOrder}
        payment={verificationPayment}
        payments={state.payments}
        loading={
          loadingOrderId === verificationOrder?.id
        }
        onOpenChange={(open) => {
          if (!open) {
            setVerificationOrder(undefined);
          }
        }}
        onConfirm={handleVerifyPayment}
      />

      {activeShift ? (
        <EndShiftDialog
          open={settlementOpen}
          loading={settling}
          totals={shiftTotals}
          pendingPaymentCount={
            shiftSummary.pendingPaymentCount
          }
          onOpenChange={setSettlementOpen}
          onConfirm={handleEndShift}
        />
      ) : null}
    </>
  );
}