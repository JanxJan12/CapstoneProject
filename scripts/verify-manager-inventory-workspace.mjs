import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const read = (path) => readFileSync(path, "utf8");
const sql = read(
  "supabase/migrations/20261005082921_manager_inventory_workspace_reads.sql",
);
const manager = read("src/modules/manager/index.tsx");
const receiving = read(
  "src/modules/manager/inventory/ReceivingDocumentList.tsx",
);
const api = read("src/modules/manager/inventory/inventoryApi.ts");
const movements = read("src/modules/manager/inventory/InvTransactionsPage.tsx");
const auditPage = read("src/modules/manager/inventory/InventoryAuditPage.tsx");
const auditSql = read(
  "supabase/migrations/20261019095803_manager_inventory_ledger_audits.sql",
);
const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
}

check(
  "summary reuses the sale eligibility authority",
  sql.includes("public.inventory_usable_quantity(item.id)"),
);
check(
  "expiry uses Manila calendar date",
  sql.includes("current_timestamp at time zone 'Asia/Manila'"),
);
check(
  "legacy stock stays aggregate",
  sql.includes(
    "case when item.batch_consumption_enabled and item.expiry_required",
  ),
);
check(
  "item detail reads only selected batches",
  sql.includes("batch.inventory_item_id = p_item_id"),
);
check(
  "sale allocations are retained as several batches",
  sql.includes("public.inventory_transaction_batch_allocations allocation") &&
    sql.includes("jsonb_agg(jsonb_build_object"),
);
check(
  "movement filters and keyset continuation are server-side",
  sql.includes("p_cursor_created_at") &&
    sql.includes("p_from_date") &&
    sql.includes("p_type") &&
    sql.includes(
      "order by transaction_record.created_at desc, transaction_record.id desc",
    ) &&
    sql.includes("limit v_limit + 1"),
);
check(
  "movement search is explicitly limited to loaded rows",
  movements.includes("Search loaded movements") &&
    movements.includes("Search and receipt number check loaded rows only") &&
    movements.includes("displayedRows.filter((row) =>"),
);
check(
  "movement filter reset preserves selected item context and pagination",
  movements.includes("setItemId(initialItemId)") &&
    movements.includes('setSearch("")') &&
    movements.includes("changeFilters(() =>") &&
    movements.includes("cursorRef.current = null"),
);
check(
  "receiving search/status/source/date and pagination are server-side",
  sql.includes("create function public.get_manager_receiving_documents") &&
    sql.includes("p_search") &&
    sql.includes("p_status") &&
    sql.includes("p_source_type") &&
    sql.includes("offset coalesce(p_offset, 0)"),
);
check(
  "all four reads require active Manager",
  (sql.match(/profile\.role = 'manager'/g) ?? []).length === 4,
);
check(
  "all four reads deny public and anon",
  (sql.match(/from public, anon;/g) ?? []).length === 4,
);
check(
  "migration does not change stock data or write authorities",
  !/\b(insert into|update public\.|delete from|create trigger|alter table)\b/i.test(
    sql,
  ),
);
check(
  "Manager keeps dedicated mutation destinations and adds audit",
  manager.includes('case "waste-spoilage"') &&
    manager.includes('case "adjustment"') &&
    manager.includes('case "inventory-audit"'),
);
check(
  "mounted audit reads saved runs and findings rather than the 500-row browser comparison",
  auditPage.includes("getInventoryAudits()") &&
    auditPage.includes("getInventoryAuditItems(selectedId)") &&
    auditPage.includes("runInventoryAudit(requestId.current)") &&
    !auditPage.includes("reconcileInventoryBalances") &&
    !auditPage.includes("getManagerInventoryTransactions"),
);
check(
  "audit schema retains normalized foreign keys and movement/item association",
  auditSql.includes(
    "references public.inventory_audits(id) on delete restrict",
  ) &&
    auditSql.includes(
      "references public.inventory_items(id) on delete restrict",
    ) &&
    auditSql.includes(
      "references public.inventory_transactions(id, inventory_item_id) on delete restrict",
    ) &&
    auditSql.includes("unique (audit_id, inventory_item_id)"),
);
check(
  "audit write shares one statement snapshot and has request-level replay protection",
  auditSql.includes("pg_advisory_xact_lock") &&
    auditSql.includes("request_id uuid not null unique") &&
    auditSql.includes("with ordered as materialized") &&
    auditSql.includes("saved as (") &&
    !auditSql.includes("limit 500"),
);
check(
  "audit writes are Manager-only and direct client writes are denied",
  auditSql.includes("p.role = 'manager'::public.user_role") &&
    auditSql.includes(
      "alter table public.inventory_audits enable row level security",
    ) &&
    auditSql.includes(
      "alter table public.inventory_audit_items enable row level security",
    ) &&
    auditSql.includes("from public, anon, authenticated") &&
    auditSql.includes("inventory_audit_items_immutable"),
);
check(
  "receiving list uses paginated read rather than local newest-100 filtering",
  receiving.includes("getReceivingDocuments(filters, offset, PAGE_SIZE)"),
);
check(
  "overview and detail call the new typed reads",
  api.includes("get_manager_inventory_stock_summary") &&
    api.includes("get_manager_inventory_item_detail"),
);

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { StockQuantities, stockStatus } = await vite.ssrLoadModule(
    "/src/modules/manager/inventory/StockPresentation.tsx",
  );
  const { InventoryBatchList } = await vite.ssrLoadModule(
    "/src/modules/manager/inventory/InventoryBatchList.tsx",
  );
  const { StockMovementList } = await vite.ssrLoadModule(
    "/src/modules/manager/inventory/StockMovementList.tsx",
  );
  const { receivingDocumentLabels } = await vite.ssrLoadModule(
    "/src/modules/manager/inventory/ReceivingDocumentList.tsx",
  );
  for (const status of ["draft", "posted"]) {
    for (const sourceType of ["production_team", "direct_supplier"]) {
      const labels = receivingDocumentLabels({ status, sourceType });
      check(
        `receiving list identifies ${status} ${sourceType}`,
        labels.status === (status === "draft" ? "Draft" : "Posted") &&
          labels.source ===
            (sourceType === "production_team"
              ? "Production Team"
              : "Direct Supplier"),
      );
    }
  }
  const base = {
    id: "00000000-0000-0000-0000-000000000001",
    itemName: "Marinated Chicken - Paa",
    category: "Ready-to-Cook",
    unit: "pcs",
    reorderLevel: 5,
    isActive: true,
    batchConsumptionEnabled: true,
    expiryRequired: true,
    rotationPolicy: "fefo",
    nearestUseBy: "2026-10-06",
    updatedAt: "2026-10-05T00:00:00Z",
  };
  const mixed = {
    ...base,
    physicalQuantity: 15,
    usableQuantity: 10,
    expiredQuantity: 5,
  };
  const expiredOnly = {
    ...base,
    physicalQuantity: 5,
    usableQuantity: 0,
    expiredQuantity: 5,
  };
  const empty = {
    ...base,
    physicalQuantity: 0,
    usableQuantity: 0,
    expiredQuantity: 0,
  };
  const legacy = {
    ...base,
    batchConsumptionEnabled: false,
    expiryRequired: false,
    physicalQuantity: 7,
    usableQuantity: 7,
    expiredQuantity: 0,
    nearestUseBy: null,
  };
  const renderStock = (stock) =>
    renderToStaticMarkup(createElement(StockQuantities, { stock }));
  check(
    "P0 A: mixed physical/usable/expired quantities render separately",
    /15 pcs/.test(renderStock(mixed)) &&
      /10 pcs/.test(renderStock(mixed)) &&
      /5 pcs/.test(renderStock(mixed)),
  );
  check(
    "P0 B: expired-only stock is unusable and out of stock",
    stockStatus(expiredOnly) === "Usable out of stock" &&
      /0 pcs/.test(renderStock(expiredOnly)),
  );
  check(
    "P0 C: zero physical stock is out of stock",
    stockStatus(empty) === "Usable out of stock",
  );
  check(
    "P0 D: batch-disabled stock has no fake expiry field",
    !renderStock(legacy).includes("Expired") &&
      stockStatus(legacy) === "Usable stock available",
  );

  const detail = {
    stock: {
      ...mixed,
      physicalQuantity: 20,
      usableQuantity: 8,
      expiredQuantity: 12,
    },
    batches: [
      {
        id: "a",
        batchCode: "A",
        quantityOnHand: 12,
        receivedAt: "2026-10-01T00:00:00Z",
        useByDate: "2026-10-04",
        status: "expired",
      },
      {
        id: "b",
        batchCode: "B",
        quantityOnHand: 8,
        receivedAt: "2026-10-03T00:00:00Z",
        useByDate: "2026-10-10",
        status: "current",
      },
    ],
  };
  const batchHtml = renderToStaticMarkup(
    createElement(InventoryBatchList, { detail }),
  );
  check(
    "item detail renders both physical batches, dates, balances, and statuses",
    batchHtml.includes("A") &&
      batchHtml.includes("B") &&
      batchHtml.includes("12 pcs") &&
      batchHtml.includes("8 pcs") &&
      batchHtml.includes("Expired") &&
      batchHtml.includes("Current") &&
      batchHtml.includes("Use by"),
  );

  const movement = (id, type, quantity, batches) => ({
    id,
    inventoryItemId: base.id,
    itemName: base.itemName,
    unit: "pcs",
    transactionType: type,
    quantityChange: quantity,
    quantityBefore: 20,
    quantityAfter: 20 + quantity,
    reason: id === "ADJ-1" ? "Count correction" : null,
    referenceLabel: id,
    batches,
    performedByName: "Manager",
    createdAt: "2026-10-05T00:00:00Z",
  });
  const movementHtml = renderToStaticMarkup(
    createElement(StockMovementList, {
      rows: [
        movement("RR-1", "receiving", 20, [{ batchCode: "A", quantity: 20 }]),
        movement("SALE-1", "issuance", -15, [
          { batchCode: "A", quantity: 12 },
          { batchCode: "B", quantity: 3 },
        ]),
        movement("W-1", "waste", -2, [{ batchCode: "B", quantity: 2 }]),
        movement("ADJ-1", "adjustment", 1, [{ batchCode: "B", quantity: 1 }]),
        movement("LONG-1", "restock", 1, [
          { batchCode: "FULL-BATCH-CODE-123456789012345", quantity: 1 },
        ]),
      ],
    }),
  );
  const movementText = movementHtml.replaceAll("<!-- -->", "");
  check(
    "sale displays both allocation batches",
    movementText.includes("A: 12 pcs") && movementText.includes("B: 3 pcs"),
  );
  check(
    "movement list displays receiving, waste, and adjustment",
    movementHtml.includes("Receiving") &&
      movementHtml.includes("Waste") &&
      movementHtml.includes("Adjustment"),
  );
  check(
    "movement rows show signed changes and timestamps without expansion",
    movementText.includes("+20 pcs") &&
      movementText.includes("-15 pcs") &&
      movementHtml.includes('dateTime="2026-10-05T00:00:00Z"') &&
      movementHtml.includes("Manager"),
  );
  check(
    "movement disclosure retains balances, reason, reference, IDs and batches",
    movementHtml.includes("<details") &&
      movementHtml.includes("Details") &&
      movementHtml.includes("Balance before") &&
      movementHtml.includes("Balance after") &&
      movementHtml.includes("Count correction") &&
      movementHtml.includes("SALE-1") &&
      movementHtml.includes("Consumed batches") &&
      movementText.includes("A: 12 pcs") &&
      movementText.includes("B: 3 pcs") &&
      movementText.includes("FULL-BATCH-CODE-123456789012345: 1 pcs"),
  );

  const { InventoryReconciliationPanel } = await vite.ssrLoadModule(
    "/src/modules/manager/inventory/InventoryReconciliationPanel.tsx",
  );
  const auditRows = [
    ["matched", "matched", "pcs", 3, 3, 3],
    ["mismatch", "book_ledger_difference", "kg", 2.5, 3, 3],
    ["incomplete", "no_history", "liters", 4, null, 0],
  ].map(
    (
      [
        result,
        findingCode,
        recordedUnit,
        bookQuantity,
        ledgerQuantity,
        movementCount,
      ],
      index,
    ) => ({
      id: `finding-${index}`,
      auditId: "audit-1",
      inventoryItemId: `item-${index}`,
      itemName: `Item ${index}`,
      recordedUnit,
      bookQuantity,
      ledgerQuantity,
      movementCount,
      result,
      findingCode,
      latestMovementId: movementCount ? `movement-${index}` : null,
    }),
  );
  const auditHtml = renderToStaticMarkup(
    createElement(InventoryReconciliationPanel, {
      run: {
        id: "audit-1",
        performedBy: "manager-1",
        startedAt: "2026-10-19T00:00:00Z",
        completedAt: "2026-10-19T00:00:00Z",
        status: "completed",
        totalItems: 3,
        matchedCount: 1,
        mismatchCount: 1,
        incompleteCount: 1,
        movementRowsExamined: 6,
      },
      rows: auditRows,
      isLoading: false,
      error: "",
      onOpenItem: () => {},
    }),
  );
  const auditText = auditHtml.replaceAll("<!-- -->", "");
  check(
    "audit summary retains distinct counts and read scope",
    auditHtml.includes("1 matched") &&
      auditHtml.includes("1 mismatch") &&
      auditHtml.includes("1 incomplete") &&
      auditHtml.includes("6 movement rows examined"),
  );
  check(
    "audit rows retain mixed units and signed variance without invented ledger values",
    auditText.includes("3 pcs") &&
      auditText.includes("2.5 kg") &&
      auditText.includes("-0.5 kg") &&
      auditText.includes("4 liters") &&
      auditHtml.includes('aria-label="Ledger unavailable"') &&
      auditHtml.includes('aria-label="Variance unavailable"'),
  );
  check(
    "audit mobile and desktop keep item actions and explain exception states",
    (auditHtml.match(/View item details for Item 0/g) ?? []).length === 2 &&
      auditHtml.includes("How results are determined") &&
      auditHtml.includes("Recorded book stock differs") &&
      auditHtml.includes("No movement history is available") &&
      auditHtml.includes("sm:hidden") &&
      auditHtml.includes("hidden sm:block"),
  );
  check(
    "audit history and summary keep readable labels with secondary trace IDs",
    auditPage.includes("auditHistoryLabel(audit, history)") &&
      auditPage.includes("Run and save audit") &&
      auditHtml.includes("Audit details") &&
      auditHtml.includes("Audit ID:") &&
      auditHtml.includes("Manager ID:") &&
      auditHtml.includes("Why mismatch?") &&
      auditHtml.includes("Why incomplete?") &&
      auditHtml.includes("manager-audit-results-table"),
  );
} finally {
  await vite.close();
}

for (const name of checks) console.log(`PASS: ${name}`);
console.log(`${checks.length}/${checks.length} Phase 6B.9 checks passed.`);
