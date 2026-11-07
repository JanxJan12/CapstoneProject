import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "migrations",
    "20261004160118_inventory_master_data_foundation.sql",
  ),
  "utf8",
);
const verification = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "tests",
    "verify_inventory_master_data_foundation.sql",
  ),
  "utf8",
);
const receivingPage = fs.readFileSync(
  path.join(
    root,
    "src",
    "modules",
    "manager",
    "inventory",
    "StockReceivingPage.tsx",
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
const ui = normalize(receivingPage);
const checks = [];
const check = (condition, message) =>
  checks.push({ condition: Boolean(condition), message });

check(
  sql.startsWith("begin;") && sql.endsWith("commit;"),
  "migration is atomic",
);
check(
  sql.includes("add column shelf_life_days smallint") &&
    sql.includes("shelf_life_days is null or shelf_life_days > 0") &&
    sql.includes("shelf_life_days is null or expiry_required"),
  "nullable positive shelf-life policy requires expiry control",
);
check(
  sql.includes("drop constraint inventory_items_expiry_policy_chk") &&
    !sql.includes("check (not expiry_required or rotation_policy = 'fefo')"),
  "expiry policy is decoupled from FEFO",
);
check(
  sql.includes("quantity_scale between 0 and 3") &&
    sql.includes("matching physical numeric(12,3) quantity storage"),
  "metadata precision is reconciled to physical storage",
);
check(
  sql.includes("function public.inventory_quantity_matches_scale") &&
    sql.includes("p_quantity = trunc(p_quantity, p_quantity_scale)"),
  "one reusable pure quantity-scale helper is present",
);

for (const table of [
  "inventory_items",
  "inventory_batches",
  "inventory_transactions",
  "receiving_report_items",
  "purchase_order_items",
  "menu_ingredients",
  "inventory_opening_balances",
]) {
  check(
    sql.includes(`${table}_enforce_quantity`) ||
      (table === "inventory_items" &&
        sql.includes("inventory_items_enforce_quantity_policy")),
    `${table} has base-quantity scale enforcement`,
  );
}

check(
  !sql.includes("secondary_quantity_initial, v_quantity_scale") &&
    !sql.includes("secondary_quantity_delivered, v_quantity_scale"),
  "secondary quantities are not conflated with base quantity_scale",
);
check(
  sql.includes("derive_inventory_use_by_date") &&
    sql.includes("at time zone 'asia/manila'") &&
    sql.includes("p_shelf_life_days - 1"),
  "shelf life uses Asia/Manila calendar Day 1 semantics",
);
check(
  sql.includes(
    "supplied use-by date conflicts with the inventory shelf-life policy",
  ) && sql.includes("expiry-required inventory must include a use-by date"),
  "derived conflicts are rejected and manual expiry remains required",
);
check(
  sql.includes("receiving_report_items_enforce_shelf_life") &&
    sql.includes("inventory_batches_enforce_shelf_life") &&
    sql.includes("receiving_reports_refresh_shelf_life"),
  "draft, header-edit, and posted-batch shelf paths are protected",
);
check(
  sql.includes(
    "add column batch_consumption_enabled boolean not null default false",
  ) && sql.includes("phase 6b.5b does not change consumption"),
  "explicit batch-consumption policy defaults to legacy behavior",
);
check(
  sql.includes("create table public.inventory_opening_balances") &&
    sql.includes("request_id uuid not null unique") &&
    sql.includes("inventory_item_id uuid not null unique"),
  "opening authority has request and one-time item uniqueness",
);
check(
  sql.includes("add value if not exists 'opening_balance'") &&
    sql.includes("opening_balance_id") &&
    sql.includes("inventory_transactions_opening_balance_id_uidx"),
  "opening ledger semantics and traceability are dedicated",
);
check(
  sql.includes("origin_type = 'legacy_opening'") &&
    sql.includes("opening_balance_id is not null") &&
    sql.includes("received_at_is_estimated"),
  "legacy opening batches require auditable authority and can mark estimated receipt time",
);

const openingFunction = sql.match(
  /create function public\.initialize_inventory_opening_balance\([\s\S]*?\$function\$;/,
)?.[0];
check(Boolean(openingFunction), "opening RPC is created");
check(
  openingFunction?.includes("security definer") &&
    openingFunction?.includes("set search_path = public, extensions, pg_temp"),
  "opening RPC is SECURITY DEFINER with a safe search_path",
);
check(
  openingFunction?.includes("auth.uid()") &&
    openingFunction?.includes("role = 'manager'") &&
    openingFunction?.includes("is_active = true"),
  "opening RPC requires an authenticated active Manager",
);
check(
  openingFunction?.includes("request_payload <> v_payload") &&
    openingFunction?.includes("'replayed', true"),
  "opening RPC distinguishes replay from conflicting request reuse",
);
check(
  openingFunction?.includes("jsonb_array_elements(p_batches)") &&
    openingFunction?.includes("'legacy_opening'") &&
    openingFunction?.includes(
      "v_quantity_total := v_quantity_total + v_quantity",
    ),
  "opening RPC preserves multiple physical batches and totals them",
);
check(
  openingFunction?.includes("if v_quantity_total > 0 then") &&
    openingFunction?.includes(
      "'opening_balance'::public.inventory_transaction_type",
    ),
  "zero opening creates no movement while positive opening uses dedicated ledger type",
);
check(
  openingFunction?.includes("not v_item.batch_consumption_enabled") &&
    openingFunction?.includes("v_item.quantity_on_hand <> 0") &&
    openingFunction?.includes("has already entered stock history"),
  "opening is restricted to pristine batch-managed items",
);
check(
  sql.includes(
    "revoke all on function public.initialize_inventory_opening_balance(uuid, jsonb, text, uuid) from public, anon",
  ) &&
    sql.includes(
      "grant execute on function public.initialize_inventory_opening_balance(uuid, jsonb, text, uuid) to authenticated, service_role",
    ),
  "opening RPC has minimum intended execute ACL",
);
check(
  sql.includes(
    "revoke all privileges on table public.inventory_opening_balances from public, anon, authenticated",
  ) &&
    sql.includes(
      "alter table public.inventory_opening_balances enable row level security",
    ),
  "opening table is protected from browser roles",
);
check(
  sql.includes(
    "create or replace function public.save_receiving_report_item",
  ) && sql.includes("receiving base quantities exceed quantity_scale"),
  "receiving draft RPC delegates shelf policy and explicitly validates scale",
);
check(
  !ui.includes('return "a use-by date is required for this inventory item."'),
  "receiving UI no longer blocks backend-derived shelf dates",
);

for (const forbidden of [
  "'paa'",
  "'pecho'",
  "'biryani breast'",
  "'quarter leg'",
  "'squid roll'",
  "kg↔pcs",
  "fifo allocation",
]) {
  check(
    !sql.includes(forbidden),
    `migration excludes out-of-scope behavior: ${forbidden}`,
  );
}

check(
  testSql.startsWith("begin;") && testSql.endsWith("rollback;"),
  "SQL behavior verifier rolls back all fixtures",
);

for (const evidence of [
  "historical chicken changed",
  "zero shelf life was accepted",
  "negative shelf life was accepted",
  "scale-0 aggregate accepted a fraction",
  "legacy receiving accepted scale-0 fraction",
  "adjustment accepted scale-0 fraction",
  "waste accepted scale-0 fraction",
  "recipe accepted quantity beyond item scale",
  "late-monday shelf date was not derived as tuesday",
  "conflicting receiving use-by date was accepted",
  "manual-expiry item accepted no use-by date",
  "non-manager initialized opening stock",
  "anonymous initialized opening stock",
  "multi-batch opening aggregate/batch/ledger result is incorrect",
  "opening replay was not idempotent",
  "conflicting opening replay was accepted",
  "second item initialization was accepted",
  "verified zero opening created stock or movement",
  "failed opening initialization did not roll back atomically",
  "opening authority accepted scale-0 fraction",
  "opening initialization fabricated a receiving report or changed purchase orders",
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
