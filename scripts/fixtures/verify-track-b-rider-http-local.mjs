// Synthetic Track B acceptance on the dedicated, unlinked local Supabase stack.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const runtime = resolve(import.meta.dirname, '../../.tmp/track-a-auth-20261026-targeted');
const container = 'supabase_db_rrj_track_a_targeted_20261026';
const url = 'http://127.0.0.1:64521';
const run = (exe, args) => {
  const result = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`${exe} failed: ${(result.stderr || '').slice(0, 400)}`);
  return result.stdout.trim();
};
const status = JSON.parse(run('supabase', ['status', '--workdir', runtime, '-o', 'json']));
assert.equal(status.API_URL, url, 'refusing to call a non-local API');
assert.equal(run('docker', ['inspect', '--format', '{{.State.Running}}', container]), 'true');
const sql = (statement) => run('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', statement]);
const policy = sql(`select policyname || ':' || (position('approval_status' in qual)>0)::text
  from pg_policies where policyname in ('rider_select_own_assignments','rider_read_own_delivery_proof')
  order by policyname`);
assert.equal(policy, 'rider_read_own_delivery_proof:true\nrider_select_own_assignments:true', 'Track B policy missing');

const call = async (path, { method = 'GET', token, service = false, body, contentType } = {}) => {
  const key = service ? status.SERVICE_ROLE_KEY : status.ANON_KEY;
  return fetch(url + path, {
    method, redirect: 'error',
    headers: {
      apikey: key,
      authorization: `Bearer ${token || key}`,
      ...(contentType ? { 'content-type': contentType } : {}),
    },
    body,
  });
};
const json = async (response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Error(`HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
};
const orderId = randomUUID();
const assignmentId = randomUUID();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Sh3gAAAAASUVORK5CYII=', 'base64');
const users = [];
const results = [];
let uploaded = false;
let orderCreated = false;
const makeUser = async (label) => {
  const email = `track-b-${label}-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString('base64url')}`;
  const created = await json(await call('/auth/v1/admin/users', {
    method: 'POST', service: true, contentType: 'application/json',
    body: JSON.stringify({ email, password, email_confirm: true }),
  }));
  users.push(created.id);
  const session = await json(await call('/auth/v1/token?grant_type=password', {
    method: 'POST', contentType: 'application/json', body: JSON.stringify({ email, password }),
  }));
  assert.equal(session.user.id, created.id);
  assert.ok(session.access_token);
  return { id: created.id, token: session.access_token };
};
try {
  const owner = await makeUser('owner');
  const other = await makeUser('other');
  const ownerPath = `${owner.id}/${assignmentId}/track-b-${randomUUID()}.png`;
  // Keep the path mutable only after the real Auth id is known.
  sql(`update public.profiles set role='rider',is_active=true where id='${owner.id}';
    insert into public.riders(id,approval_status) values ('${owner.id}','approved');
    insert into public.orders(id,order_number,order_channel,fulfillment_type,current_status,delivery_address)
      values ('${orderId}','TRACK-B-${orderId.slice(0, 8)}','online','delivery','delivered','Synthetic local address');
    insert into public.delivery_assignments(id,order_id,rider_id,status,proof_of_delivery_path)
      values ('${assignmentId}','${orderId}','${owner.id}','delivered','${ownerPath}');
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values ('delivery-proofs','delivery-proofs',false,5242880,array['image/png','image/jpeg','image/webp'])
      on conflict (id) do nothing;`);
  orderCreated = true;
  const upload = await call(`/storage/v1/object/delivery-proofs/${ownerPath}`, {
    method: 'POST', service: true, contentType: 'image/png', body: png,
  });
  await json(upload);
  uploaded = true;
  const proof = ownerPath;
  const check = async (label, token, allowed) => {
    const assignments = await call(`/rest/v1/delivery_assignments?select=id,proof_of_delivery_path&id=eq.${assignmentId}`, { token });
    assert.equal(assignments.status, 200, `${label} assignment HTTP`);
    const rows = await assignments.json();
    assert.equal(rows.length, allowed ? 1 : 0, `${label} assignment rows`);
    if (allowed) assert.equal(rows[0].proof_of_delivery_path, proof);
    const orders = await call(`/rest/v1/orders?select=id&id=eq.${orderId}`, { token });
    assert.equal(orders.status, 200, `${label} order HTTP`);
    const orderRows = await orders.json();
    assert.equal(orderRows.length, allowed ? 1 : 0, `${label} assigned order rows`);
    const download = await call(`/storage/v1/object/delivery-proofs/${proof}`, { token });
    if (allowed) {
      assert.equal(download.status, 200, `${label} proof HTTP`);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), png, `${label} proof bytes`);
    } else assert.ok([400, 401, 403, 404].includes(download.status), `${label} proof HTTP ${download.status}`);
    results.push({ actor: label, assignmentRows: rows.length, orderRows: orderRows.length, proofStatus: download.status });
  };
  await check('active approved Rider', owner.token, true);
  await check('unrelated Customer', other.token, false);
  await check('anonymous', null, false);
  sql(`update public.profiles set role='customer' where id='${owner.id}';
    update public.riders set approval_status='suspended' where id='${owner.id}'`);
  await check('suspended former Rider, same GoTrue session', owner.token, false);
  sql(`update public.profiles set role='rider' where id='${owner.id}'`);
  await check('Rider role, suspended approval', owner.token, false);
  sql(`update public.profiles set role='customer' where id='${owner.id}';
    update public.riders set approval_status='approved' where id='${owner.id}'`);
  await check('Customer role, approved rider record', owner.token, false);
  sql(`update public.profiles set role='rider',is_active=false where id='${owner.id}';
    update public.riders set approval_status='approved' where id='${owner.id}'`);
  await check('inactive approved Rider, same GoTrue session', owner.token, false);
  console.log(JSON.stringify({ result: 'PASS', api: url, policy, results }, null, 2));
} finally {
  // Delete only uniquely named synthetic records from this local fixture.
  if (uploaded) {
    const path = sql(`select proof_of_delivery_path from public.delivery_assignments where id='${assignmentId}'`);
    await call(`/storage/v1/object/delivery-proofs/${path}`, { method: 'DELETE', service: true }).catch(() => {});
  }
  if (orderCreated) sql(`delete from public.delivery_assignments where id='${assignmentId}'; delete from public.orders where id='${orderId}'`);
  for (const userId of users.reverse()) {
    sql(`delete from public.riders where id='${userId}'`);
    await call(`/auth/v1/admin/users/${userId}`, { method: 'DELETE', service: true }).catch(() => {});
  }
}
