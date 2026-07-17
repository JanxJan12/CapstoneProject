import { ConfirmationDialog, ErrorBanner } from "../components";
import { MenuGrid } from "./MenuGrid";
import { ModifierDrawer } from "./ModifierDrawer";
import { NewOrderDialog } from "./NewOrderDialog";
import { OrderReviewDrawer } from "./OrderReviewDrawer";
import { PaymentPanel } from "./PaymentPanel";
import { POSOrderHeader } from "./POSOrderHeader";
import { ReceiptPanel } from "./ReceiptPanel";
import { TransactionBar } from "./TransactionBar";
import { POSTransactionState } from "./types";
import { useWalkInPOSController } from "./useWalkInPOSController";

export function WalkInPOSPage({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const pos = useWalkInPOSController(onDirtyChange);
  const confirmation = getConfirmationCopy(pos.pendingAction?.type);
  const lastItem = pos.cart.at(-1);
  const lastItemCode = pos.state.menuItems.find(
    (item) => item.id === lastItem?.menuItemId,
  )?.code;
  const drawerOpen =
    Boolean(pos.selectedItem) ||
    pos.transactionState === POSTransactionState.ORDER_REVIEW ||
    pos.transactionState === POSTransactionState.PAYMENT ||
    pos.transactionState === POSTransactionState.RECEIPT;
  const closeDrawer = () => {
    if (pos.selectedItem) pos.closeCustomize();
    else if (pos.transactionState === POSTransactionState.ORDER_REVIEW) {
      pos.backToOrdering();
    } else if (pos.transactionState === POSTransactionState.PAYMENT) {
      pos.backToReview();
    }
  };

  const drawer = pos.selectedItem ? (
    <ModifierDrawer
      item={pos.selectedItem}
      initialLine={pos.editingLine}
      currentQuantity={pos.currentSelectedQuantity}
      onCancel={pos.closeCustomize}
      onAdd={pos.addCustomizedItem}
    />
  ) : pos.transactionState === POSTransactionState.ORDER_REVIEW ? (
    <OrderReviewDrawer
      orderNumber={pos.orderNumber}
      orderType={pos.walkInOrderType}
      items={pos.cart}
      values={pos.values}
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
      onAdjust={pos.adjust}
      onQuantityChange={pos.setLineQuantity}
      onRemove={pos.requestRemove}
      onDuplicate={pos.duplicate}
      onNoteChange={pos.note}
      onCustomize={pos.editLine}
      onReorder={pos.reorder}
      onClear={() => pos.setPendingAction({ type: "clear" })}
      onClose={pos.backToOrdering}
      onContinue={pos.continueToPayment}
    />
  ) : pos.transactionState === POSTransactionState.PAYMENT ? (
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
      submitLabel="Confirm & Send"
      onTenderedChange={pos.setTendered}
      onBackToSummary={pos.backToReview}
      onConfirm={pos.submitOrder}
    />
  ) : pos.transactionState === POSTransactionState.RECEIPT &&
    pos.receiptOrder ? (
    <ReceiptPanel
      order={pos.receiptOrder}
      payment={pos.receiptPayment}
      transaction={pos.receiptTransaction}
      printed={pos.receiptPrinted}
      onPrint={pos.printReceipt}
      onNewOrder={pos.closeReceipt}
    />
  ) : null;

  return (
    <div
      className="tablet-pos relative flex h-full min-h-0 flex-col overflow-hidden border"
      data-transaction-state={pos.transactionState}
    >
      <POSOrderHeader
        orderType={pos.walkInOrderType}
        busy={
          pos.loading || pos.transactionState === POSTransactionState.RECEIPT
        }
        shiftOpen={Boolean(pos.activeShift)}
        hasItems={pos.cart.length > 0}
        canCancel={pos.cart.length > 0}
        heldOrders={pos.state.heldOrders}
        onOrderTypeChange={pos.selectOrderType}
        onNew={() => pos.runQuickAction("new")}
        onHold={() => pos.runQuickAction("hold")}
        onCancel={pos.requestCancel}
        onReopen={pos.reopenHeld}
      />

      {pos.error ? (
        <div className="p-3 pb-0">
          <ErrorBanner message={pos.error} onRetry={() => pos.setError("")} />
        </div>
      ) : null}

      <main className="pos-workspace min-h-0 flex-1">
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
          heldOrderCount={pos.state.heldOrders.length}
          onCategoryChange={pos.setCategory}
          onSearchChange={pos.setSearch}
          onCommitSearch={pos.commitSearch}
          onSelect={pos.openCustomize}
          onQuickAdd={pos.addItem}
          onToggleFavorite={pos.toggleFavorite}
        />
      </main>

      <TransactionBar
        items={pos.cart}
        lastItemCode={lastItemCode}
        itemCount={pos.itemCount}
        total={pos.total}
        state={pos.transactionState}
        busy={
          pos.loading || pos.transactionState === POSTransactionState.RECEIPT
        }
        paymentRef={pos.checkoutRef}
        onAdjust={pos.adjust}
        onUndoLast={pos.undoLastAdd}
        onReview={pos.openOrderReview}
        onPayment={pos.beginPayment}
      />

      {drawerOpen ? (
        <div className="pos-workspace-overlay">
          <button
            type="button"
            aria-label="Close order workspace"
            tabIndex={-1}
            className="pos-workspace-backdrop"
            onClick={
              pos.transactionState === POSTransactionState.RECEIPT
                ? undefined
                : closeDrawer
            }
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={
              pos.selectedItem
                ? `Customize ${pos.selectedItem.name}`
                : pos.transactionState === POSTransactionState.ORDER_REVIEW
                  ? "Review current order"
                  : pos.transactionState === POSTransactionState.PAYMENT
                    ? "Take payment"
                    : "Completed order receipt"
            }
            data-pos-workspace-drawer
            data-state={pos.selectedItem ? "customize" : pos.transactionState}
            className="pos-workspace-drawer"
          >
            <div className="pos-panel-stage flex min-h-0 flex-1 flex-col">
              {drawer}
            </div>
          </aside>
        </div>
      ) : null}

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
        "The active order will be replaced by the selected held order.",
      confirmLabel: "Replace order",
    };
  }
  if (type === "remove") {
    return {
      title: "Remove the final item?",
      description: "This will return the workstation to its idle state.",
      confirmLabel: "Remove item",
    };
  }
  if (type === "clear") {
    return {
      title: "Clear the entire order?",
      description: "All items, notes, and payment details will be removed.",
      confirmLabel: "Clear order",
    };
  }
  return {
    title: "Cancel this draft order?",
    description:
      "This order has not been submitted. Cancelling discards it without creating a void record.",
    confirmLabel: "Cancel draft",
  };
}
