// Read-only release gate. Approval records are evidence, never deployment authority.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const expected = [
  ['20261013000302_revoke_authenticated_maintain_privileges.sql', 'cbc8b54349e724eeb75796984014b33df9f8b3ef46415647fe33f7fa02a27828'],
  ['20261013053159_production_delivery_policy.sql', 'ebe0b2c02f3035602d5544b5ec024fe5fcfb2f58fa4cdab2c9784305cca058ee'],
  ['20261013071937_remove_duplicate_timestamp_triggers.sql', '5c7c4376908980f4ca5d6f88478bd45f297a7dc069940b5e374900c98a5dae67'],
  ['20261013105400_customer_modifier_completion.sql', '62fda49a4c2d432bc8574b3b1d08f1eefeb528772dcc1bec8a59ab98cf8dba46'],
  ['20261013162631_kds_queue_modifier_channel_v2.sql', '0ed9253c4de11de4d204e18f5d056fd5331a0ac16eb9e138de50442fc19bc9fb'],
  ['20261014191853_h08c_historical_shift_access.sql', '121dbf55122736b853a93989fab0a46c22af4d98d22a308aab219371e161b5b5'],
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const findings = [];
const migrations = readdirSync(join(root, 'supabase/migrations')).filter((n) => /^\d{14}_.+\.sql$/.test(n)).sort();
// The reviewed H-08C shift migration extends the pending tail to six files.
// It is unrelated to M3 and remains blocked from hosted promotion by this gate.
if (migrations.length !== 52) findings.push(`Expected 52 reviewed migration files; found ${migrations.length}.`);
if (migrations.slice(-expected.length).join('|') !== expected.map(([name]) => name).join('|')) findings.push('Pending migration order or names differ.');
for (const [name, digest] of expected) {
  try { if (hash(readFileSync(join(root, 'supabase/migrations', name))) !== digest) findings.push(`${name}: SHA-256 differs.`); }
  catch { findings.push(`${name}: missing.`); }
}
const [provenancePath, recoveryPath] = process.argv.slice(2);
if (!provenancePath) findings.push('Missing private historical approval manifest.');
else {
  const check = spawnSync(process.execPath, [join(root, 'scripts/recovery/validate-provenance.mjs'), provenancePath], { encoding: 'utf8' });
  try { if (JSON.parse(check.stdout).status !== 'REVIEW_REQUIRED') findings.push('Historical baseline approval gate blocked.'); }
  catch { findings.push('Historical baseline approval validator failed.'); }
}
if (!recoveryPath) findings.push('Missing private hosted recovery authorization manifest.');
else {
  try {
    const approval = JSON.parse(readFileSync(resolve(recoveryPath), 'utf8'));
    const requiredText = ['owner', 'approvedAt', 'restrictedDestinationId', 'independentOffDeviceLocationId', 'encryptionMethod', 'ownerHeldKeyCustodian', 'privateObjectByteRoute', 'restoreRehearsalEnvironmentId'];
    if (approval.schemaVersion !== 1 || approval.projectRef !== 'zhzluhqvysvsadwuugpa' || approval.approved !== true ||
      requiredText.some((key) => typeof approval[key] !== 'string' || !approval[key].trim()) ||
      approval.coverage?.postgres !== true || approval.coverage?.auth !== true || approval.coverage?.storageMetadata !== true ||
      approval.coverage?.allPrivateStorageBytes !== true || approval.coverage?.catalogAndLedger !== true ||
      Number.isNaN(Date.parse(approval.approvedAt))) findings.push('Hosted recovery authorization is incomplete.');
  } catch { findings.push('Hosted recovery authorization is missing or malformed.'); }
}
// Matching approval records still require human review and separate execution evidence.
const status = findings.length ? 'BLOCKED' : 'REVIEW_REQUIRED';
process.stdout.write(`${JSON.stringify({ status, migrationHashes: expected.map(([name, sha256]) => ({ name, sha256 })), findings, nextGate: 'Review approvals and independently verify encrypted hosted backup, restore, pristine replay, and acceptance evidence.' }, null, 2)}\n`);
if (status === 'BLOCKED') process.exitCode = 1;
