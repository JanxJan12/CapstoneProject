// Read-only gate for historical data dependencies in a fresh migration replay.
// It never connects to a database or prints recipe quantities or business data.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const names = readdirSync(migrationsDir).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
const phase = '20260904000000_inventory_phase_2a_recipe_deduction.sql';
const phaseIndex = names.indexOf(phase);
if (phaseIndex < 0) throw new Error('Phase 2A migration is missing');

const before = names.slice(0, phaseIndex).map((name) => readFileSync(join(migrationsDir, name), 'utf8')).join('\n');
const phaseSql = readFileSync(join(migrationsDir, phase), 'utf8');
const recipeInsert = phaseSql.split('on conflict (menu_item_id, inventory_item_id)')[0];
const tuples = [...recipeInsert.matchAll(/\(\s*'([\da-f-]{36})'::uuid\s*,\s*'([\da-f-]{36})'::uuid\s*,\s*[\d.]+\s*\)/gi)];
if (tuples.length !== 18) throw new Error('Phase 2A recipe shape changed; review gate parser');

const menuIds = [...new Set(tuples.map((match) => match[1].toLowerCase()))];
const inventoryIds = [...new Set(tuples.map((match) => match[2].toLowerCase()))];
const missingMenu = menuIds.filter((id) => !before.toLowerCase().includes(id));
const missingInventory = inventoryIds.filter((id) => !before.toLowerCase().includes(id));
const enumSql = readFileSync(join(migrationsDir, '20260914000000_harden_numeric_inputs.sql'), 'utf8');
const unqualifiedEnumFields = [...enumSql.matchAll(/\bstatus\s+cashier_shift_status\s*,/gi)].length;
const result = {
  migrationFiles: names.length,
  precedingPhase2A: phaseIndex,
  recipeReferences: tuples.length,
  requiredMenuIds: menuIds.length,
  requiredInventoryIds: inventoryIds.length,
  absentMenuIdsBeforePhase2A: missingMenu.length,
  absentInventoryIdsBeforePhase2A: missingInventory.length,
  defaultSeedExists: existsSync(join(root, 'supabase', 'seed.sql')),
  laterUnqualifiedEnumFields: unqualifiedEnumFields,
  cleanReplayPrerequisites: missingMenu.length || missingInventory.length || unqualifiedEnumFields ? 'BLOCKED' : 'REVIEW_REQUIRED',
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.cleanReplayPrerequisites === 'BLOCKED') process.exitCode = 1;
