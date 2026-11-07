// Finish evidence verification for the already posted single Track A request.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const runtime = resolve(root, ".tmp/track-a-auth-20261026-targeted");
const path = resolve(root, "qa/TRACK-A-AUTH-LOCAL-20261026.json");
const evidence = JSON.parse(readFileSync(path, "utf8"));
const container = "supabase_db_rrj_track_a_targeted_20261026";
const expectedUrl = "http://127.0.0.1:64521";
assert.equal(evidence.boundary, expectedUrl);
assert.equal(evidence.stages.posted.reportStatus, "posted");
const run = (exe, args) => {
  const result = spawnSync(exe, args, { encoding: "utf8", shell: exe === "npx.cmd" });
  if (result.status !== 0) throw Error(`${exe}: ${(result.stderr || "").trim().slice(0, 500)}`);
  return result.stdout.trim();
};
const status = JSON.parse(run("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", `"${runtime}"`, "-o", "json"]));
assert.equal(status.API_URL, expectedUrl);
assert.equal(run("docker", ["inspect", "--format", "{{.State.Running}}", container]), "true");
const sql = (query) => run("docker", ["exec", "-u", "postgres", container, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", query]);
const { itemId, lineId, reportId, requestId } = evidence;
const snapshot = () => JSON.parse(sql(`select json_build_object(
  'aggregate',(select quantity_on_hand from public.inventory_items where id='${itemId}'),
  'requestDocuments',(select count(*) from public.inventory_request_documents where id='${requestId}'),
  'requestLines',(select count(*) from public.inventory_request_lines where request_id='${requestId}'),
  'receivingReports',(select count(*) from public.receiving_reports where id='${reportId}'),
  'receivingLines',(select count(*) from public.receiving_report_items where receiving_report_id='${reportId}'),
  'batchRows',(select count(*) from public.inventory_batches where inventory_item_id='${itemId}'),
  'batchQuantity',(select coalesce(sum(quantity_on_hand),0) from public.inventory_batches where inventory_item_id='${itemId}'),
  'ledgerRows',(select count(*) from public.inventory_transactions where inventory_item_id='${itemId}'),
  'ledgerQuantity',(select coalesce(sum(quantity_change),0) from public.inventory_transactions where inventory_item_id='${itemId}'),
  'reportStatus',(select status from public.receiving_reports where id='${reportId}'),
  'requestStatus',(select status from public.inventory_request_documents where id='${requestId}'))::text`));
assert.deepEqual(snapshot(), evidence.stages.posted);
const ledger = JSON.parse(sql(`select row_to_json(t)::text from (select transaction_type,quantity_change,inventory_batch_id,inventory_item_id,reason from public.inventory_transactions where inventory_item_id='${itemId}') t`));
assert.equal(ledger.transaction_type, "receiving");
assert.equal(ledger.quantity_change, 2);
assert.equal(sql(`select count(*) from public.inventory_batches where id='${ledger.inventory_batch_id}' and receiving_report_item_id='${lineId}'`), "1");
assert.ok(ledger.reason.includes(evidence.receivingNumber));
evidence.ledger = ledger;

const request = async (path, body, key, token = key) => {
  const response = await fetch(expectedUrl + path, { method: "POST", redirect: "error",
    headers: { apikey: key, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  return { status: response.status, body: result };
};
const email = `track-a-duplicate-${randomUUID()}@example.invalid`;
const password = `Aa1!${randomBytes(24).toString("base64url")}`;
const created = await request("/auth/v1/admin/users", { email, password, email_confirm: true }, status.SERVICE_ROLE_KEY);
assert.equal(created.status, 200);
sql(`update public.profiles set role='manager',is_active=true where id='${created.body.id}'`);
const session = await request("/auth/v1/token?grant_type=password", { email, password }, status.ANON_KEY);
assert.equal(session.status, 200);
assert.ok(session.body.access_token);
assert.equal(sql(`select role::text from public.profiles where id='${created.body.id}'`), "manager");
const duplicate = await request("/rest/v1/rpc/post_receiving_report", { p_receiving_report_id: reportId }, status.ANON_KEY, session.body.access_token);
assert.notEqual(duplicate.status, 200);
assert.match(duplicate.body?.message || "", /already posted/i);
evidence.duplicatePost = { rejected: true, httpStatus: duplicate.status, code: duplicate.body.code, message: duplicate.body.message, managerRole: "manager" };
evidence.stages.duplicateRejected = snapshot();
assert.deepEqual(evidence.stages.duplicateRejected, evidence.stages.posted);
evidence.result = "PASS";
delete evidence.error;
writeFileSync(path, JSON.stringify(evidence, null, 2));
console.log(`PASS duplicate post rejected with unchanged stock, batch, ledger; evidence: ${path}`);
