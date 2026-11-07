// Role and compatibility rehearsal on the isolated Track A GoTrue/PostgREST stack.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const runtime = resolve(root, ".tmp/track-a-auth-20261026-targeted");
const container = "supabase_db_rrj_track_a_targeted_20261026";
const expectedUrl = "http://127.0.0.1:64521";
const output = resolve(root, "qa/TRACK-A-LEGACY-ACCESS-LOCAL-20261026.json");
function run(exe, args) {
  const result = spawnSync(exe, args, { encoding: "utf8", shell: exe === "npx.cmd" });
  if (result.status !== 0) throw Error(`${exe}: ${(result.stderr || "").trim().slice(0, 500)}`);
  return result.stdout.trim();
}
const status = JSON.parse(run("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", `"${runtime}"`, "-o", "json"]));
assert.equal(status.API_URL, expectedUrl, "refusing another API");
assert.equal(run("docker", ["inspect", "--format", "{{.State.Running}}", container]), "true");
const sql = (query) => run("docker", ["exec", "-u", "postgres", container, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", query]);
const evidence = { boundary: expectedUrl, fixture: "54-entry targeted synthetic base plus local-only access migration", checks: [], records: {} };
function check(condition, label) { assert.ok(condition, label); evidence.checks.push(label); }
function save(result, error) { evidence.result = result; if (error) evidence.error = error.message; writeFileSync(output, JSON.stringify(evidence, null, 2)); }
async function call(path, body, { token, service = false } = {}) {
  const key = service ? status.SERVICE_ROLE_KEY : status.ANON_KEY;
  const response = await fetch(expectedUrl + path, { method: "POST", redirect: "error", headers: {
    apikey: key, authorization: `Bearer ${token || key}`, "content-type": "application/json",
  }, body: JSON.stringify(body) });
  return { http: response.status, body: await response.json().catch(() => null) };
}
const rpc = (name, body, token) => call(`/rest/v1/rpc/${name}`, body, { token });
async function user(role) {
  const email = `track-a-access-${role}-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString("base64url")}`;
  const created = await call("/auth/v1/admin/users", { email, password, email_confirm: true }, { service: true });
  assert.equal(created.http, 200);
  if (role !== "customer") sql(`update public.profiles set role='${role}',is_active=true where id='${created.body.id}'`);
  const signedIn = await call("/auth/v1/token?grant_type=password", { email, password });
  assert.equal(signedIn.http, 200);
  assert.equal(signedIn.body.user.id, created.body.id);
  return { id: created.body.id, token: signedIn.body.access_token };
}
function item() {
  const id = randomUUID();
  sql(`insert into public.inventory_items(id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled) values ('${id}','__TRACK_A_ACCESS_${id.slice(0,8)}','pcs',0,4,true,0,'fifo',false,true)`);
  return id;
}
function stock(id) { return JSON.parse(sql(`select json_build_object('aggregate',(select quantity_on_hand from public.inventory_items where id='${id}'),'batches',(select count(*) from public.inventory_batches where inventory_item_id='${id}'),'batchQuantity',(select coalesce(sum(quantity_on_hand),0) from public.inventory_batches where inventory_item_id='${id}'),'ledger',(select count(*) from public.inventory_transactions where inventory_item_id='${id}'),'ledgerQuantity',(select coalesce(sum(quantity_change),0) from public.inventory_transactions where inventory_item_id='${id}'))::text`)); }
try {
  evidence.acl = JSON.parse(sql(`select json_build_object('advance_anon',has_function_privilege('anon','public.advance_replenishment_request(uuid,text,text)','EXECUTE'),'advance_authenticated',has_function_privilege('authenticated','public.advance_replenishment_request(uuid,text,text)','EXECUTE'),'read_anon',has_function_privilege('anon','public.get_replenishment_requests()','EXECUTE'),'read_authenticated',has_function_privilege('authenticated','public.get_replenishment_requests()','EXECUTE'),'create_authenticated',has_function_privilege('authenticated','public.create_replenishment_request(uuid,uuid,numeric,timestamptz,text,text)','EXECUTE'),'start_authenticated',has_function_privilege('authenticated','public.start_replenishment_receiving(uuid)','EXECUTE'))::text`));
  check(!evidence.acl.advance_anon && !evidence.acl.advance_authenticated, "obsolete transition EXECUTE removed from anon and authenticated");
  check(!evidence.acl.read_anon && evidence.acl.read_authenticated, "legacy read remains callable only for authenticated profiles");
  check(!evidence.acl.create_authenticated && evidence.acl.start_authenticated, "legacy creation revoked; linked Receiving entry retained");
  const manager = await user("manager"), production = await user("production"), customer = await user("customer");
  check(Boolean(manager.token && production.token && customer.token), "three real local GoTrue role sessions");
  const legacyItem = item(), legacyRequest = randomUUID();
  sql(`insert into public.production_replenishment_requests(id,inventory_item_id,requested_unit,requested_quantity,priority,status,requested_by) values ('${legacyRequest}','${legacyItem}','pcs',3,'normal','ready_for_delivery','${manager.id}')`);
  evidence.records.legacy = { itemId: legacyItem, requestId: legacyRequest, before: stock(legacyItem) };
  const anonRead = await rpc("get_replenishment_requests", {}, null);
  check(anonRead.http !== 200, "anonymous legacy read denied");
  const anonAdvance = await rpc("advance_replenishment_request", { p_request_id: legacyRequest, p_expected_status: "requested", p_next_status: "acknowledged" }, null);
  check(anonAdvance.http !== 200, "anonymous transition denied");
  const productionRead = await rpc("get_replenishment_requests", {}, production.token);
  check(productionRead.http !== 200 && /Manager access required/i.test(productionRead.body?.message || ""), "former Production profile cannot read legacy queue");
  const productionAdvance = await rpc("advance_replenishment_request", { p_request_id: legacyRequest, p_expected_status: "requested", p_next_status: "acknowledged" }, production.token);
  check(productionAdvance.http !== 200 && /permission denied|could not find|not find|EXECUTE/i.test(productionAdvance.body?.message || ""), "former Production profile cannot execute transition");
  evidence.denials = { anonRead: anonRead.http, anonAdvance: anonAdvance.http, productionRead: productionRead.http, productionReadCode: productionRead.body?.code, productionAdvance: productionAdvance.http, productionAdvanceCode: productionAdvance.body?.code };
  const customerRead = await rpc("get_replenishment_requests", {}, customer.token);
  check(customerRead.http !== 200, "unauthorized Customer cannot read legacy history");
  const customerStart = await rpc("start_replenishment_receiving", { p_request_id: legacyRequest }, customer.token);
  check(customerStart.http !== 200, "unauthorized Customer cannot start legacy Receiving");
  const managerRead = await rpc("get_replenishment_requests", {}, manager.token);
  check(managerRead.http === 200 && managerRead.body.some((row) => row.id === legacyRequest), "Manager can read historical legacy request");
  const started = await rpc("start_replenishment_receiving", { p_request_id: legacyRequest }, manager.token);
  check(started.http === 200 && Boolean(started.body.id), "Manager can create linked legacy Receiving draft");
  const legacyReport = started.body.id, legacyLine = randomUUID();
  evidence.records.legacy.reportId = legacyReport;
  const saved = await rpc("save_receiving_report_item", { p_receiving_report_id: legacyReport, p_receiving_report_item_id: legacyLine, p_inventory_item_id: legacyItem, p_purchase_order_item_id: null, p_quantity_delivered: 2, p_quantity_accepted: 1, p_secondary_quantity_delivered: null, p_secondary_quantity_accepted: null, p_rejection_reason: "One rejected", p_source_lot_code: null, p_manufactured_on: null, p_use_by_date: null }, manager.token);
  check(saved.http === 200 && stock(legacyItem).aggregate === 0, "legacy draft saved without stock movement");
  const legacyPost = await rpc("post_receiving_report", { p_receiving_report_id: legacyReport }, manager.token);
  check(legacyPost.http === 200, "Manager posted linked legacy Receiving");
  evidence.records.legacy.after = stock(legacyItem);
  check(evidence.records.legacy.after.aggregate === 1 && evidence.records.legacy.after.batches === 1 && evidence.records.legacy.after.batchQuantity === 1 && evidence.records.legacy.after.ledger === 1 && evidence.records.legacy.after.ledgerQuantity === 1, "legacy accepted-only batch and ledger reconciliation");
  check(sql(`select status from public.production_replenishment_requests where id='${legacyRequest}'`) === "received", "legacy status closed by shared post trigger");
  const historic = await rpc("get_replenishment_requests", {}, manager.token);
  const workspace = await rpc("get_manager_receiving_workspace", { p_receiving_report_id: legacyReport }, manager.token);
  check(historic.http === 200 && historic.body.some((row) => row.id === legacyRequest && row.receiving_report_id === legacyReport) && workspace.http === 200 && workspace.body.selected_report?.id === legacyReport, "Manager can reopen historical legacy request and posted Receiving");

  const formalItem = item(), formalRequest = randomUUID(), formalReport = randomUUID(), formalLine = randomUUID();
  const neededAt = new Date(Date.now() + 48 * 3600_000).toISOString();
  evidence.records.formal = { itemId: formalItem, requestId: formalRequest, reportId: formalReport, before: stock(formalItem) };
  const proposal = await rpc("get_inventory_request_proposal", { p_needed_at: neededAt }, manager.token);
  check(proposal.http === 200 && proposal.body.some((row) => row.id === formalItem), "Manager formal proposal remains available");
  const issue = await rpc("issue_inventory_request", { p_request_id: formalRequest, p_priority: "scheduled", p_needed_at: neededAt, p_lines: [{ inventory_item_id: formalItem, quantity: 4, override_reason: "" }], p_expected: proposal.body }, manager.token);
  check(issue.http === 200 && issue.body.id === formalRequest, "Manager formal request issuance remains functional");
  const formalStart = await rpc("start_inventory_request_receiving", { p_request_id: formalRequest, p_revision: 1, p_report_id: formalReport, p_inspected_by_name: null, p_inspection_note: "Synthetic access regression" }, manager.token);
  check(formalStart.http === 200 && stock(formalItem).aggregate === 0, "Manager linked formal Receiving draft without stock movement");
  const formalSave = await rpc("save_receiving_report_item", { p_receiving_report_id: formalReport, p_receiving_report_item_id: formalLine, p_inventory_item_id: formalItem, p_purchase_order_item_id: null, p_quantity_delivered: 2, p_quantity_accepted: 1, p_secondary_quantity_delivered: null, p_secondary_quantity_accepted: null, p_rejection_reason: "One rejected", p_source_lot_code: null, p_manufactured_on: null, p_use_by_date: null }, manager.token);
  check(formalSave.http === 200 && stock(formalItem).aggregate === 0, "formal draft saved without stock movement");
  const formalPost = await rpc("post_receiving_report", { p_receiving_report_id: formalReport }, manager.token);
  check(formalPost.http === 200, "Manager formal Receiving post remains functional");
  evidence.records.formal.after = stock(formalItem);
  check(evidence.records.formal.after.aggregate === 1 && evidence.records.formal.after.batches === 1 && evidence.records.formal.after.batchQuantity === 1 && evidence.records.formal.after.ledger === 1 && evidence.records.formal.after.ledgerQuantity === 1, "formal accepted-only batch and ledger reconciliation");
  const duplicate = await rpc("post_receiving_report", { p_receiving_report_id: formalReport }, manager.token);
  check(duplicate.http !== 200 && /already posted/i.test(duplicate.body?.message || "") && JSON.stringify(stock(formalItem)) === JSON.stringify(evidence.records.formal.after), "formal duplicate post rejected without stock mutation");
  save("PASS");
  console.log(`PASS ${evidence.checks.length} local Auth/RPC/Receiving checks; evidence: ${output}`);
} catch (error) {
  save("FAIL", error);
  throw error;
}
