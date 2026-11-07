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
import { EndShiftDialog } from "../shifts/EndShiftDialog";
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
  } = useCashierStore();

  const { session } = useAuth();

  const { queue, shiftSummary, attention } =
    useCashierDashboard();
  const currentShiftSummary = {
  ...shiftSummary,
  cashierName:
    session?.name?.trim() ||
    shiftSummary.cashierName,
};
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settling, setSettling] = useState(false);

  const [queueView, setQueueView] = useState<CashierQueueView>("action_required");

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
        description: "Review the server's saved expected cash and variance in Shift Settlement.",
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
      throw caught;
    } finally {
      setSettling(false);
    }
  };

  const handleAttentionFilter = (
    filter: CashierAttentionFilter,
  ) => {
    setQueueView(filter === "delayed" ? "all_active" : "action_required");
    setAttentionFilter(filter);
  };

  const handleQueueViewChange = (view: CashierQueueView) => {
    setQueueView(view);
    setAttentionFilter(undefined);
  };

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
        onEndShift={() => activeShift ? setSettlementOpen(true) : onNavigate("shift-settlement")}
      />

        <PrimaryCashierActions
          attention={attention}
          shiftActive={shiftSummary.isActive}
          onNewOrder={() => onNavigate("walkin-pos")}
          onVerifyPayments={() => onNavigate("pending-payments")}
          onReleaseOrders={() =>
            handleAttentionFilter("ready")
          }
          onSearchOrder={() => setLookupOpen(true)}
          onReprintReceipt={() => setReceiptsOpen(true)}
        />

        <CashierWorkQueue
          queue={queue}
          attention={attention}
          view={queueView}
          attentionFilter={attentionFilter}
          orders={state.orders}
          onViewChange={handleQueueViewChange}
          onClearAttentionFilter={() =>
            setAttentionFilter(undefined)
          }
          onSelect={setSelectedOrder}
          onVerify={(order) =>
            onNavigate("pending-payments", {
              paymentOrderId: order.id,
            })
}
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

      {activeShift ? (
        <EndShiftDialog
          open={settlementOpen}
          loading={settling}
          shiftId={activeShift.id}
          openingCash={activeShift.openingCash}
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
