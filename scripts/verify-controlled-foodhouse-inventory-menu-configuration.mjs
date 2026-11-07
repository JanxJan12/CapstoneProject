import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "migrations",
    "20261004163102_controlled_foodhouse_inventory_menu_configuration.sql",
  ),
  "utf8",
);
const verification = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "tests",
    "verify_controlled_foodhouse_inventory_menu_configuration.sql",
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

check(
  sql.startsWith("begin;") && sql.endsWith("commit;"),
  "migration is atomic",
);
check(
  sql.includes(
    "lock table public.inventory_items, public.menu_items, public.menu_ingredients in share row exclusive mode",
  ),
  "master-data writes are serialized for deterministic duplicate checks",
);
check(
  sql.includes("phase_6b5c_inventory_config") &&
    sql.includes("phase_6b5c_menu_config"),
  "migration uses explicit controlled configuration sets",
);

for (const name of [
  "Marinated Chicken - Paa",
  "Marinated Chicken - Pecho",
  "Biryani Chicken - Breast",
  "Fried Chicken - Quarter Leg",
]) {
  check(
    sql.includes(`'${name.toLowerCase()}'`),
    `inventory identity is configured: ${name}`,
  );
}

check(sql.includes("'ready-to-cook'"), "inventory category is Ready-to-Cook");
check(
  sql.includes(
    "'pcs', null, 0, 0, 'ready-to-cook', null, 0, 'fifo', true, 2, true, true",
  ),
  "all four stock identities use the approved whole-piece policy",
);
check(
  sql.includes("conflicting configuration") &&
    sql.includes("duplicate phase 6b.5c inventory identities"),
  "existing conflicting or duplicate inventory identities fail clearly",
);
check(
  sql.includes("exactly one active viands menu category"),
  "migration requires the existing active Viands category",
);

const expectedMenus = [
  ["Inasal Paa Unli Rice", "I1", "139"],
  ["Inasal Paa Regular", "I2", "129"],
  ["Inasal Paa No Rice", "I3", "119"],
  ["Inasal Pecho Unli Rice", "I4", "145"],
  ["Inasal Pecho Regular", "I5", "135"],
  ["Inasal Pecho No Rice", "I6", "129"],
  ["Fried Chicken Unli Rice", "F1", "149"],
  ["Fried Chicken Regular", "F2", "129"],
  ["Fried Chicken No Rice", "F3", "119"],
  ["Chicken Biryani", "B3", "209"],
];

for (const [name, code, price] of expectedMenus) {
  check(
    sql.includes(`'${name.toLowerCase()}', '${code.toLowerCase()}', ${price}`),
    `menu and price are configured: ${name}`,
  );
}

check(
  sql.includes("insert into public.menu_items") &&
    sql.includes("true, true, config.menu_code"),
  "new menus are active and manually enabled",
);
check(
  sql.includes("menu.description is not null") &&
    sql.includes("menu.image_path is not null") &&
    sql.includes("menu.aliases <> '{}'::text[]"),
  "reruns reject invented or conflicting merchandising metadata",
);
check(
  sql.includes("insert into public.menu_ingredients") &&
    sql.includes("menu.id, inventory.id, config.quantity_required"),
  "recipe mappings are inserted by resolved IDs",
);
check(
  sql.includes("phase 6b.5c recipe insertion was not exact"),
  "each configured menu is constrained to exactly one confirmed mapping",
);
check(
  sql.includes("historical chicken or its existing recipes changed"),
  "migration guards historical Chicken and its recipes",
);

for (const forbidden of [
  "insert into public.inventory_transactions",
  "insert into public.inventory_batches",
  "insert into public.inventory_opening_balances",
  "insert into public.receiving_reports",
  "insert into public.purchase_orders",
  "initialize_inventory_opening_balance(",
]) {
  check(
    !sql.includes(forbidden),
    `migration excludes operational write: ${forbidden}`,
  );
}

for (const deferred of ["squid roll", "bilao", "tray"]) {
  check(
    !sql.includes(`'${deferred}'`),
    `migration does not configure deferred item: ${deferred}`,
  );
}

check(
  !sql.includes("inventory.item_name = 'rice'") &&
    !sql.includes("'soy sauce'") &&
    !sql.includes("'cooking oil'"),
  "migration does not invent rice, sauce, or oil mappings",
);
check(
  sql.includes("v_missing_inventory_count") &&
    sql.includes("v_missing_menu_count") &&
    sql.includes("v_missing_ingredient_count"),
  "migration supports exact safe reruns without duplicate inserts",
);
check(
  sql.includes(
    "unexpectedly changed operational inventory documents or history",
  ),
  "migration asserts no operational document or ledger side effects",
);

check(
  testSql.startsWith("begin;") && testSql.endsWith("rollback;"),
  "SQL behavior verification rolls back every probe",
);

for (const evidence of [
  "expected business row counts are incorrect",
  "configured inventory item does not match the exact approved policy",
  "configured inventory identity is duplicated",
  "configured menu item does not match the exact approved price or sellable state",
  "configured menu identity is duplicated",
  "configured menu recipe is missing, duplicated, or incorrect",
  "unconfirmed or unintended recipe mapping was created",
  "zero-stock configured menu is effectively available",
  "historical chicken changed",
  "adobong manok historical recipe changed",
  "chicken bicol express historical recipe changed",
  "configuration created stock, batches, opening balances, or operational documents",
  "deferred squid roll, bilao, or tray inventory was created",
  "scale-0 inventory accepted 1.5",
  "scale-0 inventory accepted 2.25",
  "scale-0 recipe accepted 1.5 pieces",
]) {
  check(testSql.includes(evidence), `SQL verification covers: ${evidence}`);
}

for (const result of checks) {
  console.log(`${result.condition ? "PASS" : "FAIL"}: ${result.message}`);
}

const failed = checks.filter((result) => !result.condition);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);
if (failed.length > 0) process.exitCode = 1;
