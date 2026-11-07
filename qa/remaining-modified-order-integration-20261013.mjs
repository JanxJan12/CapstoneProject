// One-shot continuation of the pre-existing synthetic local modified order ORD-000076.
// Refuses any API other than the preserved isolated loopback stack.
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { writeFile } from "node:fs/promises";

const stack = path.join(process.env.LOCALAPPDATA ?? "", "RRJ-Private-Backups", "rehearsal-20261013", "isolated-stack");
const status = spawnSync("npx.cmd", ["--yes", "supabase@2.120.0", "status", "--workdir", stack, "-o", "json"], { shell: true, encoding: "utf8", windowsHide: true });
if (status.status !== 0) throw Error("Isolated stack unavailable");
const local = JSON.parse(status.stdout);
if (local.API_URL !== "http://127.0.0.1:56321") throw Error("Refusing non-isolated API");
const db = "supabase_db_isolated-stack";
if (spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", db], { encoding: "utf8" }).stdout.trim() !== "true") throw Error("Isolated database unavailable");
const sql = statement => {
  const r = spawnSync("docker", ["exec", "-u", "postgres", db, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", statement], { encoding: "utf8" });
  if (r.status !== 0) throw Error(`Isolated SQL failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
};
const checks = [];
const existing = sql("select o.id||'|'||o.current_status||'|'||p.id||'|'||p.status from public.orders o join public.payments p on p.order_id=o.id where o.order_number='ORD-000076'");
const [customerOrderId, orderStatus, paymentId, paymentStatus] = existing.split("|");
if (orderStatus !== "waiting_payment_verification" || paymentStatus !== "pending") throw Error("Pre-existing synthetic modified order is no longer pending; refusing to replay");
const storedModifier = sql(`select oi.modifiers->0->>'name' from public.order_items oi where oi.order_id='${customerOrderId}' limit 1`);
if (storedModifier !== "Extra rice") throw Error("Pre-existing synthetic modifier snapshot differs from checkpoint");
checks.push("Customer modified-order snapshot and pending GCash payment precondition");

async function request(endpoint, { method = "GET", token, body, type } = {}) {
  const key = local.PUBLISHABLE_KEY;
  const response = await fetch(local.API_URL + endpoint, { method, redirect: "error",
    headers: { apikey: key, authorization: `Bearer ${token ?? key}`, ...(body === undefined ? {} : { "content-type": type ?? "application/json" }) },
    body: body === undefined ? undefined : type ? body : JSON.stringify(body) });
  const raw = await response.text();
  let value; try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
  return { status: response.status, value };
}
async function rpc(name, args, token) {
  const r = await request(`/rest/v1/rpc/${name}`, { method: "POST", token, body: args });
  if (r.status < 200 || r.status >= 300) throw Error(`${name} failed: HTTP ${r.status} ${r.value?.code ?? ""} ${r.value?.message ?? ""}`);
  return r.value;
}
const one = (rows, label) => {
  if (!Array.isArray(rows) || rows.length !== 1) throw Error(`${label} did not return one row`);
  return rows[0];
};
async function makeUser(role) {
  const email = `remaining-${role}-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString("base64url")}`;
  const created = await fetch(`${local.API_URL}/auth/v1/admin/users`, { method: "POST", redirect: "error",
    headers: { apikey: local.SERVICE_ROLE_KEY, authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { first_name: "Remaining", last_name: "QA" } }) });
  if (!created.ok) throw Error(`Local ${role} identity creation failed: HTTP ${created.status}`);
  const user = await created.json();
  sql(`update public.profiles set role='${role}',is_active=true where id='${user.id}'`);
  if (role === "rider") sql(`insert into public.riders(id,approval_status,availability_status) values ('${user.id}','approved','available')`);
  const login = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (login.status !== 200 || !login.value?.access_token) throw Error(`Local ${role} sign-in failed`);
  return { id: user.id, token: login.value.access_token };
}
const cashier = await makeUser("cashier");
const manager = await makeUser("manager");
const rider = await makeUser("rider");
checks.push("Local authenticated Cashier, Manager, and approved Rider identities");
one(await rpc("start_cashier_shift", { p_terminal: `REMAINING-QA-${randomUUID().slice(0, 8)}`, p_opening_cash: 0 }, cashier.token), "shift");
const verified = one(await rpc("verify_customer_gcash_payment", { p_request_id: randomUUID(), p_payment_id: paymentId }, cashier.token), "verification");
if (verified.payment_status !== "verified" || verified.order_status !== "confirmed") throw Error("Modified order did not reach confirmed after Cashier verification");
checks.push("Cashier verified pre-existing local GCash proof and confirmed modified order");
const terminal = one(await rpc("provision_kds_terminal", { p_terminal_name: `Remaining QA ${randomUUID().slice(0, 8)}` }, manager.token), "terminal");
const credential = { p_terminal_id: terminal.terminal_id, p_terminal_secret: terminal.terminal_secret };
const invalidTerminal = await request("/rest/v1/rpc/verify_kds_terminal", { method: "POST", body: { ...credential, p_terminal_secret: "invalid-local-secret" } });
if (invalidTerminal.status < 400) throw Error("Invalid KDS secret was accepted");
const queue = await rpc("get_kds_queue", credential);
const ticket = queue.find(row => row.order_id === customerOrderId);
if (!ticket) throw Error("Modified confirmed order missing from KDS queue");
if (ticket.items.some(item => Object.hasOwn(item, "modifiers"))) throw Error("KDS modifier projection unexpectedly changed; update contract assessment");
const preparing = one(await rpc("advance_kds_order", { ...credential, p_order_id: customerOrderId, p_expected_status: "confirmed" }), "KDS preparing");
if (preparing.current_status !== "preparing") throw Error("KDS did not start preparation");
const duplicateAdvance = await request("/rest/v1/rpc/advance_kds_order", { method: "POST", body: { ...credential, p_order_id: customerOrderId, p_expected_status: "confirmed" } });
if (duplicateAdvance.status < 400) throw Error("Duplicate KDS advance was accepted");
const ready = one(await rpc("advance_kds_order", { ...credential, p_order_id: customerOrderId, p_expected_status: "preparing" }), "KDS ready");
if (ready.current_status !== "ready") throw Error("KDS did not mark ready");
checks.push("KDS terminal authentication, queue, denied duplicate, preparing and ready; modifier omission confirmed");
const sidelined = sql(`select coalesce(string_agg(id::text, ','),'') from public.riders where availability_status='available' and id<>'${rider.id}'`).split(",").filter(Boolean);
if (!sidelined.every(id => /^[0-9a-f-]{36}$/.test(id))) throw Error("Unexpected local Rider ID");
if (sidelined.length) sql(`update public.riders set availability_status='offline' where id in (${sidelined.map(id => `'${id}'`).join(",")})`);
try {
  const released = one(await rpc("release_ready_order", { p_order_id: customerOrderId }, cashier.token), "release");
  if (released.current_status !== "waiting_for_rider") throw Error("Ready delivery not released to Rider queue");
  let assignmentId = sql(`select id from public.delivery_assignments where order_id='${customerOrderId}' and status='offered' limit 1`);
  if (!assignmentId) assignmentId = one(await rpc("offer_order_to_next_rider", { p_order_id: customerOrderId }, cashier.token), "offer").assignment_id;
  const assignedRider = sql(`select rider_id from public.delivery_assignments where id='${assignmentId}'`);
  if (assignedRider !== rider.id) throw Error("Synthetic approved Rider did not receive offer");
  const riderItems = await request(`/rest/v1/order_items?select=id,modifiers&order_id=eq.${customerOrderId}`, { token: rider.token });
  if (riderItems.status !== 200 || !riderItems.value?.some(item => item.modifiers?.some(modifier => modifier.name === "Extra rice")))
    throw Error("Assigned Rider could not read modifier snapshot via RLS");
  one(await rpc("accept_rider_offer", { p_assignment_id: assignmentId }, rider.token), "accept");
  one(await rpc("advance_rider_delivery", { p_assignment_id: assignmentId, p_expected_assignment_status: "accepted" }, rider.token), "pickup");
  one(await rpc("advance_rider_delivery", { p_assignment_id: assignmentId, p_expected_assignment_status: "picked_up" }, rider.token), "out for delivery");
  const proof = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX+8AAAAASUVORK5CYII=", "base64");
  const proofPath = `${rider.id}/${assignmentId}/proof-${Date.now()}.png`;
  const upload = await request(`/storage/v1/object/delivery-proofs/${proofPath}`, { method: "POST", token: rider.token, body: proof, type: "image/png" });
  if (upload.status < 200 || upload.status >= 300) throw Error(`Isolated Rider proof upload failed: HTTP ${upload.status}`);
  const completed = one(await rpc("complete_rider_delivery", { p_assignment_id: assignmentId, p_proof_path: proofPath }, rider.token), "completion");
  if (completed.assignment_status !== "delivered" || completed.order_status !== "delivered") throw Error("Rider completion failed");
  checks.push("Cashier release, Rider offer/accept/pickup/transit/private proof/delivery and assigned modifier RLS");
} finally {
  if (sidelined.length) sql(`update public.riders set availability_status='available' where id in (${sidelined.map(id => `'${id}'`).join(",")})`);
}
const final = sql(`select o.current_status||'|'||p.status||'|'||(select count(*) from public.cashier_transactions c where c.order_id=o.id) from public.orders o join public.payments p on p.order_id=o.id where o.id='${customerOrderId}'`);
if (final !== "delivered|verified|1") throw Error(`Final Customer order reconciliation failed: ${final}`);
checks.push("Same-database Customer order, payment, and Cashier transaction reconciled");

const menuId = sql("select m.id from public.menu_items m join public.get_menu_effective_availability() a on a.menu_item_id=m.id join public.menu_item_modifier_groups mg on mg.menu_item_id=m.id join public.menu_modifier_options mo on mo.group_id=mg.group_id and mo.id='extra-rice' where a.effective_available and m.is_active and m.is_available order by m.id limit 1");
if (!/^[0-9a-f-]{36}$/.test(menuId)) throw Error("No available menu item with Extra rice modifier");
const saleArgs = { p_request_id: randomUUID(), p_fulfillment_type: "takeout", p_customer_name: "Remaining Local QA", p_contact_number: null,
  p_payment_method: "cash", p_cash_received: 1000, p_gcash_reference_number: null,
  p_items: [{ menu_item_id: menuId, quantity: 1, modifier_ids: ["extra-rice"], note: "Synthetic local QA" }] };
const sale = one(await rpc("create_walk_in_sale", saleArgs, cashier.token), "walk-in sale");
if (sale.current_status !== "confirmed") throw Error("Walk-in sale not confirmed");
const replay = one(await rpc("create_walk_in_sale", saleArgs, cashier.token), "walk-in replay");
if (replay.order_id !== sale.order_id) throw Error("Walk-in idempotency replay created a second order");
const saleModifier = sql(`select oi.modifiers->0->>'name' from public.order_items oi where oi.order_id='${sale.order_id}' limit 1`);
if (saleModifier !== "Extra rice") throw Error("Walk-in modifier snapshot missing");
const walkInTicket = (await rpc("get_kds_queue", credential)).find(row => row.order_id === sale.order_id);
if (!walkInTicket) throw Error("Confirmed walk-in sale missing from KDS");
const badSale = await request("/rest/v1/rpc/create_walk_in_sale", { method: "POST", token: cashier.token,
  body: { ...saleArgs, p_request_id: randomUUID(), p_items: [{ menu_item_id: menuId, quantity: 1, modifier_ids: ["extra-rice", "extra-rice"] }] } });
if (badSale.status < 400) throw Error("Duplicate modifier was accepted for walk-in sale");
checks.push("Modified walk-in cash POS sale, idempotent replay, denied duplicate modifier, and KDS queue");
const evidence = { status: "PASS", existingCustomerOrder: "ORD-000076", customerOrderId, walkInOrderId: sale.order_id, checks,
  caveat: "KDS get_kds_queue omits item modifier snapshots; no hosted or real GCash action occurred." };
await writeFile("qa/remaining-modified-order-integration-20261013.json", JSON.stringify(evidence, null, 2));
console.log(`PASS: ${checks.length} isolated same-database integration checks`);
