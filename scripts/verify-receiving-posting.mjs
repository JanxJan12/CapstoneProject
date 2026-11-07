import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20261003105241_source_neutral_receiving_posting.sql",
);
const sqlVerificationPath = path.join(
  root,
  "supabase",
  "tests",
  "verify_source_neutral_receiving_posting.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");
const verification = fs.readFileSync(sqlVerificationPath, "utf8");
const stripComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
const normalizeSql = (sql) =>
  stripComments(sql).replace(/\s+/g, " ").trim().toLowerCase();
const normalizedMigration = normalizeSql(migration);
const normalizedVerification = normalizeSql(verification);
const checks = [];

function check(condition, message) {
  checks.push({ condition: Boolean(condition), message });
}

check(
  normalizedMigration.startsWith("begin;") &&
    normalizedMigration.endsWith("commit;"),
  "migration is atomic",
);

check(
  normalizedMigration.includes(
    "add column source_type text not null default 'direct_supplier'",
  ) &&
    normalizedMigration.includes(
      "source_type in ('production_team', 'direct_supplier')",
    ) &&
    normalizedMigration.includes("add column source_reference text"),
  "receiving reports have explicit source-neutral semantics",
);

check(
  normalizedMigration.includes(
    "alter column purchase_order_id drop not null",
  ) &&
    normalizedMigration.includes(
      "source_type = 'production_team' and purchase_order_id is null",
    ) &&
    normalizedMigration.includes(
      "source_type = 'direct_supplier' and purchase_order_id is not null",
    ),
  "report PO linkage is conditional by source",
);

check(
  normalizedMigration.includes("add column inventory_item_id uuid") &&
    normalizedMigration.includes(
      "alter column purchase_order_item_id drop not null",
    ) &&
    normalizedMigration.includes(
      "num_nonnulls(inventory_item_id, purchase_order_item_id) = 1",
    ),
  "receiving lines have one unambiguous item source",
);

check(
  normalizedMigration.includes("add column source_lot_code text") &&
    normalizedMigration.includes("add column manufactured_on date") &&
    normalizedMigration.includes("add column use_by_date date"),
  "receiving lines can carry batch provenance and expiry inputs",
);

check(
  normalizedMigration.includes(
    "create unique index inventory_batches_receiving_report_item_uidx",
  ) &&
    normalizedMigration.includes(
      "create unique index inventory_transactions_receiving_batch_uidx",
    ),
  "batch and receiving-ledger uniqueness guards are present",
);

const functionDefinition = normalizedMigration.match(
  /create function public\.post_receiving_report\([\s\S]*?\$function\$;/,
)?.[0];

check(Boolean(functionDefinition), "one posting RPC is created");
check(
  functionDefinition?.includes("security definer") &&
    functionDefinition?.includes(
      "set search_path = public, extensions, pg_temp",
    ),
  "posting RPC is SECURITY DEFINER with an explicit search_path",
);
check(
  functionDefinition?.includes("v_actor_id := auth.uid()") &&
    functionDefinition?.includes("profile.role = 'manager'") &&
    functionDefinition?.includes("profile.is_active = true"),
  "posting RPC requires an authenticated active Manager",
);
check(
  functionDefinition?.includes("where report.id = p_receiving_report_id") &&
    functionDefinition?.includes("for update") &&
    functionDefinition?.includes("receiving report is already posted") &&
    functionDefinition?.includes("only a draft receiving report can be posted"),
  "report lock and posted/draft replay checks are present",
);
check(
  functionDefinition?.includes("order by report_item.id for update") &&
    functionDefinition?.includes(
      "order by purchase_order_item.id for update",
    ) &&
    functionDefinition?.includes("order by inventory_item.id for update"),
  "lines, PO lines, and inventory rows use stable lock ordering",
);
check(
  functionDefinition?.includes(
    "production team receiving lines require inventory_item_id",
  ) &&
    functionDefinition?.includes(
      "direct supplier receiving lines require a po item",
    ) &&
    functionDefinition?.includes(
      "receiving line po item does not belong to the report purchase order",
    ),
  "posting validates source-specific line semantics and PO ownership",
);
check(
  functionDefinition?.includes(
    "accepted quantity exceeds the po item remaining quantity",
  ) &&
    functionDefinition?.includes(
      "purchase_order_item.quantity_received + v_line.quantity_accepted",
    ) &&
    functionDefinition?.includes("quantity_remaining = 0"),
  "supplier posting prevents over-receipt and updates PO progress",
);
check(
  functionDefinition?.includes(
    "expiry-required inventory must include a use-by date",
  ) && functionDefinition?.includes("v_line.effective_use_by_date"),
  "expiry-required inventory is validated",
);
check(
  functionDefinition?.includes(
    "inventory items with a secondary unit require independent secondary receiving quantities",
  ) && !functionDefinition?.includes("conversion"),
  "secondary quantities remain independent without conversion logic",
);
check(
  functionDefinition?.includes("insert into public.inventory_batches") &&
    functionDefinition?.includes("v_line.quantity_accepted") &&
    functionDefinition?.includes("update public.inventory_items") &&
    functionDefinition?.includes("insert into public.inventory_transactions") &&
    functionDefinition?.includes("v_batch_id"),
  "accepted quantity creates a batch, aggregate update, and linked ledger movement",
);
check(
  functionDefinition?.includes("status = 'posted'") &&
    functionDefinition?.includes("posted_at = v_posted_at") &&
    functionDefinition?.includes("posted_by = v_actor_id"),
  "posting finalizes status and actor fields",
);
check(
  normalizedMigration.includes(
    "revoke all on function public.post_receiving_report(uuid) from public, anon, authenticated",
  ) &&
    normalizedMigration.includes(
      "grant execute on function public.post_receiving_report(uuid) to authenticated, service_role",
    ),
  "posting RPC ACL removes default execution and grants only intended roles",
);
check(
  !normalizedMigration.includes(
    "drop function public.receive_inventory_stock",
  ) &&
    !normalizedMigration.includes(
      "create or replace function public.receive_inventory_stock",
    ) &&
    normalizedMigration.includes(
      "comment on function public.receive_inventory_stock(uuid, numeric, text, uuid)",
    ) &&
    normalizedMigration.includes("legacy/manual aggregate receiving retained"),
  "legacy manual receiving remains active and is marked for later UI transition",
);

for (const forbidden of [
  "marinated chicken",
  "chicken inasal",
  "deduct_inventory_for_confirmed_order",
  "record_inventory_waste",
  "inventory_locations",
  "stock_transfers",
  "production_batches",
]) {
  check(
    !normalizedMigration.includes(forbidden),
    `migration excludes out-of-scope behavior: ${forbidden}`,
  );
}

check(
  normalizedVerification.startsWith("begin;") &&
    normalizedVerification.endsWith("rollback;"),
  "SQL behavior verification rolls back every write",
);

for (const evidence of [
  "production team posting result is incorrect",
  "only accepted production quantity was not added",
  "production receiving batch was not created correctly",
  "production receiving ledger movement is incorrect",
  "duplicate production report posting was accepted",
  "direct supplier po quantities were not updated correctly",
  "supplier line with an invalid po item was posted",
  "receiving line without a source item reference was accepted",
  "rejected quantity without a reason was accepted",
  "secondary quantity was converted or not preserved independently",
  "expiry-required receipt without a use-by date was posted",
  "failed receiving line did not roll back the full report",
  "authenticated non-manager posted a receiving report",
  "production team receipt changed a po quantity",
]) {
  check(
    normalizedVerification.includes(evidence),
    `SQL verification covers: ${evidence}`,
  );
}

check(
  normalizedVerification.includes("has_function_privilege") &&
    normalizedVerification.includes("has_table_privilege") &&
    normalizedVerification.includes("procedure.prosecdef"),
  "SQL verification covers RPC and direct-table security",
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
