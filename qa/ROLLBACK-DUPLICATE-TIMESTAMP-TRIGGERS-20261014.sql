-- Review target catalog first. Run only to reverse the narrow P0 trigger migration.
-- No business row is changed by this script.
begin;
do $guard$
declare
  target text;
  retained integer;
  former integer;
begin
  foreach target in array array['profiles','riders'] loop
    select count(*) into retained
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=target
      and t.tgname=target||'_set_updated_at'
      and t.tgfoid='public.set_updated_at()'::regprocedure
      and t.tgenabled='O' and t.tgtype=19 and not t.tgisinternal;
    select count(*) into former
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=target
      and t.tgname='trg_'||target||'_set_updated_at'
      and not t.tgisinternal;
    if retained<>1 or former<>0 then
      raise exception 'Unexpected timestamp-trigger state on public.%',target;
    end if;
  end loop;
end
$guard$;
create trigger "trg_profiles_set_updated_at" before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger "trg_riders_set_updated_at" before update on public.riders
  for each row execute function public.set_updated_at();
commit;
