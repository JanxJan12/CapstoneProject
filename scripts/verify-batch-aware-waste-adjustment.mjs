import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const normalize = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const migration = normalize(
  read("supabase/migrations/20261005013037_batch_aware_waste_adjustment.sql"),
);
const test = normalize(
  read("supabase/tests/verify_batch_aware_waste_adjustment.sql"),
);
const api = read("src/modules/manager/inventory/inventoryApi.ts");
const waste = read("src/modules/manager/inventory/WasteSpoilagePage.tsx");
const adjustment = read("src/modules/manager/inventory/AdjustmentPage.tsx");
const selector = read("src/modules/manager/inventory/InventoryBatchSelect.tsx");

const checks = [];
const check = (condition, name) =>
  checks.push({ condition: Boolean(condition), name });

check(
  migration.startsWith("begin;") && migration.endsWith("commit;"),
  "migration is atomic",
);
check(
  migration.includes("add column quantity_positive_adjustments") &&
    migration.includes(
      "quantity_on_hand <= quantity_initial + quantity_positive_adjustments",
    ),
  "positive corrections preserve initial intake and have a constrained allowance",
);
check(
  migration.includes("add column batch_quantity_before") &&
    migration.includes("add column batch_quantity_after") &&
    migration.includes(
      "batch_quantity_after = batch_quantity_before + quantity_change",
    ),
  "batch ledger stores exact before and after balances",
);
check(
  migration.includes("add column batch_mutation_notes text") &&
    migration.includes(
      "v_existing.batch_mutation_notes is distinct from v_notes",
    ) &&
    api.includes("p_notes: normalizeReason(notes, false)"),
  "optional notes are retained in the ledger and compared on replay",
);
check(
  migration.includes(
    "create function public.get_manager_inventory_batch_context()",
  ) &&
    migration.includes("batch_code") &&
    migration.includes("received_at") &&
    migration.includes("use_by_date") &&
    migration.includes("quantity_on_hand"),
  "Manager batch context includes identity, age, expiry, and current quantity",
);
check(
  migration.includes("profile.role = 'manager'") &&
    migration.includes("profile.is_active = true") &&
    migration.includes("set search_path = ''"),
  "new definer functions check active Manager and use an explicit safe search path",
);
check(
  migration.includes(
    "revoke all on function public.mutate_inventory_batch_quantity",
  ) && migration.includes("from public, anon, authenticated, service_role"),
  "shared mutation engine is not directly callable",
);
check(
  migration.includes("create function public.record_batch_inventory_waste(") &&
    migration.includes("create function public.adjust_inventory_batch_stock("),
  "waste and adjustment have separate public RPCs",
);
check(
  migration.includes("from public, anon;") &&
    migration.includes("to authenticated, service_role;"),
  "business RPCs are granted to authenticated/backend roles only",
);
check(
  migration.includes("pg_advisory_xact_lock") &&
    migration.includes("for update") &&
    migration.includes("assert_batch_inventory_consistent(v_item.id)"),
  "request replay and stock mutation use locks plus invariant checks",
);
check(
  migration.indexOf(
    "perform public.assert_batch_inventory_consistent(v_item.id);",
  ) < migration.indexOf("update public.inventory_batches batch"),
  "aggregate/batch drift is rejected before mutation",
);
check(
  migration.includes("batch stock changed. refresh inventory") &&
    migration.includes("p_expected_batch_quantity"),
  "stale Manager batch balances fail after locking",
);
check(
  migration.includes(
    "inventory_quantity_matches_scale(abs(p_quantity_change)",
  ) &&
    migration.includes(
      "inventory_quantity_matches_scale(p_expected_batch_quantity",
    ),
  "existing quantity scale authority covers movements and displayed balances",
);
check(
  migration.includes("v_batch.inventory_item_id <> v_item.id") &&
    migration.includes("v_batch_after < 0") &&
    migration.includes("v_after < 0"),
  "wrong batch and negative physical balances are rejected",
);
check(
  migration.includes("greatest(p_quantity_change, 0)") &&
    !migration.includes("set quantity_initial ="),
  "positive correction changes allowance rather than intake provenance",
);
check(
  migration.includes("'waste'::public.inventory_transaction_type") &&
    migration.includes("'adjustment'::public.inventory_transaction_type") &&
    migration.includes("inventory_batch_id, performed_by"),
  "ledger distinguishes direct batch waste and adjustment",
);
check(
  !migration.includes("inventory_transaction_batch_allocations") &&
    !migration.includes(
      "create function public.deduct_inventory_for_confirmed_order",
    ) &&
    !migration.includes("create function public.post_receiving_report") &&
    !migration.includes(
      "create function public.initialize_inventory_opening_balance",
    ),
  "migration leaves sales allocation, receiving, and opening authorities intact",
);
check(
  test.startsWith("begin;") &&
    test.endsWith("$rollback_verification$;") &&
    test.includes("using errcode='p6004'") &&
    !test.endsWith("rollback;"),
  "SQL verifier uses database-proven terminal-exception rollback",
);

for (const evidence of [
  "expired batch waste removes the exact physical batch",
  "expired batch waste writes a direct batch-linked negative waste ledger",
  "same waste request returns identical original result",
  "conflicting waste request payload is rejected",
  "conflicting waste notes are rejected on replay",
  "excessive waste is rejected",
  "fractional scale-zero waste is rejected",
  "waste rejects a batch belonging to another item",
  "stale displayed batch balance is rejected",
  "positive adjustment keeps initial intake and records correction allowance",
  "negative adjustment changes batch and aggregate equally",
  "negative correction cannot overdraw a batch",
  "fractional positive correction is rejected for scale zero",
  "positive adjustment cannot create an unidentified new batch",
  "waste refuses pre-existing aggregate/batch drift",
  "adjustment refuses pre-existing aggregate/batch drift",
  "legacy waste and adjustment remain aggregate only",
  "fifo sale after waste consumes three from a and two from b",
  "formal receiving followed by waste leaves batch and aggregate at eight",
  "opening-backed correction changes only identified batch and aggregate",
  "anonymous caller cannot read manager batch context",
  "inactive manager cannot invoke batch adjustment",
  "non-manager cannot invoke batch waste",
  "historical chicken remains unchanged",
]) {
  check(test.includes(evidence), `SQL verifies: ${evidence}`);
}

check(
  api.includes('supabase.rpc("record_batch_inventory_waste"') &&
    api.includes('supabase.rpc("adjust_inventory_batch_stock"') &&
    api.includes('"get_manager_inventory_batch_context"'),
  "Manager API uses the three authorized batch RPCs",
);
check(
  waste.includes("recordBatchInventoryWaste") &&
    waste.includes("recordInventoryWaste") &&
    adjustment.includes("adjustInventoryBatchStock") &&
    adjustment.includes("adjustInventoryStock"),
  "Manager pages branch between batch and legacy authorities",
);
check(
  waste.includes("expectedBatchQuantity: selectedBatch.quantityOnHand") &&
    adjustment.includes("expectedBatchQuantity: selectedBatch.quantityOnHand"),
  "both forms submit the displayed physical balance for stale checks",
);
check(
  waste.includes("selectedBatch?.quantityOnHand") &&
    adjustment.includes("selectedBatch?.quantityOnHand") &&
    waste.includes("quantityScale") &&
    adjustment.includes("quantityScale"),
  "forms validate selected batch capacity and inventory precision",
);
check(
  waste.includes("<InventoryBatchSelect") &&
    adjustment.includes("<InventoryBatchSelect") &&
    selector.includes("Expired") &&
    selector.includes("Current") &&
    selector.includes("Use by") &&
    selector.includes("batchCode"),
  "batch selector identifies physical batches and expiry state",
);

for (const { condition, name } of checks) {
  console.log(`${condition ? "PASS" : "FAIL"}: ${name}`);
}
const failed = checks.filter((entry) => !entry.condition);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);
if (failed.length) process.exitCode = 1;
