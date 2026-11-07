// Aggregate-only catalog report. No cell values, credentials, or recipes are emitted.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const qa = path.join(root, 'qa');
const evidence = JSON.parse(fs.readFileSync(path.join(qa, 'DATABASE-REDUNDANCY-EVIDENCE-20261013.json')));
const supplement = JSON.parse(fs.readFileSync(path.join(qa, 'DATABASE-REDUNDANCY-SCHEMA-SUPPLEMENT-20261013.json')));
const grants = JSON.parse(fs.readFileSync(path.join(qa, 'DATABASE-ARCHITECTURE-LIVE-GRANTS-20261013.json')));
const domains = {
  identity: ['profiles', 'riders'],
  catalog_recipe: ['menu_categories', 'menu_items', 'menu_ingredients', 'menu_modifier_groups', 'menu_modifier_options', 'menu_item_modifier_groups'],
  sales_payment: ['orders', 'order_items', 'payments', 'cashier_shifts', 'cashier_transactions', 'paid_order_cancellations'],
  inventory_ledger: ['inventory_items', 'inventory_batches', 'inventory_transactions', 'inventory_transaction_batch_allocations', 'inventory_opening_balances'],
  requisition_receiving_procurement: ['inventory_request_documents', 'inventory_request_lines', 'inventory_request_revisions', 'inventory_request_events', 'production_replenishment_requests', 'production_replenishment_status_events', 'receiving_reports', 'receiving_report_items', 'suppliers', 'supplier_items', 'purchase_orders', 'purchase_order_items'],
  fulfillment: ['order_status_history', 'kds_terminals', 'delivery_assignments'],
};
const domainOf = new Map(Object.entries(domains).flatMap(([domain, names]) => names.map(name => [name, domain])));
const conditional = new Set(['suppliers', 'supplier_items', 'purchase_orders', 'purchase_order_items', 'inventory_opening_balances', 'inventory_transaction_batch_allocations', 'paid_order_cancellations', 'production_replenishment_requests', 'production_replenishment_status_events']);
const writers = {
  profiles:'Auth profile trigger and authorized account/role workflow', riders:'Rider approval and availability RPCs',
  menu_categories:'Manager catalog configuration', menu_items:'Manager catalog configuration', menu_ingredients:'Manager recipe configuration',
  menu_modifier_groups:'Manager modifier configuration', menu_modifier_options:'Manager modifier configuration', menu_item_modifier_groups:'Manager modifier association configuration',
  orders:'customer or cashier order RPC', order_items:'customer or cashier order RPC; immutable sale snapshot', payments:'payment submission and cashier verification RPCs',
  cashier_shifts:'cashier shift RPCs', cashier_transactions:'cashier settlement/receipt RPCs', paid_order_cancellations:'authorized paid-cancellation RPC',
  inventory_items:'authorized inventory mutation RPCs; master balance projection', inventory_batches:'accepted Receiving and batch-aware stock mutation RPCs',
  inventory_transactions:'stock mutation ledger RPCs and confirmed-order deduction', inventory_transaction_batch_allocations:'confirmed-order issue and permitted reversal RPCs',
  inventory_opening_balances:'one-time authorized opening-balance RPC with physical provenance',
  inventory_request_documents:'Manager issue/revise/close request RPCs', inventory_request_lines:'Manager request document RPCs',
  inventory_request_revisions:'Manager issued revision RPC', inventory_request_events:'Manager request transition RPCs',
  production_replenishment_requests:'Production legacy create request RPC; new creation restricted by pending policy',
  production_replenishment_status_events:'Production legacy transition RPCs', receiving_reports:'authorized draft creation and post_receiving_report',
  receiving_report_items:'authorized Receiving draft editing and post_receiving_report', suppliers:'conditional Manager procurement authoring',
  supplier_items:'conditional supplier catalog authoring; no active direct source writer proven', purchase_orders:'conditional Manager procurement/PO RPCs',
  purchase_order_items:'conditional Manager procurement/PO RPCs; post_receiving_report updates received amounts',
  order_status_history:'order/payment/KDS/rider status RPCs and transition triggers', kds_terminals:'KDS terminal management/credential RPCs',
  delivery_assignments:'rider offer/accept/reject/deliver RPCs'
};
const quote = s => '"' + s.replaceAll('"', '""') + '"';
const literal = s => "'" + s.replaceAll("'", "''") + "'";
const groups = supplement.columns.map(row => ({ table: row.table_name, columns: row.columns.split(', ').map(part => {
  const p = part.indexOf(':'); return { name: part.slice(0, p), type: part.slice(p + 1) };
}) }));
if (groups.length !== 34 || groups.reduce((n, g) => n + g.columns.length, 0) !== 378) throw new Error('Catalog snapshot shape changed');

// Exact physical null and distinct counts in the isolated restored stack only.
// ::text is used solely inside COUNT(DISTINCT); source values are never returned.
const sql = groups.flatMap(({table, columns}) => columns.map(({name}) =>
  `select ${literal(table)},${literal(name)},count(*),count(*) filter (where ${quote(name)} is null),count(distinct ${quote(name)}::text) from public.${quote(table)}`
)).join('\nunion all\n') + ';\n';
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_isolated-stack', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8', maxBuffer: 4_000_000 });
if (result.status !== 0) throw new Error(`Local aggregate query failed: ${result.stderr.slice(0, 1000)}`);
const physical = new Map(result.stdout.trim().split(/\r?\n/).map(line => { const [table, column, rows, nulls, distinct] = line.split('|'); return [`${table}.${column}`, { rows: +rows, nulls: +nulls, distinct: +distinct }]; }));
if (physical.size !== 378) throw new Error(`Expected 378 physical profiles, got ${physical.size}`);
const constraintsSql = `select coalesce(json_agg(json_build_object('table',r.relname,'name',c.conname,'kind',c.contype,'definition',pg_get_constraintdef(c.oid))), '[]'::json) from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public';`;
const constraintsResult = spawnSync('docker', ['exec', 'supabase_db_isolated-stack', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', constraintsSql], { encoding:'utf8', maxBuffer:1_000_000 });
if (constraintsResult.status !== 0) throw new Error(`Local constraint catalog failed: ${constraintsResult.stderr.slice(0,1000)}`);
const constraints = JSON.parse(constraintsResult.stdout);

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
});
const sourceFiles = walk(path.join(root, 'src'));
const riderRoot = 'C:/Users/Janmari/Downloads/RRJ-Food-House-Rider/src';
if (fs.existsSync(riderRoot)) sourceFiles.push(...walk(riderRoot));
const sourceText = sourceFiles.map(file => [file.startsWith(root) ? path.relative(root, file).replaceAll('\\', '/') : 'Rider/' + path.relative(riderRoot, file).replaceAll('\\', '/'), fs.readFileSync(file, 'utf8')]);
const tableCounts = new Map(evidence.public_counts.map(x => [x.table, x.rows]));
const fkRows = evidence.foreign_keys;
const tableRecords = groups.map(({table, columns}) => {
  const domain = domainOf.get(table);
  if (!domain) throw new Error(`Unmapped table ${table}`);
  if (!writers[table]) throw new Error(`Unmapped writer ${table}`);
  const sourceConsumers = sourceText.filter(([, text]) => new RegExp(`\\b${table}\\b`).test(text)).map(([file]) => file);
  const rpc = evidence.functions_by_table.find(x => x.name === table)?.functions.split(',') ?? [];
  const indexes = evidence.indexes.filter(x => x.table_name === table).map(x => ({name:x.index_name, definition:x.definition, idx_scan_at_capture:x.idx_scan}));
  const triggers = evidence.triggers.filter(x => x.table_name === table).map(x => ({name:x.tgname, definition:x.definition}));
  const fks = fkRows.filter(x => x.child === table || x.definition.includes(`REFERENCES ${table}(`));
  const catalog = evidence.public_catalog.find(x => x.table_name === table);
  const policy = supplement.policies.filter(x => x.tablename === table || x.table_name === table);
  const grant = grants.table_grants.find(x => x.table === table);
  const classification = ['profiles','riders'].includes(table) ? 'OPTIMIZE' : 'RETAIN';
  const localAllNullColumns = columns.filter(({name}) => { const p=physical.get(`${table}.${name}`); return p.rows>0 && p.nulls===p.rows; }).map(x=>x.name);
  const qualityAnomalies = [...(tableCounts.get(table)===0 ? ['hosted_zero_rows_conditional_review'] : []), ...(localAllNullColumns.length ? [`local_all_null_columns:${localAllNullColumns.length}`] : []), ...(['profiles','riders'].includes(table) ? ['duplicate_timestamp_trigger_pair_hosted_snapshot'] : [])];
  return { table, domain, lifecycle: conditional.has(table) ? 'conditional_or_historical' : 'active',
    owner_authoritative_writer: writers[table],
    source_lexical_consumers: sourceConsumers, sql_function_lexical_consumers: rpc, primary_key: catalog?.pk ?? null,
    foreign_keys: fks, constraints_local: constraints.filter(x => x.table === table), indexes, triggers, policies: policy, grants: grant, rls_enabled: catalog?.rls,
    hosted_rows_at_20261013: tableCounts.get(table), local_rows_profiled: physical.get(`${table}.${columns[0].name}`).rows,
    quality_anomalies: qualityAnomalies,
    classification, justification: classification === 'OPTIMIZE' ? 'Remove only the duplicate timestamp trigger; retain table and all data.' : conditional.has(table) ? 'Zero/conditional workflow is not proof of redundancy; preserve contract and provenance.' : 'Operational authority, relationship, snapshot, or audit role is active.',
    safety_dependency_retention: 'No data deletion; verify external consumers, FK closure, business retention, RLS/grants and full restore before retirement.',
    columns: columns.map(({name,type}) => { const p=physical.get(`${table}.${name}`); return {name,type,local_rows:p.rows,local_null_count:p.nulls,local_distinct_nonnull_count:p.distinct,local_null_ratio:p.rows?+(p.nulls/p.rows).toFixed(6):null,local_distinct_ratio:p.rows?+(p.distinct/p.rows).toFixed(6):null,classification:'RETAIN',quality_anomaly:p.rows && p.nulls===p.rows?'all_null_in_local_restore_only':null,justification:'Preserve schema contract, history and conditional workflow until consumer and retention proof.'}; })
  };
});
const output = {generated_at:'2026-10-14 Asia/Manila', hosted_catalog_source:'2026-10-13 privacy-safe snapshot; counts reconfirmed read-only 2026-10-14', physical_profile_source:'isolated restored local database, not hosted', interpretation:'source and SQL references are lexical, not traffic telemetry; empty/all-null is not deprecation evidence', tables:tableRecords};
fs.writeFileSync(path.join(qa,'DATABASE-DISPOSITION-REGISTER-20261014.json'), JSON.stringify(output,null,2)+'\n');
const csv = rows => rows.map(row => row.map(x => '"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
fs.writeFileSync(path.join(qa,'DATABASE-DISPOSITION-TABLES-20261014.csv'),csv([['table','domain','lifecycle','owner_authoritative_writer','hosted_rows_20261013','local_rows','classification','quality_anomalies','source_lexical_consumers','sql_function_lexical_consumers','primary_key','foreign_keys','unique_constraints_local','check_constraints_local','rls_enabled','policies','grants','triggers','indexes','justification','safety_dependency_retention'],...tableRecords.map(x=>[x.table,x.domain,x.lifecycle,x.owner_authoritative_writer,x.hosted_rows_at_20261013,x.local_rows_profiled,x.classification,x.quality_anomalies.join(';'),x.source_lexical_consumers.join(';'),x.sql_function_lexical_consumers.join(';'),x.primary_key,x.foreign_keys.map(c=>c.conname).join(';'),x.constraints_local.filter(c=>c.kind==='u').map(c=>c.name).join(';'),x.constraints_local.filter(c=>c.kind==='c').map(c=>c.name).join(';'),x.rls_enabled,x.policies.map(p=>p.policyname).join(';'),JSON.stringify(x.grants),x.triggers.map(t=>t.name).join(';'),x.indexes.map(i=>i.name).join(';'),x.justification,x.safety_dependency_retention])]));
fs.writeFileSync(path.join(qa,'DATABASE-DISPOSITION-COLUMNS-20261014.csv'),csv([['table','column','type','local_rows','local_null_count','local_distinct_nonnull_count','local_null_ratio','local_distinct_ratio','classification','quality_anomaly','justification'],...tableRecords.flatMap(t=>t.columns.map(c=>[t.table,c.name,c.type,c.local_rows,c.local_null_count,c.local_distinct_nonnull_count,c.local_null_ratio,c.local_distinct_ratio,c.classification,c.quality_anomaly,c.justification]))]));
const md = [
  '# Database disposition register — 2026-10-14',
  '',
  'Scope: all 34 public application tables and 378 columns. Hosted row counts and catalog metadata come from the 2026-10-13 read-only capture; table/column counts were reconfirmed read-only on 2026-10-14. Exact null and distinct counts were calculated on the preserved isolated restored database, whose synthetic QA rows make them **local only**. No cell values, PII, recipe contents, or secret fields were exported.',
  '',
  'The [JSON](DATABASE-DISPOSITION-REGISTER-20261014.json) records each table’s domain, lifecycle, owner/writer, lexical source and SQL-function consumers, PK, full local constraint catalog (including unique/check), incoming/outgoing FKs, hosted indexes and scan counters, RLS, policies, grants, triggers, row counts, classification, justification, and safety/retention gate. The [table CSV](DATABASE-DISPOSITION-TABLES-20261014.csv) and [column CSV](DATABASE-DISPOSITION-COLUMNS-20261014.csv) are machine-readable flat views. Run `node qa/build-database-disposition-20261014.mjs` only against the preserved isolated stack to regenerate local profiles.',
  '',
  'A source match is lexical evidence, not proof of a runtime call. RPC consumers may not name their backing tables. Zero rows, all-null fields, and zero index scans are review signals, never removal proof.',
  '',
  '| Table | Domain | Hosted rows | Local rows | Source files naming table | SQL functions naming table | Decision |',
  '| --- | --- | ---: | ---: | ---: | ---: | --- |',
  ...tableRecords.map(t => `| \`${t.table}\` | ${t.domain} | ${t.hosted_rows_at_20261013} | ${t.local_rows_profiled} | ${t.source_lexical_consumers.length} | ${t.sql_function_lexical_consumers.length} | ${t.classification} |`),
  '',
  '## Column decisions',
  '',
  'All 378 columns are **RETAIN** pending column-specific consumer, data-retention, and external integration proof. The column CSV includes physical local null and distinct ratios, including conditional tables with zero rows (ratios intentionally null). All-null in this local restore is flagged as a local observation only. Cached stock and order values remain because their write protocols and historical snapshot meaning differ from source master fields. There is no evidence-backed column drop.',
  '',
  '## Immediate optimization',
  '',
  'Profiles and riders are marked **OPTIMIZE** solely for the already versioned removal of one duplicate timestamp trigger per table. No table, column, index, history row, grant, or policy is classified REMOVE. Supplier/PO, opening balance, cancellation, request event, and allocation tables remain conditional or historical contracts.',
  ''
].join('\n');
fs.writeFileSync(path.join(qa,'DATABASE-DISPOSITION-REGISTER-20261014.md'),md);
console.log(`Wrote ${tableRecords.length} table and ${physical.size} column dispositions; local aggregate profile only.`);
