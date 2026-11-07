import { CreditCard, PanelRightClose, PanelRightOpen } from "lucide-react";
import { formatMoney } from "../constants";
import { POSCart } from "./POSCart";
import type { POSCartLine, WalkInOrderType } from "./types";

export function POSOrderSidebar({
  items,
  orderNumber,
  orderType,
  subtotal,
  taxAmount,
  taxEnabled,
  total,
  shiftOpen,
  busy,
  canContinue,
  disabledReason,
  expanded,
  onToggle,
  onOpenShift,
  onAdjust,
  onQuantityChange,
  onRemove,
  onReorder,
  onClear,
  onPayment,
  detailsId = "pos-order-sidebar-details",
  focusToggle = false,
}: {
  items: POSCartLine[];
  orderNumber: string;
  orderType: WalkInOrderType;
  subtotal: number;
  taxAmount: number;
  taxEnabled: boolean;
  total: number;
  shiftOpen: boolean;
  busy: boolean;
  canContinue: boolean;
  disabledReason?: string;
  expanded: boolean;
  onToggle: () => void;
  onOpenShift: () => void;
  onAdjust: (lineId: string, delta: number) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onReorder: (sourceLineId: string, targetLineId: string) => void;
  onClear: () => void;
  onPayment: () => void;
  detailsId?: string;
  focusToggle?: boolean;
}) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside className="pos-order-sidebar" aria-label="Current order summary" data-expanded={expanded}>
      <header className="pos-order-sidebar-header">
        <div className="min-w-0">
          <h2>Current order</h2>
          {expanded ? <p>{orderType} · {itemCount} {itemCount === 1 ? "item" : "items"}</p> : null}
        </div>
        <button type="button" autoFocus={focusToggle} className="pos-order-sidebar-toggle" aria-expanded={expanded} aria-controls={detailsId} aria-label={focusToggle ? "Close current order" : expanded ? "Collapse current order panel" : "Expand current order panel"} onClick={onToggle}>
          {expanded ? <PanelRightClose className="h-5 w-5" aria-hidden="true" /> : <PanelRightOpen className="h-5 w-5" aria-hidden="true" />}
          <span>{focusToggle ? "Close" : expanded ? "Collapse" : "Expand"}</span>
        </button>
      </header>
      {expanded ? <div id={detailsId} className="pos-order-sidebar-details">
      <div className="pos-order-sidebar-items">
        <POSCart
          embedded
          items={items}
          orderNumber={orderNumber}
          orderType={orderType}
          onAdjust={onAdjust}
          onQuantityChange={onQuantityChange}
          onRemove={onRemove}
          onReorder={onReorder}
          onClear={onClear}
        />
      </div>
      <div className="pos-order-sidebar-footer">
        <div className="pos-order-sidebar-subtotal"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
        {taxEnabled ? <div className="pos-order-sidebar-subtotal"><span>Tax</span><span>{formatMoney(taxAmount)}</span></div> : null}
        <div className="pos-order-sidebar-total"><span>Amount due</span><strong>{formatMoney(total)}</strong></div>
        {!shiftOpen ? <div className="pos-order-sidebar-shift"><p className="pos-order-sidebar-message" role="status">Shift closed. Open a shift before taking payment.</p><button type="button" onClick={onOpenShift}>Open shift</button></div> : disabledReason && items.length ? <p className="pos-order-sidebar-message" role="status">{disabledReason}</p> : null}
        {items.length ? <button type="button" className="pos-order-sidebar-clear" disabled={busy} onClick={onClear}>Clear order</button> : null}
        <button type="button" className="pos-order-sidebar-payment" disabled={!shiftOpen || !canContinue || busy} onClick={onPayment}><CreditCard className="h-4 w-4" /> Take payment</button>
      </div>
      </div> : <div id={detailsId} className="pos-order-sidebar-collapsed">
        <strong>{itemCount}</strong><span>{itemCount === 1 ? "item" : "items"}</span>
        <b>{formatMoney(total)}</b>
        {!shiftOpen ? <button type="button" onClick={onOpenShift}>Open shift</button> : null}
      </div>}
    </aside>
  );
}
