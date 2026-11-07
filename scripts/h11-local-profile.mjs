#!/usr/bin/env node
// Local-only H-11B diagnostic and deliberately narrow reversible opt-out.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const project = 'rrj_h08c_history_20261015';
const optional = `supabase_analytics_${project}`;
const journal = resolve('.tmp/h11-profile-journal.json');
const profiles = {
  daily: { project: 'rrj_h09_order_flow_20261015', port: '48321' },
  'h09-qa': { project: 'rrj_h09_order_flow_20261015', port: '48321' },
  demo: { project: 'rrj_defense_demo_20261014', port: '61321' },
  h08c: { project, port: '59321' },
  'all-projects': null,
};
// Review candidates only. This list does not expand the executable stop allowlist.
const scheduleCandidates = [
  'rrj_h07_financial_20261014', 'rrj_h08b_history_20261015',
  'rrj_manager_lifecycle_20261014', 'rrj_phase3_prefix_20261014_a1',
  'rrj_phase8_sim', 'rrj_rc_synthetic_replay_20261013',
  'rrj_defense_demo_20261014_r2', 'rrj_defense_demo_20261014_r3',
  'rrj_h08c_history_20261015',
];
const args = process.argv.slice(2);
const action = args[0] ?? 'help';
const apply = args.includes('--apply');
const value = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; };
function run(bin, argv, timeout = 8000) {
  const r = spawnSync(bin, argv, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(`${bin} ${argv[0]} failed or timed out: ${String(r.error?.message ?? r.stderr).slice(0, 180)}`);
  return r.stdout.trim();
}
function inspect(name) {
  const c = JSON.parse(run('docker', ['inspect', name]))[0];
  if (c.Name !== `/${name}`) throw new Error('Unexpected container identity');
  return c;
}
function safeTarget() {
  run('docker', ['info', '--format', '{{.ServerVersion}}']);
  const c = inspect(optional);
  if (c.Config.Labels?.['com.docker.compose.project'] !== project ||
      c.Config.Labels?.['com.supabase.cli.project'] !== project ||
      c.NetworkSettings.Networks?.[`supabase_network_${project}`]?.Aliases?.includes('analytics') !== true ||
      c.NetworkSettings.Ports?.['4000/tcp']?.some(p => p.HostIp === '127.0.0.1' && p.HostPort === '59327') !== true ||
      c.Mounts.length !== 0 ||
      !c.Config.Image.startsWith('public.ecr.aws/supabase/logflare:')) throw new Error('Allowlist identity mismatch');
  return c;
}
function allContainers() {
  const ids = run('docker', ['ps', '-aq']).split(/\s+/).filter(Boolean);
  return ids.length ? JSON.parse(run('docker', ['inspect', ...ids], 20000)) : [];
}
function summary(c) {
  return { name: c.Name.slice(1), id: c.Id.slice(0, 12), project: c.Config.Labels?.['com.docker.compose.project'] ?? null,
    composeService: c.Config.Labels?.['com.docker.compose.service'] ?? null,
    supabaseProject: c.Config.Labels?.['com.supabase.cli.project'] ?? null, running: c.State.Running,
    health: c.State.Health?.Status ?? null, ports: Object.values(c.NetworkSettings.Ports ?? {}).flatMap(v => v ?? [])
      .filter(p => p.HostPort).map(p => `${p.HostIp}:${p.HostPort}`),
    networks: Object.keys(c.NetworkSettings.Networks ?? {}), mounts: c.Mounts.map(m => ({ type: m.Type, destination: m.Destination })) };
}
function profilePlan(name) {
  if (!Object.hasOwn(profiles, name)) throw new Error('Unknown profile');
  const containers = allContainers();
  const groups = Object.groupBy(containers, c => c.Config.Labels?.['com.docker.compose.project'] ?? '<unlabeled>');
  const inventory = Object.entries(groups).map(([projectName, cs]) => ({ project: projectName,
    running: cs.filter(c => c.State.Running).length, total: cs.length,
    services: cs.map(summary) })).sort((a, b) => a.project.localeCompare(b.project));
  const target = containers.find(c => c.Name === `/${optional}`);
  let resources;
  try { resources = memory(); } catch { resources = { warning: 'WSL reading unavailable' }; }
  return { profile: name, retained: profiles[name], dryRun: true, resources,
    warnings: resourceWarnings(resources), inventory,
    proposedStop: name === 'daily' || name === 'h09-qa' ? [optional] : [],
    impacts: name === 'daily' || name === 'h09-qa' ? ['H-08C analytics endpoint 127.0.0.1:59327 unavailable', 'H-08C Studio and log/vector workflows may degrade'] : [],
    blocked: name === 'daily' || name === 'h09-qa' ?
      ['Idle status requires live verification; plan never authorizes a stop',
       ...(target?.State.Running && Date.now() - Date.parse(target.State.StartedAt) < 30 * 60 * 1000 ? ['Target started within 30 minutes'] : [])] :
      ['No services allowlisted for mutation in this profile'] };
}
function schedulePlan() {
  const containers = allContainers();
  const byProject = Object.groupBy(containers, c => c.Config.Labels?.['com.docker.compose.project'] ?? '<unlabeled>');
  return { action: 'schedule', dryRun: true, capturedAt: new Date().toISOString(),
    executableStopAllowlist: [optional],
    reviewOnly: scheduleCandidates.map(projectName => {
      const cs = byProject[projectName] ?? [];
      return { project: projectName, running: cs.filter(c => c.State.Running).length,
        services: cs.map(c => ({ name: c.Name.slice(1), id: c.Id.slice(0, 12),
          running: c.State.Running, restarted: c.RestartCount,
          startedAt: c.State.StartedAt,
          composeProjectMatches: c.Config.Labels?.['com.docker.compose.project'] === projectName,
          supabaseProjectMatches: c.Config.Labels?.['com.supabase.cli.project'] === projectName })) };
    }),
    protectedProjects: ['rrj_h09_order_flow_20261015', 'rrj_defense_demo_20261014',
      'rrj_recovery_20261014_source', 'rrj_recovery_20261014_target',
      'isolated-stack', 'my-local-todo-app', '<unlabeled>'],
    consentChecklist: ['Exact project and every service approved by owner',
      'Current users, jobs, browser tabs and tests checked; last-use time recorded',
      'Network aliases, mounted data and downstream feature dependencies reviewed',
      'Restore order, original IDs, ports and health checks recorded',
      'WSL RAM/swap and Docker responsiveness satisfy preflight'],
    restoreManifestTemplate: { project: '<approved exact project>', approvedServices: [],
      originalContainerIds: [], originalRunningStates: [], portBindings: [],
      stopOrder: [], startOrder: [], stoppedAt: null, restoredAt: null,
      ownerApprovalReference: null, healthResult: null },
    blocked: 'No stack-level stop is implemented; current use and owner approval remain unverified' };
}
function resourceWarnings(m) {
  return [
    ...(Number.isFinite(m.availableMiB) && m.availableMiB < 800 ? [`Low WSL available RAM: ${Math.round(m.availableMiB)} MiB`] : []),
    ...(Number.isFinite(m.swapUsedMiB) && Number.isFinite(m.swapTotalMiB) && m.swapUsedMiB > 0.9 * m.swapTotalMiB ?
      [`WSL swap over 90% used: ${Math.round(m.swapUsedMiB)}/${Math.round(m.swapTotalMiB)} MiB`] : []),
  ];
}
function save(data) {
  mkdirSync(dirname(journal), { recursive: true });
  const tmp = `${journal}.new`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, journal);
}
function memory() {
  const raw = run('wsl', ['-e', 'sh', '-lc', 'cat /proc/meminfo; cat /proc/loadavg; cat /proc/pressure/memory'], 5000);
  const field = key => Number(raw.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? NaN) / 1024;
  return { totalMiB: field('MemTotal'), availableMiB: field('MemAvailable'), swapUsedMiB: field('SwapTotal') - field('SwapFree'), swapTotalMiB: field('SwapTotal'), load1: Number(raw.match(/^(\d+\.\d+) \d+\.\d+ \d+\.\d+ /m)?.[1] ?? NaN), pressure10: Number(raw.match(/some avg10=([\d.]+)/)?.[1] ?? NaN) };
}
async function probe(url) {
  const start = performance.now();
  try { const r = await fetch(url, { signal: AbortSignal.timeout(4000) }); await r.arrayBuffer(); return { code: r.status, ms: Math.round(performance.now() - start) }; }
  catch (e) { return { error: e.name, ms: Math.round(performance.now() - start) }; }
}
async function sample(profile) {
  run('docker', ['info', '--format', '{{.ServerVersion}}']);
  const { project: stack, port } = profile;
  const db = inspect(`supabase_db_${stack}`);
  const kong = inspect(`supabase_kong_${stack}`);
  if (db.Config.Labels?.['com.docker.compose.project'] !== stack || kong.Config.Labels?.['com.docker.compose.project'] !== stack ||
      !db.State.Running || !kong.State.Running || !kong.NetworkSettings.Ports?.['8000/tcp']?.some(p => p.HostIp === '127.0.0.1' && p.HostPort === port)) throw new Error('Stack identity/loopback preflight failed');
  const [auth, rest] = await Promise.all([probe(`http://127.0.0.1:${port}/auth/v1/health`), probe(`http://127.0.0.1:${port}/rest/v1/`)]);
  let sql;
  try { sql = run('docker', ['exec', '-u', 'postgres', `supabase_db_${stack}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', 'select 1'], 6000) === '1' ? 'PASS' : 'FAIL'; }
  catch { sql = 'FAIL'; }
  const resources = memory();
  return { at: new Date().toISOString(), memory: resources, warnings: resourceWarnings(resources),
    auth, rest, sql, dbRestarts: db.RestartCount, kongRestarts: kong.RestartCount };
}
async function main() {
  if (action === 'help' || args.includes('--help')) {
    console.log('Usage: node scripts/h11-local-profile.mjs plan [--profile daily|h09-qa|demo|h08c|all-projects]');
    console.log('       node scripts/h11-local-profile.mjs sample [--profile daily|h09-qa|demo|h08c --count 6 --interval 5000]');
    console.log('       node scripts/h11-local-profile.mjs stop-optional [--profile daily|h09-qa --idle-verified --dependencies-reviewed --owner-approved supabase_analytics_rrj_h08c_history_20261015] [--apply]');
    console.log('       node scripts/h11-local-profile.mjs trial [--profile daily|h09-qa --idle-verified --dependencies-reviewed --owner-approved supabase_analytics_rrj_h08c_history_20261015] [--apply]');
    console.log('       node scripts/h11-local-profile.mjs restore [--apply]');
    console.log('       node scripts/h11-local-profile.mjs schedule');
    console.log('Default is dry-run. Exact allowlist: H-08C analytics only. Stop requires separate service-specific owner approval and current idle/dependency verification; flags only attest these checks. Restore starts only the journaled previously running container. No rm, down, volume or network operations.');
    return;
  }
  if (action === 'plan') { console.log(JSON.stringify(profilePlan(value('--profile', 'daily')), null, 2)); return; }
  if (action === 'schedule') { console.log(JSON.stringify(schedulePlan(), null, 2)); return; }
  if (action === 'trial') {
    const selected = value('--profile', 'h09-qa');
    if (!['daily', 'h09-qa'].includes(selected)) throw new Error('No trial allowlist for selected profile');
    if (!apply) { console.log(JSON.stringify(profilePlan(selected), null, 2)); return; }
    if (!args.includes('--idle-verified')) throw new Error('Trial needs current external idle verification');
    const invoke = argv => {
      const r = spawnSync(process.execPath, [process.argv[1], ...argv],
        { encoding: 'utf8', timeout: 240000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
      if (r.error || r.status !== 0) throw new Error(`${argv[0]} failed: ${r.error?.message ?? r.status}`);
    };
    try {
      invoke(['stop-optional', '--profile', selected, '--idle-verified', '--dependencies-reviewed',
        '--owner-approved', value('--owner-approved', ''), '--apply']);
      invoke(['sample', '--profile', 'h09-qa', '--count', '12', '--interval', '12000']);
    } finally {
      if (existsSync(journal)) invoke(['restore', '--apply']);
    }
    return;
  }
  if (action === 'sample') {
    const count = Number(value('--count', 6)), interval = Number(value('--interval', 5000));
    const profileName = value('--profile', 'h09-qa');
    if (!Object.hasOwn(profiles, profileName) || profiles[profileName] === null) throw new Error('Unknown or non-sample profile');
    if (!Number.isInteger(count) || count < 1 || count > 12 || !Number.isInteger(interval) || interval < 0 || interval > 30000) throw new Error('Invalid bounded sampling arguments');
    const rows = [];
    for (let i = 0; i < count; i++) { rows.push(await sample(profiles[profileName])); if (i + 1 < count) await new Promise(r => setTimeout(r, interval)); }
    console.log(JSON.stringify({ profile: profileName, count, rows, pass: rows.every(r => r.auth.code === 200 && r.rest.code === 200 && r.sql === 'PASS') }, null, 2));
    return;
  }
  if (!['stop-optional', 'restore'].includes(action)) throw new Error('Unknown action');
  const c = safeTarget();
  const before = { id: c.Id, name: optional, project, wasRunning: c.State.Running, restartCount: c.RestartCount };
  if (action === 'stop-optional') {
    const selected = value('--profile', 'h09-qa');
    if (!['daily', 'h09-qa'].includes(selected)) throw new Error('No stop allowlist for selected profile');
    if (existsSync(journal)) throw new Error('Existing journal: restore or investigate before another stop');
    if (!c.State.Running) throw new Error('Target is already stopped; refusing to claim ownership');
    if (Date.now() - Date.parse(c.State.StartedAt) < 30 * 60 * 1000) throw new Error('Target started within 30 minutes; current owner/idle status uncertain');
    for (const role of ['db', 'auth', 'rest', 'kong']) {
      const retained = inspect(`supabase_${role}_rrj_h09_order_flow_20261015`);
      if (retained.Config.Labels?.['com.docker.compose.project'] !== 'rrj_h09_order_flow_20261015' ||
          !retained.State.Running || retained.State.Health?.Status === 'unhealthy') throw new Error(`Retained H-09 ${role} preflight failed`);
    }
    const mem = memory();
    if (!Number.isFinite(mem.availableMiB) || mem.availableMiB < 400 || mem.pressure10 > 20) throw new Error('WSL memory health uncertain; refusing mutation');
    console.log(JSON.stringify({ action, profile: selected, dryRun: !apply, target: before, memory: mem, journal,
      impact: 'H-08C analytics 59327 unavailable; H-08C Studio/log/vector workflows may degrade',
      idleVerification: args.includes('--idle-verified') ? 'operator-attested' : 'MISSING' }, null, 2));
    if (!apply) return;
    if (!args.includes('--idle-verified')) throw new Error('Current idle verification required; --idle-verified is an operator attestation, not inferred from name');
    if (!args.includes('--dependencies-reviewed') || value('--owner-approved', '') !== optional)
      throw new Error('Exact service-specific owner approval and dependency review required');
    save({ version: 2, ...before, phase: 'pending-stop', at: new Date().toISOString(), profile: selected });
    try {
      run('docker', ['stop', '-t', '15', optional], 25000);
      if (inspect(optional).State.Running) throw new Error('Stop was not confirmed');
    } catch (e) {
      try { if (!inspect(optional).State.Running) run('docker', ['start', optional], 25000); }
      catch { throw new Error(`${e.message}; automatic restoration failed, journal retained`); }
      save({ ...before, phase: 'restored-after-stop-error', restoredAt: new Date().toISOString() });
      renameSync(journal, journal.replace(/\.json$/, `-${Date.now()}.restored.json`));
      throw e;
    }
    save({ ...before, phase: 'stopped', at: new Date().toISOString() });
    console.log('STOPPED; journal retained until restore');
  } else {
    if (!existsSync(journal)) throw new Error('No journal; refusing arbitrary start');
    const prior = JSON.parse(readFileSync(journal, 'utf8'));
    if (prior.id !== c.Id || prior.name !== optional || prior.project !== project || !prior.wasRunning) throw new Error('Journal/target mismatch');
    console.log(JSON.stringify({ action, dryRun: !apply, target: before, journal }, null, 2));
    if (!apply) return;
    if (!c.State.Running) run('docker', ['start', optional], 25000);
    if (!inspect(optional).State.Running) throw new Error('Restore not confirmed; journal retained');
    save({ ...prior, phase: 'restored', restoredAt: new Date().toISOString() });
    const archived = journal.replace(/\.json$/, `-${Date.now()}.restored.json`);
    renameSync(journal, archived);
    console.log(`RESTORED; audit journal archived at ${archived}`);
  }
}
main().catch(e => { console.error(`BLOCKED: ${e.message}`); process.exitCode = 1; });
