export * from "./visual-manager-mocks";
import { getManagerStockMovements as baseMovements } from "./visual-manager-mocks";
import { getReceivingDocuments as baseDocuments } from "./visual-manager-mocks";

export const getReceivingDocuments = async (filters: { status?: string; search?: string } = {}) => {
  if (filters.status === "draft" && new URLSearchParams(location.search).has("mgrRec")) return { rows: [{
    id: "77777777-7777-4777-8777-777777777777", rrNumber: "RR-SYNTHETIC", sourceType: "production_team", policyClass: "formal_request",
    sourceReference: "PR-20261023-000004 Rev 1", purchaseOrderId: null, purchaseOrderNumber: null, supplierName: null,
    receivedAt: "2026-10-23T18:00:00+08:00", status: "draft", postedAt: null, lineCount: 1,
    totalDelivered: 2, totalAccepted: 2, totalRejected: 0, updatedAt: "2026-10-23T18:00:00+08:00",
  }], hasMore: false };
  return baseDocuments(filters);
};

export const getManagerStockMovements = async (
  filters?: { itemId?: string },
  cursor?: { id: string } | null,
  pageSize?: number,
) => {
  const page = await baseMovements();
  if (pageSize !== 100) return page;
  if (filters?.itemId === "2") return { rows: [{ ...page.rows[0], id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", inventoryItemId: "2", itemName: "Chicken breast", referenceLabel: "RR-OTHER" }], nextCursor: null };
  return cursor
    ? { rows: [page.rows[0]], nextCursor: null }
    : { rows: [page.rows[1]], nextCursor: { createdAt: page.rows[1].createdAt, id: page.rows[1].id } };
};
