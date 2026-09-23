import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260923010000_receiving_batch_foundation.sql",
);
const sqlVerificationPath = path.join(
  root,
  "supabase",
  "tests",
  "verify_receiving_batch_foundation.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");
const verification = fs.readFileSync(sqlVerificationPath, "utf8");
const stripSqlComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
const normalizeSql = (sql) =>
  stripSqlComments(sql).replace(/\s+/g, " ").trim().toLowerCase();
const normalizedMigration = normalizeSql(migration);
const normalizedVerification = normalizeSql(verification);
const checks = [];

function check(condition, message) {
  checks.push({ condition: Boolean(condition), message });
}

function tableDefinition(tableName) {
  return normalizedMigration.match(
    new RegExp(
      `create table public\\.${tableName} \\(\\s*([\\s\\S]*?)\\s*\\);`,
    ),
  )?.[1];
}

const reports = tableDefinition("receiving_reports") ?? "";
const reportItems = tableDefinition("receiving_report_items") ?? "";
const batches = tableDefinition("inventory_batches") ?? "";

check(
  normalizedMigration.startsWith("begin;") &&
    normalizedMigration.endsWith("commit;"),
  "migration is atomic",
);

check(
  reports.includes("id uuid primary key default gen_random_uuid()") &&
    reports.includes("rr_number character varying(50) not null unique") &&
    reports.includes("purchase_order_id uuid not null") &&
    reports.includes("received_at timestamp with time zone not null") &&
    reports.includes("received_by uuid not null") &&
    reports.includes("status text not null default 'draft'") &&
    reports.includes("supplier_delivery_reference text") &&
    reports.includes("posted_at timestamp with time zone") &&
    reports.includes("posted_by uuid") &&
    reports.includes(
      "created_at timestamp with time zone not null default now()",
    ) &&
    reports.includes(
      "updated_at timestamp with time zone not null default now()",
    ),
  "receiving_reports has the expected column contract",
);

check(
  reports.includes("references public.purchase_orders(id)") &&
    reports.match(/references public\.profiles\(id\)/g)?.length === 2 &&
    reports.includes("status in ('draft', 'posted')") &&
    reports.includes(
      "status = 'draft' and posted_at is null and posted_by is null",
    ) &&
    reports.includes(
      "status = 'posted' and posted_at is not null and posted_by is not null",
    ),
  "receiving report references and posting-state constraints are present",
);

check(
  reportItems.includes("receiving_report_id uuid not null") &&
    reportItems.includes("purchase_order_item_id uuid not null") &&
    reportItems.includes("quantity_delivered numeric(12,3) not null") &&
    reportItems.includes("quantity_accepted numeric(12,3) not null") &&
    reportItems.includes("secondary_quantity_delivered numeric(12,3)") &&
    reportItems.includes("secondary_quantity_accepted numeric(12,3)") &&
    reportItems.includes("rejection_reason text") &&
    !/\binventory_item_id\b/.test(reportItems),
  "receiving_report_items has the expected source and quantity columns without duplicated inventory_item_id",
);

check(
  reportItems.includes(
    "quantity_rejected numeric(12,3) generated always as ( quantity_delivered - quantity_accepted ) stored",
  ) &&
    reportItems.includes(
      "secondary_quantity_rejected numeric(12,3) generated always as ( case when secondary_quantity_delivered is null then null else secondary_quantity_delivered - secondary_quantity_accepted end ) stored",
    ),
  "base and secondary rejected quantities use stored generated expressions",
);

check(
  reportItems.includes("quantity_delivered <> 'nan'::numeric") &&
    reportItems.includes("quantity_delivered > 0") &&
    reportItems.includes("quantity_accepted <> 'nan'::numeric") &&
    reportItems.includes("quantity_accepted >= 0") &&
    reportItems.includes("quantity_accepted <= quantity_delivered") &&
    reportItems.includes(
      "(secondary_quantity_delivered is null) = (secondary_quantity_accepted is null)",
    ) &&
    reportItems.includes("secondary_quantity_delivered > 0") &&
    reportItems.includes("secondary_quantity_accepted >= 0") &&
    reportItems.includes(
      "secondary_quantity_accepted <= secondary_quantity_delivered",
    ) &&
    reportItems.includes(
      "not ( quantity_delivered - quantity_accepted > 0 or ( secondary_quantity_delivered is not null and secondary_quantity_delivered - secondary_quantity_accepted > 0 ) )",
    ) &&
    reportItems.includes("btrim(rejection_reason) <> ''"),
  "receiving quantities, pairing, bounds, NaN rejection, and base-or-secondary rejection reason are constrained",
);

check(
  reportItems.includes(
    "unique (receiving_report_id, purchase_order_item_id)",
  ) &&
    reportItems.includes("references public.receiving_reports(id)") &&
    reportItems.includes("references public.purchase_order_items(id)"),
  "receiving item uniqueness and foreign keys are present",
);

check(
  batches.includes("batch_code character varying(100) not null unique") &&
    batches.includes("inventory_item_id uuid not null") &&
    batches.includes("origin_type text not null") &&
    batches.includes("receiving_report_item_id uuid") &&
    batches.includes("supplier_lot_code text") &&
    batches.includes("received_at timestamp with time zone not null") &&
    batches.includes("manufactured_on date") &&
    batches.includes("use_by_date date") &&
    batches.includes("quantity_initial numeric(12,3) not null") &&
    batches.includes("quantity_on_hand numeric(12,3) not null") &&
    batches.includes("secondary_quantity_initial numeric(12,3)") &&
    batches.includes("secondary_quantity_on_hand numeric(12,3)"),
  "inventory_batches has the expected column contract",
);

check(
  batches.includes("origin_type in ('receiving', 'legacy_opening')") &&
    batches.includes(
      "origin_type = 'receiving' and receiving_report_item_id is not null",
    ) &&
    batches.includes(
      "origin_type = 'legacy_opening' and receiving_report_item_id is null",
    ),
  "inventory batch origin values and source-reference rules are constrained",
);

check(
  batches.includes("quantity_initial <> 'nan'::numeric") &&
    batches.includes("quantity_initial > 0") &&
    batches.includes("quantity_on_hand <> 'nan'::numeric") &&
    batches.includes("quantity_on_hand >= 0") &&
    batches.includes("quantity_on_hand <= quantity_initial") &&
    batches.includes(
      "(secondary_quantity_initial is null) = (secondary_quantity_on_hand is null)",
    ) &&
    batches.includes("secondary_quantity_initial > 0") &&
    batches.includes("secondary_quantity_on_hand >= 0") &&
    batches.includes(
      "secondary_quantity_on_hand <= secondary_quantity_initial",
    ) &&
    batches.includes("manufactured_on <= use_by_date"),
  "inventory batch base, secondary, and date balances are constrained",
);

check(
  normalizedMigration.includes(
    "alter table public.inventory_transactions add column inventory_batch_id uuid, add constraint inventory_transactions_inventory_batch_id_fkey foreign key (inventory_batch_id) references public.inventory_batches(id)",
  ) &&
    normalizedMigration.includes(
      "create index inventory_transactions_inventory_batch_id_idx on public.inventory_transactions using btree (inventory_batch_id)",
    ),
  "inventory transactions receive a nullable, indexed batch foreign key",
);

const expectedIndexes = [
  "receiving_reports_purchase_order_id_idx",
  "receiving_reports_status_received_at_idx",
  "receiving_report_items_purchase_order_item_id_idx",
  "inventory_batches_receiving_report_item_id_idx",
  "inventory_batches_inventory_item_fefo_idx",
  "inventory_transactions_inventory_batch_id_idx",
];
for (const indexName of expectedIndexes) {
  check(
    normalizedMigration.includes(`create index ${indexName}`),
    `migration creates ${indexName}`,
  );
}
check(
  normalizedMigration.includes(
    "unique (receiving_report_id, purchase_order_item_id)",
  ) &&
    normalizedMigration.includes(
      "inventory_batches_inventory_item_fefo_idx on public.inventory_batches using btree ( inventory_item_id, use_by_date, received_at )",
    ),
  "existing unique/composite indexes cover report-item and inventory-item lookups without duplicates",
);

for (const table of [
  "receiving_reports",
  "receiving_report_items",
  "inventory_batches",
]) {
  check(
    normalizedMigration.includes(
      `alter table public.${table} enable row level security`,
    ),
    `RLS is enabled on public.${table}`,
  );
}

check(
  normalizedMigration.includes(
    "revoke all privileges on table public.receiving_reports, public.receiving_report_items, public.inventory_batches from anon, authenticated",
  ) &&
    !/grant\s+[\s\S]*?\s+to\s+(?:anon|authenticated)\b/.test(
      normalizedMigration,
    ) &&
    !/create\s+policy\b/.test(normalizedMigration),
  "application roles receive no table grants or client policies",
);
check(
  normalizedMigration.includes(
    "grant all privileges on table public.receiving_reports, public.receiving_report_items, public.inventory_batches to service_role",
  ),
  "service_role operation is preserved",
);

check(
  !/\bupdate\s+public\.inventory_items\b/.test(normalizedMigration) &&
    !/\bquantity_on_hand\s*=/.test(normalizedMigration),
  "migration does not write inventory_items.quantity_on_hand",
);
check(
  !/\binsert\s+into\s+public\.inventory_transactions\b/.test(
    normalizedMigration,
  ) && !/\bupdate\s+public\.inventory_transactions\b/.test(normalizedMigration),
  "migration creates no inventory transaction rows or historical backfill",
);
check(
  !/\binsert\s+into\s+public\.inventory_batches\b/.test(normalizedMigration),
  "migration creates no legacy-opening or receiving batch rows",
);
check(
  !/\b(?:create|replace)\s+(?:or\s+replace\s+)?(?:function|procedure)\b/.test(
    normalizedMigration,
  ),
  "migration implements no posting or transition RPC",
);

const forbiddenTables = [
  "inventory_locations",
  "inventory_allocations",
  "production_batches",
  "production_inputs",
  "production_outputs",
  "reservations",
];
for (const table of forbiddenTables) {
  check(
    !new RegExp(`create\\s+table\\s+(?:public\\.)?${table}\\b`).test(
      normalizedMigration,
    ),
    `migration does not create forbidden future table ${table}`,
  );
}

const invariantPhrases = [
  "belongs to the receiving report purchase order",
  "purchase-order item determines the inventory item",
  "sum of new receiving-batch base quantities",
  "sum of batch secondary quantities",
  "secondary_unit require secondary receiving quantities",
  "expiry_required = true",
  "increments the po item received quantity",
  "does not increment po received or cancelled quantity",
  "future authoritative posting performs inventory balance and transaction updates",
];
for (const phrase of invariantPhrases) {
  check(
    migration.toLowerCase().includes(phrase),
    `future posting invariant is documented: ${phrase}`,
  );
}

check(
  normalizedVerification.startsWith("begin;") &&
    normalizedVerification.endsWith("rollback;"),
  "SQL verifier rolls back every behavioral write",
);
check(
  normalizedVerification.includes("attgenerated = 's'") &&
    normalizedVerification.includes(
      "generated rejected quantity arithmetic failed",
    ),
  "SQL verifier checks generated expressions in catalog and behavior",
);
check(
  normalizedVerification.includes(
    "values (gen_random_uuid(), gen_random_uuid(), 5, 5, 6, 5)",
  ) &&
    normalizedVerification.includes(
      "secondary-only rejected quantity without a reason was accepted",
    ),
  "SQL verifier rejects a secondary-only rejection without a reason",
);
check(
  normalizedVerification.includes("relrowsecurity") &&
    normalizedVerification.includes("has_table_privilege") &&
    normalizedVerification.includes("unexpected client policy"),
  "SQL verifier checks RLS, grants, and policy absence",
);
check(
  normalizedVerification.includes(
    "a historical inventory transaction was assigned a batch",
  ) &&
    normalizedVerification.includes("inventory_batch_id") &&
    normalizedVerification.includes("is_nullable = 'yes'"),
  "SQL verifier checks nullable historical transaction semantics",
);
check(
  normalizedVerification.includes("future posting invariants are incomplete") &&
    normalizedVerification.includes("po invariant is missing"),
  "SQL verifier checks future posting documentation",
);

for (const result of checks) {
  console.log(`${result.condition ? "PASS" : "FAIL"}: ${result.message}`);
}

const failed = checks.filter((result) => !result.condition);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);

if (failed.length > 0) {
  process.exitCode = 1;
}
