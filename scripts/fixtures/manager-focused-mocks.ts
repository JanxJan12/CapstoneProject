export * from "./visual-manager-mocks";

export const closeInventoryRequestShort = async (requestId: string, revision: number, reason: string) => {
  (window as Window & { __shortfallAttempt?: { requestId: string; revision: number; reason: string } }).__shortfallAttempt = { requestId, revision, reason };
  throw new Error("Fixture is read only");
};

const menuItem = (id: string, name: string, code: string, categoryName: string, price: number, isActive = true) =>
  ({ id, name, code, categoryName, price, isActive, description: "Synthetic fixture", manuallyAvailable: true, effectivelyAvailable: true, updatedAt: "2026-10-23T00:00:00Z" });
export const getManagerMenuItems = async () => new URLSearchParams(location.search).has("emptyMeals") ? [
  menuItem("drink-buko", "Buko Juice", "D2", "Drinks", 60),
] : [
  menuItem("meal-biryani", "Chicken Biryani", "B3", "Viands", 209),
  menuItem("meal-other", "Another viand", "V2", "Viands", 145),
  menuItem("drink-buko", "Buko Juice", "D2", "Drinks", 60),
  menuItem("drink-soft", "Softdrinks", "D3", "Drinks", 45),
  menuItem("rice", "White Rice", "R1", "Rice", 35),
  menuItem("inactive", "Inactive viand", "V0", "Viands", 100, false),
];
export const getManagerFixedMealOptions = async () => [
  { menuItemId: "meal-biryani", withoutRicePrice: null, withoutRiceInventoryItemId: null },
  { menuItemId: "meal-other", withoutRicePrice: 120, withoutRiceInventoryItemId: "rice-1" },
];
export const getManagerMealIngredients = async () => [
  { menuItemId: "meal-other", inventoryItemId: "rice-1", inventoryName: "Rice", quantityRequired: 0.2 },
];
export const getManagerMealInventoryCandidates = async () => [
  { inventoryItemId: "rice-1", inventoryName: "Rice", inventoryUnit: "kg" },
];
export const getManagerDrinkChoices = async () => [
  { menuItemId: "drink-buko", choiceKind: "size", optionId: "buko-large", optionName: "Large", priceAdjustment: 15, isActive: true },
  { menuItemId: "drink-soft", choiceKind: "flavor", optionId: "soft-cola", optionName: "Cola", priceAdjustment: 0, isActive: true },
  { menuItemId: "drink-soft", choiceKind: "size", optionId: "soft-large", optionName: "Large", priceAdjustment: 10, isActive: false },
];
export const getRequestProposal = async (neededAt: string) => {
  const state = window as Window & { __proposalNeededCalls?: string[]; __proposalSoyAtNeed?: number; __proposalFlourAtNeed?: number };
  state.__proposalNeededCalls = [...(state.__proposalNeededCalls ?? []), neededAt];
  if (new URLSearchParams(location.search).has("proposalError")) throw new Error("Synthetic proposal unavailable");
  const rows = [
    { id: "soy", name: "Soy Sauce", unit: "L", quantity_scale: 3, reorder_level: 0.1, usable_now: 0.05, valid_at_need: state.__proposalSoyAtNeed ?? 0.04, outstanding: 0, expiry_verified: true },
    { id: "vinegar", name: "Vinegar", unit: "L", quantity_scale: 3, reorder_level: 0.1, usable_now: 0.07, valid_at_need: 0.06, outstanding: 0, expiry_verified: true },
    { id: "pieces", name: new URLSearchParams(location.search).has("longItemName") ? "Food packs for the extended community catering delivery preparation schedule" : "Food packs", unit: "packs", quantity_scale: 0, reorder_level: 6, usable_now: 2, valid_at_need: new URLSearchParams(location.search).has("sixItems") ? 0 : 2, outstanding: 1, expiry_verified: true },
    { id: "buko", name: "Buko Juice", unit: "bottles", quantity_scale: 0, reorder_level: 10, usable_now: 2, valid_at_need: 2, outstanding: 8, expiry_verified: false },
    ...(new URLSearchParams(location.search).has("sixItems") ? [
      { id: "rice", name: "Rice", unit: "kg", quantity_scale: 3, reorder_level: 12, usable_now: 4, valid_at_need: 4, outstanding: 2, expiry_verified: true },
      { id: "oil", name: "Cooking Oil", unit: "L", quantity_scale: 3, reorder_level: 8, usable_now: 3, valid_at_need: 3, outstanding: 0, expiry_verified: true },
    ] : []),
    { id: "flour", name: "All-Purpose Flour", unit: "kg", quantity_scale: 3, reorder_level: 5, usable_now: 10, valid_at_need: state.__proposalFlourAtNeed ?? 10, outstanding: 0, expiry_verified: true },
    ...(new URLSearchParams(location.search).has("contextRemove") ? [
      { id: "biryani-chicken", name: "Biryani Chicken – Breast", unit: "pcs", quantity_scale: 0, reorder_level: 10, usable_now: 15, valid_at_need: 15, outstanding: 0, expiry_verified: true },
      { id: "chicken", name: "Chicken", unit: "kg", quantity_scale: 3, reorder_level: 10, usable_now: 15, valid_at_need: 15, outstanding: 0, expiry_verified: true },
      { id: "fried-chicken-quarter-leg", name: "Fried Chicken – Quarter Leg", unit: "pcs", quantity_scale: 0, reorder_level: 10, usable_now: 15, valid_at_need: 15, outstanding: 2, expiry_verified: true },
      { id: "marinated-chicken-paa", name: "Marinated Chicken – Paa", unit: "pcs", quantity_scale: 0, reorder_level: 10, usable_now: 15, valid_at_need: 15, outstanding: 0, expiry_verified: true },
      { id: "marinated-chicken-pecho", name: "Marinated Chicken – Pecho", unit: "pcs", quantity_scale: 0, reorder_level: 10, usable_now: 15, valid_at_need: 15, outstanding: 0, expiry_verified: true },
    ] : []),
  ];
  // Local-only variant matching the hosted zero-gap arithmetic without copying business data.
  return new URLSearchParams(location.search).has("coveredGaps")
    ? rows.map((item) => ({ ...item, outstanding: Math.max(item.outstanding, item.reorder_level - item.valid_at_need) }))
    : rows;
};
const baseRequest = {
  id: "synthetic-issued", number: "PR-SYNTHETIC-001", revision: 1,
  status: "issued", priority: "scheduled", needed_at: "2026-10-25T10:00:00+08:00", issued_at: "2026-10-23T10:00:00+08:00", issued_by_name: "Synthetic Manager", close_reason: null,
  snapshot: { number: "PR-SYNTHETIC-001", revision: 1, issued_at: "2026-10-23T10:00:00+08:00", issued_by: "synthetic-manager", issued_by_name: "Synthetic Manager", priority: "scheduled", needed_at: "2026-10-25T10:00:00+08:00", destination: "Production", lines: [{ inventory_item_id: "soy", name: "Soy Sauce", unit: "L", quantity: 0.04 }] },
  revisions: [], lines: [{ inventory_item_id: "soy", name: "Soy Sauce", unit: "L", quantity: 0.04, accepted: 0, rejected: 0, remaining: 0.04 }], receipts: [], events: [],
};
let splitIssuedRecord: typeof baseRequest | null = null;
export const issueInventoryRequest = async (input: {
  id: string; priority: "emergency" | "priority" | "scheduled"; neededAt: string;
  lines: Array<{ inventory_item_id: string; quantity: number }>;
}) => {
  if (!new URLSearchParams(location.search).has("splitWorkspace")) throw new Error("Fixture issue is unavailable here.");
  (window as Window & { __issuePayload?: typeof input }).__issuePayload = input;
  const lines = input.lines.map((line) => {
    const item = [{ id: "soy", name: "Soy Sauce", unit: "L" }, { id: "vinegar", name: "Vinegar", unit: "L" }, { id: "pieces", name: "Food packs", unit: "packs" }].find((candidate) => candidate.id === line.inventory_item_id);
    return { ...line, name: item?.name ?? "Unknown item", unit: item?.unit ?? "", accepted: 0, rejected: 0, remaining: line.quantity };
  });
  const issuedAt = new Date().toISOString();
  splitIssuedRecord = { ...baseRequest, id: input.id, number: "PR-SPLIT-NEW", priority: input.priority, needed_at: input.neededAt, issued_at: issuedAt,
    snapshot: { ...baseRequest.snapshot, number: "PR-SPLIT-NEW", priority: input.priority, needed_at: input.neededAt, issued_at: issuedAt, lines: lines.map(({ inventory_item_id, name, unit, quantity }) => ({ inventory_item_id, name, unit, quantity })) },
    lines, receipts: [], events: [{ type: "issued", revision: 1, at: issuedAt, actor: "Synthetic Manager", details: {} }],
  };
  return { id: input.id, request_number: "PR-SPLIT-NEW" };
};
const exportLine = (tail: number, name: string, quantity: number, unit: string) => ({
  inventory_item_id: `11111111-1111-4111-8111-${String(tail).padStart(12, "0")}`,
  name, quantity, unit,
});
export const exportSnapshot = (revision: number, many = false) => ({
  number: "PR-SYNTHETIC-EXPORT", revision,
  issued_at: revision === 1 ? "2026-10-18T23:45:00+08:00" : "2026-10-19T00:15:00+08:00",
  issued_by: "22222222-2222-4222-8222-222222222222", issued_by_name: "Synthetic Manager",
  priority: revision === 1 ? "scheduled" : "priority",
  needed_at: revision === 1 ? "2026-10-20T08:00:00+08:00" : "2026-10-21T08:00:00+08:00",
  destination: "Production",
  lines: revision === 1 ? [exportLine(1, "Chicken", 1, "kg")] : [
    exportLine(1, "Chicken", 2.125, "kg"),
    exportLine(2, "Rice", 12, "packs"),
    exportLine(3, "Long & <special> 'quoted' item name for wrapping and safe HTML rendering", 0.375, "L"),
    ...(many ? Array.from({ length: 33 }, (_, index) => exportLine(index + 4, `Synthetic item ${index + 4} with a longer descriptive name`, index + 1, "pcs")) : []),
  ],
});
export const getInventoryRequestRegister = async () => new URLSearchParams(location.search).has("splitEmpty") ? [] : new URLSearchParams(location.search).has("splitWorkspace") ? (() => {
  const issued = { ...baseRequest, id: "split-issued", number: "PR-SPLIT-ISSUED", issued_at: "2026-10-23T08:00:00+08:00",
    snapshot: { ...baseRequest.snapshot, number: "PR-SPLIT-ISSUED", issued_at: "2026-10-23T08:00:00+08:00", destination: "Production" },
    receipts: [{ id: "split-draft", number: "RR-SPLIT-DRAFT", status: "draft", inspector: "Alex", posted_at: null }],
    events: [{ type: "issued", revision: 1, at: "2026-10-23T08:00:00+08:00", actor: "Synthetic Manager", details: {} }],
  };
  const partialSnapshot = { ...exportSnapshot(2), number: "PR-SPLIT-PARTIAL", destination: "Kitchen" };
  const partial = { ...baseRequest, id: "split-partial", number: "PR-SPLIT-PARTIAL", revision: 2, status: "partially_received",
    issued_at: partialSnapshot.issued_at, needed_at: partialSnapshot.needed_at, priority: partialSnapshot.priority,
    snapshot: partialSnapshot, revisions: [{ revision: 1, snapshot: { ...exportSnapshot(1), number: "PR-SPLIT-PARTIAL", destination: "Kitchen" } }, { revision: 2, snapshot: partialSnapshot }],
    lines: partialSnapshot.lines.map((line) => ({ ...line, accepted: line.name === "Chicken" ? 1.125 : 0, rejected: line.name === "Chicken" ? 0.125 : 0, remaining: line.quantity - (line.name === "Chicken" ? 1.125 : 0) })),
    receipts: [
      { id: "split-posted-1", number: "RR-SPLIT-001", status: "posted", inspector: "Alex", posted_at: "2026-10-20T08:00:00+08:00" },
      { id: "split-posted-2", number: "RR-SPLIT-002", status: "posted", inspector: "Alex", posted_at: "2026-10-21T08:00:00+08:00" },
      { id: "split-draft-2", number: "RR-SPLIT-003", status: "draft", inspector: "Alex", posted_at: null },
    ],
    events: [{ type: "issued", revision: 1, at: "2026-10-18T23:45:00+08:00", actor: "Synthetic Manager", details: {} },
      { type: "revised", revision: 2, at: "2026-10-19T00:15:00+08:00", actor: "Synthetic Manager", details: {} },
      { type: "dispatch", revision: 2, at: "2026-10-19T09:00:00+08:00", actor: "Synthetic Manager", details: {} }],
  };
  const fullSnapshot = { ...exportSnapshot(2), number: "PR-SPLIT-FULL", destination: "Production" };
  const full = { ...baseRequest, id: "split-full", number: "PR-SPLIT-FULL", status: "fulfilled", revision: 2,
    issued_at: "2026-10-22T08:00:00+08:00", snapshot: fullSnapshot, lines: fullSnapshot.lines.map((line) => ({ ...line, accepted: line.quantity, rejected: 0, remaining: 0 })),
    receipts: [{ id: "split-posted-full", number: "RR-SPLIT-FULL", status: "posted", inspector: "Alex", posted_at: "2026-10-23T08:00:00+08:00" }],
  };
  const withoutPartialDraft = new URLSearchParams(location.search).has("splitNoDraft")
    ? { ...partial, receipts: partial.receipts.filter((receipt) => receipt.status === "posted") }
    : partial;
  const revisionCatalogLine = { inventory_item_id: "flour", name: "All-Purpose Flour", unit: "kg", quantity: 1.25 };
  const revisionEligibleIssued = new URLSearchParams(location.search).has("splitRevisionEligible")
    ? { ...issued, receipts: [], ...(new URLSearchParams(location.search).has("revisionCatalogLine") ? {
      lines: [...issued.lines, { ...revisionCatalogLine, accepted: 0, rejected: 0, remaining: 1.25 }],
      snapshot: { ...issued.snapshot, lines: [...issued.snapshot.lines, revisionCatalogLine] },
    } : {}) }
    : issued;
  return splitIssuedRecord ? [splitIssuedRecord, revisionEligibleIssued, withoutPartialDraft, full] : [revisionEligibleIssued, withoutPartialDraft, full];
})() : new URLSearchParams(location.search).has("export") ? (() => {
  const snapshot = exportSnapshot(2, new URLSearchParams(location.search).has("longExport"));
  const first = exportSnapshot(1);
  const status = new URLSearchParams(location.search).get("status") || "issued";
  return [{ ...baseRequest, id: "synthetic-export", number: snapshot.number, revision: 2, status,
    priority: snapshot.priority, needed_at: snapshot.needed_at, issued_at: snapshot.issued_at,
    issued_by_name: snapshot.issued_by_name, snapshot,
    revisions: [{ revision: 1, snapshot: first }, { revision: 2, snapshot }],
    lines: snapshot.lines.map((line) => ({ ...line, accepted: status === "fulfilled" ? line.quantity : 0, rejected: 0,
      remaining: status === "fulfilled" ? 0 : line.quantity })),
  }];
})() : new URLSearchParams(location.search).has("usability") ? [
  { ...baseRequest, id: "past", number: "PR-PAST", needed_at: "2026-10-19T00:00:00+08:00", status: "issued" },
  { ...baseRequest, id: "partial", number: "PR-PARTIAL", needed_at: "2026-10-19T00:00:00+08:00", status: "partially_received", lines: [{ ...baseRequest.lines[0], accepted: 0.02, remaining: 0.02 }], receipts: [
    { id: "posted-1", number: "RR-1", status: "posted", inspector: "Alex", posted_at: "2026-10-20T00:00:00+08:00" },
    { id: "posted-2", number: "RR-2", status: "posted", inspector: "Alex", posted_at: "2026-10-21T00:00:00+08:00" },
  ] },
  { ...baseRequest, id: "full", number: "PR-FULL", needed_at: "2026-10-19T00:00:00+08:00", status: "fulfilled", lines: [{ ...baseRequest.lines[0], accepted: 0.04, remaining: 0 }] },
  baseRequest,
] : [baseRequest];

export const getReplenishmentRequests = async () => new URLSearchParams(location.search).has("legacyEntry") ? [{
  id: "legacy-1", item_name: "Soy Sauce", quantity: 2, unit: "L", priority: "urgent", status: "ready_for_delivery",
  requested_at: "2026-10-18T00:00:00+08:00", requested_by_name: "Alex", needed_at: "2026-10-19T00:00:00+08:00",
  note: null, ready_at: "2026-10-20T00:00:00+08:00", receiving_report_number: null,
  receiving_report_status: null, receiving_report_id: null, events: [],
}] : [];

const order = (id: string, fulfillmentType: string, grandTotal: number) => ({
  id, orderNumber: `ORD-${id.slice(-4)}`, customerName: "Synthetic Customer", customerContactNumber: null,
  deliveryAddress: fulfillmentType === "delivery" ? "Synthetic address" : null, orderChannel: "online",
  fulfillmentType, currentStatus: "delivered", grandTotal, createdAt: "2026-10-22T00:00:00+08:00",
  paymentMethod: "cash", paymentStatus: "verified", paymentAmount: grandTotal, riderName: null,
  items: [{ name: "Stored Adobong Manok", quantity: 1, unitPrice: 120, lineTotal: 120 }],
});
export const getManagerOrders = async () => [
  order("11111111-1111-4111-8111-111111110001", "delivery", 170),
  order("11111111-1111-4111-8111-111111110002", "dine_in", 120),
  order("11111111-1111-4111-8111-111111110003", "delivery", 120),
];
export const getManagerOrderFinancials = async (id: string) => {
  if (new URLSearchParams(location.search).has("missingFinance")) throw new Error("Unavailable");
  return { subtotal: 120, taxAmount: 0, deliveryFee: id.endsWith("1") ? 50 : 0, grandTotal: id.endsWith("1") ? 170 : 120 };
};
