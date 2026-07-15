import { Download, Printer } from "lucide-react";
import { CashierButton, PageHeader, Toast } from "../components";
import type { CashierNavigationIntent } from "../types";
import { ReceiptDialog } from "../pos/ReceiptDialog";
import { TransactionDetailDrawer } from "./TransactionDetailDrawer";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionSummary } from "./TransactionSummary";
import { TransactionTable } from "./TransactionTable";
import { useTransactionHistory } from "./useTransactionHistory";

export function TransactionHistoryPage({
  intent,
}: {
  intent?: CashierNavigationIntent;
}) {
  const history = useTransactionHistory(intent);

  return (
    <div className="cashier-page">
      <PageHeader
        title="Transaction History"
        description="Financial summaries, receipts, and audit trails linked to recorded orders, payments, shifts, and terminals"
        actions={
          <>
            <CashierButton
              variant="secondary"
              disabled={!history.filtered.length}
              onClick={history.exportRecords}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </CashierButton>
            <CashierButton
              variant="secondary"
              disabled={!history.filtered.length}
              onClick={() => {
                window.print();
                Toast.success(
                  "Filtered transaction report sent to the print dialog.",
                );
              }}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </CashierButton>
          </>
        }
      />
      <TransactionSummary
        transactions={history.filtered}
        orders={history.state.orders}
      />
      <TransactionFilters
        value={history.filters}
        searchRef={history.searchRef}
        shifts={history.state.shifts}
        cashiers={history.cashiers}
        terminals={history.terminals}
        onChange={history.setFilters}
        onReset={history.resetFilters}
      />
      <section className="rrj-card overflow-hidden">
        <TransactionTable
          transactions={history.filtered}
          orders={history.state.orders}
          shifts={history.state.shifts}
          onView={history.selectTransaction}
          onPrint={history.openReceipt}
        />
        <div className="cashier-table-footer flex flex-col gap-1 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{history.filtered.length} linked transaction records</span>
          <strong className="text-foreground">
            Summary cards and exports use these filtered records
          </strong>
        </div>
      </section>
      <TransactionDetailDrawer
        transaction={history.selectedTransaction}
        order={history.selectedOrder}
        payment={history.selectedPayment}
        shift={history.selectedShift}
        activities={history.state.activities}
        open={Boolean(history.selectedTransaction)}
        onOpenChange={(open) => {
          if (!open) history.closeTransaction();
        }}
        onReprint={history.openReceipt}
      />
      <ReceiptDialog
        order={history.receiptOrder}
        payment={history.receiptPayment}
        transaction={history.receiptTransaction}
        open={Boolean(history.receiptTransaction && history.receiptOrder)}
        onClose={history.closeReceipt}
        onPrint={() =>
          history.receiptOrder
            ? history.recordReceiptReprint(history.receiptOrder.id)
            : undefined
        }
      />
    </div>
  );
}
