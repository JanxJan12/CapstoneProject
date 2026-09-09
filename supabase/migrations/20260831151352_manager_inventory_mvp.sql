-- RRJ'S FOOD-HOUSE
-- Manager Inventory MVP
-- Secure reads + atomic stock receiving/adjustment.

-- ============================================================
-- 1. READ MANAGER INVENTORY
-- ============================================================

create or replace function public.get_manager_inventory()
returns table (
  id uuid,
  item_name text,
  inventory_category text,
  unit text,
  quantity_on_hand numeric,
  reorder_level numeric,
  is_active boolean,
  stock_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
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

  return query
  select
    i.id,
    i.item_name::text,
    i.inventory_category::text,
    i.unit::text,
    i.quantity_on_hand,
    i.reorder_level,
    i.is_active,
    case
      when i.quantity_on_hand <= 0 then 'critical'
      when i.quantity_on_hand <= i.reorder_level then 'reorder-soon'
      else 'healthy'
    end::text as stock_status,
    i.created_at,
    i.updated_at
  from public.inventory_items i
  order by
    i.is_active desc,
    i.inventory_category nulls last,
    i.item_name;
end;
$$;


-- ============================================================
-- 2. READ INVENTORY TRANSACTION HISTORY
-- ============================================================

create or replace function public.get_manager_inventory_transactions(
  p_limit integer default 100
)
returns table (
  id uuid,
  inventory_item_id uuid,
  item_name text,
  unit text,
  transaction_type public.inventory_transaction_type,
  quantity_change numeric,
  quantity_before numeric,
  quantity_after numeric,
  reason text,
  performed_by uuid,
  performed_by_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_limit integer;
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

  v_limit := greatest(1, least(coalesce(p_limit, 100), 500));

  return query
  select
    t.id,
    t.inventory_item_id,
    i.item_name::text,
    i.unit::text,
    t.transaction_type,
    t.quantity_change,
    t.quantity_before,
    t.quantity_after,
    t.reason,
    t.performed_by,
    coalesce(
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(p.first_name), ''),
            nullif(btrim(p.last_name), '')
          )
        ),
        ''
      ),
      'System'
    )::text as performed_by_name,
    t.created_at
  from public.inventory_transactions t
  join public.inventory_items i
    on i.id = t.inventory_item_id
  left join public.profiles p
    on p.id = t.performed_by
  order by t.created_at desc, t.id desc
  limit v_limit;
end;
$$;


-- ============================================================
-- 3. RECEIVE STOCK
-- ============================================================

create or replace function public.receive_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity numeric,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity received must be greater than zero.'
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
$$;


-- ============================================================
-- 4. MANUAL STOCK ADJUSTMENT
-- ============================================================

create or replace function public.adjust_inventory_stock(
  p_inventory_item_id uuid,
  p_quantity_change numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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

  if p_quantity_change is null or p_quantity_change = 0 then
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
$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all on function public.get_manager_inventory() from public;
revoke all on function public.get_manager_inventory_transactions(integer) from public;
revoke all on function public.receive_inventory_stock(uuid, numeric, text) from public;
revoke all on function public.adjust_inventory_stock(uuid, numeric, text) from public;

grant execute on function public.get_manager_inventory()
to authenticated, service_role;

grant execute on function public.get_manager_inventory_transactions(integer)
to authenticated, service_role;

grant execute on function public.receive_inventory_stock(uuid, numeric, text)
to authenticated, service_role;

grant execute on function public.adjust_inventory_stock(uuid, numeric, text)
to authenticated, service_role;
