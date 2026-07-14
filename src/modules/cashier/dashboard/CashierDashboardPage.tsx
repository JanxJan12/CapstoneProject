import { useState } from "react";
import type { CashierNavigationIntent, CashierPageId, Order } from "../types";
import { OrderDetailsDrawer } from "../orders/OrderDetailsDrawer";
import { ActivityFeed } from "./ActivityFeed";
import { CashierHero } from "./CashierHero";
import { CashierMetrics } from "./CashierMetrics";
import { CashierWorkbench, RestaurantControlLanes } from "./CashierWorkbench";
import { LiveOrderQueue } from "./LiveOrderQueue";

export function CashierDashboardPage({
  onNavigate,
}: {
  onNavigate: (page: CashierPageId, intent?: CashierNavigationIntent) => void;
}) {
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  return (
    <div className="cashier-page">
      <CashierHero onNavigate={onNavigate} />
      <CashierMetrics />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <CashierWorkbench onNavigate={onNavigate} />
          <RestaurantControlLanes />
        </div>
        <div className="space-y-4">
          <LiveOrderQueue onSelect={setSelectedOrder} />
          <ActivityFeed />
        </div>
      </div>
      <OrderDetailsDrawer
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(undefined);
        }}
      />
    </div>
  );
}
