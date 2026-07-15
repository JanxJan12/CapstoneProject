import { useState } from "react";
import { toast } from "sonner";
import type { CashierNavigationIntent, CashierPageId, Order } from "../types";
import { useCashierStore } from "../hooks/CashierStore";
import { OrderDetailsDrawer } from "../orders/OrderDetailsDrawer";
import { EndShiftDialog } from "../shifts/EndShiftDialog";
import { CashierDashboardSkeleton } from "./CashierDashboardSkeleton";
import { CashierMetrics } from "./CashierMetrics";
import { CashierWorkbench } from "./CashierWorkbench";
import { LiveOrderQueue } from "./LiveOrderQueue";
import { OrderLookupDialog } from "./OrderLookupDialog";
import { PendingPaymentBanner } from "./PendingPaymentBanner";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { RecentReceiptsDialog } from "./RecentReceiptsDialog";
import { RestaurantControlLanes } from "./RestaurantControlLanes";
import { ShiftSummaryHero } from "./ShiftSummaryHero";

export function CashierDashboardPage({
  onNavigate,
}: {
  onNavigate: (page: CashierPageId, intent?: CashierNavigationIntent) => void;
}) {
  const { isHydrating, activeShift, shiftTotals, endShift } = useCashierStore();
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settling, setSettling] = useState(false);

  if (isHydrating) return <CashierDashboardSkeleton />;

  const handleEndShift = async (actualCash: number, notes?: string) => {
    setSettling(true);
    try {
      await endShift(actualCash, notes);
      toast.success("Shift closed and settlement recorded", {
        description:
          actualCash === shiftTotals.expectedCash
            ? "The drawer is balanced."
            : "The variance was saved for review.",
      });
      setSettlementOpen(false);
      onNavigate("shift-settlement");
    } catch (caught) {
      toast.error("Unable to close the shift", {
        description:
          caught instanceof Error
            ? caught.message
            : "Review the drawer count and try again.",
      });
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="cashier-page">
      <ShiftSummaryHero onEndShift={() => setSettlementOpen(true)} />
      <PendingPaymentBanner
        onVerify={() => onNavigate("pending-payments")}
      />
      <CashierMetrics onNavigate={onNavigate} />
      <div className="grid gap-4 2xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <LiveOrderQueue onSelect={setSelectedOrder} />
          <RestaurantControlLanes onNavigate={onNavigate} />
        </div>
        <div className="space-y-4">
          <CashierWorkbench
            onNavigate={onNavigate}
            onSearchOrder={() => setLookupOpen(true)}
            onReprintReceipt={() => setReceiptsOpen(true)}
            onEndShift={() => setSettlementOpen(true)}
          />
          <RecentActivityFeed onSelectOrder={setSelectedOrder} />
        </div>
      </div>

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
          if (!open) setSelectedOrder(undefined);
        }}
      />
      {activeShift && (
        <EndShiftDialog
          open={settlementOpen}
          loading={settling}
          totals={shiftTotals}
          onOpenChange={setSettlementOpen}
          onConfirm={handleEndShift}
        />
      )}
    </div>
  );
}
