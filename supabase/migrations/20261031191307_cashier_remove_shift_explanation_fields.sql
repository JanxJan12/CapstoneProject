-- Remove only the two retired Cashier shift explanation fields. No CASCADE.
begin;
lock table public.cashier_shifts in access exclusive mode;
do $guard$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cashier_shifts' and column_name='notes')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='cashier_shifts' and column_name='variance_reason')
     or to_regprocedure('public.close_cashier_shift(numeric,text,text)') is null
     or to_regprocedure('public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer)') is null
     or to_regprocedure('public.protect_closed_cashier_shift_snapshot()') is null
     or not exists (select 1 from pg_trigger where tgrelid='public.cashier_shifts'::regclass and tgname='protect_closed_cashier_shift_snapshot' and not tgisinternal) then
    raise exception 'Cashier shift explanation schema drift' using errcode='P0001';
  end if;
end $guard$;

drop function public.close_cashier_shift(numeric, text, text);
create or replace function public.close_cashier_shift(
  p_actual_cash numeric
)
returns table(
  shift_id uuid,
  cashier_id uuid,
  terminal character varying,
  opening_cash numeric,
  cash_sales numeric,
  gcash_sales numeric,
  transaction_count bigint,
  expected_cash numeric,
  actual_cash numeric,
  variance numeric,
  status cashier_shift_status,
  started_at timestamp with time zone,
  ended_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cashier_id uuid;
  v_shift public.cashier_shifts%rowtype;

  v_cash_sales numeric(12,2) := 0;
  v_gcash_sales numeric(12,2) := 0;
  v_transaction_count bigint := 0;

  v_expected_cash numeric(12,2);
  v_actual_cash numeric(12,2);
  v_variance numeric(12,2);

begin
  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to close a cashier shift.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may close a cashier shift.';
  end if;

  select s.*
  into v_shift
  from public.cashier_shifts s
  where s.cashier_id = v_cashier_id
    and s.status = 'open'::public.cashier_shift_status
  for update;

  if not found then
    raise exception
      'You do not have an open cashier shift.';
  end if;

  if p_actual_cash is null then
    raise exception
      'Actual cash is required.';
  end if;

  if p_actual_cash = 'NaN'::numeric
     or p_actual_cash = 'Infinity'::numeric
     or p_actual_cash = '-Infinity'::numeric
  then
    raise exception
      'Actual cash must be a finite amount.';
  end if;

  if p_actual_cash < 0 then
    raise exception
      'Actual cash cannot be negative.';
  end if;

  -- A fixed transaction snapshot could miss a payment committed while the
  -- advisory lock was awaited. PostgREST uses READ COMMITTED.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception
      'Cashier shift closure requires READ COMMITTED isolation.'
      using errcode = '25000';
  end if;

  -- Serialize closure with every pending GCash insertion/resubmission.
  -- The payment trigger takes this transaction lock before the row can
  -- become pending. The next statement gets a fresh READ COMMITTED snapshot.
  perform pg_catalog.pg_advisory_xact_lock(713904210001::bigint);

  if exists (
    select 1
    from public.payments p
    join public.orders o on o.id = p.order_id
    where o.order_channel = 'online'::public.order_channel
      and p.payment_method = 'gcash'::public.payment_method
      and p.status = 'pending'::public.payment_status
  ) then
    raise exception
      'Resolve pending online GCash payments before closing the cashier shift.'
      using errcode = 'P0001';
  end if;

  v_actual_cash := round(p_actual_cash, 2);

  select
    coalesce(
      sum(
        case
          when p.payment_method = 'cash'::public.payment_method
            then p.amount
          else 0
        end
      ),
      0
    ),

    coalesce(
      sum(
        case
          when p.payment_method = 'gcash'::public.payment_method
            then p.amount
          else 0
        end
      ),
      0
    ),

    count(*)
  into
    v_cash_sales,
    v_gcash_sales,
    v_transaction_count
  from public.cashier_transactions t
  join public.payments p
    on p.id = t.payment_id
  where t.shift_id = v_shift.id
    and t.status =
      'completed'::public.cashier_transaction_status
    and p.status =
      'verified'::public.payment_status;

  v_cash_sales := round(v_cash_sales, 2);
  v_gcash_sales := round(v_gcash_sales, 2);

  v_expected_cash :=
    round(
      v_shift.opening_cash + v_cash_sales,
      2
    );

  v_variance :=
    round(
      v_actual_cash - v_expected_cash,
      2
    );

  update public.cashier_shifts
  set
    actual_cash = v_actual_cash,
    expected_cash = v_expected_cash,
    variance = v_variance,
    closed_by = v_cashier_id,
    ended_at = now(),
    status = 'closed'::public.cashier_shift_status
  where id = v_shift.id
  returning *
  into v_shift;

  return query
  select
    v_shift.id,
    v_shift.cashier_id,
    v_shift.terminal,
    v_shift.opening_cash,
    v_cash_sales,
    v_gcash_sales,
    v_transaction_count,
    v_shift.expected_cash,
    v_shift.actual_cash,
    v_shift.variance,
    v_shift.status,
    v_shift.started_at,
    v_shift.ended_at;
end;
$function$;

revoke all on function public.close_cashier_shift(numeric) from public, anon;
grant execute on function public.close_cashier_shift(numeric) to authenticated, service_role;

drop function public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer);
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
  started_at timestamptz, ended_at timestamptz,
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
      s.expected_cash, s.actual_cash, s.variance, s.started_at, s.ended_at, s.closed_by,
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


revoke all on function public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.get_closed_cashier_shifts(timestamptz,timestamptz,uuid,timestamptz,uuid,integer) to authenticated;

create or replace function public.protect_closed_cashier_shift_snapshot()
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
          new.variance, new.closed_by)
       is distinct from
         (old.id, old.cashier_id, old.terminal, old.opening_cash, old.status,
          old.started_at, old.ended_at, old.actual_cash, old.expected_cash,
          old.variance, old.closed_by) then
    raise exception 'Closed cashier shift snapshots cannot be changed.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_closed_cashier_shift_snapshot() from public, anon, authenticated;

alter table public.cashier_shifts drop column variance_reason, drop column notes;
commit;
