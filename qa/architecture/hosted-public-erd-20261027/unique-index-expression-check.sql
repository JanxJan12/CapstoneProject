-- Read-only follow-up used to distinguish expression/partial unique indexes
-- before inferring one-to-one FK cardinality.
select
  rel.relname as table_name,
  idx.relname as index_name,
  i.indexprs is not null as has_expression,
  i.indpred is not null as is_partial,
  i.indisvalid as is_valid,
  pg_get_indexdef(i.indexrelid) as definition
from pg_index i
join pg_class rel on rel.oid = i.indrelid
join pg_namespace n on n.oid = rel.relnamespace
join pg_class idx on idx.oid = i.indexrelid
where n.nspname = 'public'
  and i.indisunique
  and (i.indexprs is not null or i.indpred is not null or not i.indisvalid)
order by rel.relname, idx.relname;
