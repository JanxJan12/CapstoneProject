// Synthetic authenticated Manager writes on the preserved unlinked loopback stack only.
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

const stack = join(process.env.LOCALAPPDATA ?? "", "RRJ-Private-Backups", "rehearsal-20261013", "isolated-stack");
const cli = spawnSync("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", stack, "-o", "json"], { encoding: "utf8", shell: true });
if (cli.status !== 0) throw Error("Isolated Supabase stack unavailable");
const local = JSON.parse(cli.stdout);
if (local.API_URL !== "http://127.0.0.1:56321") throw Error("Refusing non-isolated API URL");
const db = "supabase_db_isolated-stack";
if (spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", db], { encoding: "utf8" }).stdout.trim() !== "true") throw Error("Expected isolated database unavailable");
const checks = [];
const failures = [];
function sql(statement) {
  const call = spawnSync("docker", ["exec", "-u", "postgres", db, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", statement], { encoding: "utf8" });
  if (call.status !== 0) throw Error(`Local SQL failed: ${call.stderr.trim()}`);
  return call.stdout.trim();
}
async function request(path, { method = "GET", body, token, service = false, contentType = "application/json" } = {}) {
  const key = service ? local.SERVICE_ROLE_KEY : local.PUBLISHABLE_KEY;
  const response = await fetch(`${local.API_URL}${path}`, { method, redirect: "error", headers: {
    apikey: key, authorization: `Bearer ${token ?? key}`,
    ...(body === undefined ? {} : { "content-type": contentType }),
  }, body: body === undefined ? undefined : contentType === "application/json" ? JSON.stringify(body) : body });
  const raw = await response.text();
  let value; try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
  if (!response.ok) throw Error(`${method} ${path.split("?")[0]} HTTP ${response.status} ${value?.code ?? ""} ${value?.message ?? ""}`);
  return value;
}
async function user(role) {
  const email = `manager-regression-${role}-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString("base64url")}`;
  const created = await request("/auth/v1/admin/users", { method: "POST", service: true,
    body: { email, password, email_confirm: true, user_metadata: { first_name: "Synthetic", last_name: "QA" } } });
  if (role !== "customer") sql(`update public.profiles set role='${role}',is_active=true where id='${created.id}'`);
  const session = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (!session.access_token) throw Error(`Local ${role} login failed`);
  return { id: created.id, token: session.access_token };
}
const rpc = (name, args, token) => request(`/rest/v1/rpc/${name}`, { method: "POST", body: args, token });
function check(condition, label) { if (!condition) throw Error(label); checks.push(label); }
async function run(label, fn) { try { await fn(); } catch (error) { failures.push(`${label}: ${error.message}`); } }

const manager = await user("manager");
const customer = await user("customer");
const rider = await user("customer");
const itemId = randomUUID(), requestId = randomUUID(), reportId = randomUUID(), lineId = randomUUID();
const categoryId = randomUUID(), menuId = randomUUID();
const itemName = `__MANAGER_WRITE_QA_${itemId.slice(0, 8)}`;
sql(`insert into public.inventory_items(id,item_name,unit,quantity_on_hand,reorder_level,is_active,quantity_scale,rotation_policy,expiry_required,batch_consumption_enabled) values ('${itemId}','${itemName}','pcs',0,4,true,0,'fifo',false,true)`);
sql(`insert into public.menu_categories(id,name,is_active) values ('${categoryId}','__QA_${categoryId.slice(0, 8)}',true)`);
sql(`insert into public.menu_items(id,category_id,code,name,price,is_available,is_active) values ('${menuId}','${categoryId}','QA${menuId.slice(0, 8).toUpperCase()}','__QA_Meal_${menuId.slice(0, 8)}',50,true,true)`);
const neededAt = new Date(Date.now() + 48 * 3600_000).toISOString();

await run("request revision and Receiving", async () => {
  const proposal = await rpc("get_inventory_request_proposal", { p_needed_at: neededAt }, manager.token);
  const issued = await rpc("issue_inventory_request", { p_request_id: requestId, p_priority: "scheduled", p_needed_at: neededAt,
    p_reason: "Synthetic isolated Manager regression", p_lines: [{ inventory_item_id: itemId, quantity: 3, override_reason: "Synthetic test quantity" }], p_expected: proposal }, manager.token);
  check(Boolean(issued.request_number), "Manager issued synthetic formal request");
  const revisedProposal = await rpc("get_inventory_request_proposal", { p_needed_at: neededAt }, manager.token);
  const revised = await rpc("revise_inventory_request", { p_request_id: requestId, p_expected_revision: 1, p_priority: "scheduled", p_needed_at: neededAt,
    p_reason: "Synthetic isolated revised quantity", p_lines: [{ inventory_item_id: itemId, quantity: 4, override_reason: "Synthetic revised quantity" }], p_expected: revisedProposal }, manager.token);
  check(revised.revision === 2, "Manager revised request to revision 2");
  await rpc("start_inventory_request_receiving", { p_request_id: requestId, p_revision: 2, p_report_id: reportId,
    p_inspected_by_name: "Synthetic QA", p_inspection_note: "Partial delivery" }, manager.token);
  await rpc("save_receiving_report_item", { p_receiving_report_id: reportId, p_receiving_report_item_id: lineId,
    p_inventory_item_id: itemId, p_purchase_order_item_id: null, p_quantity_delivered: 3, p_quantity_accepted: 2,
    p_secondary_quantity_delivered: null, p_secondary_quantity_accepted: null, p_rejection_reason: "One rejected",
    p_source_lot_code: null, p_manufactured_on: null, p_use_by_date: null }, manager.token);
  check(sql(`select quantity_on_hand::text from public.inventory_items where id='${itemId}'`) === "0.000", "Draft did not move stock");
  await rpc("post_receiving_report", { p_receiving_report_id: reportId }, manager.token);
  const receipt = sql(`select i.quantity_on_hand::text||'|'||r.status||'|'||d.status||'|'||(select count(*) from public.inventory_batches where receiving_report_item_id='${lineId}')||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='${itemId}' and transaction_type='receiving') from public.inventory_items i join public.receiving_reports r on r.id='${reportId}' join public.inventory_request_documents d on d.id='${requestId}' where i.id='${itemId}'`);
  check(receipt === "2.000|posted|partially_received|1|1", "Accepted-only posting, batch, and receiving ledger reconciled");
  const batchId = sql(`select id from public.inventory_batches where receiving_report_item_id='${lineId}'`);
  await rpc("adjust_inventory_batch_stock", { p_inventory_item_id: itemId, p_inventory_batch_id: batchId, p_quantity_change: -1,
    p_expected_batch_quantity: 2, p_reason: "Synthetic physical-count correction", p_notes: "Local QA", p_request_id: randomUUID() }, manager.token);
  const adjusted = sql(`select i.quantity_on_hand::text||'|'||b.quantity_on_hand::text||'|'||(select count(*) from public.inventory_transactions where inventory_item_id='${itemId}' and transaction_type='adjustment') from public.inventory_items i join public.inventory_batches b on b.inventory_item_id=i.id where b.id='${batchId}'`);
  check(adjusted === "1.000|1.000|1", "Batch adjustment and transaction ledger reconciled");
  const movements = await rpc("get_manager_inventory_movements", { p_item_id: itemId, p_type: null, p_from_date: null, p_to_date: null, p_cursor_created_at: null, p_cursor_id: null, p_limit: 20 }, manager.token);
  check(Array.isArray(movements) && movements.length >= 2, "Authenticated Manager read receiving and adjustment movements");
  await rpc("close_inventory_request_short", { p_request_id: requestId, p_revision: 2, p_reason: "Synthetic two-piece shortfall" }, manager.token);
  check(sql(`select status from public.inventory_request_documents where id='${requestId}'`) === "closed_short", "Manager closed revised request short without stock change");
});

await run("menu availability", async () => {
  const off = await rpc("set_manager_menu_item_availability", { p_menu_item_id: menuId, p_is_available: false }, manager.token);
  check(Array.isArray(off) && off[0]?.is_available === false, "Manager disabled synthetic menu item");
  const on = await rpc("set_manager_menu_item_availability", { p_menu_item_id: menuId, p_is_available: true }, manager.token);
  check(Array.isArray(on) && on[0]?.is_available === true, "Manager restored synthetic menu item availability");
});

await run("order cancellation", async () => {
  const placed = await rpc("place_customer_order", { p_customer_name: "Synthetic QA", p_contact_number: "09170000000",
    p_delivery_address: "Local QA Address", p_landmark: null, p_items: [{ id: menuId, qty: 1 }], p_request_id: randomUUID() }, customer.token);
  const orderId = placed?.[0]?.order_id;
  check(Boolean(orderId), "Customer created isolated synthetic order for Manager review");
  const orders = await rpc("get_manager_orders", { p_limit: 100 }, manager.token);
  check(Array.isArray(orders) && orders.some(row => row.id === orderId), "Manager order list contains synthetic order");
  const cancelled = await rpc("cancel_order", { p_order_id: orderId, p_reason: "Synthetic local cancellation regression" }, manager.token);
  check(cancelled?.[0]?.current_status === "cancelled", "Manager cancelled eligible unpaid synthetic order");
  check(sql(`select current_status from public.orders where id='${orderId}'`) === "cancelled", "Cancelled order persisted in isolated database");
});

await run("rider approval and status", async () => {
  const prefix = `${rider.id}/manager-write-qa`;
  const files = ["id.png", "orcr.png", "photo.png"].map(name => `${prefix}-${name}`);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/dWQAAAAASUVORK5CYII=", "base64");
  for (const file of files) await request(`/storage/v1/object/rider-documents/${file}`, { method: "POST", service: true, body: png, contentType: "image/png" });
  sql(`insert into public.riders(id,valid_id_path,or_cr_document_path,rider_photo_path,driver_license_number,plate_number,motor_brand,motor_model,approval_status,availability_status) values ('${rider.id}','${files[0]}','${files[1]}','${files[2]}','QA-LICENSE','QA-PLATE','QA-BRAND','QA-MODEL','pending','offline')`);
  const approved = await rpc("set_manager_rider_approval_status", { p_rider_id: rider.id, p_status: "approved" }, manager.token);
  check(approved?.[0]?.approval_status === "approved", "Manager approved complete synthetic rider application");
  const suspended = await rpc("set_manager_rider_approval_status", { p_rider_id: rider.id, p_status: "suspended" }, manager.token);
  check(suspended?.[0]?.approval_status === "suspended" && suspended[0].availability_status === "offline", "Manager suspended rider and set offline");
  const restored = await rpc("set_manager_rider_approval_status", { p_rider_id: rider.id, p_status: "approved" }, manager.token);
  check(restored?.[0]?.approval_status === "approved", "Manager restored synthetic rider approval");
});

const result = { boundary: local.API_URL, status: failures.length ? "FAIL" : "PASS", checks, failures };
await writeFile("qa/manager-write-regression-20261013.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
