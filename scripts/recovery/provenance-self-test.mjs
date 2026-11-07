// Synthetic files in a disposable directory exercise the read-only historical gate.
// Their approval fields are test inputs, not business authorization.
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'rrj-provenance-test-'));
const gate = join(import.meta.dirname, 'validate-provenance.mjs');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const initial = spawnSync(process.execPath, [gate], { encoding: 'utf8' });
if (initial.status !== 1) throw Error('Missing historical approval must block.');
const scope = JSON.parse(initial.stdout);
const categoryId = randomUUID();
const category = [{ id: categoryId, name: 'Synthetic category' }];
const menu = scope.requiredMenuIds.map((id) => ({ id, name: 'Synthetic menu item', category_id: categoryId }));
const inventory = scope.requiredInventoryIds.map((id, index) => ({ id, name: index ? 'Synthetic inventory item' : 'Chicken', unit: 'kg' }));
const files = { category, menu, inventory };
const manifest = {
  schemaVersion: 1,
  environment: 'historical-bootstrap',
  phase2aSha256: scope.phase2aSha256,
  files: [],
  approval: {
    approved: true, owner: 'SYNTHETIC TEST ONLY', approvedAt: '2000-01-01',
    sourceDescription: 'SYNTHETIC TEST ONLY', categorySourceDescription: 'SYNTHETIC TEST ONLY',
    recipeTuplesSha256: '5d2551ee51d124346edc2bd884dce035f7234b9906f74b1385c9b9cbd8ba7677',
    openingStockDecision: 'approved-zero', openingStockEvidenceId: 'SYNTHETIC TEST ONLY',
  },
};
function run() {
  manifest.files = Object.entries(files).map(([kind, rows]) => {
    const path = `${kind}.json`;
    const bytes = JSON.stringify(rows);
    writeFileSync(join(dir, path), bytes);
    return { kind, path, sha256: sha(bytes) };
  });
  const path = join(dir, 'manifest.json');
  writeFileSync(path, JSON.stringify(manifest));
  const result = spawnSync(process.execPath, [gate, path], { encoding: 'utf8' });
  return { exit: result.status, report: JSON.parse(result.stdout) };
}
let result = run();
if (result.exit !== 0 || result.report.status !== 'REVIEW_REQUIRED') throw Error('Structurally valid synthetic baseline should require human review.');
menu[0].category_id = randomUUID();
result = run();
if (result.exit !== 1 || !result.report.findings.some((finding) => finding.includes('required menu parent'))) throw Error('Missing category parent was accepted.');
menu[0].category_id = categoryId;
manifest.files = [];
delete manifest.approval.categorySourceDescription;
result = run();
if (result.exit !== 1 || !result.report.findings.some((finding) => finding.includes('Category parent provenance'))) throw Error('Missing category approval was accepted.');
process.stdout.write('PASS: category parents and provenance fail closed; synthetic complete baseline remains REVIEW_REQUIRED.\n');
