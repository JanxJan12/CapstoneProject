import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "migrations",
    "20261004170254_fifo_batch_aware_sales_consumption.sql",
  ),
  "utf8",
);
const verification = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "tests",
    "verify_fifo_batch_aware_sales_consumption.sql",
  ),
  "utf8",
);

const normalize = (value) =>
  value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const sql = normalize(migration);
const testSql = normalize(verification);
const checks = [];
const check = (condition, message) =>
  checks.push({ condition: Boolean(condition), message });

const functionBody = (name) =>
  sql.match(
    new RegExp(
      `create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$function\\$;`,
    ),
  )?.[0] ?? "";

const usableQuantity = functionBody("inventory_usable_quantity");
const consistency = functionBody("assert_batch_inventory_consistent");
const cartValidation = functionBody(
  "assert_inventory_available_for_requested_items",
);
const deduction = functionBody("deduct_inventory_for_confirmed_order");

check(
  sql.startsWith("begin;") && sql.endsWith("commit;"),
  "migration is atomic",
);
check(
  sql.includes("create table public.inventory_transaction_batch_allocations") &&
    sql.includes("inventory_transaction_id uuid not null") &&
    sql.includes("inventory_batch_id uuid not null") &&
    sql.includes("quantity numeric(12,3) not null"),
  "allocation table links one issuance to physical batches with a positive quantity",
);
check(
  sql.includes("unique (inventory_transaction_id, inventory_batch_id)") &&
    sql.includes(
      "inventory_transaction_batch_allocations_quantity_pos_chk check (quantity <> 'nan'::numeric and quantity > 0)",
    ),
  "allocation uniqueness and positive non-NaN quantity are constrained",
);
check(
  sql.includes(
    "alter table public.inventory_transaction_batch_allocations enable row level security",
  ) &&
    sql.includes(
      "revoke all privileges on table public.inventory_transaction_batch_allocations from public, anon, authenticated",
    ) &&
    sql.includes(
      "grant select, insert, update, delete on table public.inventory_transaction_batch_allocations to service_role",
    ),
  "allocation table is RLS-protected from browser roles",
);
check(
  sql.includes("inventory_transaction_batch_allocations_batch_id_idx") &&
    sql.includes("inventory_batches_positive_fifo_idx") &&
    sql.includes("inventory_batches_positive_fefo_idx"),
  "allocation, FIFO, and FEFO lookups are indexed",
);
check(
  sql.includes("enforce_inventory_batch_allocation_integrity") &&
    sql.includes(
      "batch allocation item does not match its issuance transaction",
    ) &&
    sql.includes("inventory_quantity_matches_scale(new.quantity") &&
    sql.includes("new.quantity > v_batch_initial"),
  "allocation trigger enforces issuance identity, item identity, scale, and initial bounds",
);

check(
  usableQuantity.includes("when inventory_item.batch_consumption_enabled") &&
    usableQuantity.includes("sum(batch.quantity_on_hand)") &&
    usableQuantity.includes("batch.quantity_on_hand > 0") &&
    usableQuantity.includes("current_timestamp at time zone 'asia/manila'") &&
    usableQuantity.includes("else inventory_item.quantity_on_hand"),
  "usable quantity uses eligible batches only for batch-enabled items and aggregate stock otherwise",
);
check(
  usableQuantity.includes("batch.use_by_date >="),
  "a batch remains usable on its Manila use-by date",
);
check(
  consistency.includes("if not v_batch_enabled then return") &&
    consistency.includes("sum(batch.quantity_on_hand)") &&
    !consistency.includes("use_by_date"),
  "aggregate consistency includes expired physical stock and skips legacy items",
);

for (const functionName of [
  "get_menu_effective_availability",
  "get_manager_menu_items",
  "set_manager_menu_item_availability",
]) {
  check(
    functionBody(functionName).includes("inventory_usable_quantity"),
    `${functionName} uses batch-aware usable quantity`,
  );
}
check(
  cartValidation.includes("sum((item ->> 'qty')::integer)") &&
    cartValidation.includes(
      "sum(requested.quantity::numeric * menu_ingredient.quantity_required)",
    ) &&
    cartValidation.includes("inventory_usable_quantity"),
  "customer cart validation aggregates menu lines and recipe requirements against usable stock",
);

check(
  deduction.includes(
    "sum(order_item.quantity::numeric * menu_ingredient.quantity_required)",
  ) && deduction.includes("order by menu_ingredient.inventory_item_id"),
  "confirmed-order requirements aggregate per inventory item in deterministic order",
);
check(
  deduction.includes(
    "where inventory_item.id = v_requirement.inventory_item_id for update",
  ),
  "confirmed-order deduction locks inventory item rows",
);
check(
  deduction.includes("for v_batch in select batch.id") &&
    deduction.includes("batch.quantity_on_hand > 0") &&
    deduction.includes("batch.use_by_date >=") &&
    deduction.includes("for update loop null; end loop"),
  "all eligible candidate batches are locked before the usable-quantity recheck",
);
check(
  deduction.includes(
    "case when v_item.rotation_policy = 'fefo' then batch.use_by_date end asc nulls last, batch.received_at asc, batch.id asc",
  ),
  "allocation order implements generic FEFO or FIFO with immutable tie-breaking",
);
check(
  deduction.includes("v_usable_quantity < v_requirement.required_quantity") &&
    deduction.indexOf("v_usable_quantity < v_requirement.required_quantity") >
      deduction.indexOf("for update loop null; end loop"),
  "usable batch quantity is rechecked after locking",
);
check(
  deduction.includes(
    "set quantity_on_hand = v_quantity_after, updated_at = v_now",
  ) &&
    deduction.includes("'issuance'::public.inventory_transaction_type") &&
    deduction.includes("-v_requirement.required_quantity"),
  "aggregate stock and one negative issuance use the total recipe requirement",
);
check(
  deduction.includes(
    "v_allocation := least(v_remaining, v_batch.quantity_on_hand)",
  ) &&
    deduction.includes(
      "set quantity_on_hand = batch.quantity_on_hand - v_allocation",
    ) &&
    deduction.includes(
      "insert into public.inventory_transaction_batch_allocations",
    ),
  "physical batches are decremented and recorded through child allocations",
);
check(
  deduction.includes("v_remaining <> 0") &&
    deduction.includes("allocation total does not reconcile to issuance") &&
    deduction.includes("assert_batch_inventory_consistent(v_item.id)"),
  "allocation completion and aggregate reconciliation are asserted",
);
check(
  deduction.includes("inventory issuance replay integrity error") &&
    deduction.includes("v_existing_allocation_count = 0") &&
    deduction.includes(
      "v_existing_allocation_total <> v_requirement.required_quantity",
    ) &&
    deduction.includes("continue;"),
  "idempotent replay rejects missing or partial allocations and does not consume twice",
);
check(
  sql.includes(
    "revoke all on function public.deduct_inventory_for_confirmed_order(uuid) from public, anon, authenticated",
  ) &&
    sql.includes(
      "grant execute on function public.deduct_inventory_for_confirmed_order(uuid) to service_role",
    ),
  "confirmed-order deduction remains an internal backend authority",
);

for (const [name, evidence] of [
  [
    "receive_inventory_stock",
    "batch-enabled inventory must be received through formal receiving",
  ],
  [
    "adjust_inventory_stock",
    "batch-enabled inventory requires a batch-aware adjustment workflow",
  ],
  [
    "record_inventory_waste",
    "batch-enabled inventory requires a batch-aware waste workflow",
  ],
]) {
  const body = functionBody(name);
  check(
    body.includes("batch_consumption_enabled") && body.includes(evidence),
    `${name} rejects aggregate-only mutation for batch-enabled inventory`,
  );
  check(
    body.includes(`${name}_legacy_aggregate(`),
    `${name} preserves the legacy aggregate implementation for batch-disabled inventory`,
  );
}
check(
  sql.includes(
    "revoke all on function public.receive_inventory_stock_legacy_aggregate",
  ) &&
    sql.includes(
      "revoke all on function public.adjust_inventory_stock_legacy_aggregate",
    ) &&
    sql.includes(
      "revoke all on function public.record_inventory_waste_legacy_aggregate",
    ),
  "renamed aggregate implementations cannot be called directly",
);

for (const forbidden of [
  "marinated chicken",
  "biryani chicken",
  "fried chicken",
  "paa",
  "pecho",
  "quarter leg",
  "adobong manok",
  "chicken bicol express",
]) {
  check(
    !sql.includes(forbidden),
    `migration does not hardcode product identity: ${forbidden}`,
  );
}
for (const deferred of [
  "reservation",
  "void restoration",
  "squid roll",
  "bilao",
  "tray",
]) {
  check(
    !sql.includes(deferred),
    `migration does not implement deferred scope: ${deferred}`,
  );
}
check(
  !sql.includes("create function public.restore_inventory") &&
    !sql.includes("create function public.refund") &&
    !sql.includes("create function public.void_order"),
  "migration does not implement refund or void inventory restoration",
);

check(
  testSql.startsWith("begin;") &&
    testSql.endsWith("$rollback_verification$;") &&
    testSql.includes("intentional rollback sentinel") &&
    testSql.includes("using errcode = 'p6001'") &&
    !testSql.endsWith("rollback;"),
  "SQL verifier uses a terminal exception for database-proven rollback isolation",
);

for (const evidence of [
  "allocation table exists",
  "allocation table has rls enabled",
  "allocation table denies browser-role direct access",
  "basic fifo decrements oldest batch",
  "multi-batch fifo records two allocations totaling seven",
  "expired stock is excluded from usable quantity",
  "use-by-day stock keeps menu available",
  "fefo consumes earliest use-by batch",
  "five fried chicken orders fail against nine quarter legs",
  "multiple paa variants produce one issuance",
  "mixed order writes one issuance per inventory item",
  "confirmation replay creates no second allocation or decrement",
  "partial-allocation replay is rejected as an integrity error",
  "forced failure leaves no issuance transaction",
  "batch-enabled legacy receiving is rejected",
  "batch-enabled aggregate adjustment is rejected",
  "batch-enabled aggregate waste is rejected",
  "formal receiving creates matching batch balance",
  "opening balance creates two batches totaling ten",
  "scale-zero allocation rejects fractional quantity",
  "historical chicken row remains unchanged",
  "historical chicken recipes remain unchanged",
]) {
  check(testSql.includes(evidence), `SQL verifier covers: ${evidence}`);
}

for (const result of checks) {
  console.log(`${result.condition ? "PASS" : "FAIL"}: ${result.message}`);
}

const failed = checks.filter((result) => !result.condition);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);
if (failed.length > 0) process.exitCode = 1;
