-- Read-only, data-free recovery inventory. Run against source and restored target.
-- Compare digests before declaring catalog parity; keep full definitions in the encrypted supplement.
with public_tables as (
  select count(*) as total, count(*) filter (where c.relrowsecurity) as rls_on
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
), policy_defs as (
  select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies where schemaname in ('public', 'storage')
), function_defs as (
  select p.oid, p.prosecdef, pg_get_function_identity_arguments(p.oid) args,
    p.proname, pg_get_functiondef(p.oid) definition, p.proacl::text acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
), trigger_defs as (
  select n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid) definition
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth') and not t.tgisinternal
)
select jsonb_build_object(
  'public_tables', (select total from public_tables),
  'public_rls_on', (select rls_on from public_tables),
  'policies', (select count(*) from policy_defs),
  'policy_digest', (select md5(string_agg(concat_ws('|',schemaname,tablename,policyname,cmd,roles::text,qual,with_check), E'\n' order by schemaname,tablename,policyname)) from policy_defs),
  'public_functions', (select count(*) from function_defs),
  'security_definer_functions', (select count(*) from function_defs where prosecdef),
  'function_digest', (select md5(string_agg(concat_ws('|',proname,args,definition,acl), E'\n' order by proname,args)) from function_defs),
  'triggers', (select count(*) from trigger_defs),
  'trigger_digest', (select md5(string_agg(concat_ws('|',nspname,relname,tgname,definition), E'\n' order by nspname,relname,tgname)) from trigger_defs),
  'extensions', (select jsonb_agg(extname order by extname) from pg_extension),
  'auth_user_foreign_keys', (select count(*) from pg_constraint where contype='f' and confrelid='auth.users'::regclass),
  'buckets', (select jsonb_agg(jsonb_build_object('id',b.id,'public',b.public,'objects',coalesce(o.n,0)) order by b.id)
    from storage.buckets b left join (select bucket_id,count(*) n from storage.objects group by bucket_id) o on o.bucket_id=b.id)
) as recovery_fingerprint;
