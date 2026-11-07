import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "../components";
import { SEARCH_FOCUS_DELAY_MS } from "../constants";
import { useAuth } from "@/app/providers/AuthProvider";
import { fetchCashierSale, type HydratedCashierSale } from "../api/cashierSaleHydrationApi";
import { useCashierStore } from "../hooks/CashierStore";
import { useSearchShortcut } from "../hooks/useSearchShortcut";
import type { CashierNavigationIntent, CashierShift, Order, Transaction } from "../types";
import { currentLocalDate, downloadCsv } from "../utils/exportUtils";
import type { TransactionFilterValue } from "./TransactionFilters";
import { HISTORY_CSV_HEADERS, HISTORY_EXPORT_LIMIT, HISTORY_PAGE_SIZE, fetchHistoryPage, fetchHistoryShifts, historyCsvRow, type HistoryRow } from "./historyReadApi";
import { createTransactionExportGate } from "./transactionExport";

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterValue = {
  search: "", method: "All", status: "All", from: "", to: "",
  cashier: "All", shift: "All", terminal: "All", customer: "",
  orderId: "", receiptNumber: "",
};

function mapHistoryTransaction(row: HistoryRow, cashierName: string): Transaction {
  return {
    id: row.id,
    receiptNumber: row.receipt_number, orderId: row.order_number,
    customerName: row.customer_name ?? "Customer", amount: Number(row.grand_total),
    method: row.payment_method === "cash" ? "Cash" : "GCash",
    status: row.status === "completed" ? "Completed" : "Voided",
    cashierId: row.cashier_id, cashierName, shiftId: row.shift_id,
    paymentId: row.payment_id, createdAt: row.created_at,
    voidReason: row.void_reason ?? undefined,
  };
}

export function useTransactionHistory(intent?: CashierNavigationIntent, active = true) {
  const { state } = useCashierStore();
  const { session } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const focusedIntent = useRef<CashierNavigationIntent | undefined>(undefined);
  const detailRequestRef = useRef(0);
  const activeCashierRef = useRef(session?.id);
  const openedRecent = useRef(false);
  const handledLinkIntent = useRef<CashierNavigationIntent | undefined>(undefined);
  const exportGate = useRef(createTransactionExportGate());
  const [filters, setFilters] = useState<TransactionFilterValue>(() => ({
    ...DEFAULT_TRANSACTION_FILTERS,
    method: intent?.paymentMethods?.length === 1 ? intent.paymentMethods[0] : "All",
    status: intent?.transactionStatuses?.length === 1 && intent.transactionStatuses[0] !== "Refunded"
      ? intent.transactionStatuses[0] : "All",
    from: intent?.today ? currentLocalDate() : "",
    to: intent?.today ? currentLocalDate() : "",
  }));
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [shifts, setShifts] = useState<CashierShift[]>([]);
  const [shiftError, setShiftError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [receiptId, setReceiptId] = useState<string>();
  const [targetRow, setTargetRow] = useState<HistoryRow>();
  const [detail, setDetail] = useState<HydratedCashierSale>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  useSearchShortcut(searchRef, "/", active);
  useEffect(() => {
    if (!active || !intent?.focusSearch || focusedIntent.current === intent) return;
    const timer = window.setTimeout(() => {
      focusedIntent.current = intent;
      searchRef.current?.focus();
    }, SEARCH_FOCUS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, intent]);

  const changeFilters = useCallback((next: TransactionFilterValue) => {
    setPage(0); setFilters(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRows([]); setTotal(0); setLoading(true); setError("");
    if (!session || session.role !== "cashier") {
      setLoading(false); setError("An active Cashier session is required.");
      return;
    }
    const timer = setTimeout(() => {
      void fetchHistoryPage(session.id, filters, page * HISTORY_PAGE_SIZE).then((result) => {
        if (cancelled) return;
        setRows(result.rows); setTotal(result.total);
        setLoading(false);
      }).catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Unable to load transaction history.");
        setLoading(false);
      });
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [session?.id, session?.role, session?.name, filters, page]);

  useEffect(() => {
    let cancelled = false;
    setShifts([]); setShiftError("");
    if (session?.role === "cashier") {
      void fetchHistoryShifts(session.id, session.name).then((ownedShifts) => {
        if (!cancelled) setShifts(ownedShifts);
      }).catch((cause) => {
        if (!cancelled) setShiftError(cause instanceof Error ? cause.message : "Unable to load shift filters.");
      });
    }
    return () => { cancelled = true; };
  }, [session?.id, session?.role, session?.name]);

  useEffect(() => {
    activeCashierRef.current = session?.id;
    detailRequestRef.current += 1;
    setDetail(undefined); setSelectedId(undefined); setReceiptId(undefined);
    setTargetRow(undefined);
    handledLinkIntent.current = undefined;
  }, [session?.id]);

  const transactions = useMemo(() => rows.map((row) => mapHistoryTransaction(row, session?.name ?? "Cashier")), [rows, session?.name]);
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const orders = useMemo(() => rows.flatMap((row) => {
    const known = state.orders.find((order) => order.id === row.order_number);
    return known ? [known] : [];
  }), [rows, state.orders]);
  const shiftById = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);

  const loadDetail = useCallback(async (transaction: Transaction, showReceipt: boolean, linkedRow?: HistoryRow) => {
    const row = linkedRow ?? rowById.get(transaction.id) ??
      (targetRow?.id === transaction.id ? targetRow : undefined);
    if (!row || !session || session.role !== "cashier" || row.cashier_id !== session.id) return;
    const request = ++detailRequestRef.current;
    setDetail(undefined); setDetailLoading(true);
    if (showReceipt) { setSelectedId(undefined); setReceiptId(transaction.id); }
    else { setReceiptId(undefined); setSelectedId(transaction.id); }
    try {
      const sale = await fetchCashierSale(row.order_id, session.name);
      if (request !== detailRequestRef.current || activeCashierRef.current !== session.id) return;
      if (sale.transaction.id !== row.id || sale.transaction.cashierId !== session.id ||
          sale.payment.id !== row.payment_id || sale.transaction.shiftId !== row.shift_id) {
        throw new Error("Receipt ownership or links changed.");
      }
      setDetail({ ...sale, order: { ...sale.order, deliveryFee: Number(row.delivery_fee) } });
    } catch (cause) {
      if (request !== detailRequestRef.current || activeCashierRef.current !== session.id) return;
      Toast.error(cause instanceof Error ? cause.message : "Unable to load receipt details.");
      setSelectedId(undefined); setReceiptId(undefined);
    } finally { if (request === detailRequestRef.current) setDetailLoading(false); }
  }, [rowById, session, targetRow]);
  const loadDetailRef = useRef(loadDetail);
  loadDetailRef.current = loadDetail;

  useEffect(() => {
    if (!intent?.transactionId || !session?.id || session.role !== "cashier" ||
        handledLinkIntent.current === intent) return;
    handledLinkIntent.current = intent;
    let cancelled = false;
    const openLinked = async () => {
      try {
        const row = (await fetchHistoryPage(session.id, {
            ...DEFAULT_TRANSACTION_FILTERS, search: intent.transactionId!,
          }, 0, 1)).rows.find((entry) => entry.id === intent.transactionId);
        if (cancelled || activeCashierRef.current !== session.id) return;
        if (!row || row.cashier_id !== session.id) {
          Toast.info("The linked receipt is unavailable to this Cashier.");
          return;
        }
        setTargetRow(row);
        void loadDetailRef.current(mapHistoryTransaction(row, session.name), false, row);
      } catch (cause) {
        if (!cancelled) Toast.error(cause instanceof Error ? cause.message : "Unable to load the linked receipt.");
      }
    };
    void openLinked();
    return () => {
      cancelled = true;
      if (handledLinkIntent.current === intent) handledLinkIntent.current = undefined;
    };
  }, [intent, session?.id, session?.name, session?.role]);

  const openReceipt = useCallback((transaction: Transaction) => {
    if (transaction.status !== "Completed") {
      Toast.error("Only completed transactions have a printable receipt."); return;
    }
    void loadDetail(transaction, true);
  }, [loadDetail]);

  useEffect(() => {
    if (!intent?.openMostRecentReceipt || openedRecent.current || loading || !transactions.length) return;
    const recent = transactions.find((entry) => entry.status === "Completed");
    if (recent) { openedRecent.current = true; openReceipt(recent); }
  }, [intent?.openMostRecentReceipt, loading, transactions, openReceipt]);

  const exportRecords = useCallback(async () => {
    if (!session || session.role !== "cashier") return;
    await exportGate.current(async () => {
      setIsExporting(true);
      try {
        const first = await fetchHistoryPage(session.id, filters, 0, 100);
        if (first.total > HISTORY_EXPORT_LIMIT) throw new Error("Narrow the filters to at most 5,000 transactions before export.");
        const all = [...first.rows];
        for (let offset = all.length; offset < first.total; offset += 100) {
          const next = await fetchHistoryPage(session.id, filters, offset, 100);
          if (next.total !== first.total) throw new Error("History changed during export. Retry the download.");
          all.push(...next.rows);
        }
        if (all.length !== first.total) throw new Error("History export was incomplete.");
        if (activeCashierRef.current !== session.id) throw new Error("Cashier session changed during export.");
        if (!all.length) { Toast.info("No transactions match the current filters."); return; }
        downloadCsv(`rrj-cashier-transactions-${currentLocalDate()}.csv`, HISTORY_CSV_HEADERS, all.map(historyCsvRow));
        Toast.success(`CSV download started for ${all.length} transactions.`);
      } catch (cause) {
        Toast.error(cause instanceof Error ? cause.message : "Unable to export transactions.");
      } finally { setIsExporting(false); }
    });
  }, [filters, session]);

  const selectedTransaction = selectedId ? transactions.find((entry) => entry.id === selectedId) ??
    (targetRow?.id === selectedId ? mapHistoryTransaction(targetRow, session?.name ?? "Cashier") : undefined) : undefined;
  const receiptTransaction = receiptId ? transactions.find((entry) => entry.id === receiptId) ??
    (targetRow?.id === receiptId ? mapHistoryTransaction(targetRow, session?.name ?? "Cashier") : undefined) : undefined;
  return {
    state, filters, setFilters: changeFilters, filtered: transactions, loading, error, shiftError,
    page, total, pageSize: HISTORY_PAGE_SIZE, setPage,
    searchRef,
    terminals: [...new Set(shifts.map((shift) => shift.terminal))], shifts,
    orders, selectedTransaction, selectedOrder: detail?.order,
    selectedPayment: detail?.payment,
    selectedShift: selectedTransaction ? shiftById.get(selectedTransaction.shiftId) : undefined,
    receiptTransaction, receiptOrder: detail?.order, receiptPayment: detail?.payment,
    detailLoading,
    selectTransaction: (transaction: Transaction) => { void loadDetail(transaction, false); },
    closeTransaction: () => { detailRequestRef.current += 1; setSelectedId(undefined); setDetail(undefined); setTargetRow(undefined); },
    closeReceipt: () => { detailRequestRef.current += 1; setReceiptId(undefined); setDetail(undefined); setTargetRow(undefined); },
    resetFilters: () => changeFilters(DEFAULT_TRANSACTION_FILTERS),
    openReceipt, exportRecords, isExporting,
  };
}
