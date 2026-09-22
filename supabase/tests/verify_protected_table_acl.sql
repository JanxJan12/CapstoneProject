-- Run after the ACL migration in a trusted SQL session. The block is read-only:
-- it raises an exception on the first failed security contract and writes no data.
-- scripts/verify-protected-table-acl.mjs separately asserts that the migration
-- contains no function/procedure/EXECUTE ACL statement, so RPC ACLs are unchanged.

do $verification$
declare
  v_failures text[];
begin
  with protected_tables(table_name) as (
    values
      ('delivery_assignments'),
      ('inventory_items'),
      ('inventory_transactions'),
      ('menu_categories'),
      ('menu_ingredients'),
      ('menu_items'),
      ('order_items'),
      ('order_status_history'),
      ('orders'),
      ('payments'),
      ('profiles'),
      ('purchase_order_items'),
      ('purchase_orders'),
      ('supplier_items'),
      ('suppliers')
  ),
  application_roles(role_name) as (
    values ('anon'), ('authenticated')
  ),
  forbidden_privileges(privilege_name) as (
    values ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')
  )
  select array_agg(
    format('%I has %s on public.%I', role_name, privilege_name, table_name)
    order by role_name, table_name, privilege_name
  )
  into v_failures
  from protected_tables
  cross join application_roles
  cross join forbidden_privileges
  where has_table_privilege(
    role_name,
    format('public.%I', table_name),
    privilege_name
  );

  if cardinality(coalesce(v_failures, array[]::text[])) > 0 then
    raise exception 'Forbidden protected-table privileges remain: %',
      array_to_string(v_failures, '; ');
  end if;

  with protected_tables(table_name) as (
    values
      ('delivery_assignments'),
      ('inventory_items'),
      ('inventory_transactions'),
      ('menu_categories'),
      ('menu_ingredients'),
      ('menu_items'),
      ('order_items'),
      ('order_status_history'),
      ('orders'),
      ('payments'),
      ('profiles'),
      ('purchase_order_items'),
      ('purchase_orders'),
      ('supplier_items'),
      ('suppliers')
  ),
  application_roles(role_name) as (
    values ('anon'), ('authenticated')
  ),
  forbidden_dml(privilege_name) as (
    values ('INSERT'), ('UPDATE'), ('DELETE')
  )
  select array_agg(
    format('%I has table-level %s on public.%I', role_name, privilege_name, table_name)
    order by role_name, table_name, privilege_name
  )
  into v_failures
  from protected_tables
  cross join application_roles
  cross join forbidden_dml
  where has_table_privilege(
    role_name,
    format('public.%I', table_name),
    privilege_name
  );

  if cardinality(coalesce(v_failures, array[]::text[])) > 0 then
    raise exception 'Direct table-level DML remains: %',
      array_to_string(v_failures, '; ');
  end if;

  select array_agg(
    format('%I has future-table default %s', grantee.rolname, acl.privilege_type)
    order by grantee.rolname, acl.privilege_type
  )
  into v_failures
  from pg_default_acl default_acl
  join pg_roles owner
    on owner.oid = default_acl.defaclrole
  join pg_namespace namespace
    on namespace.oid = default_acl.defaclnamespace
  cross join lateral aclexplode(default_acl.defaclacl) acl
  join pg_roles grantee
    on grantee.oid = acl.grantee
  where owner.rolname = 'postgres'
    and namespace.nspname = 'public'
    and default_acl.defaclobjtype = 'r'
    and grantee.rolname in ('anon', 'authenticated');

  if cardinality(coalesce(v_failures, array[]::text[])) > 0 then
    raise exception 'Unsafe future-table default privilege remains: %',
      array_to_string(v_failures, '; ');
  end if;

  select array_agg(
    format(
      '%I has column-level %s on public.%I.%I',
      grantee,
      privilege_type,
      table_name,
      column_name
    )
    order by grantee, table_name, column_name, privilege_type
  )
  into v_failures
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name in (
      'delivery_assignments',
      'inventory_items',
      'inventory_transactions',
      'menu_categories',
      'menu_ingredients',
      'menu_items',
      'order_items',
      'order_status_history',
      'orders',
      'payments',
      'profiles',
      'purchase_order_items',
      'purchase_orders',
      'supplier_items',
      'suppliers'
    )
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE', 'REFERENCES')
    and not (
      grantee = 'authenticated'
      and table_name = 'profiles'
      and column_name = 'contact_number'
      and privilege_type = 'UPDATE'
    );

  if cardinality(coalesce(v_failures, array[]::text[])) > 0 then
    raise exception 'Unexpected column-level mutation privilege remains: %',
      array_to_string(v_failures, '; ');
  end if;

  with required_select(role_name, table_name) as (
    values
      ('anon', 'menu_categories'),
      ('anon', 'menu_items'),
      ('authenticated', 'delivery_assignments'),
      ('authenticated', 'menu_categories'),
      ('authenticated', 'menu_items'),
      ('authenticated', 'order_items'),
      ('authenticated', 'order_status_history'),
      ('authenticated', 'orders'),
      ('authenticated', 'profiles')
  )
  select array_agg(
    format('%I lacks SELECT on public.%I', role_name, table_name)
    order by role_name, table_name
  )
  into v_failures
  from required_select
  where not has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'SELECT'
  );

  if cardinality(coalesce(v_failures, array[]::text[])) > 0 then
    raise exception 'Required direct-read privilege is missing: %',
      array_to_string(v_failures, '; ');
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.profiles',
    'contact_number',
    'UPDATE'
  ) then
    raise exception 'Required authenticated UPDATE(contact_number) privilege is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'UPDATE'
      and roles @> array['authenticated']::name[]
  ) then
    raise exception 'Required authenticated profiles UPDATE RLS policy is missing';
  end if;

  with protected_tables(table_name) as (
    values
      ('delivery_assignments'),
      ('inventory_items'),
      ('inventory_transactions'),
      ('menu_categories'),
      ('menu_ingredients'),
      ('menu_items'),
      ('order_items'),
      ('order_status_history'),
      ('orders'),
      ('payments'),
      ('profiles'),
      ('purchase_order_items'),
      ('purchase_orders'),
      ('supplier_items'),
      ('suppliers')
  )
  select array_agg(format('public.%I', table_name) order by table_name)
  into v_failures
  from protected_tables
  left join pg_namespace namespace
    on namespace.nspname = 'public'
  left join pg_class relation
    on relation.relnamespace = namespace.oid
    and relation.relname = protected_tables.table_name
    and relation.relkind in ('r', 'p')
  where relation.oid is null
    or not relation.relrowsecurity;

  if cardinality(coalesce(v_failures, array[]::text[])) > 0 then
    raise exception 'Protected table is missing or does not have RLS enabled: %',
      array_to_string(v_failures, '; ');
  end if;

  raise notice 'Protected table ACL, required SELECT/direct-write, and RLS checks passed';
end
$verification$;
