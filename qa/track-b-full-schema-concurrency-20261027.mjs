import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const container = 'rrj-track-b-fullschema-20261027';
const database = {baseline:'tb_baseline','corrected-manager-first':'tb_manager_first','corrected-rider-first':'tb_rider_first'}[process.argv[2] ?? 'baseline'];
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
const mode = process.argv[2] ?? 'baseline';

if (!['baseline', 'corrected-manager-first', 'corrected-rider-first'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);

function dockerSql(sql) {
  const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', database], { input: sql, encoding: 'utf8', maxBuffer: 10_000_000 });
  if (r.status !== 0) throw new Error(`${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
}
function session(name) {
  const process = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-P', 'pager=off', '-P', 'format=unaligned', '-P', 'tuples_only=on', '-v', 'VERBOSITY=verbose', '-U', 'supabase_admin', '-d', database], { stdio: ['pipe','pipe','pipe'] });
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
  console.log('DATABASE', database);
  const functionHashes = dockerSql(`select proname, md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('settle_paid_order_cancellation','advance_rider_delivery') order by 1;`);
  console.log('FUNCTION HASHES', functionHashes);
  assert.match(functionHashes, /advance_rider_delivery\s+\| 5a02c96e0eeb14e1847ce85f2d1d46c0/);
  assert.match(functionHashes, new RegExp(`settle_paid_order_cancellation\\s+\\| ${mode === 'baseline' ? 'f4ee0ef351d3eb7a29824617958c66d2' : '21de9a3e45c26b2b4a3a961669217340'}`));
  const schemaEvidence = dockerSql(`select (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and t.tgenabled='O') enabled_triggers, (select count(*) from pg_policies where schemaname='public') policies, (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('orders','payments','delivery_assignments','cashier_transactions','profiles','riders') and c.relrowsecurity) rls_tables;`);
  console.log('SCHEMA EVIDENCE', schemaEvidence);
  assert.match(schemaEvidence, /43\s+\|\s+19\s+\|\s+6/);
  console.log('BASELINE', dockerSql(state));
  const manager = session('manager');
  const riderSession = session('rider');
  if (mode === 'baseline') {
    console.log('MANAGER BEGIN', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; select id from public.orders where id='${id.order}' for update; set role authenticated;`));
    console.log('RIDER BEGIN', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; select id from public.delivery_assignments where id='${id.assignment}' for update; set role authenticated;`));
    const managerPending = manager.run(cancelCall);
    await new Promise(resolve => setTimeout(resolve, 250));
    const wait = dockerSql(`select wait_event_type, wait_event, pg_blocking_pids(pid) from pg_stat_activity where datname=current_database() and query like 'select public.settle_paid_order_cancellation(%' and wait_event_type is not null;`);
    console.log('MANAGER WAIT', wait);
    assert.match(wait, /Lock\s+\| transactionid\s+\| \{\d+\}/);
    const riderResult = await riderSession.run(riderCall);
    const managerResult = await managerPending;
    console.log('RIDER CALL', riderResult);
    console.log('MANAGER CALL', managerResult);
  } else if (mode === 'corrected-manager-first') {
    console.log('MANAGER BEGIN', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; select id from public.delivery_assignments where id='${id.assignment}' for update; set role authenticated;`));
    console.log('RIDER BEGIN', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; set role authenticated;`));
    const riderPending = riderSession.run(riderCall);
    await new Promise(resolve => setTimeout(resolve, 250));
    const wait = dockerSql(`select wait_event_type, wait_event, pg_blocking_pids(pid) from pg_stat_activity where datname=current_database() and query like 'select * from public.advance_rider_delivery(%' and wait_event_type is not null;`);
    console.log('RIDER WAIT', wait);
    assert.match(wait, /Lock\s+\| transactionid\s+\| \{\d+\}/);
    console.log('MANAGER CALL', await manager.run(cancelCall));
    console.log('MANAGER COMMIT', await manager.run('commit;'));
    console.log('RIDER CALL', await riderPending);
  } else {
    console.log('RIDER BEGIN', await riderSession.run(`begin; set local request.jwt.claim.sub='${id.rider}'; select id from public.delivery_assignments where id='${id.assignment}' for update; set role authenticated;`));
    console.log('MANAGER BEGIN', await manager.run(`begin; set local request.jwt.claim.sub='${id.manager}'; set role authenticated;`));
    const managerPending = manager.run(cancelCall);
    await new Promise(resolve => setTimeout(resolve, 250));
    const wait = dockerSql(`select wait_event_type, wait_event, pg_blocking_pids(pid) from pg_stat_activity where datname=current_database() and query like 'select public.settle_paid_order_cancellation(%' and wait_event_type is not null;`);
    console.log('MANAGER WAIT', wait);
    assert.match(wait, /Lock\s+\| transactionid\s+\| \{\d+\}/);
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
  const anonExecute = dockerSql(`select has_function_privilege('anon','public.settle_paid_order_cancellation(uuid,text,text,public.payment_method,text,boolean,boolean)','EXECUTE'), has_function_privilege('anon','public.advance_rider_delivery(uuid,public.delivery_assignment_status)','EXECUTE');`);
  console.log('ANON EXECUTE', anonExecute);
  assert.match(anonExecute, /f\s+\| f/);
  const finalState = dockerSql(state);
  console.log('FINAL', finalState);
  const sideEffects = dockerSql(`select (select count(*) from public.rider_offer_push_outbox) push_outbox, (select count(*) from public.inventory_transactions) inventory_transactions, (select count(*) from auth.audit_log_entries) auth_audit, (select count(*) from public.profiles) profiles, a.updated_at>a.created_at assignment_timestamp_updated, p.updated_at>p.created_at payment_timestamp_updated, r.updated_at>r.created_at rider_timestamp_updated from public.delivery_assignments a join public.payments p on p.order_id=a.order_id join public.riders r on r.id=a.rider_id where a.id='${id.assignment}';`);
  console.log('TRIGGER SIDE EFFECTS', sideEffects);
  assert.match(sideEffects, /0\s+\|\s+0\s+\|\s+0\s+\|\s+3\s+\| t\s+\|/);
  console.log('MANAGER ERRORS', manager.log.match(/ERROR:[^]*?(?=__manager_|$)/g)?.join('\n') ?? 'none');
  console.log('RIDER ERRORS', riderSession.log.match(/ERROR:[^]*?(?=__rider_|$)/g)?.join('\n') ?? 'none');
  assert.match(riderSession.log, /42501: Active Manager access is required/);
  assert.match(manager.log, /Only an active approved rider may update a delivery/);
  if (mode === 'corrected-manager-first') {
    assert.doesNotMatch(manager.log + riderSession.log, /40P01/);
    assert.match(finalState, /cancelled\s+\| cancelled\s+\| voided\s+\| voided\s+\|\s+1\s+\|\s+1/);
    assert.match(manager.log, /"already_recorded": true/);
    assert.match(sideEffects, /\| t\s+\| t\s+\| t/);
  } else {
    if (mode === 'baseline') assert.match(manager.log, /40P01: deadlock detected/);
    else assert.doesNotMatch(manager.log + riderSession.log, /40P01/);
    assert.match(finalState, /picked_up\s+\| picked_up\s+\| verified\s+\| completed\s+\|\s+0\s+\|\s+1/);
    assert.match(manager.log, /22023: Only a paid order before rider pickup or completion can be settled/);
  }
  console.log('ASSERTIONS PASS', mode);
  manager.close(); riderSession.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
