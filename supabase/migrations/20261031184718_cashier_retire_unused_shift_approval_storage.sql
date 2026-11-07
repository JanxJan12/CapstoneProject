-- Cashier-owned shift approval storage was never populated by the active close
-- workflow. Keep the published historical-read shape for existing clients.
begin;
lock table public.cashier_shifts in access exclusive mode;

do $guard$
begin
  if to_regclass('public.cashier_shifts') is null
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cashier_shifts' and column_name='manager_approved_by')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cashier_shifts' and column_name='manager_approved_at')
     or not exists (select 1 from pg_constraint where conrelid='public.cashier_shifts'::regclass and conname='cashier_shifts_manager_approved_by_fkey' and contype='f')
     or to_regprocedure('public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer)') is null then
    raise exception 'Cashier shift approval schema drift' using errcode='P0001';
  end if;
  if exists (select 1 from public.cashier_shifts where manager_approved_by is not null or manager_approved_at is not null) then
    raise exception 'Cashier shift approval history exists; preserve it' using errcode='P0001';
  end if;
  if not exists (
    select 1 from pg_proc p
    where p.oid='public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer)'::regprocedure
      and md5(p.prosrc)='456f549708b1ec350bf490f22703cb0b'
      and p.prosecdef=false and p.provolatile='s' and p.proconfig=array['search_path=""']::text[]
  ) then
    raise exception 'Cashier historical shift RPC drift' using errcode='P0001';
  end if;
end $guard$;

create or replace function public.get_closed_cashier_shifts(
  p_from_ended_at timestamptz default null,
  p_before_ended_at timestamptz default null,
  p_cashier_id uuid default null,
  p_cursor_ended_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns table (
  shift_id uuid, cashier_id uuid, terminal varchar(50), opening_cash numeric,
  expected_cash numeric, actual_cash numeric, variance numeric,
  variance_reason text, notes text, started_at timestamptz, ended_at timestamptz,
  closed_by uuid, manager_approved_by uuid, manager_approved_at timestamptz
)
language plpgsql stable security invoker
set search_path = ''
as $$
declare v_role public.user_role;
begin
  select p.role into v_role from public.profiles p
  where p.id = auth.uid() and p.is_active = true;
  if v_role is null or v_role not in ('cashier'::public.user_role, 'manager'::public.user_role) then
    raise exception 'Active cashier or manager access required.' using errcode = '42501';
  end if;
  if v_role = 'cashier'::public.user_role
     and p_cashier_id is not null and p_cashier_id <> auth.uid() then
    raise exception 'Cashiers may only read their own shifts.' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50
     or (p_cursor_ended_at is null) <> (p_cursor_id is null)
     or (p_from_ended_at is not null and p_before_ended_at is not null
         and p_from_ended_at >= p_before_ended_at) then
    raise exception 'Invalid historical shift page or date bounds.' using errcode = '22023';
  end if;
  return query
    select s.id, s.cashier_id, s.terminal, s.opening_cash,
      s.expected_cash, s.actual_cash, s.variance, s.variance_reason,
      s.notes, s.started_at, s.ended_at, s.closed_by,
      null::uuid, null::timestamptz
    from public.cashier_shifts s
    where s.status = 'closed'::public.cashier_shift_status
      and (v_role = 'manager'::public.user_role or s.cashier_id = auth.uid())
      and (p_cashier_id is null or s.cashier_id = p_cashier_id)
      and (p_from_ended_at is null or s.ended_at >= p_from_ended_at)
      and (p_before_ended_at is null or s.ended_at < p_before_ended_at)
      and (p_cursor_ended_at is null or (s.ended_at, s.id) < (p_cursor_ended_at, p_cursor_id))
    order by s.ended_at desc, s.id desc
    limit p_limit;
end;
$$;

alter table public.cashier_shifts
  drop column manager_approved_by,
  drop column manager_approved_at;

commit;
