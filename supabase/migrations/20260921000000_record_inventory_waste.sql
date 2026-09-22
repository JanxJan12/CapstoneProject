begin;

-- ============================================================
-- BATCH 2: AUTHORITATIVE AGGREGATE WASTE / SPOILAGE
--
-- This migration creates only the Manager waste mutation RPC.
-- It reuses the existing aggregate inventory balance, ledger,
-- and actor-scoped mutation request ID infrastructure.
-- ============================================================

create or replace function public.record_inventory_waste(
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
      'Waste quantity must be a finite number greater than zero.'
      using errcode = '22023';
  end if;

  if p_quantity <> trunc(p_quantity, 3) then
    raise exception
      'Waste quantity must not use more than three decimal places.'
      using errcode = '22023';
  end if;

  v_reason := nullif(btrim(p_reason), '');

  if v_reason is null then
    raise exception 'Waste/spoilage reason is required.'
      using errcode = '22023';
  end if;

  if char_length(v_reason) > 300 then
    raise exception 'Reason must not exceed 300 characters.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_actor_id::text || ':' || p_request_id::text,
      0
    )
  );

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
        'waste'::public.inventory_transaction_type
      or v_existing_inventory_item_id <>
        p_inventory_item_id
      or v_existing_quantity_change <>
        -p_quantity
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
        'waste',
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
      'Inactive inventory items cannot record waste.'
      using errcode = '22023';
  end if;

  if p_quantity > v_before then
    raise exception
      'Waste quantity exceeds available stock. Current quantity: %, requested waste: %.',
      v_before,
      p_quantity
      using errcode = '22023';
  end if;

  v_after := v_before - p_quantity;
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
    'waste',
    -p_quantity,
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
      'waste',
    'quantity_change',
      -p_quantity,
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
on function public.record_inventory_waste(
  uuid,
  numeric,
  text,
  uuid
)
from public, anon;

grant execute
on function public.record_inventory_waste(
  uuid,
  numeric,
  text,
  uuid
)
to authenticated, service_role;

commit;
