begin;

-- ============================================================
-- BACKEND HARDENING BATCH 2
-- Reject PostgreSQL non-finite numeric values at authoritative
-- inventory and cashier-shift boundaries.
--
-- Existing business logic, authorization, locking and audit
-- behavior are otherwise preserved.
-- ============================================================


-- ============================================================
-- 1. ADJUST INVENTORY STOCK
-- ============================================================

create or replace function public.adjust_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity_change numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_before numeric;
  v_after numeric;
  v_is_active boolean;
  v_item_name text;
  v_unit text;
  v_reason text;
  v_transaction_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
      and p.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_inventory_item_id is null then
    raise exception 'Inventory item is required.'
      using errcode = '22023';
  end if;

  if p_quantity_change is null
     or p_quantity_change = 'NaN'::numeric
     or p_quantity_change = 'Infinity'::numeric
     or p_quantity_change = '-Infinity'::numeric
  then
    raise exception 'Adjustment quantity must be a finite number.'
      using errcode = '22023';
  end if;

  if p_quantity_change = 0 then
    raise exception 'Adjustment quantity must not be zero.'
      using errcode = '22023';
  end if;

  v_reason := nullif(btrim(p_reason), '');

  if v_reason is null then
    raise exception 'Adjustment reason is required.'
      using errcode = '22023';
  end if;

  if char_length(v_reason) > 300 then
    raise exception 'Reason must not exceed 300 characters.'
      using errcode = '22023';
  end if;

  select
    i.quantity_on_hand,
    i.is_active,
    i.item_name,
    i.unit
  into
    v_before,
    v_is_active,
    v_item_name,
    v_unit
  from public.inventory_items i
  where i.id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found.'
      using errcode = 'P0002';
  end if;

  if not v_is_active then
    raise exception 'Inactive inventory items cannot be adjusted.'
      using errcode = '22023';
  end if;

  v_after := v_before + p_quantity_change;

  if v_after < 0 then
    raise exception
      'Adjustment would make inventory quantity negative. Current quantity: %, requested change: %.',
      v_before,
      p_quantity_change
      using errcode = '22023';
  end if;

  update public.inventory_items
  set
    quantity_on_hand = v_after,
    updated_at = v_now
  where id = p_inventory_item_id;

  insert into public.inventory_transactions (
    inventory_item_id,
    performed_by,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    reason,
    created_at
  )
  values (
    p_inventory_item_id,
    auth.uid(),
    'adjustment',
    p_quantity_change,
    v_before,
    v_after,
    v_reason,
    v_now
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'inventory_item_id', p_inventory_item_id,
    'item_name', v_item_name,
    'unit', v_unit,
    'transaction_type', 'adjustment',
    'quantity_change', p_quantity_change,
    'quantity_before', v_before,
    'quantity_after', v_after,
    'reason', v_reason,
    'performed_by', auth.uid(),
    'created_at', v_now
  );
end;
$function$;


-- ============================================================
-- 2. RECEIVE INVENTORY STOCK
-- ============================================================

create or replace function public.receive_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_reason text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_before numeric;
  v_after numeric;
  v_is_active boolean;
  v_item_name text;
  v_unit text;
  v_reason text;
  v_transaction_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
      and p.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_inventory_item_id is null then
    raise exception 'Inventory item is required.'
      using errcode = '22023';
  end if;

  if p_quantity is null
     or p_quantity = 'NaN'::numeric
     or p_quantity = 'Infinity'::numeric
     or p_quantity = '-Infinity'::numeric
     or p_quantity <= 0
  then
    raise exception 'Quantity received must be a finite number greater than zero.'
      using errcode = '22023';
  end if;

  v_reason := nullif(btrim(p_reason), '');

  if v_reason is not null and char_length(v_reason) > 300 then
    raise exception 'Reason must not exceed 300 characters.'
      using errcode = '22023';
  end if;

  select
    i.quantity_on_hand,
    i.is_active,
    i.item_name,
    i.unit
  into
    v_before,
    v_is_active,
    v_item_name,
    v_unit
  from public.inventory_items i
  where i.id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found.'
      using errcode = 'P0002';
  end if;

  if not v_is_active then
    raise exception 'Inactive inventory items cannot receive stock.'
      using errcode = '22023';
  end if;

  v_after := v_before + p_quantity;

  update public.inventory_items
  set
    quantity_on_hand = v_after,
    updated_at = v_now
  where id = p_inventory_item_id;

  insert into public.inventory_transactions (
    inventory_item_id,
    performed_by,
    transaction_type,
    quantity_change,
    quantity_before,
    quantity_after,
    reason,
    created_at
  )
  values (
    p_inventory_item_id,
    auth.uid(),
    'receiving',
    p_quantity,
    v_before,
    v_after,
    coalesce(v_reason, 'Stock received'),
    v_now
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'inventory_item_id', p_inventory_item_id,
    'item_name', v_item_name,
    'unit', v_unit,
    'transaction_type', 'receiving',
    'quantity_change', p_quantity,
    'quantity_before', v_before,
    'quantity_after', v_after,
    'reason', coalesce(v_reason, 'Stock received'),
    'performed_by', auth.uid(),
    'created_at', v_now
  );
end;
$function$;


-- ============================================================
-- 3. START CASHIER SHIFT
-- ============================================================

create or replace function public.start_cashier_shift(
  p_terminal text,
  p_opening_cash numeric
)
returns table(
  shift_id uuid,
  cashier_id uuid,
  terminal character varying,
  opening_cash numeric,
  status cashier_shift_status,
  started_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cashier_id uuid;
  v_terminal text;
  v_shift public.cashier_shifts%rowtype;
begin
  v_cashier_id := auth.uid();

  if v_cashier_id is null then
    raise exception
      'Authentication is required to start a cashier shift.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_cashier_id
      and p.is_active = true
      and p.role = 'cashier'::public.user_role
  ) then
    raise exception
      'Only an active cashier account may start a cashier shift.';
  end if;

  v_terminal :=
    nullif(
      btrim(coalesce(p_terminal, '')),
      ''
    );

  if v_terminal is null then
    raise exception
      'Terminal is required.';
  end if;

  if char_length(v_terminal) > 50 then
    raise exception
      'Terminal cannot exceed 50 characters.';
  end if;

  if p_opening_cash is null then
    raise exception
      'Opening cash is required.';
  end if;

  if p_opening_cash = 'NaN'::numeric
     or p_opening_cash = 'Infinity'::numeric
     or p_opening_cash = '-Infinity'::numeric
  then
    raise exception
      'Opening cash must be a finite amount.';
  end if;

  if p_opening_cash < 0 then
    raise exception
      'Opening cash cannot be negative.';
  end if;

  if exists (
    select 1
    from public.cashier_shifts s
    where s.cashier_id = v_cashier_id
      and s.status =
        'open'::public.cashier_shift_status
  ) then
    raise exception
      'You already have an open cashier shift.';
  end if;

  if exists (
    select 1
    from public.cashier_shifts s
    where lower(s.terminal) =
          lower(v_terminal)
      and s.status =
        'open'::public.cashier_shift_status
  ) then
    raise exception
      'This terminal already has an open cashier shift.';
  end if;

  insert into public.cashier_shifts (
    cashier_id,
    terminal,
    opening_cash
  )
  values (
    v_cashier_id,
    v_terminal,
    p_opening_cash
  )
  returning *
  into v_shift;

  return query
  select
    v_shift.id,
    v_shift.cashier_id,
    v_shift.terminal,
    v_shift.opening_cash,
    v_shift.status,
    v_shift.started_at;

exception
  when unique_violation then
    raise exception
      'The cashier or terminal already has an open shift.';
end;
$function$;


-- ============================================================
-- 4. CLOSE CASHIER SHIFT
-- ============================================================

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


-- ============================================================
-- Reassert intended application ACLs.
-- None of these RPCs should be anonymously executable.
-- ============================================================

revoke execute
on function public.adjust_inventory_stock(uuid, numeric, text)
from public, anon;

grant execute
on function public.adjust_inventory_stock(uuid, numeric, text)
to authenticated, service_role;


revoke execute
on function public.receive_inventory_stock(uuid, numeric, text)
from public, anon;

grant execute
on function public.receive_inventory_stock(uuid, numeric, text)
to authenticated, service_role;


revoke execute
on function public.start_cashier_shift(text, numeric)
from public, anon;

grant execute
on function public.start_cashier_shift(text, numeric)
to authenticated, service_role;


revoke execute
on function public.close_cashier_shift(numeric, text, text)
from public, anon;

grant execute
on function public.close_cashier_shift(numeric, text, text)
to authenticated, service_role;

commit;