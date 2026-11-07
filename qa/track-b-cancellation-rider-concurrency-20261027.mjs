import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const container = 'rrj-track-b-concurrency-20261027';
const id = {
  manager: '10000000-0000-0000-0000-000000000001',
  rider: '10000000-0000-0000-0000-000000000002',
  cashier: '10000000-0000-0000-0000-000000000003',
  order: '20000000-0000-0000-0000-000000000001',
  assignment: '30000000-0000-0000-0000-000000000001',
  payment: '40000000-0000-0000-0000-000000000001',
  sale: '50000000-0000-0000-0000-000000000001',
  shift: '60000000-0000-0000-0000-000000000001',
};
const cancellationSource = fs.readFileSync(path.join(root, 'supabase/migrations/20261007080031_phase_7a_paid_order_cancellation.sql'), 'utf8');
const riderSource = fs.readFileSync(path.join(root, 'supabase/migrations/20260914010000_harden_transition_replay_safety.sql'), 'utf8');
const correctionSource = fs.readFileSync(path.join(root, 'supabase/migrations/20261026194712_track_b_cancellation_rider_lock_order.sql'), 'utf8');
const mode = process.argv[2] ?? 'baseline';
let disposableOwned = false;
if (!['baseline', 'corrected-manager-first', 'corrected-rider-first'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
function extract(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Function extraction failed: ${start}`);
  return source.slice(a, b + '$function$;'.length);
}
const cancellation = extract(cancellationSource, 'create or replace function public.settle_paid_order_cancellation(', '$function$;');
const rider = extract(riderSource, 'create function public.advance_rider_delivery(', '$function$;');

function dockerSql(sql) {
  const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: sql, encoding: 'utf8', maxBuffer: 10_000_000 });
  if (r.status !== 0) throw new Error(`${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
}
function ensureDisposableContainer() {
  const inspect = spawnSync('docker', ['inspect', container, '--format', '{{.Config.Image}}|{{index .Config.Labels "rrj.track-b-disposable"}}'], { encoding: 'utf8' });
  if (inspect.status === 0) {
    assert.equal(inspect.stdout.trim(), 'postgres:17|20261027', 'Refusing to reset a non-disposable container');
    disposableOwned = true;
    return;
  }
  const started = spawnSync('docker', ['run', '-d', '--name', container, '--label', 'rrj.track-b-disposable=20261027', '-e', 'POSTGRES_PASSWORD=trackb_local_only', 'postgres:17'], { encoding: 'utf8' });
  if (started.status !== 0) throw new Error(started.stderr);
  disposableOwned = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' });
    if (ready.status === 0) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
      const query = spawnSync('docker', ['exec', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-tAc', 'select 1'], { encoding: 'utf8' });
      if (query.status === 0 && query.stdout.trim() === '1') return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
  throw new Error('Disposable PostgreSQL did not become ready');
}
const schema = `
create schema auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create type public.user_role as enum ('manager','rider','cashier');
create type public.order_status as enum ('confirmed','preparing','ready','waiting_for_rider','rider_accepted','picked_up','out_for_delivery','delivered','cancelled');
create type public.delivery_assignment_status as enum ('offered','accepted','picked_up','out_for_delivery','delivered','cancelled');
create type public.payment_status as enum ('verified','voided');
create type public.payment_method as enum ('cash','gcash');
create type public.cashier_transaction_status as enum ('completed','voided');
create type public.cashier_shift_status as enum ('open','closed');
create type public.rider_availability_status as enum ('available','on_delivery');
create type public.rider_approval_status as enum ('approved','pending');
create type public.inventory_transaction_type as enum ('issuance','restock');
create function auth.uid() returns uuid language sql stable as $uid$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $uid$;
create table public.profiles (id uuid primary key, role public.user_role not null, is_active boolean not null);
create table public.riders (id uuid primary key references public.profiles(id), approval_status public.rider_approval_status not null, availability_status public.rider_availability_status not null, updated_at timestamptz);
create table public.orders (id uuid primary key, order_number text not null unique, current_status public.order_status not null, grand_total numeric(10,2) not null, cancelled_at timestamptz);
create table public.delivery_assignments (id uuid primary key, order_id uuid not null references public.orders(id), rider_id uuid not null references public.riders(id), status public.delivery_assignment_status not null, assigned_at timestamptz not null default now(), picked_up_at timestamptz, out_for_delivery_at timestamptz, updated_at timestamptz);
create table public.payments (id uuid primary key, order_id uuid not null unique references public.orders(id), status public.payment_status not null, amount numeric(10,2) not null, payment_method public.payment_method not null, updated_at timestamptz);
create table public.cashier_shifts (id uuid primary key, status public.cashier_shift_status not null);
create table public.cashier_transactions (id uuid primary key, transaction_number text not null unique, receipt_number text not null unique, order_id uuid not null unique references public.orders(id), payment_id uuid not null unique references public.payments(id), shift_id uuid not null references public.cashier_shifts(id), status public.cashier_transaction_status not null, void_reason text, voided_at timestamptz);
create table public.paid_order_cancellations (id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id), payment_id uuid not null unique references public.payments(id), cashier_transaction_id uuid not null unique references public.cashier_transactions(id), previous_status public.order_status not null, inventory_disposition text not null, refund_amount numeric(10,2) not null, refund_method public.payment_method not null, refund_reference text not null, reason text not null, processed_by uuid not null references public.profiles(id), processed_at timestamptz not null);
create unique index paid_order_cancellations_refund_reference_uidx on public.paid_order_cancellations(refund_method, lower(btrim(refund_reference)));
create table public.order_status_history (id bigint generated always as identity primary key, order_id uuid not null references public.orders(id), status public.order_status not null, changed_by uuid, notes text, created_at timestamptz default now());
create table public.inventory_items (id uuid primary key, quantity_on_hand numeric, updated_at timestamptz, batch_consumption_enabled boolean);
create table public.inventory_batches (id uuid primary key, inventory_item_id uuid, quantity_on_hand numeric, quantity_initial numeric, quantity_positive_adjustments numeric);
create table public.inventory_transactions (id uuid primary key, order_id uuid, transaction_type public.inventory_transaction_type, inventory_item_id uuid, quantity_change numeric);
create table public.inventory_transaction_batch_allocations (id uuid primary key, inventory_transaction_id uuid, inventory_batch_id uuid, quantity numeric);
create function public.assert_batch_inventory_consistent(uuid) returns void language plpgsql as $body$ begin null; end $body$;
${cancellation}
${rider}
revoke all on function public.settle_paid_order_cancellation(uuid,text,text,public.payment_method,text,boolean,boolean) from public, anon;
revoke all on function public.advance_rider_delivery(uuid,public.delivery_assignment_status) from public, anon;
grant usage on schema public, auth to authenticated;
grant usage on type public.payment_method, public.delivery_assignment_status to authenticated;
grant execute on function public.settle_paid_order_cancellation(uuid,text,text,public.payment_method,text,boolean,boolean) to authenticated;
grant execute on function public.advance_rider_delivery(uuid,public.delivery_assignment_status) to authenticated;
insert into public.profiles values ('${id.manager}','manager',true),('${id.rider}','rider',true),('${id.cashier}','cashier',true);
insert into public.riders values ('${id.rider}','approved','on_delivery',now());
insert into public.orders values ('${id.order}','TRACK-B-SYNTHETIC','rider_accepted',16.00,null);
insert into public.delivery_assignments (id,order_id,rider_id,status) values ('${id.assignment}','${id.order}','${id.rider}','accepted');
insert into public.payments values ('${id.payment}','${id.order}','verified',16.00,'cash',now());
insert into public.cashier_shifts values ('${id.shift}','open');
insert into public.cashier_transactions (id,transaction_number,receipt_number,order_id,payment_id,shift_id,status) values ('${id.sale}','TRACK-B-TX-1','TRACK-B-RECEIPT-1','${id.order}','${id.payment}','${id.shift}','completed');
`;

function session(name) {
  const process = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-P', 'pager=off', '-P', 'format=unaligned', '-P', 'tuples_only=on', '-v', 'VERBOSITY=verbose', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe','pipe','pipe'] });
  let log = '';
  let pending = [];
  let serial = 0;
  function collect(data) {
    log += data.toString();
    pending = pending.filter(p => {
      if (!log.includes(p.marker)) return true;
      const chunk = log.slice(p.start, log.indexOf(p.marker, p.start));
      p.resolve(chunk.trim());
      return false;
    });
  }
  process.stdout.on('data', collect);
  process.stderr.on('data', collect);
  function run(sql) {
    const marker = `__${name}_${++serial}__`;
    const start = log.length;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${name} timeout: ${sql}\n${log}`)), 15000);
      pending.push({ marker, start, resolve: x => {clearTimeout(timeout); resolve(x);} });
      process.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }
  return { run, close: () => process.stdin.end(), get log() { return log; } };
}

const cancelCall = `select public.settle_paid_order_cancellation('${id.order}', 'Synthetic customer refund', 'no_return', 'cash', 'TRACK-B-REFUND-1', true, false);`;
const riderCall = `select * from public.advance_rider_delivery('${id.assignment}', 'accepted');`;
const state = `select o.current_status, a.status, p.status, s.status, (select count(*) from public.paid_order_cancellations), (select count(*) from public.order_status_history) from public.orders o join public.delivery_assignments a on a.order_id=o.id join public.payments p on p.order_id=o.id join public.cashier_transactions s on s.order_id=o.id where o.id='${id.order}';`;

try {
  ensureDisposableContainer();
  dockerSql('drop schema if exists public cascade; create schema public; drop schema if exists auth cascade; drop role if exists authenticated, anon, service_role;');
  console.log('SETUP', dockerSql(schema).split('\n').slice(-12).join('\n'));
  if (mode !== 'baseline') console.log('CORRECTION', dockerSql(correctionSource));
  console.log('BASELINE', dockerSql(state));
  const manager = session('manager');
  const riderSession = session('rider');
  if (mode === 'baseline') {
    console.log('MANAGER BEGIN', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; select id from public.orders where id='${id.order}' for update; set role authenticated;`));
    console.log('RIDER BEGIN', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; select id from public.delivery_assignments where id='${id.assignment}' for update; set role authenticated;`));
    const managerPending = manager.run(cancelCall);
    await new Promise(resolve => setTimeout(resolve, 250));
    console.log('MANAGER WAIT', dockerSql(`select wait_event_type, wait_event, pg_blocking_pids(pid) from pg_stat_activity where query like 'select public.settle_paid_order_cancellation(%' and wait_event_type is not null;`));
    const riderResult = await riderSession.run(riderCall);
    const managerResult = await managerPending;
    console.log('RIDER CALL', riderResult);
    console.log('MANAGER CALL', managerResult);
  } else if (mode === 'corrected-manager-first') {
    console.log('MANAGER BEGIN', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; select id from public.delivery_assignments where id='${id.assignment}' for update; set role authenticated;`));
    console.log('RIDER BEGIN', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; set role authenticated;`));
    const riderPending = riderSession.run(riderCall);
    await new Promise(resolve => setTimeout(resolve, 250));
    console.log('RIDER WAIT', dockerSql(`select wait_event_type, wait_event, pg_blocking_pids(pid) from pg_stat_activity where query like 'select * from public.advance_rider_delivery(%' and wait_event_type is not null;`));
    console.log('MANAGER CALL', await manager.run(cancelCall));
    console.log('MANAGER COMMIT', await manager.run('commit;'));
    console.log('RIDER CALL', await riderPending);
  } else {
    console.log('RIDER BEGIN', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; select id from public.delivery_assignments where id='${id.assignment}' for update; set role authenticated;`));
    console.log('MANAGER BEGIN', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; set role authenticated;`));
    const managerPending = manager.run(cancelCall);
    await new Promise(resolve => setTimeout(resolve, 250));
    console.log('MANAGER WAIT', dockerSql(`select wait_event_type, wait_event, pg_blocking_pids(pid) from pg_stat_activity where query like 'select public.settle_paid_order_cancellation(%' and wait_event_type is not null;`));
    console.log('RIDER CALL', await riderSession.run(riderCall));
    console.log('RIDER COMMIT', await riderSession.run('commit;'));
    console.log('MANAGER CALL', await managerPending);
  }
  console.log('MANAGER END', await manager.run('commit;'));
  console.log('RIDER END', await riderSession.run('commit;'));
  console.log('AFTER RACE', dockerSql(state));
  console.log('MANAGER RETRY', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; ${cancelCall} commit;`));
  console.log('RIDER RETRY', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; ${riderCall} commit;`));
  console.log('ROLE CHECK RIDER CANCELLATION', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; ${cancelCall} rollback;`));
  console.log('ROLE CHECK MANAGER DELIVERY', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; ${riderCall} rollback;`));
  console.log('ANON EXECUTE', dockerSql(`select has_function_privilege('anon','public.settle_paid_order_cancellation(uuid,text,text,public.payment_method,text,boolean,boolean)','EXECUTE'), has_function_privilege('anon','public.advance_rider_delivery(uuid,public.delivery_assignment_status)','EXECUTE');`));
  const finalState = dockerSql(state);
  console.log('FINAL', finalState);
  console.log('MANAGER ERRORS', manager.log.match(/ERROR:[^]*?(?=__manager_|$)/g)?.join('\n') ?? 'none');
  console.log('RIDER ERRORS', riderSession.log.match(/ERROR:[^]*?(?=__rider_|$)/g)?.join('\n') ?? 'none');
  assert.match(riderSession.log, /42501: Active Manager access is required/);
  assert.match(manager.log, /Only an active approved rider may update a delivery/);
  if (mode === 'corrected-manager-first') {
    assert.doesNotMatch(manager.log + riderSession.log, /40P01/);
    assert.match(finalState, /cancelled\s+\| cancelled\s+\| voided\s+\| voided\s+\|\s+1\s+\|\s+1/);
    assert.match(manager.log, /"already_recorded": true/);
  } else {
    if (mode === 'baseline') assert.match(manager.log, /40P01: deadlock detected/);
    else assert.doesNotMatch(manager.log + riderSession.log, /40P01/);
    assert.match(finalState, /picked_up\s+\| picked_up\s+\| verified\s+\| completed\s+\|\s+0\s+\|\s+1/);
  }
  console.log('ASSERTIONS PASS', mode);
  manager.close(); riderSession.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (disposableOwned) {
    const stopped = spawnSync('docker', ['rm', '-fv', container], { encoding: 'utf8' });
    if (stopped.status !== 0) console.error(`Disposable cleanup failed: ${stopped.stderr}`);
  }
}
