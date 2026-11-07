import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { suggestedRequestQuantity, formatRequestQuantity } from "../src/modules/manager/inventory/requestQuantity.ts";

const container = "codex-manager-focused-qa-20261023";
const run = (sql) => {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
    { input: sql, encoding: "utf8", maxBuffer: 2_000_000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
};
const migration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const source = migration("20261012181744_manager_inventory_request_documents.sql");
const current = migration("20261018204755_remove_inventory_request_reason.sql");
const functionSql = (sql, name) => {
  const start = [sql.indexOf(`create function public.${name}(`), sql.indexOf(`create or replace function public.${name}(`)]
    .filter((index) => index >= 0)[0] ?? -1;
  assert.ok(start >= 0, `${name} source missing`);
  const end = sql.indexOf("$function$;", start);
  assert.ok(end > start, `${name} terminator missing`);
  return sql.slice(start, end + "$function$;".length);
};
const setup = readFileSync(new URL("../supabase/tests/manager_request_precision_disposable_setup.sql", import.meta.url), "utf8") + "\n" +
  [functionSql(source, "inventory_request_manager_required"),
   functionSql(source, "get_inventory_request_proposal"),
   functionSql(current, "issue_inventory_request"),
   functionSql(current, "get_inventory_request_register")].join("\n") + `
grant execute on function public.get_inventory_request_proposal(timestamptz),
  public.issue_inventory_request(uuid,text,timestamptz,jsonb,jsonb),
  public.get_inventory_request_register() to authenticated;
`;
if (!run("select to_regclass('public.inventory_request_documents')").trim()) run(setup);
const manager = "11111111-1111-4111-8111-111111111111";
const neededAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const proposal = JSON.parse(run(`begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${manager}',true);
select public.get_inventory_request_proposal('${neededAt}');
rollback;`).split("\n").find((line) => line.startsWith("[")));
const quantities = Object.fromEntries(proposal.map((row) => [row.name, suggestedRequestQuantity(row)]));
assert.equal(quantities["Soy Sauce"], 0.06);
assert.equal(quantities.Vinegar, 0.04);
assert.equal(quantities["Food packs"], 3);
assert.equal(formatRequestQuantity(quantities.Vinegar), "0.04");
const lines = proposal.filter((row) => ["Soy Sauce", "Vinegar", "Food packs"].includes(row.name))
  .map((row) => ({ inventory_item_id: row.id, quantity: quantities[row.name], override_reason: "" }));
const request = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const json = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const result = run(`begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${manager}',true);
select public.issue_inventory_request('${request}','scheduled','${neededAt}',${json(lines)},public.get_inventory_request_proposal('${neededAt}'));
select public.issue_inventory_request('${request}','scheduled','${neededAt}',${json(lines)},public.get_inventory_request_proposal('${neededAt}'));
reset role;
select jsonb_build_object(
  'stored',(select jsonb_object_agg(item_name,requested_quantity) from public.inventory_request_lines where request_id='${request}'),
  'issue_input',(select issue_input from public.inventory_request_documents where id='${request}'),
  'snapshot',(select snapshot from public.inventory_request_revisions where request_id='${request}' and revision=1),
  'register',(select d from jsonb_array_elements(public.get_inventory_request_register()) d where d->>'id'='${request}'),
  'events',(select count(*) from public.inventory_request_events where request_id='${request}'),
  'historical',(select snapshot from public.inventory_request_revisions where request_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and revision=1),
  'stock',(select jsonb_object_agg(item_name,quantity_on_hand) from public.inventory_items)
);
rollback;`);
const objects = result.split("\n").filter((line) => line.startsWith("{"));
assert.equal(objects.length, 3, result);
assert.equal(JSON.parse(objects[0]).id, JSON.parse(objects[1]).id);
assert.equal(JSON.parse(objects[0]).request_number, JSON.parse(objects[1]).request_number, "same request ID must be idempotent");
const proof = JSON.parse(objects[2]);
assert.deepEqual(proof.stored, { "Food packs": 3, "Soy Sauce": 0.06, Vinegar: 0.04 });
assert.deepEqual(proof.issue_input, lines);
assert.equal(proof.events, 1);
assert.equal(proof.historical.number, "PR-HIST-001");
assert.equal(proof.historical.lines[0].quantity, 2);
assert.equal(proof.stock["Soy Sauce"], 0.04);
assert.equal(proof.stock.Vinegar, 0.06);
assert.equal(proof.stock["Food packs"], 2);
for (const line of proof.snapshot.lines) assert.equal(line.quantity, quantities[line.name]);
for (const line of proof.register.lines) assert.equal(line.quantity, quantities[line.name]);
assert.equal(proof.snapshot.number, proof.register.number);
assert.equal(formatRequestQuantity(proof.snapshot.lines.find((line) => line.name === "Vinegar").quantity), "0.04");
const invalidLines = [{ inventory_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", quantity: 0.0399, override_reason: "" }];
assert.throws(() => run(`begin; set local role authenticated;
select set_config('request.jwt.claim.sub','${manager}',true);
select public.issue_inventory_request('dddddddd-dddd-4ddd-8ddd-dddddddddddd','scheduled','${neededAt}',${json(invalidLines)},public.get_inventory_request_proposal('${neededAt}'));
rollback;`), /Invalid item quantity or precision/);
assert.throws(() => run(`begin; set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.issue_inventory_request('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','scheduled','${neededAt}',${json(lines)},public.get_inventory_request_proposal('${neededAt}'));
rollback;`), /Active manager access required/);
assert.equal(run("select count(*) from public.inventory_request_documents"), "1", "all new synthetic requests rolled back");
console.log("PASS: actual Request RPC, Manager role, prepare/review amounts, issue/retry/read-back, invalid precision and Cashier denial, historical snapshot and stock unchanged; transaction rolled back");
