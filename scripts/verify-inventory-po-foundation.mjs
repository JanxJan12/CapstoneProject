import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260923000000_inventory_po_semantics_foundation.sql",
);
const sqlVerificationPath = path.join(
  root,
  "supabase",
  "tests",
  "verify_inventory_po_foundation.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");
const verification = fs.readFileSync(sqlVerificationPath, "utf8");
const normalizeSql = (sql) =>
  sql.replace(/--.*$/gm, " ").replace(/\s+/g, " ").trim().toLowerCase();
const normalizedMigration = normalizeSql(migration);
const normalizedVerification = normalizeSql(verification);
const checks = [];

function check(condition, message) {
  checks.push({ condition: Boolean(condition), message });
}

const guardPosition = normalizedMigration.indexOf(
  "from public.purchase_order_items",
);
const destructiveConversionPosition = normalizedMigration.indexOf(
  "drop column quantity_remaining",
);
const chickenUpdate = normalizedMigration.match(
  /update public\.inventory_items set ([\s\S]*?) where id = v_chicken_id/,
)?.[1];

check(
  normalizedMigration.startsWith("begin;") &&
    normalizedMigration.endsWith("commit;"),
  "migration is atomic",
);
check(
  guardPosition >= 0 &&
    destructiveConversionPosition > guardPosition &&
    normalizedMigration.includes(
      "lock table public.purchase_order_items in access exclusive mode",
    ) &&
    normalizedMigration.includes("unexpected purchase-order item rows exist"),
  "locked empty-PO-line guard precedes destructive quantity_remaining conversion",
);
check(
  normalizedMigration.includes("add column item_kind text") &&
    normalizedMigration.includes(
      "item_kind in ('raw', 'packaging', 'finished')",
    ),
  "item_kind has the requested nullable textual values",
);
check(
  normalizedMigration.includes(
    "add column secondary_unit character varying(20)",
  ) &&
    normalizedMigration.includes("btrim(secondary_unit) <> ''") &&
    normalizedMigration.includes(
      "lower(btrim(secondary_unit)) <> lower(btrim(unit))",
    ),
  "secondary_unit is nonblank and differs case-insensitively from unit",
);
check(
  normalizedMigration.includes(
    "add column quantity_scale smallint not null default 3",
  ) && normalizedMigration.includes("quantity_scale between 0 and 6"),
  "quantity_scale has the requested default, nullability, and range",
);
check(
  normalizedMigration.includes(
    "add column rotation_policy text not null default 'fifo'",
  ) && normalizedMigration.includes("rotation_policy in ('fifo', 'fefo')"),
  "rotation_policy has the requested default and values",
);
check(
  normalizedMigration.includes(
    "add column expiry_required boolean not null default false",
  ) &&
    normalizedMigration.includes(
      "check (not expiry_required or rotation_policy = 'fefo')",
    ),
  "expiry_required implies FEFO",
);
check(
  normalizedMigration.includes("item_name = 'chicken'") &&
    normalizedMigration.includes("unit = 'kg'") &&
    chickenUpdate?.includes("item_kind = 'raw'") &&
    chickenUpdate?.includes("secondary_unit = 'pcs'") &&
    chickenUpdate?.includes("quantity_scale = 3") &&
    chickenUpdate?.includes("rotation_policy = 'fefo'") &&
    chickenUpdate?.includes("expiry_required = true") &&
    !chickenUpdate?.includes("quantity_on_hand =") &&
    normalizedMigration.includes("and inventory_item.unit = 'kg' for update"),
  "Chicken is row-locked, targeted by verified identity, and only metadata is assigned",
);
check(
  normalizedMigration.includes(
    "v_quantity_after is distinct from v_quantity_before",
  ),
  "migration aborts if Chicken quantity_on_hand changes",
);
check(
  normalizedMigration.includes(
    "add column secondary_quantity_ordered numeric(12,3)",
  ) &&
    normalizedMigration.includes(
      "add column secondary_quantity_received numeric(12,3) not null default 0",
    ) &&
    normalizedMigration.includes(
      "add column quantity_cancelled numeric(12,3) not null default 0",
    ),
  "PO secondary and cancelled quantities match base quantity precision",
);
check(
  normalizedMigration.includes(
    "quantity_received + quantity_cancelled <= quantity_ordered",
  ),
  "received plus cancelled cannot exceed ordered",
);
check(
  !normalizedMigration.includes(
    "secondary_quantity_received <= secondary_quantity_ordered",
  ),
  "secondary received quantity is independent from the expected count",
);
check(
  normalizedMigration.includes(
    "drop constraint purchase_order_items_qty_remaining_le_received_chk",
  ) &&
    normalizedMigration.includes(
      "generated always as ( quantity_ordered - quantity_received - quantity_cancelled ) stored not null",
    ),
  "legacy remaining constraint is removed and remaining is stored generated",
);
check(
  normalizedMigration.includes(
    "create index purchase_order_items_quantity_remaining_idx on public.purchase_order_items using btree (quantity_remaining)",
  ),
  "quantity_remaining index is recreated",
);
check(
  !/\b(?:grant|revoke)\b/i.test(migration.replace(/--.*$/gm, "")) &&
    !/\b(?:create|alter|drop)\s+policy\b/i.test(
      migration.replace(/--.*$/gm, ""),
    ),
  "migration does not change ACLs or RLS policies",
);

const forbiddenOperationalTables = [
  "receiving_reports",
  "receiving_report_items",
  "inventory_batches",
  "inventory_locations",
  "inventory_allocations",
  "production_batches",
  "production_inputs",
  "production_outputs",
];
for (const table of forbiddenOperationalTables) {
  check(
    !new RegExp(
      `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+${table}`,
      "i",
    ).test(migration),
    `migration does not create ${table}`,
  );
}

check(
  normalizedVerification.startsWith("begin;") &&
    normalizedVerification.endsWith("rollback;"),
  "SQL behavior verifier rolls back all writes",
);
check(
  normalizedVerification.includes("attgenerated") &&
    normalizedVerification.includes(
      "quantity_ordered-quantity_received-quantity_cancelled",
    ),
  "SQL verifier inspects the stored generated expression",
);
check(
  normalizedVerification.includes("invalid item_kind was accepted") &&
    normalizedVerification.includes("invalid rotation_policy was accepted") &&
    normalizedVerification.includes("invalid quantity_scale was accepted") &&
    normalizedVerification.includes(
      "expiry_required item was allowed to use fifo",
    ),
  "SQL verifier exercises invalid inventory metadata",
);
check(
  normalizedVerification.includes(
    "received plus cancelled quantity above ordered was accepted",
  ) &&
    normalizedVerification.includes(
      "generated po arithmetic or independent secondary receipt semantics failed",
    ),
  "SQL verifier exercises PO arithmetic and constraints",
);
check(
  normalizedVerification.includes("has_table_privilege") &&
    normalizedVerification.includes("'select'") &&
    normalizedVerification.includes("'insert, update, delete'"),
  "SQL verifier confirms SELECT compatibility without direct DML",
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
