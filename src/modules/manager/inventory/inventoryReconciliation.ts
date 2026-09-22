import type {
  ManagerInventoryItem,
  ManagerInventoryTransaction,
} from "./inventoryApi";

export const INVENTORY_RECONCILIATION_TRANSACTION_LIMIT = 500;

export type InventoryReconciliationStatus =
  "matched" | "mismatch" | "insufficient-history";

export interface InventoryReconciliationRow {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  currentQuantity: number;
  latestTransactionQuantity: number | null;
  latestTransactionAt: string | null;
  reconstructedLedgerQuantity: number | null;
  varianceFromLatestTransaction: number | null;
  observedTransactionCount: number;
  status: InventoryReconciliationStatus;
  details: string;
}

export interface InventoryReconciliationReport {
  rows: InventoryReconciliationRow[];
  matchedCount: number;
  mismatchCount: number;
  insufficientHistoryCount: number;
  returnedTransactionCount: number;
  transactionLimit: number;
  hasCompleteTransactionHistory: boolean;
}

const QUANTITY_SCALE = 1_000;

function toScaledQuantity(value: number): number {
  return Math.round(value * QUANTITY_SCALE);
}

function fromScaledQuantity(value: number): number {
  return value / QUANTITY_SCALE;
}

function isTransactionSequenceConsistent(
  transactions: ManagerInventoryTransaction[],
): boolean {
  for (let index = 0; index < transactions.length; index += 1) {
    const transaction = transactions[index];
    const expectedAfter =
      toScaledQuantity(transaction.quantityBefore) +
      toScaledQuantity(transaction.quantityChange);

    if (expectedAfter !== toScaledQuantity(transaction.quantityAfter)) {
      return false;
    }

    const olderTransaction = transactions[index + 1];

    if (
      olderTransaction &&
      toScaledQuantity(transaction.quantityBefore) !==
        toScaledQuantity(olderTransaction.quantityAfter)
    ) {
      return false;
    }
  }

  return true;
}

function reconcileItem(
  item: ManagerInventoryItem,
  transactions: ManagerInventoryTransaction[],
  hasCompleteTransactionHistory: boolean,
): InventoryReconciliationRow {
  if (transactions.length === 0) {
    return {
      inventoryItemId: item.id,
      itemName: item.itemName,
      unit: item.unit,
      currentQuantity: item.quantityOnHand,
      latestTransactionQuantity: null,
      latestTransactionAt: null,
      reconstructedLedgerQuantity: null,
      varianceFromLatestTransaction: null,
      observedTransactionCount: 0,
      status: "insufficient-history",
      details: hasCompleteTransactionHistory
        ? "No transaction history exists for this item, so its balance cannot be reconstructed."
        : "No transaction for this item appears in the returned history, and older rows may exist beyond the read limit.",
    };
  }

  const latestTransaction = transactions[0];
  const earliestTransaction = transactions[transactions.length - 1];
  const currentQuantity = toScaledQuantity(item.quantityOnHand);
  const latestTransactionQuantity = toScaledQuantity(
    latestTransaction.quantityAfter,
  );
  const variance = currentQuantity - latestTransactionQuantity;
  const transactionSequenceIsConsistent =
    isTransactionSequenceConsistent(transactions);
  const reconstructedQuantity =
    toScaledQuantity(earliestTransaction.quantityBefore) +
    transactions.reduce(
      (total, transaction) =>
        total + toScaledQuantity(transaction.quantityChange),
      0,
    );
  const ledgerReconstructionIsConsistent =
    transactionSequenceIsConsistent &&
    reconstructedQuantity === latestTransactionQuantity;
  const reconstructedLedgerQuantity =
    hasCompleteTransactionHistory && ledgerReconstructionIsConsistent
      ? fromScaledQuantity(reconstructedQuantity)
      : null;

  if (variance !== 0) {
    return {
      inventoryItemId: item.id,
      itemName: item.itemName,
      unit: item.unit,
      currentQuantity: item.quantityOnHand,
      latestTransactionQuantity: latestTransaction.quantityAfter,
      latestTransactionAt: latestTransaction.createdAt,
      reconstructedLedgerQuantity,
      varianceFromLatestTransaction: fromScaledQuantity(variance),
      observedTransactionCount: transactions.length,
      status: "mismatch",
      details:
        "Current stock does not match the latest recorded transaction balance.",
    };
  }

  if (!ledgerReconstructionIsConsistent) {
    return {
      inventoryItemId: item.id,
      itemName: item.itemName,
      unit: item.unit,
      currentQuantity: item.quantityOnHand,
      latestTransactionQuantity: latestTransaction.quantityAfter,
      latestTransactionAt: latestTransaction.createdAt,
      reconstructedLedgerQuantity: null,
      varianceFromLatestTransaction: 0,
      observedTransactionCount: transactions.length,
      status: "mismatch",
      details:
        "The observed transaction rows contain a balance gap or an inconsistent before/change/after sequence.",
    };
  }

  if (!hasCompleteTransactionHistory) {
    return {
      inventoryItemId: item.id,
      itemName: item.itemName,
      unit: item.unit,
      currentQuantity: item.quantityOnHand,
      latestTransactionQuantity: latestTransaction.quantityAfter,
      latestTransactionAt: latestTransaction.createdAt,
      reconstructedLedgerQuantity: null,
      varianceFromLatestTransaction: 0,
      observedTransactionCount: transactions.length,
      status: "insufficient-history",
      details:
        "The latest recorded balance matches current stock, but the transaction read limit was reached, so the complete ledger total cannot be confirmed.",
    };
  }

  return {
    inventoryItemId: item.id,
    itemName: item.itemName,
    unit: item.unit,
    currentQuantity: item.quantityOnHand,
    latestTransactionQuantity: latestTransaction.quantityAfter,
    latestTransactionAt: latestTransaction.createdAt,
    reconstructedLedgerQuantity,
    varianceFromLatestTransaction: 0,
    observedTransactionCount: transactions.length,
    status: "matched",
    details:
      "Current stock matches the latest transaction and the recorded ledger sequence.",
  };
}

export function reconcileInventoryBalances(
  items: ManagerInventoryItem[],
  transactions: ManagerInventoryTransaction[],
  transactionLimit = INVENTORY_RECONCILIATION_TRANSACTION_LIMIT,
): InventoryReconciliationReport {
  const normalizedLimit = Math.max(1, Math.trunc(transactionLimit));
  const hasCompleteTransactionHistory = transactions.length < normalizedLimit;
  const transactionsByItem = new Map<string, ManagerInventoryTransaction[]>();

  for (const transaction of transactions) {
    const itemTransactions =
      transactionsByItem.get(transaction.inventoryItemId) ?? [];
    itemTransactions.push(transaction);
    transactionsByItem.set(transaction.inventoryItemId, itemTransactions);
  }

  const rows = items.map((item) =>
    reconcileItem(
      item,
      transactionsByItem.get(item.id) ?? [],
      hasCompleteTransactionHistory,
    ),
  );

  return {
    rows,
    matchedCount: rows.filter((row) => row.status === "matched").length,
    mismatchCount: rows.filter((row) => row.status === "mismatch").length,
    insufficientHistoryCount: rows.filter(
      (row) => row.status === "insufficient-history",
    ).length,
    returnedTransactionCount: transactions.length,
    transactionLimit: normalizedLimit,
    hasCompleteTransactionHistory,
  };
}
