import { LayoutGrid, ShoppingBasket } from "lucide-react";
import { ConfirmationDialog, ErrorBanner, Toast } from "../components";
import { formatMoney } from "../constants";
import { CartCheckoutBar } from "./CartCheckoutBar";
import { CheckoutModal } from "./CheckoutModal";
import { MenuGrid } from "./MenuGrid";
import { ModifierModal } from "./ModifierModal";
import { OrderTypeSelector } from "./OrderTypeSelector";
import { POSCart } from "./POSCart";
import { POSOrderDetails } from "./POSOrderDetails";
import { POSOrderHeader } from "./POSOrderHeader";
import { POSQuickActions } from "./POSQuickActions";
import { ReceiptDialog } from "./ReceiptDialog";
import { ReceiptPreviewDialog } from "./ReceiptPreviewDialog";
import { useWalkInPOSController } from "./useWalkInPOSController";
import { VoidOrderDialog } from "./VoidOrderDialog";

export function WalkInPOSPage({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const pos = useWalkInPOSController(onDirtyChange);
  const confirmation = getConfirmationCopy(pos.pendingAction?.type);

  return (
    <div className="tablet-pos relative flex h-full min-h-0 flex-col overflow-hidden border">
      {pos.orderStarted ? (
        <>
          <POSOrderHeader
            orderType={pos.values.orderType}
            busy={pos.loading}
            heldOrders={pos.state.heldOrders}
            onOrderTypeChange={pos.selectOrderType}
            onVoid={() =>
              pos.cart.length
                ? pos.setVoidOpen(true)
                : Toast.error("There is no order to void.")
            }
            onReopen={pos.reopenHeld}
          />
          {pos.error ? (
            <div className="p-3 pb-0">
              <ErrorBanner
                message={pos.error}
                onRetry={() => pos.setError("")}
              />
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
              Current Order <span>{pos.itemCount}</span>
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
                onSelect={pos.setSelectedItem}
                onQuickAdd={pos.addItem}
                onToggleFavorite={pos.toggleFavorite}
              />
            </div>
            <aside
              id="pos-panel-order"
              role="tabpanel"
              aria-labelledby="pos-tab-order"
              className={`pos-pane pos-order-pane w-full shrink-0 flex-col overflow-y-auto border-t lg:flex lg:w-[430px] lg:border-t-0 ${pos.tabletPane === "order" ? "is-active flex" : "hidden"}`}
            >
              <POSCart
                items={pos.cart}
                orderNumber={pos.orderNumber}
                orderType={pos.values.orderType}
                onAdjust={pos.adjust}
                onQuantityChange={pos.setLineQuantity}
                onRemove={pos.remove}
                onDuplicate={pos.duplicate}
                onNoteChange={pos.note}
                onReorder={pos.reorder}
                onClear={() => pos.setPendingAction({ type: "clear" })}
              />
              {pos.cart.length ? (
                <>
                  <POSOrderDetails
                    orderType={pos.values.orderType}
                    discountType={pos.values.discountType}
                    occupiedTables={pos.occupiedTables}
                    optionsOpen={pos.optionsOpen}
                    onOptionsOpenChange={pos.setOptionsOpen}
                    register={pos.register}
                    errors={pos.errors}
                  />
                  <CartCheckoutBar
                    total={pos.total}
                    itemCount={pos.itemCount}
                    disabledReason={pos.checkoutIssue?.message}
                    checkoutRef={pos.checkoutRef}
                    onCheckout={pos.openCheckout}
                  />
                </>
              ) : null}
            </aside>
          </div>
          <POSQuickActions
            busy={pos.loading}
            hasItems={pos.cart.length > 0}
            onAction={pos.runQuickAction}
          />
        </>
      ) : (
        <OrderTypeSelector onSelect={pos.selectOrderType} />
      )}
      <CheckoutModal
        open={pos.checkoutOpen}
        loading={pos.loading}
        orderNumber={pos.orderNumber}
        items={pos.cart}
        values={pos.values}
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
        onOpenChange={pos.setCheckoutOpen}
        onTenderedChange={pos.setTendered}
        onPreview={pos.previewReceipt}
        onConfirm={pos.submitOrder}
      />
      <ReceiptPreviewDialog
        open={pos.previewOpen}
        orderNumber={pos.orderNumber}
        items={pos.cart}
        orderType={pos.values.orderType}
        tableNumber={
          pos.values.orderType === "Dine-in"
            ? pos.values.tableNumber
            : undefined
        }
        customerName={pos.values.customerName}
        contactNumber={pos.values.contactNumber}
        deliveryAddress={pos.values.deliveryAddress}
        instructions={pos.values.orderInstructions}
        subtotal={pos.subtotal}
        discountAmount={pos.discountAmount}
        taxAmount={pos.taxAmount}
        total={pos.total}
        paymentMethod={pos.values.paymentMethod}
        onOpenChange={pos.setPreviewOpen}
        onPrint={() => window.print()}
        onCheckout={() => {
          pos.setPreviewOpen(false);
          window.requestAnimationFrame(pos.openCheckout);
        }}
      />
      <VoidOrderDialog
        open={pos.voidOpen}
        loading={pos.loading}
        onOpenChange={pos.setVoidOpen}
        onConfirm={pos.voidCurrent}
      />
      <ReceiptDialog
        order={pos.receiptOrder}
        payment={pos.receiptPayment}
        open={Boolean(pos.receiptOrder)}
        placed
        onClose={() => {
          pos.setReceiptOrder(undefined);
          pos.focusSearch();
        }}
      />
      <ModifierModal
        item={pos.selectedItem}
        currentQuantity={pos.currentSelectedQuantity}
        onClose={() => pos.setSelectedItem(undefined)}
        onAdd={pos.addItem}
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

function getConfirmationCopy(type?: "reset" | "clear" | "reopen") {
  if (type === "reopen") {
    return {
      title: "Replace the current order?",
      description:
        "The active cart will be replaced by the selected held order.",
      confirmLabel: "Replace cart",
    };
  }
  if (type === "clear") {
    return {
      title: "Clear every item?",
      description: "All items and item notes will be removed from this cart.",
      confirmLabel: "Clear cart",
    };
  }
  return {
    title: "Start a new order?",
    description: "The active cart and payment details will be discarded.",
    confirmLabel: "Start new order",
  };
}
