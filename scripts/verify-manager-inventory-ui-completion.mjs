import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (...parts) =>
  readFileSync(path.join(root, ...parts), "utf8").replaceAll("\r\n", "\n");

const manager = read("src", "modules", "manager", "index.tsx");
const waste = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "WasteSpoilagePage.tsx",
);
const adjustment = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "AdjustmentPage.tsx",
);
const itemSelect = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "InventoryItemSelect.tsx",
);
const batchSelect = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "InventoryBatchSelect.tsx",
);
const quantityInput = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "InventoryQuantityInput.tsx",
);
const summary = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "InventoryMutationSummary.tsx",
);
const helpers = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "inventoryMutationUi.ts",
);
const api = read("src", "modules", "manager", "inventory", "inventoryApi.ts");
const normalizedBatchSelect = batchSelect.replace(/\s+/g, " ");

const checks = [];
function check(condition, name) {
  checks.push({ condition: Boolean(condition), name });
}

check(
  manager.includes('import("./inventory/AdjustmentPage")') &&
    manager.includes('import("./inventory/WasteSpoilagePage")') &&
    /case "adjustment":\s*return\s*\(\s*<AdjustmentPage\b/.test(manager) &&
    /case "waste-spoilage":\s*return\s*\(\s*<WasteSpoilagePage\b/.test(manager),
  "active Manager routes render the completed inventory pages",
);

for (const [name, page] of [
  ["Waste", waste],
  ["Adjustment", adjustment],
]) {
  check(
    page.includes("<InventoryItemSelect") &&
      page.includes("<InventoryBatchSelect") &&
      page.includes("<InventoryQuantityInput") &&
      page.includes("<InventoryMutationSummary") &&
      page.includes("<InventoryMutationResult"),
    `${name} reuses the shared inventory mutation components`,
  );
  check(
    page.includes("expectedBatchQuantity: selectedBatch.quantityOnHand"),
    `${name} preserves the displayed-batch stale-balance fingerprint`,
  );
  check(
    !page.includes("supabase.from(") && !page.includes("supabase.rpc("),
    `${name} performs no direct Supabase table or RPC access`,
  );
  check(
    page.includes("sm:flex-row") && page.includes("w-full sm:w-auto"),
    `${name} uses responsive header or action layouts`,
  );
}

check(
  waste.includes("recordBatchInventoryWaste") &&
    waste.includes("recordInventoryWaste"),
  "Waste retains batch and legacy aggregate authorities",
);
check(
  adjustment.includes("adjustInventoryBatchStock") &&
    adjustment.includes("adjustInventoryStock"),
  "Adjustment retains batch and legacy aggregate authorities",
);
check(
  adjustment.includes(
    'adjustmentType === "add" ? parsedQuantity : -parsedQuantity',
  ) &&
    adjustment.includes("Increase") &&
    adjustment.includes("Decrease"),
  "Adjustment uses unsigned entry with explicit Increase or Decrease intent",
);
check(
  adjustment.includes("Confirm this stock adjustment?") &&
    waste.includes("Record this inventory loss?"),
  "both mutations provide a compact confirmation review",
);
check(
  waste.includes("Review Waste / Spoilage") &&
    waste.includes("Confirm Waste / Spoilage") &&
    adjustment.includes("Review Adjustment") &&
    adjustment.includes("Confirm Adjustment") &&
    (waste.match(/<InventoryMutationSummary/g) ?? []).length === 1 &&
    (adjustment.match(/<InventoryMutationSummary/g) ?? []).length === 1,
  "review actions are distinct from one final stock confirmation",
);
check(
  waste.includes("Items rejected before Receiving acceptance") &&
    adjustment.includes("Receiving and") &&
    adjustment.includes("not the target balance") &&
    waste.includes('label="Quantity wasted"') &&
    adjustment.includes('label="Adjustment quantity"'),
  "operation-specific warnings and quantity meanings remain visible",
);
check(
  waste.includes("!window.confirm(") &&
    adjustment.includes("!window.confirm(") &&
    waste.includes('setDetails("")') &&
    adjustment.includes('setNote("")') &&
    waste.includes('setSelectedItemId(initialItemId ?? "")') &&
    adjustment.includes('setSelectedItemId(initialItemId ?? "")'),
  "item changes guard entered drafts and Reset retains item context",
);
check(
  waste.includes('required={reason === "Other"}') &&
    waste.includes('reason === "Other" ? (') &&
    waste.includes("{detailsField}") &&
    waste.includes("details.trim()") &&
    adjustment.includes("Additional details") &&
    adjustment.includes("note.trim()") &&
    waste.includes("getOrCreateInventoryMutationRequestId") &&
    adjustment.includes("getOrCreateInventoryMutationRequestId") &&
    waste.includes("submitting.current") &&
    adjustment.includes("submitting.current"),
  "conditional waste justification and duplicate-submission guards remain",
);
check(
  itemSelect.includes("Batch-tracked stock") &&
    itemSelect.includes("Standard stock") &&
    itemSelect.includes("overflow-wrap:anywhere") &&
    itemSelect.includes("Total item stock"),
  "shared item selection preserves stock context and wraps long item names",
);
check(
  batchSelect.includes("batch.batchCode") &&
    batchSelect.includes("Received") &&
    batchSelect.includes("Use by") &&
    batchSelect.includes("Expired") &&
    batchSelect.includes("Current") &&
    normalizedBatchSelect.includes("never selected automatically"),
  "batch selection identifies physical batches without silent FIFO selection",
);
check(
  quantityInput.includes(
    'inputMode={quantityScale === 0 ? "numeric" : "decimal"}',
  ) &&
    helpers.includes("quantityMatchesScale") &&
    helpers.includes("parsedQuantity > 0"),
  "shared quantity handling enforces positive metadata-driven precision",
);
check(
  summary.includes("Selected batch") &&
    summary.includes("Current total") &&
    summary.includes("After") &&
    summary.includes('role="status"'),
  "shared review and success feedback show batch and aggregate consequences",
);
check(
  api.includes("normalizeInventoryMutationError") &&
    api.includes("The selected batch balance changed") &&
    api.includes("Check your connection and try again"),
  "inventory API converts backend failures into operator-facing guidance",
);
check(
  waste.includes('role="alert"') && adjustment.includes('role="alert"'),
  "both pages expose actionable failures to assistive technology",
);

for (const { condition, name } of checks) {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}`);
}

const failed = checks.filter((entry) => !entry.condition);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);
if (failed.length) process.exitCode = 1;
