import { useEffect } from "react";
import { Download } from "lucide-react";
import { CashierButton } from "../components";
import type { CashierNavigationIntent } from "../types";
import { ReceiptDialog } from "../pos/ReceiptDialog";
import { TransactionCards } from "./TransactionCards";
import { TransactionDetailDrawer } from "./TransactionDetailDrawer";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionSummary } from "./TransactionSummary";
import { TransactionTable } from "./TransactionTable";
import { useTransactionHistory } from "./useTransactionHistory";
import { findAccessibleOrder } from "../ordersReceiptLinks";

export function TransactionHistoryPage({
  intent,
  embedded = false,
  active = true,
  onViewOrder,
}: {
  intent?: CashierNavigationIntent;
  embedded?: boolean;
  active?: boolean;
  onViewOrder?: (orderId: string) => void;
}) {
  const history = useTransactionHistory(intent, active);
  useEffect(() => {
    if (!active) {
      history.closeTransaction();
      history.closeReceipt();
    }
  }, [active]);
  const linkedOrder = findAccessibleOrder(history.selectedOrder, history.state.orders);

  return (
    <div className="cashier-page">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          {embedded ? <h2 className="text-lg font-black tracking-tight sm:text-xl">Sales history</h2> :
            <h1 className="text-2xl font-black tracking-tight">Transaction History</h1>}
          <p className="mt-1 text-xs text-muted-foreground" role="status">
            {history.loading ? "Loading history…" : `${history.total} matching transactions · page ${history.page + 1}`}
          </p>
        </div>
        <CashierButton variant="secondary" disabled={history.isExporting} onClick={() => void history.exportRecords()}>
          <Download className="h-4 w-4" aria-hidden="true" /> {history.isExporting ? "Preparing CSV…" : "Export CSV"}
        </CashierButton>
      </header>
      <TransactionFilters
        value={history.filters}
        searchRef={history.searchRef}
        shifts={history.shifts}
        terminals={history.terminals}
        onChange={history.setFilters}
        onReset={history.resetFilters}
      />
      {history.error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{history.error}</p> : null}
      {history.shiftError ? <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Shift filters are unavailable: {history.shiftError}</p> : null}
      {history.detailLoading ? <p role="status" className="text-xs text-muted-foreground">Loading receipt details…</p> : null}
      <details className="text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">About these totals</summary>
        <p className="mt-1">
          Counts include all transactions on the current page.
          Sales amounts include completed transactions only;
          voided transactions are excluded.
          These figures are separate from Cashier Shift Settlement.
          CSV exports matching records across pages, subject to the export limit.
        </p>
      </details>
      <TransactionSummary transactions={history.filtered} orders={history.orders} />
      <section className="rrj-card overflow-hidden">
        <div className="xl:hidden">
          <TransactionCards transactions={history.filtered} orders={history.orders} onView={history.selectTransaction} onReceipt={history.openReceipt} />
        </div>
        <div className="hidden xl:block">
          <TransactionTable
            transactions={history.filtered}
            orders={history.orders}
            shifts={history.shifts}
            onView={history.selectTransaction}
            onPrint={history.openReceipt}
          />
        </div>
      </section>
      <nav aria-label="Transaction pages" className="flex items-center justify-end gap-2 text-xs">
        <CashierButton variant="secondary" disabled={history.loading || history.page === 0} onClick={() => history.setPage(history.page - 1)}>Previous</CashierButton>
        <span>{history.total ? `${history.page * history.pageSize + 1}–${Math.min((history.page + 1) * history.pageSize, history.total)} of ${history.total}` : "0 records"}</span>
        <CashierButton variant="secondary" disabled={history.loading || (history.page + 1) * history.pageSize >= history.total} onClick={() => history.setPage(history.page + 1)}>Next</CashierButton>
      </nav>
      <TransactionDetailDrawer
        transaction={history.selectedTransaction}
        order={history.selectedOrder}
        payment={history.selectedPayment}
        shift={history.selectedShift}
        open={Boolean(history.selectedTransaction && history.selectedOrder && !history.detailLoading)}
        onOpenChange={(open) => {
          if (!open) history.closeTransaction();
        }}
        onReprint={history.openReceipt}
        onViewOrder={linkedOrder && onViewOrder ? () => {
          history.closeTransaction();
          onViewOrder(linkedOrder.id);
        } : undefined}
      />
      <ReceiptDialog
        order={history.receiptOrder}
        payment={history.receiptPayment}
        transaction={history.receiptTransaction}
        open={Boolean(history.receiptTransaction && history.receiptOrder && !history.detailLoading)}
        onClose={history.closeReceipt}
      />
    </div>
  );
}
