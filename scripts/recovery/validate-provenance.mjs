// Read-only gate. A manifest is evidence for review, never permission to load data.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const migrationsDir = join(root, 'supabase/migrations');
const phaseName = '20260904000000_inventory_phase_2a_recipe_deduction.sql';
const names = readdirSync(migrationsDir).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
const index = names.indexOf(phaseName);
if (index < 0) throw new Error('Phase 2A migration is missing.');
if (names.slice(0, index).length !== 12) throw new Error('Phase 2A predecessor set changed; review historical bootstrap gate.');
const phase = readFileSync(join(migrationsDir, phaseName), 'utf8');
const before = names.slice(0, index).map((name) => readFileSync(join(migrationsDir, name), 'utf8')).join('\n').toLowerCase();
const recipeInsert = phase.split('on conflict (menu_item_id, inventory_item_id)')[0];
const tuples = [...recipeInsert.matchAll(/\(\s*'([\da-f-]{36})'::uuid\s*,\s*'([\da-f-]{36})'::uuid\s*,\s*([\d.]+)\s*\)/gi)];
if (tuples.length !== 18) throw new Error('Phase 2A recipe parser needs review.');
const ids = (position) => [...new Set(tuples.map((match) => match[position].toLowerCase()))].sort();
const requiredMenuIds = ids(1);
const requiredInventoryIds = ids(2);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const result = {
  status: 'BLOCKED', migrationCount: names.length, phase2aVersion: phaseName.slice(0, 14),
  phase2aSha256: sha(readFileSync(join(migrationsDir, phaseName))),
  requiredMenuIds, requiredInventoryIds, recipeTupleCount: tuples.length,
  absentMenuIdsBeforePhase2A: requiredMenuIds.filter((id) => !before.includes(id)),
  absentInventoryIdsBeforePhase2A: requiredInventoryIds.filter((id) => !before.includes(id)),
  findings: [],
};
const manifestPath = process.argv[2];
if (!manifestPath) {
  result.findings.push('No authoritative approval manifest supplied.');
} else {
  try {
    const absolute = resolve(manifestPath);
    const manifest = JSON.parse(readFileSync(absolute, 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.environment !== 'historical-bootstrap') throw Error('Unsupported manifest scope.');
    if (manifest.phase2aSha256 !== result.phase2aSha256) throw Error('Phase 2A source digest differs.');
    if (manifest.approval?.approved !== true || !manifest.approval?.owner || !manifest.approval?.approvedAt || !manifest.approval?.sourceDescription) throw Error('Authoritative owner approval and source provenance are incomplete.');
    if (!Array.isArray(manifest.files) || manifest.files.length !== 3) throw Error('Expected separate category, menu and inventory baseline files.');
    if (typeof manifest.approval.categorySourceDescription !== 'string' || !manifest.approval.categorySourceDescription.trim()) throw Error('Category parent provenance and owner approval are incomplete.');
    const kinds = new Set();
    const baselines = new Map();
    for (const file of manifest.files) {
      if (!['category', 'menu', 'inventory'].includes(file.kind) || kinds.has(file.kind)) throw Error('Baseline file kinds must be unique category, menu and inventory.');
      kinds.add(file.kind);
      if (typeof file.path !== 'string' || isAbsolute(file.path) || file.path.includes('..') || file.path.includes('\\')) throw Error('Baseline path is unsafe.');
      const target = resolve(dirname(absolute), file.path);
      const parent = realpathSync(dirname(absolute));
      const actual = realpathSync(target);
      if (!actual.startsWith(parent + sep) || !statSync(actual).isFile()) throw Error('Baseline file escapes manifest directory.');
      if (sha(readFileSync(actual)) !== file.sha256) throw Error(`${file.kind} baseline SHA-256 mismatch.`);
      const data = JSON.parse(readFileSync(actual, 'utf8'));
      if (!Array.isArray(data) || data.some((row) => typeof row.id !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(row.id))) throw Error(`${file.kind} baseline must be an array of UUID-identified rows.`);
      const found = new Set(data.map((row) => row.id.toLowerCase()));
      const expected = file.kind === 'menu' ? requiredMenuIds : file.kind === 'inventory' ? requiredInventoryIds : [];
      if (expected.some((id) => !found.has(id))) throw Error(`${file.kind} baseline lacks Phase 2A identities.`);
      if (found.size !== data.length) throw Error(`${file.kind} baseline contains duplicate identities.`);
      if (data.some((row) => typeof row.name !== 'string' || !row.name.trim())) throw Error(`${file.kind} baseline needs nonempty names.`);
      if (file.kind === 'inventory' && data.some((row) => typeof row.unit !== 'string' || !row.unit.trim())) throw Error('Inventory baseline needs nonempty units.');
      if (file.kind === 'inventory' && data.filter((row) => row.name === 'Chicken' && row.unit === 'kg').length !== 1) throw Error('Expected exactly one approved Chicken/kg identity.');
      baselines.set(file.kind, data);
    }
    const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
    const menu = baselines.get('menu');
    const categoryIds = new Set(baselines.get('category').map((row) => row.id.toLowerCase()));
    if (menu.some((row) => typeof row.category_id !== 'string' || !uuid.test(row.category_id))) throw Error('Menu baseline needs valid category_id parents.');
    if (menu.some((row) => !categoryIds.has(row.category_id.toLowerCase()))) throw Error('Category baseline lacks a required menu parent.');
    if (manifest.approval.recipeTuplesSha256 !== sha(tuples.map((m) => `${m[1].toLowerCase()},${m[2].toLowerCase()},${m[3]}`).join('\n'))) throw Error('Approved recipe mapping digest differs.');
    if (!['approved-zero', 'approved-physical-record'].includes(manifest.approval.openingStockDecision)) throw Error('Opening-stock decision is missing.');
    if (!manifest.approval.openingStockEvidenceId || typeof manifest.approval.openingStockEvidenceId !== 'string') throw Error('Opening-stock decision needs an owner-reviewed evidence identifier.');
    result.status = 'REVIEW_REQUIRED';
    result.findings.push('Manifest hashes and required identities match. Human approval and SQL review remain required before bootstrap.');
  } catch (error) {
    result.findings.push(error.message);
  }
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.status !== 'REVIEW_REQUIRED') process.exitCode = 1;
