import type { ManagerStockBatch, ManagerStockDetail } from "./inventoryApi";

export type BatchAvailability =
  "eligible" | "expired" | "missing-use-by" | "empty";

export function batchAvailability(
  batch: ManagerStockBatch,
  expiryRequired: boolean,
): BatchAvailability {
  if (!Number.isFinite(batch.quantityOnHand) || batch.quantityOnHand <= 0)
    return "empty";
  if (batch.status === "expired") return "expired";
  // The read RPC calls an undated batch "current", but the order allocator's
  // expiry-required predicate excludes a NULL use_by_date.
  if (expiryRequired && !batch.useByDate) return "missing-use-by";
  return "eligible";
}

export function batchDecision(detail: ManagerStockDetail) {
  const eligible: ManagerStockBatch[] = [];
  const unavailable: Array<{
    batch: ManagerStockBatch;
    reason: Exclude<BatchAvailability, "eligible">;
  }> = [];

  // The Manager detail RPC already returns batches in the allocator's policy
  // order (FEFO use-by, then receipt/ID; FIFO receipt/ID). Never sort here.
  for (const batch of detail.batches) {
    const availability = batchAvailability(batch, detail.stock.expiryRequired);
    if (availability === "eligible") eligible.push(batch);
    else unavailable.push({ batch, reason: availability });
  }

  const eligibleTotal = eligible.reduce(
    (sum, batch) => sum + batch.quantityOnHand,
    0,
  );
  const totalsAgree =
    Number.isFinite(eligibleTotal) &&
    Math.abs(eligibleTotal - detail.stock.usableQuantity) < 0.000001;
  const canRecommend =
    detail.stock.batchConsumptionEnabled &&
    detail.stock.isActive &&
    detail.stock.usableQuantity > 0 &&
    totalsAgree;

  return {
    next: canRecommend ? (eligible[0] ?? null) : null,
    otherEligible: canRecommend ? eligible.slice(1) : eligible,
    unavailable,
    totalsAgree,
  };
}
