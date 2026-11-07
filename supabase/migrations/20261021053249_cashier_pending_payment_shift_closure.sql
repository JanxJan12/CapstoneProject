-- P1: the online GCash queue is shared by active Cashiers and payments have no
-- shift owner. Any unresolved online GCash submission blocks closure of an open
-- shift. Serialize transitions to pending with closure at the payment table
-- boundary, including privileged writers and rejected-proof resubmissions.
begin;

create or replace function public.lock_pending_gcash_for_shift_closure()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $trigger$
begin
  perform pg_catalog.pg_advisory_xact_lock(713904210001::bigint);
  return new;
end;
$trigger$;

revoke all on function public.lock_pending_gcash_for_shift_closure()
from public, anon, authenticated;

drop trigger if exists lock_pending_gcash_for_shift_closure on public.payments;
create trigger lock_pending_gcash_for_shift_closure
  before insert or update of status, payment_method on public.payments
  for each row
  when (
    new.status = 'pending'::public.payment_status
    and new.payment_method = 'gcash'::public.payment_method
  )
  execute function public.lock_pending_gcash_for_shift_closure();
create or replace function public.close_cashier_shift(
  p_actual_cash numeric,
  p_variance_reason text default null::text,
  p_notes text default null::text
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
  variance_reason text,
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

  v_variance_reason text;
  v_notes text;
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

  v_variance_reason :=
    nullif(
      btrim(coalesce(p_variance_reason, '')),
      ''
    );

  if v_variance <> 0
     and v_variance_reason is null
  then
    raise exception
      'A variance reason is required when actual cash does not match expected cash.';
  end if;

  if v_variance = 0 then
    v_variance_reason := null;
  end if;

  v_notes :=
    nullif(
      btrim(coalesce(p_notes, '')),
      ''
    );

  update public.cashier_shifts
  set
    actual_cash = v_actual_cash,
    expected_cash = v_expected_cash,
    variance = v_variance,
    variance_reason = v_variance_reason,
    notes = v_notes,
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
    v_shift.variance_reason,
    v_shift.status,
    v_shift.started_at,
    v_shift.ended_at;
end;
$function$;
-- CREATE OR REPLACE preserves the deployed function's EXECUTE ACL; assert it
-- explicitly so this migration also remains safe on an isolated replay.
revoke execute on function public.close_cashier_shift(numeric, text, text)
from public, anon;
grant execute on function public.close_cashier_shift(numeric, text, text)
to authenticated, service_role;

commit;
