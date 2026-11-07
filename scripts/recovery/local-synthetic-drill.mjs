// Uses ONLY two fixed, separately named loopback Supabase stacks. No hosted credentials.
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const root = 'C:/Users/Janmari/Downloads';
const bundle = join(root, 'RRJ-Recovery-20261014-Synthetic-Bundle');
const pairs = [
  { name: 'rrj_recovery_20261014_source', dir: join(root, 'RRJ-Recovery-20261014-Source'), url: 'http://127.0.0.1:65321' },
  { name: 'rrj_recovery_20261014_target', dir: join(root, 'RRJ-Recovery-20261014-Target'), url: 'http://127.0.0.1:64321' },
];
const t0 = performance.now();
const failures = [];
function run(exe, args, input) {
  const r = spawnSync(exe, args, { encoding: 'utf8', input, maxBuffer: 20 * 1024 * 1024, shell: exe === 'npx.cmd' });
  if (r.status !== 0) throw new Error(`${exe} failed: ${(r.stderr || '').slice(0, 240)}`);
  return r.stdout;
}
function sql(stack, query) {
  return run('docker', ['exec', '-u', 'postgres', `supabase_db_${stack.name}`, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', query]).trim();
}
function status(stack) {
  const raw = run('npx.cmd', ['--yes', 'supabase@2.120.0', 'status', '--workdir', stack.dir, '-o', 'json']);
  const info = JSON.parse(raw);
  if (info.API_URL !== stack.url || !info.SERVICE_ROLE_KEY || !info.ANON_KEY) throw new Error('Unexpected local stack status.');
  if (sql(stack, 'select current_database()') !== 'postgres') throw new Error('Local database unavailable.');
  return info;
}
async function request(stack, path, method, key, body, contentType) {
  const response = await fetch(stack.url + path, {
    method, redirect: 'error',
    headers: { apikey: key, authorization: `Bearer ${key}`, ...(contentType ? { 'content-type': contentType } : {}) },
    body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)),
  });
  if (!response.ok) throw new Error(`${method} ${path.split('/').slice(0, 4).join('/')} HTTP ${response.status}`);
  return response;
}
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function count(stack, table) { return Number(sql(stack, `select count(*) from ${table}`)); }
async function main() {
  mkdirSync(bundle, { recursive: false });
  const [source, target] = pairs;
  const src = status(source); const dst = status(target);
  const uuid = randomUUID();
  const email = `restore-${uuid}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString('base64url')}`;
  sql(source, 'create table public.recovery_probe (id uuid primary key, user_id uuid not null references auth.users(id), marker text not null)');
  const userResponse = await request(source, '/auth/v1/admin/users', 'POST', src.SERVICE_ROLE_KEY,
    { email, password, email_confirm: true }, 'application/json');
  const user = await userResponse.json();
  if (!/^[0-9a-f-]{36}$/.test(user.id)) throw new Error('Synthetic Auth user creation failed.');
  sql(source, `insert into public.recovery_probe values ('${uuid}','${user.id}','synthetic-only')`);
  const object = Buffer.from(`RRJ synthetic recovery proof ${uuid}\n`);
  const key = `${user.id}/probe.txt`;
  await request(source, '/storage/v1/bucket', 'POST', src.SERVICE_ROLE_KEY,
    { id: 'payment-proofs', name: 'payment-proofs', public: false }, 'application/json');
  await request(source, `/storage/v1/object/payment-proofs/${key}`, 'POST', src.SERVICE_ROLE_KEY, object, 'text/plain');
  const sourceSignIn = await request(source, '/auth/v1/token?grant_type=password', 'POST', src.ANON_KEY,
    { email, password }, 'application/json');
  if (!(await sourceSignIn.json()).access_token) throw new Error('Source Auth sign-in failed.');
  const sourceBytes = Buffer.from(await (await request(source, `/storage/v1/object/payment-proofs/${key}`, 'GET', src.SERVICE_ROLE_KEY)).arrayBuffer());
  if (sha(sourceBytes) !== sha(object)) throw new Error('Source Storage download differs.');
  writeFileSync(join(bundle, 'private-object.bin'), sourceBytes, { flag: 'wx' });
  const schema = run('docker', ['exec', '-u', 'postgres', `supabase_db_${source.name}`, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--schema-only', '--table=public.recovery_probe']);
  const data = run('docker', ['exec', '-u', 'postgres', `supabase_db_${source.name}`, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--data-only', '--column-inserts', '--table=auth.users', '--table=auth.identities', '--table=public.recovery_probe']);
  writeFileSync(join(bundle, 'schema.sql'), schema, { flag: 'wx' });
  writeFileSync(join(bundle, 'data.sql'), data, { flag: 'wx' });
  const manifest = { schemaVersion: 1, type: 'synthetic-local-drill', exportedAt: new Date().toISOString(),
    source: source.name, expected: { users: count(source, 'auth.users'), identities: count(source, 'auth.identities'), probes: count(source, 'public.recovery_probe'), objects: count(source, 'storage.objects') },
    files: ['schema.sql', 'data.sql', 'private-object.bin'].map((file) => { const bytes = readFileSync(join(bundle, file)); return { file, bytes: bytes.length, sha256: sha(bytes) }; }),
  };
  writeFileSync(join(bundle, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  for (const item of manifest.files) if (sha(readFileSync(join(bundle, item.file))) !== item.sha256) throw new Error('Bundle digest mismatch.');
  const backupMs = performance.now() - t0;
  const restoreStart = performance.now();
  run('docker', ['exec', '-i', '-u', 'postgres', `supabase_db_${target.name}`, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'], schema);
  run('docker', ['exec', '-i', '-u', 'postgres', `supabase_db_${target.name}`, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'], `begin; set local session_replication_role = replica;\n${data}\ncommit;`);
  await request(target, '/storage/v1/bucket', 'POST', dst.SERVICE_ROLE_KEY,
    { id: 'payment-proofs', name: 'payment-proofs', public: false }, 'application/json');
  await request(target, `/storage/v1/object/payment-proofs/${key}`, 'POST', dst.SERVICE_ROLE_KEY, readFileSync(join(bundle, 'private-object.bin')), 'text/plain');
  const targetSignIn = await request(target, '/auth/v1/token?grant_type=password', 'POST', dst.ANON_KEY,
    { email, password }, 'application/json');
  if (!(await targetSignIn.json()).access_token) throw new Error('Restored Auth sign-in failed.');
  const targetBytes = Buffer.from(await (await request(target, `/storage/v1/object/payment-proofs/${key}`, 'GET', dst.SERVICE_ROLE_KEY)).arrayBuffer());
  if (sha(targetBytes) !== sha(sourceBytes)) throw new Error('Restored Storage bytes differ.');
  const denied = await fetch(target.url + `/storage/v1/object/payment-proofs/${key}`, { headers: { apikey: dst.ANON_KEY, authorization: `Bearer ${dst.ANON_KEY}` }, redirect: 'error' });
  if (denied.ok) throw new Error('Private object is anonymous-readable.');
  const actual = { users: count(target, 'auth.users'), identities: count(target, 'auth.identities'), probes: count(target, 'public.recovery_probe'), objects: count(target, 'storage.objects') };
  if (JSON.stringify(actual) !== JSON.stringify(manifest.expected)) throw new Error('Restored table counts differ.');
  if (sql(target, 'select count(*) from public.recovery_probe p left join auth.users u on u.id=p.user_id where u.id is null') !== '0') throw new Error('Restored Auth foreign key is orphaned.');
  const report = { status: 'PASS', source: source.name, target: target.name, bundle,
    backupMs: Math.round(backupMs), restoreMs: Math.round(performance.now() - restoreStart),
    totalMs: Math.round(performance.now() - t0), sourceCounts: manifest.expected, targetCounts: actual,
    objectSha256: sha(sourceBytes), authPasswordSignIn: 'PASS', privateAnonymousDenial: 'PASS', failedSteps: failures };
  writeFileSync(join(bundle, 'drill-result.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ ...report, bundle: '[private local synthetic bundle]' })}\n`);
}
main().catch((error) => { failures.push(error.message); process.stderr.write(`Drill failed: ${error.message}\n`); process.exitCode = 1; });
