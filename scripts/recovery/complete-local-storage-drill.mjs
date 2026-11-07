// Completes three-bucket synthetic byte coverage on the fixed local drill stacks.
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = 'C:/Users/Janmari/Downloads';
const stacks = [
  { dir: join(base, 'RRJ-Recovery-20261014-Source'), url: 'http://127.0.0.1:65321', db: 'supabase_db_rrj_recovery_20261014_source' },
  { dir: join(base, 'RRJ-Recovery-20261014-Target'), url: 'http://127.0.0.1:64321', db: 'supabase_db_rrj_recovery_20261014_target' },
];
const t0 = performance.now();
function run(exe, args) {
  const r = spawnSync(exe, args, { encoding: 'utf8', shell: exe === 'npx.cmd' });
  if (r.status !== 0) throw new Error(`${exe} local check failed.`);
  return r.stdout.trim();
}
function getInfo(stack) {
  const info = JSON.parse(run('npx.cmd', ['--yes', 'supabase@2.120.0', 'status', '--workdir', stack.dir, '-o', 'json']));
  if (info.API_URL !== stack.url || !info.SERVICE_ROLE_KEY || !info.ANON_KEY) throw new Error('Unexpected local stack.');
  return info;
}
function sql(stack, query) { return run('docker', ['exec', '-u', 'postgres', stack.db, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-Atqc', query]); }
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function api(stack, info, path, method, body, type) {
  const response = await fetch(stack.url + path, { method, redirect: 'error', headers: {
    apikey: info.SERVICE_ROLE_KEY, authorization: `Bearer ${info.SERVICE_ROLE_KEY}`,
    ...(type ? { 'content-type': type } : {}),
  }, body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
  if (!response.ok) throw new Error(`Local Storage HTTP ${response.status}.`);
  return response;
}
const [source, target] = stacks;
const [src, dst] = stacks.map(getInfo);
const findings = [];
for (const bucket of ['delivery-proofs', 'rider-documents']) {
  const objectKey = `synthetic/${randomUUID()}.txt`;
  const bytes = Buffer.from(`synthetic recovery byte test: ${bucket}\n`);
  await api(source, src, '/storage/v1/bucket', 'POST', { id: bucket, name: bucket, public: false }, 'application/json');
  await api(source, src, `/storage/v1/object/${bucket}/${objectKey}`, 'POST', bytes, 'text/plain');
  const downloaded = Buffer.from(await (await api(source, src, `/storage/v1/object/${bucket}/${objectKey}`, 'GET')).arrayBuffer());
  if (hash(downloaded) !== hash(bytes)) throw new Error('Source bytes differ.');
  await api(target, dst, '/storage/v1/bucket', 'POST', { id: bucket, name: bucket, public: false }, 'application/json');
  await api(target, dst, `/storage/v1/object/${bucket}/${objectKey}`, 'POST', downloaded, 'text/plain');
  const restored = Buffer.from(await (await api(target, dst, `/storage/v1/object/${bucket}/${objectKey}`, 'GET')).arrayBuffer());
  if (hash(restored) !== hash(bytes)) throw new Error('Restored bytes differ.');
  const denied = await fetch(target.url + `/storage/v1/object/${bucket}/${objectKey}`, { redirect: 'error', headers: {
    apikey: dst.ANON_KEY, authorization: `Bearer ${dst.ANON_KEY}`,
  } });
  if (denied.ok) throw new Error('Anonymous read unexpectedly succeeded.');
  findings.push({ bucket, sha256: hash(bytes), anonymousRead: 'DENIED' });
}
const counts = stacks.map((stack) => JSON.parse(sql(stack, "select jsonb_object_agg(id, coalesce(n,0)) from storage.buckets b left join (select bucket_id,count(*) n from storage.objects group by bucket_id) o on o.bucket_id=b.id")));
if (JSON.stringify(counts[0]) !== JSON.stringify(counts[1]) || Object.keys(counts[0]).length !== 3 || Object.values(counts[0]).some((n) => Number(n) !== 1)) throw new Error('Three-bucket metadata comparison failed.');
const report = { status: 'PASS', durationMs: Math.round(performance.now() - t0), sourceCounts: counts[0], targetCounts: counts[1], findings };
writeFileSync(join(base, 'RRJ-Recovery-20261014-Synthetic-Bundle', 'storage-completion.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
process.stdout.write(`${JSON.stringify(report)}\n`);
