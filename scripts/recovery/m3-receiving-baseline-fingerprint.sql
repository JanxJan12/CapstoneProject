-- Read-only catalog comparison for the October 12 Receiving baseline.
-- Excludes only objects introduced by the two pending M3 migrations, so the
-- query can compare hosted pre-M3 with a diagnostic post-M3 local database.
with relevant_tables as (
  select c.oid, c.relname, c.relrowsecurity, c.relacl::text as acl,
         pg_get_userbyid(c.relowner) as owner
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in (
      'receiving_reports', 'receiving_report_items', 'inventory_items',
      'inventory_batches', 'inventory_transactions',
      'inventory_request_documents', 'production_replenishment_requests',
      'purchase_orders', 'purchase_order_items'
    )
), columns as (
  select t.relname, a.attname, format_type(a.atttypid, a.atttypmod) as type,
         a.attnotnull, pg_get_expr(d.adbin, d.adrelid) as default_expr
  from relevant_tables t join pg_attribute a on a.attrelid = t.oid
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped
    and not (t.relname = 'receiving_reports' and a.attname like 'emergency_%')
), constraints as (
  select t.relname, c.conname, pg_get_constraintdef(c.oid) as definition
  from relevant_tables t join pg_constraint c on c.conrelid = t.oid
  where c.conname not in ('receiving_emergency_evidence_chk',
                          'receiving_reports_emergency_authorized_by_fkey')
), indexes as (
  select t.relname, i.indexrelid::regclass::text as name,
         pg_get_indexdef(i.indexrelid) as definition
  from relevant_tables t join pg_index i on i.indrelid = t.oid
), triggers as (
  select t.relname, g.tgname, pg_get_triggerdef(g.oid) as definition
  from relevant_tables t join pg_trigger g on g.tgrelid = t.oid
  where not g.tgisinternal and g.tgname not in (
    'receiving_production_delivery_policy', 'inventory_receiving_origin_reason'
  )
), policies as (
  select p.tablename, p.policyname, p.cmd, p.roles::text as roles,
         p.qual, p.with_check
  from pg_policies p join relevant_tables t on t.relname = p.tablename
  where p.schemaname = 'public'
)
select jsonb_build_object(
  'tables', (select count(*) from relevant_tables),
  'table_owner_rls_acl', (select md5(string_agg(
    concat_ws('|', relname, owner, relrowsecurity, acl), E'\n' order by relname))
    from relevant_tables),
  'columns', (select count(*) from columns),
  'column_digest', (select md5(string_agg(
    concat_ws('|', relname, attname, type, attnotnull, default_expr), E'\n'
    order by relname, attname)) from columns),
  'constraints', (select count(*) from constraints),
  'constraint_digest', (select md5(string_agg(
    concat_ws('|', relname, conname, definition), E'\n' order by relname, conname))
    from constraints),
  'indexes', (select count(*) from indexes),
  'index_digest', (select md5(string_agg(
    concat_ws('|', relname, name, definition), E'\n' order by relname, name))
    from indexes),
  'triggers', (select count(*) from triggers),
  'trigger_digest', (select md5(string_agg(
    concat_ws('|', relname, tgname, definition), E'\n' order by relname, tgname))
    from triggers),
  'policies', (select count(*) from policies),
  'policy_digest', (select md5(string_agg(
    concat_ws('|', tablename, policyname, cmd, roles, qual, with_check), E'\n'
    order by tablename, policyname)) from policies)
) as m3_baseline_fingerprint;
