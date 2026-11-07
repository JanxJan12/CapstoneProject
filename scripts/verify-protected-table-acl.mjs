import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260920000000_harden_protected_table_acl.sql",
);
const liveVerificationPath = path.join(
  root,
  "supabase",
  "tests",
  "verify_protected_table_acl.sql",
);
const baselinePath = path.join(
  root,
  "supabase",
  "migrations",
  "20260825183637_remote_schema.sql",
);
const migrationsRoot = path.join(root, "supabase", "migrations");
const sourceRoot = path.join(root, "src");

const protectedTables = [
  "delivery_assignments",
  "inventory_items",
  "inventory_transactions",
  "menu_categories",
  "menu_ingredients",
  "menu_items",
  "order_items",
  "order_status_history",
  "orders",
  "payments",
  "profiles",
  "purchase_order_items",
  "purchase_orders",
  "supplier_items",
  "suppliers",
];
const mutationMethods = new Set(["insert", "update", "delete", "upsert"]);
const protectedTableMutationFunctions = [
  "accept_rider_offer",
  "adjust_inventory_stock",
  "advance_kds_order",
  "advance_rider_delivery",
  "cancel_order",
  "complete_rider_delivery",
  "create_walk_in_sale",
  "deduct_inventory_for_confirmed_order",
  "handle_new_auth_user",
  "handle_new_user",
  "offer_order_to_next_rider",
  "place_customer_order",
  "receive_inventory_stock",
  "record_inventory_waste",
  "reject_customer_gcash_payment",
  "reject_rider_offer",
  "release_ready_order",
  "set_manager_menu_item_availability",
  "set_manager_rider_approval_status",
  "submit_customer_payment",
  "submit_rider_application",
  "update_cashier_order_operational_details",
  "verify_customer_gcash_payment",
];
const checks = [];

function check(condition, message) {
  checks.push({ condition: Boolean(condition), message });
}

function normalizeSql(sql) {
  return sql.replace(/--.*$/gm, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return /\.(?:[cm]?[jt]sx?)$/i.test(entry.name) ? [entryPath] : [];
  });
}

function collectDirectMutations() {
  const findings = [];

  for (const filePath of listSourceFiles(sourceRoot)) {
    const sourceText = fs.readFileSync(filePath, "utf8");
    const mutationPattern = /\.(insert|update|delete|upsert)\s*\(/g;
    let mutationMatch;

    while ((mutationMatch = mutationPattern.exec(sourceText)) !== null) {
      if (!mutationMethods.has(mutationMatch[1])) {
        continue;
      }

      const statementStart = Math.max(
        0,
        sourceText.lastIndexOf(";", mutationMatch.index) + 1,
      );
      const chainBeforeMutation = sourceText.slice(
        statementStart,
        mutationMatch.index,
      );
      const fromPattern = /\.from\s*\(\s*(["'])([^"']+)\1\s*\)/g;
      const fromMatches = [...chainBeforeMutation.matchAll(fromPattern)];
      const table = fromMatches.at(-1)?.[2] ?? null;

      if (!table || !protectedTables.includes(table)) {
        continue;
      }

      const statementEnd = sourceText.indexOf(";", mutationMatch.index);
      const mutationCall = sourceText.slice(
        mutationMatch.index,
        statementEnd === -1 ? sourceText.length : statementEnd,
      );
      const objectPayload = mutationCall.match(
        /^\.(?:insert|update|delete|upsert)\s*\(\s*\{([\s\S]*?)\}\s*\)/,
      )?.[1];
      const columns = objectPayload
        ? [...objectPayload.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:/g)]
            .map((match) => match[1])
            .sort()
        : [];

      findings.push({
        file: path.relative(root, filePath).replaceAll(path.sep, "/"),
        line: sourceText.slice(0, mutationMatch.index).split(/\r?\n/).length,
        table,
        operation: mutationMatch[1],
        columns,
      });
    }
  }

  return findings;
}

function collectLatestFunctionDefinitions() {
  const definitions = new Map();
  const createFunctionPattern =
    /create\s+(?:or\s+replace\s+)?function\s+(?:"public"|public)\s*\.\s*"?([a-z0-9_]+)"?\s*\(/gi;

  const migrationFiles = fs
    .readdirSync(migrationsRoot)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsRoot, fileName), "utf8");
    const matches = [...sql.matchAll(createFunctionPattern)];

    matches.forEach((match, index) => {
      const functionName = match[1].toLowerCase();
      const nextStart = matches[index + 1]?.index ?? sql.length;
      definitions.set(functionName, {
        fileName,
        sql: sql.slice(match.index, nextStart),
      });
    });
  }

  return definitions;
}

const migration = fs.readFileSync(migrationPath, "utf8");
const normalizedMigration = normalizeSql(migration);
const liveVerification = fs.readFileSync(liveVerificationPath, "utf8");
const normalizedLiveVerification = normalizeSql(liveVerification);
const baseline = fs.readFileSync(baselinePath, "utf8");
const directMutations = collectDirectMutations();
const latestFunctionDefinitions = collectLatestFunctionDefinitions();
const migrationStatements = normalizedMigration
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);
const forbiddenPrivilegeRevoke = migrationStatements.find((statement) =>
  statement.startsWith(
    "revoke truncate, trigger, references, maintain on table",
  ),
);
const directDmlRevoke = migrationStatements.find((statement) =>
  statement.startsWith("revoke insert, update, delete on table"),
);
const defaultPrivilegeRevoke = migrationStatements.find((statement) =>
  statement.startsWith(
    "alter default privileges for role postgres in schema public revoke all on tables",
  ),
);

check(
  directMutations.length === 1,
  `exactly one protected-table client mutation exists (found ${directMutations.length})`,
);
const directMutation = directMutations[0];
check(
  directMutation?.file === "src/modules/customer/customerProfilePage.tsx" &&
    directMutation.table === "profiles" &&
    directMutation.operation === "update" &&
    directMutation.columns.join(",") === "contact_number",
  "the sole direct mutation is authenticated customer UPDATE profiles.contact_number",
);

for (const functionName of protectedTableMutationFunctions) {
  const definition = latestFunctionDefinitions.get(functionName);
  check(
    definition && /\bsecurity\s+definer\b/i.test(definition.sql),
    `${functionName} has a repository-backed SECURITY DEFINER definition`,
  );
}

for (const table of protectedTables) {
  check(
    forbiddenPrivilegeRevoke?.includes(`public.${table}`),
    `non-DML revoke covers public.${table}`,
  );
  check(
    directDmlRevoke?.includes(`public.${table}`),
    `direct-DML revoke covers public.${table}`,
  );
  check(
    normalizedLiveVerification.includes(`'${table}'`),
    `live SQL verifies public.${table}`,
  );

  const quotedRls = new RegExp(
    `alter\\s+table\\s+"public"\\."${table}"\\s+enable\\s+row\\s+level\\s+security`,
    "i",
  );
  check(quotedRls.test(baseline), `baseline enables RLS on public.${table}`);
}

check(
  forbiddenPrivilegeRevoke?.endsWith("from anon, authenticated"),
  "migration revokes TRUNCATE/TRIGGER/REFERENCES/MAINTAIN from both application roles",
);
check(
  directDmlRevoke?.endsWith("from anon, authenticated"),
  "migration revokes direct table-level INSERT/UPDATE/DELETE from both application roles",
);
check(
  defaultPrivilegeRevoke?.endsWith("from anon, authenticated"),
  "future public tables inherit no automatic application-role privileges",
);
check(
  normalizedMigration.includes(
    "revoke update (first_name, last_name) on table public.profiles from authenticated",
  ),
  "migration removes unused profile name-column updates",
);
check(
  normalizedMigration.includes(
    "grant update (contact_number) on table public.profiles to authenticated",
  ),
  "migration preserves only the required direct profile write",
);
check(
  !/revoke\s+[^;]*\bselect\b/i.test(migration),
  "migration does not revoke SELECT on existing tables",
);
check(
  !/\b(?:function|procedure|routine|execute)\b/i.test(
    migration.replace(/--.*$/gm, ""),
  ),
  "migration leaves all RPC definitions and execute ACLs untouched",
);
check(
  !/\b(?:create|alter|drop)\s+(?:table|policy)\b/i.test(
    migration.replace(/--.*$/gm, ""),
  ),
  "migration does not change schemas or RLS policies",
);
check(
  !/\bservice_role\b|\b(?:from|to)\s+postgres\b/i.test(
    migration.replace(/--.*$/gm, ""),
  ),
  "migration does not change privileges granted to service_role or postgres",
);
check(
  normalizedLiveVerification.includes("has_table_privilege") &&
    normalizedLiveVerification.includes("has_column_privilege") &&
    normalizedLiveVerification.includes(
      "information_schema.column_privileges",
    ) &&
    normalizedLiveVerification.includes("pg_default_acl"),
  "live SQL asserts table-, column-, and future-table default privileges",
);
check(
  normalizedLiveVerification.includes("relrowsecurity") &&
    normalizedLiveVerification.includes("pg_policies"),
  "live SQL asserts RLS and the required profile-update policy",
);

for (const result of checks) {
  console.log(`${result.condition ? "PASS" : "FAIL"}: ${result.message}`);
}

console.log("\nProtected-table client mutations:");
for (const finding of directMutations) {
  console.log(
    `- ${finding.file}:${finding.line} ${finding.operation.toUpperCase()} ${finding.table} (${finding.columns.join(", ") || "dynamic payload"})`,
  );
}

const failed = checks.filter((result) => !result.condition);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);

if (failed.length > 0) {
  process.exitCode = 1;
}
