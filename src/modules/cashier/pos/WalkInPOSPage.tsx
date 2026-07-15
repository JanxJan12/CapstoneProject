import { ConfirmationDialog, ErrorBanner } from "../components";
import { CartPanel } from "./CartPanel";
import { MenuGrid } from "./MenuGrid";
import { ModifierDrawer } from "./ModifierDrawer";
import { NewOrderDialog } from "./NewOrderDialog";
import { OrderSummaryPanel } from "./OrderSummaryPanel";
import { PaymentPanel } from "./PaymentPanel";
import { POSOrderHeader } from "./POSOrderHeader";
import { POSQuickActions } from "./POSQuickActions";
import { ReceiptPanel } from "./ReceiptPanel";
import { RightPanelState } from "./types";
import { useWalkInPOSController } from "./useWalkInPOSController";

export function WalkInPOSPage({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const pos = useWalkInPOSController(onDirtyChange);
  const confirmation = getConfirmationCopy(pos.pendingAction?.type);

  const rightPanel = pos.selectedItem ? (
    <ModifierDrawer
      item={pos.selectedItem}
      currentQuantity={pos.currentSelectedQuantity}
      onCancel={pos.closeCustomize}
      onAdd={pos.addCustomizedItem}
    />
  ) : pos.rightPanelState === RightPanelState.SUMMARY ? (
    <OrderSummaryPanel
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
      canContinue={pos.canContinueToPayment}
      disabledReason={pos.summaryDisabledReason}
      register={pos.register}
      errors={pos.errors}
      onOptionsOpenChange={pos.setOptionsOpen}
      onBack={pos.backToCart}
      onContinue={pos.continueToPayment}
    />
  ) : pos.rightPanelState === RightPanelState.PAYMENT ? (
    <PaymentPanel
      orderNumber={pos.orderNumber}
      subtotal={pos.subtotal}
      discountAmount={pos.discountAmount}
      taxAmount={pos.taxAmount}
      taxEnabled={pos.taxEnabled}
      total={pos.total}
      paymentMethod={pos.values.paymentMethod}
      tendered={pos.tendered}
      register={pos.register}
      errors={pos.errors}
      canPlace={pos.canPlace}
      disabledReason={pos.disabledReason}
      shiftOpen={Boolean(pos.activeShift)}
      loading={pos.loading}
      confirmRef={pos.confirmOrderRef}
      submitLabel="Confirm Order"
      onTenderedChange={pos.setTendered}
      onBackToSummary={pos.backToSummary}
      onConfirm={pos.submitOrder}
    />
  ) : pos.rightPanelState === RightPanelState.RECEIPT && pos.receiptOrder ? (
    <ReceiptPanel
      order={pos.receiptOrder}
      payment={pos.receiptPayment}
      transaction={pos.receiptTransaction}
      printed={pos.receiptPrinted}
      onPrint={pos.printReceipt}
      onNewOrder={pos.closeReceipt}
    />
  ) : (
    <CartPanel
      items={pos.cart}
      orderNumber={pos.orderNumber}
      orderType={pos.walkInOrderType}
      subtotal={pos.subtotal}
      discountAmount={pos.discountAmount}
      total={pos.total}
      itemCount={pos.itemCount}
      recommendations={pos.mealRecommendations}
      checkoutRef={pos.checkoutRef}
      onAdjust={pos.adjust}
      onQuantityChange={pos.setLineQuantity}
      onRemove={pos.requestRemove}
      onDuplicate={pos.duplicate}
      onNoteChange={pos.note}
      onReorder={pos.reorder}
      onClear={() => pos.setPendingAction({ type: "clear" })}
      onAddRecommendation={pos.addItem}
      onCheckout={pos.openCheckout}
    />
  );

  return (
    <div className="tablet-pos relative flex h-full min-h-0 flex-col overflow-hidden border">
      <POSOrderHeader
        orderType={pos.walkInOrderType}
        busy={pos.loading || pos.rightPanelState === RightPanelState.RECEIPT}
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

      <div className="pos-workspace flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          id="pos-panel-menu"
          className="pos-pane pos-menu-pane min-h-0 min-w-0 flex-1"
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
          aria-label="Current order workspace"
          data-state={pos.selectedItem ? "customize" : pos.rightPanelState}
          className="pos-pane pos-order-pane flex w-full shrink-0 flex-col overflow-hidden border-t lg:w-[430px] lg:border-t-0"
        >
          <div
            key={pos.selectedItem ? "customize" : pos.rightPanelState}
            className="pos-panel-stage flex min-h-0 flex-1 flex-col"
          >
            {rightPanel}
          </div>
        </aside>
      </div>

      <POSQuickActions
        busy={pos.loading || pos.rightPanelState === RightPanelState.RECEIPT}
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
