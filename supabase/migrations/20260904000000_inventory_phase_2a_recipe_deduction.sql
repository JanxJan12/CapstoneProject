-- RRJ'S FOOD-HOUSE
-- Inventory Phase 2A: recipe mappings and automatic confirmed-order deduction.

-- ============================================================
-- 1. MENU INGREDIENT MAPPINGS
-- ============================================================

insert into public.menu_ingredients (
  menu_item_id,
  inventory_item_id,
  quantity_required
)
values
  -- Adobong Manok
  (
    '79dc274a-b608-4ff8-b14a-c8f9b1effb4f'::uuid,
    'b467aeba-d158-4c6d-b43b-1b71a60910c4'::uuid,
    0.250
  ),
  (
    '79dc274a-b608-4ff8-b14a-c8f9b1effb4f'::uuid,
    '37401723-e5ca-4664-acad-d58281c61d15'::uuid,
    0.030
  ),
  (
    '79dc274a-b608-4ff8-b14a-c8f9b1effb4f'::uuid,
    '3a13849a-eb71-4806-8451-a0f3887746b1'::uuid,
    0.020
  ),

  -- Crispy Beef Tadyang
  (
    'bf931531-0d32-4092-ae0e-448e40d5aaca'::uuid,
    '07e2a344-1d50-4453-b8b9-7f3a17251e5a'::uuid,
    0.300
  ),
  (
    'bf931531-0d32-4092-ae0e-448e40d5aaca'::uuid,
    '29c32f11-aaff-4e87-a781-4f4723924e41'::uuid,
    0.030
  ),

  -- Chicken Bicol Express
  (
    'eda59cc3-eb0a-4090-80ef-1788229d619a'::uuid,
    'b467aeba-d158-4c6d-b43b-1b71a60910c4'::uuid,
    0.250
  ),
  (
    'eda59cc3-eb0a-4090-80ef-1788229d619a'::uuid,
    '002ed07e-3cd8-4b36-b2b6-bad61e8a5579'::uuid,
    0.120
  ),

  -- Kare-Kare
  (
    '36cf63ad-47bd-40d7-8239-0922769013d4'::uuid,
    '07e2a344-1d50-4453-b8b9-7f3a17251e5a'::uuid,
    0.250
  ),
  (
    '36cf63ad-47bd-40d7-8239-0922769013d4'::uuid,
    'b22e76f0-5e37-4228-9d21-9196b5ea93cd'::uuid,
    0.050
  ),
  (
    '36cf63ad-47bd-40d7-8239-0922769013d4'::uuid,
    '4271eea5-2c8a-413d-9d56-7fe47107f272'::uuid,
    0.150
  ),

  -- White Rice
  (
    '0e0939e8-5e5a-462d-95aa-caa834531a14'::uuid,
    'a3355239-1a21-4459-b80d-a174164872b9'::uuid,
    0.150
  ),

  -- Fried Rice
  (
    'a23b01b5-1c32-443e-9d3e-cbff54040aed'::uuid,
    'a3355239-1a21-4459-b80d-a174164872b9'::uuid,
    0.180
  ),
  (
    'a23b01b5-1c32-443e-9d3e-cbff54040aed'::uuid,
    '29c32f11-aaff-4e87-a781-4f4723924e41'::uuid,
    0.015
  ),

  -- Sinigang na Baka
  (
    '28cef5f3-b549-4d6a-9e39-61b1cf6f3e11'::uuid,
    '07e2a344-1d50-4453-b8b9-7f3a17251e5a'::uuid,
    0.250
  ),
  (
    '28cef5f3-b549-4d6a-9e39-61b1cf6f3e11'::uuid,
    'd6d69f5e-00bf-4487-a1f8-f3fa5fe63bd8'::uuid,
    0.250
  ),

  -- Pinakbet
  (
    '54cd08a0-e6fd-4d60-84f4-04fb9be8be44'::uuid,
    '4271eea5-2c8a-413d-9d56-7fe47107f272'::uuid,
    0.250
  ),

  -- Buko Juice
  (
    'e2cd2cd2-1d5d-4a64-83fc-0c7b8efc0e9c'::uuid,
    '617cf643-6691-4710-834d-b9e9713d2bb9'::uuid,
    1.000
  ),

  -- Softdrinks
  (
    '3c78b355-2613-4f5b-af4d-ac2197d957fe'::uuid,
    '7f9f25fd-6d1c-4177-8516-043d06f778a4'::uuid,
    1.000
  )
on conflict (menu_item_id, inventory_item_id)
do update set
  quantity_required = excluded.quantity_required;


-- ============================================================
-- 2. AUTOMATIC ISSUANCE IDEMPOTENCY
-- ============================================================

create unique index if not exists inventory_transactions_order_item_issuance_uidx
on public.inventory_transactions (order_id, inventory_item_id)
where transaction_type = 'issuance'::public.inventory_transaction_type
  and order_id is not null;


-- ============================================================
-- 3. INTERNAL CONFIRMED-ORDER INVENTORY DEDUCTION
-- ============================================================

create or replace function public.deduct_inventory_for_confirmed_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_status public.order_status;
  v_requirement record;
  v_item_name text;
  v_is_active boolean;
  v_quantity_before numeric;
  v_quantity_after numeric;
begin
  if p_order_id is null then
    raise exception 'Order ID is required for inventory deduction.'
      using errcode = '22023';
  end if;

  select o.current_status
  into v_order_status
  from public.orders o
  where o.id = p_order_id
  for share;

  if not found then
    raise exception 'Order not found for inventory deduction.'
      using errcode = 'P0002';
  end if;

  if v_order_status not in (
    'confirmed'::public.order_status,
    'preparing'::public.order_status,
    'ready'::public.order_status,
    'waiting_for_rider'::public.order_status,
    'rider_accepted'::public.order_status,
    'picked_up'::public.order_status,
    'out_for_delivery'::public.order_status,
    'delivered'::public.order_status,
    'completed'::public.order_status
  ) then
    raise exception
      'Order % is not confirmed or in the fulfilled lifecycle. Current status: %.',
      p_order_id,
      v_order_status
      using errcode = '22023';
  end if;

  for v_requirement in
    select
      mi.inventory_item_id,
      sum(
        oi.quantity::numeric * mi.quantity_required
      ) as required_quantity
    from public.order_items oi
    join public.menu_ingredients mi
      on mi.menu_item_id = oi.menu_item_id
    where oi.order_id = p_order_id
    group by mi.inventory_item_id
    order by mi.inventory_item_id
  loop
    if exists (
      select 1
      from public.inventory_transactions transaction_record
      where transaction_record.order_id = p_order_id
        and transaction_record.inventory_item_id =
          v_requirement.inventory_item_id
        and transaction_record.transaction_type =
          'issuance'::public.inventory_transaction_type
    ) then
      continue;
    end if;

    select
      inventory_item.item_name,
      inventory_item.is_active,
      inventory_item.quantity_on_hand
    into
      v_item_name,
      v_is_active,
      v_quantity_before
    from public.inventory_items inventory_item
    where inventory_item.id = v_requirement.inventory_item_id
    for update;

    if not found then
      raise exception
        'Inventory item % required by order % was not found.',
        v_requirement.inventory_item_id,
        p_order_id
        using errcode = 'P0002';
    end if;

    if not v_is_active then
      raise exception
        'Inventory item "%" is inactive and cannot be deducted.',
        v_item_name
        using errcode = '22023';
    end if;

    -- Recheck after the row lock so concurrent trigger calls remain idempotent.
    if exists (
      select 1
      from public.inventory_transactions transaction_record
      where transaction_record.order_id = p_order_id
        and transaction_record.inventory_item_id =
          v_requirement.inventory_item_id
        and transaction_record.transaction_type =
          'issuance'::public.inventory_transaction_type
    ) then
      continue;
    end if;

    if v_quantity_before < v_requirement.required_quantity then
      raise exception
        'Insufficient stock for inventory item "%": available %, required %.',
        v_item_name,
        v_quantity_before,
        v_requirement.required_quantity
        using errcode = '22023';
    end if;

    v_quantity_after :=
      v_quantity_before - v_requirement.required_quantity;

    update public.inventory_items
    set
      quantity_on_hand = v_quantity_after,
      updated_at = now()
    where id = v_requirement.inventory_item_id;

    insert into public.inventory_transactions (
      inventory_item_id,
      order_id,
      performed_by,
      transaction_type,
      quantity_change,
      quantity_before,
      quantity_after,
      reason,
      created_at
    )
    values (
      v_requirement.inventory_item_id,
      p_order_id,
      null,
      'issuance'::public.inventory_transaction_type,
      -v_requirement.required_quantity,
      v_quantity_before,
      v_quantity_after,
      'Automatic deduction for confirmed order',
      now()
    );
  end loop;

  return;
end;
$$;

revoke execute
on function public.deduct_inventory_for_confirmed_order(uuid)
from public;

revoke execute
on function public.deduct_inventory_for_confirmed_order(uuid)
from authenticated;

grant execute
on function public.deduct_inventory_for_confirmed_order(uuid)
to service_role;


-- ============================================================
-- 4. CONFIRMED STATUS-HISTORY TRIGGER
-- ============================================================

create or replace function public.deduct_inventory_on_confirmed_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_channel public.order_channel;
begin
  select o.order_channel
  into v_order_channel
  from public.orders o
  where o.id = new.order_id;

  if v_order_channel = 'walk_in'::public.order_channel then
    perform public.deduct_inventory_for_confirmed_order(new.order_id);
  end if;

  return new;
end;
$$;

revoke execute
on function public.deduct_inventory_on_confirmed_history()
from public;

revoke execute
on function public.deduct_inventory_on_confirmed_history()
from authenticated;

grant execute
on function public.deduct_inventory_on_confirmed_history()
to service_role;

drop trigger if exists
order_status_history_deduct_inventory_on_confirmed_trg
on public.order_status_history;

create trigger order_status_history_deduct_inventory_on_confirmed_trg
after insert on public.order_status_history
for each row
when (new.status = 'confirmed'::public.order_status)
execute function public.deduct_inventory_on_confirmed_history();
