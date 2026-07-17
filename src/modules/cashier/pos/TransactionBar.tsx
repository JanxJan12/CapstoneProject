import type { RefObject } from "react";
import {
  ArrowRight,
  ClipboardList,
  CreditCard,
  Minus,
  Plus,
  Undo2,
} from "lucide-react";
import { formatMoney } from "../constants";
import type { POSCartLine } from "./types";
import { POSTransactionState } from "./types";

const STATE_LABELS: Record<POSTransactionState, string> = {
  [POSTransactionState.IDLE]: "Ready",
  [POSTransactionState.ORDERING]: "Order entry",
  [POSTransactionState.ORDER_REVIEW]: "Reviewing",
  [POSTransactionState.PAYMENT]: "Payment",
  [POSTransactionState.RECEIPT]: "Complete",
};

export function TransactionBar({
  items,
  lastItemCode,
  itemCount,
  total,
  state,
  busy,
  paymentRef,
  onAdjust,
  onUndoLast,
  onReview,
  onPayment,
}: {
  items: POSCartLine[];
  lastItemCode?: string;
  itemCount: number;
  total: number;
  state: POSTransactionState;
  busy: boolean;
  paymentRef?: RefObject<HTMLButtonElement | null>;
  onAdjust: (lineId: string, delta: number) => void;
  onUndoLast: () => void;
  onReview: () => void;
  onPayment: () => void;
}) {
  const lastItem = items.at(-1);
  const hasItems = itemCount > 0;

  return (
    <footer className="pos-transaction-bar" aria-label="Active transaction">
      <div className="pos-transaction-state" aria-live="polite">
        <span className={hasItems ? "is-active" : ""} />
        <div>
          <small>{STATE_LABELS[state]}</small>
          <strong>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </strong>
        </div>
      </div>

      <div className="pos-active-line">
        {lastItem ? (
          <>
            <div className="min-w-0 flex-1">
              <p>
                <span>{lastItemCode ?? "ITEM"}</span>
                Last added
              </p>
              <strong>{lastItem.name}</strong>
            </div>
            <div className="pos-active-line-controls">
              <button
                type="button"
                onClick={() => onAdjust(lastItem.lineId, -1)}
                aria-label={`Decrease ${lastItem.name}`}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <b>{lastItem.quantity}</b>
              <button
                type="button"
                onClick={() => onAdjust(lastItem.lineId, 1)}
                aria-label={`Increase ${lastItem.name}`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onUndoLast}
                aria-label={`Undo last ${lastItem.name} addition`}
                title="Undo last add"
                className="pos-undo-add"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <p className="pos-active-line-empty">
            Select a menu key or type an item code to begin.
          </p>
        )}
      </div>

      <div className="pos-running-total">
        <small>Running total</small>
        <strong>{formatMoney(total)}</strong>
      </div>

      <div className="pos-transaction-actions">
        <button
          type="button"
          onClick={onReview}
          disabled={!hasItems || busy}
          className="pos-view-order"
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          <span>View Order</span>
        </button>
        <button
          ref={paymentRef}
          type="button"
          onClick={onPayment}
          disabled={!hasItems || busy}
          aria-keyshortcuts="F3"
          className="pos-take-payment"
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          <span>Payment</span>
          <kbd>F3</kbd>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
