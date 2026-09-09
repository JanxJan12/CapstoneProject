create or replace function public.get_open_cashier_shift()
returns table (
  shift_id uuid,
  cashier_id uuid,
  terminal varchar,
  opening_cash numeric,
  status public.cashier_shift_status,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cashier_id uuid;
begin
  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to recover a cashier shift.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may recover a cashier shift.'
      using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.cashier_id,
    s.terminal,
    s.opening_cash,
    s.status,
    s.started_at
  from public.cashier_shifts s
  where s.cashier_id = v_cashier_id
    and s.status = 'open'::public.cashier_shift_status;
end;
$$;

revoke all
on function public.get_open_cashier_shift()
from public;

grant execute
on function public.get_open_cashier_shift()
to authenticated;

grant execute
on function public.get_open_cashier_shift()
to service_role;
