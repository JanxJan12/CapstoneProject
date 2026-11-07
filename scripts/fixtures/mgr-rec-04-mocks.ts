export * from "./visual-manager-mocks";
import { getReceivingDocuments as getCreatedDocuments, getReceivingWorkspace as getWorkspace, getInventoryRequestRegister as getRequests, issueInventoryRequest as failFixtureWrite } from "./visual-manager-mocks";

let mgrRec06Items: NonNullable<Awaited<ReturnType<typeof getWorkspace>>["selectedReport"]>["items"] | null = null;
let mgrRec01bPosted = false;

export const getReceivingWorkspace = async (reportId?: string | null) => {
  if (new URLSearchParams(location.search).has("slow"))
    await new Promise((resolve) => setTimeout(resolve, 600));
  const result = await getWorkspace(reportId);
  if (new URLSearchParams(location.search).has("mgrRec01bPost") && result.selectedReport?.status === "draft" && mgrRec01bPosted) {
    return { ...result, selectedReport: { ...result.selectedReport, items: mgrRec06Items ?? result.selectedReport.items, status: "posted" as const, postedAt: "2026-10-24T10:00:00+08:00", postedByName: "Synthetic Manager" } };
  }
  if (new URLSearchParams(location.search).has("optionalExpiry")) {
    return { ...result, inventoryItems: result.inventoryItems.map((item) => item.id === "2" ? { ...item, expiryRequired: false } : item) };
  }
  if (new URLSearchParams(location.search).has("mgrUx08Units") && result.selectedReport) {
    const original = result.selectedReport.items[0];
    const units = original ? [
      { ...original, inventoryItemName: "Whole eggs", unit: "pcs", quantityDelivered: 2, quantityAccepted: 2, quantityRejected: 0 },
      { ...original, id: "11111111-1111-4111-8111-111111111112", inventoryItemId: "2", inventoryItemName: "Soy Sauce", unit: "L", quantityDelivered: 0.06, quantityAccepted: 0.06, quantityRejected: 0 },
    ] : [];
    return { ...result, selectedReport: { ...result.selectedReport, items: units }, inventoryItems: result.inventoryItems.map((item) => ({ ...item, unit: item.id === "1" ? "pcs" : "L" })) };
  }
  if (!new URLSearchParams(location.search).has("mgrRec06Save") || result.selectedReport?.status !== "draft") return result;
  mgrRec06Items ??= [...result.selectedReport.items];
  return { ...result, selectedReport: { ...result.selectedReport, items: mgrRec06Items } };
};

export const getInventoryRequestRegister = async () => {
  const rows = await getRequests();
  if (!new URLSearchParams(location.search).has("mgrUx08Units")) return rows;
  return rows.map((request) => ({ ...request, lines: request.lines.map((line) => ({ ...line, unit: line.inventory_item_id === "1" ? "pcs" : "L" })) }));
};

export const saveReceivingLine = async (input: {
  reportId: string; itemId: string; inventoryItemId: string | null; purchaseOrderItemId: string | null;
  quantityDelivered: number; quantityAccepted: number; secondaryQuantityDelivered: number | null;
  secondaryQuantityAccepted: number | null; rejectionReason: string; sourceLotCode: string;
  manufacturedOn: string | null; useByDate: string | null; notes: string;
}) => {
  if (!new URLSearchParams(location.search).has("mgrRec06Save")) return failFixtureWrite();
  if (new URLSearchParams(location.search).has("mgrUx08Slow")) await new Promise((resolve) => setTimeout(resolve, 450));
  if (new URLSearchParams(location.search).has("mgrUx08Failure")) throw new Error("The receiving service could not be reached. Check your connection and try again.");
  const workspace = await getWorkspace(input.reportId);
  if (!workspace.selectedReport || !input.inventoryItemId) throw new Error("Synthetic fixture only supports linked draft lines.");
  mgrRec06Items ??= [...workspace.selectedReport.items];
  const original = mgrRec06Items.find((item) => item.id === input.itemId);
  const inventoryItem = workspace.inventoryItems.find((item) => item.id === input.inventoryItemId);
  if (!inventoryItem) throw new Error("Synthetic inventory item missing.");
  const updated = {
    ...(original ?? workspace.selectedReport.items[0]),
    id: input.itemId,
    inventoryItemId: input.inventoryItemId,
    inventoryItemName: inventoryItem.itemName,
    unit: inventoryItem.unit,
    quantityDelivered: input.quantityDelivered,
    quantityAccepted: input.quantityAccepted,
    quantityRejected: input.quantityDelivered - input.quantityAccepted,
    rejectionReason: input.rejectionReason || null,
    sourceLotCode: input.sourceLotCode || null,
    manufacturedOn: input.manufacturedOn,
    useByDate: input.useByDate,
    notes: input.notes || null,
  };
  mgrRec06Items = [...mgrRec06Items.filter((item) => item.id !== input.itemId), updated];
  const state = window as typeof window & { __mgrRec06Saves?: unknown[] };
  state.__mgrRec06Saves = [...(state.__mgrRec06Saves ?? []), { id: input.itemId, inventoryItemId: input.inventoryItemId }];
};

export const postReceivingReport = async (reportId: string) => {
  if (!new URLSearchParams(location.search).has("mgrRec01bPost")) return failFixtureWrite();
  if (mgrRec01bPosted) throw new Error("Synthetic duplicate post rejected.");
  const report = (await getWorkspace(reportId)).selectedReport;
  if (!report || report.status !== "draft") throw new Error("Synthetic draft unavailable.");
  const items = mgrRec06Items ?? report.items;
  mgrRec01bPosted = true;
  const acceptedByItem = items.map((item) => ({ item: item.inventoryItemName, accepted: item.quantityAccepted, unit: item.unit }));
  const state = window as typeof window & { __mgrRec01bPosts?: unknown[]; __mgrRec01bAccepted?: unknown[] };
  state.__mgrRec01bPosts = [...(state.__mgrRec01bPosts ?? []), reportId];
  state.__mgrRec01bAccepted = acceptedByItem;
  return { receivingReportId: reportId, rrNumber: report.rrNumber, sourceType: report.sourceType, status: "posted" as const,
    lineCount: items.length, batchCount: items.filter((item) => item.quantityAccepted > 0).length,
    transactionCount: items.filter((item) => item.quantityAccepted > 0).length,
    totalAccepted: items.reduce((sum, item) => sum + item.quantityAccepted, 0), postedAt: "2026-10-24T10:00:00+08:00", postedBy: "22222222-2222-4222-8222-222222222222" };
};

const existing = [
  {
    id: "77777777-7777-4777-8777-777777777777", rrNumber: "RR-20261012-000002",
    sourceType: "production_team", policyClass: "formal_request", sourceReference: "PR-20261012-000001 Rev 2",
    purchaseOrderId: null, purchaseOrderNumber: null, supplierName: null,
    receivedAt: "2026-10-12T13:00:00+08:00", status: "draft", postedAt: null,
    lineCount: 1, totalDelivered: 1, totalAccepted: 1, totalRejected: 0, updatedAt: "2026-10-12T13:00:00+08:00",
  },
  {
    id: "33333333-3333-4333-8333-333333333333", rrNumber: "RR-20261012-000001",
    sourceType: "production_team", policyClass: "formal_request", sourceReference: "PR-20261012-000001 Rev 2",
    purchaseOrderId: null, purchaseOrderNumber: null, supplierName: null,
    receivedAt: "2026-10-12T10:30:00+08:00", status: "posted", postedAt: "2026-10-12T11:00:00+08:00",
    lineCount: 1, totalDelivered: 3, totalAccepted: 2, totalRejected: 1, updatedAt: "2026-10-12T11:00:00+08:00",
  },
  {
    id: "99999999-9999-4999-8999-999999999999", rrNumber: "RR-SYNTHETIC-SUPPLIER",
    sourceType: "direct_supplier", policyClass: "direct_supplier", sourceReference: "SUP-DEMO-01",
    purchaseOrderId: null, purchaseOrderNumber: null, supplierName: "Demo Supplier",
    receivedAt: "2026-10-11T09:00:00+08:00", status: "posted", postedAt: "2026-10-11T10:00:00+08:00",
    lineCount: 1, totalDelivered: 4, totalAccepted: 4, totalRejected: 0, updatedAt: "2026-10-11T10:00:00+08:00",
  },
];

export const getReceivingDocuments = async (filters: { status?: string; search?: string; sourceType?: string }, offset = 0, limit = 20) => {
  const created = await getCreatedDocuments();
  const more = new URLSearchParams(location.search).has("paginate")
    ? Array.from({ length: 22 }, (_, index) => ({
        ...existing[1], id: `synthetic-page-${index}`, rrNumber: `RR-SYNTHETIC-PAGE-${String(index).padStart(2, "0")}`,
      }))
    : [];
  const rows = [...created.rows, ...existing, ...more].filter((row) =>
    (!filters.status || row.status === filters.status) &&
    (!filters.sourceType || row.sourceType === filters.sourceType) &&
    (!filters.search || `${row.rrNumber} ${row.sourceReference}`.toLowerCase().includes(filters.search.toLowerCase()))
  );
  return { rows: rows.slice(offset, offset + limit), hasMore: rows.length > offset + limit };
};
