-- Keep the original timestamp trigger on each table. Both extra trg_ triggers
-- have the same timing, event, row scope, and function in the restored schema.
begin;

do $check$
declare
  target text;
  trigger_count integer;
  distinct_functions integer;
  invalid_count integer;
begin
  foreach target in array array['profiles', 'riders'] loop
    select count(*), count(distinct t.tgfoid),
           count(*) filter (where t.tgenabled <> 'O'
             or t.tgtype <> 19 -- ROW (1) + BEFORE (2) + UPDATE (16)
             or t.tgqual is not null
             or t.tgnargs <> 0
             or t.tgattr::text <> '')
      into trigger_count, distinct_functions, invalid_count
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = target
      and t.tgname in (target || '_set_updated_at', 'trg_' || target || '_set_updated_at')
      and not t.tgisinternal;

    if trigger_count <> 2 or distinct_functions <> 1 or invalid_count <> 0
       or not exists (
         select 1 from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = target
           and t.tgname = target || '_set_updated_at'
           and t.tgfoid = 'public.set_updated_at()'::regprocedure
       ) then
      raise exception 'Unexpected public.% timestamp trigger definition', target;
    end if;
  end loop;
end
$check$;

drop trigger "trg_profiles_set_updated_at" on public.profiles;
drop trigger "trg_riders_set_updated_at" on public.riders;

commit;
