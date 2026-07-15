import { LayoutGrid, ShoppingBasket } from "lucide-react";
import { ConfirmationDialog, ErrorBanner } from "../components";
import { formatMoney } from "../constants";
import { CartCheckoutBar } from "./CartCheckoutBar";
import { CheckoutPanel } from "./CheckoutPanel";
import { MealRecommendations } from "./MealRecommendations";
import { MenuGrid } from "./MenuGrid";
import { ModifierDrawer } from "./ModifierDrawer";
import { NewOrderDialog } from "./NewOrderDialog";
import { POSCart } from "./POSCart";
import { POSOrderHeader } from "./POSOrderHeader";
import { POSQuickActions } from "./POSQuickActions";
import { ReceiptDialog } from "./ReceiptDialog";
import { useWalkInPOSController } from "./useWalkInPOSController";

export function WalkInPOSPage({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const pos = useWalkInPOSController(onDirtyChange);
  const confirmation = getConfirmationCopy(pos.pendingAction?.type);
  const checkoutActive = ["checkout", "processing"].includes(pos.workflowState);

  return (
    <div className="tablet-pos relative flex h-full min-h-0 flex-col overflow-hidden border">
      <POSOrderHeader
        orderType={pos.walkInOrderType}
        busy={pos.loading}
        canCancel={pos.cart.length > 0}
        heldOrders={pos.state.heldOrders}
        onOrderTypeChange={pos.selectOrderType}
        onCancel={pos.requestCancel}
        onReopen={pos.reopenHeld}
      />

      {pos.error ? (
        <div className="p-3 pb-0">
          <ErrorBanner message={pos.error} onRetry={() => pos.setError("")} />
        </div>
      ) : null}

      <div
        className="pos-tablet-switch"
        role="tablist"
        aria-label="Point of sale view"
      >
        <button
          type="button"
          role="tab"
          id="pos-tab-menu"
          aria-controls="pos-panel-menu"
          aria-selected={pos.tabletPane === "menu"}
          onClick={() => pos.setTabletPane("menu")}
          className={pos.tabletPane === "menu" ? "is-active" : ""}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Menu
        </button>
        <button
          type="button"
          role="tab"
          id="pos-tab-order"
          aria-controls="pos-panel-order"
          aria-selected={pos.tabletPane === "order"}
          onClick={() => pos.setTabletPane("order")}
          className={pos.tabletPane === "order" ? "is-active" : ""}
        >
          <ShoppingBasket className="h-4 w-4" aria-hidden="true" />
          Current Cart <span>{pos.itemCount}</span>
          <strong>{formatMoney(pos.total)}</strong>
        </button>
      </div>

      <div className="pos-workspace flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          id="pos-panel-menu"
          role="tabpanel"
          aria-labelledby="pos-tab-menu"
          className={`pos-pane pos-menu-pane min-h-0 min-w-0 flex-1 ${pos.tabletPane === "menu" ? "is-active" : ""}`}
        >
          <MenuGrid
            menuItems={pos.state.menuItems}
            searchRef={pos.menuSearchRef}
            cart={pos.cart}
            category={pos.category}
            search={pos.search}
            recentIds={pos.recentIds}
            recentSearches={pos.recentSearches}
            bestSellerIds={pos.bestSellerIds}
            favoriteIds={pos.favoriteIds}
            onCategoryChange={pos.setCategory}
            onSearchChange={pos.setSearch}
            onCommitSearch={pos.commitSearch}
            onSelect={pos.openCustomize}
            onQuickAdd={pos.addItem}
            onToggleFavorite={pos.toggleFavorite}
          />
        </div>

        <aside
          id="pos-panel-order"
          role="tabpanel"
          aria-labelledby="pos-tab-order"
          className={`pos-pane pos-order-pane w-full shrink-0 flex-col overflow-hidden border-t lg:flex lg:w-[430px] lg:border-t-0 ${pos.tabletPane === "order" ? "is-active flex" : "hidden"}`}
        >
          {pos.workflowState === "customizingItem" && pos.selectedItem ? (
            <ModifierDrawer
              item={pos.selectedItem}
              currentQuantity={pos.currentSelectedQuantity}
              onCancel={pos.closeCustomize}
              onAdd={pos.addCustomizedItem}
            />
          ) : checkoutActive ? (
            <CheckoutPanel
              orderNumber={pos.orderNumber}
              items={pos.cart}
              values={pos.values}
              occupiedTables={pos.occupiedTables}
              optionsOpen={pos.optionsOpen}
              subtotal={pos.subtotal}
              discountAmount={pos.discountAmount}
              taxAmount={pos.taxAmount}
              taxEnabled={pos.taxEnabled}
              total={pos.total}
              tendered={pos.tendered}
              register={pos.register}
              errors={pos.errors}
              canPlace={pos.canPlace}
              disabledReason={pos.disabledReason}
              shiftOpen={Boolean(pos.activeShift)}
              loading={pos.loading}
              confirmRef={pos.confirmOrderRef}
              onOptionsOpenChange={pos.setOptionsOpen}
              onTenderedChange={pos.setTendered}
              onBack={pos.backToCart}
              onConfirm={pos.submitOrder}
            />
          ) : (
            <>
              <POSCart
                items={pos.cart}
                orderNumber={pos.orderNumber}
                orderType={pos.walkInOrderType}
                onAdjust={pos.adjust}
                onQuantityChange={pos.setLineQuantity}
                onRemove={pos.requestRemove}
                onDuplicate={pos.duplicate}
                onNoteChange={pos.note}
                onReorder={pos.reorder}
                onClear={() => pos.setPendingAction({ type: "clear" })}
              />
              {pos.cart.length ? (
                <MealRecommendations
                  recommendations={pos.mealRecommendations}
                  onAdd={pos.addItem}
                />
              ) : null}
              <CartCheckoutBar
                subtotal={pos.subtotal}
                discountAmount={pos.discountAmount}
                total={pos.total}
                itemCount={pos.itemCount}
                checkoutRef={pos.checkoutRef}
                onCheckout={pos.openCheckout}
              />
            </>
          )}
        </aside>
      </div>

      <POSQuickActions
        busy={pos.loading}
        hasItems={pos.cart.length > 0}
        onAction={pos.runQuickAction}
      />

      <NewOrderDialog
        open={pos.newOrderOpen}
        busy={pos.loading}
        onOpenChange={pos.setNewOrderOpen}
        onHold={() => void pos.handleHold()}
        onDiscard={pos.resetPOS}
      />
      <ReceiptDialog
        order={pos.receiptOrder}
        payment={pos.receiptPayment}
        open={Boolean(pos.receiptOrder)}
        placed
        onClose={pos.closeReceipt}
      />
      <ConfirmationDialog
        open={Boolean(pos.pendingAction)}
        onOpenChange={(open) => {
          if (!open) pos.setPendingAction(undefined);
        }}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel="Keep current order"
        danger={pos.pendingAction?.type !== "reopen"}
        onConfirm={pos.confirmPendingAction}
      />
    </div>
  );
}

function getConfirmationCopy(type?: "clear" | "cancel" | "remove" | "reopen") {
  if (type === "reopen") {
    return {
      title: "Replace the current order?",
      description:
        "The active cart will be replaced by the selected held order.",
      confirmLabel: "Replace cart",
    };
  }
  if (type === "remove") {
    return {
      title: "Remove the final item?",
      description: "This will leave the current cart empty.",
      confirmLabel: "Remove item",
    };
  }
  if (type === "clear") {
    return {
      title: "Clear the entire cart?",
      description: "All items, notes, and checkout details will be removed.",
      confirmLabel: "Clear cart",
    };
  }
  return {
    title: "Cancel this draft order?",
    description:
      "This order has not been submitted. Cancelling will discard the draft without creating a void record.",
    confirmLabel: "Cancel draft",
  };
}
