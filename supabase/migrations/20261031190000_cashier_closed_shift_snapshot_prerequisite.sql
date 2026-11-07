-- The hosted baseline has the historical shift reader but not the H-08C
-- closed-snapshot trigger. Install that protection before retiring the
-- explanation columns; the following migration updates its protected shape.
begin;

do $guard$
begin
  if to_regclass('public.cashier_shifts') is null
     or to_regprocedure('public.protect_closed_cashier_shift_snapshot()') is not null
     or exists (select 1 from pg_trigger
                where tgrelid = 'public.cashier_shifts'::regclass
                  and tgname = 'protect_closed_cashier_shift_snapshot') then
    raise exception 'Closed cashier shift snapshot prerequisite drift' using errcode = 'P0001';
  end if;
end $guard$;

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
commit;
