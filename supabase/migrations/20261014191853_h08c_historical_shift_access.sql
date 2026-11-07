-- H-08C: current-profile authorization for both RPC and direct table reads.
-- This migration is local-only until separately approved for hosted deployment.
drop policy if exists cashier_shifts_select_staff on public.cashier_shifts;
create policy cashier_shifts_select_staff on public.cashier_shifts
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true
        and (
          (p.role = 'cashier'::public.user_role and cashier_shifts.cashier_id = p.id)
          or p.role = 'manager'::public.user_role
        )
    )
  );

-- Existing clients use the privileged start/close/open RPCs, not direct writes.
revoke all on public.cashier_shifts from public, anon, authenticated;
grant select (id, cashier_id, terminal, opening_cash, status, started_at,
  ended_at, actual_cash, expected_cash, variance, variance_reason, notes,
  closed_by, manager_approved_by, manager_approved_at)
  on public.cashier_shifts to authenticated;

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
      s.manager_approved_by, s.manager_approved_at
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
revoke all on function public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer) to authenticated;

-- Once closed, closure facts cannot be restated or removed by another RPC.
create function public.protect_closed_cashier_shift_snapshot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'closed'::public.cashier_shift_status then
      raise exception 'Closed cashier shift snapshots cannot be deleted.' using errcode = '23514';
    end if;
    return old;
  end if;
  if old.status = 'closed'::public.cashier_shift_status
     and (new.id, new.cashier_id, new.terminal, new.opening_cash, new.status,
          new.started_at, new.ended_at, new.actual_cash, new.expected_cash,
          new.variance, new.variance_reason, new.notes, new.closed_by)
       is distinct from
         (old.id, old.cashier_id, old.terminal, old.opening_cash, old.status,
          old.started_at, old.ended_at, old.actual_cash, old.expected_cash,
          old.variance, old.variance_reason, old.notes, old.closed_by) then
    raise exception 'Closed cashier shift snapshots cannot be changed.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_closed_cashier_shift_snapshot() from public, anon, authenticated;
create trigger protect_closed_cashier_shift_snapshot
  before update or delete on public.cashier_shifts
  for each row execute function public.protect_closed_cashier_shift_snapshot();
