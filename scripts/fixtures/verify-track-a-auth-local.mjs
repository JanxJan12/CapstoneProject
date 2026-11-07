// One synthetic Manager journey on the dedicated, unlinked loopback fixture.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const runtime = resolve(root, ".tmp/track-a-auth-20261026-targeted");
const container = "supabase_db_rrj_track_a_targeted_20261026";
const expectedUrl = "http://127.0.0.1:64521";
const output = resolve(root, "qa/TRACK-A-AUTH-LOCAL-20261026.json");
const run = (exe, args) => {
  const result = spawnSync(exe, args, {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    shell: exe === "npx.cmd",
  });
  if (result.status !== 0) throw Error(`${exe} failed: ${(result.stderr || "").trim().slice(0, 500)}`);
  return result.stdout.trim();
};
const status = JSON.parse(run("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", `"${runtime}"`, "-o", "json"]));
assert.equal(status.API_URL, expectedUrl, "refusing another API");
assert.equal(run("docker", ["inspect", "--format", "{{.State.Running}}", container]), "true");
const sql = (statement) => run("docker", ["exec", "-u", "postgres", container, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", statement]);
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations"), "54");
const request = async (path, body, token, service = false) => {
  const key = service ? status.SERVICE_ROLE_KEY : status.ANON_KEY;
  const response = await fetch(expectedUrl + path, {
    method: "POST", redirect: "error",
    headers: { apikey: key, authorization: `Bearer ${token || key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`${path} HTTP ${response.status}: ${value?.message || value?.error || "unknown error"}`);
    error.code = value?.code;
    throw error;
  }
  return value;
};
const rpc = (name, args, token) => request(`/rest/v1/rpc/${name}`, args, token);

const itemId = randomUUID(), requestId = randomUUID(), reportId = randomUUID(), lineId = randomUUID();
const itemName = `__TRACK_A_QA_${itemId.slice(0, 8)}`;
const neededAt = new Date(Date.now() + 48 * 3600_000).toISOString();
const evidence = { boundary: expectedUrl, fixtureMigrationCount: 54, itemId, requestId, reportId, lineId, stages: {} };
const snapshot = () => {
  const query = `select json_build_object(
    'aggregate', (select quantity_on_hand from public.inventory_items where id='${itemId}'),
    'requestDocuments', (select count(*) from public.inventory_request_documents where id='${requestId}'),
    'requestLines', (select count(*) from public.inventory_request_lines where request_id='${requestId}'),
    'receivingReports', (select count(*) from public.receiving_reports where id='${reportId}'),
    'receivingLines', (select count(*) from public.receiving_report_items where receiving_report_id='${reportId}'),
    'batchRows', (select count(*) from public.inventory_batches where inventory_item_id='${itemId}'),
    'batchQuantity', (select coalesce(sum(quantity_on_hand),0) from public.inventory_batches where inventory_item_id='${itemId}'),
    'ledgerRows', (select count(*) from public.inventory_transactions where inventory_item_id='${itemId}'),
    'ledgerQuantity', (select coalesce(sum(quantity_change),0) from public.inventory_transactions where inventory_item_id='${itemId}'),
    'reportStatus', (select status from public.receiving_reports where id='${reportId}'),
    'requestStatus', (select status from public.inventory_request_documents where id='${requestId}'))::text`;
  return JSON.parse(sql(query));
};
const save = () => writeFileSync(output, JSON.stringify(evidence, null, 2));
try {
  // Privileged SQL and admin Auth are fixture setup only; business actions use the Manager token.
  sql(`insert into public.inventory_items(id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled) values ('${itemId}','${itemName}','pcs',0,4,true,0,'fifo',false,true)`);
  const email = `track-a-manager-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString("base64url")}`;
  const created = await request("/auth/v1/admin/users", { email, password, email_confirm: true, user_metadata: { first_name: "Track", last_name: "A QA" } }, null, true);
  sql(`update public.profiles set role='manager',is_active=true where id='${created.id}'`);
  const session = await request("/auth/v1/token?grant_type=password", { email, password });
  assert.equal(session.user?.id, created.id);
  assert.ok(session.access_token);
  assert.equal(sql(`select role::text from public.profiles where id='${created.id}'`), "manager");
  evidence.auth = { method: "GoTrue password", profileRole: "manager", profileId: created.id };
  const token = session.access_token;
  evidence.stages.before = snapshot();
  const proposal = await rpc("get_inventory_request_proposal", { p_needed_at: neededAt }, token);
  assert.ok(Array.isArray(proposal) && proposal.some((row) => row.id === itemId));
  evidence.proposal = proposal.find((row) => row.id === itemId);
  const issued = await rpc("issue_inventory_request", {
    p_request_id: requestId, p_priority: "scheduled", p_needed_at: neededAt,
    p_lines: [{ inventory_item_id: itemId, quantity: 4, override_reason: "" }], p_expected: proposal,
  }, token);
  assert.equal(issued.id, requestId);
  evidence.requestNumber = issued.request_number;
  evidence.stages.issued = snapshot();
  assert.equal(evidence.stages.issued.aggregate, 0);
  assert.equal(evidence.stages.issued.requestDocuments, 1);
  assert.equal(evidence.stages.issued.requestLines, 1);
  const opened = await rpc("start_inventory_request_receiving", {
    p_request_id: requestId, p_revision: 1, p_report_id: reportId,
    p_inspected_by_name: null, p_inspection_note: "Synthetic partial delivery",
  }, token);
  assert.equal(opened.id, reportId);
  evidence.receivingNumber = opened.rr_number;
  const workspace = await rpc("get_manager_receiving_workspace", { p_receiving_report_id: reportId }, token);
  assert.equal(workspace.selected_report?.id, reportId);
  evidence.stages.draftOpened = snapshot();
  await rpc("save_receiving_report_item", {
    p_receiving_report_id: reportId, p_receiving_report_item_id: lineId,
    p_inventory_item_id: itemId, p_purchase_order_item_id: null,
    p_quantity_delivered: 3, p_quantity_accepted: 2,
    p_secondary_quantity_delivered: null, p_secondary_quantity_accepted: null,
    p_rejection_reason: "One unit rejected", p_source_lot_code: null,
    p_manufactured_on: null, p_use_by_date: null,
  }, token);
  evidence.stages.deliverySaved = snapshot();
  assert.equal(evidence.stages.deliverySaved.aggregate, 0);
  assert.equal(evidence.stages.deliverySaved.batchRows, 0);
  assert.equal(evidence.stages.deliverySaved.ledgerRows, 0);
  const posted = await rpc("post_receiving_report", { p_receiving_report_id: reportId }, token);
  evidence.postResult = posted;
  evidence.stages.posted = snapshot();
  const after = evidence.stages.posted;
  assert.equal(after.aggregate, 2);
  assert.equal(after.batchRows, 1);
  assert.equal(after.batchQuantity, 2);
  assert.equal(after.ledgerRows, 1);
  assert.equal(after.ledgerQuantity, 2);
  assert.equal(after.reportStatus, "posted");
  assert.equal(after.requestStatus, "partially_received");
  assert.equal(sql(`select quantity_delivered::text||'|'||quantity_accepted::text from public.receiving_report_items where id='${lineId}'`), "3.000|2.000");
  assert.equal(sql(`select count(*) from public.inventory_batches where receiving_report_item_id='${lineId}'`), "1");
  const transaction = JSON.parse(sql(`select row_to_json(t)::text from (select transaction_type,quantity_change,inventory_batch_id,inventory_item_id,reason from public.inventory_transactions where inventory_item_id='${itemId}') t`));
  assert.equal(transaction.transaction_type, "receiving");
  assert.equal(sql(`select count(*) from public.inventory_batches where id='${transaction.inventory_batch_id}' and receiving_report_item_id='${lineId}'`), "1");
  assert.ok(transaction.reason.includes(evidence.receivingNumber));
  evidence.ledger = transaction;
  try {
    await rpc("post_receiving_report", { p_receiving_report_id: reportId }, token);
    throw Error("duplicate post unexpectedly succeeded");
  } catch (error) {
    if (!/already posted/i.test(error.message)) throw error;
    evidence.duplicatePost = { rejected: true, code: error.code || null, message: error.message };
  }
  evidence.stages.duplicateRejected = snapshot();
  assert.deepEqual(evidence.stages.duplicateRejected, after);
  evidence.result = "PASS";
  save();
  console.log(`PASS Track A authenticated local journey; evidence: ${output}`);
} catch (error) {
  evidence.result = "FAIL";
  evidence.error = error.message;
  save();
  throw error;
}
