-- Read-only, rerunnable snapshot for project zhzluhqvysvsadwuugpa.
-- This file is NOT a retirement migration. Run it only against the intended project.
-- A zero count here is necessary but does not prove that a drop is safe.

select count(*) as public_base_tables
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

select 'production_replenishment_requests' as relation, count(*) as rows from public.production_replenishment_requests
union all select 'production_replenishment_status_events', count(*) from public.production_replenishment_status_events
union all select 'suppliers', count(*) from public.suppliers
union all select 'supplier_items', count(*) from public.supplier_items
union all select 'purchase_orders', count(*) from public.purchase_orders
union all select 'purchase_order_items', count(*) from public.purchase_order_items;

select 'receiving_reports.replenishment_request_id' as reference, count(*) as populated
from public.receiving_reports where replenishment_request_id is not null
union all select 'receiving_reports.purchase_order_id', count(*)
from public.receiving_reports where purchase_order_id is not null
union all select 'receiving_report_items.purchase_order_item_id', count(*)
from public.receiving_report_items where purchase_order_item_id is not null
union all select 'inventory_transactions.purchase_order_item_id', count(*)
from public.inventory_transactions where purchase_order_item_id is not null;

with target as (
  select oid from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'
    and relname = any (array[
      'production_replenishment_requests', 'production_replenishment_status_events',
      'suppliers', 'supplier_items', 'purchase_orders', 'purchase_order_items'
    ])
)
select conrelid::regclass::text as owner, conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and confrelid in (select oid from target)
  and conrelid not in (select oid from target)
order by owner, conname;

select p.oid::regprocedure::text as signature,
       md5(pg_get_functiondef(p.oid)) as definition_md5,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer, p.provolatile as volatility,
       p.proconfig as configuration, p.proacl as acl
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and pg_get_functiondef(p.oid) ~* '(production_replenishment_requests|production_replenishment_status_events|suppliers|supplier_items|purchase_orders|purchase_order_items)'
order by signature;

select tgrelid::regclass::text as owner, tgname,
       pg_get_triggerdef(oid) as definition
from pg_trigger
where not tgisinternal
  and tgrelid in (
    'public.inventory_items'::regclass,
    'public.inventory_transactions'::regclass,
    'public.receiving_reports'::regclass,
    'public.receiving_report_items'::regclass
  )
order by owner, tgname;

select version, name from supabase_migrations.schema_migrations
order by version desc limit 20;
