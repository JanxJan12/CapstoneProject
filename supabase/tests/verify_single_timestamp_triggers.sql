-- Isolated restored local database only. No row change survives this transaction.
begin;
savepoint simulated_before;
-- Recreate the exact former triggers inside a savepoint to compare behavior.
create trigger "trg_profiles_set_updated_at" before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger "trg_riders_set_updated_at" before update on public.riders
  for each row execute function public.set_updated_at();
do $before$
declare
  target text;
  row_id uuid;
  stamped timestamptz;
  trigger_count integer;
begin
  foreach target in array array['profiles', 'riders'] loop
    select count(*) into trigger_count from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = target
      and not t.tgisinternal and t.tgtype = 19;
    if trigger_count <> 2 then raise exception 'Expected before pair on %', target; end if;
    execute format('select id from public.%I order by id limit 1', target) into row_id;
    execute format('update public.%I set updated_at = %L where id = $1 returning updated_at', target,
                   '2000-01-01T00:00:00Z') using row_id into stamped;
    if stamped is distinct from transaction_timestamp() then
      raise exception 'Before pair failed to stamp %', target;
    end if;
  end loop;
  raise notice 'PASS: recreated before pairs stamp profiles/riders';
end
$before$;
rollback to savepoint simulated_before;
do $verify$
declare
  target text;
  row_id uuid;
  stamped timestamptz;
  trigger_count integer;
begin
  foreach target in array array['profiles', 'riders'] loop
    select count(*) into trigger_count
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = target
      and t.tgname = target || '_set_updated_at'
      and t.tgfoid = 'public.set_updated_at()'::regprocedure
      and t.tgenabled = 'O';
    if trigger_count <> 1 then
      raise exception 'Missing retained timestamp trigger on %', target;
    end if;
    select count(*) into trigger_count
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = target
      and not t.tgisinternal and t.tgtype = 19;
    if trigger_count <> 1 then
      raise exception 'Expected exactly one UPDATE timestamp trigger on %', target;
    end if;

    execute format('select id from public.%I order by id limit 1', target) into row_id;
    if row_id is null then raise exception 'No local synthetic/restore row in %', target; end if;
    execute format('update public.%I set updated_at = %L where id = $1 returning updated_at', target,
                   '2000-01-01T00:00:00Z') using row_id into stamped;
    if stamped is distinct from transaction_timestamp() then
      raise exception '% updated_at was not set by retained trigger', target;
    end if;
  end loop;
  raise notice 'PASS: one retained trigger per table and timestamp updates for profiles/riders';
end
$verify$;
rollback;
