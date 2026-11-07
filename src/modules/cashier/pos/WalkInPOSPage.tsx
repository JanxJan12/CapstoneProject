import { useEffect, useRef, useState } from "react";
import { CashierButton, ConfirmationDialog, ErrorBanner } from "../components";
import { MenuGrid } from "./MenuGrid";
import { ChoiceDrawer } from "./ChoiceDrawer";
import { NewOrderDialog } from "./NewOrderDialog";
import { OrderTypeGate } from "./OrderTypeGate";
import { PaymentPanel } from "./PaymentPanel";
import { POSOrderHeader } from "./POSOrderHeader";
import { POSOrderSidebar } from "./POSOrderSidebar";
import { ReceiptPanel } from "./ReceiptPanel";
import { TransactionBar } from "./TransactionBar";
import { POSTransactionState } from "./types";
import { useWalkInPOSController } from "./useWalkInPOSController";

export function WalkInPOSPage({
  onDirtyChange,
  onOpenShift,
}: {
  onDirtyChange: (dirty: boolean) => void;
  onOpenShift: () => void;
}) {
  const pos = useWalkInPOSController(onDirtyChange);
  const [orderPanelExpanded, setOrderPanelExpanded] = useState(() => pos.cart.length > 0);
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false);
  const previousCartLength = useRef(pos.cart.length);
  useEffect(() => {
    if (previousCartLength.current === 0 && pos.cart.length > 0) setOrderPanelExpanded(true);
    if (pos.cart.length === 0) setOrderPanelExpanded(false);
    previousCartLength.current = pos.cart.length;
  }, [pos.cart.length]);
  const confirmation = getConfirmationCopy(pos.pendingAction?.type);
  const lastItem = pos.cart.at(-1);
  const lastItemCode = pos.state.menuItems.find(
    (item) => item.id === lastItem?.menuItemId,
  )?.code;
  const drawerOpen =
    Boolean(pos.selectedItem) ||
    pos.transactionState === POSTransactionState.PAYMENT ||
    pos.transactionState === POSTransactionState.RECEIPT;
  const orderTypeGateOpen =
    !pos.orderTypeSelected &&
    pos.transactionState !== POSTransactionState.RECEIPT;
  useEffect(() => {
    if (orderTypeGateOpen) setMobileOrderOpen(false);
  }, [orderTypeGateOpen]);
  const closeDrawer = () => {
    if (pos.selectedItem) pos.closeCustomize();
    else if (pos.transactionState === POSTransactionState.PAYMENT) pos.backToOrdering();
  };

  const drawer = pos.selectedItem ? (
    <ChoiceDrawer
      item={pos.selectedItem}
      initialLine={pos.editingLine}
      currentQuantity={pos.currentSelectedQuantity}
      onCancel={pos.closeCustomize}
      onAdd={pos.addCustomizedItem}
    />
  ) : pos.transactionState === POSTransactionState.PAYMENT ? (
    <PaymentPanel
      orderNumber={pos.orderNumber}
      subtotal={pos.subtotal}
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
      submitLabel="Confirm & Send"
      onTenderedChange={pos.setTendered}
      onBackToOrder={pos.backToOrdering}
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

  if (pos.recoveryStatus || pos.submittingSale) {
    return (
      <section className="mx-auto flex min-h-[320px] max-w-xl flex-col justify-center gap-4 p-6" aria-live="polite">
        <h2 className="text-xl font-bold">{pos.recoveryStatus ? "Checking walk-in sale" : "Submitting walk-in sale"}</h2>
        <p role="status" className="text-sm">
          {pos.submittingSale && !pos.recoveryStatus
            ? "Waiting for the sale response. Keep this order open."
            : pos.recoveryStatus === "checking"
            ? "Checking the transaction before another sale can be started."
            : pos.error || "The sale outcome is not yet confirmed. Check its status before another sale."}
        </p>
        <p className="text-sm text-muted-foreground">
          The sale request is preserved in this tab. An empty current-shift search does not prove that the sale failed.
        </p>
        {pos.recoveryStatus ? (
          <CashierButton
            disabled={pos.recoveryStatus === "checking"}
            loading={pos.recoveryStatus === "checking"}
            onClick={() => void pos.checkSaleStatus()}
          >
            Check transaction status
          </CashierButton>
        ) : null}
        {pos.canRetrySameSale ? (
          <CashierButton variant="secondary" onClick={pos.retrySameSale}>
            Retry the same sale request
          </CashierButton>
        ) : null}
      </section>
    );
  }

  const orderEditorProps = {
    items: pos.cart,
    orderNumber: pos.orderNumber,
    orderType: pos.walkInOrderType,
    subtotal: pos.subtotal,
    taxAmount: pos.taxAmount,
    taxEnabled: pos.taxEnabled,
    total: pos.total,
    shiftOpen: Boolean(pos.activeShift),
    busy: pos.loading || pos.transactionState === POSTransactionState.RECEIPT,
    canContinue: pos.canContinueToPayment,
    disabledReason: pos.summaryDisabledReason,
    onOpenShift,
    onAdjust: pos.adjust,
    onQuantityChange: pos.setLineQuantity,
    onRemove: pos.requestRemove,
    onReorder: pos.reorder,
    onClear: () => pos.setPendingAction({ type: "clear" as const }),
    onPayment: pos.beginPayment,
  };
  const closeMobileOrder = () => {
    setMobileOrderOpen(false);
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(".pos-view-order")?.focus(),
    );
  };

  return (
    <div
      className="tablet-pos relative flex h-full min-h-0 flex-col overflow-hidden border"
      data-transaction-state={pos.transactionState}
    >
      {!orderTypeGateOpen ? (
        <POSOrderHeader
          orderType={pos.walkInOrderType}
          busy={
            pos.loading || pos.transactionState === POSTransactionState.RECEIPT
          }
          shiftOpen={Boolean(pos.activeShift)}
          hasItems={pos.cart.length > 0}
          canCancel={pos.cart.length > 0}
          heldOrders={pos.state.heldOrders}
          search={{
            value: pos.search,
            resultCount: pos.searchResultCount,
            recentSearches: pos.recentSearches,
            activeResultId: pos.activeSearchResultId,
            inputRef: pos.menuSearchRef,
            onChange: pos.setSearch,
            onCommit: pos.commitSearch,
            onMove: pos.moveSearchResult,
            onEnter: pos.quickAddSearchResult,
            onEscape: pos.resetSearchSelection,
          }}
          onNew={() => pos.runQuickAction("new")}
          onHold={() => pos.runQuickAction("hold")}
          onCancel={pos.requestCancel}
          onReopen={pos.reopenHeld}
          onSelectOrderType={pos.selectOrderType}
        />
      ) : null}

      {pos.error ? (
        <div className="p-3 pb-0">
          <ErrorBanner message={pos.error} onRetry={() => pos.setError("")} />
        </div>
      ) : null}

      <div className="pos-entry-layout min-h-0 flex-1" data-order-panel={orderPanelExpanded ? "expanded" : "collapsed"}>
        <main className="pos-workspace min-h-0 flex-1">
          {orderTypeGateOpen ? (
            <OrderTypeGate
              busy={pos.loading}
              shiftOpen={Boolean(pos.activeShift)}
              currentType={pos.walkInOrderType}
              onSelect={pos.selectOrderType}
              onOpenShift={onOpenShift}
            />
          ) : (
            <MenuGrid
              menuItems={pos.state.menuItems}
              cart={pos.cart}
              category={pos.category}
              search={pos.search}
              bestSellerIds={pos.bestSellerIds}
              activeItemId={pos.activeSearchItemId}
              onCategoryChange={pos.setCategory}
              onSelect={pos.openCustomize}
              onQuickAdd={pos.addItem}
            />
          )}
        </main>

        {!orderTypeGateOpen ? (
          <POSOrderSidebar
            {...orderEditorProps}
            expanded={orderPanelExpanded}
            onToggle={() => setOrderPanelExpanded((expanded) => !expanded)}
          />
        ) : null}
      </div>

      {!orderTypeGateOpen ? (
        <TransactionBar
          items={pos.cart}
          lastItemCode={lastItemCode}
          itemCount={pos.itemCount}
          total={pos.total}
          state={pos.transactionState}
          busy={
            pos.loading || pos.transactionState === POSTransactionState.RECEIPT
          }
          shiftOpen={Boolean(pos.activeShift)}
          onOpenShift={onOpenShift}
          paymentRef={pos.checkoutRef}
          onAdjust={pos.adjust}
          onUndoLast={pos.undoLastAdd}
          onViewOrder={() => setMobileOrderOpen(true)}
          onPayment={pos.beginPayment}
        />
      ) : null}

      {mobileOrderOpen && !orderTypeGateOpen ? (
        <div className="pos-mobile-order-overlay">
          <button type="button" className="pos-mobile-order-backdrop" aria-label="Close current order" tabIndex={-1} onClick={closeMobileOrder} />
          <POSOrderSidebar
            {...orderEditorProps}
            detailsId="pos-mobile-order-details"
            expanded
            focusToggle
            onToggle={closeMobileOrder}
          />
        </div>
      ) : null}

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
      description:
        "This will keep the selected order type and return to an empty order.",
      confirmLabel: "Remove item",
    };
  }
  if (type === "clear") {
    return {
      title: "Clear the entire order?",
      description: "All items and payment details will be removed.",
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
