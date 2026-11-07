export const useAuth = () => ({ session: { id: "22222222-2222-4222-8222-222222222222", role: "manager", name: "Alex Manager" }, loading: false });
export const getManagerDashboard = async () => ({
  salesToday: 12480, ordersToday: 32, pendingPayments: 3, lowStockCount: 4,
  orderStatusCounts: [{ status: "waiting_payment_verification", count: 3 }, { status: "preparing", count: 7 }, { status: "ready", count: 5 }, { status: "completed", count: 17 }],
  recentOrders: [{ orderNumber: "RRJ-1042", customerName: "Sample customer", grandTotal: 460, currentStatus: "preparing" }, { orderNumber: "RRJ-1041", customerName: "Sample customer", grandTotal: 795, currentStatus: "completed" }],
  dailySales: [3100, 4700, 3900, 5500, 6250, 7200, 12480].map((sales, i) => ({ date: `2026-10-${String(i + 6).padStart(2,"0")}`, day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], sales })),
});
export const getManagerSalesReport = async () => ({
  totalRevenue: 12480, totalOrders: 17, averageOrderValue: 12480 / 17,
  topItemName: "Chicken meal",
  dailySales: [3100, 4700, 3900, 5500, 6250, 7200, 12480].map((sales, i) => ({ date: `2026-10-${String(i + 6).padStart(2,"0")}`, day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], sales })),
});
export const getManagerMenuItems = async () => [
  { id:"meal-1", code:"MEAL-01", name:"Chicken meal", description:"Synthetic meal", categoryName:"Meals", price:145, isActive:true, manuallyAvailable:true, effectivelyAvailable:true, updatedAt:"2026-10-23T00:00:00Z" },
  { id:"drink-1", code:"DRINK-01", name:"Fruit drink", description:"Synthetic drink", categoryName:"Drinks", price:65, isActive:true, manuallyAvailable:true, effectivelyAvailable:true, updatedAt:"2026-10-23T00:00:00Z" },
];
export const getManagerFixedMealOptions = async () => [{ menuItemId:"meal-1", withoutRicePrice:125, withoutRiceInventoryItemId:"rice-1" }];
export const getManagerMealIngredients = async () => [{ menuItemId:"meal-1", inventoryItemId:"rice-1", inventoryName:"Rice", quantityRequired:0.2 }];
export const getManagerMealInventoryCandidates = async () => [{ inventoryItemId:"rice-1", inventoryName:"Rice", inventoryUnit:"kg" }];
export const getManagerDrinkChoices = async () => [{ menuItemId:"drink-1", choiceKind:"flavor", optionId:"flavor-1", optionName:"Mango", priceAdjustment:0, isActive:true }];
export const setManagerMenuItemAvailability = async () => { throw new Error("Fixture is read only"); };
export const setManagerFixedMealOption = setManagerMenuItemAvailability;
export const setManagerDrinkChoice = setManagerMenuItemAvailability;
export const getManagerRiders = async () => [{ id:"rider-1", name:"Sample Rider", contactNumber:"09170000000", driverLicenseNumber:null, plateNumber:null, motorBrand:null, motorModel:null, approvalStatus:"approved", availabilityStatus:"available", isActive:true, deliveriesToday:2, totalDeliveries:12, lastAssignedAt:"2026-10-23T00:00:00Z" }];
export const stockRows = [
  { id: "1", itemName: "Chicken thigh", category: "Production", unit: "kg", physicalQuantity: 12, usableQuantity: 3, expiredQuantity: 9, reorderLevel: 8, isActive: true, batchConsumptionEnabled: true, expiryRequired: true, rotationPolicy: "fefo", nearestUseBy: "2026-10-24", updatedAt: "2026-10-12T00:00:00Z" },
  { id: "2", itemName: "Chicken breast", category: "Production", unit: "kg", physicalQuantity: 18, usableQuantity: 6, expiredQuantity: 0, reorderLevel: 10, isActive: true, batchConsumptionEnabled: true, expiryRequired: true, rotationPolicy: "fefo", nearestUseBy: "2026-10-16", updatedAt: "2026-10-12T00:00:00Z" },
  { id: "3", itemName: "Marinated chicken - quarter leg", category: "Ready to cook", unit: "pcs", physicalQuantity: 24, usableQuantity: 24, expiredQuantity: 0, reorderLevel: 12, isActive: true, batchConsumptionEnabled: true, expiryRequired: true, rotationPolicy: "fefo", nearestUseBy: "2026-10-18", updatedAt: "2026-10-12T00:00:00Z" },
];
export const getManagerStockSummary = async () => {
  (window as typeof window & { __stockCalls?: number }).__stockCalls =
    ((window as typeof window & { __stockCalls?: number }).__stockCalls ?? 0) + 1;
  const query = new URLSearchParams(location.search);
  if (query.has("stockSlow")) await new Promise((resolve) => setTimeout(resolve, 1200));
  if (query.has("stockError")) throw new Error("Synthetic stock source unavailable");
  if (query.has("stockUnauthorized")) throw new Error("Active manager access required.");
  if (query.has("stockEmpty")) return [];
  if (query.has("stockHealthy")) return stockRows.map((row) => ({ ...row, usableQuantity: row.physicalQuantity, reorderLevel: 1 }));
  if (query.has("stockMalformed")) return [{ ...stockRows[0], usableQuantity: null }];
  return stockRows;
};
export const getManagerStockDetail = async (itemId: string) => ({
  stock: stockRows.find((row) => row.id === itemId) ?? stockRows[0],
  batches: itemId === "1" ? [
    { id: "55555555-5555-4555-8555-555555555555", batchCode: "LOCAL-DEMO-01", receivedAt: "2026-10-12T10:30:00+08:00", useByDate: "2026-10-24", quantityOnHand: 3, status: "current" },
    { id: "99999999-9999-4999-8999-999999999999", batchCode: "LOCAL-DEMO-EXPIRED", receivedAt: "2026-10-01T10:30:00+08:00", useByDate: "2026-10-10", quantityOnHand: 9, status: "expired" },
  ] : [],
});
const sampleMovement = { id: "66666666-6666-4666-8666-666666666666", inventoryItemId: "1", itemName: "Chicken thigh", unit: "kg", transactionType: "receiving", quantityChange: 2, quantityBefore: 10, quantityAfter: 12, reason: "Accepted physical delivery", referenceLabel: "RR-20261012-000001", batches: [{ batchCode: "LOCAL-DEMO-01", quantity: 2 }], performedByName: "Alex Manager", createdAt: "2026-10-12T11:00:00+08:00" };
const usedBatchMovement = { ...sampleMovement, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", transactionType: "issuance", quantityChange: -2, quantityBefore: 14, quantityAfter: 12, reason: "Confirmed order allocation", referenceLabel: "ORD-LOCAL-001", batches: [{ batchCode: "LOCAL-DEMO-USED", quantity: 2 }], createdAt: "2026-10-11T11:00:00+08:00" };
export const getManagerStockMovements = async () => ({ rows: [sampleMovement, usedBatchMovement], nextCursor: null });
export const getManagerInventory = async () => stockRows.map((row) => ({ id: row.id, itemName: row.itemName, category: row.category, unit: row.unit, quantityOnHand: row.physicalQuantity, reorderLevel: row.reorderLevel, isActive: row.isActive, stockStatus: "in_stock", createdAt: row.updatedAt, updatedAt: row.updatedAt }));
export const getManagerInventoryTransactions = async () => [{ ...sampleMovement, orderId: null, orderNumber: null, performedBy: "22222222-2222-4222-8222-222222222222" }];
export const getManagerInventoryBatchContext = async () => stockRows.map((row) => ({ inventoryItemId: row.id, batchConsumptionEnabled: true, quantityScale: row.unit === "pcs" ? 0 : 2, batches: [{ id: `batch-${row.id}`, batchCode: `LOCAL-DEMO-${row.id}`, receivedAt: row.updatedAt, useByDate: row.nearestUseBy, quantityOnHand: row.physicalQuantity }] }));
export const clearInventoryMutationRequestId = () => {};
export const getOrCreateInventoryMutationRequestId = () => crypto.randomUUID();
export const recordInventoryWaste = async () => { throw new Error("Fixture is read only"); };
export const recordBatchInventoryWaste = recordInventoryWaste;
export const adjustInventoryStock = recordInventoryWaste;
export const adjustInventoryBatchStock = recordInventoryWaste;
export const getRequestProposal = async () => {
  if (new URLSearchParams(location.search).has("requestError")) throw new Error("Synthetic proposal unavailable");
  return [
  { id: "1", name: "Chicken thigh", unit: "kg", reorder_level: 8, valid_at_need: 3, outstanding: 1, quantity_scale: 2, expiry_verified: true },
  { id: "2", name: "Chicken breast", unit: "kg", reorder_level: 10, valid_at_need: 6, outstanding: 0, quantity_scale: 2, expiry_verified: true },
  { id: "3", name: "Marinated chicken - quarter leg", unit: "pcs", reorder_level: 12, valid_at_need: 24, outstanding: 0, quantity_scale: 0, expiry_verified: true },
  ];
};
// Synthetic, local-only examples for populated Manager UI review.
const sampleRequest = {
  id: "11111111-1111-4111-8111-111111111111", number: "PR-20261012-000001", revision: 2,
  status: "partially_received", priority: "priority", needed_at: "2026-10-13T10:00:00+08:00",
  reason: "Kitchen replenishment for scheduled service", issued_at: "2026-10-12T09:00:00+08:00", issued_by_name: "Alex Manager", close_reason: null,
  snapshot: { number: "PR-20261012-000001", revision: 2, issued_at: "2026-10-12T09:00:00+08:00", issued_by: "22222222-2222-4222-8222-222222222222", issued_by_name: "Alex Manager", priority: "priority", needed_at: "2026-10-13T10:00:00+08:00", reason: "Kitchen replenishment for scheduled service", destination: "Foodhouse", lines: [{ inventory_item_id: "1", name: "Chicken thigh", unit: "kg", quantity: 5 }, { inventory_item_id: "2", name: "Chicken breast", unit: "kg", quantity: 4 }] },
  revisions: [{ revision: 1, snapshot: { number: "PR-20261012-000001", revision: 1, issued_at: "2026-10-11T09:00:00+08:00", issued_by: "22222222-2222-4222-8222-222222222222", issued_by_name: "Alex Manager", priority: "scheduled", needed_at: "2026-10-13T10:00:00+08:00", reason: "Initial scheduled replenishment", destination: "Foodhouse", lines: [{ inventory_item_id: "1", name: "Chicken thigh", unit: "kg", quantity: 4 }] } }, { revision: 2, snapshot: { number: "PR-20261012-000001", revision: 2, issued_at: "2026-10-12T09:00:00+08:00", issued_by: "22222222-2222-4222-8222-222222222222", issued_by_name: "Alex Manager", priority: "priority", needed_at: "2026-10-13T10:00:00+08:00", reason: "Kitchen replenishment for scheduled service", destination: "Foodhouse", lines: [{ inventory_item_id: "1", name: "Chicken thigh", unit: "kg", quantity: 5 }, { inventory_item_id: "2", name: "Chicken breast", unit: "kg", quantity: 4 }] } }],
  lines: [{ inventory_item_id: "1", name: "Chicken thigh", unit: "kg", quantity: 5, accepted: 2, rejected: 1, remaining: 3 }, { inventory_item_id: "2", name: "Chicken breast", unit: "kg", quantity: 4, accepted: 0, rejected: 0, remaining: 4 }],
  receipts: [{ id: "33333333-3333-4333-8333-333333333333", number: "RR-20261012-000001", status: "posted", inspector: "Sam Staff", posted_at: "2026-10-12T11:00:00+08:00" }, { id: "77777777-7777-4777-8777-777777777777", number: "RR-20261012-000002", status: "draft", inspector: "Jo Staff", posted_at: null }],
  events: [{ type: "dispatch", revision: 2, at: "2026-10-12T09:10:00+08:00", actor: "Alex Manager", details: { contact: "Production contact" } }],
};
let mgrRecDraftId: string | null = null;
const mgrRecRows = () => {
  const issued = { ...sampleRequest, id: "11111111-1111-4111-8111-000000000004", number: "PR-20261023-000004", revision: 1,
    status: "issued", needed_at: "2026-10-24T18:15:00+08:00", receipts: mgrRecDraftId ? [{ id: mgrRecDraftId, number: "RR-SYNTHETIC", status: "draft", inspector: "Test Inspector", posted_at: null }] : [],
    snapshot: { ...sampleRequest.snapshot, number: "PR-20261023-000004", revision: 1, needed_at: "2026-10-24T18:15:00+08:00",
      lines: [{ inventory_item_id: "3", name: "Fried Chicken – Quarter Leg", unit: "pcs", quantity: 2 }] },
    lines: [{ inventory_item_id: "3", name: "Fried Chicken – Quarter Leg", unit: "pcs", quantity: 2, accepted: 0, rejected: 0, remaining: 2 }] };
  const partial = { ...sampleRequest, id: "11111111-1111-4111-8111-000000000005", number: "PR-SYNTHETIC-PARTIAL", revision: 1,
    status: "partially_received", receipts: [{ id: "33333333-3333-4333-8333-333333333333", number: "RR-POSTED", status: "posted", inspector: "Sam Staff", posted_at: "2026-10-12T11:00:00+08:00" }],
    snapshot: { ...issued.snapshot, number: "PR-SYNTHETIC-PARTIAL", needed_at: sampleRequest.needed_at },
    lines: [{ inventory_item_id: "3", name: "Fried Chicken – Quarter Leg", unit: "pcs", quantity: 2, accepted: 1, rejected: 0, remaining: 1 }] };
  const fulfilled = { ...partial, id: "11111111-1111-4111-8111-000000000006", number: "PR-SYNTHETIC-FULL", status: "fulfilled",
    snapshot: { ...partial.snapshot, number: "PR-SYNTHETIC-FULL" },
    lines: [{ ...partial.lines[0], accepted: 2, remaining: 0 }] };
  const closed = { ...partial, id: "11111111-1111-4111-8111-000000000007", number: "PR-SYNTHETIC-CLOSED", status: "closed_short",
    snapshot: { ...partial.snapshot, number: "PR-SYNTHETIC-CLOSED" } };
  return [issued, partial, fulfilled, closed];
};
export const getInventoryRequestRegister = async () => {
  const params = new URLSearchParams(location.search);
  if (params.has("mgrRecError")) throw new Error("Synthetic request register unavailable");
  return params.has("mgrRec") ? mgrRecRows() : [sampleRequest];
};
export const issueInventoryRequest = async () => {
  (window as typeof window & { __fixtureIssueCalls?: number }).__fixtureIssueCalls =
    ((window as typeof window & { __fixtureIssueCalls?: number }).__fixtureIssueCalls ?? 0) + 1;
  throw new Error("Fixture is read only");
};
export const reviseInventoryRequest = issueInventoryRequest;
export const recordInventoryRequestEvent = issueInventoryRequest;
export const setManagerRiderApprovalStatus = issueInventoryRequest;
export const startInventoryRequestReceiving = async (requestId: string, revision: number, reportId: string, ...extra: unknown[]) => {
  if (!new URLSearchParams(location.search).has("mgrRec")) return issueInventoryRequest();
  const state = window as typeof window & { __mgrRecStarts?: unknown[] };
  state.__mgrRecStarts = [...(state.__mgrRecStarts ?? []), { requestId, revision, reportId, argumentCount: 3 + extra.length }];
  mgrRecDraftId = reportId;
  return { id: reportId, rr_number: "RR-SYNTHETIC", status: "draft" };
};
export const closeInventoryRequestShort = issueInventoryRequest;
export const getReplenishmentRequests = async () => [];
export const createReplenishmentRequest = issueInventoryRequest;
export const advanceReplenishmentRequest = issueInventoryRequest;
export const startReplenishmentReceiving = issueInventoryRequest;
const sampleReceipt = {
  id: "33333333-3333-4333-8333-333333333333", rrNumber: "RR-20261012-000001", sourceType: "production_team", sourceReference: "PR-20261012-000001 Rev 2", purchaseOrderId: null, purchaseOrderNumber: null, supplierId: null, supplierName: null,
  receivedAt: "2026-10-12T10:30:00+08:00", receivedBy: "22222222-2222-4222-8222-222222222222", receivedByName: "Alex Manager", status: "posted", supplierDeliveryReference: null, notes: "Inspected by Sam Staff", postedAt: "2026-10-12T11:00:00+08:00", postedBy: "22222222-2222-4222-8222-222222222222", postedByName: "Alex Manager", createdAt: "2026-10-12T10:30:00+08:00", updatedAt: "2026-10-12T11:00:00+08:00",
  items: [{ id: "44444444-4444-4444-8444-444444444444", inventoryItemId: "1", inventoryItemName: "Chicken thigh", unit: "kg", secondaryUnit: null, expiryRequired: true, rotationPolicy: "fefo", purchaseOrderItemId: null, quantityOrdered: null, quantityReceived: null, quantityCancelled: null, quantityRemaining: null, secondaryQuantityOrdered: null, secondaryQuantityReceived: null, quantityDelivered: 3, quantityAccepted: 2, quantityRejected: 1, secondaryQuantityDelivered: null, secondaryQuantityAccepted: null, secondaryQuantityRejected: null, rejectionReason: "Damaged packaging", sourceLotCode: "LOCAL-DEMO-01", manufacturedOn: null, useByDate: "2026-10-24", notes: null, batchId: "55555555-5555-4555-8555-555555555555", batchCode: "LOCAL-DEMO-01", createdAt: "2026-10-12T10:30:00+08:00", updatedAt: "2026-10-12T11:00:00+08:00" }],
};
const sampleDraftReceipt = { ...sampleReceipt, id: "77777777-7777-4777-8777-777777777777", rrNumber: "RR-20261012-000002", status: "draft", receivedAt: "2026-10-12T13:00:00+08:00", postedAt: null, postedBy: null, postedByName: null, items: [{ ...sampleReceipt.items[0], id: "88888888-8888-4888-8888-888888888888", quantityDelivered: 1, quantityAccepted: 1, quantityRejected: 0, rejectionReason: null, sourceLotCode: "LOCAL-DEMO-02", batchId: null, batchCode: null }] };
export const getReceivingWorkspace = async (reportId?: string | null) => {
  const created = mgrRecDraftId ? { ...sampleDraftReceipt, id: mgrRecDraftId, rrNumber: "RR-SYNTHETIC", sourceReference: "PR-20261023-000004 Rev 1", items: [] } : null;
  return { reports: created ? [sampleReceipt, sampleDraftReceipt, created] : [sampleReceipt, sampleDraftReceipt],
    selectedReport: reportId ? reportId === mgrRecDraftId ? created : reportId === sampleDraftReceipt.id ? sampleDraftReceipt : sampleReceipt : null,
    inventoryItems: stockRows.map((row) => ({ id: row.id, itemName: row.itemName, unit: row.unit, secondaryUnit: null, quantityOnHand: row.physicalQuantity, quantityScale: 2, rotationPolicy: "fefo", expiryRequired: true })) };
};
export const getReceivingPolicyEvidence = async () => ({ classification: "formal_request", reason: null, authorizedByName: null, authorizedAt: null, inspectedByName: null, inspectionNote: null });
export const verifyReceivingPolicyAvailable = async () => {};
export const createEmergencyProductionReceiving = issueInventoryRequest;
export class ReceivingPostRejectedError extends Error {
  constructor(message: string, public readonly alreadyPosted: boolean) {
    super(message);
  }
}
export const getReceivingDocuments = async (filters: { status?: string; search?: string } = {}) => ({ rows: filters.status === "posted" || filters.search?.includes("RR-20261012-000001") ? [{
  id: "33333333-3333-4333-8333-333333333333", rrNumber: "RR-20261012-000001", sourceType: "production_team", policyClass: "formal_request",
  sourceReference: "PR-SYNTHETIC", purchaseOrderId: null, purchaseOrderNumber: null, supplierName: null,
  receivedAt: "2026-10-12T10:30:00+08:00", status: "posted", postedAt: "2026-10-12T11:00:00+08:00", lineCount: 1,
  totalDelivered: 2, totalAccepted: 2, totalRejected: 0, updatedAt: "2026-10-12T11:00:00+08:00",
}] : new URLSearchParams(location.search).has("mgrRec") && mgrRecDraftId && filters.status !== "posted" ? [{
  id: mgrRecDraftId, rrNumber: "RR-SYNTHETIC", sourceType: "production_team", policyClass: "formal_request",
  sourceReference: "PR-20261023-000004 Rev 1", purchaseOrderId: null, purchaseOrderNumber: null, supplierName: null,
  receivedAt: "2026-10-23T18:00:00+08:00", status: "draft", postedAt: null, lineCount: 0,
  totalDelivered: 0, totalAccepted: 0, totalRejected: 0, updatedAt: "2026-10-23T18:00:00+08:00",
}] : [], hasMore: false });
export const deleteEmptyReceivingDraft = issueInventoryRequest;
export const updateReceivingDraft = issueInventoryRequest;
export const postReceivingReport = issueInventoryRequest;
export const removeReceivingLine = issueInventoryRequest;
export const saveReceivingLine = issueInventoryRequest;
export const clearReceivingDraftRequestId = () => {};
export const getOrCreateReceivingDraftRequestId = () => crypto.randomUUID();
