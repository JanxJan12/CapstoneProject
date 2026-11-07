-- CASHIER-DB-03A. The local 20261013071937 migration already removes the
-- two trg_ triggers, but that version is absent from the hosted ledger.
-- Accept exactly either known state: both duplicates installed or both
-- already removed. All surviving objects must match the reviewed baseline.
begin;

do $guard$
declare
  profile_extra boolean;
  rider_extra boolean;
begin
  if not exists (select 1 from pg_proc
      where oid = 'public.set_updated_at()'::regprocedure
        and prorettype = 'pg_catalog.trigger'::regtype) then
    raise exception 'DB-03A: shared timestamp function missing';
  end if;

  if (select count(*) from pg_trigger t
      where t.tgrelid in ('public.profiles'::regclass, 'public.riders'::regclass)
        and t.tgname in ('profiles_set_updated_at', 'riders_set_updated_at')
        and not t.tgisinternal and t.tgenabled = 'O' and t.tgtype = 19
        and t.tgqual is null and t.tgnargs = 0 and t.tgattr::text = ''
        and t.tgfoid = 'public.set_updated_at()'::regprocedure) <> 2 then
    raise exception 'DB-03A: retained timestamp trigger drift';
  end if;

  select exists (select 1 from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'trg_profiles_set_updated_at') into profile_extra;
  select exists (select 1 from pg_trigger
      where tgrelid = 'public.riders'::regclass
        and tgname = 'trg_riders_set_updated_at') into rider_extra;
  if profile_extra <> rider_extra then
    raise exception 'DB-03A: partial prior timestamp cleanup';
  end if;
  if profile_extra and (select count(*) from pg_trigger t
      where t.tgrelid in ('public.profiles'::regclass, 'public.riders'::regclass)
        and t.tgname in ('trg_profiles_set_updated_at', 'trg_riders_set_updated_at')
        and not t.tgisinternal and t.tgenabled = 'O' and t.tgtype = 19
        and t.tgqual is null and t.tgnargs = 0 and t.tgattr::text = ''
        and t.tgfoid = 'public.set_updated_at()'::regprocedure) <> 2 then
    raise exception 'DB-03A: extra timestamp trigger drift';
  end if;

  if not exists (select 1 from pg_policy p
      where p.polrelid = 'public.profiles'::regclass
        and p.polname = 'profiles_select_own'
        and p.polcmd = 'r' and p.polpermissive
        and p.polroles = array['authenticated'::regrole::oid]
        and pg_get_expr(p.polqual, p.polrelid) in
          ('(( SELECT auth.uid() AS uid) = id)',
           '(( SELECT uid() AS uid) = id)'))
    or not exists (select 1 from pg_policy p
      where p.polrelid = 'public.profiles'::regclass
        and p.polname = 'profiles_view_own'
        and p.polcmd = 'r' and p.polpermissive
        and p.polroles = array['authenticated'::regrole::oid]
        and pg_get_expr(p.polqual, p.polrelid) in
          ('(id = ( SELECT auth.uid() AS uid))',
           '(id = ( SELECT uid() AS uid))')) then
    raise exception 'DB-03A: own-profile SELECT policy drift';
  end if;
  if not exists (select 1 from pg_policy p
      where p.polrelid = 'public.profiles'::regclass
        and p.polname = 'managers_view_profiles'
        and p.polcmd = 'r' and p.polpermissive
        and p.polroles = array['authenticated'::regrole::oid])
    or not exists (select 1 from pg_policy p
      where p.polrelid = 'public.profiles'::regclass
        and p.polname = 'profiles_update_own'
        and p.polcmd = 'w' and p.polpermissive
        and p.polroles = array['authenticated'::regrole::oid])
    or not (select relrowsecurity from pg_class
      where oid = 'public.profiles'::regclass) then
    raise exception 'DB-03A: profile protection drift';
  end if;
  if to_regprocedure('public.get_current_shift_walk_in_sales()') is null then
    raise exception 'DB-03A: retained legacy RPC missing';
  end if;
end
$guard$;

-- IF EXISTS is narrowly required because the earlier local migration may
-- already have made these exact two drops. The guard rejects all other states.
drop trigger if exists trg_profiles_set_updated_at on public.profiles;
drop trigger if exists trg_riders_set_updated_at on public.riders;
drop policy profiles_view_own on public.profiles;

commit;
