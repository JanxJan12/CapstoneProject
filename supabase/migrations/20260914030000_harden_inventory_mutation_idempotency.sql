begin;

-- ============================================================
-- BACKEND HARDENING BATCH 5
-- Replay-safe manager inventory mutations.
--
-- A single manager stock mutation receives a request UUID.
-- Replaying that exact request returns the original inventory
-- transaction instead of applying the stock movement twice.
-- ============================================================

alter table public.inventory_transactions
add column if not exists mutation_request_id uuid;

create unique index if not exists
  inventory_transactions_actor_mutation_request_uidx
on public.inventory_transactions (
  performed_by,
  mutation_request_id
)
where mutation_request_id is not null;


-- ============================================================
-- STOCK RECEIVING
-- ============================================================

drop function if exists public.receive_inventory_stock(
  uuid,
  numeric,
  text
);

create function public.receive_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_actor_id uuid;

  v_before numeric;
  v_after numeric;
  v_is_active boolean;
  v_item_name text;
  v_unit text;

  v_reason text;
  v_effective_reason text;

  v_transaction_id uuid;
  v_now timestamptz;

  v_existing_transaction_id uuid;
  v_existing_inventory_item_id uuid;
  v_existing_transaction_type public.inventory_transaction_type;
  v_existing_quantity_change numeric;
  v_existing_quantity_before numeric;
  v_existing_quantity_after numeric;
  v_existing_reason text;
  v_existing_performed_by uuid;
  v_existing_created_at timestamptz;
  v_existing_item_name text;
  v_existing_unit text;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.role = 'manager'
      and p.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'Inventory request ID is required.'
      using errcode = '22023';
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
    raise exception
      'Quantity received must be a finite number greater than zero.'
      using errcode = '22023';
  end if;

  v_reason := nullif(btrim(p_reason), '');

  if v_reason is not null
     and char_length(v_reason) > 300
  then
    raise exception
      'Reason must not exceed 300 characters.'
      using errcode = '22023';
  end if;

  v_effective_reason :=
    coalesce(v_reason, 'Stock received');


  -- ------------------------------------------------------------
  -- Serialize all requests using this actor + request UUID.
  -- ------------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_actor_id::text || ':' || p_request_id::text,
      0
    )
  );


  -- ------------------------------------------------------------
  -- Replay detection
  -- ------------------------------------------------------------

  select
    t.id,
    t.inventory_item_id,
    t.transaction_type,
    t.quantity_change,
    t.quantity_before,
    t.quantity_after,
    t.reason,
    t.performed_by,
    t.created_at,
    i.item_name,
    i.unit
  into
    v_existing_transaction_id,
    v_existing_inventory_item_id,
    v_existing_transaction_type,
    v_existing_quantity_change,
    v_existing_quantity_before,
    v_existing_quantity_after,
    v_existing_reason,
    v_existing_performed_by,
    v_existing_created_at,
    v_existing_item_name,
    v_existing_unit
  from public.inventory_transactions t
  join public.inventory_items i
    on i.id = t.inventory_item_id
  where t.performed_by = v_actor_id
    and t.mutation_request_id = p_request_id
  limit 1;

  if found then
    if
      v_existing_transaction_type <>
        'receiving'::public.inventory_transaction_type
      or v_existing_inventory_item_id <>
        p_inventory_item_id
      or v_existing_quantity_change <>
        p_quantity
      or v_existing_reason is distinct from
        v_effective_reason
    then
      raise exception
        'Inventory request ID was already used for a different stock mutation.'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'transaction_id',
        v_existing_transaction_id,
      'inventory_item_id',
        v_existing_inventory_item_id,
      'item_name',
        v_existing_item_name,
      'unit',
        v_existing_unit,
      'transaction_type',
        'receiving',
      'quantity_change',
        v_existing_quantity_change,
      'quantity_before',
        v_existing_quantity_before,
      'quantity_after',
        v_existing_quantity_after,
      'reason',
        v_existing_reason,
      'performed_by',
        v_existing_performed_by,
      'created_at',
        v_existing_created_at
    );
  end if;


  -- ------------------------------------------------------------
  -- Perform stock mutation
  -- ------------------------------------------------------------

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
    raise exception
      'Inactive inventory items cannot receive stock.'
      using errcode = '22023';
  end if;

  v_after := v_before + p_quantity;
  v_now := now();

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
    mutation_request_id,
    created_at
  )
  values (
    p_inventory_item_id,
    v_actor_id,
    'receiving',
    p_quantity,
    v_before,
    v_after,
    v_effective_reason,
    p_request_id,
    v_now
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id',
      v_transaction_id,
    'inventory_item_id',
      p_inventory_item_id,
    'item_name',
      v_item_name,
    'unit',
      v_unit,
    'transaction_type',
      'receiving',
    'quantity_change',
      p_quantity,
    'quantity_before',
      v_before,
    'quantity_after',
      v_after,
    'reason',
      v_effective_reason,
    'performed_by',
      v_actor_id,
    'created_at',
      v_now
  );
end;
$function$;


revoke execute
on function public.receive_inventory_stock(
  uuid,
  numeric,
  text,
  uuid
)
from public, anon;

grant execute
on function public.receive_inventory_stock(
  uuid,
  numeric,
  text,
  uuid
)
to authenticated, service_role;


-- ============================================================
-- INVENTORY ADJUSTMENT
-- ============================================================

drop function if exists public.adjust_inventory_stock(
  uuid,
  numeric,
  text
);

create function public.adjust_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity_change numeric,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_actor_id uuid;

  v_before numeric;
  v_after numeric;
  v_is_active boolean;
  v_item_name text;
  v_unit text;
  v_reason text;

  v_transaction_id uuid;
  v_now timestamptz;

  v_existing_transaction_id uuid;
  v_existing_inventory_item_id uuid;
  v_existing_transaction_type public.inventory_transaction_type;
  v_existing_quantity_change numeric;
  v_existing_quantity_before numeric;
  v_existing_quantity_after numeric;
  v_existing_reason text;
  v_existing_performed_by uuid;
  v_existing_created_at timestamptz;
  v_existing_item_name text;
  v_existing_unit text;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.role = 'manager'
      and p.is_active = true
  ) then
    raise exception 'Active manager access required.'
      using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'Inventory request ID is required.'
      using errcode = '22023';
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
    raise exception
      'Adjustment quantity must be a finite number.'
      using errcode = '22023';
  end if;

  if p_quantity_change = 0 then
    raise exception
      'Adjustment quantity must not be zero.'
      using errcode = '22023';
  end if;

  v_reason := nullif(btrim(p_reason), '');

  if v_reason is null then
    raise exception
      'Adjustment reason is required.'
      using errcode = '22023';
  end if;

  if char_length(v_reason) > 300 then
    raise exception
      'Reason must not exceed 300 characters.'
      using errcode = '22023';
  end if;


  -- ------------------------------------------------------------
  -- Serialize actor + request UUID
  -- ------------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_actor_id::text || ':' || p_request_id::text,
      0
    )
  );


  -- ------------------------------------------------------------
  -- Replay detection
  -- ------------------------------------------------------------

  select
    t.id,
    t.inventory_item_id,
    t.transaction_type,
    t.quantity_change,
    t.quantity_before,
    t.quantity_after,
    t.reason,
    t.performed_by,
    t.created_at,
    i.item_name,
    i.unit
  into
    v_existing_transaction_id,
    v_existing_inventory_item_id,
    v_existing_transaction_type,
    v_existing_quantity_change,
    v_existing_quantity_before,
    v_existing_quantity_after,
    v_existing_reason,
    v_existing_performed_by,
    v_existing_created_at,
    v_existing_item_name,
    v_existing_unit
  from public.inventory_transactions t
  join public.inventory_items i
    on i.id = t.inventory_item_id
  where t.performed_by = v_actor_id
    and t.mutation_request_id = p_request_id
  limit 1;

  if found then
    if
      v_existing_transaction_type <>
        'adjustment'::public.inventory_transaction_type
      or v_existing_inventory_item_id <>
        p_inventory_item_id
      or v_existing_quantity_change <>
        p_quantity_change
      or v_existing_reason is distinct from
        v_reason
    then
      raise exception
        'Inventory request ID was already used for a different stock mutation.'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'transaction_id',
        v_existing_transaction_id,
      'inventory_item_id',
        v_existing_inventory_item_id,
      'item_name',
        v_existing_item_name,
      'unit',
        v_existing_unit,
      'transaction_type',
        'adjustment',
      'quantity_change',
        v_existing_quantity_change,
      'quantity_before',
        v_existing_quantity_before,
      'quantity_after',
        v_existing_quantity_after,
      'reason',
        v_existing_reason,
      'performed_by',
        v_existing_performed_by,
      'created_at',
        v_existing_created_at
    );
  end if;


  -- ------------------------------------------------------------
  -- Perform stock mutation
  -- ------------------------------------------------------------

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
    raise exception
      'Inactive inventory items cannot be adjusted.'
      using errcode = '22023';
  end if;

  v_after :=
    v_before + p_quantity_change;

  if v_after < 0 then
    raise exception
      'Adjustment would make inventory quantity negative. Current quantity: %, requested change: %.',
      v_before,
      p_quantity_change
      using errcode = '22023';
  end if;

  v_now := now();

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
    mutation_request_id,
    created_at
  )
  values (
    p_inventory_item_id,
    v_actor_id,
    'adjustment',
    p_quantity_change,
    v_before,
    v_after,
    v_reason,
    p_request_id,
    v_now
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'transaction_id',
      v_transaction_id,
    'inventory_item_id',
      p_inventory_item_id,
    'item_name',
      v_item_name,
    'unit',
      v_unit,
    'transaction_type',
      'adjustment',
    'quantity_change',
      p_quantity_change,
    'quantity_before',
      v_before,
    'quantity_after',
      v_after,
    'reason',
      v_reason,
    'performed_by',
      v_actor_id,
    'created_at',
      v_now
  );
end;
$function$;


revoke execute
on function public.adjust_inventory_stock(
  uuid,
  numeric,
  text,
  uuid
)
from public, anon;

grant execute
on function public.adjust_inventory_stock(
  uuid,
  numeric,
  text,
  uuid
)
to authenticated, service_role;

commit;